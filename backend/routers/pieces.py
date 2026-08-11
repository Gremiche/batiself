from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import Piece, PieceCreate, PieceRead, Chantier, TypePieceMateriau, Materiau, MateriauRead
from database import get_session

router = APIRouter(prefix="/pieces", tags=["pieces"])


def _enrich(piece: Piece) -> PieceRead:
    perimetre = 2 * (piece.longueur + piece.largeur)
    surface_murs = max(0.0, perimetre * piece.hauteur - piece.surface_ouvertures)
    return PieceRead(
        id=piece.id,
        chantier_id=piece.chantier_id,
        libelle=piece.libelle,
        longueur=piece.longueur,
        largeur=piece.largeur,
        hauteur=piece.hauteur,
        type_piece=piece.type_piece,
        surface_ouvertures=piece.surface_ouvertures,
        surface_sol=round(piece.longueur * piece.largeur, 3),
        surface_murs=round(surface_murs, 3),
        volume=round(piece.longueur * piece.largeur * piece.hauteur, 3),
    )


@router.get("/chantier/{chantier_id}", response_model=list[PieceRead])
def list_pieces(chantier_id: int, session: Session = Depends(get_session)):
    pieces = session.exec(select(Piece).where(Piece.chantier_id == chantier_id)).all()
    return [_enrich(p) for p in pieces]


@router.post("/", response_model=PieceRead, status_code=201)
def create_piece(data: PieceCreate, session: Session = Depends(get_session)):
    if not session.get(Chantier, data.chantier_id):
        raise HTTPException(status_code=404, detail="Chantier introuvable")
    piece = Piece.model_validate(data)
    session.add(piece)
    session.commit()
    session.refresh(piece)
    return _enrich(piece)


@router.get("/{piece_id}", response_model=PieceRead)
def get_piece(piece_id: int, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    return _enrich(piece)


@router.put("/{piece_id}", response_model=PieceRead)
def update_piece(piece_id: int, data: PieceCreate, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    for k, v in data.model_dump().items():
        setattr(piece, k, v)
    session.add(piece)
    session.commit()
    session.refresh(piece)
    return _enrich(piece)


@router.delete("/{piece_id}", status_code=204)
def delete_piece(piece_id: int, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    session.delete(piece)
    session.commit()


@router.get("/{piece_id}/suggestions", response_model=list[MateriauRead])
def suggestions_pour_piece(piece_id: int, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(status_code=404, detail="Pièce introuvable")
    liens = session.exec(
        select(TypePieceMateriau).where(TypePieceMateriau.type_piece == piece.type_piece)
    ).all()
    ids = [l.materiau_id for l in liens]
    if not ids:
        return []
    materiaux = session.exec(select(Materiau).where(Materiau.id.in_(ids))).all()
    return materiaux
