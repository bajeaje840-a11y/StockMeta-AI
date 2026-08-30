import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Sun,
  Moon,
  Trash2,
  Key,
  RefreshCw,
  Bot,
  Cpu,
  Zap,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { AiConfig, AiProvider, ExportSettings, QueueStats } from '../types';
import { AI_PROVIDERS, isProviderReady } from '../data/aiModels';

interface NavbarProps {
  stats: QueueStats;
  exportSettings: ExportSettings;
  aiConfig: AiConfig;
  onOpenAiSettings: () => void;
  onOpenBlocklist: () => void;
  onClearQueue: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  exportSettings,
  aiConfig,
  onOpenAiSettings,
  onOpenBlocklist,
  onClearQueue,
  darkMode,
  onToggleDarkMode,
}) => {
  const [keyStatus, setKeyStatus] = useState<{ totalKeys: number; currentActiveIndex: number } | null>(null);

  const fetchKeyStatus = async () => {
    try {
      const res = await fetch('/api/key-status');
      const data = await res.json();
      if (data.success) {
        setKeyStatus({
          totalKeys: data.totalKeys || 1,
          currentActiveIndex: data.currentActiveIndex || 0,
        });
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchKeyStatus();
    const interval = setInterval(fetchKeyStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeMeta = AI_PROVIDERS[aiConfig.activeProvider || 'gemini'];
  const providerReady = isProviderReady(aiConfig).ready;

  const getProviderIcon = (provider: AiProvider) => {
    switch (provider) {
      case 'gemini':
        return <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
      case 'openai':
        return <Bot className="w-3.5 h-3.5 text-emerald-500" />;
      case 'claude':
        return <Cpu className="w-3.5 h-3.5 text-amber-500" />;
      case 'deepseek':
        return <Zap className="w-3.5 h-3.5 text-cyan-500" />;
      case 'custom':
        return <Globe className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white font-sans">
                StockMeta <span className="text-indigo-600 dark:text-indigo-400">AI</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                SEO Batch
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              Auto Metadata & CSV Generator for Adobe Stock, Shutterstock, Freepik & Getty
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* AI Model & Key Selection Button */}
          <button
            id="ai-settings-btn"
            onClick={onOpenAiSettings}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm ${
              providerReady
                ? 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="Configure AI Engine API Keys & Models (Gemini, ChatGPT, Claude, DeepSeek)"
          >
            <div className="flex items-center space-x-1.5">
              {getProviderIcon(aiConfig.activeProvider || 'gemini')}
              <span className="font-bold">{activeMeta.shortName}</span>
            </div>

            <div className="hidden md:flex items-center space-x-1 text-[11px] text-gray-400 border-l border-gray-200 dark:border-gray-700 pl-2">
              <Key className="w-3 h-3 text-gray-400" />
              <span>{providerReady ? 'Configured' : 'Set Key'}</span>
            </div>

            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {/* API Key Rotation Status Badge (when Gemini is active) */}
          {aiConfig.activeProvider === 'gemini' && keyStatus && keyStatus.totalKeys > 1 && (
            <div
              className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
              title="Multi-Key Rotation Pool Active: Automatically rotates on 429 rate limit"
            >
              <RefreshCw className="w-3 h-3 text-emerald-500" />
              <span>Key Slot #{keyStatus.currentActiveIndex + 1}</span>
            </div>
          )}

          {/* Trademark Blocklist Button */}
          <button
            id="blocklist-btn"
            onClick={onOpenBlocklist}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
              exportSettings.applyBlocklist
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Manage Trademark & Brand Keyword Blocklist"
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">Brand Blocklist</span>
            {exportSettings.customBlocklist.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white rounded-full">
                {exportSettings.customBlocklist.length}
              </span>
            )}
          </button>

          {/* Clear Batch Button */}
          {stats.total > 0 && (
            <button
              id="clear-batch-btn"
              onClick={onClearQueue}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
              title="Clear current batch queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Batch</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition"
            title="Toggle theme mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};

