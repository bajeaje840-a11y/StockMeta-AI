import { AiConfig, AiModelOption, AiProvider } from '../types';

export interface ProviderMeta {
  id: AiProvider;
  name: string;
  shortName: string;
  tagline: string;
  badgeColor: string;
  borderColor: string;
  logoIcon: string; // lucide or identifier
  keyPlaceholder: string;
  keyHelpUrl: string;
  keyFormatHint: string;
  defaultModel: string;
  models: AiModelOption[];
  requiresApiKey: boolean;
}

export const AI_PROVIDERS: Record<AiProvider, ProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    tagline: 'High-speed multimodal vision & SEO metadata generator',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    borderColor: 'border-indigo-500/40',
    logoIcon: 'Sparkles',
    keyPlaceholder: 'AIzaSy...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyFormatHint: 'Free/Paid key starting with "AIzaSy..." from Google AI Studio',
    defaultModel: 'gemini-2.5-flash',
    requiresApiKey: false, // Can fall back to server rotation pool
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        description: 'Ultra-fast, high-precision stock vision & keyword ranking',
        isVisionCapable: true,
        recommended: true,
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        description: 'Advanced reasoning for complex commercial subjects & deep tagging',
        isVisionCapable: true,
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        description: 'Reliable, lightweight multimodal model for high volume batches',
        isVisionCapable: true,
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'gemini',
        description: 'High context window vision analysis',
        isVisionCapable: true,
      },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    shortName: 'ChatGPT / OpenAI',
    tagline: 'GPT-4o Vision for commercial stock title & keyword ranking',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    borderColor: 'border-emerald-500/40',
    logoIcon: 'Bot',
    keyPlaceholder: 'sk-proj-... or sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyFormatHint: 'Secret key starting with "sk-..." from OpenAI Platform',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    models: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        description: 'Fast, cost-effective vision model for bulk stock indexing',
        isVisionCapable: true,
        recommended: true,
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        provider: 'openai',
        description: 'State-of-the-art vision understanding and precise commercial copy',
        isVisionCapable: true,
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo Vision',
        provider: 'openai',
        description: 'High-accuracy detailed vision metadata generation',
        isVisionCapable: true,
      },
    ],
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude AI',
    tagline: 'Claude 3.5 Sonnet & Haiku with nuanced visual interpretation',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/40',
    logoIcon: 'Cpu',
    keyPlaceholder: 'sk-ant-api03-...',
    keyHelpUrl: 'https://console.anthropic.com/settings/keys',
    keyFormatHint: 'API Key starting with "sk-ant-..." from Anthropic Console',
    defaultModel: 'claude-3-5-haiku-20241022',
    requiresApiKey: true,
    models: [
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: 'claude',
        description: 'Lightning-fast vision model with high rate limits',
        isVisionCapable: true,
        recommended: true,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'claude',
        description: 'Top-tier vision model for artistic, conceptual & commercial imagery',
        isVisionCapable: true,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: 'claude',
        description: 'Deep comprehensive conceptual tagging and descriptive depth',
        isVisionCapable: true,
      },
    ],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek AI',
    shortName: 'DeepSeek',
    tagline: 'DeepSeek Chat & Vision via official API or SiliconFlow / OpenRouter',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    borderColor: 'border-cyan-500/40',
    logoIcon: 'Zap',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.deepseek.com/api_keys',
    keyFormatHint: 'API key from DeepSeek Platform or OpenRouter/SiliconFlow proxy',
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat (V3)',
        provider: 'deepseek',
        description: 'High-speed reasoning, generates rich keyword arrays and stock SEO',
        isVisionCapable: true,
        recommended: true,
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner (R1)',
        provider: 'deepseek',
        description: 'Deep chain-of-thought analysis for complex vector & photo subjects',
        isVisionCapable: false,
      },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom / OpenRouter / Ollama',
    shortName: 'Custom API',
    tagline: 'OpenAI-compatible endpoint (OpenRouter, Groq, Together, Ollama, LM Studio)',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500/40',
    logoIcon: 'Globe',
    keyPlaceholder: 'sk-or-... or custom-key',
    keyHelpUrl: 'https://openrouter.ai/keys',
    keyFormatHint: 'Custom API key or OpenRouter / Groq / Local endpoint token',
    defaultModel: 'meta-llama/llama-3.2-11b-vision-instruct',
    requiresApiKey: false,
    models: [
      {
        id: 'meta-llama/llama-3.2-11b-vision-instruct',
        name: 'Llama 3.2 11B Vision',
        provider: 'custom',
        description: 'OpenRouter vision model for stock asset categorization',
        isVisionCapable: true,
        recommended: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini (Proxy)',
        provider: 'custom',
        description: 'Custom proxy / gateway endpoint',
        isVisionCapable: true,
      },
    ],
  },
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  activeProvider: 'gemini',
  geminiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiBaseUrl: '',
  claudeKey: '',
  claudeModel: 'claude-3-5-haiku-20241022',
  deepseekKey: '',
  deepseekModel: 'deepseek-chat',
  deepseekBaseUrl: 'https://api.deepseek.com',
  customKey: '',
  customModel: 'meta-llama/llama-3.2-11b-vision-instruct',
  customBaseUrl: 'https://openrouter.ai/api/v1',
  keywordCount: 40,
  customInstructions: '',
};

const STORAGE_KEY = 'stockmeta_ai_config_v2';

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AI_CONFIG, ...parsed };
  } catch (e) {
    return DEFAULT_AI_CONFIG;
  }
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save AI config to localStorage:', e);
  }
}

export function isProviderReady(config: AiConfig, provider?: AiProvider): { ready: boolean; reason?: string } {
  const p = provider || config.activeProvider;
  if (p === 'gemini') {
    // Gemini can use server key pool or user key
    return { ready: true };
  }
  if (p === 'openai') {
    if (!config.openaiKey?.trim()) {
      return { ready: false, reason: 'OpenAI API key is required.' };
    }
    return { ready: true };
  }
  if (p === 'claude') {
    if (!config.claudeKey?.trim()) {
      return { ready: false, reason: 'Anthropic Claude API key is required.' };
    }
    return { ready: true };
  }
  if (p === 'deepseek') {
    if (!config.deepseekKey?.trim()) {
      return { ready: false, reason: 'DeepSeek API key is required.' };
    }
    return { ready: true };
  }
  if (p === 'custom') {
    if (!config.customKey?.trim() && !config.customBaseUrl?.includes('localhost')) {
      return { ready: false, reason: 'Custom API key or Local Base URL is required.' };
    }
    return { ready: true };
  }
  return { ready: true };
}
