import hashlib
import os
from pathlib import Path
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.blueprint import Blueprint, BlueprintStatus
from app.models.blueprint_element import BlueprintElement
from app.models.ocr_result import OCRResult
from app.schemas.blueprint import Blueprint as BlueprintSchema
from app.services.preprocessing import PreprocessingService
from app.services.pipeline import PipelineService

router = APIRouter()

@router.post("/upload", response_model=BlueprintSchema)
async def upload_blueprint(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    # Check SQLite for an existing extraction with the exact same original file hash
    existing_bp = (
        db.query(Blueprint)
        .filter(
            Blueprint.file_hash == file_hash,
            Blueprint.status.in_([BlueprintStatus.READY_FOR_REVIEW, BlueprintStatus.VERIFIED])
        )
        .order_by(Blueprint.id.desc())
        .first()
    )

    if existing_bp:
        print(f"=== SHA-256 MATCH FOUND: {file_hash} ===")
        print(f"Reusing saved extraction from blueprint ID {existing_bp.id}. Skipping Gemini call.")

        # If existing blueprint belongs to the same project, return it directly
        if existing_bp.project_id == project_id:
            setattr(existing_bp, "extraction_status", "existing")
            setattr(existing_bp, "extraction_source", "saved_extraction")
            return existing_bp

        # Otherwise create a new Blueprint record for this project copying the saved elements
        processor = PreprocessingService()
        original_path, processed_path, width, height = processor.process_and_save_upload(
            content, file.filename, settings.MAX_UPLOAD_SIZE_MB
        )
        new_bp = Blueprint(
            project_id=project_id,
            original_filename=Path(file.filename).name,
            original_path=original_path,
            processed_path=processed_path,
            file_hash=file_hash,
            extraction_version=existing_bp.extraction_version or "2.0",
            status=BlueprintStatus.READY_FOR_REVIEW,
            width=width,
            height=height,
        )
        db.add(new_bp)
        db.commit()
        db.refresh(new_bp)

        # Copy existing elements
        existing_elements = db.query(BlueprintElement).filter(BlueprintElement.blueprint_id == existing_bp.id).all()
        for el in existing_elements:
            db.add(BlueprintElement(
                blueprint_id=new_bp.id,
                element_type=el.element_type,
                element_data=el.element_data,
                confidence=el.confidence,
                source=el.source,
                is_verified=el.is_verified,
            ))
        db.commit()

        setattr(new_bp, "extraction_status", "existing")
        setattr(new_bp, "extraction_source", "saved_extraction")
        return new_bp

    # New image extraction
    processor = PreprocessingService()
    original_path, processed_path, width, height = processor.process_and_save_upload(
        content, file.filename, settings.MAX_UPLOAD_SIZE_MB
    )

    blueprint = Blueprint(
        project_id=project_id,
        original_filename=Path(file.filename).name,
        original_path=original_path,
        processed_path=processed_path,
        file_hash=file_hash,
        extraction_version="2.0",
        status=BlueprintStatus.UPLOADED,
        width=width,
        height=height,
    )
    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)

    try:
        PipelineService(db).run_pipeline(blueprint.id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Blueprint processing failed: {exc}") from exc

    setattr(blueprint, "extraction_status", "new")
    setattr(blueprint, "extraction_source", "ai_extraction")
    return blueprint

@router.get("/{blueprint_id}", response_model=BlueprintSchema)
def get_blueprint(blueprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blueprint = _get_owned_blueprint(db, blueprint_id, current_user.id)
    return blueprint

@router.get("/{blueprint_id}/elements")
def get_blueprint_elements(blueprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_owned_blueprint(db, blueprint_id, current_user.id)
    elements = db.query(BlueprintElement).filter(BlueprintElement.blueprint_id == blueprint_id).order_by(BlueprintElement.id).all()
    return [
        {
            "sub_type": (element.element_data or {}).get("type"),
            **(element.element_data or {}),
            "id": element.id,
            "type": element.element_type,
            "confidence": element.confidence,
            "source": element.source,
            "is_verified": element.is_verified,
        }
        for element in elements
    ]

@router.put("/{blueprint_id}/elements")
def save_blueprint_elements(
    blueprint_id: int,
    payload: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    blueprint = _get_owned_blueprint(db, blueprint_id, current_user.id)
    db.query(BlueprintElement).filter(BlueprintElement.blueprint_id == blueprint_id).delete(synchronize_session=False)
    for item in payload:
        element_type = item.get("type", "unknown")
        data = {k: v for k, v in item.items() if k not in {"id", "type", "source", "is_verified", "confidence"}}
        db.add(BlueprintElement(
            blueprint_id=blueprint_id,
            element_type=element_type,
            element_data=data,
            confidence=item.get("confidence"),
            source="user",
            is_verified=True,
        ))
    blueprint.version = (blueprint.version or 1) + 1
    blueprint.status = BlueprintStatus.VERIFIED
    db.commit()
    return {"message": "Blueprint saved", "version": blueprint.version}

@router.get("/{blueprint_id}/image")
def get_blueprint_image(blueprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blueprint = _get_owned_blueprint(db, blueprint_id, current_user.id)
    path = Path(blueprint.original_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Blueprint image not found")
    return FileResponse(path, filename=blueprint.original_filename)

@router.post("/{blueprint_id}/reprocess", response_model=BlueprintSchema)
def reprocess_blueprint(blueprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _get_owned_blueprint(db, blueprint_id, current_user.id)
    try:
        return PipelineService(db).run_pipeline(blueprint_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Blueprint processing failed: {exc}") from exc

@router.delete("/{blueprint_id}")
def delete_blueprint(blueprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blueprint = _get_owned_blueprint(db, blueprint_id, current_user.id)
    
    db.query(BlueprintElement).filter(BlueprintElement.blueprint_id == blueprint_id).delete(synchronize_session=False)
    db.query(OCRResult).filter(OCRResult.blueprint_id == blueprint_id).delete(synchronize_session=False)
    
    for file_path in [blueprint.original_path, blueprint.processed_path]:
        if file_path:
            p = Path(file_path)
            if p.is_file():
                try:
                    p.unlink()
                except OSError:
                    pass

    db.delete(blueprint)
    db.commit()
    return {"message": "Blueprint deleted successfully", "id": blueprint_id}

def _get_owned_blueprint(db: Session, blueprint_id: int, user_id: int) -> Blueprint:
    blueprint = (
        db.query(Blueprint)
        .join(Project, Project.id == Blueprint.project_id)
        .filter(Blueprint.id == blueprint_id, Project.owner_id == user_id)
        .first()
    )
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")
    return blueprint
