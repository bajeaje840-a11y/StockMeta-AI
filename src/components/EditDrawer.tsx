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
  Layers,
  ShieldAlert,
  ArrowRight,
  Sliders,
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end transition-opacity duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200/80 dark:border-slate-800 transition-colors animate-slide-in">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/90 backdrop-blur-xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onNavigate('prev')}
                disabled={!hasPrev}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-slate-700 dark:text-slate-300 active:scale-95"
                title="Previous file"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('next')}
                disabled={!hasNext}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all text-slate-700 dark:text-slate-300 active:scale-95"
                title="Next file"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                {file.name}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">{bytesToSize(file.size)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRegenerate(file.id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 transition-all duration-150 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Regenerate AI</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Media Preview Stage */}
          <div className="w-full h-56 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 overflow-hidden flex items-center justify-center relative shadow-inner">
            {file.previewUrl ? (
              <img src={file.previewUrl} alt={file.name} className="w-full h-full object-contain p-2" />
            ) : (
              <FileImage className="w-12 h-12 text-slate-400" />
            )}

            {/* AI Model Attribution Pill */}
            {(file.providerUsed || file.modelUsed) && (
              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium flex items-center space-x-1.5 shadow-md border border-slate-700/50">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span className="capitalize">{file.providerUsed || 'AI'}:</span>
                <span className="font-mono text-slate-300">{file.modelUsed}</span>
              </div>
            )}
          </div>

          {/* Title Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                SEO Title
              </label>
              <span
                className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${
                  isTitleOver70 ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800' : 'text-slate-400'
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
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
            />

            {/* Validation Alerts */}
            {(hasCommas || isTitleOver70) && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-amber-800 dark:text-amber-200 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>
                    {hasCommas && 'Commas not allowed by Adobe Stock. '}
                    {isTitleOver70 && 'Title exceeds 70 characters. '}
                  </span>
                </div>
                <button
                  onClick={handleCleanTitleCommasAndLength}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold text-xs shadow-2xs hover:bg-amber-500 transition-all active:scale-95"
                >
                  Auto-Fix
                </button>
              </div>
            )}
          </div>

          {/* Description Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Detailed Description
              </label>
              <span className="text-xs font-mono text-slate-400">{description.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                saveChanges({ description: e.target.value });
              }}
              placeholder="Comprehensive contextual visual description..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Keywords Tag Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Keywords ({keywords.length} tags)
              </label>
              <span className="text-[11px] font-mono text-slate-400">Target: 25–49 tags</span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleCopyKeywords}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copiedNotification ? <Check className="w-3 h-3 text-emerald-500 inline mr-1" /> : <Copy className="w-3 h-3 inline mr-1" />}
                Copy All
              </button>

              <button
                onClick={handleSortKeywordsAlphabetical}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Sort A-Z
              </button>

              <button
                onClick={handleDeduplicate}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Deduplicate
              </button>

              {blocklist.length > 0 && (
                <button
                  onClick={handleFilterBlocklist}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                >
                  <ShieldAlert className="w-3 h-3 inline mr-1 text-amber-500" />
                  Strip Trademarks
                </button>
              )}
            </div>

            {/* Tag Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type keyword and press Enter or Comma..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xs transition-all active:scale-95"
              >
                Add Tag
              </button>
            </div>

            {/* Keyword Chips List */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {keywords.map((tag, idx) => {
                const isBlocked = blocklist.some((b) => b.toLowerCase() === tag.toLowerCase());
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isBlocked
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 line-through'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs'
                    }`}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      className="ml-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Marketplace Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            {/* Adobe Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Adobe Stock Category
              </label>
              <select
                value={adobeCat}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setAdobeCat(val);
                  saveChanges({ adobeCategory: val });
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Shutterstock Category
              </label>
              <select
                value={shutterstockCat1}
                onChange={(e) => {
                  setShutterstockCat1(e.target.value);
                  saveChanges({ shutterstockCategory1: e.target.value });
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
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
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Contributor Attributes & Releases
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIllustration}
                  onChange={(e) => {
                    setIsIllustration(e.target.checked);
                    saveChanges({ isIllustration: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Illustration / Vector</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEditorial}
                  onChange={(e) => {
                    setIsEditorial(e.target.checked);
                    saveChanges({ isEditorial: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Editorial</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMature}
                  onChange={(e) => {
                    setIsMature(e.target.checked);
                    saveChanges({ isMature: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Mature Content</span>
              </label>
            </div>

            {/* Releases */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
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
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 backdrop-blur-xs flex items-center justify-between">
          <button
            onClick={() => onDelete(file.id)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-all active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete File</span>
          </button>

          <button
            onClick={onClose}
            className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-2xs transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Done Editing</span>
          </button>
        </div>
      </div>
    </div>
  );
};
