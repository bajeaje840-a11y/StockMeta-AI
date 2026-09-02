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
        className={`relative overflow-hidden rounded-2xl border transition-all duration-200 p-8 sm:p-10 text-center cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xl ring-4 ring-indigo-500/10 scale-[1.005]'
            : 'border-slate-200 dark:border-slate-800/90 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 shadow-xs'
        }`}
      >
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 bg-radial-[at_50%_0%] from-indigo-500/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          {/* Main Icon Capsule */}
          <div className="relative mb-5 group">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              isDragging
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-110'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 group-hover:border-indigo-300 dark:group-hover:border-indigo-700/60 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-105'
            }`}>
              <Upload className={`w-7 h-7 stroke-[2.2] ${isDragging ? 'animate-bounce' : ''}`} />
            </div>
            <div className="absolute -top-1 -right-1 p-1 rounded-full bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-3 h-3" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            {isDragging ? 'Release to queue files' : 'Drop your stock media or browse'}
          </h2>
          <p className="text-sm font-normal text-slate-500 dark:text-slate-400 mb-6 max-w-lg leading-relaxed">
            Batch process photos, legacy EPS/AI vectors, videos, and PDFs with AI metadata generation tuned for major microstock agencies.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-7">
            {/* Select Files Button */}
            <button
              id="select-files-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-sm shadow-indigo-600/25 transition-all duration-150 active:scale-[0.98]"
            >
              <FilePlus className="w-4 h-4 stroke-[2.2]" />
              <span>Choose Media Files</span>
            </button>

            {/* Select Folder Button */}
            <button
              id="select-folder-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 shadow-2xs transition-all duration-150 active:scale-[0.98]"
            >
              <FolderPlus className="w-4 h-4 text-indigo-500 stroke-[2.2]" />
              <span>Import Entire Folder</span>
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

          {/* Supported Format Visual Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xl">
            {formatCategories.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex flex-col items-start px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800/80 text-left"
                >
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    <Icon className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate w-full">
                    {item.ext}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Micro Guarantee Note */}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>PostScript vector renderer, video keyframe extractor & trademark sanitizer included</span>
          </p>
        </div>
      </div>
    </div>
  );
};
