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
  if (!isOpen) return null;

  const [newBrandInput, setNewBrandInput] = useState('');

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Trademark & Brand Blocklist
              </h3>
              <p className="text-xs text-gray-500">
                Auto-strips trademarked keywords to prevent stock rejection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Toggle Blocklist Filter */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Enable Trademark Filter on Export
              </div>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                Automatically removes blocked brand names from CSV export keywords
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyBlocklist}
              onChange={(e) => onToggleApplyBlocklist(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Add Brand Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
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
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleAddBrand}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Blocked Terms ({blocklist.length})
            </span>
            <div className="flex items-center space-x-2">
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
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-2xl flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
            {blocklist.length === 0 ? (
              <span className="text-xs text-gray-400 italic p-2">Blocklist is empty.</span>
            ) : (
              blocklist.map((brand, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-sm"
                >
                  <span>{brand}</span>
                  <button
                    onClick={() => handleRemoveBrand(brand)}
                    className="ml-1.5 text-gray-400 hover:text-rose-500 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save & Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
