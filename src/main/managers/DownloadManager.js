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

    // Default download directory
    this.defaultDownloadDir = path.join(app.getPath('temp'), 'kiwix-downloads');
    fs.ensureDirSync(this.defaultDownloadDir);
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
      const dest = destination || path.join(this.defaultDownloadDir, zimInfo.filename);

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
   * Get all downloads
   * @returns {Array} Array of download objects
   */
  getAllDownloads() {
    return Array.from(this.downloads.values());
  }

  /**
   * Get a specific download
   * @param {string} downloadId - Download ID
   * @returns {Object} Download object
   */
  getDownload(downloadId) {
    return this.downloads.get(downloadId);
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
