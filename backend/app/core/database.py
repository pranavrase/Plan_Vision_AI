from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings, BASE_DIR


def _database_url(url: str) -> str:
    if url.startswith("sqlite:///./"):
        relative = url.removeprefix("sqlite:///./")
        return f"sqlite:///{(BASE_DIR / relative).resolve().as_posix()}"
    return url

DATABASE_URL = _database_url(settings.DATABASE_URL)
if DATABASE_URL.startswith("sqlite:///"):
    db_path = Path(DATABASE_URL.removeprefix("sqlite:///"))
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
