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
  title = title.replace(/,/g, ' ').replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  if (title.length > 100) {
    title = title.substring(0, 100).trim();
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 50) {
      title = title.substring(0, lastSpace).trim();
    }
  }

  let description = (parsed.description || title).trim();
  if (description.length > 200) {
    description = description.substring(0, 200).trim();
  }

  const blocklistSet = new Set([
    ...DEFAULT_TRADEMARK_BLOCKLIST.map((b) => b.toLowerCase().trim()),
    'apple', 'iphone', 'ipad', 'macbook', 'nike', 'adidas', 'gucci', 'prada', 'chanel',
    'louis vuitton', 'tesla', 'bmw', 'mercedes', 'audi', 'ferrari', 'porsche', 'ford',
    'sony', 'canon', 'nikon', 'gopro', 'samsung', 'huawei', 'xiaomi', 'microsoft',
    'windows', 'android', 'google', 'facebook', 'instagram', 'tiktok', 'twitter', 'youtube',
    'photoshop', 'illustrator', 'after effects', 'figma', 'canva', 'midjourney', 'dall-e',
    'chatgpt', 'openai', 'nobody', 'no person', 'no people'
  ]);

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
      .replace(/[,;]/g, ' ')
      .replace(/^[,\s"']+|[,\s"']+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2 || clean.length > 40) continue;
    if (seen.has(clean)) continue;
    if (blocklistSet.has(clean)) continue;
    if (clean.includes('http') || clean.includes('.com')) continue;

    seen.add(clean);
    sanitizedKeywords.push(clean);
  }

  // Cap at 49 tags for Adobe Stock / microstock standard
  const finalKeywords = sanitizedKeywords.slice(0, 49);

  return {
    title: title || 'High Quality Stock Media Asset',
    description: description || title,
    keywords: finalKeywords,
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
    if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || lower.includes('api key not valid') || lower.includes('api_key') || lower.includes('400') || lower.includes('bad request')) {
      return 'Invalid Gemini API Key. Please verify your key (starts with "AQ." or "AIzaSy...") at https://aistudio.google.com/app/apikey or click "Use Free Built-in AI".';
    }
    if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
      return 'Google Gemini model is temporarily busy (503). Retrying automatically with backup model...';
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return 'Gemini API Rate limit or quota reached (429). Please wait a few moments or use a paid/different API key.';
    }
    if (lower.includes('permission_denied') || lower.includes('403')) {
      return 'Permission denied for this Gemini API key. Ensure Generative Language API is enabled or use free built-in AI.';
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
    const candidateModels = Array.from(new Set([testModel, 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']));

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
        // If it's a transient 503, 404, 429, timeout or network issue, try next model candidate
        if (
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('not found') ||
          errMsg.includes('404') ||
          errMsg.includes('429') ||
          errMsg.includes('timeout') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('network')
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
  const { apiKey, model = 'gemini-3.7-flash', base64Data, mimeType = 'image/jpeg', filename, keywordCount = 49, customPromptHint = '' } = options;

  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is missing. Please set your key in AI Settings.');
  }

  let cleanBase64 = String(base64Data || '').trim();
  if (cleanBase64.includes(',')) {
    cleanBase64 = cleanBase64.split(',')[1].trim();
  }
  cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

  const isVector = /\.(eps|ai|svg|pdf|cdr|ps)$/i.test(filename || '') || (mimeType && mimeType.includes('svg'));
  const hasImage = cleanBase64.length > 50;

  if (!hasImage && !isVector) {
    throw new Error('Missing image data for AI processing.');
  }

  const selectedModel = normalizeGeminiModel(model);
  const candidateModels = Array.from(new Set([selectedModel, 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']));
  const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));
  const safeMime = mimeType?.startsWith('image/') ? mimeType.split(';')[0].trim() : 'image/jpeg';

  const cleanSubject = filename
    ? filename
        .replace(/\.[^/.]+$/, '')
        .replace(/^create[_\s-]+/i, '')
        .replace(/_\d{8,}(?:_\d+)?/g, '')
        .replace(/[-_]+/g, ' ')
        .trim()
    : '';

  const promptText = `You are a world-class Stock Media Metadata & SEO Specialist for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual artwork / image in extreme visual detail and generate high-converting microstock SEO metadata as valid JSON.

DEEP VISUAL CONTENT ANALYSIS REQUIREMENTS:
1. Visual Content & Objects: Examine the rendered visual artwork carefully. Identify the exact objects, vector illustrations, icons, characters, symbols, textures, badges, background elements, art style (flat, 3D, line art, isometric, vintage, modern), and color palette present in the image.
2. Content-Accurate Focus: Base your metadata 100% on what is VISIBLE in the image. Do NOT guess or rely solely on the filename.
3. Commercial Use Cases: Identify intended applications (web graphics, UI icons, banners, packaging, posters, branding).

STRICT MICROSTOCK REQUIREMENTS:
1. Title: 60-90 characters. Descriptive, commercial, packed with top search keywords describing the actual visual content. Strictly NO COMMAS anywhere (Adobe Stock rule).
2. Description: 1-2 clean sentences accurately describing the visual elements, style, and design utility.
3. Keywords: Exactly ${targetKwCount} unique, high-traffic commercial tags. Ordered strictly in descending order of relevance (first 10 tags have highest SEO weight on Adobe Stock). NO brand trademarks. Single words or 2-word phrases only. Strictly lowercase.
4. Category: Best matching microstock category (e.g., Graphic Resources, Backgrounds/Textures, Transportation, Abstract, Business, Technology, Food, Lifestyle).

Filename: "${filename}"
${isVector ? `Asset Format: Scalable Vector Graphic / Artwork Asset.` : ''}
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}

JSON Response Format:
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    try {
      const parts: any[] = [];
      if (hasImage) {
        parts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        });
      }
      parts.push({ text: promptText });

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts,
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
      // If it's an image decoding / 400 bad request error, try direct text fallback
      if (errMsg.includes('decode') || errMsg.includes('image') || errMsg.includes('400') || errMsg.includes('bad request')) {
        try {
          const textRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${promptText}\nNote: This is a professional scalable vector graphic illustration "${filename}". Generate complete commercial JSON metadata based on vector subject and filename.`,
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
          if (textRes.ok) {
            const textJson = await textRes.json();
            const rawContent = textJson.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawContent) {
              parsed = extractJsonFromText(rawContent);
              actualModelUsed = curModel;
              break;
            }
          }
        } catch (textErr) {
          // continue
        }
      }

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
