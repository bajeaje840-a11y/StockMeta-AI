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

  if (category === 'image') {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64Data = dataUrl.split(',')[1];
      let mimeType = file.type || 'image/jpeg';
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(mimeType.toLowerCase())) {
        mimeType = 'image/jpeg';
      }
      return {
        previewUrl: dataUrl,
        base64Data,
        mimeTypeForAi: mimeType,
      };
    } catch (e) {
      console.error('Error reading image file:', e);
    }
  }

  // Fallback for AI/EPS/PDF or failed video/images: create data URL or read raw data
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const parts = dataUrl.split(',');
    return {
      previewUrl: dataUrl,
      base64Data: parts[1] || '',
      mimeTypeForAi: 'image/jpeg', // Always use standard image MIME for Gemini vision input
    };
  } catch (e) {
    return {
      previewUrl: '',
      base64Data: '',
      mimeTypeForAi: 'image/jpeg',
    };
  }
}
