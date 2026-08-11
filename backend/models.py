from enum import Enum
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship


class TypePiece(str, Enum):
    piece_eau = "pièce d'eau"
    piece_vie = "pièce à vivre"
    chambre = "chambre"
    piece_morte = "pièce morte"


class SeveriteIncompat(str, Enum):
    bloquant = "bloquant"
    avertissement = "avertissement"


class TypeDependance(str, Enum):
    obligatoire = "obligatoire"
    optionnelle = "optionnelle"
    conditionnelle = "conditionnelle"


# ─── CHANTIER ────────────────────────────────────────────────────────────────

class ChantierBase(SQLModel):
    nom: str
    description: str = ""


class Chantier(ChantierBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pieces: List["Piece"] = Relationship(back_populates="chantier")


class ChantierCreate(ChantierBase):
    pass


class ChantierRead(ChantierBase):
    id: int
    nb_pieces: int = 0


# ─── PIECE ────────────────────────────────────────────────────────────────────

class PieceBase(SQLModel):
    libelle: str
    longueur: float
    largeur: float
    hauteur: float
    type_piece: TypePiece
    surface_ouvertures: float = 0.0


class Piece(PieceBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chantier_id: int = Field(foreign_key="chantier.id")
    chantier: Optional[Chantier] = Relationship(back_populates="pieces")
    postes: List["PosteTravaux"] = Relationship(back_populates="piece")


class PieceCreate(PieceBase):
    chantier_id: int


class PieceRead(PieceBase):
    id: int
    chantier_id: int
    surface_sol: float
    surface_murs: float
    volume: float


# ─── MATERIAU ────────────────────────────────────────────────────────────────

class MateriauBase(SQLModel):
    nom: str
    corps_metier: str
    unite: str
    ratio_consommation: float = 1.0
    prix_unitaire: Optional[float] = None
    fournisseur: Optional[str] = None
    notes: Optional[str] = None
    reference_obat: Optional[str] = None


class Materiau(MateriauBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class MateriauCreate(MateriauBase):
    pass


class MateriauRead(MateriauBase):
    id: int


# ─── DEPENDANCE ──────────────────────────────────────────────────────────────

class DependanceBase(SQLModel):
    materiau_principal_id: int = Field(foreign_key="materiau.id")
    materiau_dependant_id: int = Field(foreign_key="materiau.id")
    ratio: float = 1.0
    type_dependance: TypeDependance = TypeDependance.obligatoire
    condition: Optional[str] = None


class Dependance(DependanceBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class DependanceCreate(DependanceBase):
    pass


class DependanceRead(DependanceBase):
    id: int


# ─── INCOMPATIBILITE ─────────────────────────────────────────────────────────

class IncompatibiliteBase(SQLModel):
    materiau_a_id: int = Field(foreign_key="materiau.id")
    materiau_b_id: int = Field(foreign_key="materiau.id")
    raison: str
    severite: SeveriteIncompat = SeveriteIncompat.avertissement


class Incompatibilite(IncompatibiliteBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class IncompatibiliteCreate(IncompatibiliteBase):
    pass


class IncompatibiliteRead(IncompatibiliteBase):
    id: int


# ─── TYPE PIECE → MATERIAU RECOMMANDÉ ────────────────────────────────────────

class TypePieceMateriau(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type_piece: TypePiece
    materiau_id: int = Field(foreign_key="materiau.id")


# ─── POSTE DE TRAVAUX ─────────────────────────────────────────────────────────

class PosteTravauxBase(SQLModel):
    piece_id: int = Field(foreign_key="piece.id")
    corps_metier: str
    materiau_principal_id: int = Field(foreign_key="materiau.id")
    quantite_reference: float


class PosteTravaux(PosteTravauxBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    piece: Optional[Piece] = Relationship(back_populates="postes")


class PosteTravauxCreate(PosteTravauxBase):
    pass


class PosteTravauxRead(PosteTravauxBase):
    id: int
