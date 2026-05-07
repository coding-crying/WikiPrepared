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
    this._ejectPromises = new Map(); // blockDevice -> Promise
  }

  async waitForDriveByDevice(devicePath, timeoutMs = 15000, intervalMs = 500) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const drives = await drivelist.list();
      const drive = drives.find((d) => d.device === devicePath || d.devicePath === devicePath);
      const mountpoint = drive?.mountpoints?.find((mp) => mp?.path)?.path || null;

      if (drive && mountpoint) {
        return this.formatDriveInfo(drive);
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return null;
  }

  normalizeFilesystem(filesystem) {
    const fs = (filesystem || 'exfat').toString().trim().toLowerCase();
    if (fs === 'exfat' || fs === 'ex-fat') return 'exfat';
    if (fs === 'fat32' || fs === 'vfat' || fs === 'fat') return 'fat32';
    if (fs === 'ntfs') return 'ntfs';
    return fs;
  }

  isSafeLinuxDevicePath(devicePath) {
    return typeof devicePath === 'string' && /^\/dev\/[A-Za-z0-9._-]+$/.test(devicePath);
  }

  isSafeLinuxDeviceName(deviceName) {
    return typeof deviceName === 'string' && /^[A-Za-z0-9._-]+$/.test(deviceName);
  }

  diskutilInfoSync(target) {
    const { execSync } = require('child_process');
    const output = execSync(`diskutil info "${target}"`, { encoding: 'utf8' });

    const parseBytesInParens = (line) => {
      if (!line) return null;
      const match = line.match(/\((\d+)\s+Bytes\)/i);
      return match ? Number(match[1]) : null;
    };

    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
    const getVal = (prefix) => {
      const line = lines.find((l) => l.startsWith(prefix));
      if (!line) return null;
      return line.slice(prefix.length).trim();
    };

    const getBytesFromPrefixes = (prefixes) => {
      for (const prefix of prefixes) {
        const v = getVal(prefix);
        const bytes = parseBytesInParens(v);
        if (Number.isFinite(bytes)) return bytes;
      }
      return null;
    };

    const deviceNode = getVal('Device Node:');
    const partOfWhole = getVal('Part of Whole:');
    const volumeName = getVal('Volume Name:');
    const fsPersonality = getVal('File System Personality:');
    const typeBundle = getVal('Type (Bundle):');

    const totalBytes = getBytesFromPrefixes([
      'Volume Total Space:',
      'Container Total Space:',
      'Disk Size:',
      'Total Size:',
    ]);

    const freeBytes = getBytesFromPrefixes([
      'Volume Free Space:',
      'Container Free Space:',
    ]);

    return {
      deviceNode: deviceNode || null,
      wholeDisk: partOfWhole ? `/dev/${partOfWhole}` : null,
      volumeName: volumeName || null,
      filesystem: (fsPersonality || typeBundle || null),
      totalBytes,
      freeBytes,
    };
  }

  /**
   * Resolve a Windows drive identifier to a mountable drive letter (e.g. "E:")
   * @param {string} drivePath - Device path, mount path, or drive letter
   * @returns {Promise<string|null>} Drive letter with colon, or null if unresolved
   */
  async resolveWindowsDriveLetter(drivePath) {
    if (!drivePath) return null;

    const directMatch = drivePath.match(/^([A-Za-z]):/);
    if (directMatch) {
      return `${directMatch[1].toUpperCase()}:`;
    }

    const drives = await drivelist.list();
    const matchedDrive = drives.find((d) =>
      d.device === drivePath ||
      d.devicePath === drivePath ||
      d.mountpoints.some((mp) => mp.path === drivePath)
    );

    const mountPath = matchedDrive?.mountpoints?.[0]?.path || null;
    const mountMatch = mountPath ? mountPath.match(/^([A-Za-z]):/) : null;
    return mountMatch ? `${mountMatch[1].toUpperCase()}:` : null;
  }

  /**
   * List all connected drives
   * @returns {Promise<Array>} List of drive objects
   */
  async listDrives() {
    try {
      const drives = await drivelist.list();

      const isValidMountPath = (mp) => {
        const p = mp?.path;
        return Boolean(p) && !p.includes('[') && !p.includes(']') && p !== '/';
      };

      // Filter for USB/removable drives with a usable mount path.
      // This avoids false positives like zram `[SWAP]` being treated as a removable drive.
      const formattedDrives = drives
        .filter((drive) => drive.isUSB || drive.isRemovable)
        .filter((drive) => Array.isArray(drive.mountpoints) && drive.mountpoints.some(isValidMountPath))
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
             // Use device path, not mount path, for lsblk
             const devicePath = drive.device || drive.devicePath;
             if (devicePath) {
               const label = execSync(`lsblk -n -o LABEL "${devicePath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
               if (label) {
                 mountpoint.label = label;
                 drive.description = label; // Also update description
               }
             }
           } catch (e) {
             // Ignore error silently
           }
        }

        if (os.platform() === 'win32') {
          // Windows: use wmic with PowerShell fallback
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
            try {
              const psResult = execSync(
                `powershell -NoProfile -Command "(Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}:'\\") | Select-Object FileSystem,FreeSpace,Size | ConvertTo-Json -Compress"`,
                { encoding: 'utf8' }
              );
              const parsed = JSON.parse(psResult.trim());
              filesystem = parsed?.FileSystem || null;
              freeSpace = Number(parsed?.FreeSpace) || drive.size;
              const totalSize = Number(parsed?.Size) || drive.size;
              usedSpace = totalSize - freeSpace;
            } catch (psError) {
              console.warn('Failed to get Windows disk info:', psError.message);
            }
          }
        } else if (os.platform() === 'darwin') {
          // macOS: diskutil provides more reliable filesystem and byte counts than parsing df output.
          try {
            const info = this.diskutilInfoSync(mountpoint.path);

            if ((!mountpoint.label || mountpoint.label === 'Unnamed Drive') && info.volumeName && info.volumeName !== 'Not applicable') {
              mountpoint.label = info.volumeName;
              drive.description = info.volumeName;
            }

            if (info.filesystem && info.filesystem !== 'Not applicable') {
              filesystem = info.filesystem;
            }

            if (Number.isFinite(info.totalBytes) && Number.isFinite(info.freeBytes)) {
              freeSpace = info.freeBytes;
              usedSpace = Math.max(0, info.totalBytes - info.freeBytes);
            }
          } catch (e) {
            // Fall back to df/stat parsing below.
          }
        } else {
          // Unix: use df for space and filesystem
          try {
            // Try df -T first (with type), fall back to regular df
            let dfResult;
            try {
              dfResult = execSync(`df -T "${mountpoint.path}"`, { encoding: 'utf8' });
            } catch (e) {
              dfResult = execSync(`df "${mountpoint.path}"`, { encoding: 'utf8' });
            }

            const lines = dfResult.trim().split('\n');
            if (lines.length >= 2) {
              const parts = lines[1].split(/\s+/);

              // df -T output: Filesystem Type 1K-blocks Used Available Use% Mounted (7 parts)
              // df output:    Filesystem 1K-blocks Used Available Use% Mounted (6 parts)
              if (parts.length >= 7) {
                // Has filesystem type
                filesystem = parts[1];
                usedSpace = parseInt(parts[3]) * 1024;
                freeSpace = parseInt(parts[4]) * 1024;
              } else if (parts.length >= 6) {
                // No filesystem type column
                usedSpace = parseInt(parts[2]) * 1024;
                freeSpace = parseInt(parts[3]) * 1024;

                // Try to get filesystem from /proc/mounts
                try {
                  const mountsResult = execSync(`grep "${mountpoint.path}" /proc/mounts | head -1`, { encoding: 'utf8' });
                  const mountParts = mountsResult.trim().split(/\s+/);
                  if (mountParts.length >= 3) {
                    filesystem = mountParts[2];
                  }
                } catch (e) {
                  // Ignore
                }
              }

              if (!filesystem) {
                if (os.platform() === 'darwin') {
                  try {
                    const statFs = execSync(`stat -f %T "${mountpoint.path}"`, { encoding: 'utf8' }).trim();
                    if (statFs) filesystem = statFs;
                  } catch (e) {
                    // Ignore
                  }
                } else if (os.platform() === 'linux') {
                  try {
                    const fsType = execSync(`findmnt -n -o FSTYPE --target "${mountpoint.path}"`, { encoding: 'utf8' }).trim();
                    if (fsType) filesystem = fsType;
                  } catch (e) {
                    // Ignore
                  }
                }
              }

              // Only log once per drive mount (check if values changed significantly)
              if (!this._lastLoggedSpace ||
                  Math.abs(this._lastLoggedSpace.used - usedSpace) > 1024 * 1024 * 100 || // >100MB change
                  this._lastLoggedSpace.path !== mountpoint.path) {
                console.log(`Drive space detected: used=${Math.round(usedSpace/1024/1024/1024)}GB, free=${Math.round(freeSpace/1024/1024/1024)}GB, fs=${filesystem}, path=${mountpoint.path}`);
                this._lastLoggedSpace = { used: usedSpace, path: mountpoint.path };
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
      fsType: filesystem, // Add alias for compatibility
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
      const os = require('os');
      const platform = os.platform();

      const normalizeWinLetter = (p) => {
        if (!p) return null;
        const match = p.toString().trim().match(/^([A-Za-z]):/);
        return match ? `${match[1].toUpperCase()}:` : null;
      };

      const wantedLetter = platform === 'win32' ? normalizeWinLetter(drivePath) : null;
      const drive = drives.find((d) => {
        if (d.device === drivePath || d.devicePath === drivePath) return true;
        if (d.mountpoints?.some((mp) => mp.path === drivePath)) return true;
        if (wantedLetter) {
          return d.mountpoints?.some((mp) => normalizeWinLetter(mp.path) === wantedLetter);
        }
        return false;
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
    const fsNorm = this.normalizeFilesystem(filesystem);

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
        if (!this.isSafeLinuxDevicePath(diskDevice)) {
          throw new Error(`Unsafe disk device path: ${diskDevice}`);
        }
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
             if (!this.isSafeLinuxDeviceName(partition)) continue;
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
        if (!this.isSafeLinuxDevicePath(targetPartition)) {
          throw new Error(`Unsafe target partition path: ${targetPartition}`);
        }

        // 6. Format the new partition
        const label = 'WIKIPREP';
        console.log(`Formatting ${targetPartition} to ${fsNorm}...`);
        
        const mkfsCmd = (() => {
          if (fsNorm === 'exfat') return `mkfs.exfat -n ${label} ${targetPartition}`;
          if (fsNorm === 'fat32') return `mkfs.vfat -F 32 -n ${label.slice(0, 11)} ${targetPartition}`;
          if (fsNorm === 'ntfs') return `mkfs.ntfs -f -L ${label} ${targetPartition}`;
          throw new Error(`Unsupported filesystem on Linux: ${filesystem}`);
        })();

        try {
          await execAsync(`pkexec ${mkfsCmd}`);
        } catch (err) {
          throw new Error(`Failed to format new partition: ${err.message}`);
        }
        
        // 7. Mount the new partition explicitly so the app gets a real writable mountpoint.
        console.log(`Mounting ${targetPartition}...`);
        try {
          await execAsync(`udisksctl mount -b ${targetPartition}`);
        } catch (mountError) {
          console.warn(`Explicit mount failed for ${targetPartition}:`, mountError.message);
        }

        console.log('Format complete, waiting for mounted drive to become available...');
        const mountedDrive = await this.waitForDriveByDevice(diskDevice, 15000, 500);

        if (!mountedDrive?.mountpoint) {
          throw new Error('Drive formatted but no writable mountpoint was detected afterwards. Please unplug and reinsert the drive.');
        }

        return {
          success: true,
          message: `Drive repartitioned and formatted to ${filesystem} successfully.`,
          drive: mountedDrive,
          mountpoint: mountedDrive.mountpoint,
        };

      } else if (platform === 'darwin') {
        // macOS: prefer diskutil with a best-effort resolution from mount path -> device node -> whole disk.
        if (fsNorm === 'ntfs') {
          throw new Error('NTFS formatting is not supported on macOS. Use exFAT or FAT32.');
        }

        const label = 'WikiPrepared';
        const fsType = fsNorm === 'exfat' ? 'ExFAT' : 'MS-DOS'; // MS-DOS is FAT32

        let deviceNode = drivePath;
        let wholeDisk = null;

        try {
          const info = this.diskutilInfoSync(drivePath);
          deviceNode = info.deviceNode || drivePath;
          wholeDisk = info.wholeDisk || null;
        } catch (e) {
          // If diskutil info fails, proceed with the provided path.
        }

        const isWholeDisk = /^\/dev\/disk\d+$/.test(deviceNode) || (wholeDisk && deviceNode === wholeDisk);
        const cmd = isWholeDisk
          ? `diskutil eraseDisk ${fsType} ${label} MBRFormat ${wholeDisk || deviceNode}`
          : `diskutil eraseVolume ${fsType} ${label} ${deviceNode}`;

        console.log('Executing:', cmd);
        await execAsync(cmd);
        const mountedDrive = await this.waitForDriveByDevice(validation.drive.device, 10000, 500);

        return {
          success: true,
          message: `Drive formatted to ${fsNorm} successfully.`,
          drive: mountedDrive || validation.drive,
          mountpoint: mountedDrive?.mountpoint || validation.drive.mountpoint,
        };

      } else if (platform === 'win32') {
        const driveLetter = await this.resolveWindowsDriveLetter(drivePath);
        if (!driveLetter) {
          throw new Error('Could not determine drive letter for formatting.');
        }

        const fsType = fsNorm === 'ntfs' ? 'NTFS' : fsNorm === 'fat32' ? 'FAT32' : 'exFAT';
        const label = 'WikiPrepared';
        const letterOnly = driveLetter.replace(':', '');

        // Requires elevated privileges on Windows.
        try {
          await execAsync(
            `powershell -NoProfile -ExecutionPolicy Bypass -Command "Format-Volume -DriveLetter '${letterOnly}' -FileSystem ${fsType} -NewFileSystemLabel '${label}' -Force -Confirm:\\$false"`
          );
        } catch (e) {
          throw new Error(`Windows formatting requires Administrator privileges. ${e.message}`);
        }

        const mountedDrive = await this.waitForDriveByDevice(validation.drive.device, 10000, 500);

        return {
          success: true,
          message: `Drive ${driveLetter} formatted to ${fsType} successfully.`,
          drive: mountedDrive || validation.drive,
          mountpoint: mountedDrive?.mountpoint || validation.drive.mountpoint,
        };
        
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
    const os = require('os');
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    console.log('Ejecting drive:', drivePath);

    const platform = os.platform();

    try {
      if (platform === 'linux') {
        // Resolve parent block device safely (handles /dev/sda1, /dev/nvme0n1p1, etc.)
        let blockDevice = null;
        if (drivePath.startsWith('/dev/')) {
          try {
            const { stdout } = await execAsync(`lsblk -no pkname ${drivePath}`);
            const parent = stdout.trim().split('\n')[0].trim();
            if (parent) blockDevice = parent;
          } catch (_e) {
            // Ignore
          }

          if (!blockDevice) {
            const base = drivePath.replace('/dev/', '').trim();
            blockDevice = base.replace(/p?\d+$/, '');
          }
        } else {
          throw new Error('Linux eject expects a /dev/* drive path');
        }

        if (!this.isSafeLinuxDeviceName(blockDevice)) {
          throw new Error(`Unsafe block device: ${blockDevice}`);
        }

        // Single-flight per block device to avoid concurrent eject races.
        if (this._ejectPromises.has(blockDevice)) {
          return await this._ejectPromises.get(blockDevice);
        }

        const savedCallback = this.watchCallback;
        const promise = (async () => {
          // Stop watching drives to prevent race conditions/file locks during ejection
          this.stopWatching();

          console.log('Starting Linux eject sequence...');

          // First sync to flush buffers (with timeout)
          console.log('Syncing filesystem...');
          await Promise.race([
            execAsync('sync'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 10000))
          ]);
          console.log('Sync completed');

          console.log('Target block device:', blockDevice);

          // Determine mounted partitions and unmount those only.
          let mountedPartitions = [];
          try {
            console.log('Listing mounted partitions...');
            const { stdout } = await Promise.race([
              execAsync(`lsblk -ln -o NAME,MOUNTPOINT /dev/${blockDevice} 2>/dev/null || echo ""`),
              new Promise((_, reject) => setTimeout(() => reject(new Error('lsblk timeout')), 5000))
            ]);

            const lines = stdout.trim().split('\n').map((l) => l.trim()).filter(Boolean);
            mountedPartitions = lines
              .map((line) => {
                const parts = line.split(/\s+/);
                const name = parts[0] || '';
                const mountpoint = parts.slice(1).join(' ').trim();
                return { name, mountpoint };
              })
              .filter((p) => this.isSafeLinuxDeviceName(p.name))
              .filter((p) => p.name !== blockDevice) // never try to unmount /dev/sda itself
              .filter((p) => Boolean(p.mountpoint)); // only mounted entries

            console.log('Mounted partitions:', mountedPartitions.map((p) => p.name));
          } catch (lsblkError) {
            console.log('Failed to list partitions:', lsblkError.message);
          }

          let unmountedAny = false;

          for (const p of mountedPartitions) {
            const partPath = `/dev/${p.name}`;
            try {
              console.log(`Unmounting ${partPath}...`);
              await Promise.race([
                execAsync(`udisksctl unmount -b ${partPath}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Unmount timeout')), 10000))
              ]);
              console.log(`Successfully unmounted ${partPath}`);
              unmountedAny = true;
            } catch (e) {
              const msg = e?.message || String(e);
              // Benign: already unmounted by another process / retry.
              if (msg.includes('NotMounted') || msg.toLowerCase().includes('not mounted')) {
                console.log(`${partPath} already unmounted`);
                continue;
              }

              console.log(`Standard unmount failed for ${partPath}:`, msg);

              // Attempt force unmount via udisksctl (no root needed usually)
              try {
                console.log(`Attempting force unmount for ${partPath}...`);
                await Promise.race([
                  execAsync(`udisksctl unmount -b ${partPath} --force`),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Force unmount timeout')), 10000))
                ]);
                console.log(`Force unmount successful for ${partPath}`);
                unmountedAny = true;
                continue;
              } catch (forceErr) {
                console.log(`Force unmount failed: ${forceErr.message}`);
              }

              // If still busy, try lazy unmount (requires root)
              if (msg.includes('busy') || msg.includes('target is busy')) {
                console.log(`Device busy, attempting lazy unmount for ${partPath}...`);
                try {
                  await Promise.race([
                    execAsync(`pkexec umount -l ${partPath}`),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Lazy unmount timeout')), 15000))
                  ]);
                  console.log(`Lazy unmount successful for ${partPath}`);
                  unmountedAny = true;
                } catch (lazyErr) {
                  console.error(`Lazy unmount failed: ${lazyErr.message}`);
                }
              }
            }
          }

          // If nothing was mounted, consider it already safe to remove.
          if (mountedPartitions.length === 0) {
            return { success: true, message: 'Drive is not mounted. You can safely remove it now.' };
          }

          // Try to power off, but don't fail the whole operation if unmount succeeded.
          try {
            console.log('Attempting power-off...');
            await Promise.race([
              execAsync(`udisksctl power-off -b /dev/${blockDevice}`),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Power-off timeout after 10s')), 10000))
            ]);
            console.log('Drive powered off successfully');
            return { success: true, message: 'Drive ejected safely. You can now remove it.' };
          } catch (powerOffError) {
            const msg = powerOffError?.message || String(powerOffError);
            // If the device disappeared, that's effectively "powered off".
            if (msg.includes('No such file or directory') || msg.toLowerCase().includes('no such file')) {
              return { success: true, message: 'Drive unmounted and no longer present. You can safely remove it now.' };
            }

            if (unmountedAny) {
              console.log('Power-off failed after unmount (non-fatal):', msg);
              return { success: true, message: 'Drive unmounted. You can safely remove it now.' };
            }

            console.log('Power-off failed or timed out:', msg);
            throw new Error('Could not unmount or eject drive. Please unmount manually before removing.');
          }
        })().finally(() => {
          this._ejectPromises.delete(blockDevice);
          if (savedCallback) {
            console.log('Restarting drive watching...');
            this.startWatching(savedCallback);
          }
        });

        this._ejectPromises.set(blockDevice, promise);
        return await promise;
      } else if (platform === 'darwin') {
        const savedCallback = this.watchCallback;
        this.stopWatching();
        try {
          // macOS
          let target = drivePath;
          try {
            const info = this.diskutilInfoSync(drivePath);
            target = info.wholeDisk || info.deviceNode || drivePath;
          } catch (e) {
            // Ignore, fall back to the provided path.
          }

          try {
            await execAsync(`diskutil eject "${target}"`);
          } catch (e) {
            await execAsync(`diskutil unmountDisk "${target}"`);
          }
          return { success: true, message: 'Drive ejected safely. You can now remove it.' };
        } finally {
          if (savedCallback) {
            console.log('Restarting drive watching...');
            this.startWatching(savedCallback);
          }
        }
      } else if (platform === 'win32') {
        const savedCallback = this.watchCallback;
        this.stopWatching();
        try {
          // Windows - use PowerShell to eject
          const driveLetter = await this.resolveWindowsDriveLetter(drivePath);
          if (driveLetter) {
            // Use PowerShell to eject the drive
            try {
              await execAsync(`powershell -NoProfile -Command "(New-Object -comObject Shell.Application).NameSpace(17).ParseName('${driveLetter}').InvokeVerb('Eject')"`);
            } catch (e) {
              // Fallback: dismount/remove mount point (often requires admin).
              try {
                await execAsync(`cmd /c mountvol ${driveLetter} /p`);
              } catch (e2) {
                throw new Error(`Windows eject failed. Try ejecting via File Explorer. ${e2.message}`);
              }
            }
            return { success: true, message: 'Drive ejected safely. You can now remove it.' };
          } else {
            throw new Error('Could not determine drive letter');
          }
        } finally {
          if (savedCallback) {
            console.log('Restarting drive watching...');
            this.startWatching(savedCallback);
          }
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
