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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const provider = (req.body?.provider || 'gemini').toLowerCase().trim();
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const model = req.body?.model;
  const baseUrl = req.body?.baseUrl;

  try {
    if (!apiKey && provider !== 'gemini') {
      return res.status(400).json({
        success: false,
        error: `Please enter an API key for ${provider.toUpperCase()}.`,
      });
    }

    // 1. GEMINI
    if (provider === 'gemini') {
      const activeKey = apiKey || process.env.GEMINI_API_KEY || '';
      if (!activeKey) {
        return res.status(400).json({
          success: false,
          error: 'Please provide a Google Gemini API key or set GEMINI_API_KEY.',
        });
      }

      const ai = new GoogleGenAI({ apiKey: activeKey });
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
            message: `Connected to Google Gemini (${curModel}) successfully!`,
            modelUsed: curModel,
            reply: response.text?.trim() || 'OK',
          });
        } catch (err: any) {
          lastErr = err;
          const errStr = (err?.message || String(err)).toLowerCase();
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

      return res.status(400).json({
        success: false,
        error: lastErr?.message || 'Failed to connect to Google Gemini API.',
      });
    }

    // 2. OPENAI
    if (provider === 'openai') {
      const endpoint = (baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
      const testModel = model || 'gpt-4o-mini';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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

    // 3. CLAUDE
    if (provider === 'claude') {
      const endpoint = (baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/+$/, '') + '/messages';
      const testModel = model || 'claude-3-5-haiku-20241022';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
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

    // 4. DEEPSEEK / CUSTOM
    if (provider === 'deepseek' || provider === 'custom') {
      const defaultBase = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
      const endpoint = (baseUrl?.trim() || defaultBase).replace(/\/+$/, '') + '/chat/completions';
      const testModel = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
    return res.status(400).json({
      success: false,
      error: err?.message || `Failed to connect to ${provider.toUpperCase()}`,
    });
  }
}
