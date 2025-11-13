// Polyfill for File API (needed by undici/axios in Electron main process)
// MUST be defined BEFORE any requires that might load axios/undici
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.bits = bits;
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

if (typeof global.FormData === 'undefined') {
  global.FormData = require('form-data');
}

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { setupIpcHandlers } = require('./ipc-handlers');

// Declare webpack magic globals (injected by Electron Forge's webpack plugin)
/* global MAIN_WINDOW_WEBPACK_ENTRY */
/* global MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY */

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

/**
 * Create the main application window
 */
const createWindow = () => {
  // Electron Forge webpack plugin injects these constants at build time
  const preloadPath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
  const rendererUrl = MAIN_WINDOW_WEBPACK_ENTRY;

  console.log('Preload path:', preloadPath);
  console.log('Renderer URL:', rendererUrl);
  console.log('Preload exists:', require('fs').existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, '../../public/icons/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    show: false, // Don't show until ready
  });

  // Load the index.html of the app
  console.log('Loading renderer from:', rendererUrl);
  mainWindow.loadURL(rendererUrl);

  // Show window when ready to show
  mainWindow.once('ready-to-show', () => {
    console.log('Window is ready to show!');
    mainWindow.show();
  });

  // Fallback: show window after 3 seconds if ready-to-show doesn't fire
  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      console.log('Window not shown yet, forcing visibility...');
      mainWindow.show();
    }
  }, 3000);

  // Log load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

/**
 * Initialize the application
 */
const initializeApp = () => {
  // Set up IPC communication handlers
  setupIpcHandlers();

  // Create window
  createWindow();

  console.log('Kiwix USB Updater started');
};

// App lifecycle events
app.whenReady().then(initializeApp);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Export for testing
module.exports = {
  getMainWindow: () => mainWindow,
};
