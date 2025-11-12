const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { KIWIX_PLATFORMS, URLS } = require('../../shared/constants');

/**
 * KiwixManager - Handles Kiwix reader downloads and installation
 */
class KiwixManager {
  constructor() {
    this.versions = {
      [KIWIX_PLATFORMS.WINDOWS]: null,
      [KIWIX_PLATFORMS.LINUX]: null,
      [KIWIX_PLATFORMS.MAC]: null,
    };
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
   * Download Kiwix reader for a specific platform
   * @param {string} platform - Platform (windows, linux, mac)
   * @param {string} destination - Destination path
   * @returns {Promise<Object>} Download result
   */
  async downloadReader(platform, destination) {
    try {
      if (!Object.values(KIWIX_PLATFORMS).includes(platform)) {
        throw new Error(`Invalid platform: ${platform}`);
      }

      const versions = await this.getLatestVersions();
      const versionInfo = versions[platform];

      if (!versionInfo) {
        throw new Error(`No version found for platform: ${platform}`);
      }

      console.log(`Downloading Kiwix reader for ${platform}...`);

      const destPath = path.join(destination, versionInfo.filename);

      // Download the file
      const response = await axios({
        method: 'get',
        url: versionInfo.url,
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Kiwix-USB-Updater/0.1.0',
        },
      });

      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log(`Downloaded Kiwix reader: ${destPath}`);

      return {
        success: true,
        path: destPath,
        version: versionInfo.version,
      };
    } catch (error) {
      console.error('Error downloading Kiwix reader:', error);
      throw error;
    }
  }

  /**
   * Install Kiwix reader to USB drive
   * @param {string} platform - Platform (windows, linux, mac)
   * @param {string} usbPath - USB drive path
   * @returns {Promise<Object>} Installation result
   */
  async installToUSB(platform, usbPath) {
    try {
      console.log(`Installing Kiwix reader for ${platform} to ${usbPath}...`);

      const versions = await this.getLatestVersions();
      const versionInfo = versions[platform];

      if (!versionInfo) {
        throw new Error(`No version found for platform: ${platform}`);
      }

      // Download to temp location first
      const tempDir = require('os').tmpdir();
      const downloadResult = await this.downloadReader(platform, tempDir);

      // Create Kiwix directory on USB
      const kiwixDir = path.join(usbPath, 'kiwix', platform);
      await fs.ensureDir(kiwixDir);

      // Extract or copy the reader
      // Note: This is simplified - actual implementation would need to:
      // - Extract ZIP files (Windows)
      // - Make AppImage executable (Linux)
      // - Mount and copy DMG contents (Mac)

      const targetPath = path.join(kiwixDir, versionInfo.filename);
      await fs.copy(downloadResult.path, targetPath);

      // Create .portable file for portable mode
      const portableFile = path.join(kiwixDir, '.portable');
      await fs.writeFile(portableFile, '');

      // Clean up temp file
      await fs.remove(downloadResult.path);

      console.log(`Installed Kiwix reader to: ${kiwixDir}`);

      return {
        success: true,
        installPath: kiwixDir,
        version: versionInfo.version,
        platform,
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
            executable = files.find((f) => f.endsWith('.exe'));
          } else if (platform === KIWIX_PLATFORMS.LINUX) {
            executable = files.find((f) => f.endsWith('.appimage'));
          } else if (platform === KIWIX_PLATFORMS.MAC) {
            executable = files.find((f) => f.endsWith('.app'));
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
