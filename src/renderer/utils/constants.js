/**
 * Application constants
 */

// Filesystem types with their properties
// Each filesystem has: maxFileSize (bytes), supportedOS array
export const FILESYSTEM_INFO = {
  'fat32': { maxFileSize: 4 * 1024 * 1024 * 1024, supportedOS: ['windows', 'macos', 'linux'], supportsLargeFiles: false },
  'vfat': { maxFileSize: 4 * 1024 * 1024 * 1024, supportedOS: ['windows', 'macos', 'linux'], supportsLargeFiles: false },
  'exfat': { maxFileSize: 16 * 1024 * 1024 * 1024 * 1024, supportedOS: ['windows', 'macos', 'linux'], supportsLargeFiles: true },
  'fuseblk': { maxFileSize: Number.MAX_SAFE_INTEGER, supportedOS: ['windows', 'macos', 'linux'], supportsLargeFiles: true }, // Usually NTFS/exFAT on Linux
  'ntfs': { maxFileSize: 16 * 1024 * 1024 * 1024 * 1024, supportedOS: ['windows', 'linux'], supportsLargeFiles: true }, // macOS needs extra driver
  'ext4': { maxFileSize: 16 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'ext3': { maxFileSize: 2 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'ext2': { maxFileSize: 2 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'btrfs': { maxFileSize: 16 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'xfs': { maxFileSize: 8 * 1024 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'zfs': { maxFileSize: 16 * 1024 * 1024 * 1024 * 1024 * 1024, supportedOS: ['linux'], supportsLargeFiles: true },
  'apfs': { maxFileSize: 8 * 1024 * 1024 * 1024 * 1024 * 1024, supportedOS: ['macos'], supportsLargeFiles: true },
  'hfs+': { maxFileSize: 8 * 1024 * 1024 * 1024 * 1024 * 1024, supportedOS: ['macos'], supportsLargeFiles: true },
  'hfsplus': { maxFileSize: 8 * 1024 * 1024 * 1024 * 1024 * 1024, supportedOS: ['macos'], supportsLargeFiles: true },
};

// Helper function to check if a filesystem supports large files (case insensitive)
export function supportsLargeFiles(filesystem) {
  if (!filesystem) return false;
  const fs = filesystem.toLowerCase();
  const info = FILESYSTEM_INFO[fs];
  return info ? info.supportsLargeFiles : false;
}

// Helper function to get filesystem info (case insensitive)
export function getFilesystemInfo(filesystem) {
  if (!filesystem) return null;
  const fs = filesystem.toLowerCase();
  return FILESYSTEM_INFO[fs] || null;
}

// Legacy FILESYSTEMS object for backward compatibility
export const FILESYSTEMS = {
  // Use supportsLargeFiles() function instead of checking this array
  LARGE_FILE_SUPPORT: Object.keys(FILESYSTEM_INFO).filter(fs => FILESYSTEM_INFO[fs].supportsLargeFiles),
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
  COMPLETE: '/complete',
  USB_AUDIT: '/usb-audit'
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
  if (!code) return 'Unknown';
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
  if (!scope) return 'Unknown';
  return SCOPE_NAMES[scope] || scope;
}
