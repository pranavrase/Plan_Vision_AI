from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

class Comparison(Base):
    __tablename__ = "comparisons"

    id = Column(Integer, primary_key=True, index=True)
    blueprint_id = Column(Integer, ForeignKey("blueprints.id"))
    
    # Store the changes: added, removed, modified elements in JSON format
    changes = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    blueprint = relationship("Blueprint")
