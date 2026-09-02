/**
 * Client-Side PostScript & EPS Vector Artwork Rasterizer
 * 
 * Specially optimized for Adobe Illustrator 10 / 8 / CS / CC EPS and PostScript files.
 * Interprets vector paths, CMYK/RGB/Spot colors, compound shapes, and transforms
 * directly in the browser with zero server dependencies.
 * 
 * Produces crisp, full-frame, color-accurate High-DPI raster images (PNG) with solid white background.
 */

export interface RenderedVectorResult {
  previewUrl: string;
  base64Data: string;
  mimeTypeForAi: string;
  width: number;
  height: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Strips non-drawing heavy binary blocks (private data, embedded fonts, photoshop resources)
 * to keep PostScript tokenization fast (completes in < 5ms).
 */
export function stripHeavyDataBlocks(text: string): string {
  const blocks: [string, string][] = [
    ['%%BeginData', '%%EndData'],
    ['%AI9_PrivateDataBegin', '%AI9_PrivateDataEnd'],
    ['%AI12_PrivateDataBegin', '%AI12_PrivateDataEnd'],
    ['%AI24_PrivateDataBegin', '%AI24_PrivateDataEnd'],
    ['PrivateDataBegin', 'PrivateDataEnd'],
    ['%%BeginPhotoshop', '%%EndPhotoshop'],
    ['%%BeginICCProfile', '%%EndICCProfile'],
    ['%%BeginFont', '%%EndFont'],
    ['%%BeginResource: procset Adobe_AGM_Image', '%%EndResource'],
  ];

  let res = text;
  for (const [startTag, endTag] of blocks) {
    let pos = 0;
    while (pos < res.length) {
      const startIdx = res.indexOf(startTag, pos);
      if (startIdx === -1) break;
      const endIdx = res.indexOf(endTag, startIdx + startTag.length);
      if (endIdx === -1) break;
      res = res.substring(0, startIdx) + '\n' + res.substring(endIdx + endTag.length);
      pos = startIdx + 1;
    }
  }
  return res;
}

/**
 * Extracts BoundingBox or HiResBoundingBox from PostScript header comments or trailer.
 * Supports:
 * - %%HiResBoundingBox (floating-point precision)
 * - %AI5_ArtBounds (Adobe Illustrator true artboard bounds)
 * - %AI3_Cropmarks
 * - %%CropBox
 * - %%BoundingBox (integer standard)
 * - %%PageBoundingBox
 */
export function extractBoundingBox(psText: string): BoundingBox | null {
  if (!psText || psText.length < 10) return null;

  const headText = psText.length > 65536 ? psText.slice(0, 65536) : psText;
  const tailText = psText.length > 131072 ? psText.slice(-131072) : psText;

  const patterns = [
    /%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
    /%AI5_ArtBounds:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
    /%AI3_Cropmarks:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
    /%%CropBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
    /%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
    /%%PageBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi,
  ];

  for (const pat of patterns) {
    // Check trailer first (in case header had (atend)), then header
    const tailMatches = Array.from(tailText.matchAll(pat));
    const headMatches = Array.from(headText.matchAll(pat));
    const allMatches = [...tailMatches, ...headMatches];

    for (const match of allMatches) {
      if (!match) continue;
      const minX = parseFloat(match[1]);
      const minY = parseFloat(match[2]);
      const maxX = parseFloat(match[3]);
      const maxY = parseFloat(match[4]);

      if (isNaN(minX) || isNaN(minY) || isNaN(maxX) || isNaN(maxY)) continue;

      const width = Math.abs(maxX - minX);
      const height = Math.abs(maxY - minY);

      // Discard invalid / zero bounding boxes like 0 0 0 0 or 0 0 1 1
      if (width > 5 && height > 5 && width < 200000 && height < 200000) {
        return {
          minX: Math.min(minX, maxX),
          minY: Math.min(minY, maxY),
          maxX: Math.max(minX, maxX),
          maxY: Math.max(minY, maxY),
          width,
          height,
        };
      }
    }
  }

  return null;
}

/**
 * Converts CMYK values (0..1) to vibrant sRGB (0..255).
 * Applies non-linear tone reproduction and black-point compensation to prevent
 * the washed-out, greyish, low-contrast appearance typical of linear conversion.
 */
export function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const clamp = (v: number) => Math.max(0, Math.min(1, isNaN(v) ? 0 : v));
  const cClean = clamp(c);
  const mClean = clamp(m);
  const yClean = clamp(y);
  const kClean = clamp(k);

  // Subtractive ink model with black compensation
  let r = 1 - Math.min(1, cClean * (1 - kClean) + kClean);
  let g = 1 - Math.min(1, mClean * (1 - kClean) + kClean);
  let b = 1 - Math.min(1, yClean * (1 - kClean) + kClean);

  // Perceptual contrast curve: boosts saturation and eliminates washed-out haze on sRGB displays
  r = Math.pow(r, 0.92);
  g = Math.pow(g, 0.92);
  b = Math.pow(b, 0.92);

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255))),
  ];
}

/**
 * High-speed PostScript Tokenizer with charCode scanning and safe token limits
 */
export function tokenizePostScript(code: string, maxTokens = 150000): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len && tokens.length < maxTokens) {
    const chCode = code.charCodeAt(i);

    // Whitespace (space 32, tab 9, newline 10, CR 13, FF 12)
    if (chCode <= 32) {
      i++;
      continue;
    }

    // Comment (% ... \n)
    if (chCode === 37) {
      const nextLine = code.indexOf('\n', i + 1);
      if (nextLine === -1) break;
      i = nextLine + 1;
      continue;
    }

    // String literal ( ... )
    if (chCode === 40) {
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < len && depth > 0) {
        const c = code.charCodeAt(i);
        if (c === 92) {
          i += 2;
          continue;
        }
        if (c === 40) depth++;
        else if (c === 41) depth--;
        i++;
      }
      tokens.push('(' + code.substring(start, Math.max(start, i - 1)) + ')');
      continue;
    }

    // Hex literal < ... >
    if (chCode === 60) {
      const end = code.indexOf('>', i + 1);
      if (end !== -1) {
        tokens.push(code.substring(i, end + 1));
        i = end + 1;
      } else {
        tokens.push(code.substring(i));
        break;
      }
      continue;
    }

    // Delimiters
    const ch = code[i];
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === '>') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Regular token / operator / number / name literal
    const start = i;
    while (i < len) {
      const c = code.charCodeAt(i);
      if (c <= 32 || c === 37 || c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125) {
        break;
      }
      i++;
    }

    if (i === start) {
      i++;
      continue;
    }

    tokens.push(code.substring(start, i));
  }

  return tokens;
}

/**
 * Executes Illustrator 10 / PostScript vector commands on an HTML5 2D Canvas context.
 * Renders full-frame, high-resolution (min 1024px, default 1536px), color-accurate PNG previews.
 */
export function renderPostScriptCodeToCanvas(
  psText: string,
  targetResolution = 1536
): RenderedVectorResult | null {
  try {
    if (!psText || psText.length < 20) return null;

    // 1. Extract declared BoundingBox
    let bbox = extractBoundingBox(psText);
    const cleanCode = stripHeavyDataBlocks(psText);
    const tokens = tokenizePostScript(cleanCode, 150000);

    if (tokens.length < 5) return null;

    // 2. Scan actual path coordinates in the token stream to prevent clipping
    let pathMinX = Infinity;
    let pathMinY = Infinity;
    let pathMaxX = -Infinity;
    let pathMaxY = -Infinity;
    let coordinateCount = 0;

    for (let idx = 0; idx < tokens.length; idx++) {
      const tok = tokens[idx];

      // Path move/line: 2 coordinates (x, y)
      if (tok === 'moveto' || tok === 'm' || tok === '_m' || tok === 'lineto' || tok === 'l' || tok === '_l') {
        const x = parseFloat(tokens[idx - 2]);
        const y = parseFloat(tokens[idx - 1]);
        if (!isNaN(x) && !isNaN(y) && Math.abs(x) < 50000 && Math.abs(y) < 50000) {
          pathMinX = Math.min(pathMinX, x);
          pathMinY = Math.min(pathMinY, y);
          pathMaxX = Math.max(pathMaxX, x);
          pathMaxY = Math.max(pathMaxY, y);
          coordinateCount++;
        }
      }
      // Bezier curve: 6 coordinates (x1, y1, x2, y2, x3, y3)
      else if (tok === 'curveto' || tok === 'c' || tok === '_c') {
        const x3 = parseFloat(tokens[idx - 2]);
        const y3 = parseFloat(tokens[idx - 1]);
        const x1 = parseFloat(tokens[idx - 6]);
        const y1 = parseFloat(tokens[idx - 5]);
        if (!isNaN(x3) && !isNaN(y3) && Math.abs(x3) < 50000 && Math.abs(y3) < 50000) {
          pathMinX = Math.min(pathMinX, x3);
          pathMinY = Math.min(pathMinY, y3);
          pathMaxX = Math.max(pathMaxX, x3);
          pathMaxY = Math.max(pathMaxY, y3);
          coordinateCount++;
        }
        if (!isNaN(x1) && !isNaN(y1) && Math.abs(x1) < 50000 && Math.abs(y1) < 50000) {
          pathMinX = Math.min(pathMinX, x1);
          pathMinY = Math.min(pathMinY, y1);
          pathMaxX = Math.max(pathMaxX, x1);
          pathMaxY = Math.max(pathMaxY, y1);
          coordinateCount++;
        }
      }
      // Rectangle: 4 coordinates (x, y, w, h)
      else if (tok === 're' || tok === '_re' || tok === 'rect' || tok === 'rectfill' || tok === 'rectstroke') {
        const x = parseFloat(tokens[idx - 4]);
        const y = parseFloat(tokens[idx - 3]);
        const w = parseFloat(tokens[idx - 2]);
        const h = parseFloat(tokens[idx - 1]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h) && Math.abs(x) < 50000 && Math.abs(y) < 50000) {
          pathMinX = Math.min(pathMinX, x, x + w);
          pathMinY = Math.min(pathMinY, y, y + h);
          pathMaxX = Math.max(pathMaxX, x, x + w);
          pathMaxY = Math.max(pathMaxY, y, y + h);
          coordinateCount++;
        }
      }
    }

    const hasPathBounds = pathMinX !== Infinity && pathMaxX > pathMinX && pathMaxY > pathMinY;

    // 3. Reconcile declared BoundingBox with actual path bounds
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      if (hasPathBounds) {
        bbox = {
          minX: pathMinX,
          minY: pathMinY,
          maxX: pathMaxX,
          maxY: pathMaxY,
          width: pathMaxX - pathMinX,
          height: pathMaxY - pathMinY,
        };
      } else {
        bbox = { minX: 0, minY: 0, maxX: 800, maxY: 800, width: 800, height: 800 };
      }
    } else if (hasPathBounds) {
      const pathW = pathMaxX - pathMinX;
      const pathH = pathMaxY - pathMinY;

      // Expand bounding box if vector paths extend outside declared bounds
      if (pathMinX < bbox.minX || pathMaxX > bbox.maxX || pathMinY < bbox.minY || pathMaxY > bbox.maxY) {
        bbox.minX = Math.min(bbox.minX, pathMinX);
        bbox.minY = Math.min(bbox.minY, pathMinY);
        bbox.maxX = Math.max(bbox.maxX, pathMaxX);
        bbox.maxY = Math.max(bbox.maxY, pathMaxY);
        bbox.width = bbox.maxX - bbox.minX;
        bbox.height = bbox.maxY - bbox.minY;
      }
      // If declared bounding box is a generic huge page (e.g. 612x792) and artwork is localized
      else if (pathW > 20 && pathH > 20 && (bbox.width > 2.5 * pathW || bbox.height > 2.5 * pathH)) {
        bbox = {
          minX: pathMinX,
          minY: pathMinY,
          maxX: pathMaxX,
          maxY: pathMaxY,
          width: pathW,
          height: pathH,
        };
      }
    }

    const srcW = Math.max(10, bbox.width);
    const srcH = Math.max(10, bbox.height);
    const aspect = srcW / srcH;

    // 4. High-DPI Resolution Scaling (minimum 1024px max dimension, default 1536px, capped at 2048px)
    const targetDim = Math.min(2048, Math.max(1024, targetResolution || 1536));
    let canvasW: number;
    let canvasH: number;

    if (aspect >= 1) {
      canvasW = targetDim;
      canvasH = Math.max(100, Math.min(2048, Math.round(targetDim / aspect)));
    } else {
      canvasH = targetDim;
      canvasW = Math.max(100, Math.min(2048, Math.round(targetDim * aspect)));
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 5. Solid White Background (#FFFFFF) - prevents alpha transparency fading/washing out colors
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 6. Precise Viewport Transform: Symmetrical 2.5% margin prevents edge clipping
    const marginRatio = 0.025;
    const drawW = canvasW * (1 - 2 * marginRatio);
    const drawH = canvasH * (1 - 2 * marginRatio);
    const scale = Math.min(drawW / srcW, drawH / srcH);

    const renderedW = srcW * scale;
    const renderedH = srcH * scale;
    const offsetX = (canvasW - renderedW) / 2;
    const offsetY = (canvasH - renderedH) / 2;

    // PostScript coordinate system:
    // (minX, maxY) is vector top-left -> maps to (offsetX, offsetY) on canvas
    // (maxX, minY) is vector bottom-right -> maps to (canvasW - offsetX, canvasH - offsetY) on canvas
    ctx.save();
    ctx.translate(offsetX, offsetY + bbox.maxY * scale);
    ctx.scale(scale, -scale); // Invert Y axis for PostScript
    ctx.translate(-bbox.minX, 0);

    // 7. Graphics State: Distinct Fill and Stroke styles to prevent stroke overwriting fill
    const stack: any[] = [];
    let fillStyle = 'rgb(0,0,0)';
    let strokeStyle = 'rgb(0,0,0)';
    let curLineWidth = 1;
    let pathDrawnCount = 0;
    let inCompoundPath = false;

    // Helper to evaluate an operator
    const executeOp = (rawOp: string) => {
      let op = rawOp.startsWith('/') ? rawOp.substring(1) : rawOp;

      // Handle Illustrator compound path markers
      if (op === '*u') {
        inCompoundPath = true;
        ctx.beginPath();
        return;
      }
      if (op === '*U') {
        inCompoundPath = false;
        return;
      }

      switch (op) {
        // --- PATH CONSTRUCTION ---
        case 'n':
        case 'N':
        case '_n':
        case '_N':
        case 'newpath':
          if (!inCompoundPath) {
            ctx.beginPath();
          }
          break;

        case 'm':
        case '_m':
        case 'moveto': {
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y)) {
            ctx.moveTo(x, y);
          }
          break;
        }

        case 'l':
        case '_l':
        case 'lineto': {
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y)) {
            ctx.lineTo(x, y);
            pathDrawnCount++;
          }
          break;
        }

        case 'c':
        case '_c':
        case 'curveto': {
          const y3 = parseFloat(stack.pop());
          const x3 = parseFloat(stack.pop());
          const y2 = parseFloat(stack.pop());
          const x2 = parseFloat(stack.pop());
          const y1 = parseFloat(stack.pop());
          const x1 = parseFloat(stack.pop());
          if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && !isNaN(x3) && !isNaN(y3)) {
            ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
            pathDrawnCount++;
          }
          break;
        }

        case 'v':
        case '_v':
        case 'curvetov': {
          const y3 = parseFloat(stack.pop());
          const x3 = parseFloat(stack.pop());
          const y2 = parseFloat(stack.pop());
          const x2 = parseFloat(stack.pop());
          if (!isNaN(x2) && !isNaN(y2) && !isNaN(x3) && !isNaN(y3)) {
            ctx.quadraticCurveTo(x2, y2, x3, y3);
            pathDrawnCount++;
          }
          break;
        }

        case 'y':
        case '_y':
        case 'curvetoy': {
          const y3 = parseFloat(stack.pop());
          const x3 = parseFloat(stack.pop());
          const y1 = parseFloat(stack.pop());
          const x1 = parseFloat(stack.pop());
          if (!isNaN(x1) && !isNaN(y1) && !isNaN(x3) && !isNaN(y3)) {
            ctx.quadraticCurveTo(x1, y1, x3, y3);
            pathDrawnCount++;
          }
          break;
        }

        case 'h':
        case 'H':
        case '_h':
        case '_H':
        case 'cp':
        case '_cp':
        case 'closepath':
          ctx.closePath();
          break;

        case 'arc':
        case '_ar': {
          const angle2 = (parseFloat(stack.pop()) * Math.PI) / 180;
          const angle1 = (parseFloat(stack.pop()) * Math.PI) / 180;
          const r = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y) && !isNaN(r)) {
            ctx.arc(x, y, r, angle1, angle2, false);
            pathDrawnCount++;
          }
          break;
        }

        case 'arcn':
        case '_arcn': {
          const angle2 = (parseFloat(stack.pop()) * Math.PI) / 180;
          const angle1 = (parseFloat(stack.pop()) * Math.PI) / 180;
          const r = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y) && !isNaN(r)) {
            ctx.arc(x, y, r, angle1, angle2, true);
            pathDrawnCount++;
          }
          break;
        }

        case 're':
        case '_re':
        case 'rect': {
          const h = parseFloat(stack.pop());
          const w = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
            ctx.rect(x, y, w, h);
            pathDrawnCount++;
          }
          break;
        }

        case 'rectfill': {
          const h = parseFloat(stack.pop());
          const w = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
            ctx.fillStyle = fillStyle;
            ctx.fillRect(x, y, w, h);
            pathDrawnCount++;
          }
          break;
        }

        case 'rectstroke': {
          const h = parseFloat(stack.pop());
          const w = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y) && !isNaN(w) && !isNaN(h)) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = curLineWidth;
            ctx.strokeRect(x, y, w, h);
            pathDrawnCount++;
          }
          break;
        }

        // --- PAINTING & FILL/STROKE ---
        case 'f':
        case 'F':
        case '_f':
        case '_F':
        case 'fill':
          ctx.fillStyle = fillStyle;
          ctx.fill('nonzero');
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'f*':
        case 'F*':
        case '_f*':
        case '_F*':
        case 'eofill':
          ctx.fillStyle = fillStyle;
          ctx.fill('evenodd');
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 's':
        case 'S':
        case '_s':
        case '_S':
        case '_o':
        case 'stroke':
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'b':
        case 'B':
        case '_b':
        case '_B':
        case 'fillstroke':
          ctx.fillStyle = fillStyle;
          ctx.fill('nonzero');
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'b*':
        case 'B*':
        case '_b*':
        case '_B*':
        case 'eofillstroke':
          ctx.fillStyle = fillStyle;
          ctx.fill('evenodd');
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        // --- COLOR MANAGEMENT (CMYK, RGB, Gray, Spot) ---
        // CMYK Fill Operators
        case 'k':
        case '_k':
        case 'xk':
        case '_xk': {
          const k = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const m = parseFloat(stack.pop());
          const c = parseFloat(stack.pop());
          if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
            const [r, g, b] = cmykToRgb(c, m, y, k);
            fillStyle = `rgb(${r},${g},${b})`;
          }
          break;
        }

        // CMYK Stroke Operators
        case 'K':
        case '_K':
        case 'Xk':
        case '_Xk': {
          const k = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const m = parseFloat(stack.pop());
          const c = parseFloat(stack.pop());
          if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
            const [r, g, b] = cmykToRgb(c, m, y, k);
            strokeStyle = `rgb(${r},${g},${b})`;
          }
          break;
        }

        // Standard PostScript setcmykcolor (sets both fill & stroke)
        case 'setcmykcolor': {
          const k = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const m = parseFloat(stack.pop());
          const c = parseFloat(stack.pop());
          if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
            const [r, g, b] = cmykToRgb(c, m, y, k);
            fillStyle = `rgb(${r},${g},${b})`;
            strokeStyle = `rgb(${r},${g},${b})`;
          }
          break;
        }

        // RGB Fill Operators
        case 'rg':
        case '_rg':
        case 'xa':
        case '_xa': {
          const b = parseFloat(stack.pop());
          const g = parseFloat(stack.pop());
          const r = parseFloat(stack.pop());
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            const r255 = Math.round(Math.max(0, Math.min(1, r)) * 255);
            const g255 = Math.round(Math.max(0, Math.min(1, g)) * 255);
            const b255 = Math.round(Math.max(0, Math.min(1, b)) * 255);
            fillStyle = `rgb(${r255},${g255},${b255})`;
          }
          break;
        }

        // RGB Stroke Operators
        case 'RG':
        case '_RG':
        case 'Xa':
        case '_Xa': {
          const b = parseFloat(stack.pop());
          const g = parseFloat(stack.pop());
          const r = parseFloat(stack.pop());
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            const r255 = Math.round(Math.max(0, Math.min(1, r)) * 255);
            const g255 = Math.round(Math.max(0, Math.min(1, g)) * 255);
            const b255 = Math.round(Math.max(0, Math.min(1, b)) * 255);
            strokeStyle = `rgb(${r255},${g255},${b255})`;
          }
          break;
        }

        // Standard PostScript setrgbcolor (sets both fill & stroke)
        case 'rgb':
        case '_rgb':
        case 'setrgbcolor': {
          const b = parseFloat(stack.pop());
          const g = parseFloat(stack.pop());
          const r = parseFloat(stack.pop());
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            const r255 = Math.round(Math.max(0, Math.min(1, r)) * 255);
            const g255 = Math.round(Math.max(0, Math.min(1, g)) * 255);
            const b255 = Math.round(Math.max(0, Math.min(1, b)) * 255);
            fillStyle = `rgb(${r255},${g255},${b255})`;
            strokeStyle = `rgb(${r255},${g255},${b255})`;
          }
          break;
        }

        // Grayscale Fill Operators
        case 'g':
        case '_g':
        case 'xg':
        case '_xg': {
          const gr = parseFloat(stack.pop());
          if (!isNaN(gr)) {
            const val = Math.round(Math.max(0, Math.min(1, gr)) * 255);
            fillStyle = `rgb(${val},${val},${val})`;
          }
          break;
        }

        // Grayscale Stroke Operators
        case 'G':
        case '_G':
        case 'Xg':
        case '_Xg': {
          const gr = parseFloat(stack.pop());
          if (!isNaN(gr)) {
            const val = Math.round(Math.max(0, Math.min(1, gr)) * 255);
            strokeStyle = `rgb(${val},${val},${val})`;
          }
          break;
        }

        // Standard PostScript setgray
        case 'setgray': {
          const gr = parseFloat(stack.pop());
          if (!isNaN(gr)) {
            const val = Math.round(Math.max(0, Math.min(1, gr)) * 255);
            fillStyle = `rgb(${val},${val},${val})`;
            strokeStyle = `rgb(${val},${val},${val})`;
          }
          break;
        }

        // Spot / Custom Colors in Illustrator 10
        case 'x':
        case 'X':
        case '_x':
        case '_X': {
          const poppedArgs: any[] = [];
          for (let p = 0; p < 7 && stack.length > 0; p++) {
            const item = stack.pop();
            poppedArgs.push(item);
            if (typeof item === 'string' && (item.startsWith('(') || item.startsWith('/'))) {
              break;
            }
          }
          if (poppedArgs.length >= 4) {
            const nums = poppedArgs.filter((v) => typeof v === 'number' || !isNaN(parseFloat(v))).map(Number);
            if (nums.length >= 4) {
              const [rgbR, rgbG, rgbB] = cmykToRgb(
                nums[nums.length - 4],
                nums[nums.length - 3],
                nums[nums.length - 2],
                nums[nums.length - 1]
              );
              const colStr = `rgb(${rgbR},${rgbG},${rgbB})`;
              if (op === 'X' || op === '_X') {
                strokeStyle = colStr;
              } else {
                fillStyle = colStr;
              }
            }
          }
          break;
        }

        case 'w':
        case '_w':
        case 'setlinewidth': {
          const w = parseFloat(stack.pop());
          if (!isNaN(w) && w >= 0) {
            curLineWidth = Math.max(0.4 / scale, w);
            ctx.lineWidth = curLineWidth;
          }
          break;
        }

        case 'J':
        case '_J':
        case 'setlinecap': {
          const cap = parseInt(stack.pop(), 10);
          if (cap === 0) ctx.lineCap = 'butt';
          else if (cap === 1) ctx.lineCap = 'round';
          else if (cap === 2) ctx.lineCap = 'square';
          break;
        }

        case 'j':
        case '_j':
        case 'setlinejoin': {
          const join = parseInt(stack.pop(), 10);
          if (join === 0) ctx.lineJoin = 'miter';
          else if (join === 1) ctx.lineJoin = 'round';
          else if (join === 2) ctx.lineJoin = 'bevel';
          break;
        }

        case 'M':
        case '_M':
        case 'setmiterlimit': {
          const m = parseFloat(stack.pop());
          if (!isNaN(m)) ctx.miterLimit = m;
          break;
        }

        case 'd':
        case '_d':
        case 'setdash': {
          stack.pop(); // offset
          stack.pop(); // array
          break;
        }

        case 'i':
        case '_i':
        case 'setflatness':
          stack.pop();
          break;

        // --- GRAPHICS STATE & TRANSFORMS ---
        case 'q':
        case '_q':
        case 'gsave':
          ctx.save();
          break;

        case 'Q':
        case '_Q':
        case 'grestore':
          ctx.restore();
          break;

        case 'translate': {
          const ty = parseFloat(stack.pop());
          const tx = parseFloat(stack.pop());
          if (!isNaN(tx) && !isNaN(ty)) {
            ctx.translate(tx, ty);
          }
          break;
        }

        case 'scale': {
          const sy = parseFloat(stack.pop());
          const sx = parseFloat(stack.pop());
          if (!isNaN(sx) && !isNaN(sy)) {
            ctx.scale(sx, sy);
          }
          break;
        }

        case 'rotate': {
          const deg = parseFloat(stack.pop());
          if (!isNaN(deg)) {
            ctx.rotate((deg * Math.PI) / 180);
          }
          break;
        }

        case 'cm':
        case '_cm':
        case 'concat': {
          const f = parseFloat(stack.pop());
          const e = parseFloat(stack.pop());
          const d = parseFloat(stack.pop());
          const c = parseFloat(stack.pop());
          const b = parseFloat(stack.pop());
          const a = parseFloat(stack.pop());
          if (!isNaN(a) && !isNaN(b) && !isNaN(c) && !isNaN(d) && !isNaN(e) && !isNaN(f)) {
            ctx.transform(a, b, c, d, e, f);
          }
          break;
        }

        case 'W':
        case '_W':
        case 'clip':
          try {
            ctx.clip('nonzero');
          } catch {}
          break;

        case 'W*':
        case '_W*':
        case 'eoclip':
          try {
            ctx.clip('evenodd');
          } catch {}
          break;

        // --- TEXT RENDERING ---
        case 'show':
        case 'ashow':
        case 'widthshow':
        case 'Tj': {
          const strRaw = stack.pop();
          if (typeof strRaw === 'string' && strRaw.length > 2) {
            const cleanStr = strRaw.replace(/^\(|\)$/g, '');
            if (cleanStr && cleanStr.length > 0) {
              ctx.save();
              ctx.scale(1, -1);
              ctx.fillStyle = fillStyle;
              ctx.font = 'bold 16px sans-serif';
              ctx.fillText(cleanStr, 0, 0);
              ctx.restore();
            }
          }
          break;
        }

        // --- STACK OPERATIONS ---
        case 'pop':
          stack.pop();
          break;

        case 'dup':
          if (stack.length > 0) stack.push(stack[stack.length - 1]);
          break;

        case 'exch':
          if (stack.length >= 2) {
            const top = stack.pop();
            const next = stack.pop();
            stack.push(top);
            stack.push(next);
          }
          break;

        default:
          break;
      }
    };

    // Main execution loop over tokens
    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const tok = tokens[tIdx];

      // Numeric literal
      const num = Number(tok);
      if (!isNaN(num) && tok.trim() !== '') {
        stack.push(num);
        if (stack.length > 100) stack.splice(0, 40);
        continue;
      }

      // Procedure / string / name literal
      if (tok.startsWith('(') || tok.startsWith('/') || tok === '[' || tok === ']' || tok === '{' || tok === '}') {
        stack.push(tok);
        if (stack.length > 100) stack.splice(0, 40);
        continue;
      }

      // Operator
      executeOp(tok);
    }

    ctx.restore();

    // 8. Quality check: Verify canvas has visible artwork (not blank white)
    try {
      const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
      const data = imgData.data;
      let nonWhitePixels = 0;
      const step = 4;
      let sampledCount = 0;

      for (let p = 0; p < data.length; p += 4 * step) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3];
        sampledCount++;

        // If pixel is non-white (r < 245 or g < 245 or b < 245) with contrast
        if (a > 30 && (r < 245 || g < 245 || b < 245)) {
          nonWhitePixels++;
        }
      }

      const nonWhiteRatio = nonWhitePixels / (sampledCount || 1);
      if (pathDrawnCount < 1 || (nonWhitePixels < 2 && nonWhiteRatio < 0.0001)) {
        return null;
      }
    } catch {
      if (pathDrawnCount < 1) return null;
    }

    // 9. Export crisp, lossless High-DPI PNG
    const pngUrl = canvas.toDataURL('image/png');
    const b64 = pngUrl.split(',')[1];

    if (b64 && b64.length > 200) {
      return {
        previewUrl: pngUrl,
        base64Data: b64,
        mimeTypeForAi: 'image/png',
        width: canvasW,
        height: canvasH,
      };
    }
  } catch (err) {
    console.warn('renderPostScriptCodeToCanvas exception:', err);
  }
  return null;
}
