import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
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
      timeout: 60000,
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
  if (!model) return 'gemini-3.6-flash';
  const m = model.toLowerCase().trim();
  if (
    m === 'gemini-2.5-flash' ||
    m === 'gemini-2.0-flash' ||
    m === 'gemini-1.5-flash' ||
    m === 'gemini-flash' ||
    m === 'flash'
  ) {
    return 'gemini-3.6-flash';
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
  if (m === 'gemini-3.6-flash') {
    return 'gemini-3.6-flash';
  }
  if (m === 'gemini-3.1-flash-lite' || m === 'flash-lite' || m === 'lite') {
    return 'gemini-3.1-flash-lite';
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
      return 'Invalid Gemini API Key. Google Gemini keys start with "AQ." or "AIzaSy...". Please verify your key at https://aistudio.google.com/app/apikey or leave the key field empty to use the built-in free AI.';
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
    if (
      lower.includes('timeout') ||
      lower.includes('fetch failed') ||
      lower.includes('headerstimeouterror') ||
      lower.includes('econnreset') ||
      lower.includes('etimedout') ||
      lower.includes('und_err')
    ) {
      return 'Connection timed out or network error. Please verify your connection or try again.';
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
      const candidateModels = Array.from(new Set([
        testModel,
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.1-pro-preview',
      ]));
      
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
              : `Connected to your Google Gemini API (${curModel}) successfully!`,
            modelUsed: curModel,
            reply: response.text?.trim() || 'OK',
          });
        } catch (err: any) {
          lastErr = err;
          console.error(`[Test Key Error] model: ${curModel}, err:`, err);
          const errStr = (err?.message || err?.cause?.message || String(err)).toLowerCase();
          if (
            errStr.includes('503') ||
            errStr.includes('unavailable') ||
            errStr.includes('high demand') ||
            errStr.includes('404') ||
            errStr.includes('not found') ||
            errStr.includes('429') ||
            errStr.includes('resource_exhausted') ||
            errStr.includes('timeout') ||
            errStr.includes('fetch failed') ||
            errStr.includes('econnreset') ||
            errStr.includes('und_err') ||
            errStr.includes('headerstimeout') ||
            errStr.includes('headers timeout')
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
 * Multi-Strategy High-Fidelity Vector Preview & AI Visual Renderer (Ghostscript & ImageMagick)
 * Converts EPS, AI, PS, PDF vector files directly into color-accurate, high-resolution JPEG images.
 */
export function renderVectorBufferToJpeg(fileBuffer: Buffer, filename?: string): Buffer | null {
  const tmpDir = os.tmpdir();
  const randId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ext = (filename && path.extname(filename)) ? path.extname(filename).toLowerCase() : '.eps';
  const outPath = path.join(tmpDir, `vector_out_${randId}.jpg`);

  try {
    // Strategy 1: Check for embedded PDF stream (Common in Adobe Illustrator AI/EPS files)
    const pdfIdx = fileBuffer.indexOf('%PDF-');
    if (pdfIdx !== -1) {
      const pdfPath = path.join(tmpDir, `embedded_${randId}.pdf`);
      try {
        fs.writeFileSync(pdfPath, fileBuffer.slice(pdfIdx));
        execSync(
          `gs -dSAFER -dBATCH -dNOPAUSE -dQUIET -sDEVICE=jpeg -dJPEGQ=92 -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="${outPath}" "${pdfPath}"`,
          { timeout: 15000, stdio: 'pipe' }
        );
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
          return fs.readFileSync(outPath);
        }
      } catch (e) {
        // Continue to next strategy
      } finally {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      }
    }

    // Strategy 2: Check for Binary EPS Header (0xC5 0xD0 0xD3 0xC6)
    if (fileBuffer.length > 30 && fileBuffer[0] === 0xC5 && fileBuffer[1] === 0xD0 && fileBuffer[2] === 0xD3 && fileBuffer[3] === 0xC6) {
      const psOffset = fileBuffer.readUInt32LE(4);
      const psLength = fileBuffer.readUInt32LE(8);
      const tiffOffset = fileBuffer.readUInt32LE(20);
      const tiffLength = fileBuffer.readUInt32LE(24);

      // Try TIFF preview from binary header
      if (tiffOffset > 0 && tiffLength > 0 && fileBuffer.length >= tiffOffset + tiffLength) {
        const tiffPath = path.join(tmpDir, `embedded_${randId}.tif`);
        try {
          fs.writeFileSync(tiffPath, fileBuffer.slice(tiffOffset, tiffOffset + tiffLength));
          execSync(`convert "${tiffPath}" "${outPath}"`, { timeout: 15000, stdio: 'pipe' });
          if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
            return fs.readFileSync(outPath);
          }
        } catch (e) {
          // Fallback to PS extraction
        } finally {
          if (fs.existsSync(tiffPath)) fs.unlinkSync(tiffPath);
        }
      }

      // Try PS block from binary header
      if (psOffset > 0 && psLength > 0 && fileBuffer.length >= psOffset + psLength) {
        const psPath = path.join(tmpDir, `extracted_${randId}.eps`);
        try {
          fs.writeFileSync(psPath, fileBuffer.slice(psOffset, psOffset + psLength));
          execSync(
            `gs -dSAFER -dBATCH -dNOPAUSE -dQUIET -dEPSCrop -sDEVICE=jpeg -dJPEGQ=92 -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="${outPath}" "${psPath}"`,
            { timeout: 15000, stdio: 'pipe' }
          );
          if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
            return fs.readFileSync(outPath);
          }
        } catch (e) {
          // Continue
        } finally {
          if (fs.existsSync(psPath)) fs.unlinkSync(psPath);
        }
      }
    }

    // Strategy 3: Check for embedded XMP base64 JPEG thumbnail
    const strHead = fileBuffer.slice(0, 1000000).toString('latin1');
    const xmpMatch = strHead.match(/<(?:xmpGImg|xapGImg|photoshop):(?:image|Thumbnail)>([\s\S]*?)<\/(?:xmpGImg|xapGImg|photoshop):(?:image|Thumbnail)>/i);
    if (xmpMatch && xmpMatch[1]) {
      try {
        const cleanB64 = xmpMatch[1].replace(/[\r\n\s]/g, '');
        const xmpBuf = Buffer.from(cleanB64, 'base64');
        if (xmpBuf.length > 500) {
          fs.writeFileSync(outPath, xmpBuf);
          if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
            return fs.readFileSync(outPath);
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 4: Direct Ghostscript with -dEPSCrop
    const inPath = path.join(tmpDir, `raw_${randId}${ext}`);
    fs.writeFileSync(inPath, fileBuffer);

    try {
      execSync(
        `gs -dSAFER -dBATCH -dNOPAUSE -dQUIET -dEPSCrop -sDEVICE=jpeg -dJPEGQ=92 -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="${outPath}" "${inPath}"`,
        { timeout: 15000, stdio: 'pipe' }
      );
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
        return fs.readFileSync(outPath);
      }
    } catch (e) {}

    // Strategy 5: Ghostscript standard (without EPSCrop)
    try {
      execSync(
        `gs -dSAFER -dBATCH -dNOPAUSE -dQUIET -sDEVICE=jpeg -dJPEGQ=92 -r150 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="${outPath}" "${inPath}"`,
        { timeout: 15000, stdio: 'pipe' }
      );
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
        return fs.readFileSync(outPath);
      }
    } catch (e) {}

    // Strategy 6: ImageMagick Convert
    try {
      execSync(`convert -density 150 "${inPath}" -background white -flatten "${outPath}"`, { timeout: 15000, stdio: 'pipe' });
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 500) {
        return fs.readFileSync(outPath);
      }
    } catch (e) {}

    return null;
  } catch (err) {
    console.warn('Vector rendering exception:', err);
    return null;
  } finally {
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (cleanErr) {}
  }
}

app.post('/api/render-vector', async (req, res) => {
  try {
    const { fileData, filename } = req.body;
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'Missing fileData' });
    }

    let cleanBase64 = String(fileData).trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

    const fileBuffer = Buffer.from(cleanBase64, 'base64');
    if (fileBuffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Empty file buffer' });
    }

    const jpegBuffer = renderVectorBufferToJpeg(fileBuffer, filename);
    if (!jpegBuffer || jpegBuffer.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Vector rendering engine could not rasterize this PostScript/EPS file.',
      });
    }

    const outBase64 = jpegBuffer.toString('base64');
    const previewUrl = `data:image/jpeg;base64,${outBase64}`;

    return res.json({
      success: true,
      previewUrl,
      base64Data: outBase64,
      mimeTypeForAi: 'image/jpeg',
    });
  } catch (err: any) {
    console.error('Vector rendering endpoint error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to render vector preview',
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

    let cleanBase64 = String(base64Data || '').trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

    const isVector = /\.(eps|ai|svg|pdf|cdr|ps)$/i.test(filename || '') || (mimeType && mimeType.includes('svg'));
    let hasImage = cleanBase64.length > 50;

    // If raw vector payload was passed instead of pre-rendered image, attempt on-the-fly rendering
    if (isVector && cleanBase64.length > 0 && (!mimeType || mimeType.includes('postscript') || mimeType.includes('pdf'))) {
      try {
        const rawBuf = Buffer.from(cleanBase64, 'base64');
        const renderedJpeg = renderVectorBufferToJpeg(rawBuf, filename);
        if (renderedJpeg && renderedJpeg.length > 500) {
          cleanBase64 = renderedJpeg.toString('base64');
          hasImage = true;
        }
      } catch (e) {
        // Fallback
      }
    }

    if (!hasImage && !isVector) {
      return res.status(400).json({
        success: false,
        error: 'Missing base64Data image payload for visual analysis',
      });
    }

    const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    let safeMimeType = (mimeType || '').toLowerCase().trim();
    if (safeMimeType.includes(';')) {
      safeMimeType = safeMimeType.split(';')[0].trim();
    }
    if (!ALLOWED_MIMES.includes(safeMimeType)) {
      safeMimeType = 'image/jpeg';
    }

    const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));

    const cleanSubject = filename
      ? filename
          .replace(/\.[^/.]+$/, '')
          .replace(/^create[_\s-]+/i, '')
          .replace(/_\d{8,}(?:_\d+)?/g, '')
          .replace(/[-_]+/g, ' ')
          .trim()
      : '';

    const systemInstruction = `You are a world-class Stock Media SEO Specialist & Keywording Expert for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual asset (photo, texture, vector illustration, icon set, 3D render, or graphic) in extreme visual detail and generate high-converting, strictly compliant commercial SEO metadata in valid JSON format.

DEEP VISUAL ANALYSIS REQUIREMENTS:
1. Visual Content & Main Subjects: Thoroughly examine the visual artwork/image. Identify the exact objects, design style, vector illustrations, badges, icons, typography, shapes, symbols, background scenery, and color palette present in the artwork.
2. Concept & Mood: Identify practical concepts, industries, and intended use cases (e.g. web banners, posters, mobile UI, packaging, advertising, branding).
3. Composition & Art Style: Recognize whether it is flat vector art, isometric, vintage emblem, line art, modern minimalist, geometric pattern, or 3D render.

STRICT MICROSTOCK COMPLIANCE RULES:
- Title: Exactly ONE clear, highly descriptive, commercial sentence (60-90 characters) describing the EXACT visual content in the image. Packed with top search keywords. Strictly NEVER include commas in the title (Adobe Stock forbids commas). No quotation marks.
- Description: 1-2 clean sentences accurately describing the visual elements, design elements, and commercial applications.
- Keywords: Provide EXACTLY ${targetKwCount} unique, high-ranking, buyer-focused keywords.
  * Sort strictly in descending order of search relevance (Tags #1 to #10 must be the most exact, high-traffic terms representing the visual content, as Adobe Stock algorithms weigh the first 10 keywords most heavily).
  * Use concise single words and 2-word phrases only.
  * STRICTLY lowercase, no commas inside tags, no duplicates, no punctuation.
  * NO trademarked brand names (no Apple, iPhone, Nike, Adobe, etc.).
  * NO spam/generic negative tags (no "nobody", "no people", "no person", "white background" unless truly isolated on white).
- Category: Accurate primary category (e.g., Graphic Resources, Transportation, Backgrounds/Textures, Abstract, Architecture, Business, Technology, Food, Lifestyle).

JSON Response Schema:
{
  "title": "Clear descriptive commercial title without any commas",
  "description": "Commercial description describing visual elements and practical microstock applications.",
  "keywords": ["tag1", "tag2", ...],
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Analyze the visual content of this artwork in complete detail.
Filename: "${filename || 'stock_media'}".
${isVector ? `Asset Format: Scalable Vector Graphic / Vector Artwork Asset.` : ''}
Target Keyword Count: Exactly ${targetKwCount} unique keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}
Inspect the visual image carefully and generate premium, 100% content-accurate microstock SEO metadata as valid JSON.`;

    let resultText = '';

    // ==========================================
    // 1. GOOGLE GEMINI PROVIDER
    // ==========================================
    if (provider === 'gemini') {
      const selectedModel = normalizeGeminiModel(model);
      const candidateModels = Array.from(new Set([
        selectedModel,
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.1-pro-preview',
      ]));
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

            const geminiParts: any[] = [];
            if (hasImage) {
              geminiParts.push({
                inlineData: {
                  mimeType: safeMimeType,
                  data: cleanBase64,
                },
              });
            }
            geminiParts.push({ text: promptText });

            const response = await ai.models.generateContent({
              model: curModel,
              contents: {
                parts: geminiParts,
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
            const errStr = (err?.message || err?.cause?.message || String(err)).toLowerCase();

            attempts++;

            if (!hasCustomKey && (errStr.includes('429') || errStr.includes('quota') || errStr.includes('limit') || errStr.includes('resource_exhausted'))) {
              activeKeyIndex = (activeKeyIndex + 1) % totalKeys;
            }

            // If it's an image decoding / invalid inlineData / 400 error, try text-only fallback with vector filename and context
            if (errStr.includes('decode') || errStr.includes('image') || errStr.includes('bad request') || errStr.includes('400')) {
              try {
                console.log(`[Gemini AI] Trying fallback text generation for ${filename}...`);
                const textFallbackRes = await ai.models.generateContent({
                  model: curModel,
                  contents: `${promptText}\nNote: This is a professional scalable vector graphic / artwork asset named "${filename}". Please perform deep microstock SEO analysis based on the vector subject "${cleanSubject}" to generate complete commercial JSON metadata.`,
                  config: {
                    systemInstruction,
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                  },
                });

                resultText = textFallbackRes.text || '';
                if (resultText) {
                  modelSuccess = true;
                  break;
                }
              } catch (fallbackTextErr) {
                console.warn('[Gemini AI] Vision decode fallback error:', fallbackTextErr);
              }
            }

            // If it's a 503, 404, 429, quota, timeout or fetch error, switch to next candidate model
            if (
              errStr.includes('503') ||
              errStr.includes('unavailable') ||
              errStr.includes('high demand') ||
              errStr.includes('404') ||
              errStr.includes('not found') ||
              errStr.includes('429') ||
              errStr.includes('quota') ||
              errStr.includes('resource_exhausted') ||
              errStr.includes('timeout') ||
              errStr.includes('fetch failed') ||
              errStr.includes('headers timeout') ||
              errStr.includes('headerstimeout') ||
              errStr.includes('econnreset') ||
              errStr.includes('und_err')
            ) {
              break; // break to next model in candidateModels
            }

            if (hasCustomKey && (errStr.includes('invalid') || errStr.includes('permission_denied') || errStr.includes('403') || errStr.includes('400 bad request'))) {
              console.warn('[Gemini AI] Custom API key failed with auth error. Trying seamless server built-in key fallback...');
              try {
                const { client: fallbackAi } = getGenAIClient();
                const fallbackParts: any[] = [];
                if (hasImage) {
                  fallbackParts.push({
                    inlineData: {
                      mimeType: safeMimeType,
                      data: cleanBase64,
                    },
                  });
                }
                fallbackParts.push({ text: promptText });

                const fallbackResponse = await fallbackAi.models.generateContent({
                  model: curModel,
                  contents: {
                    parts: fallbackParts,
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

      const userContent: any[] = [{ type: 'text', text: promptText }];
      if (hasImage) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${safeMimeType};base64,${cleanBase64}`,
            detail: 'high',
          },
        });
      }

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
              content: userContent,
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

      const claudeContent: any[] = [];
      if (hasImage) {
        claudeContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: safeMimeType === 'image/png' ? 'image/png' : 'image/jpeg',
            data: cleanBase64,
          },
        });
      }
      claudeContent.push({
        type: 'text',
        text: `${promptText}\n\nIMPORTANT: Return ONLY a valid JSON object. Do not include introductory or markdown prose.`,
      });

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
              content: claudeContent,
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

      let requestBody: any = {
        model: selectedModel,
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: hasImage
              ? [
                  { type: 'text', text: promptText },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${safeMimeType};base64,${cleanBase64}`,
                    },
                  },
                ]
              : promptText,
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
      if (!response.ok && response.status === 400 && hasImage) {
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

