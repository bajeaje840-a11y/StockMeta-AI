import { PlatformConfig, PlatformId } from '../types';

export const PLATFORM_CONFIGS: Record<PlatformId, PlatformConfig> = {
  adobe_stock: {
    id: 'adobe_stock',
    name: 'Adobe Stock',
    badgeColor: 'bg-red-500/10 text-red-500 border-red-500/30',
    filenameMaxLength: 30,
    titleMaxLength: 70,
    maxKeywords: 50,
    headers: ['Filename', 'Title', 'Keywords', 'Category', 'Releases'],
    rulesSummary: 'Filename ≤30 chars (incl. ext). Title ≤70 chars (no commas). Keywords comma-separated (max 50, ordered by relevance). Category = Numeric ID (1-21).',
    description: 'Formatted specifically for Adobe Stock contributor portal CSV batch upload.',
  },
  shutterstock: {
    id: 'shutterstock',
    name: 'Shutterstock',
    badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    descriptionMaxLength: 2048,
    maxKeywords: 50,
    headers: ['Filename', 'Description', 'Keywords', 'Categories', 'Illustration', 'Mature Content', 'Editorial'],
    rulesSummary: 'Description up to 2048 chars. Keywords comma-separated. Categories = 1-2 values from fixed Shutterstock list. Flags: Yes/No.',
    description: 'Matches Shutterstock contributor metadata CSV template specification.',
  },
  freepik: {
    id: 'freepik',
    name: 'Freepik',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    titleMaxLength: 100,
    maxKeywords: 50,
    headers: ['Filename', 'Title', 'Keywords'],
    rulesSummary: 'Title max 100 chars. Keywords comma-separated (min 5, max 50).',
    description: 'Standard Freepik contributor metadata CSV export format.',
  },
  vecteezy: {
    id: 'vecteezy',
    name: 'Vecteezy',
    badgeColor: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    headers: ['Filename', 'Title', 'Description', 'Keywords', 'License'],
    rulesSummary: 'Filename, Title, Description, Keywords (comma-separated), License (Free or Pro).',
    description: 'Vecteezy vector and photo contributor batch CSV file layout.',
  },
  pond5: {
    id: 'pond5',
    name: 'Pond5',
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
    headers: ['Original Filename', 'Title', 'Description', 'Keywords', 'Price'],
    rulesSummary: 'Original Filename, Title, Description, Keywords (comma-separated).',
    description: 'Pond5 stock media contributor metadata CSV structure.',
  },
  dreamstime: {
    id: 'dreamstime',
    name: 'Dreamstime',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    headers: ['Filename', 'Image Name', 'Description', 'Category 1', 'Category 2', 'Keywords'],
    rulesSummary: 'Filename, Image Name (Title), Description, Category 1 & 2, Keywords.',
    description: 'Dreamstime stock photography CSV batch import configuration.',
  },
  depositphotos: {
    id: 'depositphotos',
    name: 'Depositphotos',
    badgeColor: 'bg-teal-500/10 text-teal-500 border-teal-500/30',
    headers: ['Filename', 'Title', 'Description', 'Keywords'],
    rulesSummary: 'Filename, Title, Description, Keywords (comma-separated).',
    description: 'Depositphotos contributor portal CSV batch file format.',
  },
  '123rf': {
    id: '123rf',
    name: '123RF',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    headers: ['Filename', 'Title', 'Keywords', 'Description'],
    rulesSummary: 'Filename, Title, Keywords (comma-separated), Description.',
    description: '123RF contributor batch upload CSV layout.',
  },
  generic: {
    id: 'generic',
    name: 'Generic / Fallback',
    badgeColor: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    headers: ['Filename', 'Title', 'Description', 'Keywords', 'Category'],
    rulesSummary: 'Universal standard CSV containing Filename, Title, Description, Keywords, Category.',
    description: 'Safe universal CSV fallback compatible with any stock marketplace.',
  },
};

// Official Adobe Stock Numeric Categories (1 to 21)
export const ADOBE_STOCK_CATEGORIES: { id: number; name: string }[] = [
  { id: 1, name: 'Animals' },
  { id: 2, name: 'Buildings and Architecture' },
  { id: 3, name: 'Business' },
  { id: 4, name: 'Drinks' },
  { id: 5, name: 'Environment' },
  { id: 6, name: 'States of Mind' },
  { id: 7, name: 'Food' },
  { id: 8, name: 'Graphic Resources' },
  { id: 9, name: 'Hobbies and Leisure' },
  { id: 10, name: 'Industry' },
  { id: 11, name: 'Landscapes' },
  { id: 12, name: 'Lifestyle' },
  { id: 13, name: 'People' },
  { id: 14, name: 'Plants and Flowers' },
  { id: 15, name: 'Culture and Religion' },
  { id: 16, name: 'Science' },
  { id: 17, name: 'Social Issues' },
  { id: 18, name: 'Sports' },
  { id: 19, name: 'Technology' },
  { id: 20, name: 'Transport' },
  { id: 21, name: 'Travel' },
];

// Official Shutterstock Categories
export const SHUTTERSTOCK_CATEGORIES: string[] = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vectors',
  'Vintage',
];

// Default Trademark / Brand Keyword Blocklist
export const DEFAULT_TRADEMARK_BLOCKLIST: string[] = [
  'apple',
  'iphone',
  'ipad',
  'macbook',
  'imac',
  'nike',
  'adidas',
  'gopro',
  'samsung',
  'disney',
  'marvel',
  'pixar',
  'tesla',
  'adobe',
  'shutterstock',
  'freepik',
  'playstation',
  'xbox',
  'nintendo',
  'instagram',
  'tiktok',
  'facebook',
  'twitter',
  'meta',
  'youtube',
  'gucci',
  'coca cola',
  'pepsi',
  'red bull',
  'bmw',
  'mercedes',
  'audi',
  'toyota',
  'honda',
  'ford',
  'chevrolet',
  'porsche',
  'ferrari',
  'lamborghini',
  'rolex',
  'louis vuitton',
  'chanel',
  'prada',
  'starbucks',
  'mcdonalds',
  'burger king',
  'subway',
  'amazon',
  'google',
  'microsoft',
  'netflix',
  'spotify',
  'canon',
  'nikon',
  'sony',
];

/**
  * Helper to guess Adobe Stock Numeric Category from string category
  */
export function mapToAdobeCategory(categoryGuess: string, titleAndKeywords: string): number {
  const text = (categoryGuess + ' ' + titleAndKeywords).toLowerCase();

  if (text.includes('animal') || text.includes('dog') || text.includes('cat') || text.includes('bird') || text.includes('pet') || text.includes('wildlife')) return 1;
  if (text.includes('building') || text.includes('architecture') || text.includes('city') || text.includes('house') || text.includes('urban') || text.includes('construction')) return 2;
  if (text.includes('business') || text.includes('finance') || text.includes('office') || text.includes('money') || text.includes('corporate') || text.includes('meeting')) return 3;
  if (text.includes('drink') || text.includes('beverage') || text.includes('coffee') || text.includes('tea') || text.includes('wine') || text.includes('beer') || text.includes('cocktail')) return 4;
  if (text.includes('environment') || text.includes('recycle') || text.includes('green energy') || text.includes('climate') || text.includes('ecology')) return 5;
  if (text.includes('state of mind') || text.includes('emotion') || text.includes('happy') || text.includes('sad') || text.includes('meditation') || text.includes('thought')) return 6;
  if (text.includes('food') || text.includes('meal') || text.includes('cooking') || text.includes('dish') || text.includes('fruit') || text.includes('vegetable') || text.includes('kitchen')) return 7;
  if (text.includes('graphic') || text.includes('vector') || text.includes('pattern') || text.includes('illustration') || text.includes('banner') || text.includes('background') || text.includes('icon')) return 8;
  if (text.includes('hobby') || text.includes('leisure') || text.includes('craft') || text.includes('reading') || text.includes('gaming') || text.includes('music')) return 9;
  if (text.includes('industry') || text.includes('factory') || text.includes('engineer') || text.includes('warehouse') || text.includes('machinery')) return 10;
  if (text.includes('landscape') || text.includes('mountain') || text.includes('forest') || text.includes('sunset') || text.includes('sky') || text.includes('ocean') || text.includes('beach')) return 11;
  if (text.includes('lifestyle') || text.includes('family') || text.includes('home') || text.includes('daily') || text.includes('relax')) return 12;
  if (text.includes('people') || text.includes('person') || text.includes('man') || text.includes('woman') || text.includes('child') || text.includes('portrait') || text.includes('team')) return 13;
  if (text.includes('plant') || text.includes('flower') || text.includes('tree') || text.includes('leaf') || text.includes('garden') || text.includes('botanical')) return 14;
  if (text.includes('culture') || text.includes('religion') || text.includes('church') || text.includes('temple') || text.includes('festival') || text.includes('tradition')) return 15;
  if (text.includes('science') || text.includes('medical') || text.includes('lab') || text.includes('research') || text.includes('doctor') || text.includes('health')) return 16;
  if (text.includes('social') || text.includes('protest') || text.includes('poverty') || text.includes('community')) return 17;
  if (text.includes('sport') || text.includes('fitness') || text.includes('gym') || text.includes('running') || text.includes('football') || text.includes('soccer') || text.includes('yoga')) return 18;
  if (text.includes('tech') || text.includes('computer') || text.includes('cyber') || text.includes('ai') || text.includes('phone') || text.includes('data') || text.includes('network')) return 19;
  if (text.includes('transport') || text.includes('car') || text.includes('vehicle') || text.includes('plane') || text.includes('train') || text.includes('traffic')) return 20;
  if (text.includes('travel') || text.includes('vacation') || text.includes('tourism') || text.includes('passport') || text.includes('flight') || text.includes('destination')) return 21;

  // Default to Graphic Resources (8) or General Lifestyle (12) or People (13)
  return 8;
}

/**
 * Helper to guess Shutterstock primary and secondary categories
 */
export function mapToShutterstockCategory(categoryGuess: string, titleAndKeywords: string): { cat1: string; cat2: string } {
  const text = (categoryGuess + ' ' + titleAndKeywords).toLowerCase();

  let cat1 = 'Backgrounds/Textures';
  let cat2 = 'Objects';

  if (text.includes('vector') || text.includes('illustration') || text.includes('graphic')) {
    cat1 = 'Vectors';
    cat2 = 'Arts';
  } else if (text.includes('nature') || text.includes('landscape') || text.includes('tree') || text.includes('mountain') || text.includes('sky')) {
    cat1 = 'Nature';
    cat2 = 'Parks/Outdoor';
  } else if (text.includes('business') || text.includes('office') || text.includes('finance')) {
    cat1 = 'Business/Finance';
    cat2 = 'People';
  } else if (text.includes('person') || text.includes('people') || text.includes('portrait') || text.includes('woman') || text.includes('man')) {
    cat1 = 'People';
    cat2 = 'Beauty/Fashion';
  } else if (text.includes('food') || text.includes('drink') || text.includes('meal')) {
    cat1 = 'Food and Drink';
    cat2 = 'Objects';
  } else if (text.includes('tech') || text.includes('computer') || text.includes('phone') || text.includes('ai')) {
    cat1 = 'Technology';
    cat2 = 'Science';
  } else if (text.includes('building') || text.includes('city') || text.includes('architecture')) {
    cat1 = 'Buildings/Landmarks';
    cat2 = 'Interiors';
  } else if (text.includes('animal') || text.includes('wildlife') || text.includes('pet')) {
    cat1 = 'Animals/Wildlife';
    cat2 = 'Nature';
  } else if (text.includes('sport') || text.includes('fitness')) {
    cat1 = 'Sports/Recreation';
    cat2 = 'People';
  }

  return { cat1, cat2 };
}
