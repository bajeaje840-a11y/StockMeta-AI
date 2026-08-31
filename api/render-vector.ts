import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { fileData } = req.body || {};
    if (!fileData) {
      return res.status(400).json({ success: false, error: 'Empty file payload' });
    }

    let cleanBase64 = String(fileData).trim();
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1].trim();
    }
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    // Check for embedded XMP base64 JPEG thumbnail
    const strHead = fileBuffer.slice(0, 1000000).toString('latin1');
    const xmpMatch = strHead.match(/<(?:xmpGImg|xapGImg|photoshop):(?:image|Thumbnail)>([\s\S]*?)<\/(?:xmpGImg|xapGImg|photoshop):(?:image|Thumbnail)>/i);
    if (xmpMatch && xmpMatch[1]) {
      const cleanB64 = xmpMatch[1].replace(/[\r\n\s]/g, '');
      if (cleanB64.length > 500) {
        return res.json({
          success: true,
          previewUrl: `data:image/jpeg;base64,${cleanB64}`,
          base64Data: cleanB64,
          mimeTypeForAi: 'image/jpeg',
        });
      }
    }

    return res.status(422).json({
      success: false,
      error: 'Client vector canvas will rasterize this artwork directly.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Vector render failed',
    });
  }
}
