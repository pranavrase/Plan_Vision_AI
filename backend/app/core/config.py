from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    PROJECT_NAME: str = "CivilBlueprint AI"
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:3000", "http://127.0.0.1:3000",
    ]
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'database' / 'database.db').as_posix()}"
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin@123"
    JWT_SECRET: str = "change-this-to-a-secure-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-pro"
    GEMINI_MOCK_MODE: bool = False
    MAX_UPLOAD_SIZE_MB: int = 20

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), case_sensitive=True, extra="ignore")

settings = Settings()
