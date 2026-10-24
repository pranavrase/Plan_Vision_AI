from typing import Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class ComparisonBase(BaseModel):
    blueprint_id: int
    changes: Dict[str, Any]

class ComparisonCreate(ComparisonBase):
    pass

class ComparisonInDBBase(ComparisonBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Comparison(ComparisonInDBBase):
    pass

class AuditLogBase(BaseModel):
    user_id: Optional[int] = None
    project_id: Optional[int] = None
    blueprint_id: Optional[int] = None
    action: str
    details: Optional[Dict[str, Any]] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogInDBBase(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLog(AuditLogInDBBase):
    pass
