import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from database import get_session
from services.import_obat import import_from_bytes
from services.pdf_export import generate_pdf
from models import Materiau

router = APIRouter(tags=["import-export"])


@router.post("/import/obat")
async def import_obat(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Fichier manquant")
    allowed = (".csv", ".xlsx", ".xls")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail="Format non supporté (CSV ou Excel requis)")
    content = await file.read()
    result = import_from_bytes(content, file.filename, session)
    return {
        "message": f"{result['crees']} matériaux créés, {result['mis_a_jour']} mis à jour.",
        **result,
    }


@router.get("/export/referentiel/csv")
def export_referentiel_csv(session: Session = Depends(get_session)):
    materiaux = session.exec(select(Materiau).order_by(Materiau.corps_metier, Materiau.nom)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom", "Corps de métier", "Unité", "Ratio consommation", "Prix HT", "Fournisseur", "Référence Obat", "Conditionnement", "Unité achat", "Notes"])
    for m in materiaux:
        writer.writerow([
            m.nom, m.corps_metier, m.unite, m.ratio_consommation,
            m.prix_unitaire if m.prix_unitaire is not None else "",
            m.fournisseur or "", m.reference_obat or "",
            m.conditionnement if m.conditionnement is not None else "",
            m.unite_achat or "", m.notes or "",
        ])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=referentiel.csv"},
    )


@router.get("/export/pdf/{chantier_id}")
def export_pdf(chantier_id: int, session: Session = Depends(get_session)):
    try:
        pdf_bytes = generate_pdf(chantier_id, session)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=batiself-chantier-{chantier_id}.pdf"},
    )
