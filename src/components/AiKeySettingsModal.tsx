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
  promptReason?: string;
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
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'openai':
        return <Bot className="w-3.5 h-3.5" />;
      case 'claude':
        return <Cpu className="w-3.5 h-3.5" />;
      case 'deepseek':
        return <Zap className="w-3.5 h-3.5" />;
      case 'custom':
        return <Globe className="w-3.5 h-3.5" />;
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
            // fallback
          }
        }
      } catch {
        // Fallback
      }

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
          text: 'This looks like an Anthropic Claude API key. Select the Claude AI tab above.',
        };
      }
      if (val.startsWith('sk-')) {
        return {
          type: 'warning',
          text: 'This looks like an OpenAI/DeepSeek key. Select the ChatGPT or DeepSeek tab.',
        };
      }
      if (val.startsWith('AQ.') || val.startsWith('AQ') || val.startsWith('AIza')) {
        return {
          type: 'info',
          text: 'Google Gemini API key format detected. Click "Test Connection" to verify.',
        };
      }
    } else if (activeTab === 'openai') {
      if (val.startsWith('AIza') || val.startsWith('AQ.')) {
        return {
          type: 'warning',
          text: 'This looks like a Google Gemini key. Select the Gemini tab above.',
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
          text: 'This looks like a Google Gemini key. Select the Gemini tab above.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-white/[0.06]">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI Engine & Keys
              </h2>
              <p className="text-[11px] text-zinc-500">
                Configure AI vision providers for stock metadata generation
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

        {/* Missing Key Notification Banner */}
        {promptReason && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center space-x-2 text-amber-600 dark:text-amber-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{promptReason}</span>
          </div>
        )}

        {/* Modal Body with Provider Tabs */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Select Provider:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
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
                    className={`relative p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-500 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'bg-zinc-50/60 dark:bg-zinc-900/40 border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850'
                    }`}
                  >
                    <div className="mb-1 text-zinc-700 dark:text-zinc-300">{getProviderIcon(pKey)}</div>
                    <span className="text-xs font-medium truncate w-full">{meta.shortName}</span>
                    <span className="text-[9.5px] mt-0.5">
                      {configured ? (
                        <span className="text-emerald-500 flex items-center justify-center gap-0.5">
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
          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.06] space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-white/[0.06]">
              <div className="flex items-center space-x-2">
                <div className="text-zinc-700 dark:text-zinc-300">{getProviderIcon(activeTab)}</div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {currentProviderMeta.name}
                  </h3>
                  <p className="text-[10.5px] text-zinc-500">
                    {currentProviderMeta.tagline}
                  </p>
                </div>
              </div>

              <a
                href={currentProviderMeta.keyHelpUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 text-xs text-zinc-700 dark:text-zinc-300 hover:underline font-medium"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-zinc-400" />
                  <span>API Key</span>
                  {activeTab === 'gemini' && (
                    <span className="text-[9.5px] font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Optional (Server AI Available)
                    </span>
                  )}
                </label>
                {activeTab === 'gemini' && formData.geminiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((p) => ({ ...p, geminiKey: '' }));
                      setTestStatus({
                        loading: false,
                        success: true,
                        message: 'Switched to Built-in Server Gemini AI.',
                      });
                    }}
                    className="text-[10.5px] text-emerald-500 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>⚡ Use Free Server AI</span>
                  </button>
                )}
                {activeTab !== 'gemini' && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    {currentProviderMeta.keyFormatHint}
                  </span>
                )}
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
                  className="w-full text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] pl-3 pr-10 py-2 text-zinc-900 dark:text-zinc-100 font-mono placeholder-zinc-400 focus:outline-none focus:border-zinc-500 transition-all"
                />

                <div className="absolute right-2 flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleShowKey(activeTab)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    title={showKeyMap[activeTab] ? 'Hide API key' : 'Show API key'}
                  >
                    {showKeyMap[activeTab] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Format Hint / Warning */}
              {getFormatTip() && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] flex items-start space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{getFormatTip()?.text}</span>
                </div>
              )}

              {/* Quick Gemini Guidance Card */}
              {activeTab === 'gemini' && (
                <div className="p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.06] text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-zinc-400" />
                    <span>Google Gemini Option:</span>
                  </div>
                  <ul className="space-y-0.5 pl-1 list-disc list-inside">
                    <li>
                      <span className="font-medium text-emerald-500">Zero-Config:</span> Leave blank to use server environment.
                    </li>
                    <li>
                      Or get your custom key from{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-900 dark:text-zinc-100 underline"
                      >
                        Google AI Studio
                      </a>{' '}
                      and paste above.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Model Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
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
                className="w-full text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] px-2.5 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                {currentProviderMeta.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.recommended ? '⭐ (Recommended)' : ''} - {m.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Optional Custom Base URL */}
            {(activeTab === 'deepseek' || activeTab === 'custom' || activeTab === 'openai') && (
              <div className="space-y-1.5 pt-0.5">
                <label className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                  <span>Custom API Base URL (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    activeTab === 'deepseek'
                      ? 'https://api.deepseek.com'
                      : activeTab === 'custom'
                      ? 'https://openrouter.ai/api/v1'
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
                  className="w-full text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
                />
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.loading}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-all border border-zinc-200 dark:border-white/[0.06] cursor-pointer"
              >
                {testStatus.loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3 text-zinc-400" />
                    <span>Test {currentProviderMeta.shortName} Connection</span>
                  </>
                )}
              </button>

              {testStatus.success && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Verified: </span>
                    <span>{testStatus.message}</span>
                  </div>
                </div>
              )}

              {testStatus.error && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start space-x-2 text-xs text-rose-500">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Failed: </span>
                    <span>{testStatus.error}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Microstock Settings */}
          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.06] space-y-3">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              SEO Tuning
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Keyword Count */}
              <div>
                <div className="flex justify-between items-center text-xs text-zinc-700 dark:text-zinc-300 mb-1">
                  <span>Target Tag Count:</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                    {formData.keywordCount || 49} tags
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
                  className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                />
                <div className="flex justify-between text-[9.5px] font-mono text-zinc-400 mt-0.5">
                  <span>25</span>
                  <span>35</span>
                  <span className="font-semibold">49</span>
                </div>
              </div>

              {/* Custom Guidance Instructions */}
              <div>
                <label className="block text-xs text-zinc-700 dark:text-zinc-300 mb-1">
                  Custom Prompt Guidance (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3D isometric, copy space, high contrast"
                  value={formData.customInstructions || ''}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, customInstructions: e.target.value }))
                  }
                  className="w-full text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] px-2.5 py-1.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-white/[0.08] bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-xs flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500 flex items-center gap-1">
            <span>Engine:</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {AI_PROVIDERS[activeTab].name}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleSaveAndApply(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg text-white dark:text-zinc-950 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Save Configuration
            </button>

            {promptReason && (
              <button
                type="button"
                onClick={() => handleSaveAndApply(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 transition-all cursor-pointer"
              >
                Save & Start
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
