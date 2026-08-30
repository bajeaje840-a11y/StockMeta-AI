import Papa from 'papaparse';
import JSZip from 'jszip';
import { ExportSettings, PlatformId, StockFile } from '../types';
import { mapToAdobeCategory, mapToShutterstockCategory, PLATFORM_CONFIGS } from '../data/platforms';

/**
 * Filter out blocklisted keywords
 */
export function filterKeywords(keywords: string[], blocklist: string[]): string[] {
  if (!blocklist || blocklist.length === 0) return keywords;
  const lowerBlocklist = new Set(blocklist.map((b) => b.toLowerCase().trim()));
  return keywords.filter((kw) => {
    const cleanKw = kw.toLowerCase().trim();
    return !lowerBlocklist.has(cleanKw);
  });
}

/**
 * Clean title for platforms that prohibit commas or special characters
 */
export function sanitizeTitle(title: string, removeCommas = false, maxLength?: number): string {
  let cleaned = title.trim();
  if (removeCommas) {
    cleaned = cleaned.replace(/,/g, ' ');
  }
  // Replace double spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim();
  }
  return cleaned;
}

/**
 * Ensure filename fits max length requirements
 */
export function sanitizeFilename(filename: string, maxLength?: number): string {
  if (!maxLength || filename.length <= maxLength) return filename;
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename.substring(0, maxLength);

  const ext = filename.substring(lastDot);
  const nameWithoutExt = filename.substring(0, lastDot);
  const allowedNameLength = maxLength - ext.length;

  if (allowedNameLength <= 0) return filename.substring(0, maxLength);
  return nameWithoutExt.substring(0, allowedNameLength) + ext;
}

/**
 * Converts a string into a URL/filename-friendly slug
 */
export function slugifyTitle(title: string, originalFilename: string): string {
  const ext = originalFilename.split('.').pop() || 'jpg';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  return `${slug}.${ext.toLowerCase()}`;
}

/**
 * Formats data for a single platform export
 */
export function formatFileForPlatform(
  file: StockFile,
  platformId: PlatformId,
  settings: ExportSettings
): Record<string, string> {
  const config = PLATFORM_CONFIGS[platformId];
  let fileKeywords = file.keywords || [];

  if (settings.applyBlocklist) {
    fileKeywords = filterKeywords(fileKeywords, settings.customBlocklist);
  }

  if (config.maxKeywords && fileKeywords.length > config.maxKeywords) {
    fileKeywords = fileKeywords.slice(0, config.maxKeywords);
  }

  const keywordsString = fileKeywords.join(', ');
  let filename = file.name;
  if (settings.autoRename && file.title) {
    filename = slugifyTitle(file.title, file.name);
  }

  switch (platformId) {
    case 'adobe_stock': {
      const adobeCat = file.adobeCategory || mapToAdobeCategory(file.category_guess, file.title + ' ' + file.keywords.join(' '));
      const cleanTitle = sanitizeTitle(file.title, true, 200); // Adobe prohibits commas and max 200 chars in contributor UI
      return {
        Filename: filename,
        Title: cleanTitle,
        Keywords: keywordsString,
        Category: adobeCat.toString(),
        Releases: file.releases || '',
      };
    }

    case 'shutterstock': {
      const { cat1, cat2 } = mapToShutterstockCategory(file.category_guess, file.title + ' ' + file.keywords.join(' '));
      const categories = [cat1, cat2].filter(Boolean).join(', ');
      return {
        Filename: filename,
        Description: file.description || file.title,
        Keywords: keywordsString,
        Categories: categories,
        Illustration: file.isIllustration || file.formatCategory === 'vector' ? 'Yes' : 'No',
        'Mature Content': file.isMature ? 'Yes' : 'No',
        Editorial: file.isEditorial ? 'Yes' : 'No',
      };
    }

    case 'freepik': {
      return {
        Filename: filename,
        Title: sanitizeTitle(file.title, false, 100),
        Keywords: keywordsString,
      };
    }

    case 'vecteezy': {
      return {
        Filename: filename,
        Title: file.title,
        Description: file.description || file.title,
        Keywords: keywordsString,
        License: file.formatCategory === 'vector' ? 'Pro' : 'Free',
      };
    }

    case 'pond5': {
      return {
        'Original Filename': filename,
        Title: file.title,
        Description: file.description || file.title,
        Keywords: keywordsString,
        Price: '',
      };
    }

    case 'dreamstime': {
      const { cat1, cat2 } = mapToShutterstockCategory(file.category_guess, file.title);
      return {
        Filename: filename,
        'Image Name': file.title,
        Description: file.description || file.title,
        'Category 1': cat1,
        'Category 2': cat2,
        Keywords: keywordsString,
      };
    }

    case 'depositphotos': {
      return {
        Filename: filename,
        Title: file.title,
        Description: file.description || file.title,
        Keywords: keywordsString,
      };
    }

    case '123rf': {
      return {
        Filename: filename,
        Title: file.title,
        Keywords: keywordsString,
        Description: file.description || file.title,
      };
    }

    case 'generic':
    default: {
      return {
        Filename: filename,
        Title: file.title,
        Description: file.description,
        Keywords: keywordsString,
        Category: file.category_guess || 'General',
      };
    }
  }
}

/**
 * Generate CSV string using PapaParse
 */
export function generateCSV(
  files: StockFile[],
  platformId: PlatformId,
  settings: ExportSettings
): string {
  const config = PLATFORM_CONFIGS[platformId];
  const validFiles = files.filter((f) => f.title || f.keywords.length > 0);

  const formattedRows = validFiles.map((file) =>
    formatFileForPlatform(file, platformId, settings)
  );

  return Papa.unparse({
    fields: config.headers,
    data: formattedRows,
  });
}

/**
 * Triggers instant browser download of CSV string
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Use UTF-8 BOM (\ufeff) to guarantee proper character encoding in Adobe Stock and Excel
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a ZIP containing CSVs for ALL stock marketplace platforms
 */
export async function downloadAllPlatformsZip(
  files: StockFile[],
  settings: ExportSettings
): Promise<void> {
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);

  const platformKeys = Object.keys(PLATFORM_CONFIGS) as PlatformId[];

  for (const platformId of platformKeys) {
    const config = PLATFORM_CONFIGS[platformId];
    const csvStr = generateCSV(files, platformId, settings);
    zip.file(`${config.name.toLowerCase().replace(/\s+/g, '_')}_metadata_${dateStr}.csv`, '\ufeff' + csvStr);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `stockmeta_all_platforms_${dateStr}.zip`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
