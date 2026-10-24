from typing import Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime

class OCRResultBase(BaseModel):
    blueprint_id: int
    provider: str = "gemini"
    model: str
    raw_response: Optional[Dict[str, Any]] = None
    structured_result: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None
    confidence: Optional[float] = None

class OCRResultCreate(OCRResultBase):
    pass

class OCRResultUpdate(BaseModel):
    raw_response: Optional[Dict[str, Any]] = None
    structured_result: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None
    confidence: Optional[float] = None

class OCRResultInDBBase(OCRResultBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OCRResult(OCRResultInDBBase):
    pass
