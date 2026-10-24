import React, { useRef, useState } from 'react';
import {
  distance,
  parseDimensionValue,
  applyParametricDimensionScale,
} from '../../utils/parametricMath';

interface CanvasProps {
  elements: any[];
  scale: number;
  selectedId: string | number | null;
  onSelect: (id: string | number | null) => void;
  currentTool: string;
  imageUrl?: string;
  onAddElement?: (newEl: any) => void;
  onUpdateElements?: (updated: any[]) => void;
  viewMode?: 'side-by-side' | 'single';
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  scale,
  selectedId,
  onSelect,
  currentTool,
  imageUrl,
  onAddElement,
  onUpdateElements,
  viewMode = 'side-by-side',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<{
    elementId: string | number;
    pointKey: 'start' | 'end';
  } | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingHandle) return;
    if (currentTool === 'select') {
      onSelect(null);
      return;
    }

    if (!onAddElement) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);

    const newId = `new_${Date.now()}`;
    let newEl: any = null;

    if (currentTool === 'wall') {
      newEl = { id: newId, type: 'wall', start: { x, y }, end: { x: x + 150, y }, thickness: 6, confidence: 1.0 };
    } else if (currentTool === 'door') {
      newEl = { id: newId, type: 'door', position: { x, y }, width: 60, rotation: 0, swing: 'inward', label: 'D', confidence: 1.0 };
    } else if (currentTool === 'window') {
      newEl = { id: newId, type: 'window', start: { x, y }, end: { x: x + 80, y }, width: 8, label: 'W', confidence: 1.0 };
    } else if (currentTool === 'room') {
      newEl = {
        id: newId,
        type: 'room',
        name: 'New Room',
        polygon: [
          { x, y },
          { x: x + 180, y },
          { x: x + 180, y: y + 140 },
          { x, y: y + 140 },
        ],
        area: 25.0,
        confidence: 1.0,
      };
    } else if (currentTool === 'dimension') {
      newEl = { id: newId, type: 'dimension', start: { x, y }, end: { x: x + 120, y }, value: '3000', unit: 'mm', confidence: 1.0 };
    } else if (currentTool === 'text') {
      newEl = { id: newId, type: 'text', text: 'Label', bbox: { x, y, width: 80, height: 24 }, confidence: 1.0 };
    }

    if (newEl) {
      onAddElement(newEl);
      onSelect(newEl.id);
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingHandle || !onUpdateElements) return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);

    const targetEl = elements.find((el) => el.id === draggingHandle.elementId);
    if (!targetEl || !targetEl.start || !targetEl.end) return;

    if (targetEl.type === 'dimension') {
      const oldLen = distance(targetEl.start, targetEl.end);
      const newPos = { x, y };
      const newLen =
        draggingHandle.pointKey === 'end'
          ? distance(targetEl.start, newPos)
          : distance(newPos, targetEl.end);

      if (oldLen > 0 && newLen > 0) {
        const ratio = newLen / oldLen;
        const oldValNum = parseDimensionValue(targetEl.value) || 1000;
        const newValNum = Math.round(oldValNum * ratio);

        const updated = applyParametricDimensionScale(targetEl, oldValNum, newValNum, elements);
        onUpdateElements(updated);
      }
    } else if (targetEl.type === 'wall') {
      const nextList = elements.map((item) => {
        if (item.id === targetEl.id) {
          return {
            ...item,
            [draggingHandle.pointKey]: { x, y },
          };
        }
        return item;
      });
      onUpdateElements(nextList);
    }
  };

  const renderSvgElements = () => (
    <>
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f1f5f9" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {elements.map((el) => {
        const d = el;
        const selected = String(selectedId) === String(el.id);
        const common = {
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(el.id);
          },
          cursor: 'pointer',
        };

        // WALL
        if (d.type === 'wall') {
          return (
            <g key={el.id} {...common}>
              <line
                x1={d.start?.x}
                y1={d.start?.y}
                x2={d.end?.x}
                y2={d.end?.y}
                stroke={selected ? '#2563eb' : '#0f172a'}
                strokeWidth={d.thickness || 6}
                strokeLinecap="round"
              />
              {selected && (
                <>
                  <circle
                    cx={d.start?.x}
                    cy={d.start?.y}
                    r="7"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="2"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ elementId: el.id, pointKey: 'start' });
                    }}
                  />
                  <circle
                    cx={d.end?.x}
                    cy={d.end?.y}
                    r="7"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="2"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingHandle({ elementId: el.id, pointKey: 'end' });
                    }}
                  />
                </>
              )}
            </g>
          );
        }

        // WINDOW - with 'W' badge
        if (d.type === 'window') {
          const x1 = d.start?.x ?? 0;
          const y1 = d.start?.y ?? 0;
          const x2 = d.end?.x ?? x1 + 60;
          const y2 = d.end?.y ?? y1;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const label = d.label || 'W';
          return (
            <g key={el.id} {...common}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0ea5e9" strokeWidth={(d.width || 6) + 4} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={d.width || 4} />
              <circle cx={mx} cy={my} r="12" fill="#0ea5e9" stroke="#ffffff" strokeWidth="2" />
              <text
                x={mx}
                y={my + 4}
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
              >
                {label}
              </text>
            </g>
          );
        }

        // DOOR - with 'D' badge
        if (d.type === 'door') {
          const cx = d.position?.x ?? 0;
          const cy = d.position?.y ?? 0;
          const w = d.width || 50;
          const label = d.label || 'D';
          return (
            <g key={el.id} {...common}>
              <circle cx={cx} cy={cy} r={w / 2} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,3" />
              <line x1={cx} y1={cy} x2={cx + w} y2={cy} stroke="#2563eb" strokeWidth="4" />
              <circle cx={cx} cy={cy} r="12" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
              <text
                x={cx}
                y={cy + 4}
                fill="#ffffff"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
              >
                {label}
              </text>
            </g>
          );
        }

        // ROOM - polygon boundary
        if (d.type === 'room') {
          const pts = (d.polygon || []).map((p: any) => `${p.x},${p.y}`).join(' ');
          let cx = 0, cy = 0;
          if (d.polygon && d.polygon.length) {
            cx = d.polygon.reduce((acc: number, p: any) => acc + p.x, 0) / d.polygon.length;
            cy = d.polygon.reduce((acc: number, p: any) => acc + p.y, 0) / d.polygon.length;
          }
          const roomName = d.name || d.label || 'ROOM';
          const hasTextElements = elements.some((item) => item.type === 'text');
          return (
            <g key={el.id} {...common}>
              <polygon
                points={pts}
                fill={selected ? 'rgba(37,99,235,0.15)' : 'rgba(59,130,246,0.06)'}
                stroke={selected ? '#2563eb' : '#64748b'}
                strokeWidth="2"
                strokeDasharray="4,4"
              />
              {!hasTextElements && cx > 0 && (
                <text
                  x={cx}
                  y={cy}
                  fill="#1e293b"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none"
                >
                  {roomName}
                </text>
              )}
            </g>
          );
        }

        // DIMENSION WITH PARAMETRIC DRAG HANDLES
        if (d.type === 'dimension') {
          const x1 = d.start?.x ?? 0;
          const y1 = d.start?.y ?? 0;
          const x2 = d.end?.x ?? x1 + 100;
          const y2 = d.end?.y ?? y1;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dimText = `${d.value || ''} ${d.unit || ''}`.trim() || 'Dimension';
          return (
            <g key={el.id} {...common}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9333ea" strokeWidth="2.5" />
              <circle
                cx={x1}
                cy={y1}
                r={selected ? 7 : 4}
                fill="#9333ea"
                stroke="#ffffff"
                strokeWidth="2"
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect(el.id);
                  setDraggingHandle({ elementId: el.id, pointKey: 'start' });
                }}
              />
              <circle
                cx={x2}
                cy={y2}
                r={selected ? 7 : 4}
                fill="#9333ea"
                stroke="#ffffff"
                strokeWidth="2"
                className="cursor-move"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect(el.id);
                  setDraggingHandle({ elementId: el.id, pointKey: 'end' });
                }}
              />
              <rect
                x={mx - 38}
                y={my - 12}
                width="76"
                height="22"
                rx="5"
                fill="#ffffff"
                stroke="#9333ea"
                strokeWidth="1.5"
              />
              <text x={mx} y={my + 3} fill="#7e22ce" fontSize="11" fontWeight="bold" textAnchor="middle">
                {dimText}
              </text>
            </g>
          );
        }

        // TEXT
        if (d.type === 'text') {
          const tx = d.bbox?.x ?? d.x ?? 0;
          const ty = (d.bbox?.y ?? d.y ?? 0) + 16;
          return (
            <text key={el.id} {...common} x={tx} y={ty} fill={selected ? '#2563eb' : '#334155'} fontSize="14" fontWeight="600">
              {d.text}
            </text>
          );
        }

        return null;
      })}
    </>
  );

  // SIDE-BY-SIDE MODE
  if (viewMode === 'side-by-side') {
    return (
      <div ref={containerRef} className="flex-1 bg-gray-200 p-2 sm:p-4 overflow-auto max-w-full">
        <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 justify-center items-center xl:items-start max-w-full min-w-min">
          {/* LEFT PANE: ORIGINAL BLUEPRINT DRAWING */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-300 overflow-hidden flex flex-col">
            <div className="bg-gray-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span>🖼️ Original Uploaded Blueprint</span>
              <span className="text-gray-400">Reference Image</span>
            </div>
            <div
              className="relative overflow-hidden bg-gray-50 flex items-center justify-center p-2"
              style={{ width: '800px', height: '800px' }}
            >
              {imageUrl ? (
                <div style={{ width: '1000px', height: '1000px', transform: `scale(${scale * 0.8})`, transformOrigin: 'top left' }}>
                  <img
                    src={imageUrl}
                    alt="Original Blueprint"
                    className="w-[1000px] h-[1000px] object-fill pointer-events-none border border-gray-200"
                  />
                </div>
              ) : (
                <span className="text-gray-400 text-sm italic">Loading original blueprint...</span>
              )}
            </div>
          </div>

          {/* RIGHT PANE: AI EXTRACTED VECTOR CAD CANVAS (EDITABLE) */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-300 overflow-hidden flex flex-col">
            <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span>📐 AI Extracted Vector Blueprint</span>
              <span className="text-blue-300 font-semibold">Parametric Mathematics Enabled</span>
            </div>
            <div
              className="relative overflow-hidden bg-white cursor-crosshair"
              style={{ width: '800px', height: '800px' }}
              onClick={handleCanvasClick}
            >
              <div style={{ width: '1000px', height: '1000px', transform: `scale(${scale * 0.8})`, transformOrigin: 'top left' }}>
                <svg
                  width="1000"
                  height="1000"
                  onMouseMove={handleSvgMouseMove}
                  onMouseUp={() => setDraggingHandle(null)}
                >
                  {renderSvgElements()}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // OVERLAY CANVAS MODE
  return (
    <div ref={containerRef} className="flex-1 bg-gray-100 overflow-auto relative">
      <div
        className="relative origin-top-left shadow-md bg-white cursor-crosshair"
        style={{ width: '1000px', height: '1000px', transform: `scale(${scale})`, margin: '2rem auto' }}
        onClick={handleCanvasClick}
      >
        <svg
          width="100%"
          height="100%"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={() => setDraggingHandle(null)}
        >
          {imageUrl && (
            <image href={imageUrl} x="0" y="0" width="1000" height="1000" opacity="0.45" preserveAspectRatio="none" />
          )}
          {renderSvgElements()}
        </svg>
      </div>
    </div>
  );
};
