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

    const systemInstruction = `You are a world-class Senior AI Prompt Engineer & Microstock SEO Specialist for Adobe Stock, Shutterstock, Freepik, Getty Images, and Vecteezy.
Analyze the provided visual asset (photo, texture, vector illustration, icon set, seamless pattern, 3D render, or graphic) in extreme visual detail and generate high-converting, strictly compliant commercial SEO metadata in valid JSON format.

=== 1. EXPANDED SEO TITLES (TARGET: 80–100 CHARACTERS, MAX 100 CHARACTERS) ===
Microstock platforms (especially Adobe Stock & Shutterstock) prioritize descriptive, high-density titles that accurately capture visual nuance while maintaining strict compliance.
- TARGET LENGTH: Rich, highly descriptive title between 80 and 100 characters (strictly max 100 characters). Do NOT produce brief, generic 30-50 character titles.
- RICH VISUAL DETAIL DENSITY: Pack the title with specific visual attributes:
  * Exact Subject & Focus: Concrete subject nouns and visual items.
  * Art Style & Technique: 3D render, watercolor painting, flat vector illustration, macro photography, isometric vector, linocut print, top down flat lay, etc.
  * Color Scheme & Palette: Dominant hues, lighting tone, background contrast (e.g., golden warm palette, dark chalkboard ground, pastel aesthetic).
  * Composition & Texture: Framing, perspective, surface materials (e.g., rustic wood texture, marble table, isolated white background, copy space).
  * Design & Buyer Use Cases: Commercial utility and theme (e.g., banner design, holiday celebration, culinary menu, corporate concept).
- STRICT FORBIDDEN PUNCTUATION (CRITICAL FOR ADOBE STOCK):
  * STRICTLY NEVER include commas (,) in the title. Adobe Stock will reject files with commas in titles. Use "and", "with", "for", "featuring", or natural syntax instead.
  * Never use quotes, brackets, or decorative symbols.
- DYNAMIC SENTENCE ARCHITECTURE & ANTI-REPETITION:
  * NEVER start titles with repetitive formulaic openers like "Autumn harvest...", "Happy Thanksgiving...", "Autumn border...", "Fall background...", "Cute...", "Set of...", "Vector illustration of...", "A photo of...", "Isolated...", "Vibrant...", or "Festive...".
  * Weave thematic words into the middle/qualifier position of the sentence.
  * Dynamically rotate across 5 sentence entry points:
    1. Object/Detail First: Lead with concrete focal elements (e.g., "Pomegranates Walnuts and Gourds Arranged on Rustic Wood for Thanksgiving Dinner")
    2. Layout/Composition First: Lead with perspective/framing (e.g., "Top Down Flat Lay of Golden Maple Leaves with Generous Copy Space on Dark Slate")
    3. Artistic Style First: Lead with rendering medium (e.g., "Watercolor Botanical Frame Featuring Orange Pumpkins and Foliage for Autumn Holiday")
    4. Concept/Mood First: Lead with atmospheric concept (e.g., "Warm Harvest Season Celebration Concept with Pinecones and Cinnamon Sticks")
    5. Color/Texture First: Lead with background or color harmony (e.g., "Dark Purple Background Framed with Seasonal Fall Produce and Fresh Herbs")

=== 2. HIGH-PRECISION MICRO-VISUAL EXTRACTION ===
Extract tangible micro-details that make this specific file unique:
- Surface & Ground Texture: rustic wood, black slate, chalkboard, navy backdrop, aged parchment, marble counter, burlap fabric, isolated white ground.
- Flora, Food & Object Inventory: specific botanical varieties and items (e.g., pomegranate, sunflower, golden wheat, cornucopia, striped pumpkin, acorn squash, dry pinecones, walnuts, whole cinnamon sticks, cranberries, star anise).
- Lighting & Atmosphere: dramatic chiaroscuro shadows, warm volumetric glow, soft studio illumination, rim lighting.
- Visual Fidelity: Describe ONLY what is genuinely visible in the artwork. Never hallucinate absent items.

=== 3. AUTOMATED ADOBE STOCK CATEGORY ASSIGNMENT (1 TO 21) ===
Analyze the visual asset and map it strictly to one of the 21 official Adobe Stock Categories:
1. Animals
2. Buildings and Architecture
3. Business
4. Drinks
5. Environment
6. States of Mind
7. Food
8. Graphic Resources (use for icons, UI kits, abstract backgrounds, vectors, textures, design elements, templates)
9. Hobbies and Leisure
10. Industry
11. Landscapes
12. Lifestyle
13. People
14. Plants and Flowers
15. Culture and Religion
16. Science
17. Social Issues
18. Sports
19. Technology
20. Transport
21. Travel

Output the exact official category name in "category" and its corresponding number (1-21) in "category_id".

=== 4. UNIQUE & CONTEXT-DRIVEN KEYWORDS (TAGS) ===
Provide EXACTLY ${targetKwCount} unique, high-traffic commercial tags in strict descending SEO hierarchy:
- Tier 1 (Tags 1–10 - Primary SEO Weight): Specific, distinctive visual elements and micro-detail nouns (e.g., "pomegranate", "chalkboard", "wood texture", "sunflower", "pinecone", "walnut", "cinnamon").
- Tier 2 (Tags 11–25 - Visual Attributes & Textures): Materials, surface textures, colors, lighting, art mediums (e.g., "rustic wood", "dark slate", "flat lay", "watercolor style", "top down view", "golden glow", "copy space").
- Tier 3 (Tags 26–40 - Commercial Applications): Buyer search intents (e.g., "recipe card", "food blogging", "restaurant menu", "autumn sale", "greeting card design", "packaging print", "editorial banner").
- Tier 4 (Tags 41–${targetKwCount} - Broad Seasonal Context): General thematic and conceptual terms without fluff (e.g., "harvest time", "autumn season", "thanksgiving holiday", "fall celebration", "cozy vibes").
- Format: Strictly lowercase, single words or 2-word phrases only, no commas inside tags, no duplicates, NO trademarked brand names (no Apple, Nike, etc.), NO spam.

=== 5. STRICT JSON RESPONSE SCHEMA ===
Respond ONLY with valid JSON matching this schema:
{
  "title": "Rich descriptive commercial title between 80 and 100 characters without any commas",
  "description": "Vivid commercial description detailing specific visual composition, micro-textures, lighting, and stock design applications.",
  "keywords": ["tag1", "tag2", ...],
  "category": "Graphic Resources",
  "category_id": 8,
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Analyze the visual content and design of this artwork in complete detail.
Filename: "${filename || 'stock_media'}"
${cleanSubject ? `Primary Subject: "${cleanSubject}"` : ''}
${isVector ? `Asset Format: Scalable Vector Graphic / Vector Artwork Asset.` : ''}
${vectorSemanticText ? `\n--- EMBEDDED VECTOR FILE PROPERTIES & METADATA ---\n${vectorSemanticText}\n-----------------------------------------------` : ''}
Target Keyword Count: Exactly ${targetKwCount} unique keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}

CRITICAL EXECUTION CHECKLIST:
1. Expanded Title (80-100 chars): Rich, descriptive, full-length commercial title packed with visual detail (80-100 characters, strictly max 100). STRICTLY ZERO COMMAS in the title.
2. Adobe Stock Category: Assign the most accurate official Adobe Stock category (1 of the 21 official categories) with exact category name and numeric category_id (1-21).
3. Anti-Repetition: Do not use generic openers ("Autumn harvest...", "Cute...", "Set of..."). Rotate sentence entry points.
4. Micro-Detail Tags First: Place specific visual nouns at the top of the tag list (Tags 1-10) before general themes. Exactly ${targetKwCount} lowercase tags.`;

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
