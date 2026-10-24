import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { Canvas } from './Canvas';
import { api } from '../../services/api';

export const BlueprintEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const blueprintId = Number(id);
  const [elements, setElements] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [currentTool, setCurrentTool] = useState('select');
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'single'>('side-by-side');
  const [showProperties, setShowProperties] = useState(true);

  useEffect(() => {
    if (!Number.isInteger(blueprintId)) return;
    let objectUrl: string | undefined;
    const load = async () => {
      try {
        const [elementsRes, imageRes] = await Promise.all([
          api.get(`/blueprints/${blueprintId}/elements`),
          api.get(`/blueprints/${blueprintId}/image`, { responseType: 'blob' }).catch(() => null),
        ]);
        setElements(elementsRes.data);
        if (imageRes && imageRes.data) {
          objectUrl = URL.createObjectURL(imageRes.data);
          setImageUrl(objectUrl);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Could not load blueprint elements.');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blueprintId]);

  // Automatically adjust properties panel visibility on small mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setShowProperties(false);
      }
    };
    handleResize();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.put(`/blueprints/${blueprintId}/elements`, elements);
      setMessage('Saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save blueprint.');
    } finally {
      setSaving(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    setMessage('');
    setError('');
    try {
      await api.post(`/blueprints/${blueprintId}/reprocess`);
      const elementsRes = await api.get(`/blueprints/${blueprintId}/elements`);
      setElements(elementsRes.data);
      setMessage('AI re-extraction completed successfully.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI re-extraction failed.');
    } finally {
      setReprocessing(false);
    }
  };

  const handleDeleteBlueprint = async () => {
    if (!window.confirm('Are you sure you want to delete this blueprint drawing? This cannot be undone.')) return;
    try {
      await api.delete(`/blueprints/${blueprintId}`);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not delete blueprint.');
    }
  };

  const handleAddElement = (newEl: any) => {
    setElements((prev) => [...prev, newEl]);
  };

  const selectedElement = elements.find((e) => String(e.id) === String(selectedId));
  const handleUpdateElement = (updatedEl: any) =>
    setElements((prev) => prev.map((e) => (e.id === updatedEl.id ? updatedEl : e)));
  const handleDeleteElement = (elementId: string | number) => {
    setElements((prev) => prev.filter((e) => e.id !== elementId));
    setSelectedId(null);
  };

  if (loading)
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600" size={26} />
        <span className="ml-2.5 font-bold text-gray-700">Loading side-by-side comparison editor...</span>
      </div>
    );

  if (error && !elements.length)
    return (
      <div className="p-8 text-red-700 bg-red-50 m-6 rounded-2xl border border-red-200 flex items-center gap-2 font-semibold">
        <AlertCircle size={20} />
        {error}
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-gray-100 relative overflow-hidden">
      <Toolbar
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
        scale={scale}
        setScale={setScale}
        onSave={save}
        saving={saving}
        onReprocess={handleReprocess}
        reprocessing={reprocessing}
        onDeleteBlueprint={handleDeleteBlueprint}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showProperties={showProperties}
        onToggleProperties={() => setShowProperties((prev) => !prev)}
      />
      {message && (
        <div className="absolute top-14 left-4 z-30 bg-emerald-600 text-white shadow-xl px-4 py-2 rounded-xl text-xs font-bold animate-bounce">
          {message}
        </div>
      )}
      {error && (
        <div className="absolute top-14 right-4 sm:right-84 z-30 bg-red-600 text-white shadow-xl px-4 py-2 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <Canvas
          imageUrl={imageUrl}
          elements={elements}
          scale={scale}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            // On mobile, auto-open properties when an element is selected if user tapped an element
            if (id !== null && window.innerWidth < 768) {
              setShowProperties(true);
            }
          }}
          currentTool={currentTool}
          onAddElement={handleAddElement}
          onUpdateElements={setElements}
          viewMode={viewMode}
        />

        {showProperties && (
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 bg-white shadow-2xl border-l border-gray-200 md:static md:z-auto md:w-80 shrink-0 h-full overflow-hidden">
            <PropertiesPanel
              selectedElement={selectedElement}
              elements={elements}
              onUpdate={handleUpdateElement}
              onUpdateElements={setElements}
              onDelete={handleDeleteElement}
              onClose={() => setShowProperties(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
