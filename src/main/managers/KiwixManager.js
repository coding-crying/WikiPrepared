const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const { KIWIX_PLATFORMS, URLS } = require('../../shared/constants');
const PlatformLauncherService = require('../services/PlatformLauncherService');

/**
 * KiwixManager - Handles Kiwix reader downloads and installation with caching
 */
class KiwixManager {
  constructor() {
    this.versions = {
      [KIWIX_PLATFORMS.WINDOWS]: null,
      [KIWIX_PLATFORMS.LINUX]: null,
      [KIWIX_PLATFORMS.MAC]: null,
      [KIWIX_PLATFORMS.ANDROID]: null,
    };

    // Cache directory for downloaded readers
    this.cacheDir = path.join(app.getPath('userData'), 'kiwix-cache');
    this.ensureCacheDir();
    this.platformLauncherService = new PlatformLauncherService();
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
   * Resolve a URL to its final destination to get versioned filename
   * @param {string} url - The URL to resolve
   * @returns {Promise<Object>} Object containing finalUrl and filename
   */
  async resolveUrl(url) {
    try {
      const response = await axios.head(url, {
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept all 2xx and 3xx
        },
      });
      
      // Axios follows redirects by default, so response.request.res.responseUrl should be the final URL
      // But in some environments (like Electron net), it might be different.
      // Let's use the responseURL if available, otherwise fallback to input
      const finalUrl = response.request.res.responseUrl || url;
      const filename = path.basename(finalUrl);
      
      // Try to extract version from filename (e.g., kiwix-desktop_windows_x64_2.3.1.zip)
      // Look for pattern _(\d+\.\d+\.\d+)
      const versionMatch = filename.match(/_(\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'Latest';
      
      return { finalUrl, filename, version };
    } catch (error) {
      console.warn(`Failed to resolve URL ${url}:`, error.message);
      return { finalUrl: url, filename: path.basename(url), version: 'Latest' };
    }
  }

  /**
   * Get latest Kiwix reader versions for all platforms
   * @returns {Promise<Object>} Version information
   */
  async getLatestVersions() {
    try {
      console.log('Fetching latest Kiwix versions...');
      
      // URLs
      const winUrl = 'https://download.kiwix.org/release/kiwix-desktop/kiwix-desktop_windows_x64.zip';
      
      // Resolve Windows version (since it's a zip we want to extract)
      const winInfo = await this.resolveUrl(winUrl);

      return {
        [KIWIX_PLATFORMS.WINDOWS]: {
          version: winInfo.version,
          url: winInfo.finalUrl, // Use resolved URL
          filename: winInfo.filename,
          size: 85000000, // Approx
          releaseDate: new Date().toISOString().split('T')[0],
        },
        [KIWIX_PLATFORMS.LINUX]: {
          version: 'Latest',
          url: 'https://download.kiwix.org/release/kiwix-desktop/kiwix-desktop_x86_64.appimage',
          filename: 'kiwix-desktop_x86_64.appimage',
          size: 90000000, // Approx
          releaseDate: new Date().toISOString().split('T')[0],
        },
        [KIWIX_PLATFORMS.MAC]: {
          version: 'Latest',
          url: 'https://download.kiwix.org/release/kiwix-macos/kiwix-macos.dmg',
          filename: 'kiwix-macos.dmg',
          size: 95000000, // Approx
          releaseDate: new Date().toISOString().split('T')[0],
        },
        [KIWIX_PLATFORMS.ANDROID]: {
          version: 'Latest',
          url: 'https://download.kiwix.org/release/kiwix-android/org.kiwix.kiwixmobile.standalone.apk',
          filename: 'org.kiwix.kiwixmobile.standalone.apk',
          size: 45000000, // Approx
          releaseDate: new Date().toISOString().split('T')[0],
        }
      };
    } catch (error) {
      console.error('Error fetching Kiwix versions:', error);
      throw error;
    }
  }

  /**
   * Extract ZIP file to destination
   * @param {string} zipPath - Path to the zip file
   * @param {string} extractTo - Destination directory
   */
  async extractAndSetupPortable(zipPath, extractTo) {
    try {
      console.log(`Extracting ${zipPath} to ${extractTo}...`);

      // Ensure destination exists
      await fs.ensureDir(extractTo);

      // Extract
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractTo, true); // true = overwrite

      console.log('Extraction complete.');

      // Find the extracted folder (it usually contains a subfolder like kiwix-desktop_windows_x64_...)
      const files = await fs.readdir(extractTo);
      const subfolder = files.find(f => {
        const fullPath = path.join(extractTo, f);
        return fs.statSync(fullPath).isDirectory() && f.includes('kiwix');
      });

      if (subfolder) {
        console.log(`Found Kiwix subfolder: ${subfolder}`);
      }

      // Note: Launcher creation is handled by PlatformLauncherService
      // and the bundled asset files, not here

    } catch (error) {
      console.error('Error during extraction/setup:', error);
      throw error;
    }
  }

  async findWindowsExecutableDir(rootDir) {
    const entries = await fs.readdir(rootDir);

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        const candidate = path.join(fullPath, 'kiwix-desktop.exe');
        if (await fs.pathExists(candidate)) {
          return fullPath;
        }
      }
    }

    const directExe = path.join(rootDir, 'kiwix-desktop.exe');
    if (await fs.pathExists(directExe)) {
      return rootDir;
    }

    return null;
  }

  async configurePortableLibrary(platform, usbPath, installPath) {
    const libraryPath = path.join(usbPath, 'Library');

    if (!(await fs.pathExists(libraryPath))) {
      return;
    }

    let portableMarkerPath = null;
    let portableDataDir = null;

    if (platform === KIWIX_PLATFORMS.WINDOWS) {
      const executableDir = await this.findWindowsExecutableDir(installPath);
      if (!executableDir) {
        console.warn('Could not find kiwix-desktop.exe; skipping Windows portable library setup');
        return;
      }

      portableMarkerPath = path.join(executableDir, '.portable');
      portableDataDir = path.join(executableDir, 'data');
    } else if (platform === KIWIX_PLATFORMS.LINUX) {
      const executableDir = path.dirname(installPath);
      portableMarkerPath = path.join(executableDir, '.portable');
      portableDataDir = path.join(executableDir, 'data');
    } else {
      return;
    }

    await fs.ensureDir(portableDataDir);
    await fs.writeFile(portableMarkerPath, '');
    await this.platformLauncherService.createLibraryXML(portableDataDir, libraryPath);
    console.log(`Configured portable Kiwix library for ${platform}`);
  }

  async refreshPortableLibraries(usbPath) {
    const dataDir = path.join(usbPath, '.data');

    const windowsInstallDir = path.join(dataDir, 'kiwix-windows');
    if (await fs.pathExists(windowsInstallDir)) {
      await this.configurePortableLibrary(KIWIX_PLATFORMS.WINDOWS, usbPath, windowsInstallDir);
    }

    const linuxInstallPath = path.join(usbPath, 'START - Linux.AppImage');
    if (await fs.pathExists(linuxInstallPath)) {
      await this.configurePortableLibrary(KIWIX_PLATFORMS.LINUX, usbPath, linuxInstallPath);
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
          } else if (platform === KIWIX_PLATFORMS.ANDROID) {
             executable = files.find((f) => f.endsWith('.apk'));
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
   * New structure: readers go into .data/ folder (hidden)
   * @param {string} platform - Platform (windows, linux, macos, android)
   * @param {string} usbPath - USB drive path
   * @param {function} onProgress - Progress callback
   * @param {string|null} sourcePath - Optional existing local reader file path
   * @returns {Promise<Object>} Installation result
   */
  async installToUSB(platform, usbPath, onProgress = null, sourcePath = null) {
    try {
      console.log(`Installing Kiwix reader for ${platform} to ${usbPath}...`);

      const versions = await this.getLatestVersions();
      const versionInfo = versions[platform];

      if (!versionInfo) {
        throw new Error(`No version found for platform: ${platform}`);
      }

      let downloadResult;
      if (sourcePath && await fs.pathExists(sourcePath)) {
        console.log(`Using existing reader file for ${platform}: ${sourcePath}`);
        downloadResult = {
          success: true,
          path: sourcePath,
          fromCache: false
        };
      } else {
        // Download (will use cache if available)
        downloadResult = await this.downloadReader(platform, null, onProgress);
      }

      // Create hidden .data directory on USB
      const dataDir = path.join(usbPath, '.data');
      await fs.ensureDir(dataDir);

      let installPath;

      // For Windows, we extract the zip to .data/kiwix-windows/
      if (platform === KIWIX_PLATFORMS.WINDOWS && versionInfo.filename.endsWith('.zip')) {
        const winDir = path.join(dataDir, 'kiwix-windows');
        await fs.ensureDir(winDir);
        await this.extractAndSetupPortable(downloadResult.path, winDir);
        installPath = winDir;

      } else if (platform === KIWIX_PLATFORMS.LINUX) {
        // Linux - copy AppImage to root with consistent naming
        const targetPath = path.join(usbPath, 'START - Linux.AppImage');
        await fs.copy(downloadResult.path, targetPath);
        await fs.chmod(targetPath, 0o755);
        installPath = targetPath;
        console.log('Made Linux AppImage executable');

      } else if (platform === KIWIX_PLATFORMS.MAC) {
        // Mac - keep the installer visible in the USB root.
        const targetPath = path.join(usbPath, 'Install Kiwix for Mac.dmg');
        await fs.copy(downloadResult.path, targetPath);
        installPath = targetPath;

      } else if (platform === KIWIX_PLATFORMS.ANDROID) {
        // Android - copy APK to root (visible for easy access)
        const targetPath = path.join(usbPath, 'Install on Android.apk');
        await fs.copy(downloadResult.path, targetPath);
        installPath = targetPath;
      }

      // Ensure platform launch scripts exist at USB root.
      try {
        await this.platformLauncherService.createAllLaunchers(usbPath);
      } catch (launcherErr) {
        console.warn('Failed to create launchers (continuing):', launcherErr.message);
      }

      await this.configurePortableLibrary(platform, usbPath, installPath);

      console.log(`Installed Kiwix reader to: ${installPath}`);

      return {
        success: true,
        installPath,
        version: versionInfo.version,
        platform,
        fromCache: downloadResult.fromCache
      };
    } catch (error) {
      console.error('Error installing Kiwix reader:', error);
      throw error;
    }
  }
}

module.exports = KiwixManager;
