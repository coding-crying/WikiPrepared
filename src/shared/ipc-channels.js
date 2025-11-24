/**
 * IPC Channel Definitions
 *
 * All IPC communication channels between main and renderer processes.
 * Using constants prevents typos and makes refactoring easier.
 */

const IPC_CHANNELS = {
  // Drive Management
  DRIVES_LIST: 'drives:list',
  DRIVES_INFO: 'drives:info',
  DRIVES_SCAN: 'drives:scan',
  DRIVES_EJECT: 'drives:eject',
  DRIVES_WATCH_START: 'drives:watch:start',
  DRIVES_WATCH_STOP: 'drives:watch:stop',
  DRIVES_CHANGED: 'drives:changed', // Event from main to renderer

  // ZIM Catalog
  ZIM_FETCH_CATALOG: 'zim:fetch-catalog',
  ZIM_FILTER: 'zim:filter',
  ZIM_SEARCH: 'zim:search',
  ZIM_GET_METADATA: 'zim:get-metadata',

  // Download Management
  DOWNLOAD_GET_LOCAL_DISK_INFO: 'download:get-local-disk-info',
  DOWNLOAD_SET_LOCATION: 'download:set-location',
  DOWNLOAD_GET_LOCATION: 'download:get-location',
  DOWNLOAD_ADD: 'download:add',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_START_ALL: 'download:start-all',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_PAUSE_ALL: 'download:pause-all',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_RESUME_ALL: 'download:resume-all',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_CANCEL_ALL: 'download:cancel-all',
  DOWNLOAD_REMOVE: 'download:remove',
  DOWNLOAD_GET_ALL: 'download:get-all',
  DOWNLOAD_PROGRESS: 'download:progress', // Event from main to renderer
  DOWNLOAD_COMPLETED: 'download:completed', // Event
  DOWNLOAD_ERROR: 'download:error', // Event

  // Update Detection
  UPDATE_SCAN_USB: 'update:scan-usb',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_BATCH_INSTALL: 'update:batch-install',

  // Kiwix Reader Management
  KIWIX_GET_VERSIONS: 'kiwix:get-versions',
  KIWIX_DOWNLOAD: 'kiwix:download',
  KIWIX_INSTALL: 'kiwix:install',
  KIWIX_DETECT_INSTALLED: 'kiwix:detect-installed',
  KIWIX_GET_CACHE_INFO: 'kiwix:get-cache-info',
  KIWIX_GET_CACHE_SIZE: 'kiwix:get-cache-size',
  KIWIX_CLEAR_CACHE: 'kiwix:clear-cache',

  // File Operations
  FILE_COPY: 'file:copy',
  FILE_VERIFY: 'file:verify',
  FILE_DELETE: 'file:delete',
  FILE_GET_SIZE: 'file:get-size',
  FILE_OPERATION_PROGRESS: 'file:operation-progress', // Event

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // Application
  APP_GET_VERSION: 'app:get-version',
  APP_QUIT: 'app:quit',
  APP_SHOW_OPEN_DIALOG: 'app:show-open-dialog',
  APP_SHOW_SAVE_DIALOG: 'app:show-save-dialog',
};

// Event channels that flow from main to renderer
const MAIN_TO_RENDERER_CHANNELS = [
  IPC_CHANNELS.DRIVES_CHANGED,
  IPC_CHANNELS.DOWNLOAD_PROGRESS,
  IPC_CHANNELS.DOWNLOAD_COMPLETED,
  IPC_CHANNELS.DOWNLOAD_ERROR,
  IPC_CHANNELS.FILE_OPERATION_PROGRESS,
];

// Channels that require elevated permissions (warnings)
const DANGEROUS_CHANNELS = [
  IPC_CHANNELS.DRIVES_EJECT,
  IPC_CHANNELS.FILE_DELETE,
];

// Export for CommonJS (main process) and ES6 (renderer via webpack)
module.exports = {
  IPC_CHANNELS,
  MAIN_TO_RENDERER_CHANNELS,
  DANGEROUS_CHANNELS,
};
