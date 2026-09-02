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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-white/[0.06]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Trademark Filter
              </h3>
              <p className="text-[11px] text-zinc-500">
                Strips protected brand names to prevent stock rejection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Toggle Blocklist Filter */}
          <div className="p-3 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Enable Trademark Filter on Export
              </div>
              <div className="text-[11px] text-zinc-500">
                Removes blocked keywords from CSV metadata
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyBlocklist}
              onChange={(e) => onToggleApplyBlocklist(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
            />
          </div>

          {/* Add Brand Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
              Add Restricted Term
            </label>
            <div className="flex space-x-1.5">
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
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
              />
              <button
                onClick={handleAddBrand}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-medium text-zinc-500">
              Blocked Terms ({blocklist.length})
            </span>
            <div className="flex items-center space-x-2.5">
              <button
                onClick={handleResetDefaults}
                className="text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:underline flex items-center cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 mr-1" /> Defaults
              </button>
              <button
                onClick={handleClearAll}
                className="text-[11px] text-rose-500 hover:underline flex items-center cursor-pointer"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </button>
            </div>
          </div>

          {/* Blocklist Chips */}
          <div className="p-2.5 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.06] rounded-xl flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {blocklist.length === 0 ? (
              <span className="text-xs text-zinc-400 italic p-1">Blocklist is empty.</span>
            ) : (
              blocklist.map((brand, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.06] shadow-2xs"
                >
                  <span>{brand}</span>
                  <button
                    onClick={() => handleRemoveBrand(brand)}
                    className="ml-1 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
