const drivelist = require('drivelist');
const fs = require('fs-extra');
const path = require('path');
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

    // Get filesystem type from mountpoint or detect it
    let filesystem = null;
    let usedSpace = 0;
    let freeSpace = drive.size;

    // Skip invalid mount paths like [SWAP]
    const validMountPath = mountpoint.path &&
      !mountpoint.path.includes('[') &&
      !mountpoint.path.includes(']');

    if (validMountPath) {
      try {
        const { execSync } = require('child_process');
        const os = require('os');

        // Try to get label using lsblk if missing (Linux only)
        if ((!mountpoint.label || mountpoint.label === 'Unnamed Drive') && os.platform() === 'linux') {
           try {
             // lsblk -n -o LABEL /run/media/user/drive
             // Use mountpoint.path
             const label = execSync(`lsblk -n -o LABEL "${mountpoint.path}"`, { encoding: 'utf8' }).trim();
             if (label) {
               mountpoint.label = label;
               drive.description = label; // Also update description
             }
           } catch (e) {
             // Ignore error
           }
        }

        if (os.platform() === 'win32') {
          // Windows: use wmic
          const driveLetter = mountpoint.path.charAt(0).toUpperCase();
          try {
            const result = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get FileSystem,FreeSpace,Size /format:csv`, { encoding: 'utf8' });
            const lines = result.trim().split('\n');
            if (lines.length >= 2) {
              const parts = lines[1].split(',');
              if (parts.length >= 4) {
                filesystem = parts[1] || null;
                freeSpace = parseInt(parts[2]) || drive.size;
                const totalSize = parseInt(parts[3]) || drive.size;
                usedSpace = totalSize - freeSpace;
              }
            }
          } catch (e) {
            console.warn('Failed to get Windows disk info:', e.message);
          }
        } else {
          // Unix: use df for space and filesystem
          try {
            const dfResult = execSync(`df -T "${mountpoint.path}" 2>/dev/null || df "${mountpoint.path}"`, { encoding: 'utf8' });
            const lines = dfResult.trim().split('\n');
            if (lines.length >= 2) {
              const parts = lines[1].split(/\s+/);
              // df -T output: Filesystem Type 1K-blocks Used Available Use% Mounted
              if (parts.length >= 6) {
                filesystem = parts[1]; // Filesystem type
                const totalBlocks = parseInt(parts[2]) * 1024;
                usedSpace = parseInt(parts[3]) * 1024;
                freeSpace = parseInt(parts[4]) * 1024;
              }
            }
          } catch (e) {
            console.warn('Failed to get Unix disk info:', e.message);
          }
        }
      } catch (e) {
        console.warn('Error detecting filesystem:', e.message);
      }
    }

    return {
      device: drive.device,
      devicePath: drive.devicePath,
      displayName: drive.description || drive.device,
      description: drive.description,
      label: mountpoint.label || 'Unnamed Drive',
      mountpoint: mountpoint.path,
      mountpoints: drive.mountpoints,
      size: drive.size,
      usedSpace,
      freeSpace,
      filesystem,
      isUSB: drive.isUSB,
      isRemovable: drive.isRemovable,
      isReadOnly: drive.isReadOnly,
      isSystem: drive.isSystem,
      busType: drive.busType,
      raw: drive.raw,
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

      // Extract metadata from filenames and flatten the structure
      const filesWithMetadata = zimFiles.map((filePath) => {
        const filename = path.basename(filePath);
        const stats = fs.statSync(filePath);
        const metadata = this.parseZimFilename(filename);

        // Return flattened structure matching catalog ZIM format
        return {
          path: filePath,
          filename: filename,
          size: stats.size,
          modified: stats.mtime,
          date: metadata.date,
          // Spread metadata for compatibility with ZimListItem component
          source: metadata.source,
          language: metadata.language,
          topic: metadata.topic,
          scope: metadata.scope,
          valid: metadata.valid,
          // Also keep nested metadata for backward compatibility
          metadata: metadata,
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
        return d.device === drivePath || d.mountpoints.some((mp) => mp.path === drivePath);
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
   * Format a drive
   * @param {string} drivePath - Path to the drive/device
   * @param {string} filesystem - Target filesystem (exfat, ntfs, etc.)
   * @returns {Promise<Object>} Result
   */
  async formatDrive(drivePath, filesystem = 'exfat') {
    const os = require('os');
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    const platform = os.platform();

    console.log(`Formatting ${drivePath} to ${filesystem}...`);

    // Capture callback before stopping
    const savedCallback = this.watchCallback;

    // 1. CRITICAL SAFETY CHECK
    // Ensure we are never wiping a system drive, even if UI allowed it
    const validation = await this.validateDrive(drivePath);
    if (!validation.valid) {
      throw new Error(`Safety Block: Cannot format this drive. ${validation.message}`);
    }
    console.log('Safety check passed: Target is a removable/USB drive.');

    // Stop watching to prevent interference
    this.stopWatching();

    try {
      if (platform === 'linux') {
        // Linux implementation: Wipe, Repartition, and Format
        
        // 1. Identify the parent disk device
        let diskDevice = drivePath;
        try {
          // Check if input is a partition (has a parent)
          const { stdout } = await execAsync(`lsblk -no pkname ${drivePath}`);
          // Handle potential multiline output by taking only the first line
          const parent = stdout.trim().split('\n')[0].trim();
          if (parent) {
            diskDevice = `/dev/${parent}`;
          }
        } catch (e) {
          console.log('Could not resolve parent device, assuming input is disk root');
        }
        
        // Ensure no newlines or spaces in device path
        diskDevice = diskDevice.trim();
        console.log(`Targeting whole disk for repartitioning: ${diskDevice}`);

        // 2. Unmount ALL partitions on this disk
        try {
          // List all partitions: lsblk -n -o NAME -r /dev/sda
          const { stdout } = await execAsync(`lsblk -n -o NAME -r ${diskDevice}`);
          const devices = stdout.trim().split('\n');
          // Filter out the disk itself
          const partitions = devices.filter(d => `/dev/${d}` !== diskDevice && d !== path.basename(diskDevice));
          
          console.log('Unmounting partitions:', partitions);
          
          for (const partition of partitions) {
             const partPath = `/dev/${partition}`;
             try {
               await execAsync(`udisksctl unmount -b ${partPath}`);
               console.log(`Unmounted ${partPath}`);
             } catch (e) {
               // Ignore errors (already unmounted, etc)
             }
          }
        } catch (e) {
          console.warn('Error listing/unmounting partitions:', e.message);
        }

        // 3. Wipe and Repartition (requires root)
        // We chain these commands to avoid multiple password prompts
        console.log('Wiping and creating new partition table...');
        try {
          const commands = [
            `wipefs -a ${diskDevice}`,            // Wipe signatures
            `parted -s ${diskDevice} mklabel msdos`, // New MBR table
            `parted -s ${diskDevice} mkpart primary 0% 100%` // New primary partition filling disk
          ].join(' && ');
          
          await execAsync(`pkexec sh -c "${commands}"`);
        } catch (err) {
           throw new Error(`Failed to repartition drive: ${err.message}`);
        }
        
        // 4. Wait for OS to recognize new partition table
        console.log('Waiting for kernel to sync...');
        await new Promise(r => setTimeout(r, 2000));
        
        // 5. Find the new partition to format
        let targetPartition = null;
        try {
           const { stdout } = await execAsync(`lsblk -n -o NAME -r ${diskDevice}`);
           const devices = stdout.trim().split('\n');
           const partitions = devices.filter(d => `/dev/${d}` !== diskDevice && d !== path.basename(diskDevice));
           
           if (partitions.length > 0) {
             // Usually the first one is p1 or 1
             targetPartition = `/dev/${partitions[0]}`;
             console.log(`Detected new partition: ${targetPartition}`);
           }
        } catch (e) {
           console.warn('Failed to detect new partition:', e);
        }
        
        if (!targetPartition) {
           // Fallback guess
           targetPartition = `${diskDevice}1`;
           if (diskDevice.includes('nvme')) targetPartition = `${diskDevice}p1`;
           console.log(`Guessing new partition: ${targetPartition}`);
        }

        // 6. Format the new partition
        const label = 'WIKIPREP';
        console.log(`Formatting ${targetPartition} to ${filesystem}...`);
        
        try {
           // Try mkfs.exfat directly with pkexec
           await execAsync(`pkexec mkfs.exfat -n ${label} ${targetPartition}`);
        } catch (err) {
           throw new Error(`Failed to format new partition: ${err.message}`);
        }
        
        // 7. Wait for auto-mount
        console.log('Format complete, waiting for system refresh...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return { success: true, message: `Drive repartitioned and formatted to ${filesystem} successfully.` };

      } else if (platform === 'darwin') {
        // macOS: diskutil eraseDisk ExFAT WikiPrepared /dev/disk2
        // Note: eraseDisk formats the whole disk and creates a new map. 
        // If drivePath is a partition (disk2s1), use eraseVolume.
        
        const label = 'WikiPrepared';
        const fsType = filesystem.toUpperCase() === 'EXFAT' ? 'ExFAT' : 'MS-DOS'; // MS-DOS is FAT32
        
        let cmd = '';
        if (drivePath.match(/disk[0-9]+$/)) {
           // Whole disk
           cmd = `diskutil eraseDisk ${fsType} ${label} MBRFormat ${drivePath}`;
        } else {
           // Partition
           cmd = `diskutil eraseVolume ${fsType} ${label} ${drivePath}`;
        }
        
        console.log('Executing:', cmd);
        await execAsync(cmd);
        return { success: true, message: `Drive formatted to ${filesystem} successfully.` };

      } else if (platform === 'win32') {
        // Windows
        // drivePath might be a device path from drivelist, but we need a drive letter for `format`.
        // or we can use diskpart? diskpart is hard to script non-interactively without a script file.
        
        // Try to find drive letter from mountpoints? 
        // The `drivePath` passed from UI `selectedDrive.device` is usually `\\.\PHYSICALDRIVE1` on Windows from drivelist.
        // But we need the volume letter (E:).
        
        // This is tricky. If we can't find the letter, we can't easily use `format`.
        // For now, return error on Windows prompting manual format.
        
        throw new Error('Automatic formatting on Windows is not yet supported. Please format the drive manually in File Explorer.');
        
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error('Format error:', error);
      throw new Error(`Failed to format drive: ${error.message}`);
    } finally {
      // Restart watching if it was active
      if (savedCallback) {
        this.startWatching(savedCallback);
      }
    }
  }

  /**
   * Safely eject a drive
   * @param {string} drivePath - Path to the drive (device path like /dev/sda or mount point)
   * @returns {Promise<Object>} Result
   */
  async ejectDrive(drivePath) {
    // Stop watching drives to prevent race conditions/file locks during ejection
    this.stopWatching();

    const os = require('os');
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    console.log('Ejecting drive:', drivePath);

    const platform = os.platform();

    try {
      if (platform === 'linux') {
        // First sync to flush buffers
        await execAsync('sync');

        // Get block device name (e.g., sda from /dev/sda or /dev/sda1)
        let blockDevice = drivePath;
        if (drivePath.startsWith('/dev/')) {
          blockDevice = drivePath.replace('/dev/', '').replace(/[0-9]+$/, '');
        }

        // Try udisksctl first (works without root on most modern Linux)
        let unmountedAny = false;

        // First unmount all partitions on the device
        try {
          const { stdout } = await execAsync(`lsblk -ln -o NAME /dev/${blockDevice} 2>/dev/null || echo "${blockDevice}"`);
          const partitions = stdout.trim().split('\n').filter(p => p.trim());
          console.log('Found partitions to unmount:', partitions);

          for (const partition of partitions) {
            const partPath = `/dev/${partition.trim()}`;
            try {
              console.log(`Unmounting ${partPath}...`);
              await execAsync(`udisksctl unmount -b ${partPath}`);
              console.log(`Successfully unmounted ${partPath}`);
              unmountedAny = true;
            } catch (e) {
              console.log(`Standard unmount failed for ${partPath}:`, e.message);
              
              // If busy, try lazy unmount (requires root)
              if (e.message.includes('busy') || e.message.includes('target is busy')) {
                 console.log(`Device busy, attempting lazy unmount for ${partPath}...`);
                 try {
                   await execAsync(`pkexec umount -l ${partPath}`);
                   console.log(`Lazy unmount successful for ${partPath}`);
                   unmountedAny = true;
                 } catch (lazyErr) {
                   console.error(`Lazy unmount failed: ${lazyErr.message}`);
                 }
              }
            }
          }
        } catch (lsblkError) {
          console.log('Failed to list partitions:', lsblkError.message);
        }

        // Try to power off the drive (optional, unmount is the key part)
        try {
          await execAsync(`udisksctl power-off -b /dev/${blockDevice}`);
          console.log('Drive powered off successfully');
          return { success: true, message: 'Drive ejected safely. You can now remove it.' };
        } catch (powerOffError) {
          console.log('Power-off failed (may need elevated permissions):', powerOffError.message);
          // Power-off failed, but if we unmounted, that's good enough
          if (unmountedAny) {
            return { success: true, message: 'Drive unmounted. You can safely remove it now.' };
          }
          // Nothing worked, throw an error
          throw new Error('Could not unmount drive. Please unmount manually before removing.');
        }
      } else if (platform === 'darwin') {
        // macOS
        if (drivePath.startsWith('/dev/')) {
          await execAsync(`diskutil eject ${drivePath}`);
        } else {
          await execAsync(`diskutil unmount "${drivePath}"`);
        }
        return { success: true, message: 'Drive ejected safely. You can now remove it.' };
      } else if (platform === 'win32') {
        // Windows - use PowerShell to eject
        // Extract drive letter from path (e.g., "E:" from "E:\")
        const driveLetter = drivePath.match(/^([A-Za-z]:)/)?.[1];
        if (driveLetter) {
          // Use PowerShell to eject the drive
          await execAsync(`powershell -Command "(New-Object -comObject Shell.Application).NameSpace(17).ParseName('${driveLetter}').InvokeVerb('Eject')"`);
          return { success: true, message: 'Drive ejected safely. You can now remove it.' };
        } else {
          throw new Error('Could not determine drive letter');
        }
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      console.error('Eject error:', error);
      throw new Error(`Failed to eject drive: ${error.message}`);
    }
  }
}

module.exports = DriveManager;
