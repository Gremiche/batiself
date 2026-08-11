"""
Import du référentiel matériaux depuis un export CSV ou Excel Obat.

Colonnes attendues (insensibles à la casse, espaces ignorés) :
  Désignation / Nom          → nom
  Unité                      → unite
  Prix unitaire HT / Prix    → prix_unitaire
  Famille / Corps de métier  → corps_metier
  Référence / Ref            → reference_obat
  Fournisseur                → fournisseur
"""

import csv
import io
from typing import Any

import openpyxl
from sqlmodel import Session, select

from models import Materiau


_MAPPING: dict[str, str] = {
    "désignation": "nom",
    "designation": "nom",
    "nom": "nom",
    "libellé": "nom",
    "libelle": "nom",
    "unité": "unite",
    "unite": "unite",
    "unité de vente": "unite",
    "prix unitaire ht": "prix_unitaire",
    "prix unitaire": "prix_unitaire",
    "prix ht": "prix_unitaire",
    "prix": "prix_unitaire",
    "famille": "corps_metier",
    "corps de métier": "corps_metier",
    "corps de metier": "corps_metier",
    "catégorie": "corps_metier",
    "categorie": "corps_metier",
    "référence": "reference_obat",
    "reference": "reference_obat",
    "ref": "reference_obat",
    "fournisseur": "fournisseur",
}


def _normalise_header(h: str) -> str:
    return h.strip().lower().replace(" ", " ")


def _parse_float(val: Any) -> float | None:
    if val is None or str(val).strip() == "":
        return None
    try:
        return float(str(val).replace(",", ".").replace("€", "").strip())
    except ValueError:
        return None


def _rows_from_csv(content: bytes) -> tuple[list[str], list[list[str]]]:
    text = content.decode("utf-8-sig", errors="replace")
    dialect = csv.Sniffer().sniff(text[:2048], delimiters=";,\t")
    reader = csv.reader(io.StringIO(text), dialect)
    rows = list(reader)
    return rows[0] if rows else [], rows[1:]


def _rows_from_xlsx(content: bytes) -> tuple[list[str], list[list[Any]]]:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []
    return [str(c) if c is not None else "" for c in rows[0]], [list(r) for r in rows[1:]]


def import_from_bytes(content: bytes, filename: str, session: Session) -> dict[str, int]:
    if filename.lower().endswith((".xlsx", ".xls")):
        headers, data_rows = _rows_from_xlsx(content)
    else:
        headers, data_rows = _rows_from_csv(content)

    col_map: dict[int, str] = {}
    for i, h in enumerate(headers):
        key = _normalise_header(h)
        if key in _MAPPING:
            col_map[i] = _MAPPING[key]

    created = 0
    updated = 0

    for row in data_rows:
        record: dict[str, Any] = {}
        for i, field in col_map.items():
            val = row[i] if i < len(row) else None
            if field == "prix_unitaire":
                record[field] = _parse_float(val)
            else:
                record[field] = str(val).strip() if val is not None else ""

        nom = record.get("nom", "").strip()
        if not nom:
            continue

        existing = session.exec(
            select(Materiau).where(Materiau.nom == nom)
        ).first()

        if existing:
            for k, v in record.items():
                if v not in (None, ""):
                    setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            mat = Materiau(
                nom=nom,
                corps_metier=record.get("corps_metier", "Non classé"),
                unite=record.get("unite", "u"),
                ratio_consommation=1.0,
                prix_unitaire=record.get("prix_unitaire"),
                fournisseur=record.get("fournisseur") or None,
                reference_obat=record.get("reference_obat") or None,
            )
            session.add(mat)
            created += 1

    session.commit()
    return {"crees": created, "mis_a_jour": updated}
