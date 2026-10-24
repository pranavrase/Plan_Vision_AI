from typing import List, Optional, Dict, Any
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

class Coordinate(BaseModel):
    x: float
    y: float

class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float

class DocumentMetadata(BaseModel):
    type: Optional[str] = None
    scale: Optional[str] = None
    orientation: Optional[str] = None

class WallSchema(BaseModel):
    id: str
    type: str = "wall"
    sub_type: Optional[str] = "exterior"
    start: Coordinate
    end: Coordinate
    thickness: Optional[float] = 6.0
    confidence: Optional[float] = 0.9
    editable: bool = True

class DoorSchema(BaseModel):
    id: str
    type: str = "door"
    label: Optional[str] = "D"
    position: Coordinate
    width: Optional[float] = 50.0
    rotation: Optional[float] = 0.0
    swing: Optional[str] = "inward"
    confidence: Optional[float] = 0.9
    editable: bool = True

class WindowSchema(BaseModel):
    id: str
    type: str = "window"
    label: Optional[str] = "W"
    start: Coordinate
    end: Coordinate
    width: Optional[float] = 8.0
    confidence: Optional[float] = 0.9
    editable: bool = True

class RoomSchema(BaseModel):
    id: str
    type: str = "room"
    name: str
    polygon: List[Coordinate]
    area: Optional[float] = None
    confidence: Optional[float] = 0.9
    editable: bool = True

class DimensionSchema(BaseModel):
    id: str
    type: str = "dimension"
    start: Optional[Coordinate] = None
    end: Optional[Coordinate] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    confidence: Optional[float] = 0.9
    editable: bool = True

class TextElementSchema(BaseModel):
    id: str
    text: str
    type: str = "text"
    confidence: Optional[float] = 0.9
    bbox: BoundingBox
    editable: bool = True

class BlueprintAnalysisResponse(BaseModel):
    document: DocumentMetadata = Field(default_factory=DocumentMetadata)
    text_elements: List[TextElementSchema] = Field(default_factory=list)
    walls: List[WallSchema] = Field(default_factory=list)
    doors: List[DoorSchema] = Field(default_factory=list)
    windows: List[WindowSchema] = Field(default_factory=list)
    rooms: List[RoomSchema] = Field(default_factory=list)
    dimensions: List[DimensionSchema] = Field(default_factory=list)
    stairs: List[Dict[str, Any]] = Field(default_factory=list)
    columns: List[Dict[str, Any]] = Field(default_factory=list)
    symbols: List[Dict[str, Any]] = Field(default_factory=list)
    annotations: List[Dict[str, Any]] = Field(default_factory=list)
    scale: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    confidence_summary: Dict[str, float] = Field(default_factory=dict)
