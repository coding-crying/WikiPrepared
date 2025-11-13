const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

/**
 * FlashService - Handles USB drive preparation (flashing)
 *
 * Orchestrates:
 * - Drive formatting
 * - Folder structure creation
 * - ZIM file copying
 * - Kiwix reader installation
 * - Metadata file creation/reading
 */
class FlashService {
  constructor() {
    this.progressCallback = null;
  }

  /**
   * Set progress callback for status updates
   * @param {Function} callback - Progress callback
   */
  onProgress(callback) {
    this.progressCallback = callback;
  }

  /**
   * Emit progress update
   * @param {number} progress - Progress percentage (0-100)
   * @param {string} status - Status message
   */
  emitProgress(progress, status) {
    if (this.progressCallback) {
      this.progressCallback({ progress, status });
    }
  }

  /**
   * Create folder structure on USB drive
   * @param {string} mountPath - USB drive mount path
   * @returns {Promise<Object>} Result
   */
  async createFolderStructure(mountPath) {
    try {
      const folders = [
        path.join(mountPath, 'zims'),
        path.join(mountPath, 'kiwix-readers'),
        path.join(mountPath, 'kiwix-readers', 'windows'),
        path.join(mountPath, 'kiwix-readers', 'linux'),
        path.join(mountPath, 'kiwix-readers', 'macos'),
      ];

      for (const folder of folders) {
        await fs.ensureDir(folder);
      }

      console.log(`[FlashService] Created folder structure at ${mountPath}`);

      return {
        success: true,
        folders,
      };
    } catch (error) {
      console.error('[FlashService] Error creating folder structure:', error);
      throw error;
    }
  }

  /**
   * Download and copy a ZIM file to USB
   * @param {string} zimUrl - ZIM file URL
   * @param {string} mountPath - USB drive mount path
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} Result
   */
  async copyZimFile(zimUrl, mountPath, progressCallback) {
    try {
      const filename = path.basename(zimUrl);
      const destination = path.join(mountPath, 'zims', filename);

      console.log(`[FlashService] Downloading ZIM: ${filename}`);

      // Download with progress tracking
      const response = await axios({
        method: 'get',
        url: zimUrl,
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Kiwix-USB-Updater/0.1.0',
        },
      });

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      const writer = fs.createWriteStream(destination);

      response.data.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const progress = (downloadedSize / totalSize) * 100;

        if (progressCallback) {
          progressCallback({
            filename,
            progress,
            downloadedSize,
            totalSize,
          });
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      console.log(`[FlashService] ZIM copied: ${filename}`);

      return {
        success: true,
        filename,
        destination,
        size: totalSize,
      };
    } catch (error) {
      console.error('[FlashService] Error copying ZIM:', error);
      throw error;
    }
  }

  /**
   * Download and install Kiwix readers to USB
   * @param {Array} platforms - Array of platform names ('windows', 'linux', 'macos')
   * @param {string} mountPath - USB drive mount path
   * @returns {Promise<Object>} Result
   */
  async copyKiwixReaders(platforms, mountPath) {
    try {
      const KiwixManager = require('../managers/KiwixManager');
      const kiwixManager = new KiwixManager();

      const results = [];

      for (const platform of platforms) {
        console.log(`[FlashService] Downloading Kiwix reader for ${platform}`);

        const versions = await kiwixManager.getLatestVersions();
        const platformData = versions[platform];

        if (!platformData) {
          console.warn(`[FlashService] No Kiwix reader found for ${platform}`);
          continue;
        }

        // Download to temp, then copy to USB
        const tempDir = path.join(mountPath, 'kiwix-readers', platform);
        await fs.ensureDir(tempDir);

        const response = await axios({
          method: 'get',
          url: platformData.url,
          responseType: 'stream',
          timeout: 120000,
          headers: {
            'User-Agent': 'Kiwix-USB-Updater/0.1.0',
          },
        });

        const filename = platformData.filename || path.basename(platformData.url);
        const destination = path.join(tempDir, filename);
        const writer = fs.createWriteStream(destination);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        results.push({
          platform,
          filename,
          destination,
          version: platformData.version,
        });

        console.log(`[FlashService] Kiwix reader copied: ${platform} - ${filename}`);
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('[FlashService] Error copying Kiwix readers:', error);
      throw error;
    }
  }

  /**
   * Create metadata file on USB drive
   * @param {string} mountPath - USB drive mount path
   * @param {Object} metadata - Metadata object
   * @returns {Promise<Object>} Result
   */
  async createMetadata(mountPath, metadata) {
    try {
      const metadataPath = path.join(mountPath, '.kiwix-usb-updater.json');

      const metadataContent = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        createdBy: 'Kiwix USB Updater',
        appVersion: metadata.appVersion || '0.1.0',
        content: {
          zims: metadata.zims || [],
          kiwix: metadata.kiwix || [],
        },
      };

      await fs.writeJson(metadataPath, metadataContent, { spaces: 2 });

      // Also create a README
      await this.createReadme(mountPath, metadataContent);

      console.log(`[FlashService] Metadata created at ${metadataPath}`);

      return {
        success: true,
        metadataPath,
      };
    } catch (error) {
      console.error('[FlashService] Error creating metadata:', error);
      throw error;
    }
  }

  /**
   * Create README file on USB drive
   * @param {string} mountPath - USB drive mount path
   * @param {Object} metadata - Metadata content
   * @returns {Promise<void>}
   */
  async createReadme(mountPath, metadata) {
    const readmePath = path.join(mountPath, 'README.txt');

    const content = `
Kiwix Offline Wikipedia USB Drive
==================================

This USB drive was prepared with Kiwix USB Updater on ${new Date(metadata.createdAt).toLocaleString()}.

Contents:
---------
${metadata.content.zims.length > 0 ? `
ZIM Files (${metadata.content.zims.length}):
${metadata.content.zims.map(z => `  - ${z.filename} (${formatBytes(z.size || 0)})`).join('\n')}
` : '  No ZIM files'}

${metadata.content.kiwix.length > 0 ? `
Kiwix Readers:
${metadata.content.kiwix.map(k => `  - ${k.charAt(0).toUpperCase() + k.slice(1)}`).join('\n')}
` : '  No Kiwix readers'}

How to Use:
-----------
1. Install the appropriate Kiwix reader from the 'kiwix-readers' folder for your operating system
2. Open Kiwix and load ZIM files from the 'zims' folder
3. Enjoy offline Wikipedia and other content!

For more information, visit: https://www.kiwix.org/

---
This drive can be updated using Kiwix USB Updater.
When you plug it in, the app will automatically detect it and offer to check for updates.
`.trim();

    await fs.writeFile(readmePath, content, 'utf8');
    console.log(`[FlashService] README created at ${readmePath}`);
  }

  /**
   * Detect if a drive was prepared with metadata
   * @param {string} mountPath - USB drive mount path
   * @returns {Promise<Object|null>} Metadata if found, null otherwise
   */
  async detectMetadata(mountPath) {
    try {
      const metadataPath = path.join(mountPath, '.kiwix-usb-updater.json');

      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        console.log(`[FlashService] Detected prepared drive at ${mountPath}`);
        return metadata;
      }

      return null;
    } catch (error) {
      console.error('[FlashService] Error detecting metadata:', error);
      return null;
    }
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = FlashService;
