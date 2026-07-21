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
  Eye,
  AlertTriangle,
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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Video className="w-3 h-3 mr-1" /> VIDEO
          </span>
        );
      case 'vector':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <FileCode className="w-3 h-3 mr-1" /> VECTOR
          </span>
        );
      case 'pdf':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <FileText className="w-3 h-3 mr-1" /> PDF
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <FileImage className="w-3 h-3 mr-1" /> IMAGE
          </span>
        );
    }
  };

  const renderStatusPill = (status: StockFile['status'], errorMsg?: string) => {
    switch (status) {
      case 'queued':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            <Clock className="w-3 h-3 mr-1 text-gray-400" /> Queued
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin text-indigo-500" /> AI Generating
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Success
          </span>
        );
      case 'failed':
        return (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-help"
            title={errorMsg || 'Failed to generate metadata'}
          >
            <AlertCircle className="w-3 h-3 mr-1 text-rose-500" /> Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <XCircle className="w-3 h-3 mr-1 text-amber-500" /> Cancelled
          </span>
        );
    }
  };

  if (files.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center text-gray-400">
        <FileImage className="w-12 h-12 mx-auto mb-3 opacity-40 text-indigo-500" />
        <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No files in batch queue</p>
        <p className="text-xs text-gray-500 mt-1">Upload stock images or select a folder above to generate SEO metadata.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
      {/* Bulk Toolbar if selection exists */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-800 px-6 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
            {selectedIds.size} file{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onBulkRetry(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Selected</span>
            </button>
            <button
              onClick={() => {
                onBulkDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 w-16">Preview</th>
              <th className="py-3 px-4 min-w-[180px]">Filename & Format</th>
              <th className="py-3 px-4 min-w-[130px]">Status</th>
              <th className="py-3 px-4 min-w-[280px]">Title (SEO Preview)</th>
              <th className="py-3 px-4 min-w-[120px]">Keywords</th>
              <th className="py-3 px-4 w-28 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
            {files.map((file) => {
              const isSelected = selectedIds.has(file.id);
              const titleCommas = file.title.includes(',');
              const titleLengthExceeded = file.title.length > 70;

              return (
                <tr
                  key={file.id}
                  onClick={() => onSelectRow(file.id)}
                  className={`group transition hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer ${
                    isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 px-4 text-center" onClick={(e) => toggleSelectRow(file.id, e)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Thumbnail */}
                  <td className="py-3 px-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center relative group-hover:shadow-md transition">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <FileImage className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </td>

                  {/* Filename & Format */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]" title={file.name}>
                      {file.name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {renderFormatBadge(file)}
                      <span className="text-[11px] text-gray-400">{bytesToSize(file.size)}</span>
                    </div>
                  </td>

                  {/* Status Pill */}
                  <td className="py-3 px-4">
                    {renderStatusPill(file.status, file.errorMessage)}
                    {file.errorMessage && (
                      <div className="text-[10px] text-rose-500 truncate max-w-[140px] mt-1" title={file.errorMessage}>
                        {file.errorMessage}
                      </div>
                    )}
                  </td>

                  {/* Title Preview */}
                  <td className="py-3 px-4">
                    {file.title ? (
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug">
                          {file.title}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              titleLengthExceeded
                                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                                : 'text-gray-400'
                            }`}
                          >
                            {file.title.length}/70 chars
                          </span>

                          {titleCommas && (
                            <span
                              className="text-[10px] font-semibold text-rose-500 flex items-center"
                              title="Title has commas (Not permitted by Adobe Stock)"
                            >
                              <AlertTriangle className="w-3 h-3 mr-0.5 inline" /> Has commas
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">
                        {file.status === 'processing' ? 'Generating AI Title...' : 'No title yet'}
                      </span>
                    )}
                  </td>

                  {/* Keywords Count */}
                  <td className="py-3 px-4">
                    {file.keywords && file.keywords.length > 0 ? (
                      <div className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold border border-gray-200 dark:border-gray-700">
                        <Tag className="w-3 h-3 mr-1 text-indigo-500" />
                        <span>{file.keywords.length} tags</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-[11px]">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                      {/* Edit Button */}
                      <button
                        onClick={() => onSelectRow(file.id)}
                        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 transition"
                        title="Edit metadata in drawer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Single Row Regenerate / Retry */}
                      <button
                        onClick={() => onRegenerateRow(file.id)}
                        className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/40 hover:text-amber-600 transition"
                        title="Regenerate metadata with AI"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* Delete Row */}
                      <button
                        onClick={() => onDeleteRow(file.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition"
                        title="Remove file from batch"
                      >
                        <Trash2 className="w-4 h-4" />
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
