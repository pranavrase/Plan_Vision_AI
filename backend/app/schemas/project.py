from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.models.project import ProjectStatus

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    status: Optional[ProjectStatus] = None

class ProjectInDBBase(ProjectBase):
    id: int
    owner_id: int
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Project(ProjectInDBBase):
    pass
