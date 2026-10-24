from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.core.database import Base, engine

# Import ALL models so SQLAlchemy relationships resolve before create_all
from app.models import user, project, blueprint, blueprint_element, ocr_result, audit_log, comparison  # noqa: F401

# Create all DB tables on startup (SQLite safe)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}

from app.routers import auth, health, blueprint, projects

app.include_router(health.router, prefix=f"{settings.API_V1_STR}")
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(blueprint.router, prefix=f"{settings.API_V1_STR}/blueprints", tags=["blueprints"])
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
