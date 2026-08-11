from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import Materiau, MateriauCreate, MateriauRead
from database import get_session

router = APIRouter(prefix="/materiaux", tags=["materiaux"])


@router.get("/", response_model=list[MateriauRead])
def list_materiaux(session: Session = Depends(get_session)):
    return session.exec(select(Materiau)).all()


@router.post("/", response_model=MateriauRead, status_code=201)
def create_materiau(data: MateriauCreate, session: Session = Depends(get_session)):
    m = Materiau.model_validate(data)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.get("/{materiau_id}", response_model=MateriauRead)
def get_materiau(materiau_id: int, session: Session = Depends(get_session)):
    m = session.get(Materiau, materiau_id)
    if not m:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    return m


@router.put("/{materiau_id}", response_model=MateriauRead)
def update_materiau(materiau_id: int, data: MateriauCreate, session: Session = Depends(get_session)):
    m = session.get(Materiau, materiau_id)
    if not m:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


@router.delete("/{materiau_id}", status_code=204)
def delete_materiau(materiau_id: int, session: Session = Depends(get_session)):
    m = session.get(Materiau, materiau_id)
    if not m:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    session.delete(m)
    session.commit()


@router.post("/{materiau_id}/duplicate", response_model=MateriauRead, status_code=201)
def duplicate_materiau(materiau_id: int, session: Session = Depends(get_session)):
    src = session.get(Materiau, materiau_id)
    if not src:
        raise HTTPException(status_code=404, detail="Matériau introuvable")
    copy = Materiau(
        nom=f"Copie de {src.nom}",
        corps_metier=src.corps_metier,
        unite=src.unite,
        ratio_consommation=src.ratio_consommation,
        prix_unitaire=src.prix_unitaire,
        fournisseur=src.fournisseur,
        notes=src.notes,
        reference_obat=None,
        conditionnement=src.conditionnement,
        unite_achat=src.unite_achat,
    )
    session.add(copy)
    session.commit()
    session.refresh(copy)
    return copy
