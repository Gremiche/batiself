import math
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from models import Chantier, ChantierCreate, ChantierRead, Piece, PosteTravaux, Materiau, Dependance
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


@router.get("/{chantier_id}/synthese")
def get_synthese(chantier_id: int, session: Session = Depends(get_session)):
    """Synthèse consolidée de tous les matériaux d'un chantier, regroupés par corps de métier."""
    chantier = session.get(Chantier, chantier_id)
    if not chantier:
        raise HTTPException(status_code=404, detail="Chantier introuvable")

    pieces = session.exec(select(Piece).where(Piece.chantier_id == chantier_id)).all()

    # materiau_id → {nom, corps_metier, unite, prix_unitaire, conditionnement, unite_achat, quantite_totale}
    agregat: dict[int, dict] = {}

    def _add_qte(mat: Materiau, qte: float) -> None:
        if mat.id not in agregat:
            agregat[mat.id] = {
                "materiau_id": mat.id,
                "nom": mat.nom,
                "corps_metier": mat.corps_metier,
                "unite": mat.unite,
                "prix_unitaire": mat.prix_unitaire,
                "conditionnement": mat.conditionnement,
                "unite_achat": mat.unite_achat,
                "quantite_totale": 0.0,
            }
        agregat[mat.id]["quantite_totale"] += qte

    for piece in pieces:
        postes = session.exec(select(PosteTravaux).where(PosteTravaux.piece_id == piece.id)).all()
        for poste in postes:
            mat = session.get(Materiau, poste.materiau_principal_id)
            if not mat:
                continue
            qte_principale = poste.quantite_reference * mat.ratio_consommation
            _add_qte(mat, qte_principale)

            excluded_ids: set[int] = set()
            if poste.dependances_exclues:
                excluded_ids = {int(x) for x in poste.dependances_exclues.split(",") if x.strip()}

            dependances = session.exec(
                select(Dependance).where(Dependance.materiau_principal_id == poste.materiau_principal_id)
            ).all()
            for dep in dependances:
                if dep.id in excluded_ids:
                    continue
                if poste.usage and dep.usage and dep.usage != poste.usage:
                    continue
                mat_dep = session.get(Materiau, dep.materiau_dependant_id)
                if not mat_dep:
                    continue
                _add_qte(mat_dep, poste.quantite_reference * dep.ratio)

    marge = 1 + (chantier.marge_securite or 0) / 100

    lignes = []
    for entry in agregat.values():
        qte = entry["quantite_totale"] * marge
        cond = entry["conditionnement"]
        nb_achat = math.ceil(qte / cond) if cond and cond > 0 else None
        lignes.append({
            **entry,
            "quantite_totale": round(qte, 3),
            "nb_achat": nb_achat,
            "total": round(qte * (entry["prix_unitaire"] or 0), 2),
        })

    lignes.sort(key=lambda x: (x["corps_metier"], x["nom"]))

    total_ht = round(sum(l["total"] for l in lignes), 2)
    return {
        "chantier_id": chantier_id,
        "nom": chantier.nom,
        "marge_securite": chantier.marge_securite or 0,
        "lignes": lignes,
        "total_ht": total_ht,
    }
