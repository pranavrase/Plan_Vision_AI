from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from datetime import datetime

from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    blueprint_id = Column(Integer, ForeignKey("blueprints.id"), nullable=True)
    
    action = Column(String, index=True, nullable=False)
    details = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
