export type FileStatus = 'queued' | 'processing' | 'success' | 'failed' | 'cancelled';

export interface StockFile {
  id: string;
  file?: File;
  name: string;
  originalName: string;
  size: number;
  type: string; // e.g. "image/jpeg", "image/png", "application/pdf", "video/mp4", etc.
  formatCategory: 'image' | 'vector' | 'video' | 'pdf' | 'other';
  previewUrl: string;
  base64Data?: string; // For sending to Gemini
  mimeTypeForAi: string; // e.g. "image/jpeg" or "image/png"
  status: FileStatus;
  title: string;
  description: string;
  keywords: string[];
  category_guess: string;
  adobeCategory: number; // Adobe numeric category ID
  shutterstockCategory1: string;
  shutterstockCategory2: string;
  isIllustration: boolean;
  isEditorial: boolean;
  isMature: boolean;
  releases: string;
  errorMessage?: string;
  progress?: number;
  addedAt: number;
}

export type PlatformId =
  | 'adobe_stock'
  | 'shutterstock'
  | 'freepik'
  | 'vecteezy'
  | 'pond5'
  | 'dreamstime'
  | 'depositphotos'
  | '123rf'
  | 'generic';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  badgeColor: string;
  filenameMaxLength?: number;
  titleMaxLength?: number;
  descriptionMaxLength?: number;
  maxKeywords?: number;
  headers: string[];
  rulesSummary: string;
  description: string;
}

export interface ExportSettings {
  selectedPlatform: PlatformId;
  autoRename: boolean;
  applyBlocklist: boolean;
  customBlocklist: string[];
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  success: number;
  failed: number;
  cancelled: number;
}
