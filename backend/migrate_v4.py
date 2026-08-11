"""
Migration v4 : crée la table CorpsMetier et la peuple depuis les valeurs
distinctes de materiau.corps_metier. Idempotente.
"""
import sqlite3
from pathlib import Path

DB = Path(__file__).parent / "batiself.db"


def migrate() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()

    # Créer la table si elle n'existe pas
    cur.execute("""
        CREATE TABLE IF NOT EXISTS corpsmetier (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            nom   TEXT    NOT NULL UNIQUE,
            ordre INTEGER NOT NULL DEFAULT 0
        )
    """)

    # Peupler depuis les valeurs distinctes du référentiel
    cur.execute("SELECT DISTINCT corps_metier FROM materiau WHERE corps_metier != '' ORDER BY corps_metier")
    existing_in_table = {r[0] for r in cur.execute("SELECT nom FROM corpsmetier")}

    order_map = {
        "Maçonnerie": 10, "Fondations/Dalle": 20, "Fondations": 25,
        "Dalle": 30, "Structure": 35, "Coffrage": 40, "Ferraillage": 45,
        "Toiture": 50, "Isolation": 60, "Plâtrerie": 70, "Carrelage": 80,
        "Revêtement sol": 90, "Peinture": 100, "Electricité": 110,
        "Plomberie": 120, "Sols": 130,
    }

    cur.execute("SELECT DISTINCT corps_metier FROM materiau WHERE corps_metier != '' ORDER BY corps_metier")
    for (nom,) in cur.fetchall():
        if nom not in existing_in_table:
            ordre = order_map.get(nom, 200)
            cur.execute("INSERT INTO corpsmetier (nom, ordre) VALUES (?, ?)", (nom, ordre))
            print(f"  + Corps de métier : {nom} (ordre={ordre})")

    con.commit()
    con.close()
    print("✅ Migration v4 terminée.")


if __name__ == "__main__":
    migrate()
