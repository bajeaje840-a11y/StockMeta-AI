import React, { useState } from 'react';
import {
  Play,
  Pause,
  XCircle,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Archive,
  Sliders,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronDown,
  Settings,
  Sparkles,
  Key,
  Bot,
  Cpu,
  Zap,
  Globe,
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
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-5 mb-6 space-y-5 transition-colors">
      {/* Top Row: Live Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Items</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</span>
            <span className="text-xs text-gray-400">files</span>
          </div>
        </div>

        {/* Queued */}
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Queued</span>
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.queued}</span>
            <span className="text-xs text-blue-400">waiting</span>
          </div>
        </div>

        {/* Processing */}
        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">In Progress</span>
            <Loader2 className={`w-3.5 h-3.5 text-indigo-500 ${stats.processing > 0 ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{stats.processing}</span>
            <span className="text-xs text-indigo-400">active</span>
          </div>
        </div>

        {/* Success */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Success</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{stats.success}</span>
            <span className="text-xs text-emerald-400">ready</span>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Failed</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-rose-700 dark:text-rose-300">{stats.failed}</span>
            <span className="text-xs text-rose-400">errors</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Cancelled</span>
            <XCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.cancelled}</span>
            <span className="text-xs text-amber-400">stopped</span>
          </div>
        </div>
      </div>

      {/* Middle Row: Batch Actions & Concurrency Slider */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
        {/* Left Queue Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {queueState === 'running' ? (
            <button
              id="pause-queue-btn"
              onClick={onPause}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition shadow-sm"
            >
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause Batch Queue</span>
            </button>
          ) : (
            <button
              id="start-resume-btn"
              onClick={onStartResume}
              disabled={stats.queued === 0 && stats.failed === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{queueState === 'paused' ? 'Resume Processing' : 'Generate AI Metadata'}</span>
            </button>
          )}

          {/* AI Engine Badge Pill with quick settings link */}
          <button
            onClick={onOpenAiSettings}
            className={`inline-flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              providerReady
                ? 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Click to switch AI model or configure API keys"
          >
            {getProviderIcon(aiConfig.activeProvider || 'gemini')}
            <span>Engine:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {activeMeta.shortName}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
              ({getActiveModelName()})
            </span>
            {!providerReady && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-white">
                Key Needed
              </span>
            )}
          </button>

          {/* Cancel All */}
          {(queueState === 'running' || stats.processing > 0) && (
            <button
              id="cancel-all-btn"
              onClick={onCancelAll}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
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
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Failed ({stats.failed})</span>
            </button>
          )}
        </div>

        {/* Right Concurrency Controller */}
        <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800/80 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <Sliders className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Concurrency:</span>
          <div className="flex items-center space-x-1">
            {[1, 3, 5, 8].map((val) => (
              <button
                key={val}
                onClick={() => onConcurrencyChange(val)}
                className={`px-2 py-0.5 text-xs font-bold rounded-md transition ${
                  concurrency === val
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {val}x
              </button>
            ))}
          </div>
          <span className="text-[11px] text-gray-400 hidden lg:inline">
            (Parallel requests)
          </span>
        </div>
      </div>

      {/* Bottom Export & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
        {/* Search & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename, title or keywords..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Status Pills */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
            {['all', 'success', 'processing', 'queued', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => onFilterStatusChange(st)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition ${
                  filterStatus === st
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
              className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-semibold rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              {Object.values(PLATFORM_CONFIGS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-gray-400 pointer-events-none" />
          </div>

          {/* Settings / Options Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl transition"
              title="CSV Export Options"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettingsDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 p-3 text-xs space-y-3">
                <div className="font-semibold text-gray-900 dark:text-white pb-1 border-b border-gray-100 dark:border-gray-700">
                  CSV Export Options
                </div>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.autoRename}
                    onChange={(e) =>
                      onUpdateExportSettings({ autoRename: e.target.checked })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    Auto-rename filenames using title slug
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.applyBlocklist}
                    onChange={(e) =>
                      onUpdateExportSettings({ applyBlocklist: e.target.checked })
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
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
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 transition"
            title={`Export CSV for ${currentPlatformConfig.name}`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export {currentPlatformConfig.name} CSV</span>
          </button>

          {/* Export All Platforms as ZIP */}
          <button
            id="export-zip-btn"
            onClick={onExportAllPlatformsZip}
            disabled={stats.success === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="Export CSVs for Adobe, Shutterstock, Freepik, and all other platforms in a ZIP"
          >
            <Archive className="w-4 h-4" />
            <span className="hidden sm:inline">Export All Platforms (ZIP)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

