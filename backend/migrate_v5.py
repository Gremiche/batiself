"""Migration v5 : marge_securite sur chantier, usage + dependances_exclues sur postetravaux, usage sur dependance."""
import sqlite3
from pathlib import Path

DB = Path(__file__).parent / "batiself.db"


def add_column(cur, table, col, col_type):
    cur.execute(f"PRAGMA table_info({table})")
    if not any(r[1] == col for r in cur.fetchall()):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        print(f"  + {table}.{col}")


def migrate():
    con = sqlite3.connect(DB)
    cur = con.cursor()
    add_column(cur, "chantier",     "marge_securite",     "REAL DEFAULT 0.0")
    add_column(cur, "dependance",   "usage",              "TEXT")
    add_column(cur, "postetravaux", "usage",              "TEXT")
    add_column(cur, "postetravaux", "dependances_exclues","TEXT")
    con.commit()
    con.close()
    print("✅ Migration v5 terminée.")


if __name__ == "__main__":
    migrate()
