const { ipcMain, app, dialog } = require('electron');
const { IPC_CHANNELS } = require('../shared/ipc-channels');
const DriveManager = require('./managers/DriveManager');
const ZimManager = require('./managers/ZimManager');
const DownloadManager = require('./managers/DownloadManager');
const KiwixManager = require('./managers/KiwixManager');
const UpdateService = require('./services/UpdateService');
const FileService = require('./services/FileService');
const FlashService = require('./services/FlashService');

// Initialize managers
const driveManager = new DriveManager();
const zimManager = new ZimManager();
const downloadManager = new DownloadManager();
const kiwixManager = new KiwixManager();
const updateService = new UpdateService();
const fileService = new FileService();
const flashService = new FlashService();

/**
 * Set up all IPC communication handlers
 */
function setupIpcHandlers() {
  console.log('Setting up IPC handlers...');

  // ========================================
  // Drive Management Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.DRIVES_LIST, async () => {
    try {
      return await driveManager.listDrives();
    } catch (error) {
      console.error('Error listing drives:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DRIVES_INFO, async (event, drivePath) => {
    try {
      return await driveManager.getDriveInfo(drivePath);
    } catch (error) {
      console.error('Error getting drive info:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DRIVES_SCAN, async (event, drivePath) => {
    try {
      return await driveManager.scanZimFiles(drivePath);
    } catch (error) {
      console.error('Error scanning drive:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DRIVES_EJECT, async (event, drivePath) => {
    try {
      return await driveManager.ejectDrive(drivePath);
    } catch (error) {
      console.error('Error ejecting drive:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DRIVES_WATCH_START, () => {
    try {
      driveManager.startWatching((drives) => {
        // Send drive changes to all windows
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.DRIVES_CHANGED, drives);
        });
      });
      return { success: true };
    } catch (error) {
      console.error('Error starting drive watch:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DRIVES_WATCH_STOP, () => {
    try {
      driveManager.stopWatching();
      return { success: true };
    } catch (error) {
      console.error('Error stopping drive watch:', error);
      throw error;
    }
  });

  // ========================================
  // ZIM Catalog Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.ZIM_FETCH_CATALOG, async (event, forceRefresh = false) => {
    try {
      return await zimManager.fetchCatalog(forceRefresh);
    } catch (error) {
      console.error('Error fetching ZIM catalog:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ZIM_FILTER, async (event, filters) => {
    try {
      return await zimManager.filterZims(filters);
    } catch (error) {
      console.error('Error filtering ZIMs:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ZIM_SEARCH, async (event, searchTerm) => {
    try {
      return await zimManager.searchZims(searchTerm);
    } catch (error) {
      console.error('Error searching ZIMs:', error);
      throw error;
    }
  });

  // ========================================
  // Download Management Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_ADD, async (event, zimInfo, destination) => {
    try {
      return await downloadManager.addToQueue(zimInfo, destination);
    } catch (error) {
      console.error('Error adding download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_START, async (event, downloadId) => {
    try {
      // Set up progress callback
      downloadManager.onProgress(downloadId, (progress) => {
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);
        });
      });

      return await downloadManager.startDownload(downloadId);
    } catch (error) {
      console.error('Error starting download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_PAUSE, async (event, downloadId) => {
    try {
      return await downloadManager.pauseDownload(downloadId);
    } catch (error) {
      console.error('Error pausing download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RESUME, async (event, downloadId) => {
    try {
      return await downloadManager.resumeDownload(downloadId);
    } catch (error) {
      console.error('Error resuming download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CANCEL, async (event, downloadId) => {
    try {
      return await downloadManager.cancelDownload(downloadId);
    } catch (error) {
      console.error('Error cancelling download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_GET_ALL, async () => {
    try {
      return downloadManager.getAllDownloads();
    } catch (error) {
      console.error('Error getting downloads:', error);
      throw error;
    }
  });

  // ========================================
  // Update Service Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.UPDATE_SCAN_USB, async (event, drivePath) => {
    try {
      return await updateService.scanInstalledZims(drivePath);
    } catch (error) {
      console.error('Error scanning USB for updates:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async (event, installedZims) => {
    try {
      const catalog = await zimManager.fetchCatalog();
      return await updateService.checkForUpdates(installedZims, catalog);
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  });

  // ========================================
  // Kiwix Reader Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.KIWIX_GET_VERSIONS, async () => {
    try {
      return await kiwixManager.getLatestVersions();
    } catch (error) {
      console.error('Error getting Kiwix versions:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_DOWNLOAD, async (event, platform, destination) => {
    try {
      return await kiwixManager.downloadReader(platform, destination);
    } catch (error) {
      console.error('Error downloading Kiwix reader:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_INSTALL, async (event, platform, usbPath) => {
    try {
      return await kiwixManager.installToUSB(platform, usbPath);
    } catch (error) {
      console.error('Error installing Kiwix reader:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_DETECT_INSTALLED, async (event, usbPath) => {
    try {
      return await kiwixManager.detectInstalledReaders(usbPath);
    } catch (error) {
      console.error('Error detecting installed readers:', error);
      throw error;
    }
  });

  // ========================================
  // File Operation Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.FILE_COPY, async (event, source, destination) => {
    try {
      return await fileService.copyFile(source, destination, (progress) => {
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.FILE_OPERATION_PROGRESS, {
            operation: 'copy',
            source,
            destination,
            progress,
          });
        });
      });
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_VERIFY, async (event, filepath, checksum) => {
    try {
      return await fileService.verifyChecksum(filepath, checksum);
    } catch (error) {
      console.error('Error verifying file:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (event, filepath) => {
    try {
      return await fileService.deleteFile(filepath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_GET_SIZE, async (event, filepath) => {
    try {
      return await fileService.getFileSize(filepath);
    } catch (error) {
      console.error('Error getting file size:', error);
      throw error;
    }
  });

  // ========================================
  // Application Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.handle(IPC_CHANNELS.APP_SHOW_OPEN_DIALOG, async (event, options) => {
    return await dialog.showOpenDialog(options);
  });

  ipcMain.handle(IPC_CHANNELS.APP_SHOW_SAVE_DIALOG, async (event, options) => {
    return await dialog.showSaveDialog(options);
  });

  // ========================================
  // Flash USB Handlers
  // ========================================

  ipcMain.handle(IPC_CHANNELS.FLASH_FORMAT_DRIVE, async (event, devicePath, filesystem, label) => {
    try {
      return await driveManager.formatDrive(devicePath, filesystem, label);
    } catch (error) {
      console.error('Error formatting drive:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLASH_CREATE_STRUCTURE, async (event, mountPath) => {
    try {
      return await flashService.createFolderStructure(mountPath);
    } catch (error) {
      console.error('Error creating folder structure:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLASH_COPY_ZIM, async (event, zimUrl, mountPath) => {
    try {
      const result = await flashService.copyZimFile(zimUrl, mountPath, (progress) => {
        // Send progress updates to renderer
        const windows = require('electron').BrowserWindow.getAllWindows();
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.FLASH_PROGRESS, progress);
        });
      });
      return result;
    } catch (error) {
      console.error('Error copying ZIM:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLASH_COPY_KIWIX, async (event, platforms, mountPath) => {
    try {
      return await flashService.copyKiwixReaders(platforms, mountPath);
    } catch (error) {
      console.error('Error copying Kiwix readers:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLASH_CREATE_METADATA, async (event, mountPath, metadata) => {
    try {
      return await flashService.createMetadata(mountPath, {
        ...metadata,
        appVersion: app.getVersion(),
      });
    } catch (error) {
      console.error('Error creating metadata:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLASH_DETECT_METADATA, async (event, mountPath) => {
    try {
      return await flashService.detectMetadata(mountPath);
    } catch (error) {
      console.error('Error detecting metadata:', error);
      throw error;
    }
  });

  // ========================================
  // Settings Handlers
  // ========================================

  // Simple in-memory settings for now
  // TODO: Implement persistent settings storage
  let appSettings = {
    downloadPath: '',
    autoDeleteOldVersions: false,
    verifyChecksums: true,
    maxConcurrentDownloads: 2,
    bandwidthLimit: 0,
    updateCheckFrequency: 'manual',
    theme: 'light',
    downloadDirectToUSB: false
  };

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return appSettings;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (event, newSettings) => {
    appSettings = { ...appSettings, ...newSettings };
    // TODO: Save to disk
    return appSettings;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, () => {
    appSettings = {
      downloadPath: '',
      autoDeleteOldVersions: false,
      verifyChecksums: true,
      maxConcurrentDownloads: 2,
      bandwidthLimit: 0,
      updateCheckFrequency: 'manual',
      theme: 'light',
      downloadDirectToUSB: false
    };
    return appSettings;
  });

  console.log('IPC handlers set up successfully');
}

module.exports = {
  setupIpcHandlers,
};
