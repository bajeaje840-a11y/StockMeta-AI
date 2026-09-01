import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const hasEnvKey = !!process.env.GEMINI_API_KEY;
  return res.json({
    success: true,
    hasServerPool: hasEnvKey,
    keyCount: hasEnvKey ? 1 : 0,
    serverReady: true,
  });
}
