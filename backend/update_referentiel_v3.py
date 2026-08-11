"""
Mise à jour référentiel v3 :
  - Ajoute 11 nouveaux matériaux (M036-M046 : électricité & plomberie)
  - Ajoute 6 nouvelles dépendances (D021-D026)
  - Ajoute 4 nouvelles incompatibilités (I003-I005 + déjà présente I006)
  - Met à jour les suggestions par type de pièce (type_piece_materiaux)
Idempotent : ne duplique pas les entrées déjà existantes.
"""

import csv
import re
from pathlib import Path
from sqlmodel import Session, select
from database import engine
from models import Materiau, Dependance, Incompatibilite, TypePieceMateriau, TypePiece, TypeDependance, SeveriteIncompat

DATA = Path(__file__).parent / "data"

TYPE_PIECE_MAP = {
    "piece_d_eau":   TypePiece.piece_eau,
    "piece_a_vivre": TypePiece.piece_vie,
    "chambre":       TypePiece.chambre,
    "piece_morte":   TypePiece.piece_morte,
}


def _extract_float(text: str) -> float | None:
    if re.search(r"variable|voir fournisseur|à affiner", text, re.IGNORECASE):
        return None
    m = re.search(r"(\d+[.,]\d+|\d+)", str(text).replace(",", "."))
    return float(m.group(1)) if m else None


def _extract_unite_achat(cond_vente: str) -> str:
    c = cond_vente.strip().lower()
    for keyword in ["big bag", "plaque", "palette", "rouleau", "panneau",
                    "couronne", "sachet", "bobine", "toupie", "paquet",
                    "barre", "boîte", "boite", "sac", "pot", "unité", "unite"]:
        if c.startswith(keyword):
            if keyword == "boite":   return "boîte"
            if keyword in ("unité", "unite"): return "u"
            return keyword
    return c.split()[0] if c.split() else "u"


def _clean_unite(unite: str) -> str:
    u = unite.strip().lower()
    if u.startswith("m²"):   return "m²"
    if u.startswith("m³"):   return "m³"
    if "linéaire" in u or u.startswith("m l") or u == "unité": return u if u != "unité" else "u"
    return unite.strip()


def update(session: Session) -> None:
    # ── Charger tous les matériaux du CSV ────────────────────────────────────
    csv_rows: dict[str, dict] = {}
    with open(DATA / "referentiel_materiaux_batiself.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            csv_rows[row["id"].strip()] = row

    csv_id_to_db_id: dict[str, int] = {}

    # ── 1. Matériaux : mise à jour des existants, création des nouveaux ──────
    for csv_id, row in csv_rows.items():
        nom = row["nom"].strip()
        couverture_str  = row.get("couverture_par_conditionnement", "").strip()
        cond_vente_str  = row.get("conditionnement_vente", "").strip()
        unite_ref       = _clean_unite(row.get("unite_reference", "u"))

        conditionnement = _extract_float(couverture_str) if couverture_str else None
        unite_achat     = _extract_unite_achat(cond_vente_str) if cond_vente_str else None

        existing = session.exec(select(Materiau).where(Materiau.nom == nom)).first()

        if existing:
            existing.conditionnement = conditionnement
            existing.unite_achat     = unite_achat
            session.add(existing)
            csv_id_to_db_id[csv_id] = existing.id
            print(f"  ~ Existant  : {nom}")
        else:
            ratio_str = row.get("ratio_consommation", "1")
            mat = Materiau(
                nom=nom,
                corps_metier=row["corps_metier"].strip(),
                unite=unite_ref,
                ratio_consommation=_extract_float(ratio_str) or 1.0,
                notes=f"{ratio_str.strip()} — {row.get('notes','').strip()}".strip(" —"),
                conditionnement=conditionnement,
                unite_achat=unite_achat,
            )
            session.add(mat)
            session.flush()
            csv_id_to_db_id[csv_id] = mat.id
            print(f"  + Nouveau   : {nom} (id={mat.id})")

    session.flush()

    # ── 2. Dépendances ────────────────────────────────────────────────────────
    with open(DATA / "dependances_batiself.csv", encoding="utf-8-sig") as f:
        added = 0
        for row in csv.DictReader(f):
            pid = csv_id_to_db_id.get(row["materiau_principal_id"].strip())
            did = csv_id_to_db_id.get(row["materiau_dependant_id"].strip())
            if not pid or not did:
                print(f"  ⚠ Dépendance ignorée (ID inconnu) : {row}")
                continue
            already = session.exec(
                select(Dependance)
                .where(Dependance.materiau_principal_id == pid)
                .where(Dependance.materiau_dependant_id == did)
            ).first()
            if already:
                continue
            try:
                type_dep = TypeDependance(row.get("type_dependance", "obligatoire").strip())
            except ValueError:
                type_dep = TypeDependance.obligatoire
            session.add(Dependance(
                materiau_principal_id=pid,
                materiau_dependant_id=did,
                ratio=_extract_float(row.get("ratio_dependance", "1")) or 1.0,
                type_dependance=type_dep,
                condition=row.get("condition", "").strip() or None,
            ))
            print(f"  + Dépendance : {row['materiau_principal_id']} → {row['materiau_dependant_id']}")
            added += 1
    print(f"  → {added} nouvelle(s) dépendance(s)")

    # ── 3. Incompatibilités ───────────────────────────────────────────────────
    with open(DATA / "incompatibilites_batiself.csv", encoding="utf-8-sig") as f:
        added = 0
        for row in csv.DictReader(f):
            aid = csv_id_to_db_id.get(row["materiau_a_id"].strip())
            bid = csv_id_to_db_id.get(row["materiau_b_id"].strip())
            if not aid or not bid:
                print(f"  ⚠ Incompatibilité ignorée : {row}")
                continue
            already = session.exec(
                select(Incompatibilite)
                .where(Incompatibilite.materiau_a_id == aid)
                .where(Incompatibilite.materiau_b_id == bid)
            ).first()
            if already:
                continue
            try:
                sev = SeveriteIncompat(row.get("severite", "avertissement").strip())
            except ValueError:
                sev = SeveriteIncompat.avertissement
            session.add(Incompatibilite(
                materiau_a_id=aid,
                materiau_b_id=bid,
                raison=row.get("raison", "").strip(),
                severite=sev,
            ))
            print(f"  + Incompatibilité : {row['materiau_a_id']} ✕ {row['materiau_b_id']}")
            added += 1
    print(f"  → {added} nouvelle(s) incompatibilité(s)")

    # ── 4. Suggestions par type de pièce ──────────────────────────────────────
    with open(DATA / "type_piece_materiaux_batiself.csv", encoding="utf-8-sig") as f:
        added = 0
        for row in csv.DictReader(f):
            type_raw = row.get("type_piece", "").strip()
            mat_csv_id = row.get("materiau_id", "").strip()
            type_piece = TYPE_PIECE_MAP.get(type_raw)
            mat_id = csv_id_to_db_id.get(mat_csv_id)
            if not type_piece or not mat_id:
                print(f"  ⚠ Suggestion ignorée : {row}")
                continue
            already = session.exec(
                select(TypePieceMateriau)
                .where(TypePieceMateriau.type_piece == type_piece)
                .where(TypePieceMateriau.materiau_id == mat_id)
            ).first()
            if already:
                continue
            session.add(TypePieceMateriau(type_piece=type_piece, materiau_id=mat_id))
            print(f"  + Suggestion {type_raw} → {mat_csv_id}")
            added += 1
    print(f"  → {added} nouvelle(s) suggestion(s)")

    session.commit()
    print(f"\n✅ Référentiel v3 : {len(csv_rows)} matériaux traités.")


if __name__ == "__main__":
    with Session(engine) as session:
        update(session)
