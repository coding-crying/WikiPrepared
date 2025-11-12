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
}

module.exports = FileService;
