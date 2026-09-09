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
const fs = require('fs');
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
  // Electron Forge may provide entries as compile-time globals or runtime env vars.
  // Electron Builder packages won't have these and should use bundled files.
  const forgePreloadEntry = (
    typeof MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY !== 'undefined'
      ? MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
      : process.env.MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
  );

  const preloadPath = forgePreloadEntry || path.join(__dirname, 'preload.js');

  console.log('Preload path:', preloadPath);
  console.log('Preload exists:', fs.existsSync(preloadPath));

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

  // Load renderer entry. Prefer Forge entry (global or env) when available.
  const forgeRendererEntry = (
    typeof MAIN_WINDOW_WEBPACK_ENTRY !== 'undefined'
      ? MAIN_WINDOW_WEBPACK_ENTRY
      : process.env.MAIN_WINDOW_WEBPACK_ENTRY
  );

  // Fallbacks for packaged/non-forge execution.
  const rendererCandidates = [
    path.join(__dirname, '../renderer/index.html'), // electron-builder output
    path.join(__dirname, '../../.webpack/renderer/main_window/index.html'), // forge output layout
    path.join(__dirname, '../../build/renderer/index.html'), // manual webpack:prod output
  ];
  const bundledRendererPath = rendererCandidates.find((candidate) => fs.existsSync(candidate)) || null;

  const isDev = !app.isPackaged;
  const defaultDevUrl = 'http://localhost:3000/main_window/index.html';
  const initialRendererUrl = forgeRendererEntry || (isDev ? defaultDevUrl : null);

  // Dev-only CSP relaxation: webpack HMR needs 'unsafe-eval'. Packaged builds
  // keep the strict CSP from public/index.html.
  if (isDev && initialRendererUrl) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: http://localhost:* http://127.0.0.1:* https:; font-src 'self' data:;",
          ],
        },
      });
    });
  }

  let rendererFallbackAttempted = false;

  // Log load errors and (in dev) fall back to a built file if the dev server isn't reachable.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
    console.error('Failed to load:', errorCode, errorDescription);

    if (
      !rendererFallbackAttempted &&
      isMainFrame &&
      isDev &&
      initialRendererUrl &&
      bundledRendererPath &&
      (errorDescription.includes('ERR_CONNECTION_REFUSED') || errorDescription.includes('ERR_NAME_NOT_RESOLVED'))
    ) {
      rendererFallbackAttempted = true;
      console.log('Dev server not reachable, falling back to file:', bundledRendererPath);
      mainWindow.loadFile(bundledRendererPath);
    }
  });

  if (initialRendererUrl) {
    console.log('Loading from webpack entry:', initialRendererUrl);
    mainWindow.loadURL(initialRendererUrl);
  } else if (bundledRendererPath) {
    console.log('Loading bundled renderer file:', bundledRendererPath);
    mainWindow.loadFile(bundledRendererPath);
  } else {
    console.error('No renderer entry found. Checked:', rendererCandidates);
    return;
  }

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
const initializeApp = async () => {
  // Set up IPC communication handlers
  setupIpcHandlers();

  // Create window
  createWindow();

  console.log('WikiPrepared started - Redesigned UI active');

  // Start drive watching automatically
  // This ensures drives are detected as soon as the app starts
  const DriveManager = require('./managers/DriveManager');
  const driveManager = new DriveManager();

  try {
    // Initial drive scan
    const drives = await driveManager.listDrives();
    console.log(`Initial scan found ${drives.length} drive(s)`);

    // Start watching for drive changes
    driveManager.startWatching((drives) => {
      console.log('Drives changed, notifying renderer...');
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('drives:changed', drives);
      }
    });

    console.log('Drive watching started');
  } catch (error) {
    console.error('Failed to initialize drive scanning:', error);
  }
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
