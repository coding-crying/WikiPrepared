const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');
const { KIWIX_PLATFORMS, URLS } = require('../../shared/constants');

/**
 * KiwixManager - Handles Kiwix reader downloads and installation with caching
 */
class KiwixManager {
  constructor() {
    this.versions = {
      [KIWIX_PLATFORMS.WINDOWS]: null,
      [KIWIX_PLATFORMS.LINUX]: null,
      [KIWIX_PLATFORMS.MAC]: null,
    };

    // Cache directory for downloaded readers
    this.cacheDir = path.join(app.getPath('userData'), 'kiwix-cache');
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir() {
    try {
      await fs.ensureDir(this.cacheDir);
      console.log('Kiwix cache directory:', this.cacheDir);
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Get cache file path for a platform version
   */
  getCachePath(platform, filename) {
    return path.join(this.cacheDir, platform, filename);
  }

  /**
   * Check if a cached version exists
   */
  async getCachedReader(platform, filename) {
    const cachePath = this.getCachePath(platform, filename);
    try {
      if (await fs.pathExists(cachePath)) {
        const stats = await fs.stat(cachePath);
        return {
          exists: true,
          path: cachePath,
          size: stats.size,
          modifiedTime: stats.mtime
        };
      }
    } catch (error) {
      console.error('Error checking cache:', error);
    }
    return { exists: false };
  }

  /**
   * Get cache info for all platforms
   */
  async getCacheInfo() {
    const versions = await this.getLatestVersions();
    const cacheInfo = {};

    for (const [platform, versionInfo] of Object.entries(versions)) {
      const cached = await this.getCachedReader(platform, versionInfo.filename);
      cacheInfo[platform] = {
        ...versionInfo,
        cached: cached.exists,
        cachePath: cached.exists ? cached.path : null,
        cacheSize: cached.exists ? cached.size : 0
      };
    }

    return cacheInfo;
  }

  /**
   * Clear cache for a specific platform or all platforms
   */
  async clearCache(platform = null) {
    try {
      if (platform) {
        const platformCacheDir = path.join(this.cacheDir, platform);
        if (await fs.pathExists(platformCacheDir)) {
          await fs.remove(platformCacheDir);
          console.log(`Cleared cache for ${platform}`);
        }
      } else {
        await fs.emptyDir(this.cacheDir);
        console.log('Cleared all Kiwix cache');
      }
      return { success: true };
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get total cache size
   */
  async getCacheSize() {
    try {
      let totalSize = 0;
      const platforms = Object.values(KIWIX_PLATFORMS);

      for (const platform of platforms) {
        const platformDir = path.join(this.cacheDir, platform);
        if (await fs.pathExists(platformDir)) {
          const files = await fs.readdir(platformDir);
          for (const file of files) {
            const stats = await fs.stat(path.join(platformDir, file));
            totalSize += stats.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Get latest Kiwix reader versions for all platforms
   * @returns {Promise<Object>} Version information
   */
  async getLatestVersions() {
    try {
      // Note: This is a placeholder implementation
      // In a real implementation, you would scrape or fetch from Kiwix API
      console.log('Fetching latest Kiwix versions...');

      return {
        [KIWIX_PLATFORMS.WINDOWS]: {
          version: '3.3.0',
          url: 'https://download.kiwix.org/release/kiwix-desktop/kiwix-desktop_windows_x64_3.3.0.zip',
          filename: 'kiwix-desktop_windows_x64_3.3.0.zip',
          size: 85000000, // ~85MB
          releaseDate: '2023-10-15',
        },
        [KIWIX_PLATFORMS.LINUX]: {
          version: '3.3.0',
          url: 'https://download.kiwix.org/release/kiwix-desktop/kiwix-desktop_x86_64_3.3.0.appimage',
          filename: 'kiwix-desktop_x86_64_3.3.0.appimage',
          size: 90000000, // ~90MB
          releaseDate: '2023-10-15',
        },
        [KIWIX_PLATFORMS.MAC]: {
          version: '3.3.0',
          url: 'https://download.kiwix.org/release/kiwix-desktop/kiwix-desktop_macos_3.3.0.dmg',
          filename: 'kiwix-desktop_macos_3.3.0.dmg',
          size: 95000000, // ~95MB
          releaseDate: '2023-10-15',
        },
      };
    } catch (error) {
      console.error('Error fetching Kiwix versions:', error);
      throw error;
    }
  }

  /**
   * Download Kiwix reader for a specific platform (with caching)
   * @param {string} platform - Platform (windows, linux, mac)
   * @param {string} destination - Destination path (optional, uses cache if not provided)
   * @param {function} onProgress - Progress callback
   * @returns {Promise<Object>} Download result
   */
  async downloadReader(platform, destination = null, onProgress = null) {
    try {
      if (!Object.values(KIWIX_PLATFORMS).includes(platform)) {
        throw new Error(`Invalid platform: ${platform}`);
      }

      const versions = await this.getLatestVersions();
      const versionInfo = versions[platform];

      if (!versionInfo) {
        throw new Error(`No version found for platform: ${platform}`);
      }

      // Check cache first
      const cached = await this.getCachedReader(platform, versionInfo.filename);

      if (cached.exists) {
        console.log(`Using cached Kiwix reader for ${platform}: ${cached.path}`);

        // If destination provided, copy from cache
        if (destination) {
          const destPath = path.join(destination, versionInfo.filename);
          await fs.copy(cached.path, destPath);
          return {
            success: true,
            path: destPath,
            version: versionInfo.version,
            fromCache: true
          };
        }

        return {
          success: true,
          path: cached.path,
          version: versionInfo.version,
          fromCache: true
        };
      }

      console.log(`Downloading Kiwix reader for ${platform}...`);

      // Download to cache
      const platformCacheDir = path.join(this.cacheDir, platform);
      await fs.ensureDir(platformCacheDir);
      const cachePath = path.join(platformCacheDir, versionInfo.filename);

      // Download the file with progress
      const response = await axios({
        method: 'get',
        url: versionInfo.url,
        responseType: 'stream',
        timeout: 300000, // 5 min timeout for large files
        headers: {
          'User-Agent': 'WikiPrepared/1.0.0',
        },
      });

      const totalSize = parseInt(response.headers['content-length'], 10) || versionInfo.size;
      let downloadedSize = 0;

      const writer = fs.createWriteStream(cachePath);

      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (onProgress) {
          onProgress({
            platform,
            downloadedSize,
            totalSize,
            progress: (downloadedSize / totalSize) * 100
          });
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`Downloaded and cached Kiwix reader: ${cachePath}`);

      // If destination provided, copy from cache
      if (destination) {
        const destPath = path.join(destination, versionInfo.filename);
        await fs.copy(cachePath, destPath);
        return {
          success: true,
          path: destPath,
          cachePath: cachePath,
          version: versionInfo.version,
          fromCache: false
        };
      }

      return {
        success: true,
        path: cachePath,
        version: versionInfo.version,
        fromCache: false
      };
    } catch (error) {
      console.error('Error downloading Kiwix reader:', error);
      throw error;
    }
  }

  /**
   * Install Kiwix reader to USB drive (uses cache)
   * @param {string} platform - Platform (windows, linux, mac)
   * @param {string} usbPath - USB drive path
   * @param {function} onProgress - Progress callback
   * @returns {Promise<Object>} Installation result
   */
  async installToUSB(platform, usbPath, onProgress = null) {
    try {
      console.log(`Installing Kiwix reader for ${platform} to ${usbPath}...`);

      const versions = await this.getLatestVersions();
      const versionInfo = versions[platform];

      if (!versionInfo) {
        throw new Error(`No version found for platform: ${platform}`);
      }

      // Download (will use cache if available)
      const downloadResult = await this.downloadReader(platform, null, onProgress);

      // Create Kiwix directory on USB
      const kiwixDir = path.join(usbPath, 'kiwix', platform);
      await fs.ensureDir(kiwixDir);

      // Copy from cache to USB
      const targetPath = path.join(kiwixDir, versionInfo.filename);
      await fs.copy(downloadResult.path, targetPath);

      // Create .portable file for portable mode
      const portableFile = path.join(kiwixDir, '.portable');
      await fs.writeFile(portableFile, '');

      console.log(`Installed Kiwix reader to: ${kiwixDir}`);

      return {
        success: true,
        installPath: kiwixDir,
        version: versionInfo.version,
        platform,
        fromCache: downloadResult.fromCache
      };
    } catch (error) {
      console.error('Error installing Kiwix reader:', error);
      throw error;
    }
  }

  /**
   * Detect installed Kiwix readers on a USB drive
   * @param {string} usbPath - USB drive path
   * @returns {Promise<Array>} Array of detected readers
   */
  async detectInstalledReaders(usbPath) {
    try {
      const readers = [];
      const kiwixDir = path.join(usbPath, 'kiwix');

      // Check if kiwix directory exists
      if (!(await fs.pathExists(kiwixDir))) {
        return readers;
      }

      // Check each platform directory
      for (const platform of Object.values(KIWIX_PLATFORMS)) {
        const platformDir = path.join(kiwixDir, platform);

        if (await fs.pathExists(platformDir)) {
          // Check for executable files
          const files = await fs.readdir(platformDir);

          let executable = null;
          let isPortable = false;

          // Look for executable
          if (platform === KIWIX_PLATFORMS.WINDOWS) {
            executable = files.find((f) => f.endsWith('.exe') || f.endsWith('.zip'));
          } else if (platform === KIWIX_PLATFORMS.LINUX) {
            executable = files.find((f) => f.endsWith('.appimage'));
          } else if (platform === KIWIX_PLATFORMS.MAC) {
            executable = files.find((f) => f.endsWith('.app') || f.endsWith('.dmg'));
          }

          // Check for .portable file
          if (files.includes('.portable')) {
            isPortable = true;
          }

          if (executable) {
            readers.push({
              platform,
              path: platformDir,
              executable,
              isPortable,
              version: 'Unknown', // Would need to parse from filename or read metadata
            });
          }
        }
      }

      return readers;
    } catch (error) {
      console.error('Error detecting installed readers:', error);
      throw error;
    }
  }
}

module.exports = KiwixManager;
