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
        return <Sparkles className="w-3.5 h-3.5 text-zinc-100 dark:text-zinc-200" />;
      case 'openai':
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      case 'claude':
        return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
      case 'deepseek':
        return <Zap className="w-3.5 h-3.5 text-sky-400" />;
      case 'custom':
        return <Globe className="w-3.5 h-3.5 text-zinc-300" />;
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-semibold shadow-xs">
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>

          <div className="flex items-center space-x-2.5">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              StockMeta <span className="text-zinc-500 dark:text-zinc-400 font-normal">AI</span>
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-white/[0.06] font-mono">
              STUDIO
            </span>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center space-x-2">
          {/* AI Model & Key Selection Button */}
          <button
            id="ai-settings-btn"
            onClick={onOpenAiSettings}
            className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 active:scale-[0.98] ${
              providerReady
                ? 'bg-zinc-100/80 hover:bg-zinc-100 dark:bg-zinc-900/80 dark:hover:bg-zinc-850 border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
            title="Configure AI Engine API Keys & Models"
          >
            <div className="flex items-center space-x-1.5">
              {getProviderIcon(aiConfig.activeProvider || 'gemini')}
              <span className="font-semibold tracking-tight">{activeMeta.shortName}</span>
            </div>

            <div className="hidden sm:flex items-center space-x-1 text-[11px] text-zinc-400 dark:text-zinc-500 border-l border-zinc-200 dark:border-white/[0.08] pl-2">
              <span className={`w-1.5 h-1.5 rounded-full ${providerReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-mono text-[10px]">
                {providerReady ? 'READY' : 'KEY REQ'}
              </span>
            </div>

            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {/* API Key Rotation Status Badge */}
          {aiConfig.activeProvider === 'gemini' && keyStatus && keyStatus.totalKeys > 1 && (
            <div
              className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.08]"
              title="Multi-Key Rotation Pool Active"
            >
              <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin-slow" />
              <span className="font-mono text-[10px]">Pool #{keyStatus.currentActiveIndex + 1}/{keyStatus.totalKeys}</span>
            </div>
          )}

          {/* Trademark Blocklist Button */}
          <button
            id="blocklist-btn"
            onClick={onOpenBlocklist}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98] border ${
              exportSettings.applyBlocklist
                ? 'bg-zinc-100 hover:bg-zinc-150 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/[0.08]'
                : 'bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 border-transparent'
            }`}
            title="Trademark & Brand Keyword Blocklist"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400" />
            <span className="hidden md:inline">Sanitizer</span>
            {exportSettings.customBlocklist.length > 0 && (
              <span className="px-1 py-0.2 text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded">
                {exportSettings.customBlocklist.length}
              </span>
            )}
          </button>

          {/* Clear Batch Button */}
          {stats.total > 0 && (
            <button
              id="clear-batch-btn"
              onClick={onClearQueue}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200/50 dark:hover:border-rose-900/40 transition-all duration-150 active:scale-[0.98]"
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
            className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-white/[0.08] transition-all duration-150 active:scale-[0.95]"
            title="Toggle theme mode"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

