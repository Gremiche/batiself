from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import io
from sqlmodel import Session
from database import get_session
from services.import_obat import import_from_bytes
from services.pdf_export import generate_pdf

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
