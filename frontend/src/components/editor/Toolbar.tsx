import React from 'react';
import { Save, RefreshCw, ZoomIn, ZoomOut, Maximize, Columns, Layout, Trash2, SlidersHorizontal } from 'lucide-react';

interface ToolbarProps {
  currentTool: string;
  setCurrentTool: (tool: string) => void;
  scale: number;
  setScale: (s: number) => void;
  onSave: () => void;
  saving: boolean;
  onReprocess?: () => void;
  reprocessing?: boolean;
  onDeleteBlueprint?: () => void;
  viewMode: 'side-by-side' | 'single';
  setViewMode: (mode: 'side-by-side' | 'single') => void;
  showProperties?: boolean;
  onToggleProperties?: () => void;
}

const tools = ['select', 'wall', 'door', 'window', 'room', 'dimension', 'text'];

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  setCurrentTool,
  scale,
  setScale,
  onSave,
  saving,
  onReprocess,
  reprocessing,
  onDeleteBlueprint,
  viewMode,
  setViewMode,
  showProperties = true,
  onToggleProperties,
}) => {
  return (
    <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 shadow-sm z-10 shrink-0">
      {/* TOOL BUTTONS (Horizontal scrollable on mobile) */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 lg:pb-0 max-w-full scrollbar-none">
        {tools.map((tool) => (
          <button
            key={tool}
            onClick={() => setCurrentTool(tool)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all shrink-0 ${
              currentTool === tool
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tool === 'select' ? 'Select' : `+ ${tool}`}
          </button>
        ))}
      </div>

      {/* VIEW MODE & PROPERTIES TOGGLE */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* VIEW MODE TOGGLE */}
        <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'side-by-side'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Side-by-side comparison"
          >
            <Columns size={14} /> <span className="hidden sm:inline">Side-by-Side</span>
          </button>
          <button
            onClick={() => setViewMode('single')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'single'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            title="Single overlay CAD canvas view"
          >
            <Layout size={14} /> <span className="hidden sm:inline">Overlay Canvas</span>
          </button>
        </div>

        {/* PROPERTIES PANEL TOGGLE BUTTON */}
        {onToggleProperties && (
          <button
            onClick={onToggleProperties}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              showProperties
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
            title={showProperties ? 'Hide Properties Panel' : 'Show Properties Panel'}
          >
            <SlidersHorizontal size={14} />
            <span>Properties</span>
          </button>
        )}
      </div>

      {/* ZOOM & ACTIONS */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex items-center space-x-1 bg-gray-50 border rounded-lg px-2 py-1 text-xs">
          <button onClick={() => setScale(Math.max(0.25, scale * 0.9))} title="Zoom Out" className="hover:text-blue-600">
            <ZoomOut size={15} />
          </button>
          <span className="w-10 sm:w-12 text-center font-bold text-gray-700">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(Math.min(3, scale * 1.1))} title="Zoom In" className="hover:text-blue-600">
            <ZoomIn size={15} />
          </button>
          <button onClick={() => setScale(1)} title="Reset Scale" className="ml-1 text-gray-400 hover:text-gray-700">
            <Maximize size={14} />
          </button>
        </div>

        {onReprocess && (
          <button
            onClick={onReprocess}
            disabled={reprocessing}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            title="Re-run AI extraction"
          >
            <RefreshCw size={14} className={reprocessing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{reprocessing ? 'Extracting...' : 'Re-extract AI'}</span>
          </button>
        )}

        {onDeleteBlueprint && (
          <button
            onClick={onDeleteBlueprint}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors"
            title="Delete Blueprint"
          >
            <Trash2 size={14} /> <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
        >
          <Save size={15} />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
};
