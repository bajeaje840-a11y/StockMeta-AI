import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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
      model = 'gemini-2.5-flash',
    } = req.body || {};

    const activeApiKey = (userApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!activeApiKey) {
      return res.status(400).json({
        success: false,
        error: 'Gemini API key is required. Please set GEMINI_API_KEY in Vercel environment variables or enter key in AI Settings.',
      });
    }

    let cleanBase64 = String(base64Data || '').trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '');

    const isVector = /\.(eps|ai|svg|pdf|cdr|ps)$/i.test(filename || '') || (mimeType && mimeType.includes('svg'));
    const hasImage = cleanBase64.length > 50;

    if (!hasImage && !isVector) {
      return res.status(400).json({ success: false, error: 'No image or vector data provided' });
    }

    const safeMime = mimeType?.startsWith('image/') ? mimeType.split(';')[0].trim() : 'image/jpeg';
    const targetKwCount = Math.max(25, Math.min(49, keywordCount || 49));

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
  "title": "Clear commercial title without any commas",
  "description": "Accurate visual description of the artwork",
  "keywords": ["keyword1", "keyword2", ...],
  "category_guess": "Graphic Resources"
}`;

    const promptText = `Analyze the visual content of this artwork in complete detail.
Filename: "${filename || 'stock_media'}".
${isVector ? `Asset Format: Scalable Vector Graphic / Vector Artwork Asset.` : ''}
Target Keyword Count: Exactly ${targetKwCount} unique keywords.
${customPromptHint ? `Custom Guidance: ${customPromptHint}` : ''}
Inspect the visual image carefully and generate premium, 100% content-accurate microstock SEO metadata as valid JSON.`;

    const ai = new GoogleGenAI({ apiKey: activeApiKey });
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
      model: model || 'gemini-2.5-flash',
      contents: parts,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = extractJsonFromText(response.text || '{}');
    return res.json({
      success: true,
      metadata: parsed,
      providerUsed: 'gemini',
      modelUsed: model,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate metadata on Vercel',
    });
  }
}
