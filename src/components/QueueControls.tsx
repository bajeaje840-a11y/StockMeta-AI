import React, { useState } from 'react';
import {
  Play,
  Pause,
  XCircle,
  RotateCcw,
  FileSpreadsheet,
  Archive,
  Sliders,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronDown,
  Settings2,
  Sparkles,
  Bot,
  Cpu,
  Zap,
  Globe,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AiConfig, AiProvider, ExportSettings, PlatformId, QueueStats } from '../types';
import { PLATFORM_CONFIGS } from '../data/platforms';
import { AI_PROVIDERS, isProviderReady } from '../data/aiModels';

interface QueueControlsProps {
  stats: QueueStats;
  queueState: 'idle' | 'running' | 'paused' | 'cancelled';
  concurrency: number;
  onConcurrencyChange: (val: number) => void;
  onStartResume: () => void;
  onPause: () => void;
  onCancelAll: () => void;
  onRetryFailed: () => void;
  exportSettings: ExportSettings;
  onUpdateExportSettings: (newSettings: Partial<ExportSettings>) => void;
  onExportCurrentPlatformCSV: () => void;
  onExportAllPlatformsZip: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  aiConfig: AiConfig;
  onOpenAiSettings: () => void;
}

export const QueueControls: React.FC<QueueControlsProps> = ({
  stats,
  queueState,
  concurrency,
  onConcurrencyChange,
  onStartResume,
  onPause,
  onCancelAll,
  onRetryFailed,
  exportSettings,
  onUpdateExportSettings,
  onExportCurrentPlatformCSV,
  onExportAllPlatformsZip,
  searchQuery,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  aiConfig,
  onOpenAiSettings,
}) => {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const currentPlatformConfig = PLATFORM_CONFIGS[exportSettings.selectedPlatform];
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

  const getActiveModelName = () => {
    const p = aiConfig.activeProvider || 'gemini';
    if (p === 'gemini') return aiConfig.geminiModel || 'Gemini 2.5 Flash';
    if (p === 'openai') return aiConfig.openaiModel || 'GPT-4o Mini';
    if (p === 'claude') return aiConfig.claudeModel || 'Claude 3.5 Haiku';
    if (p === 'deepseek') return aiConfig.deepseekModel || 'DeepSeek Chat';
    return aiConfig.customModel || 'Custom AI';
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs p-5 space-y-5 transition-all">
      {/* Top Row: Refined Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
        {/* Total */}
        <div className="bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/70 dark:border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Batch</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">{stats.total}</span>
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">files</span>
          </div>
        </div>

        {/* Queued */}
        <div className="bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200/70 dark:border-sky-900/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">Queued</span>
            <Clock className="w-3.5 h-3.5 text-sky-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-sky-800 dark:text-sky-200">{stats.queued}</span>
            <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400">waiting</span>
          </div>
        </div>

        {/* Processing */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/70 dark:border-indigo-900/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">In Progress</span>
            <Loader2 className={`w-3.5 h-3.5 text-indigo-500 ${stats.processing > 0 ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-indigo-800 dark:text-indigo-200">{stats.processing}</span>
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">active</span>
          </div>
        </div>

        {/* Success */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-emerald-800 dark:text-emerald-200">{stats.success}</span>
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">ready</span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200/70 dark:border-rose-900/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Failed</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-rose-800 dark:text-rose-200">{stats.failed}</span>
            <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">errors</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Paused/Stopped</span>
            <XCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-amber-800 dark:text-amber-200">{stats.cancelled}</span>
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">idle</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Batch Actions & Concurrency Controller */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {queueState === 'running' ? (
            <button
              id="pause-queue-btn"
              onClick={onPause}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300/80 dark:border-amber-800/60 transition-all duration-150 active:scale-[0.98] shadow-2xs"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause Batch</span>
            </button>
          ) : (
            <button
              id="start-resume-btn"
              onClick={onStartResume}
              disabled={stats.queued === 0 && stats.failed === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-600/25 transition-all duration-150 active:scale-[0.98]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{queueState === 'paused' ? 'Resume Processing' : 'Generate AI Metadata'}</span>
            </button>
          )}

          {/* AI Engine Badge Pill with quick settings link */}
          <button
            onClick={onOpenAiSettings}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] ${
              providerReady
                ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Click to switch AI model or configure API keys"
          >
            {getProviderIcon(aiConfig.activeProvider || 'gemini')}
            <span className="text-slate-400 dark:text-slate-500 font-normal">Engine:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {activeMeta.shortName}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
              ({getActiveModelName()})
            </span>
            {!providerReady && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white">
                Key Req.
              </span>
            )}
          </button>

          {/* Cancel All */}
          {(queueState === 'running' || stats.processing > 0) && (
            <button
              id="cancel-all-btn"
              onClick={onCancelAll}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-all duration-150 active:scale-[0.98]"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel All</span>
            </button>
          )}

          {/* Retry Failed */}
          {stats.failed > 0 && (
            <button
              id="retry-failed-btn"
              onClick={onRetryFailed}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300/80 dark:border-amber-800/60 transition-all duration-150 active:scale-[0.98]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Errors ({stats.failed})</span>
            </button>
          )}
        </div>

        {/* Right Concurrency Controller */}
        <div className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-950/50 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <Sliders className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Threads:</span>
          <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
            {[1, 3, 5, 8].map((val) => (
              <button
                key={val}
                onClick={() => onConcurrencyChange(val)}
                className={`px-2 py-0.5 text-xs font-bold font-mono rounded-md transition-all ${
                  concurrency === val
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {val}x
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 hidden lg:inline">
            parallel
          </span>
        </div>
      </div>

      {/* Bottom Export & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search filename, title or tags..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
            {['all', 'success', 'processing', 'queued', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => onFilterStatusChange(st)}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${
                  filterStatus === st
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Marketplace CSV Exporters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform Selector */}
          <div className="relative">
            <select
              id="platform-select"
              value={exportSettings.selectedPlatform}
              onChange={(e) =>
                onUpdateExportSettings({ selectedPlatform: e.target.value as PlatformId })
              }
              className="appearance-none bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              {Object.values(PLATFORM_CONFIGS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Settings / Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-2xs active:scale-[0.95]"
              title="CSV Export Options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-3.5 text-xs space-y-3 animate-fade-in">
                <div className="font-semibold text-slate-900 dark:text-white pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  CSV Export Configuration
                </div>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.autoRename}
                    onChange={(e) =>
                      onUpdateExportSettings({ autoRename: e.target.checked })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Auto-rename filename using title slug
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.applyBlocklist}
                    onChange={(e) =>
                      onUpdateExportSettings({ applyBlocklist: e.target.checked })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    Filter out trademarked keywords
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Primary CSV Export Button */}
          <button
            id="export-csv-btn"
            onClick={onExportCurrentPlatformCSV}
            disabled={stats.success === 0}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-600/25 transition-all duration-150 active:scale-[0.98]"
            title={`Export CSV for ${currentPlatformConfig.name}`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export {currentPlatformConfig.name} CSV</span>
          </button>

          {/* Export All Platforms as ZIP */}
          <button
            id="export-zip-btn"
            onClick={onExportAllPlatformsZip}
            disabled={stats.success === 0}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
            title="Export CSVs for Adobe, Shutterstock, Freepik, and all other platforms in a ZIP"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export All (ZIP)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

