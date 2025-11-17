console.log('=== PRELOAD SCRIPT STARTING ===');
console.log('Preload: __dirname =', __dirname);
console.log('Preload: process.cwd() =', process.cwd());

let contextBridge, ipcRenderer, IPC_CHANNELS, MAIN_TO_RENDERER_CHANNELS;

try {
  ({ contextBridge, ipcRenderer } = require('electron'));
  console.log('Preload: ✓ Loaded electron dependencies');
  console.log('Preload: contextBridge available:', !!contextBridge);
  console.log('Preload: ipcRenderer available:', !!ipcRenderer);

  // Load IPC channels - static require to avoid webpack warnings
  ({ IPC_CHANNELS, MAIN_TO_RENDERER_CHANNELS } = require('../shared/ipc-channels'));
  console.log('Preload: ✓ Loaded IPC channels');

  console.log('Preload: IPC_CHANNELS loaded:', !!IPC_CHANNELS);
  console.log('Preload: Sample channels:', Object.keys(IPC_CHANNELS).slice(0, 3));
  console.log('Preload: All dependencies loaded successfully');
} catch (error) {
  console.error('Preload: ❌ Error loading dependencies:', error);
  console.error('Preload: Error message:', error.message);
  console.error('Preload: Stack trace:', error.stack);
  throw error;
}

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
