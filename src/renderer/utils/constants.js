/**
 * Application constants
 */

// Filesystem types
export const FILESYSTEMS = {
  LARGE_FILE_SUPPORT: ['exFAT', 'NTFS', 'ext4', 'APFS', 'HFS+'],
  FAT32: 'FAT32',
  EXFAT: 'exFAT',
  NTFS: 'NTFS'
};

// Storage thresholds
export const STORAGE = {
  MIN_RECOMMENDED_GB: 64,
  FAT32_MAX_FILE_SIZE: 4 * 1024 * 1024 * 1024, // 4GB
  MIN_FREE_SPACE_BUFFER: 500 * 1024 * 1024 // 500MB buffer
};

// ZIM scopes
export const ZIM_SCOPES = {
  MAXI: 'maxi',
  NOPIC: 'nopic',
  MINI: 'mini'
};

// Reader platforms
export const PLATFORMS = {
  WINDOWS: 'windows',
  LINUX: 'linux',
  MACOS: 'macos',
  ANDROID: 'android',
  IOS: 'ios' // Note: iOS is App Store only
};

// Platform display names
export const PLATFORM_NAMES = {
  [PLATFORMS.WINDOWS]: 'Windows',
  [PLATFORMS.LINUX]: 'Linux',
  [PLATFORMS.MACOS]: 'macOS',
  [PLATFORMS.ANDROID]: 'Android',
  [PLATFORMS.IOS]: 'iOS'
};

// Reader sizes (in bytes)
export const READER_SIZES = {
  [PLATFORMS.WINDOWS]: 80 * 1024 * 1024,    // 80MB
  [PLATFORMS.LINUX]: 90 * 1024 * 1024,       // 90MB
  [PLATFORMS.MACOS]: 100 * 1024 * 1024,      // 100MB
  [PLATFORMS.ANDROID]: 45 * 1024 * 1024      // 45MB
};

// Download strategies
export const DOWNLOAD_STRATEGIES = {
  LOCAL_FIRST: 'local-first',
  DIRECT_TO_USB: 'direct-to-usb'
};

// User intents
export const USER_INTENTS = {
  UPDATE: 'update',
  CREATE_NEW: 'create-new'
};

// Routes
export const ROUTES = {
  START: '/start',
  DRIVE_SELECTION: '/drive-selection',
  FILESYSTEM_WARNING: '/filesystem-warning',
  CONFIGURE: '/configure',
  DOWNLOAD_STRATEGY: '/download-strategy',
  DOWNLOADING: '/downloading',
  TRANSFERRING: '/transferring',
  COMPLETE: '/complete'
};

// Language names (common ones, more can be added)
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
  hi: 'Hindi',
  bn: 'Bengali',
  pa: 'Punjabi',
  te: 'Telugu',
  ta: 'Tamil',
  ur: 'Urdu',
  vi: 'Vietnamese',
  tr: 'Turkish',
  ko: 'Korean',
  pl: 'Polish',
  uk: 'Ukrainian',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
  fi: 'Finnish',
  da: 'Danish',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  cs: 'Czech',
  ro: 'Romanian',
  hu: 'Hungarian',
  sk: 'Slovak'
};

// Get language name or return code if not found
export function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

// Scope display names
export const SCOPE_NAMES = {
  [ZIM_SCOPES.MAXI]: 'Complete (with pictures)',
  [ZIM_SCOPES.NOPIC]: 'No Pictures',
  [ZIM_SCOPES.MINI]: 'Mini (essential articles)'
};

// Get scope display name
export function getScopeName(scope) {
  return SCOPE_NAMES[scope] || scope;
}
