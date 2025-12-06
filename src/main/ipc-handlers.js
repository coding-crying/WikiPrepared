const { ipcMain, app, shell } = require('electron');
const path = require('path');
const { IPC_CHANNELS } = require('../shared/ipc-channels');
const DriveManager = require('./managers/DriveManager');
const ZimManager = require('./managers/ZimManager');
const DownloadManager = require('./managers/DownloadManager');
const KiwixManager = require('./managers/KiwixManager');
const UpdateService = require('./services/UpdateService');
const FileService = require('./services/FileService');

// Initialize managers
const driveManager = new DriveManager();
const zimManager = new ZimManager();
const downloadManager = new DownloadManager();
const kiwixManager = new KiwixManager();
const updateService = new UpdateService();
const fileService = new FileService();

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

  ipcMain.handle(IPC_CHANNELS.DRIVES_FORMAT, async (event, { device, filesystem }) => {
    try {
      return await driveManager.formatDrive(device, filesystem);
    } catch (error) {
      console.error('Error formatting drive:', error);
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

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_GET_LOCAL_DISK_INFO, async () => {
    try {
      return await downloadManager.getLocalDiskInfo();
    } catch (error) {
      console.error('Error getting local disk info:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_GET_LOCATION, async () => {
    try {
      return downloadManager.getDownloadDir();
    } catch (error) {
      console.error('Error getting download location:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_SET_LOCATION, async (event, location) => {
    try {
      downloadManager.setDownloadDir(location);
      return { success: true, path: downloadManager.getDownloadDir() };
    } catch (error) {
      console.error('Error setting download location:', error);
      throw error;
    }
  });

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

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_START_ALL, async () => {
    try {
      // Set up progress callbacks for all downloads before starting
      const allDownloads = downloadManager.getAllDownloads();
      allDownloads.forEach((download) => {
        downloadManager.onProgress(download.id, (progress) => {
          const windows = require('electron').BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, progress);

            // Also emit completed event when download finishes
            if (progress.status === 'completed') {
              console.log('Emitting download completed event for:', progress.filename);
              window.webContents.send(IPC_CHANNELS.DOWNLOAD_COMPLETED, {
                id: progress.id,
                filename: progress.filename,
                status: progress.status
              });
            }
          });
        });
      });

      return await downloadManager.startAllDownloads();
    } catch (error) {
      console.error('Error starting all downloads:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_PAUSE_ALL, async () => {
    try {
      return await downloadManager.pauseAllDownloads();
    } catch (error) {
      console.error('Error pausing all downloads:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RESUME_ALL, async () => {
    try {
      return await downloadManager.resumeAllDownloads();
    } catch (error) {
      console.error('Error resuming all downloads:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CANCEL_ALL, async () => {
    try {
      return await downloadManager.cancelAllDownloads();
    } catch (error) {
      console.error('Error cancelling all downloads:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER, async () => {
    try {
      const downloadDir = downloadManager.getDownloadDir();
      const fs = require('fs-extra');

      // Ensure directory exists
      await fs.ensureDir(downloadDir);

      // shell.openPath returns a string with error message on failure, empty string on success
      const result = await shell.openPath(downloadDir);
      if (result) {
        throw new Error(`Failed to open folder: ${result}`);
      }

      return { success: true, path: downloadDir };
    } catch (error) {
      console.error('Error opening download folder:', error);
      throw error;
    }
  });

  // ========================================
  // Transfer Handlers (Local to USB)
  // ========================================

  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, { destination, filesToTransfer }) => {
    try {
      const fs = require('fs-extra');
      const downloadDir = downloadManager.getDownloadDir();

      console.log('Starting transfer from:', downloadDir);
      console.log('Transfer destination:', destination);

      // Get all files in download directory
      const files = await fs.readdir(downloadDir);
      let zimFiles = files.filter(f => f.endsWith('.zim'));

      // If specific files were requested, filter the list
      if (filesToTransfer && Array.isArray(filesToTransfer) && filesToTransfer.length > 0) {
        console.log('Filtering transfer to selected files:', filesToTransfer);
        zimFiles = zimFiles.filter(f => filesToTransfer.includes(f));
      }

      if (zimFiles.length === 0) {
        throw new Error('No matching ZIM files found to transfer');
      }

      console.log('Found ZIM files to transfer:', zimFiles);

      // Calculate total size
      let totalSize = 0;
      const fileInfos = [];
      for (const file of zimFiles) {
        const sourcePath = path.join(downloadDir, file);
        const stats = await fs.stat(sourcePath);
        fileInfos.push({
          name: file,
          sourcePath,
          destinationPath: path.join(destination, file),
          size: stats.size
        });
        totalSize += stats.size;
      }

      console.log(`Total transfer size: ${totalSize} bytes`);

      let transferredSize = 0;
      const windows = require('electron').BrowserWindow.getAllWindows();

      // Copy each file
      for (const fileInfo of fileInfos) {
        console.log(`Transferring: ${fileInfo.name}`);

        // Send initial progress for this file
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
            currentFile: fileInfo.name,
            progress: (transferredSize / totalSize) * 100,
            transferredSize,
            totalSize,
            speed: 0
          });
        });

        try {
          // Check if file already exists
          const destExists = await fs.pathExists(fileInfo.destinationPath);
          if (destExists) {
            console.log(`File already exists at destination, skipping: ${fileInfo.name}`);
            transferredSize += fileInfo.size;
            continue;
          }

          // Copy file with progress tracking
          await new Promise((resolve, reject) => {
            const readStream = fs.createReadStream(fileInfo.sourcePath);
            const writeStream = fs.createWriteStream(fileInfo.destinationPath);

            let copiedBytes = 0;
            const startTime = Date.now();

            readStream.on('data', (chunk) => {
              copiedBytes += chunk.length;
              transferredSize += chunk.length;

              const elapsed = (Date.now() - startTime) / 1000; // seconds
              const speed = elapsed > 0 ? copiedBytes / elapsed : 0;

              // Send progress update
              windows.forEach((window) => {
                window.webContents.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
                  currentFile: fileInfo.name,
                  progress: (transferredSize / totalSize) * 100,
                  transferredSize,
                  totalSize,
                  speed
                });
              });
            });

            readStream.on('error', reject);
            writeStream.on('error', reject);
            writeStream.on('finish', resolve);

            readStream.pipe(writeStream);
          });

          console.log(`Successfully transferred: ${fileInfo.name}`);
        } catch (error) {
          console.error(`Error transferring ${fileInfo.name}:`, error);
          // Send error event
          windows.forEach((window) => {
            window.webContents.send(IPC_CHANNELS.TRANSFER_ERROR, {
              message: error.message,
              filename: fileInfo.name
            });
          });
          throw error;
        }
      }

      console.log('Transfer completed successfully');

      // Send completion event
      windows.forEach((window) => {
        window.webContents.send(IPC_CHANNELS.TRANSFER_COMPLETED, {
          filesTransferred: fileInfos.length,
          totalSize
        });
      });

      return { success: true, filesTransferred: fileInfos.length };
    } catch (error) {
      console.error('Transfer failed:', error);
      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(IPC_CHANNELS.TRANSFER_ERROR, {
          message: error.message
        });
      });
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

  ipcMain.handle(IPC_CHANNELS.KIWIX_GET_CACHE_INFO, async () => {
    try {
      return await kiwixManager.getCacheInfo();
    } catch (error) {
      console.error('Error getting Kiwix cache info:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_GET_CACHE_SIZE, async () => {
    try {
      return await kiwixManager.getCacheSize();
    } catch (error) {
      console.error('Error getting Kiwix cache size:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_CLEAR_CACHE, async (event, platform) => {
    try {
      return await kiwixManager.clearCache(platform);
    } catch (error) {
      console.error('Error clearing Kiwix cache:', error);
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

  console.log('IPC handlers set up successfully');
}

module.exports = {
  setupIpcHandlers,
};
