/**
 * Utility functions for handling file sizes, types, previews, and rasterization
 */

export function bytesToSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export type FormatCategory = 'image' | 'vector' | 'video' | 'pdf' | 'other';

export function getFormatCategory(filename: string, mimeType: string): FormatCategory {
  const ext = getFileExtension(filename);

  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext) || mimeType.startsWith('video/')) {
    return 'video';
  }
  if (['ai', 'eps', 'svg'].includes(ext)) {
    return 'vector';
  }
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return 'pdf';
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff', 'tif', 'heic', 'heif'].includes(ext) || mimeType.startsWith('image/')) {
    return 'image';
  }
  return 'other';
}

/**
 * Reads a File object as a Base64 data URL string
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts a representative frame from a video file (MP4/MOV) as a PNG Data URL
 */
export function captureVideoFrame(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    // Timeout fallback if video can't load or play in browser
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('Video frame capture timed out'));
    }, 8000);

    video.onloadeddata = () => {
      // Seek to 0.5s or middle to get a good representative frame
      video.currentTime = Math.min(0.5, video.duration / 2 || 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          clearTimeout(timeout);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
          return;
        }
      } catch (e) {
        console.warn('Canvas video capture error:', e);
      }
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render video frame to canvas'));
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Could not load video for frame extraction'));
    };
  });
}

/**
 * Renders an SVG file to a PNG canvas data URL
 */
export function renderSvgToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const img = new Image();
      const svgBlob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(pngUrl);
        } else {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable'));
        }
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Downscales an image/dataUrl to max dimensions (960px) and converts to JPEG for fast AI vision processing
 */
export function compressImageForAi(dataUrl: string, maxDim = 960): Promise<{ base64Data: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width || 800;
      canvas.height = height || 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.80);
        resolve({
          base64Data: compressedDataUrl.split(',')[1],
          mimeType: 'image/jpeg',
        });
      } else {
        resolve({
          base64Data: dataUrl.split(',')[1] || '',
          mimeType: 'image/jpeg',
        });
      }
    };
    img.onerror = () => {
      resolve({
        base64Data: dataUrl.split(',')[1] || '',
        mimeType: 'image/jpeg',
      });
    };
    img.src = dataUrl;
  });
}

/**
 * Tries to extract an embedded JPEG or PNG thumbnail from a binary EPS/AI/PDF vector file
 */
export async function extractEmbeddedImageFromVector(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for Binary EPS Header TIFF preview (magic 0xC5 0xD0 0xD3 0xC6)
    if (bytes.length > 30 && bytes[0] === 0xC5 && bytes[1] === 0xD0 && bytes[2] === 0xD3 && bytes[3] === 0xC6) {
      const view = new DataView(arrayBuffer);
      const tiffOffset = view.getUint32(20, true);
      const tiffLength = view.getUint32(24, true);
      if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= bytes.length) {
        const tiffSlice = bytes.subarray(tiffOffset, tiffOffset + tiffLength);
        if (tiffSlice[0] === 0xFF && tiffSlice[1] === 0xD8 && tiffSlice[2] === 0xFF) {
          const blob = new Blob([tiffSlice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const compressed = await compressImageForAi(url);
          URL.revokeObjectURL(url);
          return {
            previewUrl: `data:image/jpeg;base64,${compressed.base64Data}`,
            base64Data: compressed.base64Data,
            mimeTypeForAi: 'image/jpeg',
          };
        }
      }
    }

    // 2. Scan for embedded JPEG streams (0xFF 0xD8 0xFF ... 0xFF 0xD9)
    for (let i = 0; i < Math.min(bytes.length - 1000, 15 * 1024 * 1024); i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        let endIdx = -1;
        for (let j = i + 500; j < Math.min(bytes.length - 1, i + 10 * 1024 * 1024); j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i) {
          const jpegBytes = bytes.subarray(i, endIdx);
          const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);

          const isValid = await new Promise<boolean>((res) => {
            const img = new Image();
            img.onload = () => res(img.width >= 10 && img.height >= 10);
            img.onerror = () => res(false);
            img.src = url;
          });

          if (isValid) {
            const compressed = await compressImageForAi(url);
            URL.revokeObjectURL(url);
            return {
              previewUrl: `data:image/jpeg;base64,${compressed.base64Data}`,
              base64Data: compressed.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
          URL.revokeObjectURL(url);
        }
      }
    }

    // 3. Scan for embedded PNG streams (0x89 0x50 0x4E 0x47)
    for (let i = 0; i < Math.min(bytes.length - 500, 10 * 1024 * 1024); i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4E &&
        bytes[i + 3] === 0x47
      ) {
        let endIdx = -1;
        for (let j = i + 100; j < Math.min(bytes.length - 7, i + 10 * 1024 * 1024); j++) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4E &&
            bytes[j + 3] === 0x44
          ) {
            endIdx = j + 8;
            break;
          }
        }
        if (endIdx > i) {
          const pngBytes = bytes.subarray(i, endIdx);
          const blob = new Blob([pngBytes], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const isValid = await new Promise<boolean>((res) => {
            const img = new Image();
            img.onload = () => res(img.width >= 10 && img.height >= 10);
            img.onerror = () => res(false);
            img.src = url;
          });

          if (isValid) {
            const compressed = await compressImageForAi(url);
            URL.revokeObjectURL(url);
            return {
              previewUrl: `data:image/jpeg;base64,${compressed.base64Data}`,
              base64Data: compressed.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
          URL.revokeObjectURL(url);
        }
      }
    }
  } catch (err) {
    console.warn('Vector image extraction exception:', err);
  }
  return null;
}

/**
 * Parses PostScript/EPS metadata & paths and renders a clean vector preview canvas
 */
export async function renderEpsCanvasPreview(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string }> {
  let psText = '';
  try {
    const textDecoder = new TextDecoder('iso-8859-1');
    const buffer = await file.arrayBuffer();
    psText = textDecoder.decode(buffer.slice(0, 500000)); // Read first 500KB
  } catch (e) {
    console.warn('Could not decode EPS text:', e);
  }

  // Extract EPS Comments
  let title = file.name;
  const titleMatch = psText.match(/%%Title:\s*(.+)/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  let creator = '';
  const creatorMatch = psText.match(/%%Creator:\s*(.+)/i);
  if (creatorMatch && creatorMatch[1]) {
    creator = creatorMatch[1].trim();
  }

  let bbox = [0, 0, 500, 500];
  const bboxMatch = psText.match(/%%BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
  if (bboxMatch) {
    bbox = [parseInt(bboxMatch[1]), parseInt(bboxMatch[2]), parseInt(bboxMatch[3]), parseInt(bboxMatch[4])];
  }

  // Extract color swatches (setrgbcolor or setcmykcolor)
  const colors: string[] = [];
  const rgbMatches = psText.matchAll(/([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)\s+setrgbcolor/gi);
  for (const match of rgbMatches) {
    const r = Math.round(parseFloat(match[1]) * 255);
    const g = Math.round(parseFloat(match[2]) * 255);
    const b = Math.round(parseFloat(match[3]) * 255);
    colors.push(`rgb(${r},${g},${b})`);
    if (colors.length >= 6) break;
  }

  // Parse basic coordinate points for path hints
  const pathPoints: [number, number][] = [];
  const moveMatches = psText.matchAll(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(m|moveto|l|lineto)/gi);
  let ptCount = 0;
  for (const m of moveMatches) {
    pathPoints.push([parseFloat(m[1]), parseFloat(m[2])]);
    ptCount++;
    if (ptCount > 200) break;
  }

  // Create 800x600 preview canvas
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Dark professional vector background
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 600);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 600);

    // Grid lines for vector aesthetic
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y < 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Draw Vector Stage / Artboard Box
    const stageWidth = 460;
    const stageHeight = 340;
    const stageX = (800 - stageWidth) / 2;
    const stageY = 100;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillRect(stageX, stageY, stageWidth, stageHeight);
    ctx.shadowBlur = 0;

    // Draw extracted vector paths if available
    if (pathPoints.length > 2) {
      ctx.save();
      ctx.rect(stageX, stageY, stageWidth, stageHeight);
      ctx.clip();

      const minX = bbox[0];
      const minY = bbox[1];
      const bboxW = Math.max(bbox[2] - bbox[0], 10);
      const bboxH = Math.max(bbox[3] - bbox[1], 10);

      ctx.beginPath();
      pathPoints.forEach(([px, py], idx) => {
        const nx = stageX + ((px - minX) / bboxW) * stageWidth;
        const ny = stageY + stageHeight - ((py - minY) / bboxH) * stageHeight; // Invert Y for PS
        if (idx === 0) ctx.moveTo(nx, ny);
        else ctx.lineTo(nx, ny);
      });
      ctx.strokeStyle = colors[0] || '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    } else {
      // Draw Vector Emblem/Illustration on Artboard
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(stageX + 10, stageY + 10, stageWidth - 20, stageHeight - 20);

      ctx.beginPath();
      ctx.arc(stageX + stageWidth / 2, stageY + stageHeight / 2 - 20, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#e0e7ff';
      ctx.fill();

      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#4f46e5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EPS', stageX + stageWidth / 2, stageY + stageHeight / 2 - 20);

      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Vector Graphic Artboard', stageX + stageWidth / 2, stageY + stageHeight / 2 + 40);
    }

    // Top Header Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('VECTOR GRAPHIC (EPS)', 40, 45);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(file.name, 40, 68);

    // Badge
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(680, 30, 80, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EPS EPSF', 720, 47);

    // Footer Info Bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 480, 800, 120);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Title: ${title.substring(0, 45)}`, 40, 515);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`BoundingBox: [${bbox.join(', ')}]  •  Size: ${bytesToSize(file.size)}${creator ? `  •  Creator: ${creator}` : ''}`, 40, 540);

    // Color swatches row if found
    if (colors.length > 0) {
      colors.forEach((col, idx) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(40 + idx * 24, 570, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
  return {
    previewUrl: jpegUrl,
    base64Data: jpegUrl.split(',')[1],
    mimeTypeForAi: 'image/jpeg',
  };
}

/**
 * Prepares preview image data and base64 for Gemini vision model
 */
export async function prepareFileForAi(file: File): Promise<{
  previewUrl: string;
  base64Data: string;
  mimeTypeForAi: string;
}> {
  const category = getFormatCategory(file.name, file.type);
  const ext = getFileExtension(file.name);

  if (category === 'video') {
    try {
      const frameDataUrl = await captureVideoFrame(file);
      const base64Data = frameDataUrl.split(',')[1];
      return {
        previewUrl: frameDataUrl,
        base64Data,
        mimeTypeForAi: 'image/png',
      };
    } catch (e) {
      console.warn('Fallback for video frame capture:', e);
    }
  }

  if (ext === 'svg' || file.type.includes('svg')) {
    try {
      const pngUrl = await renderSvgToPng(file);
      return {
        previewUrl: pngUrl,
        base64Data: pngUrl.split(',')[1],
        mimeTypeForAi: 'image/png',
      };
    } catch (e) {
      console.warn('SVG canvas render fallback:', e);
    }
  }

  // Handle EPS, AI, PS, PDF or other vector formats
  if (['eps', 'ai', 'ps', 'pdf'].includes(ext) || category === 'vector' || category === 'pdf') {
    try {
      // 1. First attempt: extract embedded JPEG/PNG image inside EPS/AI/PDF
      const extracted = await extractEmbeddedImageFromVector(file);
      if (extracted) {
        return extracted;
      }
      // 2. Second attempt: render vector canvas preview
      return await renderEpsCanvasPreview(file);
    } catch (e) {
      console.warn('Error extracting/rendering vector preview:', e);
    }
  }

  if (category === 'image') {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const compressed = await compressImageForAi(dataUrl);
      return {
        previewUrl: dataUrl,
        base64Data: compressed.base64Data,
        mimeTypeForAi: compressed.mimeType,
      };
    } catch (e) {
      console.error('Error reading image file:', e);
    }
  }

  // Fallback for any other formats: render canvas preview
  try {
    return await renderEpsCanvasPreview(file);
  } catch (e) {
    return {
      previewUrl: '',
      base64Data: '',
      mimeTypeForAi: 'image/jpeg',
    };
  }
}
