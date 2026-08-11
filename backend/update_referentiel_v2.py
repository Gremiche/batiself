"""
Mise à jour référentiel v2 :
  - Ajoute conditionnement + unite_achat sur les 27 matériaux existants
  - Ajoute 8 nouveaux matériaux (M028-M035)
  - Ajoute 5 nouvelles dépendances (D016-D020)
  - Ajoute 1 nouvelle incompatibilité (I006)
Idempotent : ne duplique pas les matériaux déjà existants.
"""

import csv
import re
from pathlib import Path
from sqlmodel import Session, select
from database import engine
from models import Materiau, Dependance, Incompatibilite, TypeDependance, SeveriteIncompat

DATA = Path(__file__).parent / "data"


def _extract_float(text: str) -> float | None:
    """Premier nombre dans la chaîne, None si 'variable' ou non trouvé."""
    if re.search(r"variable|voir fournisseur|à affiner", text, re.IGNORECASE):
        return None
    m = re.search(r"(\d+[.,]\d+|\d+)", text.replace(",", "."))
    return float(m.group(1)) if m else None


def _extract_unite_achat(cond_vente: str) -> str:
    """Extrait le nom court du conditionnement."""
    c = cond_vente.strip().lower()
    for keyword in ["big bag", "plaque", "palette", "rouleau", "panneau",
                    "couronne", "sachet", "bobine", "toupie", "paquet",
                    "barre", "boîte", "boite", "sac", "pot"]:
        if c.startswith(keyword):
            return "boîte" if keyword == "boite" else keyword
    return c.split()[0] if c.split() else "u"


def _clean_unite(unite: str) -> str:
    u = unite.strip().lower()
    if u.startswith("m²"):   return "m²"
    if u.startswith("m³"):   return "m³"
    if "linéaire" in u or u.startswith("m l"): return "m"
    return unite.strip()


def update(session: Session) -> None:
    # ── Charger le CSV matériaux v2 ──────────────────────────────────────────
    csv_rows: dict[str, dict] = {}
    with open(DATA / "referentiel_materiaux_batiself.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            csv_rows[row["id"].strip()] = row

    csv_id_to_db_id: dict[str, int] = {}

    # ── 1. Mettre à jour / créer les matériaux ───────────────────────────────
    for csv_id, row in csv_rows.items():
        nom = row["nom"].strip()
        couverture_str = row.get("couverture_par_conditionnement", "").strip()
        cond_vente_str = row.get("conditionnement_vente", "").strip()
        unite_ref     = _clean_unite(row.get("unite_reference", "u"))

        conditionnement = _extract_float(couverture_str) if couverture_str else None
        unite_achat     = _extract_unite_achat(cond_vente_str) if cond_vente_str else None

        existing = session.exec(select(Materiau).where(Materiau.nom == nom)).first()

        if existing:
            # Mise à jour uniquement des champs conditionnement
            existing.conditionnement = conditionnement
            existing.unite_achat     = unite_achat
            session.add(existing)
            csv_id_to_db_id[csv_id] = existing.id
            print(f"  ~ Mis à jour  : {nom} | cond={conditionnement} {unite_ref}/{unite_achat}")
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
            print(f"  + Nouveau     : {nom} (id={mat.id}) | cond={conditionnement} {unite_ref}/{unite_achat}")

    session.flush()

    # ── 2. Nouvelles dépendances ──────────────────────────────────────────────
    with open(DATA / "dependances_batiself.csv", encoding="utf-8-sig") as f:
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
            dep = Dependance(
                materiau_principal_id=pid,
                materiau_dependant_id=did,
                ratio=_extract_float(row.get("ratio_dependance", "1")) or 1.0,
                type_dependance=type_dep,
                condition=row.get("condition", "").strip() or None,
            )
            session.add(dep)
            print(f"  + Dépendance  : {row['materiau_principal_id']} → {row['materiau_dependant_id']}")

    # ── 3. Nouvelles incompatibilités ─────────────────────────────────────────
    with open(DATA / "incompatibilites_batiself.csv", encoding="utf-8-sig") as f:
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

    session.commit()
    total = len(csv_rows)
    print(f"\n✅ Référentiel v2 : {total} matériaux traités, nouvelles règles ajoutées.")


if __name__ == "__main__":
    with Session(engine) as session:
        update(session)
