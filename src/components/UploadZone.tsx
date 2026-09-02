import React, { useRef, useState } from 'react';
import { Upload, FolderPlus, FilePlus, Sparkles, Image as ImageIcon, Film, Layers, FileCode, CheckCircle2 } from 'lucide-react';

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  isProcessing: boolean;
  totalFilesInBatch: number;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesAdded,
  isProcessing,
  totalFilesInBatch,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const formatCategories = [
    { label: 'Photos & Art', ext: 'JPG, PNG, WEBP, TIFF, HEIC', icon: ImageIcon },
    { label: 'Vectors & Logos', ext: 'EPS, AI, SVG', icon: Layers },
    { label: 'Footage & Video', ext: 'MP4, MOV', icon: Film },
    { label: 'Documents', ext: 'PDF', icon: FileCode },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Scan folder tree recursively if folder dropped
   */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const filesList: File[] = [];

    if (items) {
      const entryPromises: Promise<void>[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            entryPromises.push(scanFileSystemEntry(entry, filesList));
          } else {
            const file = item.getAsFile();
            if (file) filesList.push(file);
          }
        }
      }

      await Promise.all(entryPromises);
    } else {
      const files = Array.from(e.dataTransfer.files) as File[];
      filesList.push(...files);
    }

    if (filesList.length > 0) {
      onFilesAdded(filesList);
    }
  };

  const scanFileSystemEntry = async (entry: any, fileArray: File[]): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          fileArray.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      return new Promise((resolve) => {
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length === 0) {
              resolve();
            } else {
              for (const childEntry of entries) {
                await scanFileSystemEntry(childEntry, fileArray);
              }
              readEntries();
            }
          });
        };
        readEntries();
      });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesAdded(files);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <div
        id="upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-xl border transition-all duration-200 p-8 sm:p-10 text-center cursor-pointer ${
          isDragging
            ? 'border-zinc-400 dark:border-zinc-400 bg-zinc-100 dark:bg-zinc-900 ring-2 ring-zinc-500/20'
            : 'border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-white/[0.14]'
        }`}
      >
        <div className="relative z-10 max-w-xl mx-auto flex flex-col items-center">
          {/* Main Icon Box */}
          <div className="mb-4">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
              isDragging
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 scale-105'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08]'
            }`}>
              <Upload className={`w-5 h-5 stroke-[2] ${isDragging ? 'animate-bounce' : ''}`} />
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1.5">
            {isDragging ? 'Drop media files to queue' : 'Drag & drop stock media or browse'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 max-w-md leading-relaxed">
            Automatic PostScript rasterization for EPS/AI vectors, high-res photo indexing, and SEO tagging.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-6">
            {/* Select Files Button */}
            <button
              id="select-files-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-xs text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Choose Files</span>
            </button>

            {/* Select Folder Button */}
            <button
              id="select-folder-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200/80 dark:border-white/[0.08] transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Import Folder</span>
            </button>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.tiff,.tif,.heic,.heif,.ai,.eps,.svg,.ps,.pdf,.mp4,.mov,image/*,image/svg+xml,application/pdf,application/postscript,application/illustrator"
              className="hidden"
            />
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFileInputChange}
              // @ts-ignore
              webkitdirectory=""
              // @ts-ignore
              directory=""
              multiple
              className="hidden"
            />
          </div>

          {/* Supported Format Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg">
            {formatCategories.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-start px-2.5 py-2 rounded-lg bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/[0.05] text-left"
                >
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    <Icon className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                    <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>
                  </div>
                  <span className="text-[9.5px] font-mono text-zinc-400 dark:text-zinc-500 truncate w-full">
                    {item.ext}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 mt-4 flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>PostScript vector engine, video frame extraction, and CSV sanitization active</span>
          </p>
        </div>
      </div>
    </div>
  );
};
