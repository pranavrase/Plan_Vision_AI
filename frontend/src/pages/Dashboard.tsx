import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileImage, FolderPlus, Loader2, RefreshCw, Layers, CheckCircle2, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { FileUploader } from '../components/upload/FileUploader';
import { api } from '../services/api';

interface Project {
  id: number;
  name: string;
  description?: string;
  status: string;
  created_at?: string;
}

interface Blueprint {
  id: number;
  project_id: number;
  original_filename: string;
  status: string;
  created_at: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [newProject, setNewProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const projectsRes = await api.get('/projects');
      const loadedProjects = projectsRes.data as Project[];
      setProjects(loadedProjects);

      let activeId = selectedProjectId;
      if (!activeId && loadedProjects.length > 0) {
        activeId = loadedProjects[0].id;
        setSelectedProjectId(activeId);
      }

      const all: Blueprint[] = [];
      for (const project of loadedProjects) {
        try {
          const res = await api.get(`/projects/${project.id}/blueprints`);
          all.push(...res.data);
        } catch {
          /* optional endpoint */
        }
      }
      setBlueprints(all);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/projects', { name: newProject.trim() });
      setProjects((prev) => [res.data, ...prev]);
      setSelectedProjectId(res.data.id);
      setNewProject('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete project "${projectName}" and all its blueprint files?`)) {
      return;
    }
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setBlueprints((prev) => prev.filter((b) => b.project_id !== projectId));
      if (selectedProjectId === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        setSelectedProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not delete project.');
    }
  };

  const handleDeleteBlueprint = async (e: React.MouseEvent, blueprintId: number, filename: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete blueprint "${filename}"?`)) {
      return;
    }
    try {
      await api.delete(`/blueprints/${blueprintId}`);
      setBlueprints((prev) => prev.filter((b) => b.id !== blueprintId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not delete blueprint.');
    }
  };

  const handleUploadSuccess = (blueprintId: number) => {
    setShowUploader(false);
    navigate(`/blueprints/${blueprintId}/editor`);
  };

  const handleSingleBlueprintExtracted = (extracted: any) => {
    setBlueprints((prev) => {
      if (prev.some((b) => b.id === extracted.id)) {
        return prev.map((b) => (b.id === extracted.id ? extracted : b));
      }
      return [extracted, ...prev];
    });
  };

  const handleBatchComplete = () => {
    loadData();
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectBlueprints = blueprints.filter((b) => b.project_id === selectedProjectId);

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('READY') || s.includes('VERIFIED')) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={13} /> {status}
        </span>
      );
    }
    if (s.includes('FAIL')) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
          <AlertTriangle size={13} /> Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={13} /> {status}
      </span>
    );
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white px-4 sm:px-8 py-6 sm:py-10 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div>
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">
              Civil Blueprint AI Workspace
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Project Dashboard</h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
              Select a project to view its blueprint files, upload new drawings, and perform side-by-side AI vector comparisons.
            </p>
          </div>
          <button
            disabled={!selectedProjectId}
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 text-sm"
          >
            <Upload size={18} /> Upload Blueprint
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="text-xs underline font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* PROJECTS SIDEBAR */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <Layers className="text-blue-600" size={18} /> Projects ({projects.length})
              </h2>
              <button onClick={loadData} title="Refresh Projects" className="text-gray-400 hover:text-gray-700">
                <RefreshCw size={16} />
              </button>
            </div>

            <form onSubmit={createProject} className="flex gap-2">
              <input
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="New project name..."
                className="min-w-0 flex-1 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 text-sm"
              />
              <button
                disabled={creating}
                className="px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
              >
                <FolderPlus size={18} />
              </button>
            </form>

            <div className="space-y-2.5 overflow-y-auto max-h-[350px] sm:max-h-[500px] pr-1">
              {projects.map((p) => {
                const count = blueprints.filter((b) => b.project_id === p.id).length;
                const isSelected = selectedProjectId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-gray-800 truncate pr-2">{p.name}</div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {count} {count === 1 ? 'file' : 'files'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                        title="Delete project"
                        className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && !projects.length && (
                <p className="text-xs text-gray-400 italic text-center py-6">No projects yet. Create one above!</p>
              )}
            </div>
          </div>

          {/* PROJECT BLUEPRINTS CONTENT */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-gray-800">
                  {selectedProject ? selectedProject.name : 'Select a Project'}
                </h2>
                <p className="text-xs text-gray-500">
                  Showing blueprints specifically assigned to this project.
                </p>
              </div>
              {loading && <Loader2 className="animate-spin text-blue-600" size={20} />}
            </div>

            <div className="space-y-3">
              {projectBlueprints.map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/blueprints/${b.id}/editor`)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/40 cursor-pointer transition-all shadow-xs group gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-2.5 sm:p-3 bg-blue-100/70 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                      <FileImage size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                        {b.original_filename}
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">
                        Uploaded on {new Date(b.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                    {getStatusBadge(b.status)}
                    <button
                      onClick={(e) => handleDeleteBlueprint(e, b.id, b.original_filename)}
                      title="Delete blueprint"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                      Open Editor →
                    </span>
                  </div>
                </div>
              ))}

              {!loading && selectedProjectId && !projectBlueprints.length && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                  <FileImage className="mx-auto text-gray-300 mb-2" size={40} />
                  <p className="text-sm font-bold text-gray-700">No blueprints in this project yet.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click "Upload Blueprint" to add floor plan drawings or a folder to {selectedProject?.name}.
                  </p>
                  <button
                    onClick={() => setShowUploader(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Upload Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUploader && selectedProjectId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">
                Upload Folder / Blueprints to <span className="text-blue-600">{selectedProject?.name}</span>
              </h2>
              <button
                onClick={() => setShowUploader(false)}
                className="text-2xl text-gray-400 hover:text-gray-700 font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <FileUploader
                projectId={selectedProjectId}
                onUploadSuccess={handleUploadSuccess}
                onSingleBlueprintExtracted={handleSingleBlueprintExtracted}
                onBatchComplete={handleBatchComplete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
