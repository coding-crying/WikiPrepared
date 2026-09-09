const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
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

  isHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  extractSha256FromText(text) {
    if (!text) return null;
    const match = text.toString().match(/[a-fA-F0-9]{64}/);
    return match ? match[0].toLowerCase() : null;
  }

  async calculateSha256OfFile(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async writeSha256Sidecar(filePath, sha256, filename) {
    if (!sha256) return;
    const name = filename || path.basename(filePath);
    try {
      await fs.writeFile(`${filePath}.sha256`, `${sha256}  ${name}\n`, 'utf8');
    } catch (_e) {
      // Non-fatal.
    }
  }

  async fetchExpectedSha256ForUrl(url) {
    if (!this.isHttpUrl(url)) return null;

    const candidates = [
      `${url}.sha256`,      // commonly `${filename}.zim.sha256`
      `${url}.sha256sum`,
      `${url}.sha256.txt`,
    ];

    for (const checksumUrl of candidates) {
      try {
        const response = await axios.get(checksumUrl, {
          timeout: 20000,
          responseType: 'text',
          headers: { 'User-Agent': 'Kiwix-USB-Updater/0.1.0' },
          validateStatus: (status) => status >= 200 && status < 300,
        });

        const sha = this.extractSha256FromText(response.data);
        if (sha) return sha;
      } catch (e) {
        // Keep trying other candidates.
      }
    }

    return null;
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
      const { execFileSync } = require('child_process');

      let freeSpace = 0;
      let totalSpace = 0;
      let filesystem = 'unknown';

      if (os.platform() === 'win32') {
        // Windows: use wmic with PowerShell fallback (argv-style, no shell)
        const driveLetter = downloadDir.charAt(0).toUpperCase();
        try {
          const result = execFileSync('wmic', [
            'logicaldisk', 'where', `DeviceID='${driveLetter}:'`,
            'get', 'FileSystem,FreeSpace,Size', '/format:csv',
          ], { encoding: 'utf8' });
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
          try {
            const psResult = execFileSync(
              'powershell.exe',
              [
                '-NoProfile', '-NonInteractive', '-Command',
                `(Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${driveLetter}:'") | Select-Object FileSystem,FreeSpace,Size | ConvertTo-Json -Compress`,
              ],
              { encoding: 'utf8' }
            );
            const parsed = JSON.parse(psResult.trim());
            filesystem = parsed?.FileSystem || 'unknown';
            freeSpace = Number(parsed?.FreeSpace) || 0;
            totalSpace = Number(parsed?.Size) || 0;
          } catch (psError) {
            console.warn('Failed to get Windows disk info:', psError.message);
          }
        }
      } else {
        // Unix-like: use df (argv-style, no shell)
        try {
          const result = execFileSync('df', ['-P', downloadDir], { encoding: 'utf8' });
          const lines = result.trim().split('\n');
          if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            if (parts.length >= 4) {
              totalSpace = parseInt(parts[1]) * 1024; // Convert from KB
              freeSpace = parseInt(parts[3]) * 1024;
            }
          }

          // Get filesystem type
          if (os.platform() === 'darwin') {
            // macOS BSD df has no -T; use stat for filesystem type
            const statFs = execFileSync('stat', ['-f', '%T', downloadDir], { encoding: 'utf8' }).trim();
            if (statFs) filesystem = statFs;
          } else {
            const mountResult = execFileSync('df', ['-T', downloadDir], { encoding: 'utf8' });
            const mountLines = mountResult.trim().split('\n');
            if (mountLines.length >= 2) {
              const mountParts = mountLines[1].split(/\s+/);
              if (mountParts.length >= 2) {
                filesystem = mountParts[1]; // Second column is filesystem type
              }
            }
          }
        } catch (e) {
          console.warn('Failed to get Unix disk info:', e.message);
        }
      }

      // Check if filesystem supports large files (>4GB)
      const supportsLargeFiles = ['ext4', 'ext3', 'xfs', 'btrfs', 'zfs', 'ntfs', 'exfat', 'apfs', 'hfs+', 'hfs', 'hfsplus'].includes(filesystem.toLowerCase());
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
      if (!zimInfo || !zimInfo.url) {
         throw new Error('Invalid ZIM info: URL is missing');
      }

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
        dest = path.join(this.getDownloadDir(), zimInfo.filename);
      }
      
      // Check if file already exists and is complete
      let initialStatus = DOWNLOAD_STATUS.QUEUED;
      let initialProgress = 0;
      let initialDownloaded = 0;
      
      try {
         if (await fs.pathExists(dest)) {
            const stats = await fs.stat(dest);
            // If size matches (fuzzy match for now, ideally checksum)
            if (zimInfo.size && Math.abs(stats.size - zimInfo.size) < 1024) {
               const isZim = zimInfo.filename?.toLowerCase().endsWith('.zim');
               if (isZim) {
                 // Critical safeguard: queued so `startDownload` will run checksum verification before completing.
                 console.log(`File already exists and size matches: ${zimInfo.filename}. Will verify checksum before completing.`);
                 initialStatus = DOWNLOAD_STATUS.QUEUED;
                 initialProgress = 0;
                 initialDownloaded = stats.size;
               } else {
                 console.log(`File already exists and size matches: ${zimInfo.filename}. Marking as completed.`);
                 initialStatus = DOWNLOAD_STATUS.COMPLETED;
                 initialProgress = 100;
                 initialDownloaded = stats.size;
               }
            }
         }
      } catch (err) {
         console.warn('Error checking existing file:', err);
      }

      const download = {
        id: downloadId,
        url: zimInfo.url,
        filename: zimInfo.filename,
        destination: dest,
        zimInfo,
        status: initialStatus,
        totalSize: zimInfo.size || 0,
        downloadedSize: initialDownloaded,
        progress: initialProgress,
        speed: 0,
        eta: 0,
        error: null,
        startTime: initialStatus === DOWNLOAD_STATUS.COMPLETED ? Date.now() : null,
        endTime: initialStatus === DOWNLOAD_STATUS.COMPLETED ? Date.now() : null,
        cancelToken: null,
      };

      this.downloads.set(downloadId, download);

      console.log(`Added download to queue: ${zimInfo.filename} (Status: ${initialStatus})`);

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

    // Idempotency check: If already downloading or completed, return existing download
    if (download.status === DOWNLOAD_STATUS.DOWNLOADING || download.status === DOWNLOAD_STATUS.COMPLETED) {
      console.log(`Download ${download.filename} is already ${download.status}, skipping start.`);
      
      // If completed, ensure we emit the progress event so listeners (renderer) know it's done
      if (download.status === DOWNLOAD_STATUS.COMPLETED) {
        this.emitProgress(downloadId);
      }
      
      return download;
    }

    try {
      // If a ZIM already exists at destination with the expected size, verify it instead of downloading again.
      if (download.filename?.toLowerCase().endsWith('.zim')) {
        if (await fs.pathExists(download.destination)) {
          const stats = await fs.stat(download.destination);
          const expectedSize = download.zimInfo?.size || download.totalSize || 0;

          if (expectedSize > 0 && Math.abs(stats.size - expectedSize) < 1024) {
            let expectedSha256 = download.zimInfo?.sha256 || null;
            if (!expectedSha256) {
              expectedSha256 = await this.fetchExpectedSha256ForUrl(download.url);
              if (expectedSha256 && download.zimInfo) {
                download.zimInfo.sha256 = expectedSha256;
              }
            }

            download.status = DOWNLOAD_STATUS.VERIFYING;
            download.startTime = download.startTime || Date.now();
            download.downloadedSize = stats.size;
            download.totalSize = expectedSize || stats.size;
            download.progress = 100;
            this.emitProgress(downloadId);

            if (expectedSha256) {
              await this.writeSha256Sidecar(download.destination, expectedSha256, download.filename);
              const isValid = await this.verifyDownload(downloadId, expectedSha256);
              if (!isValid) {
                // Delete the bad file so a subsequent retry can re-download.
                try {
                  await fs.remove(download.destination);
                } catch (_e) {
                  // Ignore.
                }
                throw new Error('Checksum verification failed');
              }
            } else {
              // No server checksum available. Create a local baseline sidecar so future audits can detect bit-rot,
              // and mark this download as "unverified against server".
              const localSha = await this.calculateSha256OfFile(download.destination);
              await this.writeSha256Sidecar(download.destination, localSha, download.filename);
              download.warning = 'No server SHA-256 available; created a local checksum baseline (.sha256).';
            }

            download.status = DOWNLOAD_STATUS.COMPLETED;
            download.endTime = Date.now();
            download.progress = 100;
            this.emitProgress(downloadId);
            return download;
          }
        }
      }

      download.status = DOWNLOAD_STATUS.DOWNLOADING;
      download.startTime = Date.now();
      download.error = null;
      download.warning = null;

      // Create cancel token
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      download.cancelToken = source;

      console.log(`Starting download: ${download.filename}`);

      // Try to fetch an expected checksum up-front so we know whether we can verify against the server.
      let expectedSha256 = null;
      const isZim = download.filename?.toLowerCase().endsWith('.zim');
      if (isZim) {
        expectedSha256 = download.zimInfo?.sha256 || null;
        if (!expectedSha256) {
          expectedSha256 = await this.fetchExpectedSha256ForUrl(download.url);
          if (expectedSha256 && download.zimInfo) {
            download.zimInfo.sha256 = expectedSha256;
          }
        }
      }

      // Ensure destination directory exists
      // Only try to create if it doesn't exist to avoid EACCES on mount points
      const dir = path.dirname(download.destination);
      if (!(await fs.pathExists(dir))) {
          await fs.ensureDir(dir);
      }

      // Disk-space pre-check: refuse to start when free space is obviously
      // insufficient (only possible when we know both the target size and
      // the volume's free space via statfs).
      const expectedSize = download.zimInfo?.size || download.totalSize || 0;
      try {
        if (expectedSize > 0) {
          const stats = await fs.promises.statfs(dir);
          const freeBytes = stats.bsize * stats.bavail;
          if (freeBytes > 0 && freeBytes < expectedSize * 1.05) {
            const needGB = (expectedSize / 1024 ** 3).toFixed(1);
            const freeGB = (freeBytes / 1024 ** 3).toFixed(1);
            throw new Error(`Not enough disk space to download ${download.filename}: need ~${needGB} GB, only ${freeGB} GB free.`);
          }
        }
      } catch (spaceError) {
        // Re-throw our own "not enough space" error; ignore statfs failures
        // (unsupported filesystems, permission issues) — the download can
        // still proceed and will fail naturally if the disk fills.
        if (spaceError.message && spaceError.message.startsWith('Not enough disk space')) {
          throw spaceError;
        }
        console.warn('Could not check free disk space before download:', spaceError.message);
      }

      // HTTP Range resume: if a partial file exists and the server supports
      // ranges, append from where we left off instead of restarting at 0.
      let resumeFrom = 0;
      let canResume = false;
      try {
        if (await fs.pathExists(download.destination)) {
          const partialStats = await fs.stat(download.destination);
          if (partialStats.size > 0) {
            const headResponse = await axios({
              method: 'head',
              url: download.url,
              timeout: 15000,
              headers: { 'User-Agent': 'Kiwix-USB-Updater/0.1.0' },
            });
            const acceptsRanges = String(headResponse.headers['accept-ranges'] || '').toLowerCase() === 'bytes';
            const remoteLength = parseInt(headResponse.headers['content-length'], 10);
            const remoteSizeKnown = Number.isFinite(remoteLength) && remoteLength > 0;
            const localIsPartial = !remoteSizeKnown || partialStats.size < remoteLength;

            if (acceptsRanges && localIsPartial) {
              resumeFrom = partialStats.size;
              canResume = true;
              console.log(`Resuming ${download.filename} from byte ${resumeFrom}`);
            } else if (!localIsPartial && download.filename?.toLowerCase().endsWith('.zim')) {
              // File looks complete — fall through to normal flow; the
              // size-match verify path at the top of startDownload will
              // have already handled this on the next call.
              console.log(`Partial file is already full size; restarting verification flow.`);
            } else {
              // Server does not support ranges (or file is complete for a
              // non-zim): start fresh.
              resumeFrom = 0;
            }
          }
        }
      } catch (resumeProbeError) {
        console.warn('Resume probe failed, starting fresh:', resumeProbeError.message);
        resumeFrom = 0;
        canResume = false;
      }

      // Create write stream (append when resuming, truncate otherwise)
      let writer = fs.createWriteStream(download.destination, {
        flags: canResume ? 'a' : 'w',
      });

      // Make HTTP request
      const requestHeaders = {
        'User-Agent': 'Kiwix-USB-Updater/0.1.0',
      };
      if (canResume && resumeFrom > 0) {
        requestHeaders['Range'] = `bytes=${resumeFrom}-`;
      }

      const response = await axios({
        method: 'get',
        url: download.url,
        responseType: 'stream',
        cancelToken: source.token,
        timeout: 30000,
        headers: requestHeaders,
      });

      // If the server ignored our Range request and returns 200 instead of
      // 206, we must not append duplicate bytes — truncate and restart.
      if (canResume && response.status !== 206) {
        console.warn(`Server ignored Range request (status ${response.status}); restarting download from scratch.`);
        await new Promise((resolve) => {
          writer.once('close', resolve);
          writer.destroy();
        });
        writer = fs.createWriteStream(download.destination, { flags: 'w' });
        canResume = false;
        resumeFrom = 0;
      }

      // Get total size from headers
      const totalSize = parseInt(response.headers['content-length'], 10);
      // For resumed downloads the stream only delivers the remaining bytes;
      // progress must be computed against the full file size.
      const remainingLength = Number.isFinite(totalSize) ? totalSize : 0;
      const totalFileBytes = canResume ? resumeFrom + remainingLength : remainingLength;
      if (Number.isFinite(totalFileBytes) && totalFileBytes > 0) {
        download.totalSize = totalFileBytes;
      }

      // Set up progress tracking
      const progress = progressStream({
        length: remainingLength > 0 ? remainingLength : undefined,
        time: 1000, // Update every second
      });

      // If there is no server checksum, hash the downloaded bytes and then verify the file on disk matches.
      // NOTE: when resuming, the hash starts from the resumed byte — we cannot
      // stream-hash an append, so resume downloads skip inline hashing and rely
      // on post-download verification (expectedSha256 or size match).
      const downloadHash = (!expectedSha256 && isZim && !canResume) ? crypto.createHash('sha256') : null;
      if (downloadHash) {
        progress.on('data', (chunk) => {
          try {
            downloadHash.update(chunk);
          } catch (_e) {
            // ignore
          }
        });
      }

      const alreadyDownloaded = canResume ? resumeFrom : 0;
      progress.on('progress', (progressInfo) => {
        download.downloadedSize = alreadyDownloaded + progressInfo.transferred;
        download.progress = totalFileBytes > 0
          ? Math.min(100, (download.downloadedSize / totalFileBytes) * 100)
          : progressInfo.percentage;
        download.speed = progressInfo.speed;
        download.eta = progressInfo.eta;

        // Call progress callback
        this.emitProgress(downloadId);
      });

      // Pipe the download
      response.data.pipe(progress).pipe(writer);

      // Wait for completion (listen on ALL streams in the chain — a missing
      // error listener on the intermediate progress stream causes silent hangs)
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
        progress.on('error', reject);
      });

      // Automatic SHA-256 verification for ZIM downloads (critical safeguard).
      if (isZim) {
        download.status = DOWNLOAD_STATUS.VERIFYING;
        this.emitProgress(downloadId);

        if (expectedSha256) {
          await this.writeSha256Sidecar(download.destination, expectedSha256, download.filename);

          const isValid = await this.verifyDownload(downloadId, expectedSha256);
          if (!isValid) {
            throw new Error('Checksum verification failed');
          }
        } else {
          // No server checksum: verify that the file written to disk matches what we downloaded.
          const downloadedSha256 = downloadHash ? downloadHash.digest('hex') : null;
          if (!downloadedSha256) {
            // This shouldn't happen, but don't fail a completed download just because we couldn't compute the hash.
            download.warning = 'No server SHA-256 available; download completed without verification.';
          } else {
            await this.writeSha256Sidecar(download.destination, downloadedSha256, download.filename);
            const isValid = await this.verifyDownload(downloadId, downloadedSha256);
            if (!isValid) {
              throw new Error('Downloaded file did not match bytes written to disk');
            }
            download.warning = 'No server SHA-256 available; verified against the downloaded bytes and wrote .sha256 baseline.';
          }
        }
      }

      // Download completed
      download.status = DOWNLOAD_STATUS.COMPLETED;
      download.endTime = Date.now();
      download.progress = 100;

      console.log(`Download completed: ${download.filename}`);

      this.emitProgress(downloadId);

      return download;
    } catch (error) {
      console.error(`Download failed: ${download.filename}`, error);

      // Release the write stream so the fd isn't held during cleanup.
      try {
        if (typeof writer !== 'undefined' && writer && !writer.destroyed) {
          writer.destroy();
        }
      } catch (_e) {
        // ignore
      }

      if (axios.isCancel(error)) {
        const cancelMessage = String(error?.message || '');
        if (cancelMessage.includes('paused')) {
          // Pause: keep the partial file so resume can continue from it.
          download.status = DOWNLOAD_STATUS.PAUSED;
          download.error = 'Download paused';
        } else {
          download.status = DOWNLOAD_STATUS.CANCELLED;
          download.error = 'Download cancelled';
          // Remove the partial file entirely.
          try {
            if (await fs.pathExists(download.destination)) {
              await fs.remove(download.destination);
            }
          } catch (_e) {
            // ignore
          }
        }
      } else {
        download.status = DOWNLOAD_STATUS.ERROR;
        download.error = error.message;
        // Keep the partial file: resume can continue from it via HTTP Range
        // instead of throwing away gigabytes. (Wipe it via Cancel or
        // Clear Cache if the user wants the space back.)
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

    const resumable = download.status === DOWNLOAD_STATUS.PAUSED ||
                      download.status === DOWNLOAD_STATUS.ERROR;
    if (!resumable) {
      throw new Error('Download is not paused or errored');
    }

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
   * Clear the entire download cache directory and reset internal state
   * @returns {Promise<void>}
   */
  async clearDownloadCache() {
    try {
      const downloadDir = this.getDownloadDir();
      console.log('Clearing download cache at:', downloadDir);
      
      // Cancel any active downloads first
      await this.cancelAllDownloads();
      
      // Empty the directory
      await fs.emptyDir(downloadDir);
      
      // Reset state
      this.downloads.clear();
      this.progressCallbacks.clear();
      
      console.log('Download cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear download cache:', error);
      throw error;
    }
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
        warning: download.warning || null,
      });
    }
  }

  /**
   * Verify download integrity using SHA256 checksum
   * @param {string} downloadId - Download ID
   * @param {string} expectedChecksum - Expected SHA256 checksum
   * @returns {Promise<boolean>} True if valid
   */
  async verifyDownload(downloadId, expectedChecksum) {
    const download = this.downloads.get(downloadId);

    if (!download) {
      throw new Error('Download not found');
    }
    
    if (!expectedChecksum) {
       console.warn(`No checksum provided for verification of ${download.filename}`);
       return true; // Skip verification if no checksum
    }

    console.log(`Verifying checksum for ${download.filename}...`);
    
    try {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(download.destination);
            let verifiedBytes = 0;
            let lastEmit = Date.now();
            
            stream.on('data', (data) => {
              hash.update(data);
              verifiedBytes += data.length;

              // Emit occasional progress updates so the UI stays alive.
              if (Date.now() - lastEmit > 1000) {
                lastEmit = Date.now();
                download.status = DOWNLOAD_STATUS.VERIFYING;
                // Keep downloadedSize/progress intact; renderer treats VERIFYING as indeterminate.
                this.emitProgress(downloadId);
              }
            });
            stream.on('end', () => {
                const fileHash = hash.digest('hex');
                console.log(`Checksum result for ${download.filename}: ${fileHash} (expected ${expectedChecksum})`);
                
                if (fileHash.toLowerCase() === expectedChecksum.toLowerCase()) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            stream.on('error', (err) => {
                 console.error('Error reading file for checksum:', err);
                 reject(err);
            });
        });
    } catch (error) {
        console.error('Verification error:', error);
        throw error;
    }
  }
}

module.exports = DownloadManager;
