from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(Integer, primary_key=True, index=True)
    blueprint_id = Column(Integer, ForeignKey("blueprints.id"))
    provider = Column(String, nullable=False, default="gemini")
    model = Column(String, nullable=False)
    raw_response = Column(JSON, nullable=True) # Full unstructured response
    structured_result = Column(JSON, nullable=True) # Parsed structured elements
    processing_time = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    blueprint = relationship("Blueprint", back_populates="ocr_results")
