from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base

class ProjectStatus(str, enum.Enum):
    NEW = "New"
    PROCESSING = "Processing"
    REVIEW = "Review"
    COMPLETED = "Completed"
    ARCHIVED = "Archived"

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.NEW)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    blueprints = relationship("Blueprint", back_populates="project", cascade="all, delete-orphan")
