from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from models import Dependance, DependanceCreate, DependanceRead, Incompatibilite, IncompatibiliteCreate, IncompatibiliteRead
from database import get_session

router = APIRouter(tags=["dependances"])



@router.get("/dependances", response_model=list[DependanceRead])
def list_dependances(session: Session = Depends(get_session)):
    return session.exec(select(Dependance)).all()


@router.post("/dependances", response_model=DependanceRead, status_code=201)
def create_dependance(data: DependanceCreate, session: Session = Depends(get_session)):
    d = Dependance.model_validate(data)
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.put("/dependances/{dep_id}", response_model=DependanceRead)
def update_dependance(dep_id: int, data: DependanceCreate, session: Session = Depends(get_session)):
    d = session.get(Dependance, dep_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dépendance introuvable")
    for k, v in data.model_dump().items():
        setattr(d, k, v)
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.delete("/dependances/{dep_id}", status_code=204)
def delete_dependance(dep_id: int, session: Session = Depends(get_session)):
    d = session.get(Dependance, dep_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dépendance introuvable")
    session.delete(d)
    session.commit()


@router.get("/incompatibilites", response_model=list[IncompatibiliteRead])
def list_incompatibilites(session: Session = Depends(get_session)):
    return session.exec(select(Incompatibilite)).all()


@router.post("/incompatibilites", response_model=IncompatibiliteRead, status_code=201)
def create_incompatibilite(data: IncompatibiliteCreate, session: Session = Depends(get_session)):
    i = Incompatibilite.model_validate(data)
    session.add(i)
    session.commit()
    session.refresh(i)
    return i


@router.put("/incompatibilites/{incompat_id}", response_model=IncompatibiliteRead)
def update_incompatibilite(incompat_id: int, data: IncompatibiliteCreate, session: Session = Depends(get_session)):
    i = session.get(Incompatibilite, incompat_id)
    if not i:
        raise HTTPException(status_code=404, detail="Incompatibilité introuvable")
    for k, v in data.model_dump().items():
        setattr(i, k, v)
    session.add(i)
    session.commit()
    session.refresh(i)
    return i


@router.delete("/incompatibilites/{incompat_id}", status_code=204)
def delete_incompatibilite(incompat_id: int, session: Session = Depends(get_session)):
    i = session.get(Incompatibilite, incompat_id)
    if not i:
        raise HTTPException(status_code=404, detail="Incompatibilité introuvable")
    session.delete(i)
    session.commit()
