from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routers import chantiers, pieces, materiaux, dependances, postes, import_export

app = FastAPI(title="BatiSelf API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chantiers.router)
app.include_router(pieces.router)
app.include_router(materiaux.router)
app.include_router(dependances.router)
app.include_router(postes.router)
app.include_router(import_export.router)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
