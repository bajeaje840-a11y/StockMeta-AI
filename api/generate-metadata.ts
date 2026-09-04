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
  You MUST randomize and dynamically alternate sentence entry points across every single image based on unique composition. Do NOT repeat the same structure. Rotate across these 5 distinct architectures:
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

JSON Response Schema:
{
  "title": "Distinctive commercial title without any commas",
  "description": "Vivid commercial description highlighting specific micro-textures, lighting, and microstock design applications.",
  "keywords": ["tag1", "tag2", ...],
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Analyze the content and visual design of this artwork in complete detail.
Filename: "${filename || 'stock_media'}"
${cleanSubject ? `Primary Subject: "${cleanSubject}"` : ''}
${isVector ? `Asset Format: Scalable Vector Graphic / Vector Artwork Asset.` : ''}
${vectorSemanticText ? `\n--- EMBEDDED VECTOR FILE PROPERTIES & METADATA ---\n${vectorSemanticText}\n-----------------------------------------------` : ''}
Target Keyword Count: Exactly ${targetKwCount} unique keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}

CRITICAL ANTI-REPETITION INSTRUCTIONS FOR THIS ASSET:
1. Dynamic Sentence Architecture: FORBID starting with repetitive formulas like "Autumn harvest...", "Happy Thanksgiving...", "Autumn border...", "Fall background...", "Cute...", or "Set of...". Dynamically select and rotate across the 5 entry points (Object/Detail First, Layout/Composition First, Artistic Style First, Concept/Mood First, or Color/Texture First) to make this title 100% distinct.
2. High-Precision Micro-Visual Extraction: Identify the exact surface textures (e.g., rustic wood table, black slate, chalkboard, navy backdrop), exact produce/botanical elements (e.g., pomegranate, sunflower, wheat, cornucopia), lighting (e.g., warm volumetric glow, dramatic smoke), and art style.
3. Micro-Detail Tags First: Place specific visual nouns (e.g., "pomegranate", "chalkboard", "wood texture") at the top of the keywords list (Tags 1-10) before generic thematic tags ("autumn", "thanksgiving").
4. Strict Compliance: Exactly ONE title sentence (60-90 chars) with STRICTLY NO COMMAS. Exactly ${targetKwCount} unique lowercase keywords. Valid JSON response only.`;

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
