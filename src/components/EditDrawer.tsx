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
  Wand2,
  FileImage,
  Layers,
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
  if (!isOpen || !file) return null;

  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description);
  const [keywords, setKeywords] = useState<string[]>(file.keywords || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [adobeCat, setAdobeCat] = useState<number>(file.adobeCategory || 8);
  const [shutterstockCat1, setShutterstockCat1] = useState(file.shutterstockCategory1 || 'Vectors');
  const [shutterstockCat2, setShutterstockCat2] = useState(file.shutterstockCategory2 || 'Arts');
  const [isIllustration, setIsIllustration] = useState(file.isIllustration || false);
  const [isEditorial, setIsEditorial] = useState(file.isEditorial || false);
  const [isMature, setIsMature] = useState(file.isMature || false);
  const [releases, setReleases] = useState(file.releases || '');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Synchronize state when selected file changes
  useEffect(() => {
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800 transition-colors">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigate('prev')}
              disabled={!hasPrev}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
              title="Previous file"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={!hasNext}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition"
              title="Next file"
            >
              <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[280px]" title={file.name}>
                {file.name}
              </h3>
              <p className="text-xs text-gray-500">{bytesToSize(file.size)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRegenerate(file.id)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-run AI</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Media Preview Box */}
          <div className="w-full h-56 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center relative shadow-inner">
            {file.previewUrl ? (
              <img src={file.previewUrl} alt={file.name} className="w-full h-full object-contain" />
            ) : (
              <FileImage className="w-12 h-12 text-gray-400" />
            )}

            {/* AI Model Attribution Pill */}
            {(file.providerUsed || file.modelUsed) && (
              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-[11px] font-medium flex items-center space-x-1.5 shadow-md">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span className="capitalize">{file.providerUsed || 'AI'}:</span>
                <span className="font-mono text-gray-300">{file.modelUsed}</span>
              </div>
            )}
          </div>

          {/* Title Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                SEO Title
              </label>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  isTitleOver70 ? 'bg-amber-500/15 text-amber-600 font-bold' : 'text-gray-400'
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
              placeholder="Descriptive SEO Title (no commas)"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {/* Validation Alerts */}
            {(hasCommas || isTitleOver70) && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  <span>
                    {hasCommas && 'Commas are not allowed by Adobe Stock. '}
                    {isTitleOver70 && 'Title exceeds 70 characters. '}
                  </span>
                </div>
                <button
                  onClick={handleCleanTitleCommasAndLength}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold text-xs shadow-sm hover:bg-amber-600 transition"
                >
                  Auto-Fix
                </button>
              </div>
            )}
          </div>

          {/* Description Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Description
              </label>
              <span className="text-xs text-gray-400">{description.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                saveChanges({ description: e.target.value });
              }}
              placeholder="Detailed sentence visual description"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Keywords Tag Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center">
                <Tag className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Keywords ({keywords.length} tags)
              </label>
              <span className="text-[11px] text-gray-400">Target: 15–49 tags</span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleCopyKeywords}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 transition"
              >
                {copiedNotification ? <Check className="w-3 h-3 text-emerald-500 inline mr-1" /> : <Copy className="w-3 h-3 inline mr-1" />}
                Copy All
              </button>

              <button
                onClick={handleSortKeywordsAlphabetical}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 transition"
              >
                Sort A-Z
              </button>

              <button
                onClick={handleDeduplicate}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 transition"
              >
                Deduplicate
              </button>

              {blocklist.length > 0 && (
                <button
                  onClick={handleFilterBlocklist}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
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
                placeholder="Type keyword and press Enter or Comma"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleAddTag}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition"
              >
                Add Tag
              </button>
            </div>

            {/* Keyword Chips List */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {keywords.map((tag, idx) => {
                const isBlocked = blocklist.some((b) => b.toLowerCase() === tag.toLowerCase());
                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isBlocked
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 line-through'
                        : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm'
                    }`}
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      className="ml-1.5 text-gray-400 hover:text-rose-500 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Marketplace Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-800">
            {/* Adobe Category */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Adobe Stock Category
              </label>
              <select
                value={adobeCat}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setAdobeCat(val);
                  saveChanges({ adobeCategory: val });
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                Shutterstock Category
              </label>
              <select
                value={shutterstockCat1}
                onChange={(e) => {
                  setShutterstockCat1(e.target.value);
                  saveChanges({ shutterstockCategory1: e.target.value });
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
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
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Contributor Flags & Releases
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isIllustration}
                  onChange={(e) => {
                    setIsIllustration(e.target.checked);
                    saveChanges({ isIllustration: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Illustration / Vector</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEditorial}
                  onChange={(e) => {
                    setIsEditorial(e.target.checked);
                    saveChanges({ isEditorial: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Editorial</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMature}
                  onChange={(e) => {
                    setIsMature(e.target.checked);
                    saveChanges({ isMature: e.target.checked });
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Mature Content</span>
              </label>
            </div>

            {/* Releases */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Release File Name (Optional)
              </label>
              <input
                type="text"
                value={releases}
                onChange={(e) => {
                  setReleases(e.target.value);
                  saveChanges({ releases: e.target.value });
                }}
                placeholder="e.g. model_release_01.pdf"
                className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 flex items-center justify-between">
          <button
            onClick={() => onDelete(file.id)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete File</span>
          </button>

          <button
            onClick={onClose}
            className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition"
          >
            <Check className="w-4 h-4" />
            <span>Done Editing</span>
          </button>
        </div>
      </div>
    </div>
  );
};
