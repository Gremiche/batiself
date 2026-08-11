import math
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import (
    PosteTravaux, PosteTravauxCreate, PosteTravauxRead,
    Materiau, Dependance, Incompatibilite, Piece, Chantier
)
from database import get_session

router = APIRouter(prefix="/postes", tags=["postes"])

USAGES = ["Mur", "Sol", "Plafond"]


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
    poste = session.get(PosteTravaux, poste_id)
    if not poste:
        raise HTTPException(status_code=404, detail="Poste introuvable")

    mat_principal = session.get(Materiau, poste.materiau_principal_id)
    if not mat_principal:
        raise HTTPException(status_code=404, detail="Matériau introuvable")

    # Marge de sécurité du chantier
    piece = session.get(Piece, poste.piece_id)
    chantier = session.get(Chantier, piece.chantier_id) if piece else None
    marge = 1 + (chantier.marge_securite or 0) / 100 if chantier else 1.0

    qte_principale = poste.quantite_reference * mat_principal.ratio_consommation * marge

    # Dépendances filtrées par usage et exclues
    all_deps = session.exec(
        select(Dependance).where(Dependance.materiau_principal_id == poste.materiau_principal_id)
    ).all()

    excluded_ids: set[int] = set()
    if poste.dependances_exclues:
        excluded_ids = {int(x) for x in poste.dependances_exclues.split(",") if x.strip()}

    dependances = [
        d for d in all_deps
        if d.id not in excluded_ids
        and (not poste.usage or not d.usage or d.usage == poste.usage)
    ]

    def _nb_achat(qte: float, mat: Materiau) -> int | None:
        if mat.conditionnement and mat.conditionnement > 0:
            return math.ceil(qte / mat.conditionnement)
        return None

    lignes = [{
        "materiau_id": mat_principal.id,
        "nom": mat_principal.nom,
        "unite": mat_principal.unite,
        "quantite": round(qte_principale, 3),
        "prix_unitaire": mat_principal.prix_unitaire,
        "total": round(qte_principale * (mat_principal.prix_unitaire or 0), 2),
        "est_dependant": False,
        "dependance_id": None,
        "nb_achat": _nb_achat(qte_principale, mat_principal),
        "unite_achat": mat_principal.unite_achat,
        "conditionnement": mat_principal.conditionnement,
    }]

    for dep in dependances:
        mat_dep = session.get(Materiau, dep.materiau_dependant_id)
        if not mat_dep:
            continue
        qte_dep = poste.quantite_reference * dep.ratio * marge
        lignes.append({
            "materiau_id": mat_dep.id,
            "nom": mat_dep.nom,
            "unite": mat_dep.unite,
            "quantite": round(qte_dep, 3),
            "prix_unitaire": mat_dep.prix_unitaire,
            "total": round(qte_dep * (mat_dep.prix_unitaire or 0), 2),
            "est_dependant": True,
            "dependance_id": dep.id,
            "type_dependance": dep.type_dependance,
            "nb_achat": _nb_achat(qte_dep, mat_dep),
            "unite_achat": mat_dep.unite_achat,
            "conditionnement": mat_dep.conditionnement,
        })

    return {
        "poste_id": poste_id,
        "lignes": lignes,
        "commentaire": poste.commentaire,
        "usage": poste.usage,
        "marge_securite": chantier.marge_securite if chantier else 0,
    }


@router.get("/incompatibilites/piece/{piece_id}")
def check_incompatibilites(piece_id: int, session: Session = Depends(get_session)):
    postes = session.exec(select(PosteTravaux).where(PosteTravaux.piece_id == piece_id)).all()
    mat_ids = [p.materiau_principal_id for p in postes]
    alertes = []
    for inc in session.exec(select(Incompatibilite)).all():
        if inc.materiau_a_id in mat_ids and inc.materiau_b_id in mat_ids:
            mat_a = session.get(Materiau, inc.materiau_a_id)
            mat_b = session.get(Materiau, inc.materiau_b_id)
            alertes.append({
                "materiau_a": mat_a.nom if mat_a else str(inc.materiau_a_id),
                "materiau_b": mat_b.nom if mat_b else str(inc.materiau_b_id),
                "raison": inc.raison,
                "severite": inc.severite,
            })
    return {"piece_id": piece_id, "alertes": alertes}
