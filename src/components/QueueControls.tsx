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
        return <Sparkles className="w-3.5 h-3.5 text-zinc-300" />;
      case 'openai':
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      case 'claude':
        return <Cpu className="w-3.5 h-3.5 text-amber-400" />;
      case 'deepseek':
        return <Zap className="w-3.5 h-3.5 text-sky-400" />;
      case 'custom':
        return <Globe className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getActiveModelName = () => {
    const p = aiConfig.activeProvider || 'gemini';
    if (p === 'gemini') return aiConfig.geminiModel || 'Gemini 3.5 Flash Lite';
    if (p === 'openai') return aiConfig.openaiModel || 'GPT-4o Mini';
    if (p === 'claude') return aiConfig.claudeModel || 'Claude 3.5 Haiku';
    if (p === 'deepseek') return aiConfig.deepseekModel || 'DeepSeek Chat';
    return aiConfig.customModel || 'Custom AI';
  };

  return (
    <div className="w-full bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-xl p-4 sm:p-5 space-y-4 transition-all shadow-xs">
      {/* Top Row: Refined Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {/* Total */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Assets</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">{stats.total}</span>
            <span className="text-[10px] font-mono text-zinc-400 uppercase">items</span>
          </div>
        </div>

        {/* Queued */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Queued</span>
            <Clock className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-zinc-700 dark:text-zinc-300">{stats.queued}</span>
            <span className="text-[10px] font-mono text-zinc-400">waiting</span>
          </div>
        </div>

        {/* Processing */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Processing</span>
            <Loader2 className={`w-3.5 h-3.5 text-sky-500 ${stats.processing > 0 ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-sky-600 dark:text-sky-400">{stats.processing}</span>
            <span className="text-[10px] font-mono text-zinc-400">active</span>
          </div>
        </div>

        {/* Success */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">{stats.success}</span>
            <span className="text-[10px] font-mono text-zinc-400">ready</span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Errors</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400">{stats.failed}</span>
            <span className="text-[10px] font-mono text-zinc-400">failed</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/[0.06] rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Paused</span>
            <XCircle className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold font-mono tracking-tight text-zinc-600 dark:text-zinc-400">{stats.cancelled}</span>
            <span className="text-[10px] font-mono text-zinc-400">idle</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Batch Actions & Concurrency Controller */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
        {/* Left Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {queueState === 'running' ? (
            <button
              id="pause-queue-btn"
              onClick={onPause}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause Batch</span>
            </button>
          ) : (
            <button
              id="start-resume-btn"
              onClick={onStartResume}
              disabled={stats.queued === 0 && stats.failed === 0}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{queueState === 'paused' ? 'Resume Processing' : 'Generate Metadata'}</span>
            </button>
          )}

          {/* AI Engine Badge Pill */}
          <button
            onClick={onOpenAiSettings}
            className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150 active:scale-[0.98] cursor-pointer ${
              providerReady
                ? 'bg-zinc-100/80 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-zinc-200 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
            title="Configure AI Engine"
          >
            {getProviderIcon(aiConfig.activeProvider || 'gemini')}
            <span className="text-zinc-400 font-normal">AI:</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {activeMeta.shortName}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
              ({getActiveModelName()})
            </span>
            {!providerReady && (
              <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500 text-white">
                KEY REQ
              </span>
            )}
          </button>

          {/* Cancel All */}
          {(queueState === 'running' || stats.processing > 0) && (
            <button
              id="cancel-all-btn"
              onClick={onCancelAll}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {/* Retry Failed */}
          {stats.failed > 0 && (
            <button
              id="retry-failed-btn"
              onClick={onRetryFailed}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Errors ({stats.failed})</span>
            </button>
          )}
        </div>

        {/* Right Concurrency Controller */}
        <div className="flex items-center space-x-2 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Workers:</span>
          <div className="flex items-center space-x-1 bg-white dark:bg-zinc-950 p-0.5 rounded border border-zinc-200 dark:border-white/[0.08]">
            {[1, 3, 5, 8].map((val) => (
              <button
                key={val}
                onClick={() => onConcurrencyChange(val)}
                className={`px-1.5 py-0.5 text-[11px] font-mono font-medium rounded transition-all cursor-pointer ${
                  concurrency === val
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {val}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Export & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2 border-t border-zinc-100 dark:border-white/[0.06]">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search filename, title or tags..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-white/[0.2] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200/80 dark:border-white/[0.06]">
            {['all', 'success', 'processing', 'queued', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => onFilterStatusChange(st)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded capitalize transition-all cursor-pointer ${
                  filterStatus === st
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
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
              className="appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100 text-xs font-medium rounded-lg pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-zinc-400 cursor-pointer"
            >
              {Object.values(PLATFORM_CONFIGS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Settings Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-1.5 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-white/[0.08] rounded-lg transition-all cursor-pointer"
              title="CSV Options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.1] rounded-xl shadow-xl z-30 p-3.5 text-xs space-y-3 animate-fade-in">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100 pb-1.5 border-b border-zinc-100 dark:border-white/[0.06]">
                  CSV Export Options
                </div>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.autoRename}
                    onChange={(e) =>
                      onUpdateExportSettings({ autoRename: e.target.checked })
                    }
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">
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
                    className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-500"
                  />
                  <span className="text-zinc-700 dark:text-zinc-300 font-medium">
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
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer"
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
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] cursor-pointer"
            title="Export CSVs for all platforms in a ZIP"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export All (ZIP)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

