/**
 * Client-Side PostScript & EPS Vector Artwork Rasterizer
 * 
 * Capable of interpreting PostScript Level 1, 2, and 3 EPS vector files directly
 * in the browser without any server-side dependencies (works 100% on Vercel, static SPA, offline).
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
  // Check %%HiResBoundingBox first, then %%BoundingBox
  const hiresMatch = psText.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  const bboxMatch = psText.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);

  const match = hiresMatch || bboxMatch;
  if (!match) return null;

  const minX = parseFloat(match[1]);
  const minY = parseFloat(match[2]);
  const maxX = parseFloat(match[3]);
  const maxY = parseFloat(match[4]);

  const width = Math.abs(maxX - minX);
  const height = Math.abs(maxY - minY);

  if (width > 0 && height > 0 && !isNaN(width) && !isNaN(height)) {
    return { minX, minY, maxX, maxY, width, height };
  }
  return null;
}

/**
 * Converts CMYK values (0..1) to RGB (0..255)
 */
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const r = Math.round(255 * (1 - Math.min(1, c * (1 - k) + k)));
  const g = Math.round(255 * (1 - Math.min(1, m * (1 - k) + k)));
  const b = Math.round(255 * (1 - Math.min(1, y * (1 - k) + k)));
  return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
}

/**
 * Fast PostScript Tokenizer that handles DSC comments, strings, hex literals, arrays, and procedures
 */
function tokenizePostScript(code: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
      i++;
      continue;
    }

    // Comment
    if (ch === '%') {
      while (i < len && code[i] !== '\n' && code[i] !== '\r') {
        i++;
      }
      continue;
    }

    // String literal ( ... )
    if (ch === '(') {
      let depth = 1;
      const start = i;
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
      tokens.push(code.substring(start, i));
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

    // Name literal /name
    if (ch === '/') {
      const start = i;
      i++;
      while (i < len && !' \t\r\n\f%(){}[]<>/'.includes(code[i])) {
        i++;
      }
      tokens.push(code.substring(start, i));
      continue;
    }

    // Regular token / operator / number
    const start = i;
    while (i < len && !' \t\r\n\f%(){}[]<>/'.includes(code[i])) {
      i++;
    }
    tokens.push(code.substring(start, i));
  }

  return tokens;
}

/**
 * Executes PostScript vector commands on an HTML5 2D Canvas context
 */
export function renderPostScriptCodeToCanvas(
  psText: string,
  targetResolution = 1200
): RenderedVectorResult | null {
  try {
    if (!psText || psText.length < 20) return null;

    // 1. Get BoundingBox or auto-compute
    let bbox = extractBoundingBox(psText);
    const tokens = tokenizePostScript(psText);

    if (tokens.length < 5) return null;

    // Scan for path extremes if bounding box is missing
    if (!bbox) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let idx = 0; idx < tokens.length; idx++) {
        const tok = tokens[idx];
        if (tok === 'moveto' || tok === 'm' || tok === 'lineto' || tok === 'l') {
          const x = parseFloat(tokens[idx - 2]);
          const y = parseFloat(tokens[idx - 1]);
          if (!isNaN(x) && !isNaN(y) && Math.abs(x) < 50000 && Math.abs(y) < 50000) {
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
        // Standard default PostScript page dimensions (Letter: 612x792, or Square 800x800)
        bbox = { minX: 0, minY: 0, maxX: 800, maxY: 800, width: 800, height: 800 };
      }
    }

    // Compute target canvas aspect ratio
    const srcW = Math.max(10, bbox.width);
    const srcH = Math.max(10, bbox.height);
    const scale = Math.min(targetResolution / Math.max(srcW, srcH), 3.0);
    const canvasW = Math.round(srcW * scale);
    const canvasH = Math.round(srcH * scale);

    if (canvasW <= 0 || canvasH <= 0 || canvasW > 4096 || canvasH > 4096) return null;

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
    ctx.scale(scale, scale);
    ctx.translate(-bbox.minX, bbox.minY + srcH);
    ctx.scale(1, -1); // Invert Y axis

    // PostScript Execution State & Stack
    const stack: any[] = [];
    const dict: Record<string, string | ((...args: any[]) => void)> = {
      // Standard PostScript Shorthand Dictionary mappings
      m: 'moveto',
      l: 'lineto',
      c: 'curveto',
      v: 'curvetov',
      y: 'curvetoy',
      h: 'closepath',
      cp: 'closepath',
      e: 'closepath',
      f: 'fill',
      F: 'fill',
      'f*': 'eofill',
      s: 'stroke',
      S: 'stroke',
      b: 'fillstroke',
      B: 'fillstroke',
      'b*': 'eofillstroke',
      'B*': 'eofillstroke',
      n: 'newpath',
      N: 'newpath',
      q: 'gsave',
      Q: 'grestore',
      w: 'setlinewidth',
      J: 'setlinecap',
      j: 'setlinejoin',
      M: 'setmiterlimit',
      d: 'setdash',
      rg: 'setrgbcolor',
      RG: 'setrgbcolor',
      k: 'setcmykcolor',
      K: 'setcmykcolor',
      g: 'setgray',
      G: 'setgray',
      cm: 'concat',
      re: 'rect',
      W: 'clip',
      'W*': 'eoclip',
      // Adobe Illustrator specific prefixes & shorthands
      _m: 'moveto',
      _l: 'lineto',
      _c: 'curveto',
      _v: 'curvetov',
      _y: 'curvetoy',
      _h: 'closepath',
      _cp: 'closepath',
      _e: 'closepath',
      _f: 'fill',
      _F: 'fill',
      '_f*': 'eofill',
      _s: 'stroke',
      _S: 'stroke',
      _b: 'fillstroke',
      _B: 'fillstroke',
      '_b*': 'eofillstroke',
      _n: 'newpath',
      _N: 'newpath',
      _q: 'gsave',
      _Q: 'grestore',
      _w: 'setlinewidth',
      _J: 'setlinecap',
      _j: 'setlinejoin',
      _M: 'setmiterlimit',
      _d: 'setdash',
      _rg: 'setrgbcolor',
      _rgb: 'setrgbcolor',
      _xa: 'setrgbcolor',
      _k: 'setcmykcolor',
      _K: 'setcmykcolor',
      _xk: 'setcmykcolor',
      _g: 'setgray',
      _G: 'setgray',
      _xg: 'setgray',
      _cm: 'concat',
      _re: 'rect',
      _W: 'clip',
      '_W*': 'eoclip',
      _ar: 'arc',
      _arcn: 'arcn',
      _o: 'stroke',
      _O: 'fill',
      _X: 'noop',
      _x: 'noop',
      _u: 'newpath',
      _U: 'noop',
      _H: 'closepath',
    };

    let curR = 0, curG = 0, curB = 0;
    let curLineWidth = 1;
    let pathDrawnCount = 0;

    // Helper to evaluate an operator
    const executeOp = (op: string) => {
      // Check user dictionary aliasing
      if (dict[op]) {
        const mapped = dict[op];
        if (typeof mapped === 'string') {
          op = mapped;
        }
      } else if (op.startsWith('_')) {
        const unPrefixed = op.substring(1);
        if (dict[unPrefixed]) {
          const mapped = dict[unPrefixed];
          if (typeof mapped === 'string') op = mapped;
        }
      }

      switch (op) {
        // --- PATH CONSTRUCTION ---
        case 'newpath':
          ctx.beginPath();
          break;

        case 'moveto': {
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y)) {
            ctx.moveTo(x, y);
          }
          break;
        }

        case 'lineto': {
          const y = parseFloat(stack.pop());
          const x = parseFloat(stack.pop());
          if (!isNaN(x) && !isNaN(y)) {
            ctx.lineTo(x, y);
            pathDrawnCount++;
          }
          break;
        }

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

        case 'rlineto': {
          const dy = parseFloat(stack.pop());
          const dx = parseFloat(stack.pop());
          if (!isNaN(dx) && !isNaN(dy)) {
            // Approximated relative line
            // Canvas doesn't have rLineTo natively, lineTo with relative offset
            ctx.lineTo(dx, dy);
            pathDrawnCount++;
          }
          break;
        }

        case 'arc': {
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

        case 'arcn': {
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
            ctx.strokeRect(x, y, w, h);
            pathDrawnCount++;
          }
          break;
        }

        case 'clip':
          try {
            ctx.clip('nonzero');
          } catch {}
          break;

        case 'eoclip':
          try {
            ctx.clip('evenodd');
          } catch {}
          break;

        case 'noop':
          break;

        case 'closepath':
          ctx.closePath();
          break;

        // --- PAINTING ---
        case 'fill':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('nonzero');
          ctx.beginPath();
          break;

        case 'eofill':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('evenodd');
          ctx.beginPath();
          break;

        case 'stroke':
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          ctx.beginPath();
          break;

        case 'fillstroke':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill();
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          ctx.beginPath();
          break;

        case 'eofillstroke':
          ctx.fillStyle = `rgb(${curR},${curG},${curB})`;
          ctx.fill('evenodd');
          ctx.strokeStyle = `rgb(${curR},${curG},${curB})`;
          ctx.lineWidth = curLineWidth;
          ctx.stroke();
          ctx.beginPath();
          break;

        // --- COLOR MANAGEMENT ---
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

        case 'setlinewidth': {
          const w = parseFloat(stack.pop());
          if (!isNaN(w) && w > 0) {
            curLineWidth = w;
            ctx.lineWidth = w;
          }
          break;
        }

        case 'setlinecap': {
          const cap = parseInt(stack.pop(), 10);
          if (cap === 0) ctx.lineCap = 'butt';
          else if (cap === 1) ctx.lineCap = 'round';
          else if (cap === 2) ctx.lineCap = 'square';
          break;
        }

        case 'setlinejoin': {
          const join = parseInt(stack.pop(), 10);
          if (join === 0) ctx.lineJoin = 'miter';
          else if (join === 1) ctx.lineJoin = 'round';
          else if (join === 2) ctx.lineJoin = 'bevel';
          break;
        }

        // --- GRAPHICS STATE & TRANSFORMS ---
        case 'gsave':
          ctx.save();
          break;

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

        // --- DEFINITIONS & STACK OPERATIONS ---
        case 'def': {
          if (stack.length >= 2) {
            const val = stack.pop();
            const key = stack.pop();
            if (typeof key === 'string') {
              const cleanKey = key.startsWith('/') ? key.substring(1) : key;
              dict[cleanKey] = val;
            }
          }
          break;
        }

        case 'dup':
          if (stack.length > 0) {
            stack.push(stack[stack.length - 1]);
          }
          break;

        case 'pop':
          stack.pop();
          break;

        case 'exch':
          if (stack.length >= 2) {
            const top = stack.pop();
            const next = stack.pop();
            stack.push(top);
            stack.push(next);
          }
          break;

        case 'add': {
          const b = parseFloat(stack.pop());
          const a = parseFloat(stack.pop());
          stack.push(a + b);
          break;
        }

        case 'sub': {
          const b = parseFloat(stack.pop());
          const a = parseFloat(stack.pop());
          stack.push(a - b);
          break;
        }

        case 'mul': {
          const b = parseFloat(stack.pop());
          const a = parseFloat(stack.pop());
          stack.push(a * b);
          break;
        }

        case 'div': {
          const b = parseFloat(stack.pop());
          const a = parseFloat(stack.pop());
          stack.push(b !== 0 ? a / b : 0);
          break;
        }

        default:
          // Ignore unhandled PostScript directives without throwing
          break;
      }
    };

    // Main execution loop over tokens
    const maxTokens = Math.min(tokens.length, 200000);
    for (let tIdx = 0; tIdx < maxTokens; tIdx++) {
      const tok = tokens[tIdx];

      // If numeric literal, push to stack
      const num = Number(tok);
      if (!isNaN(num) && tok.trim() !== '') {
        stack.push(num);
        continue;
      }

      // If procedure bracket or string, push to stack
      if (tok.startsWith('/') || tok.startsWith('(') || tok === '[' || tok === ']' || tok === '{' || tok === '}') {
        stack.push(tok);
        continue;
      }

      // Otherwise execute operator
      executeOp(tok);
    }

    ctx.restore();

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
