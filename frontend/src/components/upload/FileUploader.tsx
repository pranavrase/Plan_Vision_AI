import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, Folder, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

export interface ExtractedBlueprint {
  id: number;
  project_id: number;
  original_filename: string;
  status: string;
  created_at?: string;
  extraction_status?: string;
  extraction_source?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  relativePath?: string;
  status: 'pending' | 'uploading' | 'extracting' | 'completed' | 'failed';
  error?: string;
  result?: ExtractedBlueprint;
}

interface FileUploaderProps {
  projectId: number;
  onUploadSuccess: (blueprintId: number) => void;
  onSingleBlueprintExtracted?: (blueprint: ExtractedBlueprint) => void;
  onBatchComplete?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  projectId,
  onUploadSuccess,
  onSingleBlueprintExtracted,
  onBatchComplete,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

  const isValidFile = (file: File) => {
    if (validTypes.includes(file.type)) return true;
    return /\.(jpg|jpeg|png|webp)$/i.test(file.name);
  };

  const addFilesToQueue = (newFiles: File[], folder?: string) => {
    const validFiles = newFiles.filter((f) => isValidFile(f));
    if (validFiles.length === 0) {
      setGlobalError('No valid blueprint images (JPG, PNG, WEBP) found.');
      return;
    }

    if (newFiles.length > validFiles.length) {
      setGlobalError(`Ignored ${newFiles.length - validFiles.length} non-image file(s).`);
    } else {
      setGlobalError(null);
    }

    if (folder) setFolderName(folder);

    const items: BatchItem[] = validFiles.map((file, idx) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
      file,
      relativePath: (file as any).webkitRelativePath || file.name,
      status: 'pending',
    }));

    setQueue((prev) => [...prev, ...items]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const extractedFiles: File[] = [];
    let detectedFolderName: string | null = null;

    const traverseEntry = async (entry: any): Promise<File[]> => {
      if (entry.isFile) {
        return new Promise<File[]>((resolve) => {
          entry.file(
            (file: File) => resolve([file]),
            () => resolve([])
          );
        });
      } else if (entry.isDirectory) {
        if (!detectedFolderName) detectedFolderName = entry.name;
        const dirReader = entry.createReader();
        return new Promise<File[]>((resolve) => {
          const filesInDir: File[] = [];
          const readEntries = () => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) {
                resolve(filesInDir);
              } else {
                for (const child of entries) {
                  const subFiles = await traverseEntry(child);
                  filesInDir.push(...subFiles);
                }
                readEntries();
              }
            }, () => resolve(filesInDir));
          };
          readEntries();
        });
      }
      return [];
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        const files = await traverseEntry(entry);
        extractedFiles.push(...files);
      } else {
        const file = item.getAsFile();
        if (file) extractedFiles.push(file);
      }
    }

    if (extractedFiles.length > 0) {
      addFilesToQueue(extractedFiles, detectedFolderName || undefined);
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      addFilesToQueue(filesArray);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const firstPath = filesArray[0]?.webkitRelativePath || '';
      const folder = firstPath.split('/')[0] || 'Selected Folder';
      addFilesToQueue(filesArray, folder);
    }
  };

  const removeFromQueue = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setQueue([]);
    setFolderName(null);
    setGlobalError(null);
  };

  const processBatchSequential = async () => {
    if (queue.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setGlobalError(null);

    for (let i = 0; i < queue.length; i++) {
      const currentItem = queue[i];
      if (currentItem.status === 'completed') continue;

      setCurrentIndex(i);

      // Step 1: Set uploading / extracting status
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'uploading' } : item
        )
      );

      try {
        const formData = new FormData();
        formData.append('file', currentItem.file);
        formData.append('project_id', projectId.toString());

        // Update to extracting
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'extracting' } : item
          )
        );

        const response = await api.post<ExtractedBlueprint>('/blueprints/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const extracted = response.data;

        // Step 2: Mark completed
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'completed', result: extracted }
              : item
          )
        );

        if (onSingleBlueprintExtracted) {
          onSingleBlueprintExtracted(extracted);
        }
      } catch (err: any) {
        const detail = err.response?.data?.detail || 'Extraction failed for this blueprint.';
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'failed', error: detail } : item
          )
        );
      }
    }

    setIsProcessing(false);
    setCurrentIndex(null);

    if (onBatchComplete) {
      onBatchComplete();
    }
  };

  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;
  const totalCount = queue.length;
  const progressPercent = totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Upload & Extract Folder</h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              <Sparkles size={13} /> Batch Processing
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Upload an entire folder or multiple blueprint files. The system will extract vector elements sequentially for each file.
          </p>
        </div>

        {/* INPUT TRIGGER BUTTONS */}
        {!isProcessing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
            >
              <Folder size={15} /> Select Folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl transition-colors cursor-pointer"
            >
              <FileImage size={15} /> Choose Files
            </button>
          </div>
        )}
      </div>

      {/* HIDDEN INPUTS */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg, image/png, image/webp"
        onChange={handleFilesChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderChange}
        className="hidden"
      />

      {/* DROP AREA (WHEN QUEUE IS EMPTY) */}
      {queue.length === 0 && (
        <div
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
              : 'border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-blue-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full mb-3 shadow-inner">
            <Upload className="w-8 h-8" />
          </div>
          <p className="mb-1 text-sm font-bold text-gray-800">
            Drag & drop your whole blueprint folder here
          </p>
          <p className="text-xs text-gray-500 mb-4">
            or choose individual drawing files (JPG, PNG, WEBP)
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
            >
              Browse Folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-xl shadow-xs transition-colors"
            >
              Browse Files
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL ERROR BANNER */}
      {globalError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200 flex items-center justify-between">
          <span>{globalError}</span>
          <button onClick={() => setGlobalError(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* QUEUE & EXTRACTION STATUS */}
      {queue.length > 0 && (
        <div className="space-y-4">
          {/* FOLDER & PROGRESS SUMMARY BAR */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="text-blue-600" size={20} />
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {folderName ? folderName : 'Blueprint Batch Queue'} ({queue.length} files)
                  </h4>
                  <p className="text-xs text-gray-500">
                    {completedCount} of {totalCount} blueprints extracted one by one
                  </p>
                </div>
              </div>

              {!isProcessing && completedCount < totalCount && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-xs font-semibold text-gray-500 hover:text-red-600"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {/* PROGRESS BAR */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* FILE QUEUE LIST */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {queue.map((item, index) => {
              const isCurrent = currentIndex === index;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50/80 shadow-xs ring-2 ring-blue-500/20'
                      : item.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50/30'
                      : item.status === 'failed'
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2.5 rounded-lg flex-shrink-0 ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : item.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <FileImage size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {item.file.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({(item.file.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>

                      {/* STATUS MESSAGES */}
                      <div className="text-xs mt-0.5">
                        {item.status === 'pending' && (
                          <span className="text-gray-400 font-medium">Queued for extraction</span>
                        )}
                        {item.status === 'uploading' && (
                          <span className="text-blue-600 font-bold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Uploading image...
                          </span>
                        )}
                        {item.status === 'extracting' && (
                          <span className="text-blue-700 font-bold flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> Gemini AI extracting wall/door/room vectors...
                          </span>
                        )}
                        {item.status === 'completed' && item.result && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} /> Extracted successfully! Status: {item.result.status}
                          </span>
                        )}
                        {item.status === 'failed' && (
                          <span className="text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> {item.error || 'Failed to extract'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS RIGHT */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.status === 'completed' && item.result && (
                      <button
                        type="button"
                        onClick={() => onUploadSuccess(item.result!.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        Open Editor <ArrowRight size={13} />
                      </button>
                    )}

                    {!isProcessing && item.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => removeFromQueue(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500 font-medium">
              {isProcessing
                ? `Extracting file ${currentIndex! + 1} of ${totalCount}...`
                : completedCount === totalCount
                ? `All ${totalCount} blueprints extracted successfully!`
                : `${totalCount - completedCount} blueprint(s) ready to extract`}
            </div>

            <div className="flex items-center gap-3">
              {!isProcessing && (
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  + Add More Files
                </button>
              )}

              {completedCount < totalCount && (
                <button
                  type="button"
                  onClick={processBatchSequential}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Extracting Blueprints One by One...
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} /> Extract All Blueprints ({queue.length - completedCount})
                    </>
                  )}
                </button>
              )}

              {completedCount > 0 && !isProcessing && (
                <button
                  type="button"
                  onClick={() => {
                    const firstCompleted = queue.find((q) => q.status === 'completed' && q.result);
                    if (firstCompleted && firstCompleted.result) {
                      onUploadSuccess(firstCompleted.result.id);
                    }
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

