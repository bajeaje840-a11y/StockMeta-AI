import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
// @ts-ignore
import UTIF from 'utif';
import { inflate } from 'pako';
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

export function isGenericFilename(filename: string): boolean {
  const stripped = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  return (
    /^\d+$/.test(stripped) ||
    /^(img|image|file|asset|vector|art|graphic|stock|item|icon|untitled|temp|copy)[_\s-]*\d*$/i.test(stripped)
  );
}

/**
 * Turns machine filenames like "fire_truck_icon_set_202608242233.eps"
 * or "Create_monster_truck_icon_set_2026.eps" into a clean human subject "Fire Truck Icon Set"
 */
export function cleanVectorSubject(filename: string): string {
  if (isGenericFilename(filename)) {
    return '';
  }
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
  if (['ai', 'eps', 'svg', 'ps', 'cdr'].includes(ext) || mimeType.includes('svg') || mimeType.includes('illustrator') || mimeType.includes('postscript') || mimeType.includes('eps')) {
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
 * Reads a File object directly as base64 string without data URL prefix
 */
export function readFileAsBase64Only(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = (reader.result as string) || '';
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
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

// In-flight file preparation promise cache to prevent concurrent duplicate processing
const inFlightPrepCache = new WeakMap<File, Promise<any>>();

/**
 * Renders a PDF or AI ArrayBuffer using Mozilla PDF.js to a crisp high-res raster image
 * Capped to max 1024px to prevent massive memory usage, with automatic cleanup
 */
export async function renderPdfBufferToCanvas(
  buffer: ArrayBuffer
): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  let pdf: any = null;
  let page: any = null;
  try {
    const loadingTask = (pdfjsLib as any).getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      stopAtErrors: true,
    });
    pdf = await loadingTask.promise;
    if (pdf.numPages < 1) return null;

    page = await pdf.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height, 1);
    const targetScale = Math.max(0.2, Math.min(2.0, 1024 / maxDim));
    const viewport = page.getViewport({ scale: targetScale });

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

    const jpegUrl = canvas.toDataURL('image/jpeg', 0.88);
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
  } finally {
    try {
      page?.cleanup?.();
      pdf?.destroy?.();
    } catch {}
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
 * Reads only the first 1.5MB where XMP headers are located to preserve memory
 */
export async function extractEmbeddedXmpThumbnail(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const sliceSize = Math.min(file.size, 1500000);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const textDecoder = new TextDecoder('latin1');
    const text = textDecoder.decode(buffer);

    // 1. Check EPSI Hex Preview
    const epsi = parseEpsiHexPreview(text);
    if (epsi) return epsi;

    // 2. Match Adobe XMP GImg Thumbnail (<xmpGImg:image> or <photoshop:Thumbnail>)
    const xmpPatterns = [
      /<(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)[^>]*>([\s\S]*?)<\/(?:xmpGImg|xapGImg|photoshop|xmp):(?:image|Thumbnail|Thumbnails)>/i,
      /(?:xmpGImg:image|photoshop:Thumbnail|xapGImg:image)=["']([A-Za-z0-9+/=\s\r\n]{100,})["']/i,
    ];

    for (const pattern of xmpPatterns) {
      const match = text.match(pattern);
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
 * Extracts native PDF / Illustrator document from Adobe Illustrator EPS Private Data
 * (%AI9_PrivateDataBegin, %AI12_PrivateDataBegin, %AI24_PrivateDataBegin, or %%BeginData: ... Hex)
 * Uses high-speed multi-chunk zero-allocation binary byte scanning to prevent memory spikes
 */
export async function extractAiPrivateDataPdf(
  buffer: ArrayBuffer
): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const bytes = new Uint8Array(buffer);
    const beginMagic = [0x50, 0x72, 0x69, 0x76, 0x61, 0x74, 0x65, 0x44, 0x61, 0x74, 0x61, 0x42, 0x65, 0x67, 0x69, 0x6E]; // PrivateDataBegin
    const endMagic = [0x50, 0x72, 0x69, 0x76, 0x61, 0x74, 0x65, 0x44, 0x61, 0x74, 0x61, 0x45, 0x6E, 0x64]; // PrivateDataEnd

    const chunks: { start: number; end: number }[] = [];
    let pos = 0;
    let totalHexChars = 0;

    while (pos < bytes.length - beginMagic.length) {
      let beginIdx = -1;
      for (let i = pos; i <= bytes.length - beginMagic.length; i++) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x72) {
          let match = true;
          for (let k = 0; k < beginMagic.length; k++) {
            if (bytes[i + k] !== beginMagic[k]) { match = false; break; }
          }
          if (match) { beginIdx = i; break; }
        }
      }
      if (beginIdx === -1) break;

      let chunkStart = beginIdx + beginMagic.length;
      while (chunkStart < bytes.length && bytes[chunkStart] !== 0x0A && bytes[chunkStart] !== 0x0D) {
        chunkStart++;
      }

      let endIdx = -1;
      for (let i = chunkStart; i <= bytes.length - endMagic.length; i++) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x72) {
          let match = true;
          for (let k = 0; k < endMagic.length; k++) {
            if (bytes[i + k] !== endMagic[k]) { match = false; break; }
          }
          if (match) { endIdx = i; break; }
        }
      }
      if (endIdx === -1) break;

      let chunkEnd = endIdx;
      while (chunkEnd > chunkStart && bytes[chunkEnd] !== 0x0A && bytes[chunkEnd] !== 0x0D) {
        chunkEnd--;
      }

      chunks.push({ start: chunkStart, end: chunkEnd });
      totalHexChars += (chunkEnd - chunkStart);
      pos = endIdx + endMagic.length;
    }

    if (chunks.length > 0 && totalHexChars > 100) {
      const maxOutLen = Math.floor(totalHexChars / 2);
      const outU8 = new Uint8Array(maxOutLen);
      let outIdx = 0;
      let highNibble = -1;

      for (const chunk of chunks) {
        for (let i = chunk.start; i < chunk.end; i++) {
          const b = bytes[i];
          let val = -1;
          if (b >= 0x30 && b <= 0x39) val = b - 0x30;       // 0-9
          else if (b >= 0x61 && b <= 0x66) val = b - 0x61 + 10; // a-f
          else if (b >= 0x41 && b <= 0x46) val = b - 0x41 + 10; // A-F

          if (val !== -1) {
            if (highNibble === -1) {
              highNibble = val;
            } else {
              outU8[outIdx++] = (highNibble << 4) | val;
              highNibble = -1;
            }
          }
        }
      }

      const decodedBytes = outU8.subarray(0, outIdx);
      if (decodedBytes.length > 100) {
        // Check if raw %PDF-
        let pdfOffset = -1;
        for (let j = 0; j < Math.min(decodedBytes.length - 5, 2000); j++) {
          if (
            decodedBytes[j] === 0x25 && // %
            decodedBytes[j + 1] === 0x50 && // P
            decodedBytes[j + 2] === 0x44 && // D
            decodedBytes[j + 3] === 0x46 && // F
            decodedBytes[j + 4] === 0x2D // -
          ) {
            pdfOffset = j;
            break;
          }
        }

        if (pdfOffset !== -1) {
          const pdfBuf = decodedBytes.subarray(pdfOffset).buffer;
          const rendered = await renderPdfBufferToCanvas(pdfBuf);
          if (rendered) return rendered;
        }

        // Check if zlib compressed (0x78 0x9C, 0x78 0xDA, 0x78 0x01)
        if (decodedBytes[0] === 0x78 && (decodedBytes[1] === 0x9C || decodedBytes[1] === 0xDA || decodedBytes[1] === 0x01)) {
          try {
            const inflated = inflate(decodedBytes);
            let infPdfOffset = -1;
            for (let j = 0; j < Math.min(inflated.length - 5, 2000); j++) {
              if (
                inflated[j] === 0x25 &&
                inflated[j + 1] === 0x50 &&
                inflated[j + 2] === 0x44 &&
                inflated[j + 3] === 0x46 &&
                inflated[j + 4] === 0x2D
              ) {
                infPdfOffset = j;
                break;
              }
            }
            if (infPdfOffset !== -1) {
              const pdfBuf = inflated.subarray(infPdfOffset).buffer;
              const rendered = await renderPdfBufferToCanvas(pdfBuf);
              if (rendered) return rendered;
            }
          } catch (zErr) {
            console.warn('inflate error on AI private data:', zErr);
          }
        }
      }
    }
  } catch (err) {
    console.warn('extractAiPrivateDataPdf exception:', err);
  }
  return null;
}

/**
 * Searches for embedded PDF streams or JPEG byte streams inside EPS/AI files
 */
export async function extractEmbeddedStreamFromVector(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string } | null> {
  try {
    const scanSize = Math.min(file.size, 10 * 1024 * 1024);
    const fullBuffer = await file.slice(0, scanSize).arrayBuffer();
    const bytes = new Uint8Array(fullBuffer);

    // 1. Search for PDF Stream (%PDF-1.) across the AI or EPS file
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-
    for (let i = 0; i < bytes.length - 100; i++) {
      if (
        bytes[i] === pdfMagic[0] &&
        bytes[i + 1] === pdfMagic[1] &&
        bytes[i + 2] === pdfMagic[2] &&
        bytes[i + 3] === pdfMagic[3] &&
        bytes[i + 4] === pdfMagic[4]
      ) {
        // Find the last %%EOF after %PDF-
        let eofIdx = -1;
        for (let j = bytes.length - 10; j > i + 100; j--) {
          if (
            bytes[j] === 0x25 && // %
            bytes[j + 1] === 0x25 && // %
            bytes[j + 2] === 0x45 && // E
            bytes[j + 3] === 0x4F && // O
            bytes[j + 4] === 0x46 // F
          ) {
            eofIdx = j + 5;
            break;
          }
        }

        if (eofIdx > i) {
          const pdfSlice = fullBuffer.slice(i, Math.min(bytes.length, eofIdx + 64));
          const renderedPdf = await renderPdfBufferToCanvas(pdfSlice);
          if (renderedPdf) {
            return {
              previewUrl: renderedPdf.previewUrl,
              base64Data: renderedPdf.base64Data,
              mimeTypeForAi: 'image/jpeg',
            };
          }
        }

        const fullSlice = fullBuffer.slice(i);
        const renderedPdf2 = await renderPdfBufferToCanvas(fullSlice);
        if (renderedPdf2) {
          return {
            previewUrl: renderedPdf2.previewUrl,
            base64Data: renderedPdf2.base64Data,
            mimeTypeForAi: 'image/jpeg',
          };
        }
      }
    }

    // 2. Scan for largest embedded JPEG stream (0xFF 0xD8 0xFF ... 0xFF 0xD9)
    let bestStart = -1;
    let bestEnd = -1;
    let maxLen = 0;

    for (let i = 0; i < bytes.length - 500; i++) {
      if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
        let endIdx = -1;
        const maxSearch = Math.min(bytes.length - 1, i + 4 * 1024 * 1024);
        for (let j = i + 300; j < maxSearch; j++) {
          if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i && endIdx - i > 1000) {
          const sliceLen = endIdx - i;
          if (sliceLen > maxLen) {
            maxLen = sliceLen;
            bestStart = i;
            bestEnd = endIdx;
          }
          i = endIdx;
        }
      }
    }

    if (bestStart !== -1 && bestEnd > bestStart) {
      const jpegSlice = bytes.subarray(bestStart, bestEnd);
      const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
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

  // 1. Binary EPS Header check (UTIF.js TIFF or embedded JPEG)
  const tiffResult = await extractTiffFromBinaryEps(file);
  if (tiffResult) return tiffResult;

  // 2. Scan for Adobe Illustrator Private Data (%AI9_PrivateDataBegin -> PDF)
  try {
    const buffer = await file.arrayBuffer();
    const aiPrivateResult = await extractAiPrivateDataPdf(buffer);
    if (aiPrivateResult) return aiPrivateResult;
  } catch (e) {
    console.warn('extractAiPrivateDataPdf error:', e);
  }

  // 3. Embedded PDF or JPEG stream across full binary buffer
  const streamResult = await extractEmbeddedStreamFromVector(file);
  if (streamResult) return streamResult;

  // 4. XMP Packet thumbnail (<xmpGImg:image> / photoshop:Thumbnail)
  const xmpResult = await extractEmbeddedXmpThumbnail(file);
  if (xmpResult) return xmpResult;

  return null;
}

/**
 * Generates a clean SVG vector icon fallback with file dimensions, color mode, creator, and typography
 * extracted from the EPS PostScript headers.
 */
export function generateEpsFallbackSvg(options: {
  filename: string;
  fileSize: number;
  dimensions?: { width: number; height: number; formattedDimensions: string };
  colorMode: string;
  creator?: string;
  cleanSubject?: string;
  colors?: string[];
}): string {
  const { filename, fileSize, dimensions, colorMode, creator, cleanSubject, colors = [] } = options;
  const dimStr = dimensions ? dimensions.formattedDimensions : 'Vector Artboard';
  const modeStr = colorMode || 'CMYK';
  const displayTitle = cleanSubject || filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const displaySubtitle = `${filename} • ${bytesToSize(fileSize)}${creator ? ` • ${creator}` : ''}`;

  const defaultPalette = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const palette = colors.length >= 2 ? colors.slice(0, 6) : defaultPalette;

  // Swatches SVG markup
  let swatchesSvg = '';
  const swatchWidth = 28;
  const startX = 400 - (palette.length * (swatchWidth + 8)) / 2;
  palette.forEach((col, idx) => {
    swatchesSvg += `<rect x="${startX + idx * (swatchWidth + 8)}" y="430" width="${swatchWidth}" height="14" rx="3" fill="${col}" stroke="#cbd5e1" stroke-width="1"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    </pattern>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.06"/>
    </filter>
  </defs>
  
  <!-- Canvas Background -->
  <rect width="800" height="600" fill="url(#bgGrad)"/>
  <rect width="800" height="600" fill="url(#grid)"/>

  <!-- Artboard Frame -->
  <rect x="30" y="30" width="740" height="540" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  
  <!-- Header Badges -->
  <g transform="translate(60, 60)">
    <!-- Format Badge -->
    <rect x="0" y="0" width="72" height="28" rx="6" fill="#4f46e5" fill-opacity="0.1"/>
    <text x="36" y="18" fill="#4f46e5" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" text-anchor="middle">EPS</text>

    <!-- Color Mode Badge -->
    <rect x="80" y="0" width="88" height="28" rx="6" fill="#0284c7" fill-opacity="0.1"/>
    <text x="124" y="18" fill="#0284c7" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${modeStr}</text>

    <!-- Dimensions Badge -->
    <rect x="176" y="0" width="130" height="28" rx="6" fill="#475569" fill-opacity="0.08"/>
    <text x="241" y="18" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" text-anchor="middle">${dimStr}</text>
  </g>

  <!-- Vector Curves and Bezier Nodes Graphic -->
  <g transform="translate(400, 240)">
    <!-- Bezier Guides -->
    <path d="M -180 40 C -80 -90, 80 90, 180 -40" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-opacity="0.7"/>
    <path d="M -160 -30 C -60 80, 60 -80, 160 30" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-opacity="0.7"/>
    
    <!-- Bezier Nodes -->
    <rect x="-184" y="36" width="8" height="8" fill="#ffffff" stroke="#6366f1" stroke-width="2"/>
    <rect x="176" y="-44" width="8" height="8" fill="#ffffff" stroke="#6366f1" stroke-width="2"/>
    <circle cx="-80" cy="-90" r="3.5" fill="#6366f1"/>
    <circle cx="80" cy="90" r="3.5" fill="#6366f1"/>
    <line x1="-180" y1="40" x2="-80" y2="-90" stroke="#c7d2fe" stroke-width="1.5" stroke-dasharray="3,3"/>
    <line x1="180" y1="-40" x2="80" y2="90" stroke="#c7d2fe" stroke-width="1.5" stroke-dasharray="3,3"/>

    <!-- Central Vector Pen Emblem -->
    <rect x="-42" y="-42" width="84" height="84" rx="20" fill="#4f46e5" filter="url(#shadow)"/>
    <path d="M 0 -22 L 18 10 L 0 26 L -18 10 Z" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="0" cy="8" r="3" fill="#ffffff"/>
  </g>

  <!-- Swatches -->
  ${swatchesSvg}

  <!-- Typography -->
  <text x="400" y="485" fill="#0f172a" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" text-anchor="middle">${displayTitle}</text>
  <text x="400" y="515" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" text-anchor="middle">${displaySubtitle}</text>
</svg>`;
}

/**
 * Generates a deterministic visual thumbnail from vector file structure (PostScript paths, BoundingBox, colors, or structural nodes)
 * when primary rasterization steps fail, guaranteeing every EPS/vector file has a high-quality visual preview.
 */
export async function generateDeterministicVectorThumbnail(file: File): Promise<{
  previewUrl: string;
  base64Data: string;
  mimeTypeForAi: string;
  isRealArtworkPreview: boolean;
}> {
  let psText = '';
  try {
    const textDecoder = new TextDecoder('latin1');
    const buffer = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
    psText = textDecoder.decode(buffer);
  } catch (e) {
    console.warn('Could not decode vector file slice for deterministic thumbnail:', e);
  }

  const semInfo = extractVectorSemanticInfo(psText, file.name);
  const ext = getFileExtension(file.name).toUpperCase() || 'EPS';
  const cleanSubject = semInfo.cleanSubject || cleanVectorSubject(file.name);
  const colorMode = semInfo.colorMode || 'CMYK';
  const dimensions = semInfo.dimensions;
  const creator = semInfo.creator || '';

  // 1. Extract BoundingBox if present
  let bbox = { llx: 0, lly: 0, urx: 600, ury: 600, width: 600, height: 600 };
  if (dimensions) {
    bbox = {
      llx: dimensions.minX,
      lly: dimensions.minY,
      urx: dimensions.maxX,
      ury: dimensions.maxY,
      width: dimensions.width,
      height: dimensions.height,
    };
  } else {
    const bboxMatch = psText.match(/%%BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i);
    if (bboxMatch && bboxMatch[1] !== '(atend)') {
      const llx = parseInt(bboxMatch[1], 10);
      const lly = parseInt(bboxMatch[2], 10);
      const urx = parseInt(bboxMatch[3], 10);
      const ury = parseInt(bboxMatch[4], 10);
      if (!isNaN(llx) && !isNaN(lly) && !isNaN(urx) && !isNaN(ury) && urx > llx && ury > lly) {
        bbox = { llx, lly, urx, ury, width: urx - llx, height: ury - lly };
      }
    }
  }

  // 2. Extract Palette Colors from PostScript operators and metadata
  const extractedColors: string[] = [...(semInfo.colors || [])];
  const rgbRegex = /([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+(?:setrgbcolor|rg|RG)\b/g;
  let rgbMatch;
  while ((rgbMatch = rgbRegex.exec(psText)) !== null && extractedColors.length < 12) {
    const r = Math.round(parseFloat(rgbMatch[1]) * 255);
    const g = Math.round(parseFloat(rgbMatch[2]) * 255);
    const b = Math.round(parseFloat(rgbMatch[3]) * 255);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b) && (r < 240 || g < 240 || b < 240)) {
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      if (!extractedColors.includes(hex)) extractedColors.push(hex);
    }
  }

  const cmykRegex = /([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+(?:setcmykcolor|k|K)\b/g;
  let cmykMatch;
  while ((cmykMatch = cmykRegex.exec(psText)) !== null && extractedColors.length < 12) {
    const c = parseFloat(cmykMatch[1]);
    const m = parseFloat(cmykMatch[2]);
    const y = parseFloat(cmykMatch[3]);
    const k = parseFloat(cmykMatch[4]);
    if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      if (!extractedColors.includes(hex)) extractedColors.push(hex);
    }
  }

  // Deterministic PRNG Seed from filename + file size
  let seed = 0x811c9dc5;
  const seedStr = `${file.name}_${file.size}_${psText.slice(0, 500)}`;
  for (let i = 0; i < seedStr.length; i++) {
    seed ^= seedStr.charCodeAt(i);
    seed = Math.imul(seed, 0x01000193);
  }
  const prng = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return (seed >>> 0) / 4294967296;
  };

  // Default color palette if none found in PS stream
  const defaultPalettes = [
    ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'],
    ['#06b6d4', '#0ea5e9', '#3b82f6', '#10b981', '#14b8a6'],
    ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1'],
    ['#10b981', '#059669', '#047857', '#0284c7', '#0369a1'],
    ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#1e1b4b'],
  ];
  const palette = extractedColors.length >= 2 ? extractedColors : defaultPalettes[Math.floor(prng() * defaultPalettes.length)];

  // Try parsing raw PostScript path commands if available
  interface PsCommand {
    type: 'moveto' | 'lineto' | 'curveto' | 'rectfill' | 'rectstroke' | 'close';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    x3?: number;
    y3?: number;
    w?: number;
    h?: number;
    color?: string;
  }
  const parsedCommands: PsCommand[] = [];
  const lines = psText.split(/\r?\n/);
  let activeColor = palette[0];

  for (let i = 0; i < Math.min(lines.length, 3000); i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('%')) continue;

    // Check color assignment
    const rgbLine = line.match(/^([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+([0-1](?:\.\d+)?)\s+(?:setrgbcolor|rg)\b/);
    if (rgbLine) {
      const r = Math.round(parseFloat(rgbLine[1]) * 255);
      const g = Math.round(parseFloat(rgbLine[2]) * 255);
      const b = Math.round(parseFloat(rgbLine[3]) * 255);
      activeColor = `rgb(${r},${g},${b})`;
    }

    // moveto / lineto / curveto / rectfill
    const moveMatch = line.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:moveto|m)\b/);
    if (moveMatch) {
      parsedCommands.push({ type: 'moveto', x: parseFloat(moveMatch[1]), y: parseFloat(moveMatch[2]), color: activeColor });
    }
    const lineMatch = line.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:lineto|l)\b/);
    if (lineMatch) {
      parsedCommands.push({ type: 'lineto', x: parseFloat(lineMatch[1]), y: parseFloat(lineMatch[2]), color: activeColor });
    }
    const curveMatch = line.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:curveto|c)\b/);
    if (curveMatch) {
      parsedCommands.push({
        type: 'curveto',
        x1: parseFloat(curveMatch[1]),
        y1: parseFloat(curveMatch[2]),
        x2: parseFloat(curveMatch[3]),
        y2: parseFloat(curveMatch[4]),
        x3: parseFloat(curveMatch[5]),
        y3: parseFloat(curveMatch[6]),
        color: activeColor,
      });
    }
    const rectMatch = line.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:rectfill|rectstroke|re)\b/);
    if (rectMatch) {
      parsedCommands.push({
        type: line.includes('stroke') ? 'rectstroke' : 'rectfill',
        x: parseFloat(rectMatch[1]),
        y: parseFloat(rectMatch[2]),
        w: parseFloat(rectMatch[3]),
        h: parseFloat(rectMatch[4]),
        color: activeColor,
      });
    }

    if (parsedCommands.length >= 1000) break;
  }

  // Draw Canvas Thumbnail (800 x 600)
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Backdrop
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 800, 600);

    // Subtle Vector Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 40; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 40; y < 600; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }

    // Outer Artboard Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 760, 560);

    // Header Badges: Format, Color Mode, Dimensions
    // Format Badge (EPS)
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.roundRect(40, 40, 60, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ext, 70, 53);

    // Color Mode Badge (CMYK / RGB / Grayscale)
    ctx.fillStyle = '#f0f9ff';
    ctx.beginPath();
    ctx.roundRect(110, 40, 84, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(colorMode, 152, 53);

    // Dimensions Badge (e.g. 800 x 600 pt)
    const dimText = dimensions ? dimensions.formattedDimensions : `${bbox.width} × ${bbox.height} pt`;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(204, 40, 140, 26, 6);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(dimText, 274, 53);

    // Render path commands if found
    if (parsedCommands.length >= 8) {
      const artArea = { x: 50, y: 80, w: 700, h: 360 };
      const scaleX = artArea.w / (bbox.width || 600);
      const scaleY = artArea.h / (bbox.height || 600);
      const scale = Math.min(scaleX, scaleY);

      ctx.save();
      ctx.translate(artArea.x + (artArea.w - bbox.width * scale) / 2, artArea.y + (artArea.h - bbox.height * scale) / 2);

      // PostScript has origin at bottom-left, Canvas at top-left
      ctx.transform(scale, 0, 0, -scale, -bbox.llx * scale, (bbox.height + bbox.lly) * scale);

      ctx.lineWidth = 2 / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let inPath = false;
      for (const cmd of parsedCommands) {
        if (cmd.type === 'moveto') {
          if (inPath) ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = cmd.color || palette[0];
          ctx.fillStyle = cmd.color || palette[0];
          ctx.moveTo(cmd.x!, cmd.y!);
          inPath = true;
        } else if (cmd.type === 'lineto') {
          ctx.lineTo(cmd.x!, cmd.y!);
        } else if (cmd.type === 'curveto') {
          ctx.bezierCurveTo(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x3!, cmd.y3!);
        } else if (cmd.type === 'rectfill') {
          ctx.fillStyle = cmd.color || palette[0];
          ctx.fillRect(cmd.x!, cmd.y!, cmd.w!, cmd.h!);
        } else if (cmd.type === 'rectstroke') {
          ctx.strokeStyle = cmd.color || palette[0];
          ctx.strokeRect(cmd.x!, cmd.y!, cmd.w!, cmd.h!);
        }
      }
      if (inPath) ctx.stroke();
      ctx.restore();
    } else {
      // Deterministic Geometric Structure & Bezier Nodes Artwork
      const centerX = 400;
      const centerY = 230;

      // Draw vector geometry curves
      const numCurves = 4 + Math.floor(prng() * 3);
      for (let c = 0; c < numCurves; c++) {
        const color = palette[c % palette.length];
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}18`;
        ctx.lineWidth = 3;

        ctx.beginPath();
        const startX = centerX - 180 + prng() * 60;
        const startY = centerY + (prng() - 0.5) * 120;
        const cp1X = centerX - 60 + (prng() - 0.5) * 100;
        const cp1Y = centerY - 120 + (prng() - 0.5) * 60;
        const cp2X = centerX + 60 + (prng() - 0.5) * 100;
        const cp2Y = centerY + 120 + (prng() - 0.5) * 60;
        const endX = centerX + 180 - prng() * 60;
        const endY = centerY + (prng() - 0.5) * 120;

        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        ctx.stroke();

        // Bezier Node Handles & Control Points
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        // Start Node
        ctx.fillRect(startX - 4, startY - 4, 8, 8);
        ctx.strokeRect(startX - 4, startY - 4, 8, 8);

        // End Node
        ctx.fillRect(endX - 4, endY - 4, 8, 8);
        ctx.strokeRect(endX - 4, endY - 4, 8, 8);

        // Control point circle
        ctx.beginPath();
        ctx.arc(cp1X, cp1Y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cp2X, cp2Y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Central Vector Pen Emblem
      ctx.fillStyle = palette[0] || '#4f46e5';
      ctx.beginPath();
      ctx.roundRect(355, 185, 90, 90, 20);
      ctx.fill();

      // Pen Icon
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(400, 208);
      ctx.lineTo(418, 240);
      ctx.lineTo(400, 258);
      ctx.lineTo(382, 240);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(400, 236, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Palette Color Swatches Bar
    const swatchW = 24;
    const totalSwatchW = palette.length * (swatchW + 8);
    let swatchStartX = 400 - totalSwatchW / 2;
    for (const col of palette) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(swatchStartX, 440, swatchW, 14, 4);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.stroke();
      swatchStartX += swatchW + 8;
    }

    // Clean Typography in Center Bottom
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanSubject || file.name, 400, 485);

    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${file.name} • ${bytesToSize(file.size)}${creator ? ` • ${creator}` : ''}`, 400, 515);

    // Vector Pill Badge
    ctx.fillStyle = '#eef2ff';
    ctx.beginPath();
    ctx.roundRect(280, 538, 240, 30, 15);
    ctx.fill();
    ctx.strokeStyle = '#c7d2fe';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#4338ca';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${ext} Vector Artwork • ${colorMode}`, 400, 553);
  }

  const jpegUrl = canvas.toDataURL('image/jpeg', 0.90);
  return {
    previewUrl: jpegUrl,
    base64Data: '', // CRITICAL: Keep empty for AI vision so AI vision models don't analyze placeholder graphic
    mimeTypeForAi: 'image/jpeg',
    isRealArtworkPreview: false,
  };
}

/**
 * Creates a clean, professional vector representation badge when an EPS has no embedded raster preview.
 * NOTE: Returns base64Data as empty string so AI vision models are NEVER sent the placeholder badge!
 */
export async function renderEpsCanvasPreview(file: File): Promise<{ previewUrl: string; base64Data: string; mimeTypeForAi: string; isRealArtworkPreview: boolean }> {
  return generateDeterministicVectorThumbnail(file);
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
  if (inFlightPrepCache.has(file)) {
    return inFlightPrepCache.get(file)!;
  }

  const prepPromise = (async () => {
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
        // Extract rich vector metadata (Titles, Descriptions, Keywords, Layer names, Text, Colors) from first 1MB
        const textDecoder = new TextDecoder('latin1');
        const headBuffer = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer();
        const psHeadText = textDecoder.decode(headBuffer);
        const semInfo = extractVectorSemanticInfo(psHeadText, file.name);
        vectorSemanticText = semInfo.summaryText;
        cleanSubject = semInfo.cleanSubject;
      } catch (e) {
        console.warn('Vector semantic info extraction error:', e);
      }

      try {
        // 1st Priority: Server-Side Ghostscript & Multi-Strategy Vector Engine (up to 80MB, fast native binary, 0% browser load)
        if (file.size <= 80 * 1024 * 1024) {
          const serverRendered = await renderVectorViaServer(file);
          if (serverRendered && serverRendered.base64Data) {
            return {
              ...serverRendered,
              isRealArtworkPreview: true,
              vectorSemanticText,
              cleanSubject,
            };
          }
        }

        // 2nd Priority: Instant Binary EPS TIFF check (< 2ms, 30 bytes check)
        const tiffExtracted = await extractTiffFromBinaryEps(file);
        if (tiffExtracted && tiffExtracted.base64Data) {
          return {
            ...tiffExtracted,
            isRealArtworkPreview: true,
            vectorSemanticText,
            cleanSubject,
          };
        }

        // 3rd Priority: Other embedded stream extraction (AI Private Data / PDF Stream / XMP)
        const extracted = await extractEmbeddedImageFromVector(file);
        if (extracted && extracted.base64Data) {
          return {
            ...extracted,
            isRealArtworkPreview: true,
            vectorSemanticText,
            cleanSubject,
          };
        }

        // 4th Priority: Client-Side PostScript Vector Interpreter (with timeout guards)
        if (file.size <= 15 * 1024 * 1024) {
          try {
            const sliceSize = Math.min(file.size, 8 * 1024 * 1024);
            const buffer = await file.slice(0, sliceSize).arrayBuffer();
            const textDecoder = new TextDecoder('latin1');
            const psText = textDecoder.decode(buffer);
            const psCanvasRes = renderPostScriptCodeToCanvas(psText, 1024);
            if (psCanvasRes && psCanvasRes.base64Data) {
              return {
                ...psCanvasRes,
                isRealArtworkPreview: true,
                vectorSemanticText,
                cleanSubject,
              };
            }
          } catch (psErr) {
            console.warn('Client PostScript canvas interpreter fallback:', psErr);
          }
        }

        // 5th Priority: Clean vector artboard showcase canvas preview with raw vector base64 for server-side rasterization
        let rawVectorBase64 = '';
        try {
          rawVectorBase64 = await readFileAsBase64Only(file);
        } catch (e) {
          // ignore
        }

        const fallbackBadge = await renderEpsCanvasPreview(file);
        return {
          previewUrl: fallbackBadge.previewUrl,
          base64Data: rawVectorBase64, // Raw vector data sent to backend so server can rasterize into genuine JPEG
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
  })();

  inFlightPrepCache.set(file, prepPromise);
  return prepPromise;
}


