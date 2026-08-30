import { DEFAULT_TRADEMARK_BLOCKLIST, mapToAdobeCategory, mapToShutterstockCategory } from '../data/platforms';

export interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DirectMetadataResult {
  title: string;
  description: string;
  keywords: string[];
  category_guess: string;
  adobeCategory: number;
  shutterstockCategory1: string;
  shutterstockCategory2: string;
  providerUsed: string;
  modelUsed: string;
}

export function extractJsonFromText(rawText: string): any {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  // Strip markdown codeblocks e.g. ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sub = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sub);
      } catch (e2) {
        // Continue
      }
    }
    throw new Error(`Failed to parse metadata JSON: ${cleaned.substring(0, 100)}`);
  }
}

/**
 * Clean & sanitize metadata fields according to microstock rules
 */
export function sanitizeMicrostockMetadata(parsed: any, filename: string): {
  title: string;
  description: string;
  keywords: string[];
  category_guess: string;
} {
  let title = (parsed.title || filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')).trim();
  title = title.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (title.length > 70) {
    title = title.substring(0, 70).trim();
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 40) {
      title = title.substring(0, lastSpace).trim();
    }
  }

  let description = (parsed.description || title).trim();
  if (description.length > 200) {
    description = description.substring(0, 200).trim();
  }

  const blocklistSet = new Set(
    DEFAULT_TRADEMARK_BLOCKLIST.map((b) => b.toLowerCase().trim())
  );

  const rawKeywords: string[] = Array.isArray(parsed.keywords)
    ? parsed.keywords
    : typeof parsed.keywords === 'string'
    ? parsed.keywords.split(/[,;\n]+/)
    : [];

  const seen = new Set<string>();
  const sanitizedKeywords: string[] = [];

  for (const kw of rawKeywords) {
    const clean = String(kw || '')
      .toLowerCase()
      .replace(/[,;]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2 || clean.length > 50) continue;
    if (seen.has(clean)) continue;
    if (blocklistSet.has(clean)) continue;

    seen.add(clean);
    sanitizedKeywords.push(clean);
  }

  return {
    title: title || 'Stock illustration or photo',
    description: description || title,
    keywords: sanitizedKeywords,
    category_guess: parsed.category_guess || 'Graphic Resources',
  };
}

export function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.7-flash';
  const m = model.toLowerCase().trim();
  if (
    m === 'gemini-2.5-flash' ||
    m === 'gemini-1.5-flash' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-flash' ||
    m === 'flash'
  ) {
    return 'gemini-3.7-flash';
  }
  if (
    m === 'gemini-2.5-pro' ||
    m === 'gemini-1.5-pro' ||
    m === 'gemini-2.0-pro' ||
    m === 'gemini-pro' ||
    m === 'pro'
  ) {
    return 'gemini-3.1-pro-preview';
  }
  return model;
}

/**
 * Format raw API errors into clean, user-friendly messages
 */
export function parseApiErrorMessage(provider: string, err: any, rawResponseText?: string): string {
  let msg = (err?.message || String(err || '')).trim();
  if (rawResponseText && rawResponseText.length < 1000) {
    try {
      const parsed = JSON.parse(rawResponseText);
      if (parsed.error?.message) {
        msg = parsed.error.message;
      } else if (parsed.error && typeof parsed.error === 'string') {
        msg = parsed.error;
      }
    } catch {
      // not JSON, keep msg
    }
  }

  const lower = msg.toLowerCase();

  if (provider === 'gemini') {
    if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
      return 'Google Gemini model is temporarily busy (503). Retrying automatically with backup model...';
    }
    if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || lower.includes('api key not valid') || lower.includes('api_key')) {
      return 'Invalid Gemini API Key. Please verify your key in Google AI Studio (https://aistudio.google.com/app/apikey).';
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return 'Gemini API Rate limit or quota reached (429). Please wait a few moments or use a paid/different API key.';
    }
    if (lower.includes('permission_denied') || lower.includes('403')) {
      return 'Permission denied for this Gemini API key. Ensure the Generative Language API is enabled in your Google Cloud / AI Studio project.';
    }
    if (lower.includes('model_not_found') || (lower.includes('404') && lower.includes('models/'))) {
      return 'Selected Gemini model not found. Switching to Gemini Flash.';
    }
  } else if (provider === 'openai') {
    if (lower.includes('401') || lower.includes('invalid_api_key') || lower.includes('incorrect api key')) {
      return 'Invalid OpenAI API Key. OpenAI keys start with "sk-...". Please verify on platform.openai.com.';
    }
    if (lower.includes('429') || lower.includes('insufficient_quota')) {
      return 'OpenAI quota exceeded or balance is $0. Please check your billing settings on platform.openai.com.';
    }
  } else if (provider === 'claude') {
    if (lower.includes('401') || lower.includes('authentication_error')) {
      return 'Invalid Anthropic Claude API Key. Claude keys start with "sk-ant-...".';
    }
    if (lower.includes('429') || lower.includes('rate_limit_error')) {
      return 'Claude API Rate limit exceeded. Please wait a moment.';
    }
  } else if (provider === 'deepseek') {
    if (lower.includes('401') || lower.includes('authentication_error')) {
      return 'Invalid DeepSeek API Key. Please verify your key on platform.deepseek.com.';
    }
    if (lower.includes('402') || lower.includes('insufficient_balance')) {
      return 'DeepSeek account balance is insufficient. Please top up your DeepSeek balance.';
    }
  }

  return msg || `Failed to connect to ${provider.toUpperCase()}`;
}

/**
 * Direct client-side connection tester (Used when server is unavailable or testing directly)
 */
export async function testAiKeyDirectly(
  provider: string,
  apiKey: string,
  model?: string,
  baseUrl?: string
): Promise<TestResult> {
  const cleanKey = (apiKey || '').trim();

  if (!cleanKey && provider !== 'gemini') {
    return {
      success: false,
      error: `Please enter an API key for ${provider.toUpperCase()}.`,
    };
  }

  // 1. GEMINI
  if (provider === 'gemini') {
    if (!cleanKey) {
      return {
        success: false,
        error: 'Please paste your Google Gemini API key from Google AI Studio.',
      };
    }

    const testModel = normalizeGeminiModel(model);
    const candidateModels = Array.from(new Set([testModel, 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']));

    let lastError: any = null;
    for (const curModel of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: 'Respond with: "Connection Verified"' }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 20,
              temperature: 0.1,
            },
          }),
        });

        const responseText = await res.text();
        if (!res.ok) {
          throw new Error(parseApiErrorMessage('gemini', null, responseText));
        }

        const json = JSON.parse(responseText);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          success: true,
          message: `Successfully connected to Google Gemini (${curModel})! ${text.trim()}`,
        };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || '').toLowerCase();
        // If it's a transient 503, 404, or 429, try next model candidate
        if (
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('not found') ||
          errMsg.includes('404') ||
          errMsg.includes('429')
        ) {
          continue;
        }
        break;
      }
    }

    return {
      success: false,
      error: parseApiErrorMessage('gemini', lastError),
    };
  }

  // 2. OPENAI
  if (provider === 'openai') {
    const testModel = model || 'gpt-4o-mini';
    const endpoint = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });

      const responseText = await res.text();
      if (!res.ok) {
        throw new Error(parseApiErrorMessage('openai', null, responseText));
      }

      return {
        success: true,
        message: `Successfully connected to OpenAI (${testModel})!`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: parseApiErrorMessage('openai', err),
      };
    }
  }

  // 3. DEEPSEEK
  if (provider === 'deepseek') {
    const testModel = model || 'deepseek-chat';
    const endpoint = (baseUrl?.trim() || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });

      const responseText = await res.text();
      if (!res.ok) {
        throw new Error(parseApiErrorMessage('deepseek', null, responseText));
      }

      return {
        success: true,
        message: `Successfully connected to DeepSeek (${testModel})!`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: parseApiErrorMessage('deepseek', err),
      };
    }
  }

  // 4. CUSTOM OPENAI-COMPATIBLE
  if (provider === 'custom') {
    if (!baseUrl?.trim()) {
      return { success: false, error: 'Custom API Endpoint URL is required (e.g. http://localhost:11434/v1).' };
    }
    const testModel = model || 'default';
    const endpoint = baseUrl.trim().replace(/\/+$/, '') + '/chat/completions';

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cleanKey) headers['Authorization'] = `Bearer ${cleanKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });

      const responseText = await res.text();
      if (!res.ok) {
        throw new Error(`Custom API error (${res.status}): ${responseText.substring(0, 150)}`);
      }

      return {
        success: true,
        message: `Successfully connected to Custom AI Endpoint (${testModel})!`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to connect to custom API endpoint.',
      };
    }
  }

  return { success: false, error: `Unsupported provider: ${provider}` };
}

/**
 * Direct Client-Side Gemini Metadata Generator
 * Used as high-reliability fallback if server endpoint is unavailable
 */
export async function generateGeminiMetadataDirectly(options: {
  apiKey: string;
  model?: string;
  base64Data: string;
  mimeType?: string;
  filename: string;
  keywordCount?: number;
  customPromptHint?: string;
}): Promise<DirectMetadataResult> {
  const { apiKey, model = 'gemini-3.7-flash', base64Data, mimeType = 'image/jpeg', filename, keywordCount = 45, customPromptHint = '' } = options;

  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is missing. Please set your key in AI Settings.');
  }

  const selectedModel = normalizeGeminiModel(model);
  const candidateModels = Array.from(new Set([selectedModel, 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']));

  const promptText = `Analyze this image thoroughly for microstock marketplace SEO submission (Adobe Stock, Shutterstock, Freepik, Getty).

Filename: "${filename}"
Target Keywords: ${keywordCount} tags
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}

Strict Rules:
1. Title: 50-70 characters. Descriptive, commercial, NO commas, NO brands.
2. Keywords: Exactly ${keywordCount} tags. Ordered from most important/relevant to secondary context.
3. Category: Guess the best primary stock category.

Return JSON format:
{
  "title": "Clear concise descriptive commercial title without commas",
  "description": "Engaging commercial description without trademarks",
  "keywords": ["tag1", "tag2", ...],
  "category_guess": "Graphic Resources"
}`;

  let lastError: any = null;
  let parsed: any = null;
  let actualModelUsed = selectedModel;

  for (const curModel of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
                    data: base64Data,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      const responseText = await res.text();
      if (!res.ok) {
        throw new Error(parseApiErrorMessage('gemini', null, responseText));
      }

      const json = JSON.parse(responseText);
      const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      parsed = extractJsonFromText(rawContent);
      actualModelUsed = curModel;
      break;
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || '').toLowerCase();
      if (
        errMsg.includes('503') ||
        errMsg.includes('unavailable') ||
        errMsg.includes('high demand') ||
        errMsg.includes('not found') ||
        errMsg.includes('404') ||
        errMsg.includes('429')
      ) {
        continue;
      }
      // If parsing failed or single request failed, try next model as fallback
      continue;
    }
  }

  if (!parsed) {
    throw new Error(parseApiErrorMessage('gemini', lastError));
  }

  const clean = sanitizeMicrostockMetadata(parsed, filename);
  const adobeCat = mapToAdobeCategory(clean.category_guess, clean.title + ' ' + clean.keywords.join(' '));
  const { cat1, cat2 } = mapToShutterstockCategory(clean.category_guess, clean.title + ' ' + clean.keywords.join(' '));

  return {
    title: clean.title,
    description: clean.description,
    keywords: clean.keywords,
    category_guess: clean.category_guess,
    adobeCategory: adobeCat,
    shutterstockCategory1: cat1,
    shutterstockCategory2: cat2,
    providerUsed: 'gemini',
    modelUsed: actualModelUsed,
  };
}
