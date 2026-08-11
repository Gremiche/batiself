from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import CorpsMetier, CorpsMetierCreate, CorpsMetierRead, Materiau
from database import get_session

router = APIRouter(prefix="/corps-metier", tags=["corps-metier"])


@router.get("/", response_model=list[CorpsMetierRead])
def list_corps_metier(session: Session = Depends(get_session)):
    return session.exec(select(CorpsMetier).order_by(CorpsMetier.ordre, CorpsMetier.nom)).all()


@router.post("/", response_model=CorpsMetierRead, status_code=201)
def create_corps_metier(data: CorpsMetierCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(CorpsMetier).where(CorpsMetier.nom == data.nom)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ce corps de métier existe déjà.")
    cm = CorpsMetier.model_validate(data)
    session.add(cm)
    session.commit()
    session.refresh(cm)
    return cm


@router.put("/{cm_id}", response_model=CorpsMetierRead)
def update_corps_metier(cm_id: int, data: CorpsMetierCreate, session: Session = Depends(get_session)):
    cm = session.get(CorpsMetier, cm_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Corps de métier introuvable.")
    old_nom = cm.nom
    cm.nom   = data.nom
    cm.ordre = data.ordre
    session.add(cm)
    # Répercuter le renommage sur les matériaux
    if old_nom != data.nom:
        for m in session.exec(select(Materiau).where(Materiau.corps_metier == old_nom)).all():
            m.corps_metier = data.nom
            session.add(m)
    session.commit()
    session.refresh(cm)
    return cm


@router.delete("/{cm_id}", status_code=204)
def delete_corps_metier(cm_id: int, session: Session = Depends(get_session)):
    cm = session.get(CorpsMetier, cm_id)
    if not cm:
        raise HTTPException(status_code=404, detail="Corps de métier introuvable.")
    used = session.exec(select(Materiau).where(Materiau.corps_metier == cm.nom)).first()
    if used:
        raise HTTPException(
            status_code=409,
            detail=f"Impossible de supprimer '{cm.nom}' : des matériaux l'utilisent encore."
        )
    session.delete(cm)
    session.commit()
