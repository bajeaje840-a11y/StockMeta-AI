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

    // 1. Check Binary EPS Header magic: 0xC5 0xD0 0xD3 0xC6
    if (
      fileBuffer.length > 32 &&
      fileBuffer[0] === 0xC5 &&
      fileBuffer[1] === 0xD0 &&
      fileBuffer[2] === 0xD3 &&
      fileBuffer[3] === 0xC6
    ) {
      const tiffOffset = fileBuffer.readUInt32LE(20);
      const tiffLength = fileBuffer.readUInt32LE(24);

      if (tiffOffset > 0 && tiffLength > 50 && tiffOffset + tiffLength <= fileBuffer.length) {
        const previewSlice = fileBuffer.subarray(tiffOffset, tiffOffset + tiffLength);
        // If it's a JPEG stream
        if (previewSlice[0] === 0xFF && previewSlice[1] === 0xD8 && previewSlice[2] === 0xFF) {
          const b64 = previewSlice.toString('base64');
          return res.json({
            success: true,
            previewUrl: `data:image/jpeg;base64,${b64}`,
            base64Data: b64,
            mimeTypeForAi: 'image/jpeg',
          });
        }
      }
    }

    // 2. Check embedded XMP base64 JPEG/PNG thumbnail
    const strHead = fileBuffer.slice(0, Math.min(fileBuffer.length, 15000000)).toString('latin1');
    const xmpPatterns = [
      /<(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)[^>]*>([\s\S]*?)<\/(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)>/gi,
      /(?:xmpGImg:image|photoshop:Thumbnail|xapGImg:image)=["']([A-Za-z0-9+/=\s\r\n]{100,})["']/gi,
    ];

    for (const pattern of xmpPatterns) {
      const matches = strHead.matchAll(pattern);
      for (const match of matches) {
        if (match && match[1]) {
          const cleanB64 = match[1].replace(/[\r\n\s]/g, '');
          if (cleanB64.length > 80) {
            return res.json({
              success: true,
              previewUrl: `data:image/jpeg;base64,${cleanB64}`,
              base64Data: cleanB64,
              mimeTypeForAi: 'image/jpeg',
            });
          }
        }
      }
    }

    // 3. Check for embedded JPEG stream across file buffer
    for (let i = 0; i < Math.min(fileBuffer.length - 500, 10000000); i++) {
      if (fileBuffer[i] === 0xFF && fileBuffer[i + 1] === 0xD8 && fileBuffer[i + 2] === 0xFF) {
        let endIdx = -1;
        const maxSearch = Math.min(fileBuffer.length - 1, i + 8 * 1024 * 1024);
        for (let j = i + 300; j < maxSearch; j++) {
          if (fileBuffer[j] === 0xFF && fileBuffer[j + 1] === 0xD9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i && endIdx - i > 1000) {
          const jpegSlice = fileBuffer.subarray(i, endIdx);
          const b64 = jpegSlice.toString('base64');
          return res.json({
            success: true,
            previewUrl: `data:image/jpeg;base64,${b64}`,
            base64Data: b64,
            mimeTypeForAi: 'image/jpeg',
          });
        }
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
