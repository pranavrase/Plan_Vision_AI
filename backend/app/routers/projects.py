from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.project import Project, ProjectStatus
from app.models.blueprint import Blueprint
from app.models.blueprint_element import BlueprintElement
from app.models.ocr_result import OCRResult
from app.models.user import User
from app.schemas.project import ProjectCreate, Project as ProjectSchema, ProjectUpdate

router = APIRouter()

@router.get("", response_model=list[ProjectSchema])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Project).filter(Project.owner_id == current_user.id).order_by(Project.updated_at.desc()).all()

@router.post("", response_model=ProjectSchema, status_code=201)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(name=project_in.name.strip(), description=project_in.description, owner_id=current_user.id)
    if not project.name:
        raise HTTPException(status_code=400, detail="Project name is required")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/{project_id}", response_model=ProjectSchema)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.patch("/{project_id}", response_model=ProjectSchema)
def update_project(project_id: int, project_in: ProjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    data = project_in.model_dump(exclude_unset=True)
    if "name" in data:
        data["name"] = data["name"].strip()
        if not data["name"]:
            raise HTTPException(status_code=400, detail="Project name is required")
    for key, value in data.items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    blueprints = db.query(Blueprint).filter(Blueprint.project_id == project_id).all()
    for bp in blueprints:
        db.query(BlueprintElement).filter(BlueprintElement.blueprint_id == bp.id).delete(synchronize_session=False)
        db.query(OCRResult).filter(OCRResult.blueprint_id == bp.id).delete(synchronize_session=False)
        for file_path in [bp.original_path, bp.processed_path]:
            if file_path:
                p = Path(file_path)
                if p.is_file():
                    try:
                        p.unlink()
                    except OSError:
                        pass
        db.delete(bp)

    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully", "id": project_id}

@router.get("/{project_id}/blueprints")
def list_project_blueprints(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.blueprints
