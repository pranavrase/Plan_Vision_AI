# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum as SQLEnum
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base

class BlueprintStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    PREPROCESSING = "PREPROCESSING"
    ANALYZING = "ANALYZING"
    EXTRACTING_TEXT = "EXTRACTING_TEXT"
    DETECTING_ELEMENTS = "DETECTING_ELEMENTS"
    RECONSTRUCTING = "RECONSTRUCTING"
    VALIDATING = "VALIDATING"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"

class Blueprint(Base):
    __tablename__ = "blueprints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    original_filename = Column(String, nullable=False)
    original_path = Column(String, nullable=False)
    processed_path = Column(String, nullable=True)
    status = Column(SQLEnum(BlueprintStatus), default=BlueprintStatus.UPLOADED)
    
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    unit = Column(String, nullable=True)
    scale_x = Column(Float, nullable=True)
    scale_y = Column(Float, nullable=True)

    version = Column(Integer, default=1)
    file_hash = Column(String, index=True, nullable=True)
    extraction_version = Column(String, default="2.0")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="blueprints")
    ocr_results = relationship("OCRResult", back_populates="blueprint", cascade="all, delete-orphan")
    elements = relationship("BlueprintElement", back_populates="blueprint", cascade="all, delete-orphan")
