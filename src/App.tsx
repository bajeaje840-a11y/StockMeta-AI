import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { QueueControls } from './components/QueueControls';
import { QueueTable } from './components/QueueTable';
import { EditDrawer } from './components/EditDrawer';
import { BlocklistModal } from './components/BlocklistModal';
import {
  ExportSettings,
  PlatformId,
  QueueStats,
  StockFile,
} from './types';
import { DEFAULT_TRADEMARK_BLOCKLIST, mapToAdobeCategory, mapToShutterstockCategory } from './data/platforms';
import { getFormatCategory, prepareFileForAi } from './utils/fileHelpers';
import { downloadAllPlatformsZip, downloadCSV, generateCSV } from './utils/csvExporter';
import { Sparkles, CheckCircle2, AlertCircle, Info, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState<StockFile[]>([]);
  const [queueState, setQueueState] = useState<'idle' | 'running' | 'paused' | 'cancelled'>('idle');
  const [concurrency, setConcurrency] = useState<number>(3);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isBlocklistOpen, setIsBlocklistOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    selectedPlatform: 'adobe_stock',
    autoRename: false,
    applyBlocklist: true,
    customBlocklist: [...DEFAULT_TRADEMARK_BLOCKLIST],
  });

  // Track active AbortControllers per file
  const activeControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Compute Queue Stats
  const stats: QueueStats = {
    total: files.length,
    queued: files.filter((f) => f.status === 'queued').length,
    processing: files.filter((f) => f.status === 'processing').length,
    success: files.filter((f) => f.status === 'success').length,
    failed: files.filter((f) => f.status === 'failed').length,
    cancelled: files.filter((f) => f.status === 'cancelled').length,
  };

  /**
   * Worker function to process a single file via Gemini API
   */
  const processSingleFile = useCallback(async (file: StockFile) => {
    const controller = new AbortController();
    activeControllersRef.current.set(file.id, controller);

    try {
      // 1. Prepare preview & base64 image data
      let base64Data = file.base64Data;
      let mimeTypeForAi = file.mimeTypeForAi;
      let previewUrl = file.previewUrl;

      if ((!base64Data || !previewUrl) && file.file) {
        const prep = await prepareFileForAi(file.file);
        base64Data = prep.base64Data;
        mimeTypeForAi = prep.mimeTypeForAi;
        previewUrl = prep.previewUrl;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, base64Data, mimeTypeForAi, previewUrl }
              : f
          )
        );
      }

      if (!base64Data) {
        throw new Error('Could not read image base64 data for AI processing.');
      }

      // 2. Call server-side API endpoint
      const response = await fetch('/api/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          base64Data,
          mimeType: mimeTypeForAi,
          filename: file.name,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || `Server responded with status ${response.status}`);
      }

      const meta = resData.metadata;
      const adobeCat = mapToAdobeCategory(meta.category_guess, meta.title + ' ' + (meta.keywords || []).join(' '));
      const { cat1, cat2 } = mapToShutterstockCategory(meta.category_guess, meta.title + ' ' + (meta.keywords || []).join(' '));

      // 3. Update file with generated AI metadata
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                status: 'success',
                title: meta.title || f.name,
                description: meta.description || meta.title || f.name,
                keywords: meta.keywords || [],
                category_guess: meta.category_guess || 'Graphic Resources',
                adobeCategory: adobeCat,
                shutterstockCategory1: cat1,
                shutterstockCategory2: cat2,
                errorMessage: undefined,
              }
            : f
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setFiles((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, status: 'cancelled' } : f))
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'failed',
                  errorMessage: err?.message || 'Failed to generate metadata',
                }
              : f
          )
        );
      }
    } finally {
      activeControllersRef.current.delete(file.id);
    }
  }, []);

  /**
   * Queue Manager Loop: monitors queueState and triggers up to `concurrency` parallel tasks
   */
  useEffect(() => {
    if (queueState !== 'running') return;

    const queuedFiles = files.filter((f) => f.status === 'queued');
    const processingFiles = files.filter((f) => f.status === 'processing');

    if (queuedFiles.length === 0 && processingFiles.length === 0) {
      setQueueState('idle');
      return;
    }

    const availableSlots = concurrency - processingFiles.length;

    if (availableSlots > 0 && queuedFiles.length > 0) {
      const filesToStart = queuedFiles.slice(0, availableSlots);

      // Mark files as processing first
      setFiles((prev) =>
        prev.map((f) =>
          filesToStart.some((ts) => ts.id === f.id)
            ? { ...f, status: 'processing' }
            : f
        )
      );

      // Trigger workers
      filesToStart.forEach((file) => {
        processSingleFile(file);
      });
    }
  }, [files, queueState, concurrency, processSingleFile]);

  /**
   * Handle Uploading files/folders
   */
  const handleFilesAdded = async (newRawFiles: File[]) => {
    const preparedList: StockFile[] = [];

    for (const file of newRawFiles) {
      const extCategory = getFormatCategory(file.name, file.type);
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate initial preview URL if standard image
      let initialPreview = '';
      if (extCategory === 'image') {
        initialPreview = URL.createObjectURL(file);
      }

      preparedList.push({
        id: fileId,
        file,
        name: file.name,
        originalName: file.name,
        size: file.size,
        type: file.type,
        formatCategory: extCategory,
        previewUrl: initialPreview,
        mimeTypeForAi: file.type || 'image/jpeg',
        status: 'queued',
        title: '',
        description: '',
        keywords: [],
        category_guess: 'Graphic Resources',
        adobeCategory: 8,
        shutterstockCategory1: 'Vectors',
        shutterstockCategory2: 'Arts',
        isIllustration: extCategory === 'vector',
        isEditorial: false,
        isMature: false,
        releases: '',
        addedAt: Date.now(),
      });
    }

    setFiles((prev) => [...prev, ...preparedList]);
    setQueueState('running');
  };

  /**
   * Queue Control Actions
   */
  const handlePause = () => {
    setQueueState('paused');
    // Abort active HTTP calls
    activeControllersRef.current.forEach((controller) => controller.abort());
    activeControllersRef.current.clear();

    // Revert processing files back to queued so they resume cleanly
    setFiles((prev) =>
      prev.map((f) => (f.status === 'processing' ? { ...f, status: 'queued' } : f))
    );
  };

  const handleStartResume = () => {
    setQueueState('running');
  };

  const handleCancelAll = () => {
    setQueueState('cancelled');
    activeControllersRef.current.forEach((controller) => controller.abort());
    activeControllersRef.current.clear();

    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'queued' || f.status === 'processing'
          ? { ...f, status: 'cancelled' }
          : f
      )
    );
  };

  const handleRetryFailed = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'failed' || f.status === 'cancelled'
          ? { ...f, status: 'queued', errorMessage: undefined }
          : f
      )
    );
    setQueueState('running');
  };

  const handleRegenerateRow = (fileId: string) => {
    // Abort if currently in flight
    const existingCtrl = activeControllersRef.current.get(fileId);
    if (existingCtrl) {
      existingCtrl.abort();
      activeControllersRef.current.delete(fileId);
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: 'queued', errorMessage: undefined }
          : f
      )
    );
    setQueueState('running');
  };

  const handleDeleteRow = (fileId: string) => {
    const existingCtrl = activeControllersRef.current.get(fileId);
    if (existingCtrl) {
      existingCtrl.abort();
      activeControllersRef.current.delete(fileId);
    }
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (selectedFileId === fileId) {
      setSelectedFileId(null);
    }
  };

  const handleBulkDelete = (fileIds: string[]) => {
    const idSet = new Set(fileIds);
    fileIds.forEach((id) => {
      const ctrl = activeControllersRef.current.get(id);
      if (ctrl) {
        ctrl.abort();
        activeControllersRef.current.delete(id);
      }
    });
    setFiles((prev) => prev.filter((f) => !idSet.has(f.id)));
  };

  const handleBulkRetry = (fileIds: string[]) => {
    const idSet = new Set(fileIds);
    setFiles((prev) =>
      prev.map((f) =>
        idSet.has(f.id)
          ? { ...f, status: 'queued', errorMessage: undefined }
          : f
      )
    );
    setQueueState('running');
  };

  const handleClearQueue = () => {
    activeControllersRef.current.forEach((ctrl) => ctrl.abort());
    activeControllersRef.current.clear();
    setFiles([]);
    setQueueState('idle');
    setSelectedFileId(null);
  };

  /**
   * CSV Export Trigger
   */
  const handleExportCurrentPlatformCSV = () => {
    const platformId = exportSettings.selectedPlatform;
    const csvContent = generateCSV(files, platformId, exportSettings);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${platformId}_metadata_${dateStr}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleExportAllPlatformsZip = () => {
    downloadAllPlatformsZip(files, exportSettings);
  };

  // Filter & Search Table Rows
  const filteredFiles = files.filter((f) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.keywords.some((kw) => kw.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter =
      filterStatus === 'all' || f.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  // Selected file for Edit Drawer
  const selectedFileIndex = files.findIndex((f) => f.id === selectedFileId);
  const selectedFile = selectedFileIndex !== -1 ? files[selectedFileIndex] : null;

  return (
    <div className="min-h-screen bg-gray-100/70 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        stats={stats}
        exportSettings={exportSettings}
        onOpenBlocklist={() => setIsBlocklistOpen(true)}
        onClearQueue={handleClearQueue}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload Zone */}
        <UploadZone
          onFilesAdded={handleFilesAdded}
          isProcessing={queueState === 'running'}
          totalFilesInBatch={files.length}
        />

        {/* Batch Queue Controls & Stats */}
        {files.length > 0 && (
          <>
            <QueueControls
              stats={stats}
              queueState={queueState}
              concurrency={concurrency}
              onConcurrencyChange={setConcurrency}
              onStartResume={handleStartResume}
              onPause={handlePause}
              onCancelAll={handleCancelAll}
              onRetryFailed={handleRetryFailed}
              exportSettings={exportSettings}
              onUpdateExportSettings={(updated) =>
                setExportSettings((prev) => ({ ...prev, ...updated }))
              }
              onExportCurrentPlatformCSV={handleExportCurrentPlatformCSV}
              onExportAllPlatformsZip={handleExportAllPlatformsZip}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
            />

            {/* Queue Table */}
            <QueueTable
              files={filteredFiles}
              onSelectRow={(id) => setSelectedFileId(id)}
              onRegenerateRow={handleRegenerateRow}
              onDeleteRow={handleDeleteRow}
              onBulkDelete={handleBulkDelete}
              onBulkRetry={handleBulkRetry}
            />
          </>
        )}
      </main>

      {/* Edit Side Drawer */}
      <EditDrawer
        file={selectedFile}
        isOpen={!!selectedFile}
        onClose={() => setSelectedFileId(null)}
        onSave={(updated) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === updated.id ? updated : f))
          );
        }}
        onRegenerate={handleRegenerateRow}
        onDelete={handleDeleteRow}
        onNavigate={(dir) => {
          if (selectedFileIndex !== -1) {
            const targetIdx =
              dir === 'prev' ? selectedFileIndex - 1 : selectedFileIndex + 1;
            if (targetIdx >= 0 && targetIdx < files.length) {
              setSelectedFileId(files[targetIdx].id);
            }
          }
        }}
        hasPrev={selectedFileIndex > 0}
        hasNext={selectedFileIndex !== -1 && selectedFileIndex < files.length - 1}
        blocklist={exportSettings.customBlocklist}
      />

      {/* Blocklist Modal */}
      <BlocklistModal
        isOpen={isBlocklistOpen}
        onClose={() => setIsBlocklistOpen(false)}
        blocklist={exportSettings.customBlocklist}
        onUpdateBlocklist={(list) =>
          setExportSettings((prev) => ({ ...prev, customBlocklist: list }))
        }
        applyBlocklist={exportSettings.applyBlocklist}
        onToggleApplyBlocklist={(val) =>
          setExportSettings((prev) => ({ ...prev, applyBlocklist: val }))
        }
      />
    </div>
  );
}
