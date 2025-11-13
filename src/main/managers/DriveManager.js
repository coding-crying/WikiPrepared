const drivelist = require('drivelist');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');
const { ERROR_CODES } = require('../../shared/constants');

/**
 * DriveManager - Handles USB drive detection and management
 */
class DriveManager {
  constructor() {
    this.watchInterval = null;
    this.watchCallback = null;
    this.lastDriveList = [];
  }

  /**
   * List all connected drives
   * @returns {Promise<Array>} List of drive objects
   */
  async listDrives() {
    try {
      const drives = await drivelist.list();

      // Filter for USB drives and add additional info
      const formattedDrives = drives
        .filter((drive) => drive.isUSB || drive.isRemovable)
        .map((drive) => this.formatDriveInfo(drive));

      return formattedDrives;
    } catch (error) {
      console.error('Error listing drives:', error);
      throw new Error('Failed to list drives');
    }
  }

  /**
   * Get detailed information about a specific drive
   * @param {string} drivePath - Path to the drive
   * @returns {Promise<Object>} Drive information
   */
  async getDriveInfo(drivePath) {
    try {
      const drives = await drivelist.list();
      const drive = drives.find((d) => {
        return d.mountpoints.some((mp) => mp.path === drivePath);
      });

      if (!drive) {
        throw new Error(ERROR_CODES.DRIVE_NOT_FOUND);
      }

      // Get additional filesystem info
      const info = this.formatDriveInfo(drive);

      // Scan for ZIM files
      info.installedZims = await this.scanZimFiles(drivePath);

      return info;
    } catch (error) {
      console.error('Error getting drive info:', error);
      throw error;
    }
  }

  /**
   * Format drive information for consistent output
   * @param {Object} drive - Raw drive object from drivelist
   * @returns {Object} Formatted drive info
   */
  formatDriveInfo(drive) {
    const mountpoint = drive.mountpoints[0] || {};
    const mountPath = mountpoint.path;

    // Get filesystem info if mounted
    let fileSystem = null;
    let freeSpace = null;
    let usedSpace = null;

    if (mountPath) {
      try {
        const fsInfo = this.getFileSystemInfo(mountPath);
        fileSystem = fsInfo.fileSystem;
        freeSpace = fsInfo.freeSpace;
        usedSpace = fsInfo.usedSpace;
      } catch (error) {
        console.warn(`Could not get filesystem info for ${mountPath}:`, error.message);
      }
    }

    return {
      device: drive.device,
      devicePath: drive.devicePath,
      displayName: drive.description || drive.device,
      label: mountpoint.label || 'Unnamed Drive',
      mountpoint: mountPath,
      size: drive.size,
      fileSystem,
      freeSpace,
      usedSpace,
      isUSB: drive.isUSB,
      isRemovable: drive.isRemovable,
      isReadOnly: drive.isReadOnly,
      isSystem: drive.isSystem,
      busType: drive.busType,
      raw: drive.raw,
    };
  }

  /**
   * Get filesystem type and free space for a mounted drive
   * @param {string} mountPath - Mount point path
   * @returns {Object} Filesystem information
   */
  getFileSystemInfo(mountPath) {
    const platform = os.platform();
    let fileSystem = null;
    let freeSpace = null;
    let usedSpace = null;
    let totalSpace = null;

    try {
      if (platform === 'linux') {
        // Use df command on Linux
        const output = execSync(`df -T "${mountPath}" | tail -1`, { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);

        if (parts.length >= 6) {
          fileSystem = parts[1]; // Filesystem type (ext4, vfat, exfat, ntfs, etc.)
          totalSpace = parseInt(parts[2], 10) * 1024; // Convert from KB to bytes
          usedSpace = parseInt(parts[3], 10) * 1024;
          freeSpace = parseInt(parts[4], 10) * 1024;
        }
      } else if (platform === 'darwin') {
        // Use df on macOS
        const output = execSync(`df -k "${mountPath}" | tail -1`, { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);

        if (parts.length >= 4) {
          totalSpace = parseInt(parts[1], 10) * 1024; // Convert from KB to bytes
          usedSpace = parseInt(parts[2], 10) * 1024;
          freeSpace = parseInt(parts[3], 10) * 1024;
        }

        // Get filesystem type separately on macOS
        try {
          const fsOutput = execSync(`diskutil info "${mountPath}" | grep "Type (Bundle)"`, { encoding: 'utf8' });
          const match = fsOutput.match(/Type \(Bundle\):\s+(.+)/);
          if (match) {
            fileSystem = match[1].trim();
          }
        } catch (e) {
          // Fallback: try to get from mount command
          const mountOutput = execSync(`mount | grep "${mountPath}"`, { encoding: 'utf8' });
          const fsMatch = mountOutput.match(/\(([^,)]+)/);
          if (fsMatch) {
            fileSystem = fsMatch[1];
          }
        }
      } else if (platform === 'win32') {
        // Use wmic on Windows
        const driveLetter = mountPath.charAt(0);
        const output = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get FileSystem,FreeSpace,Size /format:csv`, { encoding: 'utf8' });
        const lines = output.trim().split('\n').filter(line => line.trim());

        if (lines.length >= 2) {
          const parts = lines[1].split(',');
          if (parts.length >= 4) {
            fileSystem = parts[1].trim();
            freeSpace = parseInt(parts[2], 10);
            totalSpace = parseInt(parts[3], 10);
            usedSpace = totalSpace - freeSpace;
          }
        }
      }
    } catch (error) {
      console.warn('Error getting filesystem info:', error.message);
    }

    return {
      fileSystem: fileSystem || 'unknown',
      freeSpace: freeSpace || 0,
      usedSpace: usedSpace || 0,
      totalSpace: totalSpace || 0,
    };
  }

  /**
   * Scan a drive for ZIM files
   * @param {string} drivePath - Path to the drive
   * @returns {Promise<Array>} List of found ZIM files with metadata
   */
  async scanZimFiles(drivePath) {
    try {
      if (!drivePath) {
        throw new Error('Drive path is required');
      }

      // Check if path exists
      const exists = await fs.pathExists(drivePath);
      if (!exists) {
        throw new Error(ERROR_CODES.DRIVE_NOT_FOUND);
      }

      const zimFiles = [];

      // Recursively search for .zim files
      await this.findZimFilesRecursive(drivePath, zimFiles);

      // Extract metadata from filenames
      const filesWithMetadata = zimFiles.map((filePath) => {
        const filename = path.basename(filePath);
        const stats = fs.statSync(filePath);

        return {
          path: filePath,
          filename: filename,
          size: stats.size,
          modified: stats.mtime,
          metadata: this.parseZimFilename(filename),
        };
      });

      return filesWithMetadata;
    } catch (error) {
      console.error('Error scanning for ZIM files:', error);
      throw error;
    }
  }

  /**
   * Recursively find ZIM files in a directory
   * @param {string} dirPath - Directory path
   * @param {Array} results - Array to store results
   * @param {number} maxDepth - Maximum recursion depth (default 5)
   * @param {number} currentDepth - Current recursion depth
   */
  async findZimFilesRecursive(dirPath, results, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return;
    }

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        try {
          const stats = await fs.stat(fullPath);

          if (stats.isDirectory()) {
            // Recurse into subdirectory
            await this.findZimFilesRecursive(fullPath, results, maxDepth, currentDepth + 1);
          } else if (stats.isFile() && item.toLowerCase().endsWith('.zim')) {
            results.push(fullPath);
          }
        } catch (error) {
          // Skip files/dirs we can't access
          console.warn(`Cannot access: ${fullPath}`, error.message);
        }
      }
    } catch (error) {
      console.warn(`Cannot read directory: ${dirPath}`, error.message);
    }
  }

  /**
   * Parse ZIM filename to extract metadata
   * Format: wikipedia_<lang>_<topic>_<scope>_<YYYY-MM>.zim
   * @param {string} filename - ZIM filename
   * @returns {Object} Parsed metadata
   */
  parseZimFilename(filename) {
    const metadata = {
      source: null,
      language: null,
      topic: null,
      scope: null,
      date: null,
      valid: false,
    };

    try {
      // Remove .zim extension
      const nameWithoutExt = filename.replace(/\.zim$/i, '');

      // Split by underscore
      const parts = nameWithoutExt.split('_');

      if (parts.length >= 4) {
        metadata.source = parts[0]; // e.g., "wikipedia"
        metadata.language = parts[1]; // e.g., "en"
        metadata.topic = parts[2]; // e.g., "all"
        metadata.scope = parts[3]; // e.g., "maxi"

        // Date might be in format YYYY-MM
        if (parts.length >= 5) {
          metadata.date = parts[4];
        }

        metadata.valid = true;
      }
    } catch (error) {
      console.warn('Error parsing ZIM filename:', filename, error);
    }

    return metadata;
  }

  /**
   * Validate that a drive is safe to write to
   * @param {string} drivePath - Path to the drive
   * @returns {Promise<Object>} Validation result
   */
  async validateDrive(drivePath) {
    try {
      const drives = await drivelist.list();
      const drive = drives.find((d) => {
        return d.mountpoints.some((mp) => mp.path === drivePath);
      });

      if (!drive) {
        return {
          valid: false,
          error: ERROR_CODES.DRIVE_NOT_FOUND,
          message: 'Drive not found',
        };
      }

      if (!drive.isUSB && !drive.isRemovable) {
        return {
          valid: false,
          error: ERROR_CODES.DRIVE_NOT_USB,
          message: 'Drive is not a removable USB drive',
        };
      }

      if (drive.isSystem) {
        return {
          valid: false,
          error: ERROR_CODES.DRIVE_NOT_USB,
          message: 'Cannot write to system drive',
        };
      }

      if (drive.isReadOnly) {
        return {
          valid: false,
          error: ERROR_CODES.DRIVE_READ_ONLY,
          message: 'Drive is read-only',
        };
      }

      return {
        valid: true,
        drive: this.formatDriveInfo(drive),
      };
    } catch (error) {
      console.error('Error validating drive:', error);
      throw error;
    }
  }

  /**
   * Start watching for drive changes
   * @param {Function} callback - Called when drives change
   * @param {number} interval - Polling interval in ms (default 2000)
   */
  startWatching(callback, interval = 2000) {
    if (this.watchInterval) {
      this.stopWatching();
    }

    this.watchCallback = callback;

    // Initial list
    this.listDrives().then((drives) => {
      this.lastDriveList = drives;
      callback(drives);
    });

    // Poll for changes
    this.watchInterval = setInterval(async () => {
      try {
        const currentDrives = await this.listDrives();

        // Check if drives have changed
        if (this.drivesHaveChanged(this.lastDriveList, currentDrives)) {
          this.lastDriveList = currentDrives;
          callback(currentDrives);
        }
      } catch (error) {
        console.error('Error watching drives:', error);
      }
    }, interval);

    console.log('Started watching drives');
  }

  /**
   * Stop watching for drive changes
   */
  stopWatching() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      this.watchCallback = null;
      console.log('Stopped watching drives');
    }
  }

  /**
   * Check if drive lists have changed
   * @param {Array} oldList - Previous drive list
   * @param {Array} newList - Current drive list
   * @returns {boolean} True if changed
   */
  drivesHaveChanged(oldList, newList) {
    if (oldList.length !== newList.length) {
      return true;
    }

    // Compare device paths
    const oldDevices = new Set(oldList.map((d) => d.device));
    const newDevices = new Set(newList.map((d) => d.device));

    for (const device of newDevices) {
      if (!oldDevices.has(device)) {
        return true;
      }
    }

    for (const device of oldDevices) {
      if (!newDevices.has(device)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Safely eject a drive
   * @param {string} drivePath - Path to the drive
   * @returns {Promise<Object>} Result
   */
  async ejectDrive(drivePath) {
    // Note: Actual ejection is platform-specific and may require elevated privileges
    // This is a placeholder implementation
    console.log('Ejecting drive:', drivePath);

    // On Windows: use "eject" or "removable drive ejector"
    // On Linux: use "umount"
    // On Mac: use "diskutil eject"

    return {
      success: true,
      message: 'Please safely remove the drive manually',
    };
  }
}

module.exports = DriveManager;
