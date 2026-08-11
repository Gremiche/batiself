from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import (
    PosteTravaux, PosteTravauxCreate, PosteTravauxRead,
    Materiau, Dependance, Incompatibilite, Piece
)
from database import get_session

router = APIRouter(prefix="/postes", tags=["postes"])


@router.get("/piece/{piece_id}", response_model=list[PosteTravauxRead])
def list_postes(piece_id: int, session: Session = Depends(get_session)):
    return session.exec(select(PosteTravaux).where(PosteTravaux.piece_id == piece_id)).all()


@router.post("/", response_model=PosteTravauxRead, status_code=201)
def create_poste(data: PosteTravauxCreate, session: Session = Depends(get_session)):
    poste = PosteTravaux.model_validate(data)
    session.add(poste)
    session.commit()
    session.refresh(poste)
    return poste


@router.delete("/{poste_id}", status_code=204)
def delete_poste(poste_id: int, session: Session = Depends(get_session)):
    poste = session.get(PosteTravaux, poste_id)
    if not poste:
        raise HTTPException(status_code=404, detail="Poste introuvable")
    session.delete(poste)
    session.commit()


@router.get("/calcul/{poste_id}")
def calcul_poste(poste_id: int, session: Session = Depends(get_session)):
    """Retourne le matériau principal + dépendants avec quantités calculées."""
    poste = session.get(PosteTravaux, poste_id)
    if not poste:
        raise HTTPException(status_code=404, detail="Poste introuvable")

    mat_principal = session.get(Materiau, poste.materiau_principal_id)
    if not mat_principal:
        raise HTTPException(status_code=404, detail="Matériau introuvable")

    qte_principale = poste.quantite_reference * mat_principal.ratio_consommation

    dependances = session.exec(
        select(Dependance).where(Dependance.materiau_principal_id == poste.materiau_principal_id)
    ).all()

    lignes = [{
        "materiau_id": mat_principal.id,
        "nom": mat_principal.nom,
        "unite": mat_principal.unite,
        "quantite": round(qte_principale, 3),
        "prix_unitaire": mat_principal.prix_unitaire,
        "total": round(qte_principale * (mat_principal.prix_unitaire or 0), 2),
        "est_dependant": False,
    }]

    for dep in dependances:
        mat_dep = session.get(Materiau, dep.materiau_dependant_id)
        if not mat_dep:
            continue
        qte_dep = poste.quantite_reference * dep.ratio
        lignes.append({
            "materiau_id": mat_dep.id,
            "nom": mat_dep.nom,
            "unite": mat_dep.unite,
            "quantite": round(qte_dep, 3),
            "prix_unitaire": mat_dep.prix_unitaire,
            "total": round(qte_dep * (mat_dep.prix_unitaire or 0), 2),
            "est_dependant": True,
            "type_dependance": dep.type_dependance,
        })

    return {"poste_id": poste_id, "lignes": lignes}


@router.get("/incompatibilites/piece/{piece_id}")
def check_incompatibilites(piece_id: int, session: Session = Depends(get_session)):
    """Détecte les incompatibilités entre postes d'une même pièce."""
    postes = session.exec(select(PosteTravaux).where(PosteTravaux.piece_id == piece_id)).all()
    mat_ids = [p.materiau_principal_id for p in postes]

    alertes = []
    incompats = session.exec(select(Incompatibilite)).all()
    for inc in incompats:
        a_present = inc.materiau_a_id in mat_ids
        b_present = inc.materiau_b_id in mat_ids
        if a_present and b_present:
            mat_a = session.get(Materiau, inc.materiau_a_id)
            mat_b = session.get(Materiau, inc.materiau_b_id)
            alertes.append({
                "materiau_a": mat_a.nom if mat_a else str(inc.materiau_a_id),
                "materiau_b": mat_b.nom if mat_b else str(inc.materiau_b_id),
                "raison": inc.raison,
                "severite": inc.severite,
            })

    return {"piece_id": piece_id, "alertes": alertes}
