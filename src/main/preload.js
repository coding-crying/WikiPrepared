console.log('=== PRELOAD SCRIPT STARTING ===');

let contextBridge, ipcRenderer;

try {
  ({ contextBridge, ipcRenderer } = require('electron'));
  console.log('Preload: ✓ Loaded electron dependencies');
  console.log('Preload: contextBridge available:', !!contextBridge);
  console.log('Preload: ipcRenderer available:', !!ipcRenderer);
} catch (error) {
  console.error('Preload: ❌ Error loading dependencies:', error);
  console.error('Preload: Error message:', error.message);
  console.error('Preload: Stack trace:', error.stack);
  throw error;
}

// IPC Channel definitions - inlined to avoid module loading issues in sandboxed environment
const IPC_CHANNELS = {
  // Drive Management
  DRIVES_LIST: 'drives:list',
  DRIVES_INFO: 'drives:info',
  DRIVES_SCAN: 'drives:scan',
  DRIVES_EJECT: 'drives:eject',
  DRIVES_WATCH_START: 'drives:watch:start',
  DRIVES_WATCH_STOP: 'drives:watch:stop',
  DRIVES_CHANGED: 'drives:changed',
  // ZIM Catalog
  ZIM_FETCH_CATALOG: 'zim:fetch-catalog',
  ZIM_FILTER: 'zim:filter',
  ZIM_SEARCH: 'zim:search',
  ZIM_GET_METADATA: 'zim:get-metadata',
  // Download Management
  DOWNLOAD_ADD: 'download:add',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_REMOVE: 'download:remove',
  DOWNLOAD_GET_ALL: 'download:get-all',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETED: 'download:completed',
  DOWNLOAD_ERROR: 'download:error',
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
  // File Operations
  FILE_COPY: 'file:copy',
  FILE_VERIFY: 'file:verify',
  FILE_DELETE: 'file:delete',
  FILE_GET_SIZE: 'file:get-size',
  FILE_OPERATION_PROGRESS: 'file:operation-progress',
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

console.log('Preload: ✓ IPC channels defined');
console.log('Preload: Sample channels:', Object.keys(IPC_CHANNELS).slice(0, 3));

/**
 * Preload script that exposes a safe API to the renderer process
 *
 * This follows Electron security best practices:
 * - Context isolation is enabled
 * - Node integration is disabled in renderer
 * - Only specific IPC channels are exposed
 */

// Validate channel to prevent arbitrary IPC calls
const isValidChannel = (channel) => {
  return Object.values(IPC_CHANNELS).includes(channel);
};

// API exposed to renderer process
const api = {
  // Invoke handlers (renderer -> main, with response)
  invoke: (channel, ...args) => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // Send handlers (renderer -> main, no response)
  send: (channel, ...args) => {
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
    ipcRenderer.send(channel, ...args);
  },

  // Event listeners (main -> renderer)
  on: (channel, callback) => {
    if (!MAIN_TO_RENDERER_CHANNELS.includes(channel)) {
      throw new Error(`Invalid event channel: ${channel}`);
    }

    // Create a subscription
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    if (!MAIN_TO_RENDERER_CHANNELS.includes(channel)) {
      throw new Error(`Invalid event channel: ${channel}`);
    }
    ipcRenderer.removeAllListeners(channel);
  },

  // Alias for removeAllListeners (for convenience)
  off: (channel) => {
    if (!MAIN_TO_RENDERER_CHANNELS.includes(channel)) {
      throw new Error(`Invalid event channel: ${channel}`);
    }
    ipcRenderer.removeAllListeners(channel);
  },

  // App information
  getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

  // Platform information
  platform: process.platform,
};

// Expose the API to the renderer process
console.log('Preload: Exposing electronAPI to main world...');
console.log('Preload: API object keys:', Object.keys(api));
console.log('Preload: contextBridge type:', typeof contextBridge);
console.log('Preload: contextBridge.exposeInMainWorld type:', typeof contextBridge.exposeInMainWorld);

try {
  contextBridge.exposeInMainWorld('electronAPI', api);
  console.log('Preload: ✓ Successfully exposed electronAPI to main world');
  console.log('Preload: ✓ API should now be available as window.electronAPI');
} catch (error) {
  console.error('Preload: ❌ Error exposing electronAPI:', error);
  console.error('Preload: Error message:', error.message);
  console.error('Preload: Stack trace:', error.stack);

  // Try to provide helpful debugging info
  console.error('Preload: Debug info:');
  console.error('  - contextBridge available:', !!contextBridge);
  console.error('  - api object:', !!api);
  console.error('  - api keys:', api ? Object.keys(api) : 'N/A');

  throw error;
}

console.log('=== PRELOAD SCRIPT COMPLETED SUCCESSFULLY ===');
console.log('Preload: electronAPI exposed with methods:', Object.keys(api));
console.log('Preload: The renderer should now have access to window.electronAPI');
