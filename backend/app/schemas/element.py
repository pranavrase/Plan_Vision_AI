from typing import Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class BlueprintElementBase(BaseModel):
    blueprint_id: int
    element_type: str
    element_data: Dict[str, Any]
    confidence: Optional[float] = None
    source: str = "ai"
    is_verified: bool = False

class BlueprintElementCreate(BlueprintElementBase):
    pass

class BlueprintElementUpdate(BaseModel):
    element_type: Optional[str] = None
    element_data: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    source: Optional[str] = None
    is_verified: Optional[bool] = None

class BlueprintElementInDBBase(BlueprintElementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BlueprintElement(BlueprintElementInDBBase):
    pass
