/**
 * Vector Semantic Content & Metadata Extractor
 * 
 * Deeply parses EPS, AI, PostScript, and PDF files to extract authentic metadata:
 * - Document Titles (%%Title:, <dc:title>)
 * - Subjects & Descriptions (%%Subject:, <dc:description>, <photoshop:Headline>)
 * - Embedded Keywords (%%Keywords:, <dc:subject>, <pdf:Keywords>)
 * - Layer Names (%%BeginLayer:, %AI5_BeginLayer, /LayerName)
 * - Display Text Strings ((...) show, (...) Tj, [...] TJ)
 * - Color Palettes & Spot Colors (%%DocumentCustomColors:, %%DocumentProcessColors:)
 * - Creator Software (%%Creator:, <xmp:CreatorTool>)
 */

export interface VectorSemanticInfo {
  title?: string;
  subject?: string;
  description?: string;
  keywords: string[];
  layerNames: string[];
  textStrings: string[];
  colors: string[];
  creator?: string;
  cleanSubject: string;
  summaryText: string;
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
  
  // If the filename is just numbers like "003" or "019", keep it as "Vector Graphic 003" or "003"
  if (/^\d+$/.test(name)) {
    return `Vector Graphic ${name}`;
  }

  // Title-case
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
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

  if (!psText || psText.length === 0) {
    return {
      cleanSubject,
      keywords,
      layerNames,
      textStrings,
      colors,
      summaryText: `Subject: ${cleanSubject}`,
    };
  }

  // 1. PostScript DSC Comment Headers
  const titleMatch = psText.match(/%%Title:\s*([^\r\n]+)/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = titleMatch[1].trim();
    // Ignore generic titles like "Untitled-1" or "003.eps"
    if (!rawTitle.toLowerCase().includes('untitled') && !rawTitle.toLowerCase().endsWith('.eps') && rawTitle.length > 2) {
      title = rawTitle;
    }
  }

  const subjectMatch = psText.match(/%%Subject:\s*([^\r\n]+)/i);
  if (subjectMatch && subjectMatch[1]) {
    subject = subjectMatch[1].trim();
  }

  const creatorMatch = psText.match(/%%Creator:\s*([^\r\n]+)/i);
  if (creatorMatch && creatorMatch[1]) {
    creator = creatorMatch[1].trim();
  }

  const kwMatch = psText.match(/%%Keywords:\s*([^\r\n]+)/i);
  if (kwMatch && kwMatch[1]) {
    const rawKws = kwMatch[1].split(/[,;]/).map((k) => k.trim()).filter(Boolean);
    keywords.push(...rawKws);
  }

  // 2. XMP Dublin Core / Photoshop / PDF Metadata & PDF Info Dict
  const pdfTitleMatch = psText.match(/\/Title\s*\(([^)]+)\)/i);
  if (pdfTitleMatch && pdfTitleMatch[1] && !title) {
    const rawPdfTitle = pdfTitleMatch[1].trim();
    if (rawPdfTitle && !rawPdfTitle.toLowerCase().includes('untitled') && rawPdfTitle.length > 2) {
      title = rawPdfTitle;
    }
  }

  const pdfSubjectMatch = psText.match(/\/Subject\s*\(([^)]+)\)/i);
  if (pdfSubjectMatch && pdfSubjectMatch[1] && !subject) {
    subject = pdfSubjectMatch[1].trim();
  }

  const pdfKwDictMatch = psText.match(/\/Keywords\s*\(([^)]+)\)/i);
  if (pdfKwDictMatch && pdfKwDictMatch[1]) {
    const rawKws = pdfKwDictMatch[1].split(/[,;]/).map((k) => k.trim()).filter(Boolean);
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
    const lName = lm[1].replace(/[0-9\s_-]+$/, '').trim();
    if (lName && !layerNames.includes(lName) && !lName.toLowerCase().startsWith('layer')) {
      layerNames.push(lName);
    }
  }

  // 4. Text rendered in PostScript (( ... ) show or ( ... ) Tj)
  const textMatches = psText.matchAll(/\(([A-Za-z0-9\s.,!?:;@#$%^&*()_+=-]{2,60})\)\s*(?:show|ashow|widthshow|Tj|TJ)/g);
  for (const tm of textMatches) {
    const str = tm[1].trim();
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
      const cName = cm[1].trim();
      if (cName && !colors.includes(cName)) colors.push(cName);
    }
  }

  // 6. Build Comprehensive Summary String for AI
  const summaryParts: string[] = [];
  summaryParts.push(`Artwork File: ${filename}`);
  if (title) summaryParts.push(`Embedded Artwork Title: "${title}"`);
  if (subject) summaryParts.push(`Embedded Subject: "${subject}"`);
  if (description) summaryParts.push(`Embedded Description: "${description}"`);
  if (cleanSubject && (!title || cleanSubject.toLowerCase() !== title.toLowerCase())) {
    summaryParts.push(`Subject Name Context: "${cleanSubject}"`);
  }
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

  return {
    title,
    subject,
    description,
    keywords,
    layerNames,
    textStrings,
    colors,
    creator,
    cleanSubject,
    summaryText: summaryParts.join('\n'),
  };
}
