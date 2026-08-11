from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from models import Chantier, ChantierCreate, ChantierRead, Piece
from database import get_session

router = APIRouter(prefix="/chantiers", tags=["chantiers"])


@router.get("/", response_model=list[ChantierRead])
def list_chantiers(session: Session = Depends(get_session)):
    chantiers = session.exec(select(Chantier)).all()
    result = []
    for c in chantiers:
        nb = session.exec(
            select(func.count()).where(Piece.chantier_id == c.id)
        ).one()
        result.append(ChantierRead(id=c.id, nom=c.nom, description=c.description, nb_pieces=nb))
    return result


@router.post("/", response_model=ChantierRead, status_code=201)
def create_chantier(data: ChantierCreate, session: Session = Depends(get_session)):
    chantier = Chantier.model_validate(data)
    session.add(chantier)
    session.commit()
    session.refresh(chantier)
    return ChantierRead(id=chantier.id, nom=chantier.nom, description=chantier.description, nb_pieces=0)


@router.get("/{chantier_id}", response_model=ChantierRead)
def get_chantier(chantier_id: int, session: Session = Depends(get_session)):
    chantier = session.get(Chantier, chantier_id)
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    nb = session.exec(
        select(func.count()).where(Piece.chantier_id == chantier_id)
    ).one()
    return ChantierRead(id=chantier.id, nom=chantier.nom, description=chantier.description, nb_pieces=nb)


@router.put("/{chantier_id}", response_model=ChantierRead)
def update_chantier(chantier_id: int, data: ChantierCreate, session: Session = Depends(get_session)):
    chantier = session.get(Chantier, chantier_id)
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    chantier.nom = data.nom
    chantier.description = data.description
    session.add(chantier)
    session.commit()
    session.refresh(chantier)
    nb = session.exec(select(func.count()).where(Piece.chantier_id == chantier_id)).one()
    return ChantierRead(id=chantier.id, nom=chantier.nom, description=chantier.description, nb_pieces=nb)


@router.delete("/{chantier_id}", status_code=204)
def delete_chantier(chantier_id: int, session: Session = Depends(get_session)):
    chantier = session.get(Chantier, chantier_id)
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    session.delete(chantier)
    session.commit()
