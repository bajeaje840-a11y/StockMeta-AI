import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
  return model;
}

function extractJsonFromText(rawText: string): any {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (e2) {}
    }
    throw new Error(`Failed to parse JSON: ${cleaned.substring(0, 80)}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      base64Data,
      mimeType = 'image/jpeg',
      filename,
      keywordCount = 49,
      customPromptHint,
      apiKey: userApiKey,
      model,
      provider = 'gemini',
      baseUrl,
      vectorSemanticText,
      isRealArtworkPreview,
      cleanSubject: clientCleanSubject,
    } = req.body || {};

    const activeProvider = (provider || 'gemini').toLowerCase().trim();
    let cleanBase64 = String(base64Data || '').trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

    const isVector = /\.(eps|ai|svg|pdf|cdr|ps)$/i.test(filename || '') || (mimeType && mimeType.includes('svg'));
    // Only pass image to Vision if it has genuine image data and is a real artwork preview
    const isRealVisual = isRealArtworkPreview !== false;
    const hasImage = cleanBase64.length > 50 && isRealVisual;

    if (!hasImage && !isVector && cleanBase64.length <= 50) {
      return res.status(400).json({ success: false, error: 'No image or vector data provided for visual analysis' });
    }

    const safeMime = mimeType?.startsWith('image/') ? mimeType.split(';')[0].trim() : 'image/jpeg';
    const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));

    const cleanSubject = clientCleanSubject || (filename
      ? filename
          .replace(/\.[^/.]+$/, '')
          .replace(/^create[_\s-]+/i, '')
          .replace(/_\d{8,}(?:_\d+)?/g, '')
          .replace(/[-_]+/g, ' ')
          .trim()
      : '');

    const systemInstruction = `You are a world-class Stock Media SEO Specialist & Keywording Expert for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual asset (photo, texture, vector illustration, icon set, 3D render, or graphic) in extreme visual detail and generate high-converting, strictly compliant commercial SEO metadata in valid JSON format.

DEEP VISUAL & CONTENT ANALYSIS REQUIREMENTS:
1. Visual Content & Main Subjects: Thoroughly examine the visual artwork/image or vector semantic properties. Identify the exact objects, design style, vector illustrations, badges, icons, typography, shapes, symbols, background scenery, and color palette present in the artwork.
2. Vector Graphics Rule: If analyzing a vector graphic or EPS/AI file, generate metadata describing the actual subject matter and visual objects. NEVER generate metadata about an "EPS file", "EPS badge", or "file icon".
3. Concept & Mood: Identify practical concepts, industries, and intended use cases (e.g. web banners, posters, mobile UI, packaging, advertising, branding).
4. Composition & Art Style: Recognize whether it is flat vector art, isometric, vintage emblem, line art, modern minimalist, geometric pattern, or 3D render.

STRICT MICROSTOCK COMPLIANCE RULES:
- Title: Exactly ONE clear, highly descriptive, commercial sentence (60-90 characters) describing the EXACT visual content. Packed with top search keywords. Strictly NEVER include commas in the title (Adobe Stock forbids commas). No quotation marks.
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
  "title": "Clear commercial title without any commas",
  "description": "Accurate visual description of the artwork",
  "keywords": ["keyword1", "keyword2", ...],
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Analyze the content and visual design of this artwork in complete detail.
Filename: "${filename || 'stock_media'}"
${cleanSubject ? `Primary Subject: "${cleanSubject}"` : ''}
${isVector ? `Asset Format: Scalable Vector Graphic / Vector Artwork Asset.` : ''}
${vectorSemanticText ? `\n--- EMBEDDED VECTOR FILE PROPERTIES & METADATA ---\n${vectorSemanticText}\n-----------------------------------------------` : ''}
Target Keyword Count: Exactly ${targetKwCount} unique keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}
Inspect the artwork carefully and generate premium, 100% content-accurate microstock SEO metadata as valid JSON.`;

    // 1. GEMINI
    if (activeProvider === 'gemini') {
      const activeApiKey = (userApiKey || process.env.GEMINI_API_KEY || '').trim();
      if (!activeApiKey) {
        return res.status(400).json({
          success: false,
          error: 'Gemini API key is required. Please set GEMINI_API_KEY or provide your key in AI Settings.',
        });
      }

      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const selectedModel = normalizeGeminiModel(model);
      const candidateModels = Array.from(new Set([
        selectedModel,
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.1-pro-preview',
      ]));

      let lastError: any = null;
      let rawText = '';
      let actualModelUsed = selectedModel;

      for (const curModel of candidateModels) {
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

          const response = await ai.models.generateContent({
            model: curModel,
            contents: parts,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          rawText = response.text || '';
          if (rawText) {
            actualModelUsed = curModel;
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errStr = (err?.message || String(err)).toLowerCase();

          // If image decoding error, try text-only fallback
          if (errStr.includes('decode') || errStr.includes('image') || errStr.includes('bad request') || errStr.includes('400')) {
            try {
              const fallbackResponse = await ai.models.generateContent({
                model: curModel,
                contents: `${promptText}\nNote: Scalable vector graphic asset "${filename}". Subject: "${cleanSubject}". Generate complete commercial stock JSON metadata.`,
                config: {
                  systemInstruction,
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                },
              });
              rawText = fallbackResponse.text || '';
              if (rawText) {
                actualModelUsed = curModel;
                break;
              }
            } catch {}
          }

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
            errStr.includes('fetch failed')
          ) {
            continue;
          }
          break;
        }
      }

      if (!rawText) {
        throw lastError || new Error('Google Gemini failed to generate metadata.');
      }

      const parsed = extractJsonFromText(rawText);
      return res.json({
        success: true,
        metadata: parsed,
        providerUsed: 'gemini',
        modelUsed: actualModelUsed,
      });
    }

    // 2. OPENAI
    if (activeProvider === 'openai') {
      const activeApiKey = (userApiKey || process.env.OPENAI_API_KEY || '').trim();
      if (!activeApiKey) {
        return res.status(400).json({ success: false, error: 'OpenAI API key is required.' });
      }

      const endpoint = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
      const openAiModel = model || 'gpt-4o';

      const userContent: any[] = [];
      if (hasImage) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${safeMime};base64,${cleanBase64}`,
            detail: 'high',
          },
        });
      }
      userContent.push({ type: 'text', text: promptText });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeApiKey}`,
        },
        body: JSON.stringify({
          model: openAiModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI error (${response.status}): ${errText}`);
      }

      const json = await response.json();
      const rawText = json.choices?.[0]?.message?.content || '{}';
      const parsed = extractJsonFromText(rawText);

      return res.json({
        success: true,
        metadata: parsed,
        providerUsed: 'openai',
        modelUsed: openAiModel,
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${activeProvider}` });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate metadata on Vercel',
    });
  }
}
