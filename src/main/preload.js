const { contextBridge, ipcRenderer } = require('electron');
const { IPC_CHANNELS, MAIN_TO_RENDERER_CHANNELS } = require('../shared/ipc-channels');

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
contextBridge.exposeInMainWorld('electronAPI', api);

console.log('Preload script loaded');
