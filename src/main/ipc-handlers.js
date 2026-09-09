const { ipcMain, app, shell } = require('electron');
const path = require('path');
const os = require('os');
const { IPC_CHANNELS } = require('../shared/ipc-channels');
const DriveManager = require('./managers/DriveManager');
const ZimManager = require('./managers/ZimManager');
const DownloadManager = require('./managers/DownloadManager');
const KiwixManager = require('./managers/KiwixManager');
const UpdateService = require('./services/UpdateService');
const FileService = require('./services/FileService');
const USBAuditService = require('./services/USBAuditService');

// Initialize managers
const driveManager = new DriveManager();
const zimManager = new ZimManager();
const downloadManager = new DownloadManager();
const kiwixManager = new KiwixManager();
const updateService = new UpdateService();
const fileService = new FileService();
const usbAuditService = new USBAuditService();
const USB_LIBRARY_DIRNAME = 'Library (.zim files)';

// Cooperative cancellation flag for the current TRANSFER_START operation.
// Checked between files and between stream chunks; reset at transfer start.
let transferCancelRequested = false;

function requestTransferCancel() {
  transferCancelRequested = true;
}

/**
 * Build the set of path prefixes the renderer may operate on via file IPC:
 * the download directory, the app's userData dir, and every mounted
 * removable/USB drive. Anything outside these scopes is rejected.
 */
async function getAllowedPathScopes() {
  const scopes = new Set();
  try {
    scopes.add(path.resolve(downloadManager.getDownloadDir()));
  } catch (_e) { /* ignore */ }
  try {
    scopes.add(path.resolve(app.getPath('userData')));
  } catch (_e) { /* ignore */ }
  try {
    const drives = await driveManager.listDrives();
    for (const drive of drives) {
      const mps = Array.isArray(drive.mountpoints) ? drive.mountpoints : [];
      for (const mp of mps) {
        if (mp?.path) scopes.add(path.resolve(mp.path));
      }
      if (drive.mountpoint) scopes.add(path.resolve(drive.mountpoint));
    }
  } catch (_e) { /* ignore */ }
  return Array.from(scopes).filter(Boolean);
}

/**
 * True when targetPath resolves inside one of the allowed scopes
 * (or equals a scope root). Prevents path traversal via ../ sequences.
 */
function isPathInScopes(targetPath, scopes) {
  if (typeof targetPath !== 'string' || targetPath.length === 0) return false;
  const resolved = path.resolve(targetPath);
  return scopes.some((scope) => resolved === scope || resolved.startsWith(scope + path.sep));
}

/**
 * Combined guard: resolve current scopes and assert the given paths are
 * within them. Throws a user-readable error when blocked.
 */
async function assertPathsInScope(label, ...candidatePaths) {
  const scopes = await getAllowedPathScopes();
  for (const p of candidatePaths) {
    if (p && !isPathInScopes(p, scopes)) {
      throw new Error(`${label} blocked: path is outside the download folder and connected USB drives.`);
    }
  }
}

// Hosts the app is allowed to download content from. The catalog only ever
// points at these; anything else from the renderer is rejected (SSRF guard).
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'dumps.wikimedia.org',
  'download.kiwix.org',
  'mirror.download.kiwix.org',
  'archive.org',
]);

function isAllowedDownloadUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_e) {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_DOWNLOAD_HOSTS.has(host) || host.endsWith('.kiwix.org') || host.endsWith('.wikimedia.org');
}

function getUsbRootFromDownloadDestination(destination) {
  if (!destination) {
    return null;
  }

  const normalized = path.normalize(destination);
  const candidates = [
    `${path.sep}${USB_LIBRARY_DIRNAME}${path.sep}`,
    `${path.sep}Library${path.sep}`,
  ];

  const librarySegment = candidates.find((segment) => normalized.includes(segment));
  const libraryIndex = librarySegment ? normalized.indexOf(librarySegment) : -1;

  if (libraryIndex === -1) {
    return null;
  }

  return normalized.slice(0, libraryIndex);
}

async function refreshPortableLibraryForDownload(progress) {
  if (progress?.status !== 'completed') {
    return;
  }

  const download = downloadManager.getDownload(progress.id);
  const usbRoot = getUsbRootFromDownloadDestination(download?.destination);

  if (!usbRoot) {
    return;
  }

  try {
    await kiwixManager.refreshPortableLibraries(usbRoot);
  } catch (error) {
    console.warn(`Failed to refresh portable library for ${progress.filename}:`, error.message);
  }
}

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
      // The renderer may only pick directories under the user's home
      // (via the native folder dialog); anything else is rejected.
      const homeDir = path.resolve(os.homedir());
      if (typeof location !== 'string' || location.length === 0) {
        throw new Error('Invalid download location');
      }
      const resolved = path.resolve(location);
      if (resolved !== homeDir && !resolved.startsWith(homeDir + path.sep)) {
        throw new Error('Download location must be inside your user folder.');
      }
      downloadManager.setDownloadDir(location);
      return { success: true, path: downloadManager.getDownloadDir() };
    } catch (error) {
      console.error('Error setting download location:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_ADD, async (event, zimInfo, destination) => {
    try {
      // SSRF guard: only allow downloads from the trusted content hosts.
      if (!isAllowedDownloadUrl(zimInfo?.url)) {
        throw new Error(`Download blocked: '${zimInfo?.url || 'missing URL'}' is not an allowed content source.`);
      }
      // Destination (if provided) must be a connected USB drive.
      if (destination) {
        await assertPathsInScope('Download destination', destination);
      }
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

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_REMOVE, async (event, downloadId) => {
    try {
      downloadManager.removeDownload(downloadId);
      return { success: true };
    } catch (error) {
      console.error('Error removing download:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CLEAR_CACHE, async () => {
    try {
      await downloadManager.clearDownloadCache();
      return { success: true };
    } catch (error) {
      console.error('Error clearing download cache:', error);
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
          refreshPortableLibraryForDownload(progress);
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

  ipcMain.handle(IPC_CHANNELS.TRANSFER_START, async (event, { destination, filesToTransfer, selectedReaders = [], overwriteExisting = false }) => {
    // Declared outside try so cancel-cleanup in catch can access it.
    let fileInfos = [];
    try {
      const fs = require('fs-extra');
      const downloadDir = downloadManager.getDownloadDir();

      // Destination must be a connected USB drive (scope check).
      await assertPathsInScope('Transfer destination', destination);

      transferCancelRequested = false;

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
      fileInfos = [];

      // Ensure the visible ZIM library folder exists
      const libraryDir = path.join(destination, USB_LIBRARY_DIRNAME);
      await fs.ensureDir(libraryDir);

      for (const file of zimFiles) {
        const sourcePath = path.join(downloadDir, file);
        const stats = await fs.stat(sourcePath);
        fileInfos.push({
          name: file,
          sourcePath,
          destinationPath: path.join(libraryDir, file),
          size: stats.size
        });
        totalSize += stats.size;
      }

      console.log(`Total transfer size: ${totalSize} bytes`);

      let transferredSize = 0;
      const windows = require('electron').BrowserWindow.getAllWindows();

	      // Copy each file
	      for (const fileInfo of fileInfos) {
	        if (transferCancelRequested) {
	          throw new Error('Transfer cancelled by user');
	        }
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
		          if (destExists && !overwriteExisting) {
		            console.log(`File already exists at destination, skipping: ${fileInfo.name}`);
		            transferredSize += fileInfo.size;
		          }

		          if (destExists && overwriteExisting) {
		            console.log(`Overwriting existing destination file: ${fileInfo.name}`);
		            windows.forEach((window) => {
		              window.webContents.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
		                currentFile: `Removing old copy of ${fileInfo.name}`,
		                progress: (transferredSize / totalSize) * 100,
		                transferredSize,
		                totalSize,
		                speed: 0
		              });
		            });
		            try {
		              await fs.remove(fileInfo.destinationPath);
		            } catch (e) {
		              // If we can't remove, let the copy attempt throw a clearer error.
		            }
		          }

		          if (!destExists || overwriteExisting) {
		            // Copy file with progress tracking
		            await new Promise((resolve, reject) => {
		              const readStream = fs.createReadStream(fileInfo.sourcePath);
		              const writeStream = fs.createWriteStream(fileInfo.destinationPath);

		              let copiedBytes = 0;
		              const startTime = Date.now();

		              readStream.on('data', (chunk) => {
		                if (transferCancelRequested) {
		                  readStream.destroy();
		                  writeStream.destroy();
		                  reject(new Error('Transfer cancelled by user'));
		                  return;
		                }
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
		          }

	          // Verify destination file integrity (critical safeguard).
	          windows.forEach((window) => {
	            window.webContents.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
	              currentFile: `Verifying ${fileInfo.name}`,
	              progress: (transferredSize / totalSize) * 100,
	              transferredSize,
	              totalSize,
	              speed: 0
	            });
	          });

	          const readShaFile = async (shaPath) => {
	            try {
	              const txt = await fs.readFile(shaPath, 'utf8');
	              const match = txt.match(/[a-fA-F0-9]{64}/);
	              return match ? match[0].toLowerCase() : null;
	            } catch (e) {
	              return null;
	            }
	          };

	          let expectedSha256 = await readShaFile(`${fileInfo.sourcePath}.sha256`);
	          if (!expectedSha256) {
	            // Fall back to hashing the source file; this catches transfer corruption even without a server checksum.
	            if (transferCancelRequested) throw new Error('Transfer cancelled by user');
	            expectedSha256 = await fileService.calculateChecksum(fileInfo.sourcePath, 'sha256');
	          }

	          if (transferCancelRequested) throw new Error('Transfer cancelled by user');
	          const actualSha256 = await fileService.calculateChecksum(fileInfo.destinationPath, 'sha256');
	          if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
	            try {
	              await fs.remove(fileInfo.destinationPath);
	            } catch (e) {
	              // Ignore.
	            }
	            throw new Error(`Checksum mismatch after transfer for ${fileInfo.name}`);
	          }

	          fileInfo.verified = true;

	          // Write checksum alongside the USB file for later auditing.
	          try {
	            await fs.writeFile(`${fileInfo.destinationPath}.sha256`, `${expectedSha256}  ${fileInfo.name}\n`, 'utf8');
	          } catch (e) {
	            // Non-fatal.
	          }

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

	      // Install selected readers on the USB as part of local-first transfer.
      // This ensures local-first and direct-to-USB end with the same USB layout.
      if (Array.isArray(selectedReaders) && selectedReaders.length > 0) {
        console.log('Installing selected readers to USB:', selectedReaders);
        const readerVersions = await kiwixManager.getLatestVersions();
        for (const platform of selectedReaders) {
          if (transferCancelRequested) {
            throw new Error('Transfer cancelled by user');
          }
          windows.forEach((window) => {
            window.webContents.send(IPC_CHANNELS.TRANSFER_PROGRESS, {
              currentFile: `Installing Kiwix reader (${platform})`,
              progress: (transferredSize / totalSize) * 100,
              transferredSize,
              totalSize,
              speed: 0
	          });
            });

          try {
            const localReaderPath = readerVersions?.[platform]?.filename
              ? path.join(downloadDir, readerVersions[platform].filename)
              : null;
            await kiwixManager.installToUSB(platform, destination, null, localReaderPath);
          } catch (error) {
            console.error(`Error installing ${platform} reader:`, error);
            windows.forEach((window) => {
              window.webContents.send(IPC_CHANNELS.TRANSFER_ERROR, {
                message: `Failed to install ${platform} reader: ${error.message}`,
                filename: platform
              });
            });
            throw error;
          }
        }
      }

      await kiwixManager.refreshPortableLibraries(destination);

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

      // On user cancellation, clean up unverified destination files so no
      // corrupt or unconfirmed partial ZIM is left on the stick.
      if (transferCancelRequested && error.message === 'Transfer cancelled by user') {
        try {
          const fs = require('fs-extra');
          for (const fileInfo of fileInfos) {
            if (fileInfo.verified) continue; // fully copied AND checksum-confirmed: keep
            const destExists = await fs.pathExists(fileInfo.destinationPath);
            if (destExists) {
              await fs.remove(fileInfo.destinationPath);
              console.log(`Removed unverified file after cancel: ${fileInfo.name}`);
            }
            // Also remove a stale sidecar from any previous interrupted attempt.
            const sidecarExists = await fs.pathExists(`${fileInfo.destinationPath}.sha256`);
            if (sidecarExists) {
              await fs.remove(`${fileInfo.destinationPath}.sha256`);
              console.log(`Removed stale sidecar after cancel: ${fileInfo.name}.sha256`);
            }
          }
        } catch (cleanupError) {
          console.warn('Cleanup after transfer cancel failed:', cleanupError.message);
        }
      }

      const windows = require('electron').BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send(IPC_CHANNELS.TRANSFER_ERROR, {
          message: error.message
        });
      });
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.TRANSFER_CANCEL, async () => {
    console.log('Transfer cancellation requested');
    requestTransferCancel();
    return { success: true, cancelling: transferCancelRequested };
  });

  // ========================================
  // USB Audit / Integrity
  // ========================================

  ipcMain.handle(IPC_CHANNELS.USB_AUDIT_SCAN, async (_event, usbPath, options = {}) => {
    const windows = require('electron').BrowserWindow.getAllWindows();
    try {
      // Audit target must be a connected USB drive.
      await assertPathsInScope('USB audit', usbPath);
      const res = await usbAuditService.scan(usbPath, options, (progress) => {
        windows.forEach((window) => {
          window.webContents.send(IPC_CHANNELS.USB_AUDIT_PROGRESS, {
            usbPath,
            ...progress,
            timestamp: Date.now(),
          });
        });
      });
      return res;
    } catch (error) {
      windows.forEach((window) => {
        window.webContents.send(IPC_CHANNELS.USB_AUDIT_PROGRESS, {
          usbPath,
          phase: 'error',
          error: error.message,
          timestamp: Date.now(),
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
      if (destination) {
        await assertPathsInScope('Reader download', destination);
      }
      return await kiwixManager.downloadReader(platform, destination);
    } catch (error) {
      console.error('Error downloading Kiwix reader:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.KIWIX_INSTALL, async (event, platform, usbPath) => {
    try {
      // usbPath must be a connected USB drive (prevents traversal writes).
      await assertPathsInScope('Reader install', usbPath);
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
      await assertPathsInScope('File copy', source, destination);
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
      await assertPathsInScope('File verify', filepath);
      return await fileService.verifyChecksum(filepath, checksum);
    } catch (error) {
      console.error('Error verifying file:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_DELETE, async (event, filepath) => {
    try {
      await assertPathsInScope('File delete', filepath);
      return await fileService.deleteFile(filepath);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_GET_SIZE, async (event, filepath) => {
    try {
      await assertPathsInScope('File size check', filepath);
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
