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
  if (['ai', 'eps', 'svg', 'ps', 'cdr'].includes(ext) || mimeType.includes('svg') || mimeType.includes('illustrator') || mimeType.includes('postscript')) {
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
 * Renders an SVG file to a clean, high-resolution JPEG canvas data URL
 */
export function renderSvgToPng(file: File): Promise<{ dataUrl: string; base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let content = (e.target?.result as string) || '';
      
      // Clean and ensure valid SVG dimensions & namespaces
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        
        if (svgEl) {
          if (!svgEl.getAttribute('xmlns')) {
            svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          }
          
          let w = parseFloat(svgEl.getAttribute('width') || '0');
          let h = parseFloat(svgEl.getAttribute('height') || '0');
          const viewBox = svgEl.getAttribute('viewBox');
          
          if (viewBox) {
            const vbParts = viewBox.trim().split(/[\s,]+/).map(Number);
            if (vbParts.length === 4 && vbParts[2] > 0 && vbParts[3] > 0) {
              if (w <= 0 || isNaN(w)) w = vbParts[2];
              if (h <= 0 || isNaN(h)) h = vbParts[3];
            }
          }
          
          if (w <= 0 || isNaN(w)) w = 1000;
          if (h <= 0 || isNaN(h)) h = 1000;
          
          // Clamp to high-res max dimensions (e.g. 1200)
          const maxDim = 1200;
          let targetW = w;
          let targetH = h;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }
          
          svgEl.setAttribute('width', `${targetW}px`);
          svgEl.setAttribute('height', `${targetH}px`);
          
          const serializer = new XMLSerializer();
          content = serializer.serializeToString(doc);
        }
      } catch (err) {
        console.warn('SVG DOM parsing adjustment warning:', err);
      }

      const img = new Image();
      const svgBlob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width || 1000;
        const height = img.naturalHeight || img.height || 1000;
        canvas.width = Math.max(width, 100);
        canvas.height = Math.max(height, 100);
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(url);
          resolve({
            dataUrl: jpegUrl,
            base64Data: jpegUrl.split(',')[1],
            mimeType: 'image/jpeg',
          });
        } else {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas context unavailable for SVG rasterization'));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback: load directly via Base64 encoded svg data URI
        const fallbackImg = new Image();
        const base64Svg = btoa(unescape(encodeURIComponent(content)));
        fallbackImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = fallbackImg.width || 1000;
          canvas.height = fallbackImg.height || 1000;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(fallbackImg, 0, 0);
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve({
              dataUrl: jpegUrl,
              base64Data: jpegUrl.split(',')[1],
              mimeType: 'image/jpeg',
            });
            return;
          }
          reject(new Error('SVG fallback canvas failed'));
        };
        fallbackImg.onerror = (e) => reject(e);
        fallbackImg.src = `data:image/svg+xml;base64,${base64Svg}`;
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
 * Helper to strictly validate if a data URL or blob URL is a real decodable image in the browser,
 * and rasterizes it onto a clean canvas with white background to output guaranteed valid JPEG base64.
 */
export function validateAndRasterizeImage(
  srcUrl: string,
  maxDim = 1000
): Promise<{ previewUrl: string; base64Data: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      resolve(null);
    }, 4000);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (!width || !height || width < 10 || height < 10) {
          resolve(null);
          return;
        }

        let targetW = width;
        let targetH = height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(targetW, 100);
        canvas.height = Math.max(targetH, 100);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const jpegUrl = canvas.toDataURL('image/jpeg', 0.88);
        const b64 = jpegUrl.split(',')[1];
        if (b64 && b64.length > 50) {
          resolve({
            previewUrl: jpegUrl,
            base64Data: b64,
            mimeType: 'image/jpeg',
          });
          return;
        }
      } catch (err) {
        console.warn('validateAndRasterizeImage canvas raster exception:', err);
      }
      resolve(null);
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = srcUrl;
  });
}

/**
 * Extracts embedded XMP metadata thumbnail or raster image from AI/EPS files
 */
export async function extractEmbeddedXmpThumbnail(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const sliceSize = Math.min(file.size, 2 * 1024 * 1024); // First 2MB is sufficient for XMP
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const textDecoder = new TextDecoder('latin1'); // latin1 never throws on arbitrary binary bytes
    const text = textDecoder.decode(buffer);

    // 1. Match Adobe XMP GImg Thumbnail (<xmpGImg:image> or <xapGImg:image>)
    const xmpImgMatch = text.match(/<(?:xmpGImg|xapGImg):image>([\s\S]*?)<\/(?:xmpGImg|xapGImg):image>/i);
    if (xmpImgMatch && xmpImgMatch[1]) {
      const cleanB64 = xmpImgMatch[1].replace(/[\r\n\s]/g, '');
      if (cleanB64.length > 200) {
        // Test as JPEG
        const jpegCandidate = await validateAndRasterizeImage(`data:image/jpeg;base64,${cleanB64}`);
        if (jpegCandidate) {
          return {
            previewUrl: jpegCandidate.previewUrl,
            base64Data: jpegCandidate.base64Data,
            mimeTypeForAi: 'image/jpeg',
          };
        }
        // Test as PNG
        const pngCandidate = await validateAndRasterizeImage(`data:image/png;base64,${cleanB64}`);
        if (pngCandidate) {
          return {
            previewUrl: pngCandidate.previewUrl,
            base64Data: pngCandidate.base64Data,
            mimeTypeForAi: 'image/jpeg',
          };
        }
      }
    }

    // 2. Match Photoshop / Illustrator Base64 thumbnail in comments
    const rawB64Match = text.match(/%%BeginPhotoshop:[\s\S]*?([A-Za-z0-9+/=]{500,})[\s\S]*?%%EndPhotoshop/i);
    if (rawB64Match && rawB64Match[1]) {
      const cleanB64 = rawB64Match[1].replace(/[\r\n\s]/g, '');
      const tested = await validateAndRasterizeImage(`data:image/jpeg;base64,${cleanB64}`);
      if (tested) {
        return {
          previewUrl: tested.previewUrl,
          base64Data: tested.base64Data,
          mimeTypeForAi: 'image/jpeg',
        };
      }
    }
  } catch (err) {
    console.warn('XMP thumbnail extraction error:', err);
  }
  return null;
}

/**
 * Tries to extract an embedded JPEG or PNG thumbnail from a binary EPS/AI/PDF vector file
 */
export async function extractEmbeddedImageFromVector(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  // First check XMP packet which is fast, lossless and non-blocking
  const xmpResult = await extractEmbeddedXmpThumbnail(file);
  if (xmpResult) {
    return xmpResult;
  }

  try {
    // Only inspect first 2MB to keep vector processing lightning fast
    const sliceLen = Math.min(file.size, 2 * 1024 * 1024);
    const arrayBuffer = await file.slice(0, sliceLen).arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // 1. Check for Binary EPS Header TIFF/JPEG preview (magic 0xC5 0xD0 0xD3 0xC6)
    if (bytes.length > 32 && bytes[0] === 0xC5 && bytes[1] === 0xD0 && bytes[2] === 0xD3 && bytes[3] === 0xC6) {
      const view = new DataView(arrayBuffer);
      const tiffOffset = view.getUint32(20, true);
      const tiffLength = view.getUint32(24, true);
      if (tiffOffset > 0 && tiffLength > 100 && tiffOffset + tiffLength <= bytes.length) {
        const tiffSlice = bytes.subarray(tiffOffset, tiffOffset + tiffLength);
        if (tiffSlice[0] === 0xFF && tiffSlice[1] === 0xD8 && tiffSlice[2] === 0xFF) {
          const blob = new Blob([tiffSlice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const rasterized = await validateAndRasterizeImage(url);
          URL.revokeObjectURL(url);
          if (rasterized) {
            return {
              previewUrl: rasterized.previewUrl,
              base64Data: rasterized.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
        }
      }
    }

    // 2. Scan for embedded JPEG stream (0xFF 0xD8 0xFF ... 0xFF 0xD9)
    for (let i = 0; i < Math.min(bytes.length - 500, 1024 * 1024); i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        let endIdx = -1;
        const maxJpegSearch = Math.min(bytes.length - 1, i + 800 * 1024);
        for (let j = i + 300; j < maxJpegSearch; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i) {
          const jpegSlice = bytes.subarray(i, endIdx);
          const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const rasterized = await validateAndRasterizeImage(url);
          URL.revokeObjectURL(url);
          if (rasterized) {
            return {
              previewUrl: rasterized.previewUrl,
              base64Data: rasterized.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Vector image extraction exception:', err);
  }
  return null;
}

/**
 * Parses PostScript/EPS/AI metadata & paths and renders a clean, rich vector preview canvas
 */
export async function renderEpsCanvasPreview(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string }> {
  let psText = '';
  try {
    const textDecoder = new TextDecoder('iso-8859-1');
    const buffer = await file.arrayBuffer();
    psText = textDecoder.decode(buffer.slice(0, 800000)); // Read first 800KB
  } catch (e) {
    console.warn('Could not decode EPS text:', e);
  }

  const ext = getFileExtension(file.name).toUpperCase() || 'VECTOR';

  // Extract EPS Comments
  let title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const titleMatch = psText.match(/%%Title:\s*(.+)/i);
  if (titleMatch && titleMatch[1] && !titleMatch[1].toLowerCase().includes('untitled')) {
    title = titleMatch[1].trim();
  }

  let creator = '';
  const creatorMatch = psText.match(/%%Creator:\s*(.+)/i);
  if (creatorMatch && creatorMatch[1]) {
    creator = creatorMatch[1].trim();
  }

  let bbox = [0, 0, 800, 600];
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
    if (colors.length >= 8) break;
  }

  // Parse basic coordinate points for path drawing
  const pathPoints: [number, number][] = [];
  const moveMatches = psText.matchAll(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(m|moveto|l|lineto)/gi);
  let ptCount = 0;
  for (const m of moveMatches) {
    pathPoints.push([parseFloat(m[1]), parseFloat(m[2])]);
    ptCount++;
    if (ptCount > 400) break;
  }

  // Create 1000x750 high-res preview canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 750;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 1000, 750);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#131b2e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1000, 750);

    // Subtle Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1000; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 750);
      ctx.stroke();
    }
    for (let y = 0; y < 750; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1000, y);
      ctx.stroke();
    }

    // Top Header Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${ext} VECTOR ARTWORK`, 45, 50);

    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(file.name, 45, 78);

    // Format Badge
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(840, 35, 115, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`VECTOR ${ext}`, 897, 58);

    // Artboard Stage Box
    const stageWidth = 620;
    const stageHeight = 440;
    const stageX = (1000 - stageWidth) / 2;
    const stageY = 110;

    // Outer shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageWidth, stageHeight, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Checkered transparent/artboard background inside stage
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageWidth, stageHeight, 10);
    ctx.clip();

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(stageX, stageY, stageWidth, stageHeight);

    // Subtle checkered grid
    ctx.fillStyle = '#f1f5f9';
    const checkSize = 20;
    for (let cx = stageX; cx < stageX + stageWidth; cx += checkSize * 2) {
      for (let cy = stageY; cy < stageY + stageHeight; cy += checkSize * 2) {
        ctx.fillRect(cx, cy, checkSize, checkSize);
        ctx.fillRect(cx + checkSize, cy + checkSize, checkSize, checkSize);
      }
    }

    // Draw extracted vector paths if available
    if (pathPoints.length > 2) {
      const minX = bbox[0];
      const minY = bbox[1];
      const bboxW = Math.max(bbox[2] - bbox[0], 10);
      const bboxH = Math.max(bbox[3] - bbox[1], 10);

      ctx.beginPath();
      pathPoints.forEach(([px, py], idx) => {
        const nx = stageX + 30 + ((px - minX) / bboxW) * (stageWidth - 60);
        const ny = stageY + stageHeight - 30 - ((py - minY) / bboxH) * (stageHeight - 60); // Invert Y for PostScript
        if (idx === 0) ctx.moveTo(nx, ny);
        else ctx.lineTo(nx, ny);
      });
      ctx.strokeStyle = colors[0] || '#4338ca';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (colors.length > 1) {
        ctx.fillStyle = colors[1] || 'rgba(99, 102, 241, 0.15)';
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    } else {
      // Draw Vector Illustrator Badge on Stage
      ctx.fillStyle = '#eef2ff';
      ctx.beginPath();
      ctx.roundRect(stageX + 50, stageY + 50, stageWidth - 100, stageHeight - 100, 16);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(stageX + stageWidth / 2, stageY + stageHeight / 2 - 30, 65, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();

      ctx.font = 'bold 36px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ext, stageX + stageWidth / 2, stageY + stageHeight / 2 - 30);

      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`Scalable ${ext} Vector Graphic`, stageX + stageWidth / 2, stageY + stageHeight / 2 + 55);

      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Resolution-Independent Artwork & Illustrator Assets`, stageX + stageWidth / 2, stageY + stageHeight / 2 + 82);
    }
    ctx.restore();

    // Footer Info Bar
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 590, 1000, 160);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Subject / Title: ${title.substring(0, 60)}`, 45, 630);

    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`File Size: ${bytesToSize(file.size)}  •  BoundingBox: [${bbox.join(', ')}]${creator ? `  •  App: ${creator}` : ''}`, 45, 660);

    // Color swatches row if found
    if (colors.length > 0) {
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Color Palette:', 45, 695);

      colors.forEach((col, idx) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(140 + idx * 28, 691, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
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
 * Prepares preview image data and base64 for Gemini/OpenAI vision model
 */
export async function prepareFileForAi(file: File): Promise<{
  previewUrl: string;
  base64Data: string;
  mimeTypeForAi: string;
}> {
  const category = getFormatCategory(file.name, file.type);
  const ext = getFileExtension(file.name);

  // 1. VIDEO HANDLING
  if (category === 'video') {
    try {
      const frameDataUrl = await captureVideoFrame(file);
      const compressed = await compressImageForAi(frameDataUrl);
      return {
        previewUrl: frameDataUrl,
        base64Data: compressed.base64Data,
        mimeTypeForAi: 'image/jpeg',
      };
    } catch (e) {
      console.warn('Fallback for video frame capture:', e);
    }
  }

  // 2. SVG VECTOR HANDLING (Render vector to high-res raster image)
  if (ext === 'svg' || file.type.includes('svg')) {
    try {
      const svgResult = await renderSvgToPng(file);
      return {
        previewUrl: svgResult.dataUrl,
        base64Data: svgResult.base64Data,
        mimeTypeForAi: 'image/jpeg',
      };
    } catch (e) {
      console.warn('SVG canvas render fallback:', e);
    }
  }

  // 3. EPS, AI, PS, PDF VECTOR HANDLING
  if (['eps', 'ai', 'ps', 'pdf', 'cdr'].includes(ext) || category === 'vector' || category === 'pdf') {
    try {
      // First attempt: extract embedded JPEG/PNG/XMP image from EPS/AI/PDF
      const extracted = await extractEmbeddedImageFromVector(file);
      if (extracted && extracted.base64Data) {
        return extracted;
      }
      // Second attempt: render vector artboard canvas preview with colors and paths
      return await renderEpsCanvasPreview(file);
    } catch (e) {
      console.warn('Error extracting/rendering vector preview:', e);
    }
  }

  // 4. STANDARD RASTER IMAGE HANDLING (JPG, PNG, WEBP, TIFF, GIF, HEIC)
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

  // 5. FINAL FALLBACK FOR ANY OTHER FORMAT
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

