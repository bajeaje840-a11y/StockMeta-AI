import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const currentDir =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase payload limit for base64 image uploads
app.use(express.json({ limit: '50mb' }));

/**
 * Multi-API Key Pool & Round-Robin Rotation Manager for Gemini
 * Supports comma, newline, space, or semicolon separated keys in GEMINI_API_KEY or GEMINI_API_KEYS
 */
function getApiKeyPool(): string[] {
  const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const parsedKeys = envKeys
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !k.startsWith('MY_GEMINI'));

  if (parsedKeys.length === 0) {
    if (process.env.GEMINI_API_KEY) {
      return [process.env.GEMINI_API_KEY.trim()];
    }
    return [];
  }

  return parsedKeys;
}

let activeKeyIndex = 0;

/**
 * Get GenAI client for the current active key in rotation pool or a specific key
 */
function getGenAIClient(customKey?: string): { client: GoogleGenAI; keySnippet: string } {
  let key = customKey?.trim();
  if (!key) {
    const pool = getApiKeyPool();
    if (pool.length === 0) {
      throw new Error('No Gemini API Key provided. Please enter your Gemini API key in settings.');
    }
    const safeIndex = activeKeyIndex % pool.length;
    key = pool[safeIndex];
  }

  const keySnippet =
    key.length > 10 ? `${key.substring(0, 5)}...${key.substring(key.length - 4)}` : '***';

  const client = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return { client, keySnippet };
}

/**
 * Robust JSON Parser from AI text output (strips markdown code blocks and preambles)
 */
function parseAiJsonResponse(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI returned empty response.');
  }

  let cleaned = rawText.trim();
  // Strip markdown code fences ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try parsing directly
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Look for first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSubstr = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonSubstr);
      } catch (e2) {
        // Continue to fallback
      }
    }
    throw new Error(`Failed to parse AI JSON response: ${rawText.substring(0, 150)}...`);
  }
}

/**
 * Clean & Format Metadata strictly adhering to Microstock requirements (Adobe Stock, Shutterstock, Freepik, Getty)
 */
function sanitizeMetadata(parsedJson: any, filename: string, targetKeywordCount = 49) {
  // Title: 1 concise, descriptive sentence, max 100 chars (optimal for microstock & Adobe Stock), strictly NO COMMAS
  let cleanTitle = (parsedJson.title || '')
    .replace(/,/g, ' ')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) {
    cleanTitle = (filename || 'Stock Media').replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  }
  if (cleanTitle.length > 100) {
    cleanTitle = cleanTitle.substring(0, 100).trim();
  }

  // Description: clean 1-2 sentence commercial description
  let cleanDescription = (parsedJson.description || cleanTitle).trim();

  // Blocklist of common forbidden trademarks/spam
  const TRADEMARK_BAN = new Set([
    'apple', 'iphone', 'ipad', 'macbook', 'nike', 'adidas', 'gucci', 'prada', 'chanel',
    'louis vuitton', 'tesla', 'bmw', 'mercedes', 'audi', 'ferrari', 'porsche', 'ford',
    'sony', 'canon', 'nikon', 'gopro', 'samsung', 'huawei', 'xiaomi', 'microsoft',
    'windows', 'android', 'google', 'facebook', 'instagram', 'tiktok', 'twitter', 'youtube',
    'photoshop', 'illustrator', 'after effects', 'figma', 'canva', 'midjourney', 'dall-e',
    'chatgpt', 'openai', 'nobody', 'no person', 'no people'
  ]);

  // Keywords: strictly unique, lowercase, no brand names, sorted by relevance
  const rawKeywords = Array.isArray(parsedJson.keywords) ? parsedJson.keywords : [];
  const cleanKeywords: string[] = [];
  const seenKw = new Set<string>();

  for (const kw of rawKeywords) {
    if (typeof kw === 'string') {
      const trimmed = kw
        .trim()
        .toLowerCase()
        .replace(/[,;]/g, ' ')
        .replace(/^[,\s"']+|[,\s"']+$/g, '')
        .replace(/\s+/g, ' ');

      if (
        trimmed &&
        trimmed.length >= 2 &&
        trimmed.length <= 40 &&
        !seenKw.has(trimmed) &&
        !TRADEMARK_BAN.has(trimmed) &&
        !trimmed.includes('http') &&
        !trimmed.includes('.com')
      ) {
        seenKw.add(trimmed);
        cleanKeywords.push(trimmed);
      }
    }
  }

  // Limit to target keyword count (default max 49 for Adobe Stock standard)
  const finalKeywords = cleanKeywords.slice(0, Math.max(25, Math.min(49, targetKeywordCount)));

  return {
    title: cleanTitle,
    description: cleanDescription,
    keywords: finalKeywords,
    category_guess: parsedJson.category_guess || 'Graphic Resources',
  };
}

/**
 * API Route: Get current API Key pool status
 */
app.get('/api/key-status', (req, res) => {
  try {
    const pool = getApiKeyPool();
    res.json({
      success: true,
      totalKeys: pool.length,
      currentActiveIndex: pool.length > 0 ? activeKeyIndex % pool.length : 0,
      keysMasked: pool.map(
        (k, idx) =>
          `Key #${idx + 1}: ${
            k.length > 10 ? k.substring(0, 5) + '...' + k.substring(k.length - 4) : '***'
          }`
      ),
    });
  } catch (err: any) {
    res.json({
      success: false,
      totalKeys: 0,
      currentActiveIndex: 0,
      keysMasked: [],
      error: err.message,
    });
  }
});

function normalizeGeminiModel(model?: string): string {
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
 * Format provider-specific error message cleanly for the user
 */
function formatProviderErrorMessage(provider: string, err: any): string {
  const rawMsg = (err?.message || err?.error?.message || err?.toString?.() || String(err || '')).trim();
  const lower = rawMsg.toLowerCase();

  if (provider === 'gemini') {
    if (
      lower.includes('api_key_invalid') ||
      lower.includes('invalid api key') ||
      lower.includes('api key not valid') ||
      lower.includes('api_key') ||
      lower.includes('pass a valid api key') ||
      lower.includes('400 bad request')
    ) {
      return 'Invalid Gemini API Key. Google Gemini keys from Google AI Studio start with "AIzaSy...". Please verify your key at https://aistudio.google.com/app/apikey or leave the key field empty to use the built-in free AI.';
    }
    if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
      return 'Google Gemini model is temporarily experiencing high global demand (503). Retrying automatically...';
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return 'Gemini API Rate limit reached (429). Please wait a few moments or use a paid/different API key.';
    }
    if (lower.includes('permission_denied') || lower.includes('403')) {
      return 'Permission denied for this Gemini API key. Ensure Generative Language API is enabled or leave empty for built-in AI.';
    }
    if (lower.includes('model_not_found') || (lower.includes('404') && lower.includes('models/'))) {
      return 'Selected Gemini model not found. Switching to Gemini Flash.';
    }
  } else if (provider === 'openai') {
    if (lower.includes('401') || lower.includes('invalid_api_key')) {
      return 'Invalid OpenAI API Key. OpenAI keys usually start with "sk-...". Check your OpenAI platform settings.';
    }
    if (lower.includes('429') || lower.includes('insufficient_quota')) {
      return 'OpenAI quota exceeded or rate limit reached. Please check your OpenAI billing balance.';
    }
  } else if (provider === 'claude') {
    if (lower.includes('401') || lower.includes('authentication_error')) {
      return 'Invalid Anthropic Claude API Key. Claude keys usually start with "sk-ant-...".';
    }
    if (lower.includes('429') || lower.includes('rate_limit_error')) {
      return 'Claude API Rate limit exceeded. Please wait a minute before retrying.';
    }
  } else if (provider === 'deepseek') {
    if (lower.includes('401') || lower.includes('authentication_error')) {
      return 'Invalid DeepSeek API Key. Please verify your key on the DeepSeek platform.';
    }
    if (lower.includes('402') || lower.includes('insufficient_balance')) {
      return 'DeepSeek balance is insufficient. Please top up your DeepSeek balance.';
    }
  }

  return rawMsg || `Failed to connect to ${provider.toUpperCase()}`;
}

/**
 * API Route: /api/test-key
 * Test API key connectivity for Gemini, OpenAI, Claude, DeepSeek, or Custom AI
 */
app.post('/api/test-key', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const provider = (req.body.provider || 'gemini').toLowerCase().trim();
  const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const model = req.body.model;
  const baseUrl = req.body.baseUrl;

  try {
    if (!apiKey && provider !== 'gemini') {
      return res.status(400).json({
        success: false,
        error: `Please provide an API key for ${provider.toUpperCase()}`,
      });
    }

    if (provider === 'gemini') {
      // If user entered a key that clearly looks invalid (e.g. starts with AQ. instead of AIzaSy)
      if (apiKey && apiKey.startsWith('AQ.')) {
        return res.status(400).json({
          success: false,
          error: 'This key starts with "AQ." which is not a valid Gemini API key. Google AI Studio keys start with "AIzaSy...". Please copy your key from https://aistudio.google.com/app/apikey or click "Use Built-in Free AI".',
        });
      }

      let ai: GoogleGenAI;
      let usingServerPool = false;
      try {
        const clientInfo = getGenAIClient(apiKey || undefined);
        ai = clientInfo.client;
        usingServerPool = !apiKey;
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: formatProviderErrorMessage('gemini', err),
        });
      }

      const testModel = normalizeGeminiModel(model);
      const candidateModels = Array.from(new Set([testModel, 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']));
      
      let lastErr: any = null;
      for (const curModel of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: curModel,
            contents: 'Respond with: OK',
          });
          return res.json({
            success: true,
            message: usingServerPool
              ? `Connected to Built-in Server Gemini AI (${curModel}) successfully!`
              : `Connected to your custom Gemini API (${curModel}) successfully!`,
            modelUsed: curModel,
            reply: response.text?.trim() || 'OK',
          });
        } catch (err: any) {
          lastErr = err;
          console.error(`[Test Key Error] model: ${curModel}, err:`, err);
          const errStr = (err?.message || String(err)).toLowerCase();
          if (
            errStr.includes('503') ||
            errStr.includes('unavailable') ||
            errStr.includes('high demand') ||
            errStr.includes('404') ||
            errStr.includes('not found') ||
            errStr.includes('429') ||
            errStr.includes('resource_exhausted')
          ) {
            continue;
          }
          break;
        }
      }

      const formattedError = formatProviderErrorMessage('gemini', lastErr);
      return res.status(400).json({
        success: false,
        error: formattedError,
      });
    }

    if (provider === 'openai') {
      const endpoint = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
      const testModel = model || 'gpt-4o-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Respond with standard text: OK' }],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      return res.json({
        success: true,
        message: `Successfully connected to OpenAI (${testModel})!`,
      });
    }

    if (provider === 'claude') {
      const endpoint = (baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/+$/, '') + '/messages';
      const testModel = model || 'claude-3-5-haiku-20241022';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Respond with standard text: OK' }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic Claude API error (${response.status}): ${errorText}`);
      }

      return res.json({
        success: true,
        message: `Successfully connected to Anthropic Claude (${testModel})!`,
      });
    }

    if (provider === 'deepseek' || provider === 'custom') {
      const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
      const endpoint = (baseUrl?.trim() || defaultBase).replace(/\/+$/, '') + '/chat/completions';
      const testModel = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Respond with standard text: OK' }],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.toUpperCase()} API error (${response.status}): ${errorText}`);
      }

      return res.json({
        success: true,
        message: `Successfully connected to ${provider.toUpperCase()} (${testModel})!`,
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
  } catch (err: any) {
    console.error(`Error testing API key for ${provider}:`, err);
    const friendlyError = formatProviderErrorMessage(provider, err);
    return res.status(400).json({
      success: false,
      error: friendlyError,
    });
  }
});

/**
 * Multi-Provider AI Metadata Generation
 */
app.post('/api/generate-metadata', async (req, res) => {
  try {
    const {
      provider = 'gemini',
      apiKey,
      model,
      baseUrl,
      base64Data,
      mimeType,
      filename,
      keywordCount = 49,
      customPromptHint,
    } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Missing base64Data image payload',
      });
    }

    const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    let safeMimeType = (mimeType || '').toLowerCase().trim();
    if (!ALLOWED_MIMES.includes(safeMimeType)) {
      safeMimeType = 'image/jpeg';
    }

    const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));

    const systemInstruction = `You are a world-class Stock Media SEO Specialist & Keywording Expert for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual asset (photo, texture, vector illustration, 3D render, or graphic) in extreme visual detail and generate high-converting, strictly compliant commercial SEO metadata in valid JSON format.

DEEP VISUAL ANALYSIS REQUIREMENTS:
1. Subject & Concept: Identify the primary subject, secondary objects, core themes, emotions, and practical concepts (e.g. business, luxury, wellness, technology, nature, celebration).
2. Composition, Style & Technique: Note the visual perspective (flat lay, close up macro, aerial, portrait, pattern, isometric), rendering style (fluid art, watercolor, 3D render, realistic photography, vector art), lighting, textures (marble, grain, foil, bokeh, rough, polished), and dominant color palette (e.g. navy blue, turquoise, gold, monochrome).
3. Commercial & Industry Intent: Identify potential buyer use cases (website hero backdrop, social media banner, packaging design, interior wallpaper, advertising poster, editorial theme).

STRICT MICROSTOCK RULES:
- Title: Exactly ONE clear, highly descriptive, commercial sentence (60-90 characters). Packed with the top search keywords. Strictly NEVER include commas in the title (Adobe Stock forbids commas). No quotation marks.
- Description: 1-2 clean sentences describing the asset's visual elements, background atmosphere, and design value.
- Keywords: Provide EXACTLY ${targetKwCount} unique, high-ranking, buyer-focused keywords.
  * Sort strictly in descending order of relevance (Tags #1 to #10 must be the most exact, high-traffic search terms, as Adobe Stock search algorithms weigh the first 10 keywords most heavily).
  * Use concise single words and 2-word phrases only.
  * STRICTLY lowercase, no commas inside tags, no duplicates, no punctuation.
  * NO trademarked brand names (no Apple, iPhone, Nike, Adobe, Photoshop, Midjourney, etc.).
  * NO negative/spam tags (no "nobody", "no people", "no person", "white background" unless truly isolated on pure white).
- Category: Accurate primary category (e.g., Graphic Resources, Backgrounds/Textures, Abstract, Architecture, Business, Food, Lifestyle, People, Plants, Science, Technology, Travel).

JSON Response Schema:
{
  "title": "Luxury Deep Blue Marble Texture with Flowing Veins and Quartz Surface",
  "description": "High resolution abstract blue marble stone texture with natural veins and elegant crystal surface for luxury background design.",
  "keywords": ["blue marble", "marble texture", "abstract background", ...],
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Filename: "${filename || 'stock_media'}".
Target Keyword Count: Exactly ${targetKwCount} keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}
Generate premium microstock SEO metadata as valid JSON.`;

    let resultText = '';

    // ==========================================
    // 1. GOOGLE GEMINI PROVIDER
    // ==========================================
    if (provider === 'gemini') {
      const selectedModel = normalizeGeminiModel(model);
      const candidateModels = Array.from(new Set([selectedModel, 'gemini-flash-latest', 'gemini-3.7-flash', 'gemini-3.1-flash-lite']));
      const keyPool = getApiKeyPool();
      const hasCustomKey = !!apiKey?.trim();
      const totalKeys = hasCustomKey ? 1 : Math.max(keyPool.length, 1);

      let attempts = 0;
      let lastError: any = null;

      for (const curModel of candidateModels) {
        let modelSuccess = false;
        attempts = 0;
        
        while (attempts < (hasCustomKey ? 2 : totalKeys * 2)) {
          const currentAttemptIndex = hasCustomKey ? 0 : (activeKeyIndex + attempts) % totalKeys;
          const { client: ai, keySnippet } = hasCustomKey
            ? getGenAIClient(apiKey)
            : getGenAIClient();

          try {
            console.log(
              `[Gemini AI] Processing ${filename} using model ${curModel} (${keySnippet})...`
            );

            const response = await ai.models.generateContent({
              model: curModel,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: safeMimeType,
                      data: base64Data,
                    },
                  },
                  {
                    text: promptText,
                  },
                ],
              },
              config: {
                systemInstruction,
                temperature: 0.2,
                responseMimeType: 'application/json',
              },
            });

            resultText = response.text || '';
            if (!resultText && response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                  resultText += part.text;
                }
              }
            }
            if (!hasCustomKey) {
              activeKeyIndex = currentAttemptIndex;
            }
            modelSuccess = true;
            break;
          } catch (err: any) {
            lastError = err;
            const errStr = (err?.message || String(err)).toLowerCase();

            attempts++;

            if (!hasCustomKey && (errStr.includes('429') || errStr.includes('quota') || errStr.includes('limit') || errStr.includes('resource_exhausted'))) {
              activeKeyIndex = (activeKeyIndex + 1) % totalKeys;
            }

            // If it's a 503 or 404 or 429, retry after slight delay or switch model
            if (errStr.includes('503') || errStr.includes('unavailable') || errStr.includes('high demand') || errStr.includes('404') || errStr.includes('not found')) {
              break; // break to next model in candidateModels
            }

            if (hasCustomKey && (errStr.includes('invalid') || errStr.includes('permission_denied') || errStr.includes('403') || errStr.includes('400 bad request'))) {
              console.warn('[Gemini AI] Custom API key failed with auth error. Trying seamless server built-in key fallback...');
              try {
                const { client: fallbackAi } = getGenAIClient();
                const fallbackResponse = await fallbackAi.models.generateContent({
                  model: curModel,
                  contents: {
                    parts: [
                      {
                        inlineData: {
                          mimeType: safeMimeType,
                          data: base64Data,
                        },
                      },
                      {
                        text: promptText,
                      },
                    ],
                  },
                  config: {
                    systemInstruction,
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                  },
                });

                resultText = fallbackResponse.text || '';
                if (resultText) {
                  modelSuccess = true;
                  break;
                }
              } catch (fallbackErr) {
                console.warn('[Gemini AI] Fallback also failed:', fallbackErr);
                throw new Error(formatProviderErrorMessage('gemini', err));
              }
            }
          }
        }

        if (modelSuccess && resultText) {
          break;
        }
      }

      if (!resultText) {
        throw new Error(
          formatProviderErrorMessage('gemini', lastError)
        );
      }
    }

    // ==========================================
    // 2. OPENAI (CHATGPT) PROVIDER
    // ==========================================
    else if (provider === 'openai') {
      if (!apiKey?.trim()) {
        throw new Error('OpenAI API Key is required. Please set it in AI Settings.');
      }

      const selectedModel = model || 'gpt-4o-mini';
      const endpoint = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';

      console.log(`[OpenAI] Processing ${filename} using ${selectedModel}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: [
                { type: 'text', text: promptText },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${safeMimeType};base64,${base64Data}`,
                    detail: 'low',
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      resultText = data.choices?.[0]?.message?.content || '';
    }

    // ==========================================
    // 3. ANTHROPIC CLAUDE PROVIDER
    // ==========================================
    else if (provider === 'claude') {
      if (!apiKey?.trim()) {
        throw new Error('Anthropic Claude API Key is required. Please set it in AI Settings.');
      }

      const selectedModel = model || 'claude-3-5-sonnet-20241022';
      const endpoint = (baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/+$/, '') + '/messages';

      console.log(`[Claude AI] Processing ${filename} using ${selectedModel}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1200,
          system: systemInstruction,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: safeMimeType === 'image/png' ? 'image/png' : 'image/jpeg',
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: `${promptText}\n\nIMPORTANT: Return ONLY a valid JSON object. Do not include introductory or markdown prose.`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      resultText = data.content?.[0]?.text || '';
    }

    // ==========================================
    // 4. DEEPSEEK / CUSTOM PROVIDER
    // ==========================================
    else if (provider === 'deepseek' || provider === 'custom') {
      if (!apiKey?.trim()) {
        throw new Error(`${provider.toUpperCase()} API Key is required. Please set it in AI Settings.`);
      }

      const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
      const endpoint = (baseUrl?.trim() || defaultBase).replace(/\/+$/, '') + '/chat/completions';
      const selectedModel = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

      console.log(`[${provider.toUpperCase()}] Processing ${filename} using ${selectedModel}...`);

      // Try vision request first, fallback to text context if image_url isn't supported
      let requestBody: any = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${safeMimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      };

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(requestBody),
      });

      // If provider rejects image_url (e.g. standard DeepSeek text-only model)
      if (!response.ok && response.status === 400) {
        console.warn(`[${provider.toUpperCase()}] Vision payload rejected, retrying with textual metadata prompt...`);
        requestBody = {
          model: selectedModel,
          messages: [
            { role: 'system', content: systemInstruction },
            {
              role: 'user',
              content: `${promptText}\nAsset format: ${safeMimeType}.\nGenerate high-converting stock SEO metadata JSON for this asset.`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        };

        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.toUpperCase()} API error (${response.status}): ${errorText}`);
      }

      const data: any = await response.json();
      resultText = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Parse and format JSON
    const parsedJson = parseAiJsonResponse(resultText);
    const sanitized = sanitizeMetadata(parsedJson, filename, keywordCount);

    return res.json({
      success: true,
      metadata: sanitized,
      providerUsed: provider,
      modelUsed: model || 'default',
    });
  } catch (err: any) {
    console.error('Error generating metadata:', err);
    const friendlyError = formatProviderErrorMessage(req.body?.provider || 'gemini', err);
    return res.status(500).json({
      success: false,
      error: friendlyError || 'Failed to generate AI metadata for file.',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'StockMeta AI Server' });
});

// Global Express JSON error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('Unhandled server error:', err);
  res.status(err?.status || 500).json({
    success: false,
    error: err?.message || 'An unexpected internal server error occurred.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer();

