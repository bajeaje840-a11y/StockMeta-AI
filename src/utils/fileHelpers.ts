import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
// @ts-ignore
import UTIF from 'utif';
import { renderPostScriptCodeToCanvas } from './postscriptRenderer';
import { extractVectorSemanticInfo } from './vectorMetadataExtractor';

// Configure PDF.js worker safely using Vite bundled asset URL (works 100% locally and on Vercel)
if (typeof window !== 'undefined' && (pdfjsLib as any).GlobalWorkerOptions) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    // Ignore worker setup error
  }
}

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

/**
 * Turns machine filenames like "fire_truck_icon_set_202608242233.eps"
 * or "Create_monster_truck_icon_set_2026.eps" into a clean human subject "Fire Truck Icon Set"
 */
export function cleanVectorSubject(filename: string): string {
  let name = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  name = name.replace(/^create[_\s-]+/i, ''); // Remove "create_" prefix
  name = name.replace(/_\d{8,}(?:_\d+)?/g, ''); // Remove timestamp suffixes like _202608242233
  name = name.replace(/[-_]+/g, ' ').trim(); // Replace underscores/hyphens with spaces
  
  // Title-case
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
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
 * Renders a PDF or AI ArrayBuffer using Mozilla PDF.js to a crisp high-res raster image
 */
export async function renderPdfBufferToCanvas(
  buffer: ArrayBuffer,
  scale = 1.5
): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const loadingTask = (pdfjsLib as any).getDocument({
      data: new Uint8Array(buffer),
    });
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1) return null;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(Math.round(viewport.width), 100);
    canvas.height = Math.max(Math.round(viewport.height), 100);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill white background first so transparent PDFs/vectors don't turn black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await (page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any)).promise;

    const jpegUrl = canvas.toDataURL('image/jpeg', 0.90);
    const b64 = jpegUrl.split(',')[1];
    if (b64 && b64.length > 100) {
      return {
        previewUrl: jpegUrl,
        base64Data: b64,
        mimeTypeForAi: 'image/jpeg',
      };
    }
  } catch (err) {
    console.warn('renderPdfBufferToCanvas exception:', err);
  }
  return null;
}


/**
 * Parses ASCII EPSI hex preview (%%BeginPreview: <width> <height> <depth> <lines> ... %%EndPreview)
 */
export function parseEpsiHexPreview(psText: string): { previewUrl: string; base64Data: string; mimeTypeForAi: string } | null {
  try {
    const match = psText.match(/%%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)([\s\S]*?)%%EndPreview/i);
    if (!match) return null;

    const width = parseInt(match[1], 10);
    const height = parseInt(match[2], 10);
    const depth = parseInt(match[3], 10); // 1 for monochrome, 8 for grayscale
    const rawHexLines = match[5];

    if (width <= 0 || height <= 0 || (depth !== 1 && depth !== 8)) return null;

    const hexStr = rawHexLines.replace(/[^0-9a-fA-F]/g, '');
    if (hexStr.length < 16) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    if (depth === 1) {
      const bytesPerRow = Math.ceil(width / 8);
      let hexPos = 0;

      for (let y = 0; y < height; y++) {
        for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
          if (hexPos + 1 >= hexStr.length) break;
          const byteVal = parseInt(hexStr.substr(hexPos, 2), 16);
          hexPos += 2;

          for (let bit = 7; bit >= 0; bit--) {
            const x = byteIdx * 8 + (7 - bit);
            if (x < width) {
              const pixelIdx = (y * width + x) * 4;
              const isInk = (byteVal & (1 << bit)) === 0; // 0 = ink, 1 = white background
              const colorVal = isInk ? 20 : 255;
              data[pixelIdx] = colorVal;
              data[pixelIdx + 1] = colorVal;
              data[pixelIdx + 2] = colorVal;
              data[pixelIdx + 3] = 255;
            }
          }
        }
      }
    } else if (depth === 8) {
      let hexPos = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (hexPos + 1 >= hexStr.length) break;
          const gray = parseInt(hexStr.substr(hexPos, 2), 16);
          hexPos += 2;
          const pixelIdx = (y * width + x) * 4;
          data[pixelIdx] = gray;
          data[pixelIdx + 1] = gray;
          data[pixelIdx + 2] = gray;
          data[pixelIdx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Render scaled onto crisp white canvas
    const outCanvas = document.createElement('canvas');
    const targetW = Math.max(width, 800);
    const targetH = Math.round((height / width) * targetW);
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return null;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, targetW, targetH);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(canvas, 0, 0, targetW, targetH);

    const jpegUrl = outCanvas.toDataURL('image/jpeg', 0.90);
    const b64 = jpegUrl.split(',')[1];
    if (b64 && b64.length > 50) {
      return {
        previewUrl: jpegUrl,
        base64Data: b64,
        mimeTypeForAi: 'image/jpeg',
      };
    }
  } catch (e) {
    console.warn('parseEpsiHexPreview exception:', e);
  }
  return null;
}

/**
 * Extracts TIFF or JPEG preview from standard Binary EPS header (magic 0xC5 0xD0 0xD3 0xC6)
 * Decodes TIFF data with UTIF.js for 100% pixel fidelity
 */
export async function extractTiffFromBinaryEps(
  file: File
): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    if (file.size < 32) return null;
    const headerBuffer = await file.slice(0, 32).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);

    // Check Binary EPS Header magic: 0xC5 0xD0 0xD3 0xC6
    if (
      headerBytes[0] === 0xC5 &&
      headerBytes[1] === 0xD0 &&
      headerBytes[2] === 0xD3 &&
      headerBytes[3] === 0xC6
    ) {
      const view = new DataView(headerBuffer);
      const psOffset = view.getUint32(4, true);
      const psLength = view.getUint32(8, true);
      const tiffOffset = view.getUint32(20, true);
      const tiffLength = view.getUint32(24, true);

      // 1. Try TIFF/JPEG preview from Binary Header
      if (tiffOffset > 0 && tiffLength > 50 && tiffOffset + tiffLength <= file.size) {
        const tiffBuffer = await file.slice(tiffOffset, tiffOffset + tiffLength).arrayBuffer();
        const tiffBytes = new Uint8Array(tiffBuffer);

        // Check if directly JPEG stream (0xFF 0xD8 0xFF)
        if (tiffBytes[0] === 0xFF && tiffBytes[1] === 0xD8 && tiffBytes[2] === 0xFF) {
          const blob = new Blob([tiffBuffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const rasterized = await validateAndRasterizeImage(url, 1200);
          URL.revokeObjectURL(url);
          if (rasterized) {
            return {
              previewUrl: rasterized.previewUrl,
              base64Data: rasterized.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
        }

        // Decode TIFF preview with UTIF.js
        try {
          const ifds = UTIF.decode(tiffBuffer);
          if (ifds && ifds.length > 0 && ifds[0].width > 10 && ifds[0].height > 10) {
            const firstIfd = ifds[0];
            UTIF.decodeImage(tiffBuffer, firstIfd);
            const rgba = UTIF.toRGBA8(firstIfd);
            if (rgba && rgba.length === firstIfd.width * firstIfd.height * 4) {
              const canvas = document.createElement('canvas');
              canvas.width = firstIfd.width;
              canvas.height = firstIfd.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = new ImageData(
                  new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
                  firstIfd.width,
                  firstIfd.height
                );
                ctx.putImageData(imgData, 0, 0);

                // Render over pure white background
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = firstIfd.width;
                finalCanvas.height = firstIfd.height;
                const fCtx = finalCanvas.getContext('2d');
                if (fCtx) {
                  fCtx.fillStyle = '#ffffff';
                  fCtx.fillRect(0, 0, firstIfd.width, firstIfd.height);
                  fCtx.drawImage(canvas, 0, 0);

                  const jpegUrl = finalCanvas.toDataURL('image/jpeg', 0.90);
                  const b64 = jpegUrl.split(',')[1];
                  if (b64 && b64.length > 50) {
                    return {
                      previewUrl: jpegUrl,
                      base64Data: b64,
                      mimeTypeForAi: 'image/jpeg',
                    };
                  }
                }
              }
            }
          }
        } catch (utifErr) {
          console.warn('UTIF decode exception for EPS TIFF preview:', utifErr);
        }
      }

      // 2. If TIFF preview was missing or failed, extract PostScript slice from psOffset
      if (psOffset > 0 && psLength > 100 && psOffset + psLength <= file.size) {
        try {
          const psBuffer = await file.slice(psOffset, psOffset + psLength).arrayBuffer();
          const textDecoder = new TextDecoder('latin1');
          const psText = textDecoder.decode(psBuffer);

          // Check XMP in PostScript slice
          const epsi = parseEpsiHexPreview(psText);
          if (epsi) return epsi;

          // Check embedded streams in PostScript slice
          const psBytes = new Uint8Array(psBuffer);
          const pdfIdx = psText.indexOf('%PDF-');
          if (pdfIdx !== -1) {
            const pdfSlice = psBuffer.slice(pdfIdx);
            const renderedPdf = await renderPdfBufferToCanvas(pdfSlice);
            if (renderedPdf) return renderedPdf;
          }

          // Check client-side PostScript canvas interpreter
          const psCanvas = renderPostScriptCodeToCanvas(psText, 1200);
          if (psCanvas) {
            return {
              previewUrl: psCanvas.previewUrl,
              base64Data: psCanvas.base64Data,
              mimeTypeForAi: psCanvas.mimeTypeForAi,
            };
          }
        } catch (psErr) {
          console.warn('Error rendering PostScript slice from binary EPS:', psErr);
        }
      }
    }
  } catch (err) {
    console.warn('extractTiffFromBinaryEps error:', err);
  }
  return null;
}

/**
 * Extracts embedded XMP metadata thumbnail or raster image from AI/EPS files
 */
export async function extractEmbeddedXmpThumbnail(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    // Read up to 25MB of file text
    const sliceSize = Math.min(file.size, 25 * 1024 * 1024);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const textDecoder = new TextDecoder('latin1'); // latin1 never throws on binary PostScript
    const text = textDecoder.decode(buffer);

    // 1. Check EPSI Hex Preview
    const epsi = parseEpsiHexPreview(text);
    if (epsi) return epsi;

    // 2. Match Adobe XMP GImg Thumbnail (<xmpGImg:image>, <xapGImg:image>, <photoshop:Thumbnail>, <xmp:Thumbnail>, etc.)
    const xmpPatterns = [
      /<(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)[^>]*>([\s\S]*?)<\/(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)>/gi,
      /(?:xmpGImg:image|photoshop:Thumbnail|xapGImg:image)=["']([A-Za-z0-9+/=\s\r\n]{100,})["']/gi,
    ];

    for (const pattern of xmpPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match && match[1]) {
          const cleanB64 = match[1].replace(/[\r\n\s]/g, '');
          if (cleanB64.length > 80) {
            // Test as JPEG
            const jpegCandidate = await validateAndRasterizeImage(`data:image/jpeg;base64,${cleanB64}`, 1200);
            if (jpegCandidate) {
              return {
                previewUrl: jpegCandidate.previewUrl,
                base64Data: jpegCandidate.base64Data,
                mimeTypeForAi: 'image/jpeg',
              };
            }

            // Test as PNG
            const pngCandidate = await validateAndRasterizeImage(`data:image/png;base64,${cleanB64}`, 1200);
            if (pngCandidate) {
              return {
                previewUrl: pngCandidate.previewUrl,
                base64Data: pngCandidate.base64Data,
                mimeTypeForAi: 'image/jpeg',
              };
            }

            // Try decoding as TIFF data with UTIF
            try {
              const binStr = atob(cleanB64);
              const binBytes = new Uint8Array(binStr.length);
              for (let b = 0; b < binStr.length; b++) binBytes[b] = binStr.charCodeAt(b);
              const ifds = UTIF.decode(binBytes.buffer);
              if (ifds && ifds.length > 0 && ifds[0].width > 10 && ifds[0].height > 10) {
                const firstIfd = ifds[0];
                UTIF.decodeImage(binBytes.buffer, firstIfd);
                const rgba = UTIF.toRGBA8(firstIfd);
                if (rgba && rgba.length === firstIfd.width * firstIfd.height * 4) {
                  const canvas = document.createElement('canvas');
                  canvas.width = firstIfd.width;
                  canvas.height = firstIfd.height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    const imgData = new ImageData(
                      new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
                      firstIfd.width,
                      firstIfd.height
                    );
                    ctx.putImageData(imgData, 0, 0);

                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = firstIfd.width;
                    finalCanvas.height = firstIfd.height;
                    const fCtx = finalCanvas.getContext('2d');
                    if (fCtx) {
                      fCtx.fillStyle = '#ffffff';
                      fCtx.fillRect(0, 0, firstIfd.width, firstIfd.height);
                      fCtx.drawImage(canvas, 0, 0);

                      const jpegUrl = finalCanvas.toDataURL('image/jpeg', 0.90);
                      const b64 = jpegUrl.split(',')[1];
                      if (b64 && b64.length > 50) {
                        return {
                          previewUrl: jpegUrl,
                          base64Data: b64,
                          mimeTypeForAi: 'image/jpeg',
                        };
                      }
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }
    }

    // 3. Match Photoshop / Illustrator Base64 thumbnail in DSC comments
    const rawB64Match = text.match(/%%BeginPhotoshop:[\s\S]*?([A-Za-z0-9+/=]{300,})[\s\S]*?%%EndPhotoshop/i);
    if (rawB64Match && rawB64Match[1]) {
      const cleanB64 = rawB64Match[1].replace(/[\r\n\s]/g, '');
      const tested = await validateAndRasterizeImage(`data:image/jpeg;base64,${cleanB64}`, 1200);
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
 * Searches for embedded PDF streams or JPEG byte streams inside EPS/AI files
 */
export async function extractEmbeddedStreamFromVector(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const fullBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(fullBuffer);

    // 1. Search for PDF Stream (%PDF-1.) across the entire AI or EPS file
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-
    for (let i = 0; i < bytes.length - 100; i++) {
      if (
        bytes[i] === pdfMagic[0] &&
        bytes[i + 1] === pdfMagic[1] &&
        bytes[i + 2] === pdfMagic[2] &&
        bytes[i + 3] === pdfMagic[3] &&
        bytes[i + 4] === pdfMagic[4]
      ) {
        const pdfSlice = fullBuffer.slice(i);
        const renderedPdf = await renderPdfBufferToCanvas(pdfSlice);
        if (renderedPdf) {
          return {
            previewUrl: renderedPdf.previewUrl,
            base64Data: renderedPdf.base64Data,
            mimeTypeForAi: 'image/jpeg',
          };
        }
        break;
      }
    }

    // 2. Scan for embedded JPEG streams (0xFF 0xD8 0xFF ... 0xFF 0xD9)
    let bestCandidate: { previewUrl: string; base64Data: string; mimeType: string } | null = null;
    let maxCandidateLen = 0;

    for (let i = 0; i < bytes.length - 500; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        let endIdx = -1;
        const maxJpegSearch = Math.min(bytes.length - 1, i + 8 * 1024 * 1024);
        for (let j = i + 300; j < maxJpegSearch; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i && endIdx - i > 1000) {
          const sliceLen = endIdx - i;
          if (sliceLen > maxCandidateLen) {
            const jpegSlice = bytes.subarray(i, endIdx);
            const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            const rasterized = await validateAndRasterizeImage(url, 1200);
            URL.revokeObjectURL(url);
            if (rasterized) {
              bestCandidate = rasterized;
              maxCandidateLen = sliceLen;
            }
          }
          // Skip to endIdx to avoid scanning inside this JPEG
          i = endIdx;
        }
      }
    }

    if (bestCandidate) {
      return {
        previewUrl: bestCandidate.previewUrl,
        base64Data: bestCandidate.base64Data,
        mimeTypeForAi: 'image/jpeg',
      };
    }
  } catch (err) {
    console.warn('extractEmbeddedStreamFromVector exception:', err);
  }
  return null;
}

/**
 * Tries all advanced extraction methods for binary/ASCII EPS, AI, PDF vector files
 */
export async function extractEmbeddedImageFromVector(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  const ext = getFileExtension(file.name);

  // If directly AI or PDF file, render using PDF.js
  if (ext === 'ai' || ext === 'pdf') {
    try {
      const buffer = await file.arrayBuffer();
      const pdfRes = await renderPdfBufferToCanvas(buffer);
      if (pdfRes) return pdfRes;
    } catch (e) {
      console.warn('PDF.js direct vector render error:', e);
    }
  }

  // 1. Binary EPS TIFF Header preview (UTIF.js)
  const tiffResult = await extractTiffFromBinaryEps(file);
  if (tiffResult) return tiffResult;

  // 2. XMP Packet thumbnail or EPSI hex preview (<xmpGImg:image> / %%BeginPreview)
  const xmpResult = await extractEmbeddedXmpThumbnail(file);
  if (xmpResult) return xmpResult;

  // 3. Embedded PDF or JPEG stream
  const streamResult = await extractEmbeddedStreamFromVector(file);
  if (streamResult) return streamResult;

  // 4. Client-Side Pure PostScript Vector Canvas Interpreter
  try {
    const buffer = await file.slice(0, Math.min(file.size, 10 * 1024 * 1024)).arrayBuffer();
    const textDecoder = new TextDecoder('latin1');
    const psText = textDecoder.decode(buffer);
    const psCanvasRes = renderPostScriptCodeToCanvas(psText, 1200);
    if (psCanvasRes) {
      return {
        previewUrl: psCanvasRes.previewUrl,
        base64Data: psCanvasRes.base64Data,
        mimeTypeForAi: psCanvasRes.mimeTypeForAi,
      };
    }
  } catch (psErr) {
    console.warn('Client PostScript canvas interpreter fallback:', psErr);
  }

  return null;
}

/**
 * Creates a clean, professional vector representation badge when an EPS has no embedded raster preview.
 * NOTE: Returns base64Data as empty string so AI vision models are NEVER sent the placeholder badge!
 */
export async function renderEpsCanvasPreview(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string; isRealArtworkPreview: boolean }> {
  let psText = '';
  try {
    const textDecoder = new TextDecoder('latin1');
    const buffer = await file.slice(0, 500000).arrayBuffer();
    psText = textDecoder.decode(buffer);
  } catch (e) {
    console.warn('Could not decode EPS text:', e);
  }

  const ext = getFileExtension(file.name).toUpperCase() || 'EPS';
  const cleanSubject = cleanVectorSubject(file.name);

  let creator = '';
  const creatorMatch = psText.match(/%%Creator:\s*(.+)/i);
  if (creatorMatch && creatorMatch[1]) {
    creator = creatorMatch[1].trim();
  }

  // Create clean 800x600 preview artboard card
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Pure Clean Artboard Backdrop
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 800, 600);

    // Clean subtle border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 768, 568);

    // Vector Emblem Box
    ctx.fillStyle = '#4f46e5';
    ctx.beginPath();
    ctx.roundRect(330, 160, 140, 140, 24);
    ctx.fill();

    // Emblem Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ext, 400, 230);

    // File name & Subject in Center
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(cleanSubject, 400, 360);

    ctx.font = '15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${file.name} • ${bytesToSize(file.size)}${creator ? ` • ${creator}` : ''}`, 400, 400);

    // Badge pill
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.roundRect(280, 440, 240, 38, 19);
    ctx.fill();
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#4338ca';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('Scalable Vector Graphic', 400, 459);
  }

  const jpegUrl = canvas.toDataURL('image/jpeg', 0.90);
  return {
    previewUrl: jpegUrl,
    base64Data: '', // CRITICAL: Keep empty for AI vision so AI doesn't see placeholder badge
    mimeTypeForAi: 'image/jpeg',
    isRealArtworkPreview: false,
  };
}

/**
 * Calls server-side multi-strategy vector engine (/api/render-vector) to render genuine PostScript/EPS artwork
 */
export async function renderVectorViaServer(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const b64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const response = await fetch('/api/render-vector', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        fileData: base64Data,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.previewUrl && data.base64Data) {
        return {
          previewUrl: data.previewUrl,
          base64Data: data.base64Data,
          mimeTypeForAi: data.mimeTypeForAi || 'image/jpeg',
        };
      }
    }
  } catch (err) {
    console.warn('Server-side vector rendering unavailable or failed:', err);
  }
  return null;
}

/**
 * Prepares preview image data and base64 for Gemini/OpenAI vision model
 */
export async function prepareFileForAi(file: File): Promise<{
  previewUrl: string;
  base64Data: string;
  mimeTypeForAi: string;
  isRealArtworkPreview: boolean;
  vectorSemanticText?: string;
  cleanSubject?: string;
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
        isRealArtworkPreview: true,
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
        isRealArtworkPreview: true,
      };
    } catch (e) {
      console.warn('SVG canvas render fallback:', e);
    }
  }

  // 3. EPS, AI, PS, PDF VECTOR HANDLING
  if (['eps', 'ai', 'ps', 'pdf', 'cdr'].includes(ext) || category === 'vector' || category === 'pdf') {
    let vectorSemanticText = '';
    let cleanSubject = cleanVectorSubject(file.name);

    try {
      // Extract rich vector metadata (Titles, Descriptions, Keywords, Layer names, Text, Colors)
      const textDecoder = new TextDecoder('latin1');
      const headBuffer = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer();
      const psHeadText = textDecoder.decode(headBuffer);
      const semInfo = extractVectorSemanticInfo(psHeadText, file.name);
      vectorSemanticText = semInfo.summaryText;
      cleanSubject = semInfo.cleanSubject;
    } catch (e) {
      console.warn('Vector semantic info extraction error:', e);
    }

    try {
      // 1st Priority: Server-Side Ghostscript Vector Renderer (renders 100% genuine PostScript artwork)
      const serverRendered = await renderVectorViaServer(file);
      if (serverRendered && serverRendered.base64Data) {
        return {
          ...serverRendered,
          isRealArtworkPreview: true,
          vectorSemanticText,
          cleanSubject,
        };
      }

      // 2nd Priority: Extract embedded JPEG/PNG/TIFF/PDF preview image from EPS/AI/PDF
      const extracted = await extractEmbeddedImageFromVector(file);
      if (extracted && extracted.base64Data) {
        return {
          ...extracted,
          isRealArtworkPreview: true,
          vectorSemanticText,
          cleanSubject,
        };
      }

      // 3rd Priority: Clean vector artboard showcase canvas preview (base64Data is empty so AI doesn't see placeholder badge)
      const fallbackBadge = await renderEpsCanvasPreview(file);
      return {
        previewUrl: fallbackBadge.previewUrl,
        base64Data: '', // DO NOT send placeholder badge to AI
        mimeTypeForAi: 'image/jpeg',
        isRealArtworkPreview: false,
        vectorSemanticText,
        cleanSubject,
      };
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
        isRealArtworkPreview: true,
      };
    } catch (e) {
      console.error('Error reading image file:', e);
    }
  }

  // 5. FINAL FALLBACK FOR ANY OTHER FORMAT
  try {
    const fallbackBadge = await renderEpsCanvasPreview(file);
    return {
      previewUrl: fallbackBadge.previewUrl,
      base64Data: '',
      mimeTypeForAi: 'image/jpeg',
      isRealArtworkPreview: false,
    };
  } catch (e) {
    return {
      previewUrl: '',
      base64Data: '',
      mimeTypeForAi: 'image/jpeg',
      isRealArtworkPreview: false,
    };
  }
}


