import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Sparkles, Scale, Ruler, MoveHorizontal, ArrowRight, X } from 'lucide-react';
import {
  parseDimensionValue,
  findAssociatedWall,
  applyParametricDimensionScale,
  distance,
} from '../../utils/parametricMath';

interface PropertiesPanelProps {
  selectedElement: any;
  elements?: any[];
  onUpdate: (updatedEl: any) => void;
  onUpdateElements?: (updatedElements: any[]) => void;
  onDelete: (id: string | number) => void;
  onClose?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  elements = [],
  onUpdate,
  onUpdateElements,
  onDelete,
  onClose,
}) => {
  const [newFactorKey, setNewFactorKey] = useState('');
  const [newFactorVal, setNewFactorVal] = useState('');
  // Staged value: avoids running parametric math on every keystroke
  const [stagingDimValue, setStagingDimValue] = useState<string>('');
  // Custom scale % for the "Apply Scale" button
  const [customScalePct, setCustomScalePct] = useState<string>('25');
  // Direct wall pixel-length edit
  const [wallLengthInput, setWallLengthInput] = useState<string>('');

  // Sync local state when the selected element changes
  useEffect(() => {
    if (selectedElement?.type === 'dimension') {
      setStagingDimValue(selectedElement.value || '');
    }
    if (selectedElement?.type === 'wall') {
      if (selectedElement.start && selectedElement.end) {
        const len = distance(selectedElement.start, selectedElement.end);
        setWallLengthInput(String(Math.round(len)));
      }
    }
  }, [selectedElement?.id, selectedElement?.type]);

  if (!selectedElement) {
    return (
      <div className="w-full h-full bg-white p-4 overflow-y-auto flex flex-col shadow-sm">
        <div className="border-b pb-3 flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Properties</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Properties Panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 italic">Select an element on the canvas to view &amp; edit properties.</p>
      </div>
    );
  }

  const el = selectedElement;

  // ─── Derive pixel-per-mm from dimension elements ─────────────────────────────
  const derivePixelPerMm = (): number | null => {
    const dims = elements.filter(
      (e) => e.type === 'dimension' && e.start && e.end && e.value
    );
    for (const dim of dims) {
      const valNum = parseDimensionValue(dim.value);
      if (!valNum) continue;
      const pixLen = distance(dim.start, dim.end);
      if (pixLen > 0) return pixLen / valNum;
    }
    return null;
  };

  // ─── Commit dimension value change (runs parametric math) ────────────────────
  const commitDimensionValueChange = () => {
    const oldValNum = parseDimensionValue(el.value);
    const newValNum = parseDimensionValue(stagingDimValue);
    if (
      oldValNum && newValNum && oldValNum !== newValNum &&
      onUpdateElements && elements.length > 0
    ) {
      const updatedList = applyParametricDimensionScale(el, oldValNum, newValNum, elements);
      onUpdateElements(updatedList);
    } else {
      onUpdate({ ...el, value: stagingDimValue });
    }
  };

  // ─── Apply % scale to associated wall ────────────────────────────────────────
  const handleApplyMathToWall = () => {
    const currentValNum = parseDimensionValue(el.value);
    if (!currentValNum) return;
    const pct = parseFloat(customScalePct);
    if (isNaN(pct) || pct === 0) return;
    const factor = 1 + pct / 100;
    const scaledValNum = Math.round(currentValNum * factor * 10) / 10;
    if (onUpdateElements && elements.length > 0) {
      const updatedList = applyParametricDimensionScale(el, currentValNum, scaledValNum, elements);
      onUpdateElements(updatedList);
    }
  };

  // ─── Commit direct wall pixel-length change ───────────────────────────────────
  const commitWallLengthChange = () => {
    const newPixLen = parseFloat(wallLengthInput);
    if (isNaN(newPixLen) || newPixLen <= 0 || !el.start || !el.end) return;
    const oldPixLen = distance(el.start, el.end);
    if (oldPixLen <= 0) return;
    const ratio = newPixLen / oldPixLen;
    const dx = el.end.x - el.start.x;
    const dy = el.end.y - el.start.y;
    const newEnd = {
      x: Math.round(el.start.x + dx * ratio),
      y: Math.round(el.start.y + dy * ratio),
    };
    const updatedWall = { ...el, end: newEnd };
    if (onUpdateElements) {
      onUpdateElements(elements.map((e) => (e.id === el.id ? updatedWall : e)));
    } else {
      onUpdate(updatedWall);
    }
  };

  const handleAddFactor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactorKey.trim()) return;
    onUpdate({
      ...el,
      [newFactorKey.trim().toLowerCase()]: newFactorVal.trim(),
    });
    setNewFactorKey('');
    setNewFactorVal('');
  };

  const knownKeys = new Set([
    'id', 'type', 'confidence', 'source', 'is_verified', 'sub_type', 'start', 'end',
    'position', 'width', 'rotation', 'swing', 'polygon', 'area', 'name', 'label', 'value', 'unit', 'thickness', 'bbox', 'text'
  ]);
  const customFactors = Object.entries(el).filter(([key]) => !knownKeys.has(key));
  const associatedWall = el.type === 'dimension' ? findAssociatedWall(el, elements) : null;

  // Wall live measurements
  const pxPerMm = derivePixelPerMm();
  const wallPixLen = (el.type === 'wall' && el.start && el.end)
    ? Math.round(distance(el.start, el.end))
    : null;
  const wallRealLen = wallPixLen !== null && pxPerMm !== null
    ? Math.round(wallPixLen / pxPerMm)
    : null;

  return (
    <div className="w-full h-full bg-white p-4 overflow-y-auto flex flex-col shadow-sm space-y-5">
      <div className="border-b pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{el.type} Properties</h3>
          <span className="text-xs text-gray-400">ID: {el.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold uppercase">{el.type}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Properties Panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Confidence */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>AI Confidence</span>
            <span className="font-semibold">{Math.round((el.confidence || 1) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${(el.confidence || 1) * 100}%` }}></div>
          </div>
        </div>

        {/* ────────────────── DIMENSION ────────────────── */}
        {el.type === 'dimension' && (
          <>
            {associatedWall ? (
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Sparkles size={14} className="text-indigo-600" /> Associated Wall Detected
                </div>
                <p className="text-indigo-700">
                  Editing this dimension will proportionally stretch <strong>Wall #{associatedWall.id}</strong>.
                </p>
              </div>
            ) : (
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-center gap-1.5">
                <Scale size={13} /> No parallel wall detected nearby.
              </div>
            )}

            {/* Staged dimension value: commits on blur / Enter */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Dimension Value — applies parametric wall scaling
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stagingDimValue}
                  placeholder="e.g. 3000 or 4500"
                  onChange={(e) => setStagingDimValue(e.target.value)}
                  onBlur={commitDimensionValueChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="flex-1 text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold"
                />
                <select
                  value={el.unit || 'mm'}
                  onChange={(e) => onUpdate({ ...el, unit: e.target.value })}
                  className="text-sm bg-white px-2 rounded-lg border border-gray-300 focus:border-blue-500"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                  <option value="in">in</option>
                  <option value="ft">ft</option>
                </select>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Press <kbd className="bg-gray-100 px-1 rounded text-gray-600 font-mono text-[10px]">Enter</kbd> or click away to apply math.
              </p>
            </div>

            {/* Custom % scale */}
            {associatedWall && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Scale Wall by Percentage</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={customScalePct}
                    onChange={(e) => setCustomScalePct(e.target.value)}
                    className="w-24 text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500 font-bold"
                  />
                  <span className="text-xs text-gray-500">%</span>
                  <button
                    type="button"
                    onClick={handleApplyMathToWall}
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Scale size={13} /> Apply Scale
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Positive = grow, negative = shrink.</p>
              </div>
            )}
          </>
        )}

        {/* ────────────────── WALL ────────────────── */}
        {el.type === 'wall' && (
          <>
            {/* Live measurement display */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Ruler size={13} /> Wall Measurements
              </div>
              <div className="flex justify-between text-blue-800">
                <span>Pixel Length:</span>
                <span className="font-bold">{wallPixLen ?? '—'} px</span>
              </div>
              {wallRealLen !== null ? (
                <div className="flex justify-between text-blue-800">
                  <span>Real-world:</span>
                  <span className="font-bold">{wallRealLen} mm</span>
                </div>
              ) : (
                <p className="text-blue-600 italic text-[11px]">Add a dimension element to calibrate real-world units.</p>
              )}
            </div>

            {/* Direct pixel-length input */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <MoveHorizontal size={12} /> Set Wall Length (pixels)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={wallLengthInput}
                  onChange={(e) => setWallLengthInput(e.target.value)}
                  onBlur={commitWallLengthChange}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="flex-1 text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500 font-bold"
                />
                <button
                  type="button"
                  onClick={commitWallLengthChange}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Start point stays fixed; end point moves.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Wall Thickness (px / mm)</label>
              <input
                type="number"
                value={el.thickness || 6}
                onChange={(e) => onUpdate({ ...el, thickness: Number(e.target.value) })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Wall Type</label>
              <select
                value={el.sub_type || 'exterior'}
                onChange={(e) => onUpdate({ ...el, sub_type: e.target.value })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              >
                <option value="exterior">Exterior Structural Wall</option>
                <option value="interior">Interior Partition Wall</option>
                <option value="shear">Shear Wall</option>
              </select>
            </div>
          </>
        )}

        {/* DOOR EDITING */}
        {el.type === 'door' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Door Mark / Label</label>
              <input
                type="text"
                value={el.label || 'D'}
                onChange={(e) => onUpdate({ ...el, label: e.target.value })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Door Width</label>
              <input
                type="number"
                value={el.width || 60}
                onChange={(e) => onUpdate({ ...el, width: Number(e.target.value) })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Swing Direction</label>
              <select
                value={el.swing || 'inward'}
                onChange={(e) => onUpdate({ ...el, swing: e.target.value })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              >
                <option value="inward">Inward</option>
                <option value="outward">Outward</option>
                <option value="sliding">Sliding</option>
                <option value="double">Double Swing</option>
              </select>
            </div>
          </>
        )}

        {/* WINDOW EDITING */}
        {el.type === 'window' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Window Mark / Label</label>
              <input
                type="text"
                value={el.label || 'W'}
                onChange={(e) => onUpdate({ ...el, label: e.target.value })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Window Frame Width</label>
              <input
                type="number"
                value={el.width || 8}
                onChange={(e) => onUpdate({ ...el, width: Number(e.target.value) })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* ROOM EDITING */}
        {el.type === 'room' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Room Name</label>
              <input
                type="text"
                value={el.name || el.label || ''}
                onChange={(e) => onUpdate({ ...el, name: e.target.value })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Calculated Area (m² / sq ft)</label>
              <input
                type="number"
                step="0.1"
                value={el.area || ''}
                onChange={(e) => onUpdate({ ...el, area: Number(e.target.value) })}
                className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* TEXT EDITING */}
        {el.type === 'text' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Text String</label>
            <input
              type="text"
              value={el.text || ''}
              onChange={(e) => onUpdate({ ...el, text: e.target.value })}
              className="w-full text-sm bg-white p-2 rounded-lg border border-gray-300 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* CUSTOM FACTORS & ATTRIBUTES SECTION */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Custom Factors &amp; Attributes</h4>
        {customFactors.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-lg border mb-2">
            <span className="font-medium text-gray-600 capitalize">{k}:</span>
            <span className="font-semibold text-gray-800">{String(v)}</span>
            <button
              onClick={() => {
                const next = { ...el };
                delete next[k];
                onUpdate(next);
              }}
              className="text-red-500 hover:text-red-700 ml-2"
              title="Remove factor"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <form onSubmit={handleAddFactor} className="space-y-2 mt-3">
          <input
            type="text"
            placeholder="Factor Name (e.g. Material, Height)"
            value={newFactorKey}
            onChange={(e) => setNewFactorKey(e.target.value)}
            className="w-full text-xs bg-white p-1.5 rounded border border-gray-300"
          />
          <input
            type="text"
            placeholder="Value (e.g. Concrete, 3.2m)"
            value={newFactorVal}
            onChange={(e) => setNewFactorVal(e.target.value)}
            className="w-full text-xs bg-white p-1.5 rounded border border-gray-300"
          />
          <button
            type="submit"
            className="w-full py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
          >
            <Plus size={14} /> Add Factor
          </button>
        </form>
      </div>

      {/* DELETE BUTTON */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => onDelete(el.id)}
          className="w-full py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={16} /> Delete Element
        </button>
      </div>
    </div>
  );
};

