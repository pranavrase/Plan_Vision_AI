from typing import Optional, List, Any
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from datetime import datetime
from app.models.blueprint import BlueprintStatus

class BlueprintBase(BaseModel):
    project_id: int
    original_filename: str

class BlueprintCreate(BlueprintBase):
    pass

class BlueprintUpdate(BaseModel):
    status: Optional[BlueprintStatus] = None
    width: Optional[int] = None
    height: Optional[int] = None
    unit: Optional[str] = None
    scale_x: Optional[float] = None
    scale_y: Optional[float] = None
    version: Optional[int] = None

class BlueprintInDBBase(BlueprintBase):
    id: int
    original_path: str
    processed_path: Optional[str] = None
    status: BlueprintStatus
    width: Optional[int]
    height: Optional[int]
    unit: Optional[str]
    scale_x: Optional[float]
    scale_y: Optional[float]
    version: int
    file_hash: Optional[str] = None
    extraction_version: Optional[str] = "2.0"
    extraction_status: Optional[str] = "new"
    extraction_source: Optional[str] = "ai_extraction"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Blueprint(BlueprintInDBBase):
    pass
