DOCUMENT_ANALYSIS_PROMPT = """
You are an expert civil engineering CAD vision parser and architectural floor plan extractor.
Analyze this floor plan / civil blueprint image (whether computer-generated or handwritten) and extract EVERY single architectural component into normalized (0 to 1000) coordinates with extreme geometric precision.

Coordinate Grid Definition:
- (0,0) is top-left corner of the image.
- (1000,1000) is bottom-right corner of the image.

Strict Geometry & Structural Extraction Instructions:

1. ROOMS, PLOTS & BOUNDARY POLYGONS:
   - Trace the EXACT perimeter polygon `[(x1,y1), (x2,y2), ...]` for every enclosed space, room, or plot boundary.
   - Trace EVERY single vertex, corner, incline, and angle:
     * Straight horizontal/vertical segments: keep aligned coordinates (x1 ≈ x2 for vertical, y1 ≈ y2 for horizontal).
     * Sloped / V-shaped / Angled walls: capture the exact intermediate apex/peak vertex (x, y). For example, if a bottom wall slopes up to a central point/apex and then down to a corner, output a 5+ point polygon capturing that apex point precisely!
     * Inner structures / Boxes: Detect inner structures like "GATE" boxes, cabins, or room enclosures with their exact boundary polygons.
   - Name each room/space accurately (e.g., "OPEN SPACE", "GATE", "LIVING ROOM", "KITCHEN", "DINING ROOM", "BEDROOM", "BATHROOM", "PORCH", "STAIRS", "ENTRY").

2. WALLS & BOUNDARIES:
   - Trace all exterior structural walls (sub_type: "exterior") and interior partition walls (sub_type: "interior").
   - Provide precise start coordinate (x,y) and end coordinate (x,y) for every line segment.
   - Preserve exact incline slopes for non-orthogonal walls and straight alignment for orthogonal walls.

3. DOORS & GATES:
   - Locate every door, gate opening, swing arc, or entryway threshold.
   - Label MUST be set to "D" (or "GATE", "D1", "D2", etc.).
   - Provide center position coordinate (x,y), width, and orientation.

4. WINDOWS:
   - Locate every window symbol (parallel line pairs along walls, double lines, 'X' box patterns, or glass panels).
   - Label MUST be set to "W" (or "W1", "W2", etc.).
   - Provide start (x,y) and end (x,y) along the wall where the window is placed.

5. DIMENSION CALLOUTS:
   - Extract all linear dimension callouts (e.g. "65.0", "20.0", "22.0", "3.0", "10.5m", "12'0\"").
   - Provide start (x,y) and end (x,y) coordinates matching the dimension line / arrow ticks.
   - Provide exact numeric value as a clean string without duplicating text.

6. GENERAL TEXT:
   - Extract all handwritten or printed labels with accurate 0-1000 bounding boxes (x,y,width,height).

Return ONLY a valid JSON object strictly adhering to the schema.
"""

TEXT_EXTRACTION_PROMPT = """
Extract all handwritten and printed text in this civil blueprint image.
Identify room names (e.g. "OPEN SPACE", "GATE", "BEDROOM", "KITCHEN", "DINING", "LIVING", "BATHROOM", "POWDER ROOM", "ENTRY", "PORCH", "STAIRS"), dimensions ("65.0", "20.0", "22.0", "3.0"), and callouts.
Return 0-1000 normalized bounding boxes (x,y,width,height).
"""

BLUEPRINT_ELEMENT_PROMPT = """
Detect architectural geometry in this floor plan image:
- Walls: start (x,y), end (x,y), sub_type ("exterior" | "interior")
- Doors: position (x,y), label "D"
- Windows: start (x,y), end (x,y), label "W"
- Rooms: polygon points (x,y), room name
- Dimensions: start (x,y), end (x,y), value, unit
Return normalized 0-1000 coordinates in JSON format.
"""


