import React, { useState } from 'react';
import {
  Edit3,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  XCircle,
  FileImage,
  Video,
  FileText,
  FileCode,
  Tag,
  AlertTriangle,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react';
import { StockFile } from '../types';
import { bytesToSize } from '../utils/fileHelpers';

interface QueueTableProps {
  files: StockFile[];
  onSelectRow: (fileId: string) => void;
  onRegenerateRow: (fileId: string) => void;
  onDeleteRow: (fileId: string) => void;
  onBulkDelete: (fileIds: string[]) => void;
  onBulkRetry: (fileIds: string[]) => void;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  files,
  onSelectRow,
  onRegenerateRow,
  onDeleteRow,
  onBulkDelete,
  onBulkRetry,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(files.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const isAllSelected = files.length > 0 && selectedIds.size === files.length;

  const renderFormatBadge = (file: StockFile) => {
    switch (file.formatCategory) {
      case 'video':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-mono">
            <Video className="w-2.5 h-2.5 mr-1" /> VIDEO
          </span>
        );
      case 'vector':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">
            <Layers className="w-2.5 h-2.5 mr-1" /> VECTOR
          </span>
        );
      case 'pdf':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-mono">
            <FileText className="w-2.5 h-2.5 mr-1" /> PDF
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-mono">
            <FileImage className="w-2.5 h-2.5 mr-1" /> IMAGE
          </span>
        );
    }
  };

  const renderStatusPill = (status: StockFile['status'], errorMsg?: string) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
            <Clock className="w-3 h-3 mr-1 text-slate-400" /> Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
            <Loader2 className="w-3 h-3 mr-1 animate-spin text-indigo-500" /> Generating...
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Ready
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 cursor-help"
            title={errorMsg || 'Failed to generate metadata'}
          >
            <AlertCircle className="w-3 h-3 mr-1 text-rose-500" /> Error
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <XCircle className="w-3 h-3 mr-1 text-amber-500" /> Paused
          </span>
        );
    }
  };

  if (files.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center text-indigo-500">
          <FileImage className="w-6 h-6 stroke-[1.8]" />
        </div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No media in queue</p>
        <p className="text-xs text-slate-500 mt-1">Upload stock photos, EPS vectors, or videos to start generating metadata.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50/90 dark:bg-indigo-950/80 border-b border-indigo-200/80 dark:border-indigo-800/80 px-5 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
              file{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onBulkRetry(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/80 shadow-2xs hover:bg-indigo-50/50 transition-all duration-150 active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Selected</span>
            </button>
            <button
              onClick={() => {
                onBulkDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 text-white shadow-2xs hover:bg-rose-500 transition-all duration-150 active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Responsive Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 w-16">Preview</th>
              <th className="py-3 px-4 min-w-[200px]">Asset & Type</th>
              <th className="py-3 px-4 min-w-[130px]">Status</th>
              <th className="py-3 px-4 min-w-[300px]">SEO Title</th>
              <th className="py-3 px-4 min-w-[120px]">Keywords</th>
              <th className="py-3 px-4 w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {files.map((file) => {
              const isSelected = selectedIds.has(file.id);
              const titleCommas = file.title.includes(',');
              const titleLengthExceeded = file.title.length > 70;

              return (
                <tr
                  key={file.id}
                  onClick={() => onSelectRow(file.id)}
                  className={`group transition-colors duration-100 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer ${
                    isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/25' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3.5 px-4 text-center" onClick={(e) => toggleSelectRow(file.id, e)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Thumbnail Preview */}
                  <td className="py-3.5 px-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden flex items-center justify-center relative shadow-2xs group-hover:border-slate-300 dark:group-hover:border-slate-600 transition-all">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <FileImage className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </td>

                  {/* Asset Name & Format */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-white truncate max-w-[210px]" title={file.name}>
                      {file.name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {renderFormatBadge(file)}
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{bytesToSize(file.size)}</span>
                    </div>
                  </td>

                  {/* Status Pill */}
                  <td className="py-3.5 px-4">
                    {renderStatusPill(file.status, file.errorMessage)}
                    {file.errorMessage && (
                      <div className="text-[10px] font-medium text-rose-500 truncate max-w-[150px] mt-1" title={file.errorMessage}>
                        {file.errorMessage}
                      </div>
                    )}
                  </td>

                  {/* SEO Title Preview */}
                  <td className="py-3.5 px-4">
                    {file.title ? (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                          {file.title}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md ${
                              titleLengthExceeded
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {file.title.length}/70 chars
                          </span>

                          {titleCommas && (
                            <span
                              className="text-[10px] font-medium text-rose-500 flex items-center"
                              title="Title has commas (Adobe Stock strictly forbids commas in titles)"
                            >
                              <AlertTriangle className="w-3 h-3 mr-0.5 inline" /> Has commas
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                        {file.status === 'processing' ? 'Generating AI metadata...' : 'Pending processing'}
                      </span>
                    )}
                  </td>

                  {/* Keywords Tag Counter */}
                  <td className="py-3.5 px-4">
                    {file.keywords && file.keywords.length > 0 ? (
                      <div className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/80 dark:border-slate-700/80">
                        <Tag className="w-3 h-3 mr-1 text-indigo-500" />
                        <span className="font-mono text-[11px]">{file.keywords.length} tags</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Action Icons */}
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                      {/* Edit Button */}
                      <button
                        onClick={() => onSelectRow(file.id)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Edit metadata in drawer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Single Row Regenerate / Retry */}
                      <button
                        onClick={() => onRegenerateRow(file.id)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                        title="Regenerate metadata with AI"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Row */}
                      <button
                        onClick={() => onDeleteRow(file.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Remove file from batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
