export interface Point {
  x: number;
  y: number;
}

export interface ElementData {
  id: string | number;
  type: string;
  start?: Point;
  end?: Point;
  position?: Point;
  polygon?: Point[];
  value?: string;
  unit?: string;
  thickness?: number;
  [key: string]: any;
}

/**
 * Parse numeric dimension value from strings like "3000", "15m", "3500mm", "10.5", "12' 4""
 */
export function parseDimensionValue(val: string | undefined): number | null {
  if (!val) return null;
  const cleaned = val.replace(/,/g, '.');
  const match = cleaned.match(/[-+]?\d*\.?\d+/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) || num <= 0 ? null : num;
  }
  return null;
}

/**
 * Distance between two 2D points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Perpendicular distance from point P to line segment (A, B)
 */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return distance(p, projection);
}

/**
 * Find the associated wall element closest and parallel to a dimension element
 */
export function findAssociatedWall(
  dimension: ElementData,
  elements: ElementData[]
): ElementData | null {
  if (!dimension.start || !dimension.end) return null;

  const dStart = dimension.start;
  const dEnd = dimension.end;
  const dDx = dEnd.x - dStart.x;
  const dDy = dEnd.y - dStart.y;
  const dLen = Math.sqrt(dDx * dDx + dDy * dDy);
  if (dLen === 0) return null;

  const dDxNorm = dDx / dLen;
  const dDyNorm = dDy / dLen;

  let bestWall: ElementData | null = null;
  let minDistance = Infinity;

  const walls = elements.filter((el) => el.type === 'wall' && el.start && el.end);

  for (const wall of walls) {
    const wStart = wall.start!;
    const wEnd = wall.end!;
    const wDx = wEnd.x - wStart.x;
    const wDy = wEnd.y - wStart.y;
    const wLen = Math.sqrt(wDx * wDx + wDy * wDy);
    if (wLen === 0) continue;

    const wDxNorm = wDx / wLen;
    const wDyNorm = wDy / wLen;

    // Check dot product to verify parallelism (parallel or anti-parallel)
    const dot = Math.abs(dDxNorm * wDxNorm + dDyNorm * wDyNorm);
    if (dot < 0.7) continue; // Not substantially parallel

    // Compute distance between dimension midpoint and wall segment
    const midPoint = { x: (dStart.x + dEnd.x) / 2, y: (dStart.y + dEnd.y) / 2 };
    const dist = distToSegment(midPoint, wStart, wEnd);

    if (dist < minDistance && dist < 300) { // Within 300px proximity
      minDistance = dist;
      bestWall = wall;
    }
  }

  return bestWall;
}

/**
 * Apply Parametric Math: Scale associated wall and connected elements when a dimension changes
 */
export function applyParametricDimensionScale(
  dimension: ElementData,
  oldValueNum: number,
  newValueNum: number,
  allElements: ElementData[]
): ElementData[] {
  if (oldValueNum <= 0 || newValueNum <= 0 || oldValueNum === newValueNum) {
    return allElements;
  }

  const ratio = newValueNum / oldValueNum;
  const targetWall = findAssociatedWall(dimension, allElements);

  return allElements.map((el) => {
    // 1. Update the dimension element itself
    if (el.id === dimension.id) {
      if (!el.start || !el.end) return el;
      const dx = el.end.x - el.start.x;
      const dy = el.end.y - el.start.y;
      return {
        ...el,
        value: String(newValueNum),
        end: {
          x: Math.round(el.start.x + dx * ratio),
          y: Math.round(el.start.y + dy * ratio),
        },
      };
    }

    // 2. Update the associated target wall
    if (targetWall && el.id === targetWall.id) {
      if (!el.start || !el.end) return el;
      const dx = el.end.x - el.start.x;
      const dy = el.end.y - el.start.y;
      const newEnd = {
        x: Math.round(el.start.x + dx * ratio),
        y: Math.round(el.start.y + dy * ratio),
      };

      return {
        ...el,
        end: newEnd,
      };
    }

    // 3. Update room polygon vertices connected to the modified wall endpoint
    if (targetWall && el.type === 'room' && el.polygon) {
      const oldWEnd = targetWall.end!;
      const dx = oldWEnd.x - targetWall.start!.x;
      const dy = oldWEnd.y - targetWall.start!.y;
      const newWEnd = {
        x: Math.round(targetWall.start!.x + dx * ratio),
        y: Math.round(targetWall.start!.y + dy * ratio),
      };

      const updatedPoly = el.polygon.map((pt) => {
        // If vertex was near the old wall endpoint, shift it to match new wall endpoint
        if (distance(pt, oldWEnd) < 40) {
          return { ...newWEnd };
        }
        return pt;
      });

      return {
        ...el,
        polygon: updatedPoly,
      };
    }

    return el;
  });
}
