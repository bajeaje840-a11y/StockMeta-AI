import React, { useRef, useState } from 'react';
import { Upload, FolderPlus, FilePlus, Sparkles, CheckCircle2, FileImage, Video, FileText, FileCode } from 'lucide-react';
import { bytesToSize, getFormatCategory } from '../utils/fileHelpers';

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

  const supportedFormats = [
    { label: 'JPG / JPEG', cat: 'image' },
    { label: 'PNG', cat: 'image' },
    { label: 'WEBP', cat: 'image' },
    { label: 'GIF', cat: 'image' },
    { label: 'TIFF', cat: 'image' },
    { label: 'HEIC / HEIF', cat: 'image' },
    { label: 'AI (Illustrator)', cat: 'vector' },
    { label: 'EPS', cat: 'vector' },
    { label: 'PDF', cat: 'pdf' },
    { label: 'MP4 / MOV (Video)', cat: 'video' },
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
    <div className="w-full mb-6">
      <div
        id="upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 scale-[1.01] shadow-xl'
            : 'border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-100/50 dark:hover:bg-gray-800/40'
        }`}
      >
        {/* Background Decorative Accent */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          {/* Upload Icon */}
          <div className="h-16 w-16 mb-4 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-8 ring-indigo-500/5 shadow-inner">
            <Upload className={`w-8 h-8 ${isDragging ? 'animate-bounce' : ''}`} />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Drag & Drop Stock Media or Select Folders
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-lg">
            Upload photos, illustrations, vector files, PDFs, or stock video clips. Our AI Vision model automatically generates SEO Titles, Descriptions, and Keywords.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            {/* Select Files Button */}
            <button
              id="select-files-btn"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 transition transform active:scale-95"
            >
              <FilePlus className="w-4 h-4" />
              <span>Select Files</span>
            </button>

            {/* Select Folder Button */}
            <button
              id="select-folder-btn"
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 shadow-sm transition transform active:scale-95"
            >
              <FolderPlus className="w-4 h-4 text-indigo-500" />
              <span>Select Whole Folder</span>
            </button>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              multiple
              accept=".jpg,.jpeg,.png,.webp,.gif,.tiff,.tif,.heic,.heif,.ai,.eps,.pdf,.mp4,.mov"
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

          {/* Supported Format Badges */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xl">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 font-medium">Accepted formats:</span>
            {supportedFormats.map((fmt, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-200/70 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300/50 dark:border-gray-700"
              >
                {fmt.label}
              </span>
            ))}
          </div>

          {/* Note on non-raster preview processing */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 italic">
            * Note: Non-raster inputs (AI/EPS/PDF & MP4/MOV) are frame-extracted or preview-rendered automatically before sending to AI.
          </p>
        </div>
      </div>
    </div>
  );
};
