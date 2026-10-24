from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

class BlueprintElement(Base):
    __tablename__ = "blueprint_elements"

    id = Column(Integer, primary_key=True, index=True)
    blueprint_id = Column(Integer, ForeignKey("blueprints.id"))
    element_type = Column(String, index=True, nullable=False) # e.g., "wall", "door", "window", "room", "dimension"
    
    # Stores the specific data for the element as JSON, since different elements have different structures
    element_data = Column(JSON, nullable=False)
    
    confidence = Column(Float, nullable=True)
    source = Column(String, default="ai") # "ai", "user"
    is_verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    blueprint = relationship("Blueprint", back_populates="elements")
