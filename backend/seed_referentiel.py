"""
Initialise la base de données BatiSelf avec le référentiel fourni.
Les 4 fichiers CSV doivent être dans backend/data/.
Idempotent : ne re-seede pas si des matériaux existent déjà.
"""

import csv
import re
import sys
from pathlib import Path
from sqlmodel import Session, select
from database import create_db_and_tables, engine
from models import Materiau, Dependance, Incompatibilite, TypePieceMateriau, TypePiece, TypeDependance, SeveriteIncompat

DATA = Path(__file__).parent / "data"

TYPE_PIECE_MAP = {
    "piece_d_eau": TypePiece.piece_eau,
    "piece_a_vivre": TypePiece.piece_vie,
    "chambre": TypePiece.chambre,
    "piece_morte": TypePiece.piece_morte,
}


def _extract_float(text: str) -> float:
    """Extrait le premier nombre (entier ou décimal) trouvé dans une chaîne."""
    m = re.search(r"(\d+[.,]?\d*)", str(text).replace(",", "."))
    return float(m.group(1)) if m else 1.0


def _clean_unite(unite: str) -> str:
    u = unite.strip().lower()
    if u.startswith("m²"):
        return "m²"
    if u.startswith("m³"):
        return "m³"
    if "linéaire" in u or "lineaire" in u or u.startswith("m l"):
        return "m"
    return unite.strip()


def seed(session: Session) -> None:
    # Ne pas re-seeder si des matériaux existent déjà
    existing = session.exec(select(Materiau)).first()
    if existing:
        print("⚠  Référentiel déjà chargé — aucune action.")
        return

    csv_id_to_db_id: dict[str, int] = {}

    # ── 1. Matériaux ──────────────────────────────────────────────────────────
    with open(DATA / "referentiel_materiaux_batiself.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ratio_str = row.get("ratio_consommation", "1")
            mat = Materiau(
                nom=row["nom"].strip(),
                corps_metier=row["corps_metier"].strip(),
                unite=_clean_unite(row.get("unite_reference", "u")),
                ratio_consommation=_extract_float(ratio_str),
                notes=f"{ratio_str.strip()} — {row.get('notes', '').strip()}".strip(" —"),
            )
            session.add(mat)
            session.flush()
            csv_id_to_db_id[row["id"].strip()] = mat.id
            print(f"  + Matériau  {mat.nom} (id={mat.id})")

    # ── 2. Dépendances ────────────────────────────────────────────────────────
    with open(DATA / "dependances_batiself.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = csv_id_to_db_id.get(row["materiau_principal_id"].strip())
            did = csv_id_to_db_id.get(row["materiau_dependant_id"].strip())
            if not pid or not did:
                print(f"  ⚠ Dépendance ignorée (ID inconnu) : {row}")
                continue
            type_raw = row.get("type_dependance", "obligatoire").strip().lower()
            try:
                type_dep = TypeDependance(type_raw)
            except ValueError:
                type_dep = TypeDependance.obligatoire
            dep = Dependance(
                materiau_principal_id=pid,
                materiau_dependant_id=did,
                ratio=_extract_float(row.get("ratio_dependance", "1")),
                type_dependance=type_dep,
                condition=row.get("condition", "").strip() or None,
            )
            session.add(dep)
            print(f"  + Dépendance {row['materiau_principal_id']} → {row['materiau_dependant_id']}")

    # ── 3. Incompatibilités ───────────────────────────────────────────────────
    with open(DATA / "incompatibilites_batiself.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aid = csv_id_to_db_id.get(row["materiau_a_id"].strip())
            bid = csv_id_to_db_id.get(row["materiau_b_id"].strip())
            if not aid or not bid:
                print(f"  ⚠ Incompatibilité ignorée (ID inconnu) : {row}")
                continue
            sev_raw = row.get("severite", "avertissement").strip().lower()
            try:
                sev = SeveriteIncompat(sev_raw)
            except ValueError:
                sev = SeveriteIncompat.avertissement
            inc = Incompatibilite(
                materiau_a_id=aid,
                materiau_b_id=bid,
                raison=row.get("raison", "").strip(),
                severite=sev,
            )
            session.add(inc)
            print(f"  + Incompatibilité {row['materiau_a_id']} ✕ {row['materiau_b_id']}")

    # ── 4. Suggestions par type de pièce ──────────────────────────────────────
    with open(DATA / "type_piece_materiaux_batiself.csv", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            type_raw = row.get("type_piece", "").strip()
            mat_id = csv_id_to_db_id.get(row.get("materiau_id", "").strip())
            type_piece = TYPE_PIECE_MAP.get(type_raw)
            if not type_piece or not mat_id:
                print(f"  ⚠ Suggestion ignorée : {row}")
                continue
            tpm = TypePieceMateriau(type_piece=type_piece, materiau_id=mat_id)
            session.add(tpm)
            print(f"  + Suggestion {type_raw} → matériau {mat_id}")

    session.commit()
    print(f"\n✅ Référentiel chargé : {len(csv_id_to_db_id)} matériaux, règles et suggestions.")


if __name__ == "__main__":
    create_db_and_tables()
    with Session(engine) as session:
        seed(session)
