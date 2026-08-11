# BatiSelf — Gestion de chantiers

Application web locale de gestion des matériaux pour chantiers de rénovation.

## Fonctionnalités

- **Multi-chantiers** : gérez plusieurs projets en parallèle
- **Pièces avec dimensions** : calcul automatique des surfaces sol/murs et volume
- **Référentiel matériaux** : base réutilisable entre chantiers, groupée par corps de métier
- **Dépendances** : calcul automatique des matériaux associés (colle, croisillons, joint…)
- **Incompatibilités** : alertes visuelles (bloquant / avertissement) entre matériaux
- **Suggestions** : matériaux recommandés selon le type de pièce (pièce d'eau, chambre…)
- **Import Obat** : mise à jour du référentiel depuis un export CSV/Excel Obat
- **Export PDF** : liste consolidée par chantier avec estimation budgétaire

## Stack technique

| Couche     | Technologie                          |
|------------|--------------------------------------|
| Backend    | Python 3.10+ · FastAPI · SQLModel    |
| Base de données | SQLite (fichier local `batiself.db`) |
| Frontend   | React 18 · TypeScript · Vite · TailwindCSS |
| PDF        | ReportLab                            |
| Import     | openpyxl (CSV / Excel)               |

## Installation

### Prérequis

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt

# Initialiser la base avec le référentiel fourni
python3 seed_referentiel.py
```

### Frontend

```bash
cd frontend
npm install
```

## Démarrage

```bash
bash start.sh
```

Ouvre ensuite **http://localhost:5173** dans ton navigateur.

L'API FastAPI est disponible sur **http://localhost:8000/docs**.

## Import depuis Obat

1. Dans Obat : **Bibliothèque → Ouvrages/Fournitures → Exporter CSV**
2. Dans BatiSelf : page **Référentiel** → bouton **"MAJ référentiel Obat"**
3. Sélectionner le fichier exporté (`.csv` ou `.xlsx`)

Colonnes reconnues automatiquement : `Désignation`, `Unité`, `Prix unitaire HT`, `Famille`, `Référence`, `Fournisseur`.
Les matériaux existants (même nom) sont mis à jour ; les nouveaux sont créés.

## Export PDF

Sur la page d'un chantier, cliquer **"Export PDF"** pour télécharger un document contenant :
- En-tête avec logo BatiSelf et informations du chantier
- Récapitulatif des pièces (dimensions)
- Liste des matériaux par pièce (principal + dépendants)
- Liste consolidée globale triée par corps de métier
- Total estimé HT (si les prix unitaires sont renseignés)

## Structure du projet

```
batiself/
├── backend/
│   ├── main.py                 Point d'entrée FastAPI
│   ├── models.py               Modèles SQLModel
│   ├── database.py             Connexion SQLite
│   ├── seed_referentiel.py     Script d'initialisation de la BDD
│   ├── data/                   CSV du référentiel initial
│   ├── routers/                Endpoints REST (chantiers, pièces, matériaux…)
│   └── services/
│       ├── import_obat.py      Import CSV/Excel Obat
│       └── pdf_export.py       Génération PDF ReportLab
├── frontend/
│   └── src/
│       ├── api/client.ts       Client API typé
│       ├── components/         Layout sidebar
│       └── pages/              Chantiers, Pièces, Référentiel, Règles
├── start.sh                    Script de démarrage
└── README.md
```

## Modèle de données

```
CHANTIER ──< PIECE ──< POSTE_TRAVAUX >── MATERIAU
                                              │
                                    DEPENDANCE (MATERIAU → MATERIAU)
                                    INCOMPATIBILITE (MATERIAU ✕ MATERIAU)
                                    TYPE_PIECE_MATERIAU (suggestions)
```
