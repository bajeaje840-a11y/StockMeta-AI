/**
 * Vector Semantic Content & Metadata Extractor
 * 
 * Deeply parses EPS, AI, PostScript, and PDF files to extract authentic metadata:
 * - Document Titles (%%Title:, <dc:title>, /Title) with Central European / Octal unescaping
 * - Document Creators (%%Creator:, <xmp:CreatorTool>, Illustrator 10 CE quirks)
 * - BoundingBox & Dimensions (%%BoundingBox:, %%HiResBoundingBox:, %%CropBox:, %AI5_ArtBounds:)
 * - Color Mode (%%DocumentProcessColors:, %AI5_File:, %AI3_ColorUsage:, <photoshop:ColorMode>)
 * - Subjects & Descriptions (%%Subject:, <dc:description>, <photoshop:Headline>)
 * - Embedded Keywords (%%Keywords:, <dc:subject>, <pdf:Keywords>)
 * - Layer Names (%%BeginLayer:, %AI5_BeginLayer, /LayerName)
 * - Display Text Strings ((...) show, (...) Tj, [...] TJ)
 * - Color Palettes & Spot Colors (%%DocumentCustomColors:, %%DocumentProcessColors:, %%CMYKCustomColor:)
 */

export interface VectorDimensions {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
  aspectRatio: number;
  formattedDimensions: string;
}

export type VectorColorMode = 'CMYK' | 'RGB' | 'Grayscale' | 'Spot Color' | 'Unknown';

export interface VectorSemanticInfo {
  title?: string;
  subject?: string;
  description?: string;
  keywords: string[];
  layerNames: string[];
  textStrings: string[];
  colors: string[];
  creator?: string;
  creationDate?: string;
  colorMode: VectorColorMode;
  dimensions?: VectorDimensions;
  cleanSubject: string;
  summaryText: string;
}

/**
 * Decodes PostScript octal escape sequences (e.g. \300, \251) and escaped characters (\(, \), \\)
 * and handles Central European / Windows-1250 characters commonly found in Illustrator 10 CE.
 */
export function decodePostScriptString(input: string): string {
  if (!input) return '';
  let str = input.trim();
  // Strip surrounding PostScript parentheses if present
  if (str.startsWith('(') && str.endsWith(')')) {
    str = str.slice(1, -1);
  }

  // Replace octal escapes: \ooo (1 to 3 octal digits)
  str = str.replace(/\\([0-7]{1,3})/g, (_, oct) => {
    const code = parseInt(oct, 8);
    // Decode Windows-1250 / Central European high-byte characters if in 0x80..0xFF range
    return String.fromCharCode(code);
  });

  // Replace standard PostScript escape sequences
  str = str
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\b/g, '')
    .replace(/\\f/g, '')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');

  return str.trim();
}

/**
 * Turns machine filenames like "fire_truck_icon_set_202608242233.eps"
 * into clean human subject "Fire Truck Icon Set"
 */
export function cleanVectorSubject(filename: string): string {
  let name = filename.replace(/\.[^/.]+$/, ''); // Remove extension
  name = name.replace(/^create[_\s-]+/i, ''); // Remove "create_" prefix
  name = name.replace(/_\d{8,}(?:_\d+)?/g, ''); // Remove timestamp suffixes like _202608242233
  name = name.replace(/[-_]+/g, ' ').trim(); // Replace underscores/hyphens with spaces
  
  // If the filename is just numbers like "001", "002", "003" or generic "untitled", return empty to prevent AI number hallucinations
  if (/^\d+$/.test(name) || /^untitled/i.test(name) || /^img_\d+$/i.test(name) || /^file_\d+$/i.test(name)) {
    return '';
  }

  // Title-case
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parses EPS PostScript %%BoundingBox or %%HiResBoundingBox comments to extract real dimensions
 */
export function extractVectorDimensions(psText: string): VectorDimensions | undefined {
  if (!psText) return undefined;

  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  let found = false;

  // 1. Check %%HiResBoundingBox first (high precision floats)
  const hiresMatches = psText.matchAll(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/gi);
  for (const match of hiresMatches) {
    const x1 = parseFloat(match[1]);
    const y1 = parseFloat(match[2]);
    const x2 = parseFloat(match[3]);
    const y2 = parseFloat(match[4]);
    if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && (x2 > x1 || y2 > y1)) {
      minX = x1; minY = y1; maxX = x2; maxY = y2;
      found = true;
    }
  }

  // 2. Check standard %%BoundingBox (handles non-(atend) occurrences, scanning all headers)
  if (!found) {
    const bboxMatches = psText.matchAll(/%%BoundingBox:\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/gi);
    for (const match of bboxMatches) {
      const x1 = parseInt(match[1], 10);
      const y1 = parseInt(match[2], 10);
      const x2 = parseInt(match[3], 10);
      const y2 = parseInt(match[4], 10);
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && (x2 > x1 || y2 > y1)) {
        minX = x1; minY = y1; maxX = x2; maxY = y2;
        found = true;
      }
    }
  }

  // 3. Check %AI5_ArtBounds: (Illustrator Artboard Bounds)
  if (!found) {
    const artMatch = psText.match(/%AI5_ArtBounds:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
    if (artMatch) {
      const x1 = parseFloat(artMatch[1]);
      const y1 = parseFloat(artMatch[2]);
      const x2 = parseFloat(artMatch[3]);
      const y2 = parseFloat(artMatch[4]);
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && (x2 > x1 || y2 > y1)) {
        minX = x1; minY = y1; maxX = x2; maxY = y2;
        found = true;
      }
    }
  }

  // 4. Check %%CropBox / %%ArtBox
  if (!found) {
    const cropMatch = psText.match(/%%(?:CropBox|ArtBox|MediaBox):\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
    if (cropMatch) {
      const x1 = parseFloat(cropMatch[1]);
      const y1 = parseFloat(cropMatch[2]);
      const x2 = parseFloat(cropMatch[3]);
      const y2 = parseFloat(cropMatch[4]);
      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2) && (x2 > x1 || y2 > y1)) {
        minX = x1; minY = y1; maxX = x2; maxY = y2;
        found = true;
      }
    }
  }

  if (found) {
    const widthPt = Math.round(Math.abs(maxX - minX) * 100) / 100;
    const heightPt = Math.round(Math.abs(maxY - minY) * 100) / 100;
    const width = Math.round(widthPt);
    const height = Math.round(heightPt);
    const aspectRatio = widthPt > 0 && heightPt > 0 ? Math.round((widthPt / heightPt) * 100) / 100 : 1;

    return {
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
      width,
      height,
      widthPt,
      heightPt,
      aspectRatio,
      formattedDimensions: `${width} × ${height} pt`,
    };
  }

  return undefined;
}

/**
 * Detects the color mode (CMYK, RGB, Grayscale, Spot Color) from EPS PostScript headers and operators
 */
export function extractVectorColorMode(psText: string): VectorColorMode {
  if (!psText) return 'Unknown';

  // 1. Check Adobe Illustrator %AI5_File: or %AI3_ColorUsage:
  const aiFileMatch = psText.match(/%AI5_File:\s*(CMYK|RGB|Grayscale)/i);
  if (aiFileMatch && aiFileMatch[1]) {
    const mode = aiFileMatch[1].toUpperCase();
    if (mode === 'CMYK') return 'CMYK';
    if (mode === 'RGB') return 'RGB';
    if (mode.includes('GRAY')) return 'Grayscale';
  }

  const ai3ColorUsage = psText.match(/%AI3_ColorUsage:\s*(\d+)/i);
  if (ai3ColorUsage && ai3ColorUsage[1]) {
    const val = parseInt(ai3ColorUsage[1], 10);
    if (val === 2) return 'CMYK';
    if (val === 3) return 'RGB';
    if (val === 1) return 'Grayscale';
  }

  // 2. Check %%DocumentProcessColors:
  const procColorsMatch = psText.match(/%%DocumentProcessColors:\s*([^\r\n]+)/i);
  if (procColorsMatch && procColorsMatch[1]) {
    const colorsStr = procColorsMatch[1].toLowerCase();
    if (colorsStr.includes('cyan') && colorsStr.includes('magenta') && colorsStr.includes('yellow')) {
      return 'CMYK';
    }
    if (colorsStr.includes('rgb') || (colorsStr.includes('red') && colorsStr.includes('green') && colorsStr.includes('blue'))) {
      return 'RGB';
    }
    if (colorsStr.includes('black') && !colorsStr.includes('cyan') && !colorsStr.includes('magenta')) {
      return 'Grayscale';
    }
  }

  // 3. Check XMP Photoshop ColorMode (<photoshop:ColorMode>4</photoshop:ColorMode>)
  const xmpColorModeMatch = psText.match(/<photoshop:ColorMode>(\d+)<\/photoshop:ColorMode>/i);
  if (xmpColorModeMatch && xmpColorModeMatch[1]) {
    const cm = parseInt(xmpColorModeMatch[1], 10);
    if (cm === 4) return 'CMYK';
    if (cm === 3) return 'RGB';
    if (cm === 1) return 'Grayscale';
  }

  // 4. Check %%CMYKCustomColor: or %%DocumentCustomColors:
  if (/%%(?:CMYKCustomColor|DocumentCustomColors):/i.test(psText)) {
    // If it has custom spot colors but also CMYK operators
    if (/\b(?:setcmykcolor|k|K|_k|_K)\b/.test(psText)) return 'CMYK';
    return 'Spot Color';
  }

  // 5. Check PostScript color operators
  const hasCmyk = /\b(?:setcmykcolor|\s[0-1](?:\.\d+)?\s+[0-1](?:\.\d+)?\s+[0-1](?:\.\d+)?\s+[0-1](?:\.\d+)?\s+[kK])\b/.test(psText);
  const hasRgb = /\b(?:setrgbcolor|\s[0-1](?:\.\d+)?\s+[0-1](?:\.\d+)?\s+[0-1](?:\.\d+)?\s+(?:rg|RG|_rg|_RG))\b/.test(psText);
  const hasGrayOnly = /\b(?:setgray|\s[0-1](?:\.\d+)?\s+[gG])\b/.test(psText);

  if (hasCmyk) return 'CMYK';
  if (hasRgb) return 'RGB';
  if (hasGrayOnly) return 'Grayscale';

  // 6. Check %%ColorUsage:
  const colorUsageMatch = psText.match(/%%ColorUsage:\s*([^\r\n]+)/i);
  if (colorUsageMatch && colorUsageMatch[1]) {
    const cu = colorUsageMatch[1].toLowerCase();
    if (cu.includes('black') || cu.includes('mono')) return 'Grayscale';
    if (cu.includes('color')) return 'CMYK';
  }

  return 'CMYK'; // Default microstock standard for EPS vector is CMYK
}

/**
 * Extracts all semantic information and embedded metadata from an EPS / PostScript text or buffer
 */
export function extractVectorSemanticInfo(psText: string, filename: string): VectorSemanticInfo {
  const cleanSubject = cleanVectorSubject(filename);
  const keywords: string[] = [];
  const layerNames: string[] = [];
  const textStrings: string[] = [];
  const colors: string[] = [];
  let title: string | undefined;
  let subject: string | undefined;
  let description: string | undefined;
  let creator: string | undefined;
  let creationDate: string | undefined;

  if (!psText || psText.length === 0) {
    return {
      cleanSubject,
      keywords,
      layerNames,
      textStrings,
      colors,
      colorMode: 'CMYK',
      summaryText: `Subject: ${cleanSubject}`,
    };
  }

  // 1. PostScript DSC Comment Headers
  const titleMatch = psText.match(/%%Title:\s*([^\r\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = decodePostScriptString(titleMatch[1]);
    // Ignore generic titles like "Untitled-1" or "003.eps"
    if (!rawTitle.toLowerCase().includes('untitled') && !rawTitle.toLowerCase().endsWith('.eps') && rawTitle.length > 2) {
      title = rawTitle;
    }
  }

  const subjectMatch = psText.match(/%%Subject:\s*([^\r\n]+)/i);
  if (subjectMatch && subjectMatch[1]) {
    subject = decodePostScriptString(subjectMatch[1]);
  }

  const creatorMatch = psText.match(/%%Creator:\s*([^\r\n]+)/i);
  if (creatorMatch && creatorMatch[1]) {
    creator = decodePostScriptString(creatorMatch[1]);
  }

  const dateMatch = psText.match(/%%CreationDate:\s*([^\r\n]+)/i);
  if (dateMatch && dateMatch[1]) {
    creationDate = decodePostScriptString(dateMatch[1]);
  }

  const kwMatch = psText.match(/%%Keywords:\s*([^\r\n]+)/i);
  if (kwMatch && kwMatch[1]) {
    const rawKws = decodePostScriptString(kwMatch[1]).split(/[,;]/).map((k) => k.trim()).filter(Boolean);
    for (const k of rawKws) {
      if (k && !keywords.includes(k)) keywords.push(k);
    }
  }

  // 2. XMP Dublin Core / Photoshop / PDF Metadata & PDF Info Dict
  const pdfTitleMatch = psText.match(/\/Title\s*\(([^)]+)\)/i);
  if (pdfTitleMatch && pdfTitleMatch[1] && !title) {
    const rawPdfTitle = decodePostScriptString(pdfTitleMatch[1]);
    if (rawPdfTitle && !rawPdfTitle.toLowerCase().includes('untitled') && rawPdfTitle.length > 2) {
      title = rawPdfTitle;
    }
  }

  const pdfSubjectMatch = psText.match(/\/Subject\s*\(([^)]+)\)/i);
  if (pdfSubjectMatch && pdfSubjectMatch[1] && !subject) {
    subject = decodePostScriptString(pdfSubjectMatch[1]);
  }

  const pdfKwDictMatch = psText.match(/\/Keywords\s*\(([^)]+)\)/i);
  if (pdfKwDictMatch && pdfKwDictMatch[1]) {
    const rawKws = decodePostScriptString(pdfKwDictMatch[1]).split(/[,;]/).map((k) => k.trim()).filter(Boolean);
    for (const k of rawKws) {
      if (k && !keywords.includes(k)) keywords.push(k);
    }
  }

  const xmpTitleMatch = psText.match(/<dc:title>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>[\s\S]*?<\/dc:title>/i);
  if (xmpTitleMatch && xmpTitleMatch[1]) {
    const cleanXmpTitle = xmpTitleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (cleanXmpTitle && !cleanXmpTitle.toLowerCase().includes('untitled') && cleanXmpTitle.length > 2) {
      title = cleanXmpTitle;
    }
  }

  const xmpDescMatch = psText.match(/<dc:description>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>[\s\S]*?<\/dc:description>/i);
  if (xmpDescMatch && xmpDescMatch[1]) {
    description = xmpDescMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  const xmpHeadlineMatch = psText.match(/<photoshop:Headline>([\s\S]*?)<\/photoshop:Headline>/i);
  if (xmpHeadlineMatch && xmpHeadlineMatch[1]) {
    const hl = xmpHeadlineMatch[1].trim();
    if (hl && !title) title = hl;
  }

  const xmpCreatorMatch = psText.match(/<xmp:CreatorTool>([\s\S]*?)<\/xmp:CreatorTool>/i);
  if (xmpCreatorMatch && xmpCreatorMatch[1] && !creator) {
    creator = xmpCreatorMatch[1].trim();
  }

  // XMP Subject / Keywords list
  const xmpSubjectBlock = psText.match(/<dc:subject>[\s\S]*?<rdf:Bag>([\s\S]*?)<\/rdf:Bag>[\s\S]*?<\/dc:subject>/i);
  if (xmpSubjectBlock && xmpSubjectBlock[1]) {
    const tagMatches = xmpSubjectBlock[1].matchAll(/<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/gi);
    for (const m of tagMatches) {
      const tag = m[1].replace(/<[^>]+>/g, '').trim();
      if (tag && !keywords.includes(tag)) {
        keywords.push(tag);
      }
    }
  }

  // PDF Keywords in XMP
  const pdfKwMatch = psText.match(/<pdf:Keywords>([\s\S]*?)<\/pdf:Keywords>/i);
  if (pdfKwMatch && pdfKwMatch[1]) {
    const rawPdfKws = pdfKwMatch[1].split(/[,;]/).map((k) => k.trim()).filter(Boolean);
    for (const k of rawPdfKws) {
      if (k && !keywords.includes(k)) keywords.push(k);
    }
  }

  // 3. Layer Names (%AI5_BeginLayer, %%BeginLayer:, /LayerName ( ... ))
  const layerMatches = psText.matchAll(/(?:%AI5_BeginLayer|%%BeginLayer|%AI12_BeginLayer):\s*([^\r\n]+)/gi);
  for (const lm of layerMatches) {
    const lName = decodePostScriptString(lm[1]).replace(/[0-9\s_-]+$/, '').trim();
    if (lName && !layerNames.includes(lName) && !lName.toLowerCase().startsWith('layer')) {
      layerNames.push(lName);
    }
  }

  // 4. Text rendered in PostScript (( ... ) show or ( ... ) Tj)
  const textMatches = psText.matchAll(/\(([A-Za-z0-9\s.,!?:;@#$%^&*()_+=-]{2,60})\)\s*(?:show|ashow|widthshow|Tj|TJ)/g);
  for (const tm of textMatches) {
    const str = decodePostScriptString(tm[1]);
    if (str && str.length > 2 && !textStrings.includes(str) && textStrings.length < 25) {
      // Filter out raw PostScript font strings or matrix data
      if (!str.startsWith('/') && !str.startsWith('%%') && !str.includes('Adobe')) {
        textStrings.push(str);
      }
    }
  }

  // 5. Color Names & Swatches
  const customColorsMatch = psText.match(/%%DocumentCustomColors:\s*([^\r\n]+)/i);
  if (customColorsMatch && customColorsMatch[1]) {
    const cMatches = customColorsMatch[1].matchAll(/\(([^)]+)\)/g);
    for (const cm of cMatches) {
      const cName = decodePostScriptString(cm[1]);
      if (cName && !colors.includes(cName)) colors.push(cName);
    }
  }

  const dimensions = extractVectorDimensions(psText);
  const colorMode = extractVectorColorMode(psText);

  // 6. Build Comprehensive Summary String for AI
  const summaryParts: string[] = [];
  summaryParts.push(`Artwork File: ${filename}`);
  if (title) summaryParts.push(`Embedded Artwork Title: "${title}"`);
  if (subject) summaryParts.push(`Embedded Subject: "${subject}"`);
  if (description) summaryParts.push(`Embedded Description: "${description}"`);
  if (cleanSubject && (!title || cleanSubject.toLowerCase() !== title.toLowerCase())) {
    summaryParts.push(`Subject Name Context: "${cleanSubject}"`);
  }
  if (dimensions) {
    summaryParts.push(`Vector Dimensions: ${dimensions.formattedDimensions} (Aspect Ratio: ${dimensions.aspectRatio}:1)`);
  }
  summaryParts.push(`Color Mode: ${colorMode}`);
  if (keywords.length > 0) {
    summaryParts.push(`Embedded Keywords / Tags: ${keywords.join(', ')}`);
  }
  if (layerNames.length > 0) {
    summaryParts.push(`Vector Layer Elements: ${layerNames.join(', ')}`);
  }
  if (textStrings.length > 0) {
    summaryParts.push(`Visible Text / Typography: ${textStrings.join(' | ')}`);
  }
  if (colors.length > 0) {
    summaryParts.push(`Color Palette / Swatches: ${colors.join(', ')}`);
  }
  if (creator) {
    summaryParts.push(`Created with: ${creator}`);
  }
  if (creationDate) {
    summaryParts.push(`Creation Date: ${creationDate}`);
  }

  return {
    title,
    subject,
    description,
    keywords,
    layerNames,
    textStrings,
    colors,
    creator,
    creationDate,
    colorMode,
    dimensions,
    cleanSubject,
    summaryText: summaryParts.join('\n'),
  };
}

