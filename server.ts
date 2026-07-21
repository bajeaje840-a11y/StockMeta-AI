import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload limit for base64 image uploads
app.use(express.json({ limit: '50mb' }));

/**
 * Multi-API Key Pool & Round-Robin Rotation Manager
 * Supports comma, newline, space, or semicolon separated keys in GEMINI_API_KEY or GEMINI_API_KEYS
 */
function getApiKeyPool(): string[] {
  const envKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const parsedKeys = envKeys
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !k.startsWith('MY_GEMINI'));

  if (parsedKeys.length === 0) {
    // If process.env.GEMINI_API_KEY is standard single key, fall back to it
    if (process.env.GEMINI_API_KEY) {
      return [process.env.GEMINI_API_KEY.trim()];
    }
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }

  return parsedKeys;
}

let activeKeyIndex = 0;

/**
 * Get GenAI client for the current active key in rotation pool
 */
function getGenAIClientForIndex(index: number): { client: GoogleGenAI; keySnippet: string } {
  const pool = getApiKeyPool();
  const safeIndex = index % pool.length;
  const key = pool[safeIndex];
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
 * API Route: Get current API Key pool status
 */
app.get('/api/key-status', (req, res) => {
  try {
    const pool = getApiKeyPool();
    res.json({
      success: true,
      totalKeys: pool.length,
      currentActiveIndex: activeKeyIndex % pool.length,
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

/**
 * API Route: /api/generate-metadata
 * Processes stock media via Gemini Vision model with automatic multi-key failover rotation
 */
app.post('/api/generate-metadata', async (req, res) => {
  try {
    const { base64Data, mimeType, filename, customPromptHint } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Missing base64Data image payload',
      });
    }

    const keyPool = getApiKeyPool();
    const totalKeys = keyPool.length;

    const systemInstruction = `You are an expert Stock Media Metadata Specialist for Adobe Stock, Shutterstock, and Freepik.
Analyze the provided image/frame and generate high-converting, SEO-optimized metadata.

Strict Guidelines:
1. Title: 1 concise, punchy sentence (MAX 70 characters). NO COMMAS allowed in title.
2. Description: 1-2 plain sentences accurately describing the subject, background, lighting, and mood.
3. Keywords: 20 to 45 relevant tags. Single-word or short two-word phrases only. Ordered strictly by relevance (most important first). NO duplicate words. NO brand or trademark names (e.g. no Apple, Nike, GoPro, Tesla, etc.).
4. Category: A single primary category name (e.g., Animals, Architecture, Business, Drinks, Environment, Food, Graphic Resources, Lifestyle, People, Plants, Science, Sports, Technology, Travel).`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: base64Data,
      },
    };

    const promptText = `Filename: ${filename || 'stock_media'}.${customPromptHint ? ` Context/Hint: ${customPromptHint}` : ''}
Generate stock SEO metadata as JSON.`;

    const textPart = { text: promptText };

    let attempts = 0;
    let lastError: any = null;
    let resultText: string | undefined;

    // Retry loop across API Key pool
    while (attempts < Math.max(totalKeys, 1) * 2) {
      const currentAttemptIndex = (activeKeyIndex + attempts) % totalKeys;
      const { client: ai, keySnippet } = getGenAIClientForIndex(currentAttemptIndex);

      try {
        console.log(
          `[Gemini AI] Attempting metadata generation using API Key #${currentAttemptIndex + 1} of ${totalKeys} (${keySnippet})...`
        );

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: {
            parts: [imagePart, textPart],
          },
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: 'Stock title max 70 chars, no commas',
                },
                description: {
                  type: Type.STRING,
                  description: '1-2 sentence detailed visual description',
                },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '20-45 SEO keywords ordered by relevance',
                },
                category_guess: {
                  type: Type.STRING,
                  description: 'Primary stock category name',
                },
              },
              required: ['title', 'description', 'keywords', 'category_guess'],
            },
          },
        });

        resultText = response.text;
        // On success, update the active key index to this successful key
        activeKeyIndex = currentAttemptIndex;
        break; // Exit retry loop on success
      } catch (err: any) {
        lastError = err;
        const errStr = (err?.message || String(err)).toLowerCase();

        console.warn(
          `[Gemini AI Key #${currentAttemptIndex + 1} Failed] ${err?.message || err}. Rotating to key #${
            ((currentAttemptIndex + 1) % totalKeys) + 1
          }...`
        );

        // Advance attempt counter
        attempts++;

        // If rate limit, quota exhausted or invalid key, advance global index immediately
        if (
          errStr.includes('429') ||
          errStr.includes('quota') ||
          errStr.includes('limit') ||
          errStr.includes('resource_exhausted') ||
          errStr.includes('key_invalid') ||
          errStr.includes('unauthorized')
        ) {
          activeKeyIndex = (activeKeyIndex + 1) % totalKeys;
        }
      }
    }

    if (!resultText) {
      throw new Error(
        `All configured API keys (${totalKeys} keys) reached rate limit or failed. Last error: ${
          lastError?.message || lastError
        }`
      );
    }

    const parsedJson = JSON.parse(resultText);

    // Clean up title (enforce no commas and length <= 70)
    let cleanTitle = (parsedJson.title || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanTitle.length > 70) {
      cleanTitle = cleanTitle.substring(0, 70).trim();
    }

    // Clean up keywords array
    const rawKeywords = Array.isArray(parsedJson.keywords) ? parsedJson.keywords : [];
    const cleanKeywords: string[] = [];
    const seenKw = new Set<string>();

    for (const kw of rawKeywords) {
      if (typeof kw === 'string') {
        const trimmed = kw.trim().toLowerCase();
        if (trimmed && !seenKw.has(trimmed) && trimmed.length <= 35) {
          seenKw.add(trimmed);
          cleanKeywords.push(kw.trim());
        }
      }
    }

    return res.json({
      success: true,
      metadata: {
        title: cleanTitle || 'Untitled Stock Media',
        description: parsedJson.description || cleanTitle,
        keywords: cleanKeywords,
        category_guess: parsedJson.category_guess || 'Graphic Resources',
      },
      keyUsedIndex: activeKeyIndex + 1,
      totalKeys,
    });
  } catch (err: any) {
    console.error('Error generating metadata:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate AI metadata for file.',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'StockMeta AI Server' });
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
