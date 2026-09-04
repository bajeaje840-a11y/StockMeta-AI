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
  if (!model) return 'gemini-3.5-flash-lite';
  const m = model.toLowerCase().trim();
  if (
    m === 'gemini-2.5-flash' ||
    m === 'gemini-1.5-flash' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-flash' ||
    m === 'flash'
  ) {
    return 'gemini-3.5-flash-lite';
  }
  if (
    m === 'gemini-2.5-pro' ||
    m === 'gemini-2.0-pro' ||
    m === 'gemini-1.5-pro' ||
    m === 'gemini-pro' ||
    m === 'pro'
  ) {
    return 'gemini-3.1-pro-preview';
  }
  if (m === 'gemini-3.5-flash-lite' || m === 'flash-lite' || m === 'lite') {
    return 'gemini-3.5-flash-lite';
  }
  if (m === 'gemini-3.1-flash-lite') {
    return 'gemini-3.1-flash-lite';
  }
  if (m === 'gemini-3.5-flash') {
    return 'gemini-3.5-flash-lite';
  }
  if (m === 'gemini-3.6-flash') {
    return 'gemini-3.5-flash-lite';
  }
  if (m === 'gemini-3.7-flash') {
    return 'gemini-3.5-flash-lite';
  }
  return 'gemini-3.5-flash-lite';
}

/**
 * Format raw API errors into clean, user-friendly messages
 */
export function parseApiErrorMessage(provider: string, err: any, rawResponseText?: string): string {
  let msg = (err?.message || String(err || '')).trim();
  if (rawResponseText && rawResponseText.length < 3000) {
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
    if (lower.includes('api_key_invalid') || lower.includes('invalid api key') || lower.includes('api key not valid') || lower.includes('api_key') || (lower.includes('400') && lower.includes('key'))) {
      return 'Invalid Gemini API Key. Please verify your key (starts with "AQ." or "AIzaSy...") at https://aistudio.google.com/app/apikey or leave empty to use built-in AI.';
    }
    if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
      return 'Google Gemini model is experiencing high demand (503). Retrying with active model...';
    }
    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      return 'Gemini API Rate limit reached (429). The system automatically throttles and retries with backup models (Gemini Flash Lite) or you can try again in a few moments.';
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
    const candidateModels = Array.from(new Set([testModel, 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.1-pro-preview']));

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
        // If it's a transient 503, 404, 429, timeout or network issue, wait a moment and try next model candidate
        if (
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('not found') ||
          errMsg.includes('404') ||
          errMsg.includes('429') ||
          errMsg.includes('quota') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('timeout') ||
          errMsg.includes('failed to fetch') ||
          errMsg.includes('network')
        ) {
          await new Promise((r) => setTimeout(r, 800));
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
  fileHash?: string;
  timestamp?: string;
  keywordCount?: number;
  customPromptHint?: string;
  vectorSemanticText?: string;
  isRealArtworkPreview?: boolean;
  cleanSubject?: string;
}): Promise<DirectMetadataResult> {
  const {
    apiKey,
    model = 'gemini-3.5-flash',
    base64Data,
    mimeType = 'image/jpeg',
    filename,
    fileHash: clientFileHash,
    timestamp: clientTimestamp,
    keywordCount = 49,
    customPromptHint = '',
    vectorSemanticText = '',
    isRealArtworkPreview,
    cleanSubject: clientCleanSubject,
  } = options;

  if (!apiKey?.trim()) {
    throw new Error('Gemini API key is missing. Please set your key in AI Settings.');
  }

  const timestamp = clientTimestamp || new Date().toISOString();

  let cleanBase64 = String(base64Data || '').trim();
  if (cleanBase64.includes(',')) {
    cleanBase64 = cleanBase64.split(',')[1].trim();
  }
  cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

  let fileHash = clientFileHash;
  if (!fileHash) {
    const seed = `${filename || 'file'}_${timestamp}_${cleanBase64.slice(0, 500)}_${cleanBase64.length}`;
    let hashNum = 0;
    for (let i = 0; i < seed.length; i++) {
      hashNum = (hashNum << 5) - hashNum + seed.charCodeAt(i);
      hashNum |= 0;
    }
    fileHash =
      Math.abs(hashNum).toString(16).padStart(8, '0').toUpperCase() +
      Math.floor(Math.random() * 65535)
        .toString(16)
        .padStart(4, '0')
        .toUpperCase();
  }

  const isVector = /\.(eps|ai|svg|pdf|cdr|ps)$/i.test(filename || '') || (mimeType && mimeType.includes('svg'));
  let isRealVisual = isRealArtworkPreview !== false;
  let isRasterImage =
    cleanBase64.startsWith('/9j/') ||
    cleanBase64.startsWith('iVBOR') ||
    cleanBase64.startsWith('R0lGOD') ||
    cleanBase64.startsWith('UklGR');

  // If vector file and cleanBase64 is raw vector text/binary, try rasterization call
  if (isVector && (!isRasterImage || !isRealVisual) && cleanBase64.length > 50) {
    try {
      const renderRes = await fetch('/api/render-vector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, fileData: cleanBase64 }),
      });
      if (renderRes.ok) {
        const renderData = await renderRes.json();
        if (renderData.success && renderData.base64Data) {
          cleanBase64 = renderData.base64Data;
          isRasterImage = true;
          isRealVisual = true;
        }
      }
    } catch (e) {
      console.warn('Direct service vector rendering fetch error:', e);
    }
  }

  const hasImage = cleanBase64.length > 50 && isRealVisual && isRasterImage;

  if (!hasImage && !isVector && cleanBase64.length <= 50) {
    throw new Error('Missing image data for AI processing.');
  }

  const selectedModel = normalizeGeminiModel(model);
  const candidateModels = Array.from(new Set(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', selectedModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash']));
  const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));
  const safeMime = mimeType?.startsWith('image/') ? mimeType.split(';')[0].trim() : 'image/jpeg';

  const cleanSubject = clientCleanSubject || (filename
    ? filename
        .replace(/\.[^/.]+$/, '')
        .replace(/^create[_\s-]+/i, '')
        .replace(/_\d{8,}(?:_\d+)?/g, '')
        .replace(/[-_]+/g, ' ')
        .trim()
    : '');

  const promptText = `You are a world-class Senior AI Prompt Engineer & Microstock SEO Specialist for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual asset (photo, texture, vector illustration, icon set, seamless pattern, 3D render, or graphic) in extreme visual detail and generate high-converting, strictly compliant commercial SEO metadata in valid JSON format.

=== 1. DYNAMIC SENTENCE ARCHITECTURE & ANTI-REPETITION (STRICT MANDATE) ===
Microstock platforms strictly penalize and reject portfolio batches containing repetitive, formulaic, or templated titles.
- STRICTLY FORBIDDEN PREFIX FORMULAS & CLICHÉS:
  * NEVER start consecutive items or multiple assets in a batch with the same phrase or prefix.
  * BANNED OPENERS: Never begin titles with repetitive clichés such as:
    - "Autumn harvest..." / "Harvest autumn..." / "Autumn celebration..."
    - "Happy Thanksgiving..." / "Thanksgiving celebration..." / "Thanksgiving holiday..."
    - "Autumn border..." / "Fall border..." / "Autumn frame..." / "Thanksgiving frame..."
    - "Fall background..." / "Autumn background..." / "Thanksgiving background..."
    - "Cute [topic]..." / "Cute cartoon..." / "Adorable..." / "A cute..."
    - "Set of..." / "A set of..." / "Collection of..." / "Pack of..."
    - "Vector illustration of..." / "Illustration of..." / "Graphic of..." / "Isolated..."
    - "Vibrant...", "Beautiful...", "Festive...", "Holiday..."
  * If terms like "autumn", "thanksgiving", "cute", or "vector" are relevant, weave them naturally into the middle or modifier position of the title—NEVER as the repetitive opening word.
  * Every single asset in a batch MUST have a distinct, human-crafted opening phrasing.

- RANDOMIZE AND ROTATE SENTENCE ENTRY POINTS (MANDATORY):
  You MUST randomize and dynamically alternate sentence entry points across every single image based on unique composition and file fingerprint (Seed: ${fileHash.slice(0, 8)}). Do NOT repeat the same structure. Rotate across these 5 distinct architectures:
  * Entry Point 1 (Object/Detail First): Lead with concrete focal subjects, specific botanical varieties, or tangible items first.
    -> Example: "Pomegranates Walnuts and Gourds Arranged on Rustic Wood"
  * Entry Point 2 (Layout/Composition First): Lead with perspective, camera angle, framing, or spatial layout first.
    -> Example: "Top Down Flat Lay of Golden Maple Leaves with Copy Space"
  * Entry Point 3 (Artistic Style First): Lead with specific rendering technique, artistic medium, or visual treatment first.
    -> Example: "Watercolor Botanical Frame Featuring Orange Pumpkins and Foliage"
  * Entry Point 4 (Concept/Mood First): Lead with thematic concept, seasonal atmosphere, or emotional celebration first.
    -> Example: "Warm Harvest Season Celebration Concept with Pinecones"
  * Entry Point 5 (Color/Texture First): Lead with surface background, dominant color palette, or material texture first.
    -> Example: "Dark Purple Background Framed with Seasonal Fall Produce"

=== 2. HIGH-PRECISION MICRO-VISUAL EXTRACTION ===
Force deep visual scrutiny to extract the exact micro-details that make this specific file unique from every other file:
- Exact Surface & Background Texture: Explicitly identify and name the background or table surface (e.g., rustic wood table, black slate stone, dark textured chalkboard, navy backdrop, aged parchment, marble countertop, rough burlap fabric, clean isolated white ground).
- Exact Produce, Flora & Item Inventory: Identify the precise varieties and objects visibly present (e.g., pomegranate, sunflower, golden wheat, cornucopia, striped pumpkin, acorn squash, dry pinecones, walnuts, whole cinnamon sticks, cranberries, star anise). Never use vague generic terms like "various elements" or "seasonal produce".
- Lighting & Atmosphere: Note distinctive illumination (e.g., dramatic smoke clouds, warm volumetric glow, directional sunlight, moody chiaroscuro shadows, soft overhead studio lighting, rim-lit contours).
- Art Style & Medium: Distinguish exact technique (e.g., watercolor painting, 3D render, macro photograph, flat vector illustration, chalk drawing, linocut print).
- 100% Visual Fidelity: Describe ONLY what is genuinely visible in the artwork. Never hallucinate absent items.

=== 3. UNIQUE & CONTEXT-DRIVEN KEYWORDS (TAGS) ===
Provide EXACTLY ${targetKwCount} unique, high-traffic commercial tags. Adobe Stock and Shutterstock algorithms weigh the first 10 keywords most heavily.
Structure the keywords in strict descending SEO hierarchy:
- Tier 1 (Tags 1–10 - Primary SEO Weight): Specific, distinctive visual elements and micro-detail nouns MUST be placed at the very top of the tag list (e.g., "pomegranate", "chalkboard", "wood texture", "sunflower", "pinecone", "walnut", "cinnamon") BEFORE generic thematic tags ("autumn", "thanksgiving").
- Tier 2 (Tags 11–25 - Specific Visual Attributes & Textures): Exact materials, surface textures, color descriptions, lighting styles, compositions, and art mediums (e.g., "rustic wood", "dark slate", "flat lay", "watercolor style", "top down view", "golden glow", "copy space").
- Tier 3 (Tags 26–40 - Commercial Applications & Buyer Intent): Real-world buyer search intents and product applications (e.g., "recipe card", "food blogging", "restaurant menu", "autumn sale", "greeting card design", "packaging print", "editorial banner").
- Tier 4 (Tags 41–${targetKwCount} - Conceptual Synonyms & Broader Seasonal Context): General seasonal, holiday, and atmospheric search terms without fluff (e.g., "harvest time", "autumn season", "thanksgiving holiday", "fall celebration", "cozy vibes").
- Tailored & Non-Identical: The generated keyword set for each file MUST be tailored and non-identical across the batch.
- Strictly lowercase, single words or 2-word phrases only, no commas inside tags, no duplicates, NO trademarked brand names (no Apple, Disney, Nike, etc.), NO spam/negative tags.

=== 4. STRICT MICROSTOCK COMPLIANCE RULES ===
- Title: Exactly ONE clear, commercial sentence (60–90 characters optimal, max 100 characters).
  * Packed with top relevant search keywords.
  * CRITICAL FOR MICROSTOCK: STRICTLY NEVER include commas in the title (Adobe Stock forbids commas and will reject the file). Replace commas with "and", "with", or natural flow.
  * No quotation marks or special punctuation.
- Description: 1–2 clean sentences accurately detailing the visual composition, specific textures, lighting, and commercial design utility.
- Keywords: Exactly ${targetKwCount} tags following the strict hierarchy above.
- Category: Accurate primary microstock category (e.g., Graphic Resources, Backgrounds/Textures, Holidays, Animals, Food, Architecture, Business, Technology, Lifestyle).

Filename: "${filename}"
Unique File Fingerprint (SHA256 Hash Seed): ${fileHash}
Processing Timestamp: ${timestamp}
${cleanSubject ? `Primary Subject: "${cleanSubject}"` : ''}
${isVector ? `Asset Format: Scalable Vector Graphic / Artwork Asset.` : ''}
${vectorSemanticText ? `\n--- EMBEDDED VECTOR FILE PROPERTIES & METADATA ---\n${vectorSemanticText}\n-----------------------------------------------` : ''}
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}

CRITICAL ANTI-REPETITION INSTRUCTIONS FOR THIS ASSET:
1. Dynamic Sentence Architecture: FORBID starting with repetitive formulas like "Autumn harvest...", "Happy Thanksgiving...", "Autumn border...", "Fall background...", "Cute...", or "Set of...". Dynamically select and rotate across the 5 entry points (Object/Detail First, Layout/Composition First, Artistic Style First, Concept/Mood First, or Color/Texture First) to make this title 100% distinct.
2. High-Precision Micro-Visual Extraction: Identify the exact surface textures (e.g., rustic wood table, black slate, chalkboard, navy backdrop), exact produce/botanical elements (e.g., pomegranate, sunflower, wheat, cornucopia), lighting (e.g., warm volumetric glow, dramatic smoke), and art style.
3. Micro-Detail Tags First: Place specific visual nouns (e.g., "pomegranate", "chalkboard", "wood texture") at the top of the keywords list (Tags 1-10) before generic thematic tags ("autumn", "thanksgiving").
4. Strict Compliance: Exactly ONE title sentence (60-90 chars) with STRICTLY NO COMMAS. Exactly ${targetKwCount} unique lowercase keywords. Valid JSON response only.

JSON Response Format:
{
  "title": "Distinctive commercial title without any commas",
  "description": "Vivid commercial description highlighting specific micro-textures, lighting, and microstock design applications.",
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
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('resource_exhausted')
      ) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      // If parsing failed or single request failed, try next model as fallback
      await new Promise((r) => setTimeout(r, 500));
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
