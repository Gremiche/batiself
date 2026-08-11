from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import TypePieceMateriau, TypePieceMateriauCreate, TypePieceMateriauRead
from database import get_session

router = APIRouter(prefix="/type-piece-materiaux", tags=["type-piece-materiaux"])


@router.get("/", response_model=list[TypePieceMateriauRead])
def list_type_piece_materiaux(session: Session = Depends(get_session)):
    return session.exec(select(TypePieceMateriau)).all()


@router.post("/", response_model=TypePieceMateriauRead, status_code=201)
def create_type_piece_materiau(data: TypePieceMateriauCreate, session: Session = Depends(get_session)):
    existing = session.exec(
        select(TypePieceMateriau).where(
            TypePieceMateriau.type_piece == data.type_piece,
            TypePieceMateriau.materiau_id == data.materiau_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cette association existe déjà")
    tpm = TypePieceMateriau(type_piece=data.type_piece, materiau_id=data.materiau_id)
    session.add(tpm)
    session.commit()
    session.refresh(tpm)
    return tpm


@router.delete("/{tpm_id}", status_code=204)
def delete_type_piece_materiau(tpm_id: int, session: Session = Depends(get_session)):
    tpm = session.get(TypePieceMateriau, tpm_id)
    if not tpm:
        raise HTTPException(status_code=404, detail="Association introuvable")
    session.delete(tpm)
    session.commit()
