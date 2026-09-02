import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  Check,
  AlertTriangle,
  Tag,
  Copy,
  Sparkles,
  FileImage,
  ShieldAlert,
} from 'lucide-react';
import { StockFile } from '../types';
import { ADOBE_STOCK_CATEGORIES, SHUTTERSTOCK_CATEGORIES } from '../data/platforms';
import { bytesToSize } from '../utils/fileHelpers';
import { filterKeywords } from '../utils/csvExporter';

interface EditDrawerProps {
  file: StockFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedFile: StockFile) => void;
  onRegenerate: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  blocklist: string[];
}

export const EditDrawer: React.FC<EditDrawerProps> = ({
  file,
  isOpen,
  onClose,
  onSave,
  onRegenerate,
  onDelete,
  onNavigate,
  hasPrev,
  hasNext,
  blocklist,
}) => {
  const [title, setTitle] = useState(file?.title || '');
  const [description, setDescription] = useState(file?.description || '');
  const [keywords, setKeywords] = useState<string[]>(file?.keywords || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [adobeCat, setAdobeCat] = useState<number>(file?.adobeCategory || 8);
  const [shutterstockCat1, setShutterstockCat1] = useState(file?.shutterstockCategory1 || 'Vectors');
  const [shutterstockCat2, setShutterstockCat2] = useState(file?.shutterstockCategory2 || 'Arts');
  const [isIllustration, setIsIllustration] = useState(file?.isIllustration || false);
  const [isEditorial, setIsEditorial] = useState(file?.isEditorial || false);
  const [isMature, setIsMature] = useState(file?.isMature || false);
  const [releases, setReleases] = useState(file?.releases || '');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Synchronize state when selected file changes
  useEffect(() => {
    if (!file) return;
    setTitle(file.title);
    setDescription(file.description);
    setKeywords(file.keywords || []);
    setAdobeCat(file.adobeCategory || 8);
    setShutterstockCat1(file.shutterstockCategory1 || 'Vectors');
    setShutterstockCat2(file.shutterstockCategory2 || 'Arts');
    setIsIllustration(file.isIllustration || false);
    setIsEditorial(file.isEditorial || false);
    setIsMature(file.isMature || false);
    setReleases(file.releases || '');
  }, [file]);

  if (!isOpen || !file) return null;

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/,/g, '');
    if (trimmed && !keywords.includes(trimmed)) {
      const updated = [...keywords, trimmed];
      setKeywords(updated);
      setNewTagInput('');
      saveChanges({ keywords: updated });
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (index: number) => {
    const updated = keywords.filter((_, i) => i !== index);
    setKeywords(updated);
    saveChanges({ keywords: updated });
  };

  const handleCleanTitleCommasAndLength = () => {
    let clean = title.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 70) {
      clean = clean.substring(0, 70).trim();
    }
    setTitle(clean);
    saveChanges({ title: clean });
  };

  const handleCopyKeywords = () => {
    navigator.clipboard.writeText(keywords.join(', '));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleSortKeywordsAlphabetical = () => {
    const sorted = [...keywords].sort((a, b) => a.localeCompare(b));
    setKeywords(sorted);
    saveChanges({ keywords: sorted });
  };

  const handleFilterBlocklist = () => {
    const filtered = filterKeywords(keywords, blocklist);
    setKeywords(filtered);
    saveChanges({ keywords: filtered });
  };

  const handleDeduplicate = () => {
    const unique = Array.from(new Set(keywords.map((k) => k.trim()))) as string[];
    setKeywords(unique);
    saveChanges({ keywords: unique });
  };

  const saveChanges = (overrides: Partial<StockFile> = {}) => {
    onSave({
      ...file,
      title,
      description,
      keywords,
      adobeCategory: adobeCat,
      shutterstockCategory1: shutterstockCat1,
      shutterstockCategory2: shutterstockCat2,
      isIllustration,
      isEditorial,
      isMature,
      releases,
      ...overrides,
    });
  };

  const hasCommas = title.includes(',');
  const isTitleOver70 = title.length > 70;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex justify-end transition-opacity duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#121215] h-full shadow-2xl flex flex-col border-l border-zinc-200 dark:border-white/[0.08] transition-colors animate-slide-in">
        {/* Drawer Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onNavigate('prev')}
                disabled={!hasPrev}
                className="p-1 rounded-md border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all text-zinc-600 dark:text-zinc-400 cursor-pointer"
                title="Previous file"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate('next')}
                disabled={!hasNext}
                className="p-1 rounded-md border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-all text-zinc-600 dark:text-zinc-400 cursor-pointer"
                title="Next file"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[10px] font-mono text-zinc-400">{bytesToSize(file.size)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onRegenerate(file.id)}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Media Preview Stage */}
          <div className="w-full h-48 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.06] overflow-hidden flex items-center justify-center relative shadow-inner">
            {file.previewUrl ? (
              <img
                src={file.previewUrl}
                alt={file.name}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const parent = (e.currentTarget as HTMLImageElement).parentElement;
                  if (parent && !parent.querySelector('.fallback-icon')) {
                    const icon = document.createElement('div');
                    icon.className = 'fallback-icon flex items-center justify-center w-full h-full text-zinc-400';
                    icon.innerHTML = `<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
                    parent.appendChild(icon);
                  }
                }}
              />
            ) : (
              <FileImage className="w-8 h-8 text-zinc-400" />
            )}

            {/* AI Model Attribution Pill */}
            {(file.providerUsed || file.modelUsed) && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-zinc-900/90 backdrop-blur-md text-zinc-300 text-[10px] font-mono flex items-center space-x-1 border border-white/[0.08]">
                <Sparkles className="w-2.5 h-2.5 text-zinc-400" />
                <span className="capitalize">{file.providerUsed || 'AI'}:</span>
                <span className="text-zinc-200">{file.modelUsed}</span>
              </div>
            )}
          </div>

          {/* Title Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                SEO Title
              </label>
              <span
                className={`text-[10px] font-mono px-1 rounded ${
                  isTitleOver70 ? 'bg-amber-500/10 text-amber-500 font-medium' : 'text-zinc-400'
                }`}
              >
                {title.length} / 70 chars
              </span>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                saveChanges({ title: e.target.value });
              }}
              placeholder="Descriptive stock title without commas..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-500 focus:outline-none transition-all"
            />

            {/* Validation Alerts */}
            {(hasCommas || isTitleOver70) && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px]">
                    {hasCommas && 'Commas not allowed by Adobe Stock. '}
                    {isTitleOver70 && 'Title exceeds 70 chars. '}
                  </span>
                </div>
                <button
                  onClick={handleCleanTitleCommasAndLength}
                  className="px-2 py-0.5 rounded text-[10.5px] bg-amber-500 text-white font-medium hover:bg-amber-600 transition-all cursor-pointer"
                >
                  Auto-Fix
                </button>
              </div>
            )}
          </div>

          {/* Description Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                Detailed Description
              </label>
              <span className="text-[10px] font-mono text-zinc-400">{description.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                saveChanges({ description: e.target.value });
              }}
              placeholder="Comprehensive contextual visual description..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-500 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Keywords Tag Editor */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center">
                <Tag className="w-3 h-3 mr-1 text-zinc-400" />
                Keywords ({keywords.length})
              </label>
              <span className="text-[10px] font-mono text-zinc-400">Target: 25–49 tags</span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={handleCopyKeywords}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                {copiedNotification ? <Check className="w-2.5 h-2.5 text-emerald-500 inline mr-1" /> : <Copy className="w-2.5 h-2.5 inline mr-1" />}
                Copy All
              </button>

              <button
                onClick={handleSortKeywordsAlphabetical}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Sort A-Z
              </button>

              <button
                onClick={handleDeduplicate}
                className="px-2 py-1 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Deduplicate
              </button>

              {blocklist.length > 0 && (
                <button
                  onClick={handleFilterBlocklist}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-2.5 h-2.5 inline mr-1 text-amber-500" />
                  Strip Trademarks
                </button>
              )}
            </div>

            {/* Tag Input */}
            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add tag (press Enter)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-500 focus:outline-none transition-all"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Keyword Chips List */}
            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/[0.06] rounded-xl flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {keywords.map((tag, idx) => {
                const isBlocked = blocklist.some((b) => b.toLowerCase() === tag.toLowerCase());
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      isBlocked
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 line-through'
                        : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08]'
                    }`}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      className="ml-1 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Marketplace Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-200 dark:border-white/[0.08]">
            {/* Adobe Category */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Adobe Stock Category
              </label>
              <select
                value={adobeCat}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setAdobeCat(val);
                  saveChanges({ adobeCategory: val });
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none transition-all cursor-pointer"
              >
                {ADOBE_STOCK_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.id}: {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shutterstock Primary Category */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Shutterstock Category
              </label>
              <select
                value={shutterstockCat1}
                onChange={(e) => {
                  setShutterstockCat1(e.target.value);
                  saveChanges({ shutterstockCategory1: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none transition-all cursor-pointer"
              >
                {SHUTTERSTOCK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contributor Flags */}
          <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.08] space-y-2.5">
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Contributor Attributes
            </label>

            <div className="flex flex-wrap gap-3">
              <label className="flex items-center space-x-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIllustration}
                  onChange={(e) => {
                    setIsIllustration(e.target.checked);
                    saveChanges({ isIllustration: e.target.checked });
                  }}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
                <span>Illustration / Vector</span>
              </label>

              <label className="flex items-center space-x-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEditorial}
                  onChange={(e) => {
                    setIsEditorial(e.target.checked);
                    saveChanges({ isEditorial: e.target.checked });
                  }}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
                <span>Editorial</span>
              </label>

              <label className="flex items-center space-x-1.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMature}
                  onChange={(e) => {
                    setIsMature(e.target.checked);
                    saveChanges({ isMature: e.target.checked });
                  }}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer"
                />
                <span>Mature Content</span>
              </label>
            </div>

            {/* Releases */}
            <div>
              <label className="block text-[10.5px] text-zinc-500 dark:text-zinc-400 mb-1">
                Release Reference Name (Optional)
              </label>
              <input
                type="text"
                value={releases}
                onChange={(e) => {
                  setReleases(e.target.value);
                  saveChanges({ releases: e.target.value });
                }}
                placeholder="e.g. model_release_01.pdf"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 focus:border-zinc-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs flex items-center justify-between">
          <button
            onClick={() => onDelete(file.id)}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            onClick={onClose}
            className="inline-flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
