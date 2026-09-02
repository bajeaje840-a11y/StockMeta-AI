import React, { useState } from 'react';
import { X, ShieldAlert, Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import { DEFAULT_TRADEMARK_BLOCKLIST } from '../data/platforms';

interface BlocklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  blocklist: string[];
  onUpdateBlocklist: (list: string[]) => void;
  applyBlocklist: boolean;
  onToggleApplyBlocklist: (val: boolean) => void;
}

export const BlocklistModal: React.FC<BlocklistModalProps> = ({
  isOpen,
  onClose,
  blocklist,
  onUpdateBlocklist,
  applyBlocklist,
  onToggleApplyBlocklist,
}) => {
  const [newBrandInput, setNewBrandInput] = useState('');

  if (!isOpen) return null;

  const handleAddBrand = () => {
    const trimmed = newBrandInput.trim().toLowerCase();
    if (trimmed && !blocklist.includes(trimmed)) {
      onUpdateBlocklist([...blocklist, trimmed]);
      setNewBrandInput('');
    }
  };

  const handleRemoveBrand = (brand: string) => {
    onUpdateBlocklist(blocklist.filter((b) => b !== brand));
  };

  const handleResetDefaults = () => {
    onUpdateBlocklist([...DEFAULT_TRADEMARK_BLOCKLIST]);
  };

  const handleClearAll = () => {
    onUpdateBlocklist([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/90 backdrop-blur-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
              <ShieldAlert className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Trademark & Brand Blocklist
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Auto-strips trademarked keywords to prevent stock rejection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Toggle Blocklist Filter */}
          <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Enable Trademark Filter on Export
              </div>
              <div className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
                Automatically removes blocked brand names from CSV export keywords
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyBlocklist}
              onChange={(e) => onToggleApplyBlocklist(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
            />
          </div>

          {/* Add Brand Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Add Trademark / Restricted Term
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newBrandInput}
                onChange={(e) => setNewBrandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBrand();
                  }
                }}
                placeholder="e.g. GoPro, Nike, Rolex, Tesla..."
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleAddBrand}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 flex items-center space-x-1 shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Blocked Terms ({blocklist.length})
            </span>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleResetDefaults}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Restore Defaults
              </button>
              <button
                onClick={handleClearAll}
                className="text-[11px] font-semibold text-rose-500 hover:underline flex items-center"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Clear All
              </button>
            </div>
          </div>

          {/* Blocklist Chips */}
          <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            {blocklist.length === 0 ? (
              <span className="text-xs text-slate-400 italic p-2">Blocklist is empty.</span>
            ) : (
              blocklist.map((brand, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs"
                >
                  <span>{brand}</span>
                  <button
                    onClick={() => handleRemoveBrand(brand)}
                    className="ml-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 backdrop-blur-xs flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95 flex items-center space-x-1.5 shadow-2xs"
          >
            <Check className="w-4 h-4" />
            <span>Save & Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
