import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Sparkles,
  Bot,
  Cpu,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Sliders,
  Check,
  ShieldCheck,
  HelpCircle,
  FileCode,
} from 'lucide-react';
import { AiConfig, AiProvider } from '../types';
import { AI_PROVIDERS, isProviderReady, saveAiConfig } from '../data/aiModels';
import { testAiKeyDirectly, normalizeGeminiModel } from '../utils/directAiService';

interface AiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AiConfig;
  onSaveConfig: (updated: AiConfig) => void;
  onTriggerBatchAfterSave?: () => void;
  promptReason?: string; // If triggered because a key is missing
}

export const AiKeySettingsModal: React.FC<AiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  aiConfig,
  onSaveConfig,
  onTriggerBatchAfterSave,
  promptReason,
}) => {
  const [formData, setFormData] = useState<AiConfig>(() => ({
    ...aiConfig,
    geminiModel: normalizeGeminiModel(aiConfig.geminiModel),
  }));
  const [activeTab, setActiveTab] = useState<AiProvider>(aiConfig.activeProvider || 'gemini');
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    error?: string;
  }>({ loading: false });

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...aiConfig,
        geminiModel: normalizeGeminiModel(aiConfig.geminiModel),
      });
      setActiveTab(aiConfig.activeProvider || 'gemini');
      setTestStatus({ loading: false });
    }
  }, [isOpen, aiConfig]);

  if (!isOpen) return null;

  const currentProviderMeta = AI_PROVIDERS[activeTab];

  const toggleShowKey = (provider: string) => {
    setShowKeyMap((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const getProviderIcon = (provider: AiProvider) => {
    switch (provider) {
      case 'gemini':
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
      case 'openai':
        return <Bot className="w-4 h-4 text-emerald-500" />;
      case 'claude':
        return <Cpu className="w-4 h-4 text-amber-500" />;
      case 'deepseek':
        return <Zap className="w-4 h-4 text-cyan-500" />;
      case 'custom':
        return <Globe className="w-4 h-4 text-purple-500" />;
    }
  };

  const isConfigured = (p: AiProvider) => {
    return isProviderReady(formData, p).ready;
  };

  // Test connection to backend
  const handleTestConnection = async () => {
    setTestStatus({ loading: true, success: undefined, message: undefined, error: undefined });

    let keyToTest = '';
    let modelToTest = '';
    let baseUrlToTest = '';

    if (activeTab === 'gemini') {
      keyToTest = formData.geminiKey || '';
      modelToTest = formData.geminiModel;
    } else if (activeTab === 'openai') {
      keyToTest = formData.openaiKey || '';
      modelToTest = formData.openaiModel;
      baseUrlToTest = formData.openaiBaseUrl || '';
    } else if (activeTab === 'claude') {
      keyToTest = formData.claudeKey || '';
      modelToTest = formData.claudeModel;
    } else if (activeTab === 'deepseek') {
      keyToTest = formData.deepseekKey || '';
      modelToTest = formData.deepseekModel;
      baseUrlToTest = formData.deepseekBaseUrl || '';
    } else if (activeTab === 'custom') {
      keyToTest = formData.customKey || '';
      modelToTest = formData.customModel || '';
      baseUrlToTest = formData.customBaseUrl || '';
    }

    try {
      let data: any = null;
      let usedServer = false;

      try {
        const res = await fetch('/api/test-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: activeTab,
            apiKey: keyToTest.trim(),
            model: modelToTest,
            baseUrl: baseUrlToTest,
          }),
        });

        const responseText = await res.text();
        if (res.ok) {
          data = JSON.parse(responseText);
          usedServer = true;
        } else if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
          try {
            data = JSON.parse(responseText);
            usedServer = true;
          } catch {
            // fallback to direct client test
          }
        }
      } catch {
        // Server fetch failed, will fallback to direct client test below
      }

      // If server responded with structured result, use it
      if (usedServer && data) {
        if (data.success) {
          setTestStatus({
            loading: false,
            success: true,
            message: data.message || 'API connection verified successfully!',
          });
          return;
        } else {
          setTestStatus({
            loading: false,
            success: false,
            error: data.error || 'Failed to connect. Please check your API key.',
          });
          return;
        }
      }

      // Client-side direct connection test fallback (handles 404/static host/proxy restart gracefully)
      const directResult = await testAiKeyDirectly(
        activeTab,
        keyToTest.trim(),
        modelToTest,
        baseUrlToTest
      );

      setTestStatus({
        loading: false,
        success: directResult.success,
        message: directResult.message,
        error: directResult.error,
      });
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        error: err.message || 'Network error while testing connection.',
      });
    }
  };

  const getActiveKeyValue = () => {
    switch (activeTab) {
      case 'gemini':
        return formData.geminiKey || '';
      case 'openai':
        return formData.openaiKey || '';
      case 'claude':
        return formData.claudeKey || '';
      case 'deepseek':
        return formData.deepseekKey || '';
      case 'custom':
        return formData.customKey || '';
      default:
        return '';
    }
  };

  const getFormatTip = () => {
    const val = getActiveKeyValue().trim();
    if (!val) return null;

    if (activeTab === 'gemini') {
      if (val.startsWith('sk-ant-')) {
        return {
          type: 'warning',
          text: 'This looks like an Anthropic Claude API key (starts with "sk-ant-"). Click the "Claude AI" tab above to use it.',
        };
      }
      if (val.startsWith('sk-')) {
        return {
          type: 'warning',
          text: 'This looks like an OpenAI/DeepSeek key (starts with "sk-"). Click "ChatGPT / OpenAI" or "DeepSeek" tab above.',
        };
      }
      if (!val.startsWith('AIza') && !val.startsWith('AQ.') && !val.startsWith('AQ') && val.length > 5) {
        return {
          type: 'warning',
          text: 'Notice: Google Gemini API keys from Google AI Studio usually start with "AQ." or "AIzaSy...". Please verify your key.',
        };
      }
    } else if (activeTab === 'openai') {
      if (val.startsWith('AIza') || val.startsWith('AQ.')) {
        return {
          type: 'warning',
          text: 'This looks like a Google Gemini key. Click the "Gemini" tab above.',
        };
      }
      if (!val.startsWith('sk-') && val.length > 4) {
        return {
          type: 'warning',
          text: 'Notice: OpenAI API keys usually start with "sk-...".',
        };
      }
    } else if (activeTab === 'claude') {
      if (val.startsWith('AIza') || val.startsWith('AQ.')) {
        return {
          type: 'warning',
          text: 'This looks like a Google Gemini key. Click the "Gemini" tab above.',
        };
      }
      if (!val.startsWith('sk-ant-') && val.length > 5) {
        return {
          type: 'warning',
          text: 'Notice: Anthropic Claude API keys usually start with "sk-ant-...".',
        };
      }
    }
    return null;
  };

  const handleSaveAndApply = (startBatchAfter = false) => {
    const updated = {
      ...formData,
      activeProvider: activeTab,
    };
    saveAiConfig(updated);
    onSaveConfig(updated);
    onClose();

    if (startBatchAfter && onTriggerBatchAfterSave) {
      onTriggerBatchAfterSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                AI Provider & API Keys Configuration
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose your AI engine (Gemini, ChatGPT, Claude, DeepSeek) for microstock SEO metadata generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Missing Key Notification Banner (if triggered during batch start) */}
        {promptReason && (
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
            <span>{promptReason}</span>
          </div>
        )}

        {/* Modal Body with Provider Tabs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Select AI Engine:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((pKey) => {
                const meta = AI_PROVIDERS[pKey];
                const isActive = activeTab === pKey;
                const configured = isConfigured(pKey);

                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => {
                      setActiveTab(pKey);
                      setTestStatus({ loading: false });
                    }}
                    className={`relative p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                      isActive
                        ? 'bg-indigo-500/10 border-indigo-500 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="mb-1.5">{getProviderIcon(pKey)}</div>
                    <span className="text-xs font-bold truncate w-full">{meta.shortName}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {configured ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Ready
                        </span>
                      ) : (
                        <span className="text-amber-500">Key Needed</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Provider Details Card */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2.5">
                {getProviderIcon(activeTab)}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {currentProviderMeta.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {currentProviderMeta.tagline}
                  </p>
                </div>
              </div>

              <a
                href={currentProviderMeta.keyHelpUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-gray-500" />
                  <span>API Key</span>
                  {activeTab === 'gemini' && (
                    <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                      Optional (Server Key Pool Active)
                    </span>
                  )}
                </label>
                <span className="text-[10px] text-gray-400">
                  {currentProviderMeta.keyFormatHint}
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showKeyMap[activeTab] ? 'text' : 'password'}
                  placeholder={currentProviderMeta.keyPlaceholder}
                  value={
                    activeTab === 'gemini'
                      ? formData.geminiKey
                      : activeTab === 'openai'
                      ? formData.openaiKey
                      : activeTab === 'claude'
                      ? formData.claudeKey
                      : activeTab === 'deepseek'
                      ? formData.deepseekKey
                      : formData.customKey || ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeTab === 'gemini') setFormData((p) => ({ ...p, geminiKey: val }));
                    else if (activeTab === 'openai') setFormData((p) => ({ ...p, openaiKey: val }));
                    else if (activeTab === 'claude') setFormData((p) => ({ ...p, claudeKey: val }));
                    else if (activeTab === 'deepseek') setFormData((p) => ({ ...p, deepseekKey: val }));
                    else setFormData((p) => ({ ...p, customKey: val }));
                  }}
                  className="w-full text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 pl-3 pr-16 py-2.5 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />

                <div className="absolute right-2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => toggleShowKey(activeTab)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    title={showKeyMap[activeTab] ? 'Hide API key' : 'Show API key'}
                  >
                    {showKeyMap[activeTab] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Format Hint / Warning */}
              {getFormatTip() && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start space-x-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <span>{getFormatTip()?.text}</span>
                </div>
              )}

              {/* Quick Gemini Guidance Card */}
              {activeTab === 'gemini' && (
                <div className="p-3 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>How to get a Free Google Gemini API Key:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-gray-700 dark:text-gray-300 pl-1">
                    <li>
                      Visit{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 dark:text-indigo-400 font-semibold underline"
                      >
                        Google AI Studio API Keys
                      </a>
                    </li>
                    <li>Click <strong>&quot;Create API Key&quot;</strong> in your project.</li>
                    <li>Copy your key (starts with <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono text-indigo-700 dark:text-indigo-300">AQ.</code> or <code className="bg-indigo-100 dark:bg-indigo-900/60 px-1 py-0.5 rounded font-mono text-indigo-700 dark:text-indigo-300">AIzaSy...</code>) and paste it above.</li>
                  </ol>
                </div>
              )}
            </div>

            {/* Model Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Choose Model:
              </label>
              <select
                value={
                  activeTab === 'gemini'
                    ? formData.geminiModel
                    : activeTab === 'openai'
                    ? formData.openaiModel
                    : activeTab === 'claude'
                    ? formData.claudeModel
                    : activeTab === 'deepseek'
                    ? formData.deepseekModel
                    : formData.customModel || ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeTab === 'gemini') setFormData((p) => ({ ...p, geminiModel: val }));
                  else if (activeTab === 'openai') setFormData((p) => ({ ...p, openaiModel: val }));
                  else if (activeTab === 'claude') setFormData((p) => ({ ...p, claudeModel: val }));
                  else if (activeTab === 'deepseek') setFormData((p) => ({ ...p, deepseekModel: val }));
                  else setFormData((p) => ({ ...p, customModel: val }));
                }}
                className="w-full text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-gray-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                {currentProviderMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.recommended ? '⭐ (Recommended)' : ''} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Custom Base URL for DeepSeek, OpenRouter, Custom */}
            {(activeTab === 'deepseek' || activeTab === 'custom' || activeTab === 'openai') && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center justify-between">
                  <span>Custom API Base URL (Optional)</span>
                  <span className="text-[10px] text-gray-400">Leave blank for default API</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    activeTab === 'deepseek'
                      ? 'https://api.deepseek.com'
                      : activeTab === 'custom'
                      ? 'https://openrouter.ai/api/v1 or http://localhost:11434/v1'
                      : 'https://api.openai.com/v1'
                  }
                  value={
                    activeTab === 'deepseek'
                      ? formData.deepseekBaseUrl || ''
                      : activeTab === 'openai'
                      ? formData.openaiBaseUrl || ''
                      : formData.customBaseUrl || ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeTab === 'deepseek') setFormData((p) => ({ ...p, deepseekBaseUrl: val }));
                    else if (activeTab === 'openai') setFormData((p) => ({ ...p, openaiBaseUrl: val }));
                    else setFormData((p) => ({ ...p, customBaseUrl: val }));
                  }}
                  className="w-full text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus.loading}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition shadow-sm"
                >
                  {testStatus.loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Testing Connection...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Test {currentProviderMeta.shortName} Connection</span>
                    </>
                  )}
                </button>
              </div>

              {testStatus.success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
                  <div>
                    <span className="font-bold">Connection Successful! </span>
                    <span>{testStatus.message}</span>
                  </div>
                </div>
              )}

              {testStatus.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2.5 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                  <div>
                    <span className="font-bold">Connection Failed: </span>
                    <span>{testStatus.error}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Microstock Marketplace Generation Settings */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/80 space-y-4">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              Microstock SEO Output Preferences
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Keyword Count */}
              <div>
                <div className="flex justify-between items-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <span>Target Keyword Count:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {formData.keywordCount || 49} tags {formData.keywordCount === 49 ? '(Adobe Stock Optimal)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="49"
                  step="1"
                  value={formData.keywordCount || 49}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, keywordCount: parseInt(e.target.value, 10) }))
                  }
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>25 tags (Min)</span>
                  <span>35 tags</span>
                  <span className="font-semibold text-indigo-500">49 tags (Adobe Stock Max)</span>
                </div>
              </div>

              {/* Custom Guidance Instructions */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Prompt Guidance (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g., Focus on 3D illustration, pastel background, copy space"
                  value={formData.customInstructions || ''}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, customInstructions: e.target.value }))
                  }
                  className="w-full text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span>Active Engine:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {AI_PROVIDERS[activeTab].name}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndApply(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition"
            >
              Save Configuration
            </button>

            {promptReason && (
              <button
                type="button"
                onClick={() => handleSaveAndApply(true)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition"
              >
                Save & Start Processing
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
