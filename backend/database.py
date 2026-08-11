from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

_DB_PATH = Path(__file__).parent / "batiself.db"
DATABASE_URL = f"sqlite:///{_DB_PATH}"
engine = create_engine(DATABASE_URL, echo=False)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
