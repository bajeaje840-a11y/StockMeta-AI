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
  Layers,
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
    <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center space-x-3.5">
          <div className="relative group">
            <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-indigo-950 border border-slate-700/50 dark:border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/10 transition-transform group-hover:scale-105 duration-200">
              <Layers className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-950" />
          </div>

          <div>
            <div className="flex items-center space-x-2.5">
              <span className="text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                StockMeta <span className="text-indigo-600 dark:text-indigo-400">AI</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                PRO STUDIO
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
              Intelligent SEO & Multi-Platform Stock Metadata
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* AI Model & Key Selection Button */}
          <button
            id="ai-settings-btn"
            onClick={onOpenAiSettings}
            className={`group flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-[0.98] ${
              providerReady
                ? 'bg-slate-50 hover:bg-slate-100/90 dark:bg-slate-900 dark:hover:bg-slate-800/90 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shadow-sm shadow-amber-500/10'
            }`}
            title="Configure AI Engine API Keys & Models (Gemini, ChatGPT, Claude, DeepSeek)"
          >
            <div className="flex items-center space-x-1.5">
              <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-200/60 dark:border-slate-700/60">
                {getProviderIcon(aiConfig.activeProvider || 'gemini')}
              </div>
              <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100">{activeMeta.shortName}</span>
            </div>

            <div className="hidden md:flex items-center space-x-1 text-[11px] text-slate-400 dark:text-slate-500 border-l border-slate-200 dark:border-slate-800 pl-2.5">
              <Key className="w-3 h-3" />
              <span className={`font-medium ${providerReady ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {providerReady ? 'Ready' : 'API Key Req.'}
              </span>
            </div>

            <ChevronDown className="w-3 h-3 text-slate-400 transition-transform group-hover:translate-y-0.5" />
          </button>

          {/* API Key Rotation Status Badge (when Gemini is active) */}
          {aiConfig.activeProvider === 'gemini' && keyStatus && keyStatus.totalKeys > 1 && (
            <div
              className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs"
              title="Multi-Key Rotation Pool Active: Automatically rotates on 429 rate limit"
            >
              <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin-slow" />
              <span>Pool #{keyStatus.currentActiveIndex + 1}/{keyStatus.totalKeys}</span>
            </div>
          )}

          {/* Trademark Blocklist Button */}
          <button
            id="blocklist-btn"
            onClick={onOpenBlocklist}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-[0.98] border ${
              exportSettings.applyBlocklist
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100/70 dark:hover:bg-amber-900/50'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Manage Trademark & Brand Keyword Blocklist"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline font-medium">Trademark Filter</span>
            {exportSettings.customBlocklist.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-md">
                {exportSettings.customBlocklist.length}
              </span>
            )}
          </button>

          {/* Clear Batch Button */}
          {stats.total > 0 && (
            <button
              id="clear-batch-btn"
              onClick={onClearQueue}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 border border-rose-200/80 dark:border-rose-900/60 transition-all duration-150 active:scale-[0.98]"
              title="Clear current batch queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {/* Dark Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all duration-150 active:scale-[0.95] shadow-2xs"
            title="Toggle theme mode"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};

