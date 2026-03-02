const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');

/**
 * FileService - Handles file operations
 */
class FileService {
  /**
   * Copy a file with progress tracking
   * @param {string} source - Source file path
   * @param {string} destination - Destination file path
   * @param {Function} progressCallback - Progress callback (optional)
   * @returns {Promise<Object>} Copy result
   */
  async copyFile(source, destination, progressCallback = null) {
    try {
      // Ensure source exists
      if (!(await fs.pathExists(source))) {
        throw new Error('Source file does not exist');
      }

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destination));

      // Get file size for progress calculation
      const stats = await fs.stat(source);
      const totalSize = stats.size;

      // Simple copy (for production, use streaming with progress)
      await fs.copy(source, destination);

      if (progressCallback) {
        progressCallback({
          copiedSize: totalSize,
          totalSize,
          progress: 100,
        });
      }

      return {
        success: true,
        destination,
        size: totalSize,
      };
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  }

  /**
   * Verify file checksum
   * @param {string} filepath - File path
   * @param {string} expectedChecksum - Expected checksum
   * @param {string} algorithm - Hash algorithm (default: md5)
   * @returns {Promise<boolean>} True if checksum matches
   */
  async verifyChecksum(filepath, expectedChecksum, algorithm = 'md5') {
    try {
      const actualChecksum = await this.calculateChecksum(filepath, algorithm);
      return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
    } catch (error) {
      console.error('Error verifying checksum:', error);
      throw error;
    }
  }

  /**
   * Calculate file checksum
   * @param {string} filepath - File path
   * @param {string} algorithm - Hash algorithm (md5, sha256, etc.)
   * @returns {Promise<string>} Checksum hex string
   */
  async calculateChecksum(filepath, algorithm = 'md5') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filepath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Delete a file
   * @param {string} filepath - File path
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(filepath) {
    try {
      await fs.remove(filepath);

      return {
        success: true,
        filepath,
      };
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get file size
   * @param {string} filepath - File path
   * @returns {Promise<number>} File size in bytes
   */
  async getFileSize(filepath) {
    try {
      const stats = await fs.stat(filepath);
      return stats.size;
    } catch (error) {
      console.error('Error getting file size:', error);
      throw error;
    }
  }

  /**
   * Check if file exists
   * @param {string} filepath - File path
   * @returns {Promise<boolean>} True if exists
   */
  async fileExists(filepath) {
    return await fs.pathExists(filepath);
  }

  /**
   * Get path to bundled assets
   * @param {string} filename - Asset filename
   * @returns {string} Full path to asset
   */
  getAssetPath(filename) {
    // In development mode
    if (process.env.NODE_ENV === 'development') {
      return path.join(__dirname, '../assets', filename);
    }

    // In production (packaged app)
    const { app } = require('electron');
    return path.join(process.resourcesPath, 'assets', filename);
  }

  /**
   * Prepare USB folder structure and copy launcher files
   * @param {string} usbPath - USB drive path
   * @returns {Promise<void>}
   */
  async prepareUSBStructure(usbPath) {
    console.log('Creating USB folder structure...');

    // Create hidden .data folder for readers
    await fs.ensureDir(path.join(usbPath, '.data'));

    // Create Library folder for ZIM files
    await fs.ensureDir(path.join(usbPath, 'Library'));

    // Copy Windows launcher
    const batSource = this.getAssetPath('START - Windows.bat');
    const batDest = path.join(usbPath, 'START - Windows.bat');
    await fs.copy(batSource, batDest);
    console.log('Copied Windows launcher');

    // Copy Mac launcher
    const macSource = this.getAssetPath('START - Mac.command');
    const macDest = path.join(usbPath, 'START - Mac.command');
    await fs.copy(macSource, macDest);
    await fs.chmod(macDest, 0o755);
    console.log('Copied Mac launcher');

    // Copy Linux launcher
    const linuxSource = this.getAssetPath('START - Linux.sh');
    const linuxDest = path.join(usbPath, 'START - Linux.sh');
    await fs.copy(linuxSource, linuxDest);
    await fs.chmod(linuxDest, 0o755);
    console.log('Copied Linux launcher');

    // Copy README
    const readmeSource = this.getAssetPath('README.txt');
    const readmeDest = path.join(usbPath, 'README.txt');
    await fs.copy(readmeSource, readmeDest);
    console.log('Copied README.txt');

    console.log('USB structure created successfully');
  }

  /**
   * Copy Kiwix reader to USB with proper naming
   * All readers go into hidden .data/ folder except Android APK
   * @param {string} usbPath - USB drive path
   * @param {string} platform - Platform (windows/mac/linux/android)
   * @param {string} sourcePath - Source file/folder path
   * @param {string} version - Kiwix version (e.g., "3.5.0")
   * @returns {Promise<void>}
   */
  async copyKiwixReader(usbPath, platform, sourcePath, version) {
    console.log(`Copying Kiwix reader for ${platform}...`);

    const dataDir = path.join(usbPath, '.data');
    await fs.ensureDir(dataDir);

    switch (platform) {
      case 'windows': {
        // Windows Portable - copy entire folder to .data/kiwix-windows/
        const destFolder = path.join(dataDir, 'kiwix-windows');
        await fs.copy(sourcePath, destFolder);
        console.log(`Copied Windows Portable to: ${destFolder}`);
        break;
      }

      case 'macos':
      case 'mac': {
        // Mac - single .dmg file to .data/
        const destFile = path.join(dataDir, 'kiwix-macos.dmg');
        await fs.copy(sourcePath, destFile);
        console.log(`Copied Mac installer to: ${destFile}`);
        break;
      }

      case 'linux': {
        // Linux - single .appimage file to .data/
        const destFile = path.join(dataDir, 'kiwix-linux.AppImage');
        await fs.copy(sourcePath, destFile);
        // Make executable
        await fs.chmod(destFile, 0o755);
        console.log(`Copied Linux AppImage to: ${destFile}`);
        break;
      }

      case 'android': {
        // Android - APK stays visible in root for easy access
        const destFile = path.join(usbPath, 'Install on Android.apk');
        await fs.copy(sourcePath, destFile);
        console.log(`Copied Android APK to: ${destFile}`);
        break;
      }

      default:
        throw new Error(`Unknown platform: ${platform}`);
    }
  }

  /**
   * Copy ZIM file to USB drive Library folder
   * @param {string} usbPath - USB drive path
   * @param {string} zimSource - Source ZIM file path
   * @param {Function} progressCallback - Progress callback
   * @param {string} friendlyName - Optional friendly display name for the file
   * @returns {Promise<void>}
   */
  async copyZimToUSB(usbPath, zimSource, progressCallback = null, friendlyName = null) {
    const zimFilename = friendlyName || path.basename(zimSource);
    const destPath = path.join(usbPath, 'Library', zimFilename);

    console.log(`Copying ${zimFilename} to USB Library...`);

    await this.copyFile(zimSource, destPath, progressCallback);

    console.log(`Copied ${zimFilename} successfully`);
  }

  /**
   * Generate a friendly name for a ZIM file
   * @param {string} zimFilename - Original ZIM filename
   * @returns {string} Friendly display name
   */
  getFriendlyZimName(zimFilename) {
    // Example: wikipedia_en_all_maxi_2025-01.zim -> Wikipedia - English (Full).zim
    // Example: wikipedia_en_100_nopic_2025-10.zim -> Wikipedia - Top 100 Articles.zim

    const name = zimFilename.replace('.zim', '');
    const parts = name.split('_');

    // Try to create a friendly name
    if (parts[0] === 'wikipedia') {
      const lang = parts[1] || 'en';
      const langName = lang === 'en' ? 'English' : lang.toUpperCase();

      // Check for special topics
      if (parts.includes('all') && parts.includes('maxi')) {
        return `Wikipedia - ${langName} (Full).zim`;
      } else if (parts.includes('all') && parts.includes('nopic')) {
        return `Wikipedia - ${langName} (No Pictures).zim`;
      } else if (parts.includes('100')) {
        return `Wikipedia - Top 100 Articles.zim`;
      } else {
        // Extract topic if present
        const knownParts = ['wikipedia', lang, 'all', 'maxi', 'nopic', 'mini'];
        const topic = parts.find(p => !knownParts.includes(p) && !p.match(/^\d{4}-\d{2}$/));
        if (topic) {
          const topicName = topic.charAt(0).toUpperCase() + topic.slice(1);
          return `Wikipedia - ${topicName}.zim`;
        }
      }
    }

    // Fallback: just return original name
    return zimFilename;
  }

  /**
   * Get final USB structure summary
   * @param {string} usbPath - USB drive path
   * @returns {Promise<Object>} Structure info
   */
  async getUSBStructureSummary(usbPath) {
    const summary = {
      launchers: [],
      readers: [],
      zimFiles: [],
      totalSize: 0
    };

    // Check for launchers
    const launcherFiles = [
      'START - Windows.bat',
      'START - Mac.command',
      'START - Linux.sh',
      'README.txt'
    ];
    for (const launcher of launcherFiles) {
      if (await fs.pathExists(path.join(usbPath, launcher))) {
        summary.launchers.push(launcher);
      }
    }

    // Check for readers in .data/ folder
    const dataDir = path.join(usbPath, '.data');
    if (await fs.pathExists(dataDir)) {
      // Check Windows portable
      const winDir = path.join(dataDir, 'kiwix-windows');
      if (await fs.pathExists(winDir)) {
        summary.readers.push({ name: 'kiwix-windows/', platform: 'windows' });
      }

      // Check Mac DMG
      const macFile = path.join(dataDir, 'kiwix-macos.dmg');
      if (await fs.pathExists(macFile)) {
        const stats = await fs.stat(macFile);
        summary.readers.push({ name: 'kiwix-macos.dmg', size: stats.size, platform: 'macos' });
        summary.totalSize += stats.size;
      }

      // Check Linux AppImage
      const linuxFile = path.join(dataDir, 'kiwix-linux.AppImage');
      if (await fs.pathExists(linuxFile)) {
        const stats = await fs.stat(linuxFile);
        summary.readers.push({ name: 'kiwix-linux.AppImage', size: stats.size, platform: 'linux' });
        summary.totalSize += stats.size;
      }
    }

    // Check Android APK (in root)
    const androidFile = path.join(usbPath, 'Install on Android.apk');
    if (await fs.pathExists(androidFile)) {
      const stats = await fs.stat(androidFile);
      summary.readers.push({ name: 'Install on Android.apk', size: stats.size, platform: 'android' });
      summary.totalSize += stats.size;
    }

    // Check ZIM files in Library/
    const libraryFolder = path.join(usbPath, 'Library');
    if (await fs.pathExists(libraryFolder)) {
      const files = await fs.readdir(libraryFolder);
      for (const file of files) {
        if (file.endsWith('.zim')) {
          const stats = await fs.stat(path.join(libraryFolder, file));
          summary.zimFiles.push({ name: file, size: stats.size });
          summary.totalSize += stats.size;
        }
      }
    }

    return summary;
  }
}

module.exports = FileService;
