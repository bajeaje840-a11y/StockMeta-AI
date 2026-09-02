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
  Tag,
  AlertTriangle,
  Layers,
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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Video className="w-2.5 h-2.5 mr-1" /> VIDEO
          </span>
        );
      case 'vector':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Layers className="w-2.5 h-2.5 mr-1" /> VECTOR
          </span>
        );
      case 'pdf':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <FileText className="w-2.5 h-2.5 mr-1" /> PDF
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]">
            <FileImage className="w-2.5 h-2.5 mr-1" /> IMAGE
          </span>
        );
    }
  };

  const renderStatusPill = (status: StockFile['status'], errorMsg?: string) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]">
            <Clock className="w-3 h-3 mr-1 text-zinc-400" /> Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-help"
            title={errorMsg || 'Failed to generate metadata'}
          >
            <AlertCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]">
            <XCircle className="w-3 h-3 mr-1" /> Paused
          </span>
        );
    }
  };

  if (files.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-xl p-10 text-center text-zinc-400">
        <div className="w-10 h-10 mx-auto mb-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/[0.06] flex items-center justify-center text-zinc-500">
          <FileImage className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">No media in queue</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">Upload stock photos, EPS vectors, or videos to start generating metadata.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-xl shadow-xs overflow-hidden transition-all">
      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/[0.08] px-4 py-2 flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[10px] font-mono font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
              selected
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => {
                onBulkRetry(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => {
                onBulkDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-600 text-white hover:bg-rose-500 transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Responsive Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/80 dark:bg-zinc-900/50 border-b border-zinc-200/80 dark:border-white/[0.06] text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 select-none">
              <th className="py-2.5 px-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-2.5 w-14">Preview</th>
              <th className="py-2.5 px-3.5 min-w-[180px]">File & Type</th>
              <th className="py-2.5 px-3.5 min-w-[120px]">Status</th>
              <th className="py-2.5 px-3.5 min-w-[280px]">Generated SEO Title</th>
              <th className="py-2.5 px-3.5 min-w-[100px]">Tags</th>
              <th className="py-2.5 px-3.5 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04] text-xs">
            {files.map((file) => {
              const isSelected = selectedIds.has(file.id);
              const titleCommas = file.title.includes(',');
              const titleLengthExceeded = file.title.length > 70;

              return (
                <tr
                  key={file.id}
                  onClick={() => onSelectRow(file.id)}
                  className={`group transition-colors duration-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer ${
                    isSelected ? 'bg-zinc-100/60 dark:bg-zinc-900/60' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 px-3.5 text-center" onClick={(e) => toggleSelectRow(file.id, e)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                    />
                  </td>

                  {/* Thumbnail Preview */}
                  <td className="py-3 px-2.5">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] overflow-hidden flex items-center justify-center relative shadow-2xs">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            const parent = (e.currentTarget as HTMLImageElement).parentElement;
                            if (parent && !parent.querySelector('.fallback-icon')) {
                              const icon = document.createElement('div');
                              icon.className = 'fallback-icon flex items-center justify-center w-full h-full text-zinc-400';
                              icon.innerHTML = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                              parent.appendChild(icon);
                            }
                          }}
                        />
                      ) : (
                        <FileImage className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                  </td>

                  {/* Asset Name & Format */}
                  <td className="py-3 px-3.5">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </div>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      {renderFormatBadge(file)}
                      <span className="text-[10px] font-mono text-zinc-400">{bytesToSize(file.size)}</span>
                    </div>
                  </td>

                  {/* Status Pill */}
                  <td className="py-3 px-3.5">
                    {renderStatusPill(file.status, file.errorMessage)}
                    {file.errorMessage && (
                      <div className="text-[9.5px] text-rose-500 truncate max-w-[140px] mt-0.5 font-mono" title={file.errorMessage}>
                        {file.errorMessage}
                      </div>
                    )}
                  </td>

                  {/* SEO Title Preview */}
                  <td className="py-3 px-3.5">
                    {file.title ? (
                      <div className="space-y-0.5">
                        <div className="font-normal text-zinc-800 dark:text-zinc-200 line-clamp-2 leading-relaxed">
                          {file.title}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[9.5px] font-mono px-1 rounded ${
                              titleLengthExceeded
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                                : 'text-zinc-400'
                            }`}
                          >
                            {file.title.length}/70 chars
                          </span>

                          {titleCommas && (
                            <span
                              className="text-[9.5px] text-rose-500 flex items-center"
                              title="Title has commas (Adobe Stock forbids commas in titles)"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5 inline" /> Has commas
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                        {file.status === 'processing' ? 'Generating metadata...' : 'Pending processing'}
                      </span>
                    )}
                  </td>

                  {/* Keywords Tag Counter */}
                  <td className="py-3 px-3.5">
                    {file.keywords && file.keywords.length > 0 ? (
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-medium border border-zinc-200 dark:border-white/[0.06]">
                        <Tag className="w-2.5 h-2.5 mr-1 text-zinc-400" />
                        <span className="font-mono text-[10.5px]">{file.keywords.length}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Action Icons */}
                  <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-0.5">
                      {/* Edit Button */}
                      <button
                        onClick={() => onSelectRow(file.id)}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit metadata"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* Single Row Regenerate / Retry */}
                      <button
                        onClick={() => onRegenerateRow(file.id)}
                        className="p-1 rounded text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Regenerate metadata"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Row */}
                      <button
                        onClick={() => onDeleteRow(file.id)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Remove file"
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
