"""
Migration v2 : ajoute les colonnes conditionnement, unite_achat (Materiau)
et commentaire (PosteTravaux) sur une base existante.
Idempotent : sans effet si les colonnes existent déjà.
"""

import sqlite3
from pathlib import Path

DB = Path(__file__).parent / "batiself.db"


def add_column(cursor: sqlite3.Cursor, table: str, column: str, col_type: str) -> None:
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"  + {table}.{column} ajouté")
    except sqlite3.OperationalError:
        print(f"  · {table}.{column} déjà présent")


if __name__ == "__main__":
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    add_column(cur, "materiau",      "conditionnement", "REAL")
    add_column(cur, "materiau",      "unite_achat",     "TEXT")
    add_column(cur, "postetravaux",  "commentaire",     "TEXT")

    conn.commit()
    conn.close()
    print("✅ Migration v2 terminée.")
