/**
 * Client-Side PostScript & EPS Vector Artwork Rasterizer
 * 
 * Specially optimized for Adobe Illustrator 10 / 8 / CS / CC EPS and PostScript files.
 * Capable of interpreting vector paths, CMYK/RGB/Spot colors, compound shapes, and text
 * directly in the browser with zero server dependencies.
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
 * Extracts BoundingBox or HiResBoundingBox from PostScript header comments
 */
export function extractBoundingBox(psText: string): BoundingBox | null {
  // Check %%HiResBoundingBox first, then %%BoundingBox, then %AI5_ArtBounds:
  const hiresMatch = psText.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  const bboxMatch = psText.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  const artBoundsMatch = psText.match(/%AI5_ArtBounds:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);

  const match = hiresMatch || bboxMatch || artBoundsMatch;
  if (!match) return null;

  const minX = parseFloat(match[1]);
  const minY = parseFloat(match[2]);
  const maxX = parseFloat(match[3]);
  const maxY = parseFloat(match[4]);

  const width = Math.abs(maxX - minX);
  const height = Math.abs(maxY - minY);

  if (width > 0 && height > 0 && !isNaN(width) && !isNaN(height) && width < 100000 && height < 100000) {
    return { minX: Math.min(minX, maxX), minY: Math.min(minY, maxY), maxX: Math.max(minX, maxX), maxY: Math.max(minY, maxY), width, height };
  }
  return null;
}

/**
 * Converts CMYK values (0..1) to RGB (0..255)
 */
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const clamp = (v: number) => Math.max(0, Math.min(1, isNaN(v) ? 0 : v));
  const cClean = clamp(c);
  const mClean = clamp(m);
  const yClean = clamp(y);
  const kClean = clamp(k);

  const r = Math.round(255 * (1 - cClean) * (1 - kClean));
  const g = Math.round(255 * (1 - mClean) * (1 - kClean));
  const b = Math.round(255 * (1 - yClean) * (1 - kClean));
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

/**
 * Fast PostScript Tokenizer that handles DSC comments, strings, hex literals, arrays, and procedures
 */
function tokenizePostScript(code: string, maxTokens = 120000): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len && tokens.length < maxTokens) {
    const ch = code[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i++;
      continue;
    }

    // Comment (% ... \n)
    if (ch === '%') {
      while (i < len && code[i] !== '\n' && code[i] !== '\r') {
        i++;
      }
      continue;
    }

    // String literal ( ... )
    if (ch === '(') {
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < len && depth > 0) {
        if (code[i] === '\\' && i + 1 < len) {
          i += 2;
          continue;
        }
        if (code[i] === '(') depth++;
        else if (code[i] === ')') depth--;
        i++;
      }
      tokens.push('(' + code.substring(start, i - 1) + ')');
      continue;
    }

    // Hex literal < ... >
    if (ch === '<') {
      const start = i;
      i++;
      while (i < len && code[i] !== '>') i++;
      if (i < len) i++;
      tokens.push(code.substring(start, i));
      continue;
    }

    // Brackets
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
      tokens.push(ch);
      i++;
      continue;
    }

    // Regular token / operator / number / name literal
    const start = i;
    while (i < len && !' \t\r\n\f%(){}[]<>'.includes(code[i])) {
      i++;
    }
    const tok = code.substring(start, i);
    if (tok) tokens.push(tok);
  }

  return tokens;
}

/**
 * Executes Illustrator 10 / PostScript vector commands on an HTML5 2D Canvas context
 */
export function renderPostScriptCodeToCanvas(
  psText: string,
  targetResolution = 1024
): RenderedVectorResult | null {
  try {
    if (!psText || psText.length < 20) return null;

    // 1. Get BoundingBox or auto-compute from coordinates
    let bbox = extractBoundingBox(psText);
    const tokens = tokenizePostScript(psText, 120000);

    if (tokens.length < 5) return null;

    // Scan for path extremes if bounding box is missing or invalid
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let idx = 0; idx < tokens.length; idx++) {
        const tok = tokens[idx];
        if (tok === 'moveto' || tok === 'm' || tok === '_m' || tok === 'lineto' || tok === 'l' || tok === '_l') {
          const x = parseFloat(tokens[idx - 2]);
          const y = parseFloat(tokens[idx - 1]);
          if (!isNaN(x) && !isNaN(y) && Math.abs(x) < 20000 && Math.abs(y) < 20000) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (minX !== Infinity && maxX > minX && maxY > minY) {
        bbox = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
      } else {
        // Standard default PostScript page dimensions (Square 800x800)
        bbox = { minX: 0, minY: 0, maxX: 800, maxY: 800, width: 800, height: 800 };
      }
    }

    // Compute target canvas aspect ratio with slight 2% margin
    const margin = 0.02;
    const srcW = Math.max(10, bbox.width);
    const srcH = Math.max(10, bbox.height);
    const scale = Math.min(targetResolution / Math.max(srcW, srcH), 3.0);
    const canvasW = Math.max(100, Math.min(2048, Math.round(srcW * scale)));
    const canvasH = Math.max(100, Math.min(2048, Math.round(srcH * scale)));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 2. Initialize pristine white canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Coordinate System Setup: PostScript origin is Bottom-Left; Canvas is Top-Left
    ctx.save();
    ctx.scale(scale * (1 - margin * 2), scale * (1 - margin * 2));
    ctx.translate(
      -bbox.minX + (srcW * margin) / (1 - margin * 2),
      bbox.minY + srcH - (srcH * margin) / (1 - margin * 2)
    );
    ctx.scale(1, -1); // Invert Y axis for PostScript

    // PostScript Execution State & Stack
    const stack: any[] = [];
    let curR = 0, curG = 0, curB = 0;
    let curLineWidth = 1;
    let pathDrawnCount = 0;
    let inCompoundPath = false;

    // Helper to evaluate an operator
    const executeOp = (rawOp: string) => {
      let op = rawOp.startsWith('/') ? rawOp.substring(1) : rawOp;

      // Handle Illustrator 10 compound path markers
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
          // v operator (first control point is current point)
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
          // y operator (last control point is current point)
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
            ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
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
            ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
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
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('nonzero');
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'f*':
        case 'F*':
        case '_f*':
        case '_F*':
        case 'eofill':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('evenodd');
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 's':
        case 'S':
        case '_s':
        case '_S':
        case '_o':
        case 'stroke':
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'b':
        case 'B':
        case '_b':
        case '_B':
        case 'fillstroke':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('nonzero');
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        case 'b*':
        case 'B*':
        case '_b*':
        case '_B*':
        case 'eofillstroke':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('evenodd');
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          if (!inCompoundPath) ctx.beginPath();
          break;

        // --- COLOR MANAGEMENT (CMYK, RGB, Gray, Spot) ---
        case 'k':
        case 'K':
        case '_k':
        case '_K':
        case 'xk':
        case 'Xk':
        case '_xk':
        case '_Xk':
        case 'setcmykcolor': {
          const k = parseFloat(stack.pop());
          const y = parseFloat(stack.pop());
          const m = parseFloat(stack.pop());
          const c = parseFloat(stack.pop());
          if (!isNaN(c) && !isNaN(m) && !isNaN(y) && !isNaN(k)) {
            const [rgbR, rgbG, rgbB] = cmykToRgb(c, m, y, k);
            curR = rgbR;
            curG = rgbG;
            curB = rgbB;
            ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
            ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          }
          break;
        }

        case 'rg':
        case 'RG':
        case '_rg':
        case '_RG':
        case 'xa':
        case 'Xa':
        case '_xa':
        case '_Xa':
        case 'rgb':
        case '_rgb':
        case 'setrgbcolor': {
          const b = parseFloat(stack.pop());
          const g = parseFloat(stack.pop());
          const r = parseFloat(stack.pop());
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            curR = Math.round(Math.max(0, Math.min(1, r)) * 255);
            curG = Math.round(Math.max(0, Math.min(1, g)) * 255);
            curB = Math.round(Math.max(0, Math.min(1, b)) * 255);
            ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
            ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          }
          break;
        }

        case 'g':
        case 'G':
        case '_g':
        case '_G':
        case 'xg':
        case 'Xg':
        case '_xg':
        case '_Xg':
        case 'setgray': {
          const g = parseFloat(stack.pop());
          if (!isNaN(g)) {
            const val = Math.round(Math.max(0, Math.min(1, g)) * 255);
            curR = val;
            curG = val;
            curB = val;
            ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
            ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          }
          break;
        }

        // Spot / Custom Colors in Illustrator 10: (Name) tint flag c m y k _x or (Name) tint _x
        case 'x':
        case 'X':
        case '_x':
        case '_X': {
          // Clear spot color arguments from stack safely
          const poppedArgs: any[] = [];
          for (let p = 0; p < 7 && stack.length > 0; p++) {
            const item = stack.pop();
            poppedArgs.push(item);
            if (typeof item === 'string' && (item.startsWith('(') || item.startsWith('/'))) {
              break;
            }
          }
          // If CMYK values were in the spot color definition, extract them
          if (poppedArgs.length >= 4) {
            const nums = poppedArgs.filter((v) => typeof v === 'number' || !isNaN(parseFloat(v))).map(Number);
            if (nums.length >= 4) {
              const [rgbR, rgbG, rgbB] = cmykToRgb(nums[nums.length - 4], nums[nums.length - 3], nums[nums.length - 2], nums[nums.length - 1]);
              curR = rgbR;
              curG = rgbG;
              curB = rgbB;
              ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
              ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
            }
          }
          break;
        }

        case 'w':
        case '_w':
        case 'setlinewidth': {
          const w = parseFloat(stack.pop());
          if (!isNaN(w) && w > 0) {
            curLineWidth = Math.max(0.5, w);
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
              ctx.scale(1, -1); // Un-invert for readable text
              ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
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

      // If numeric literal, push to stack
      const num = Number(tok);
      if (!isNaN(num) && tok.trim() !== '') {
        stack.push(num);
        if (stack.length > 80) stack.splice(0, 30); // Prevent stack overflow
        continue;
      }

      // If procedure bracket or string or name literal, push to stack
      if (tok.startsWith('(') || tok.startsWith('/') || tok === '[' || tok === ']' || tok === '{' || tok === '}') {
        stack.push(tok);
        if (stack.length > 80) stack.splice(0, 30);
        continue;
      }

      // Otherwise execute operator
      executeOp(tok);
    }

    ctx.restore();

    // Verify that the canvas actually has visible drawing/contrast and is NOT a solid white box
    try {
      const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
      const data = imgData.data;
      let nonWhitePixels = 0;
      const step = 4; // Sample every 4th pixel for high performance
      let sampledCount = 0;

      for (let p = 0; p < data.length; p += 4 * step) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3];
        sampledCount++;

        // If pixel is colored or has contrast from pure white (r < 240 or g < 240 or b < 240)
        if (a > 30 && (r < 240 || g < 240 || b < 240)) {
          nonWhitePixels++;
        }
      }

      const nonWhiteRatio = nonWhitePixels / (sampledCount || 1);
      // If less than 0.3% of sampled pixels contain artwork, reject as blank/failed render
      if (nonWhiteRatio < 0.003 || pathDrawnCount < 1) {
        return null;
      }
    } catch (pixelErr) {
      // If getImageData fails due to security/taint, proceed only if multiple paths drawn
      if (pathDrawnCount < 2) return null;
    }

    // Export high-quality JPEG
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = jpegUrl.split(',')[1];

    if (b64 && b64.length > 200) {
      return {
        previewUrl: jpegUrl,
        base64Data: b64,
        mimeTypeForAi: 'image/jpeg',
        width: canvasW,
        height: canvasH,
      };
    }
  } catch (err) {
    console.warn('renderPostScriptCodeToCanvas exception:', err);
  }
  return null;
}

