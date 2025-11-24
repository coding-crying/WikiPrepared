const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const progressStream = require('progress-stream');
const { app } = require('electron');
const { DOWNLOAD_STATUS } = require('../../shared/constants');

/**
 * DownloadManager - Handles file downloads with progress tracking
 */
class DownloadManager {
  constructor() {
    this.downloads = new Map(); // downloadId -> download object
    this.progressCallbacks = new Map(); // downloadId -> callback function
    this.activeDownloads = 0;
    this.maxConcurrentDownloads = 2;

    // Default download directory - use persistent userData location instead of temp
    this.defaultDownloadDir = path.join(app.getPath('userData'), 'downloads');
    fs.ensureDirSync(this.defaultDownloadDir);

    // User-configurable download location
    this.customDownloadDir = null;
  }

  /**
   * Get the current download directory
   * @returns {string} Download directory path
   */
  getDownloadDir() {
    return this.customDownloadDir || this.defaultDownloadDir;
  }

  /**
   * Set a custom download directory
   * @param {string} dir - Directory path
   */
  setDownloadDir(dir) {
    if (dir) {
      fs.ensureDirSync(dir);
      this.customDownloadDir = dir;
    } else {
      this.customDownloadDir = null;
    }
  }

  /**
   * Get local disk info for download location
   * @returns {Promise<Object>} Disk info including free space and filesystem
   */
  async getLocalDiskInfo() {
    const downloadDir = this.getDownloadDir();

    try {
      // Get disk usage using df command on Unix or wmic on Windows
      const os = require('os');
      const { execSync } = require('child_process');

      let freeSpace = 0;
      let totalSpace = 0;
      let filesystem = 'unknown';

      if (os.platform() === 'win32') {
        // Windows: use wmic
        const driveLetter = downloadDir.charAt(0).toUpperCase();
        try {
          const result = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get FileSystem,FreeSpace,Size /format:csv`, { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          if (lines.length >= 2) {
            const parts = lines[1].split(',');
            if (parts.length >= 4) {
              filesystem = parts[1] || 'unknown';
              freeSpace = parseInt(parts[2]) || 0;
              totalSpace = parseInt(parts[3]) || 0;
            }
          }
        } catch (e) {
          console.warn('Failed to get Windows disk info:', e.message);
        }
      } else {
        // Unix-like: use df
        try {
          const result = execSync(`df -P "${downloadDir}"`, { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 4) {
              totalSpace = parseInt(parts[1]) * 1024; // Convert from KB
              freeSpace = parseInt(parts[3]) * 1024;
            }
          }

          // Get filesystem type
          const mountResult = execSync(`df -T "${downloadDir}" 2>/dev/null || df "${downloadDir}"`, { encoding: 'utf8' });
          const mountLines = mountResult.trim().split('\n');
          if (mountLines.length >= 2) {
            const mountParts = mountLines[1].split(/\s+/);
            if (mountParts.length >= 2) {
              filesystem = mountParts[1]; // Second column is filesystem type
            }
          }
        } catch (e) {
          console.warn('Failed to get Unix disk info:', e.message);
        }
      }

      // Check if filesystem supports large files (>4GB)
      const supportsLargeFiles = ['ext4', 'ext3', 'xfs', 'btrfs', 'zfs', 'ntfs', 'exfat', 'apfs', 'hfs+'].includes(filesystem.toLowerCase());
      const maxFileSize = filesystem.toLowerCase() === 'fat32' ? 4 * 1024 * 1024 * 1024 : Number.MAX_SAFE_INTEGER;

      return {
        path: downloadDir,
        freeSpace,
        totalSpace,
        filesystem,
        supportsLargeFiles,
        maxFileSize
      };
    } catch (error) {
      console.error('Error getting local disk info:', error);
      return {
        path: downloadDir,
        freeSpace: 500 * 1024 * 1024 * 1024, // Fallback: 500GB
        totalSpace: 1000 * 1024 * 1024 * 1024,
        filesystem: 'unknown',
        supportsLargeFiles: true,
        maxFileSize: Number.MAX_SAFE_INTEGER
      };
    }
  }

  /**
   * Add a download to the queue
   * @param {Object} zimInfo - ZIM file information
   * @param {string} destination - Destination path (optional)
   * @returns {Promise<Object>} Download object with ID
   */
  async addToQueue(zimInfo, destination = null) {
    try {
      const downloadId = uuidv4();
      // Determine destination path
      let dest;
      if (destination) {
        // Check if destination is an existing directory
        let isDirectory = false;
        try {
          const stats = await fs.stat(destination);
          isDirectory = stats.isDirectory();
        } catch (e) {
          // Path doesn't exist - check if it looks like a directory path (no .zim extension)
          isDirectory = !destination.toLowerCase().endsWith('.zim');
        }
        dest = isDirectory ? path.join(destination, zimInfo.filename) : destination;
        console.log(`Download destination: ${dest} (directory: ${isDirectory})`);
      } else {
        dest = path.join(this.defaultDownloadDir, zimInfo.filename);
      }

      const download = {
        id: downloadId,
        url: zimInfo.url,
        filename: zimInfo.filename,
        destination: dest,
        zimInfo,
        status: DOWNLOAD_STATUS.QUEUED,
        totalSize: zimInfo.size || 0,
        downloadedSize: 0,
        progress: 0,
        speed: 0,
        eta: 0,
        error: null,
        startTime: null,
        endTime: null,
        cancelToken: null,
      };

      this.downloads.set(downloadId, download);

      console.log(`Added download to queue: ${zimInfo.filename}`);

      return download;
    } catch (error) {
      console.error('Error adding download to queue:', error);
      throw error;
    }
  }

  /**
   * Start a download
   * @param {string} downloadId - Download ID
   * @returns {Promise<Object>} Download result
   */
  async startDownload(downloadId) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }

    if (download.status === DOWNLOAD_STATUS.DOWNLOADING) {
      throw new Error('Download already in progress');
    }

    try {
      download.status = DOWNLOAD_STATUS.DOWNLOADING;
      download.startTime = Date.now();
      download.error = null;

      // Create cancel token
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      download.cancelToken = source;

      console.log(`Starting download: ${download.filename}`);

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(download.destination));

      // Create write stream
      const writer = fs.createWriteStream(download.destination);

      // Make HTTP request
      const response = await axios({
        method: 'get',
        url: download.url,
        responseType: 'stream',
        cancelToken: source.token,
        timeout: 30000,
        headers: {
          'User-Agent': 'Kiwix-USB-Updater/0.1.0',
        },
      });

      // Get total size from headers
      const totalSize = parseInt(response.headers['content-length'], 10);
      download.totalSize = totalSize;

      // Set up progress tracking
      const progress = progressStream({
        length: totalSize,
        time: 1000, // Update every second
      });

      progress.on('progress', (progressInfo) => {
        download.downloadedSize = progressInfo.transferred;
        download.progress = progressInfo.percentage;
        download.speed = progressInfo.speed;
        download.eta = progressInfo.eta;

        // Call progress callback
        this.emitProgress(downloadId);
      });

      // Pipe the download
      response.data.pipe(progress).pipe(writer);

      // Wait for completion
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      // Download completed
      download.status = DOWNLOAD_STATUS.COMPLETED;
      download.endTime = Date.now();
      download.progress = 100;

      console.log(`Download completed: ${download.filename}`);

      this.emitProgress(downloadId);

      return download;
    } catch (error) {
      console.error(`Download failed: ${download.filename}`, error);

      if (axios.isCancel(error)) {
        download.status = DOWNLOAD_STATUS.CANCELLED;
        download.error = 'Download cancelled';
      } else {
        download.status = DOWNLOAD_STATUS.ERROR;
        download.error = error.message;
      }

      this.emitProgress(downloadId);

      throw error;
    }
  }

  /**
   * Pause a download
   * @param {string} downloadId - Download ID
   * @returns {Promise<Object>} Download object
   */
  async pauseDownload(downloadId) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }

    if (download.status !== DOWNLOAD_STATUS.DOWNLOADING) {
      throw new Error('Download is not in progress');
    }

    // Cancel the request
    if (download.cancelToken) {
      download.cancelToken.cancel('Download paused by user');
    }

    download.status = DOWNLOAD_STATUS.PAUSED;

    console.log(`Download paused: ${download.filename}`);

    return download;
  }

  /**
   * Resume a paused download
   * @param {string} downloadId - Download ID
   * @returns {Promise<Object>} Download object
   */
  async resumeDownload(downloadId) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }

    if (download.status !== DOWNLOAD_STATUS.PAUSED) {
      throw new Error('Download is not paused');
    }

    // Note: Full resume support would require HTTP range requests
    // For now, we'll restart the download
    console.log(`Resuming download: ${download.filename}`);

    return await this.startDownload(downloadId);
  }

  /**
   * Cancel a download
   * @param {string} downloadId - Download ID
   * @returns {Promise<Object>} Download object
   */
  async cancelDownload(downloadId) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }

    // Cancel the request
    if (download.cancelToken) {
      download.cancelToken.cancel('Download cancelled by user');
    }

    download.status = DOWNLOAD_STATUS.CANCELLED;

    // Clean up partial download
    try {
      if (await fs.pathExists(download.destination)) {
        await fs.remove(download.destination);
      }
    } catch (error) {
      console.error('Error cleaning up cancelled download:', error);
    }

    console.log(`Download cancelled: ${download.filename}`);

    return download;
  }

  /**
   * Remove a download from the list
   * @param {string} downloadId - Download ID
   */
  removeDownload(downloadId) {
    this.downloads.delete(downloadId);
    this.progressCallbacks.delete(downloadId);
  }

  /**
   * Serialize a download object for IPC (removes non-serializable properties)
   * @param {Object} download - Download object
   * @returns {Object} Serializable download object
   */
  serializeDownload(download) {
    if (!download) return null;

    return {
      id: download.id,
      url: download.url,
      filename: download.filename,
      destination: download.destination,
      zimInfo: download.zimInfo,
      status: download.status,
      totalSize: download.totalSize,
      downloadedSize: download.downloadedSize,
      progress: download.progress,
      speed: download.speed,
      eta: download.eta,
      error: download.error,
      startTime: download.startTime,
      endTime: download.endTime,
      // Exclude: cancelToken (not serializable)
    };
  }

  /**
   * Get all downloads
   * @returns {Array} Array of download objects
   */
  getAllDownloads() {
    return Array.from(this.downloads.values()).map(d => this.serializeDownload(d));
  }

  /**
   * Get a specific download
   * @param {string} downloadId - Download ID
   * @returns {Object} Download object
   */
  getDownload(downloadId) {
    return this.serializeDownload(this.downloads.get(downloadId));
  }

  /**
   * Start all queued downloads
   * @returns {Promise<Array>} Array of started downloads
   */
  async startAllDownloads() {
    // Get raw downloads to access status
    const allDownloads = Array.from(this.downloads.values());
    const queuedDownloads = allDownloads.filter(
      d => d.status === DOWNLOAD_STATUS.QUEUED
    );

    console.log(`Starting ${queuedDownloads.length} queued downloads`);

    const results = [];
    for (const download of queuedDownloads) {
      try {
        const result = await this.startDownload(download.id);
        results.push(this.serializeDownload(result));
      } catch (error) {
        console.error(`Failed to start download ${download.filename}:`, error);
        results.push({ id: download.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Pause all active downloads
   * @returns {Promise<Array>} Array of paused downloads
   */
  async pauseAllDownloads() {
    // Get raw downloads to access status
    const allDownloads = Array.from(this.downloads.values());
    const activeDownloads = allDownloads.filter(
      d => d.status === DOWNLOAD_STATUS.DOWNLOADING
    );

    console.log(`Pausing ${activeDownloads.length} active downloads`);

    const results = [];
    for (const download of activeDownloads) {
      try {
        const result = await this.pauseDownload(download.id);
        results.push(this.serializeDownload(result));
      } catch (error) {
        console.error(`Failed to pause download ${download.filename}:`, error);
        results.push({ id: download.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Resume all paused downloads
   * @returns {Promise<Array>} Array of resumed downloads
   */
  async resumeAllDownloads() {
    // Get raw downloads to access status
    const allDownloads = Array.from(this.downloads.values());
    const pausedDownloads = allDownloads.filter(
      d => d.status === DOWNLOAD_STATUS.PAUSED
    );

    console.log(`Resuming ${pausedDownloads.length} paused downloads`);

    const results = [];
    for (const download of pausedDownloads) {
      try {
        const result = await this.resumeDownload(download.id);
        results.push(this.serializeDownload(result));
      } catch (error) {
        console.error(`Failed to resume download ${download.filename}:`, error);
        results.push({ id: download.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Cancel all downloads (active, paused, or queued)
   * @returns {Promise<Array>} Array of cancelled downloads
   */
  async cancelAllDownloads() {
    // Get raw downloads to access status
    const allDownloads = Array.from(this.downloads.values());
    const downloadsToCancel = allDownloads.filter(
      d => d.status === DOWNLOAD_STATUS.DOWNLOADING ||
           d.status === DOWNLOAD_STATUS.PAUSED ||
           d.status === DOWNLOAD_STATUS.QUEUED
    );

    console.log(`Cancelling ${downloadsToCancel.length} downloads`);

    const results = [];
    for (const download of downloadsToCancel) {
      try {
        const result = await this.cancelDownload(download.id);
        results.push(this.serializeDownload(result));
      } catch (error) {
        console.error(`Failed to cancel download ${download.filename}:`, error);
        results.push({ id: download.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Register a progress callback for a download
   * @param {string} downloadId - Download ID
   * @param {Function} callback - Callback function
   */
  onProgress(downloadId, callback) {
    this.progressCallbacks.set(downloadId, callback);
  }

  /**
   * Emit progress for a download
   * @param {string} downloadId - Download ID
   */
  emitProgress(downloadId) {
    const download = this.downloads.get(downloadId);
    const callback = this.progressCallbacks.get(downloadId);

    if (download && callback) {
      callback({
        id: download.id,
        filename: download.filename,
        status: download.status,
        progress: download.progress,
        downloadedSize: download.downloadedSize,
        totalSize: download.totalSize,
        speed: download.speed,
        eta: download.eta,
        error: download.error,
      });
    }
  }

  /**
   * Verify download integrity (placeholder for checksum verification)
   * @param {string} downloadId - Download ID
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<boolean>} True if valid
   */
  async verifyDownload(downloadId, expectedChecksum) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }

    // TODO: Implement checksum verification
    console.log('Checksum verification not yet implemented');

    return true;
  }
}

module.exports = DownloadManager;
