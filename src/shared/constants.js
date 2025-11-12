/**
 * Application-wide constants
 */

// ZIM File Scopes
export const ZIM_SCOPES = {
  MINI: 'mini',
  NOPIC: 'nopic',
  MAXI: 'maxi',
};

export const ZIM_SCOPE_DESCRIPTIONS = {
  [ZIM_SCOPES.MINI]: 'Lead sections only (smallest)',
  [ZIM_SCOPES.NOPIC]: 'Full articles without images',
  [ZIM_SCOPES.MAXI]: 'Complete content with images (largest)',
};

// ZIM Topics
export const ZIM_TOPICS = {
  ALL: 'all',
  COMPUTER: 'computer',
  GEOGRAPHY: 'geography',
  CHEMISTRY: 'chemistry',
  BIOLOGY: 'biology',
  HISTORY: 'history',
  MEDICINE: 'medicine',
  MATHEMATICS: 'mathematics',
};

// Download States
export const DOWNLOAD_STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  ERROR: 'error',
  CANCELLED: 'cancelled',
};

// Kiwix Platforms
export const KIWIX_PLATFORMS = {
  WINDOWS: 'windows',
  LINUX: 'linux',
  MAC: 'mac',
};

export const KIWIX_PLATFORM_NAMES = {
  [KIWIX_PLATFORMS.WINDOWS]: 'Windows',
  [KIWIX_PLATFORMS.LINUX]: 'Linux',
  [KIWIX_PLATFORMS.MAC]: 'macOS',
};

// File System Types
export const FS_TYPES = {
  FAT32: 'fat32',
  EXFAT: 'exfat',
  NTFS: 'ntfs',
  EXT4: 'ext4',
  APFS: 'apfs',
};

export const FS_TYPE_COMPATIBILITY = {
  [FS_TYPES.FAT32]: { windows: true, linux: true, mac: true, maxFileSize: 4294967296 }, // 4GB
  [FS_TYPES.EXFAT]: { windows: true, linux: true, mac: true, maxFileSize: Number.MAX_SAFE_INTEGER },
  [FS_TYPES.NTFS]: { windows: true, linux: true, mac: false, maxFileSize: Number.MAX_SAFE_INTEGER },
  [FS_TYPES.EXT4]: { windows: false, linux: true, mac: false, maxFileSize: Number.MAX_SAFE_INTEGER },
  [FS_TYPES.APFS]: { windows: false, linux: false, mac: true, maxFileSize: Number.MAX_SAFE_INTEGER },
};

// URLs
export const URLS = {
  WIKIMEDIA_DUMPS: 'https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/',
  KIWIX_DOWNLOAD: 'https://download.kiwix.org/release/',
  KIWIX_WEBSITE: 'https://www.kiwix.org/',
};

// Application Settings Defaults
export const DEFAULT_SETTINGS = {
  downloadPath: null, // null means use system temp directory
  autoDeleteOldVersions: false,
  verifyChecksums: true,
  maxConcurrentDownloads: 2,
  bandwidthLimit: 0, // 0 means no limit
  updateCheckFrequency: 'manual', // manual, daily, weekly
  theme: 'light', // light, dark, system
  downloadDirectToUSB: false, // If false, download to temp then copy
};

// Logging Levels
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

// Error Codes
export const ERROR_CODES = {
  // Drive Errors
  DRIVE_NOT_FOUND: 'DRIVE_NOT_FOUND',
  DRIVE_NOT_USB: 'DRIVE_NOT_USB',
  DRIVE_INSUFFICIENT_SPACE: 'DRIVE_INSUFFICIENT_SPACE',
  DRIVE_READ_ONLY: 'DRIVE_READ_ONLY',

  // Download Errors
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DOWNLOAD_NETWORK_ERROR: 'DOWNLOAD_NETWORK_ERROR',
  DOWNLOAD_CHECKSUM_MISMATCH: 'DOWNLOAD_CHECKSUM_MISMATCH',
  DOWNLOAD_DISK_FULL: 'DOWNLOAD_DISK_FULL',

  // File Errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  FILE_COPY_FAILED: 'FILE_COPY_FAILED',

  // Catalog Errors
  CATALOG_FETCH_FAILED: 'CATALOG_FETCH_FAILED',
  CATALOG_PARSE_FAILED: 'CATALOG_PARSE_FAILED',

  // General
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// Cache Settings
export const CACHE_SETTINGS = {
  CATALOG_TTL: 86400000, // 24 hours in milliseconds
  DRIVE_SCAN_DEBOUNCE: 1000, // 1 second
};

// Language Codes (Common Wikipedia Languages)
export const LANGUAGE_CODES = {
  en: 'English',
  es: 'Español (Spanish)',
  fr: 'Français (French)',
  de: 'Deutsch (German)',
  it: 'Italiano (Italian)',
  pt: 'Português (Portuguese)',
  ru: 'Русский (Russian)',
  ja: '日本語 (Japanese)',
  zh: '中文 (Chinese)',
  ar: 'العربية (Arabic)',
  hi: 'हिन्दी (Hindi)',
  nl: 'Nederlands (Dutch)',
  pl: 'Polski (Polish)',
  tr: 'Türkçe (Turkish)',
  ko: '한국어 (Korean)',
  sv: 'Svenska (Swedish)',
  vi: 'Tiếng Việt (Vietnamese)',
  fa: 'فارسی (Persian)',
  th: 'ไทย (Thai)',
  uk: 'Українська (Ukrainian)',
};
