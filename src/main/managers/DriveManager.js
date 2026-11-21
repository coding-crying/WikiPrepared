const drivelist = require('drivelist');
const fs = require('fs-extra');
const fsSync = require('fs');
const path = require('path');
const { ERROR_CODES } = require('../../shared/constants');
const zimNames = require('../../shared/zim-names');

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

  /**
   * Run a command with arguments as an array (no shell) when possible.
   * Falls back to shell-string execution only if execFile is unavailable.
   * This eliminates shell-metacharacter injection for every call site that
   * uses it — even if an argument contains `; rm -rf /` it is passed to the
   * target binary as a literal argument.
   */
  safeExec(file, args, options = {}) {
    const { execFile } = require('child_process');
    return new Promise((resolve, reject) => {
      execFile(file, args, { encoding: 'utf8', timeout: options.timeout || 30000, ...options }, (error, stdout, stderr) => {
        if (error) {
          // Attach stderr for better diagnostics, mirroring execAsync behavior
          error.stderr = stderr;
          error.stdout = stdout;
          return reject(error);
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Synchronous variant used inside formatDriveInfo().
   */
  safeExecSync(file, args, options = {}) {
    const { execFileSync } = require('child_process');
    return execFileSync(file, args, { encoding: 'utf8', timeout: options.timeout || 15000, ...options });
  }

  isSafeLinuxDevicePath(devicePath) {
    return typeof devicePath === 'string' && /^\/dev\/[A-Za-z0-9._-]+$/.test(devicePath);
  }

  isSafeLinuxDeviceName(deviceName) {
    return typeof deviceName === 'string' && /^[A-Za-z0-9._-]+$/.test(deviceName);
  }

  diskutilInfoSync(target) {
    const output = this.safeExecSync('diskutil', ['info', target]);

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
    const volumeReadOnly = /^yes/i.test(getVal('Volume Read-Only:') || '');
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
      volumeReadOnly,
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
   * Canonical lower-case filesystem id regardless of which OS tool reported it
   * (diskutil says "MS-DOS FAT32"/"ExFAT"/"Mac OS Extended (Journaled)", Linux
   * says "vfat", Windows says "FAT32"/"exFAT").
   */
  canonicalFilesystem(name) {
    if (!name) return null;
    const v = String(name).trim().toLowerCase();
    if (!v || v === 'not applicable') return null;
    if (v.includes('exfat')) return 'exfat';
    if (v.includes('fat32') || v === 'vfat' || v === 'msdos' || v === 'ms-dos' || v === 'fat' || v.startsWith('ms-dos fat')) return 'fat32';
    if (v === 'ntfs' || v === 'ntfs3' || v.includes('ntfs')) return 'ntfs';
    if (v === 'apfs' || v.startsWith('apfs')) return 'apfs';
    if (v.includes('mac os extended') || v === 'hfs' || v === 'hfsplus' || v === 'hfs+') return 'hfs+';
    return v;
  }

  /**
   * Slow, OS-tool based volume metadata (label, filesystem, read-only state).
   * Called by the 2 s drive watcher, so results are cached per device+mount:
   * on Windows each miss spawns wmic/PowerShell synchronously on the main
   * process, which froze the UI on every poll.
   */
  getVolumeMeta(drive, mountpoint) {
    const key = `${drive.device}|${mountpoint.path}`;
    if (!this._volumeMetaCache) this._volumeMetaCache = new Map();
    const cached = this._volumeMetaCache.get(key);
    if (cached && Date.now() - cached.at < 60000) return cached.meta;

    const os = require('os');
    const platform = os.platform();
    const meta = { filesystem: null, label: null, readOnly: false, totalBytes: null, freeBytes: null };

    try {
      if (platform === 'linux') {
        const devicePath = drive.device || drive.devicePath;
        if ((!mountpoint.label || mountpoint.label === 'Unnamed Drive') && devicePath) {
          try {
            meta.label = this.safeExecSync('lsblk', ['-n', '-o', 'LABEL', devicePath]).trim().split('\n')[0].trim() || null;
          } catch (_e) { /* ignore */ }
        }
        try {
          const mountsText = fsSync.readFileSync('/proc/mounts', 'utf8');
          const decode = (p) => p.replace(/\\040/g, ' ').replace(/\\011/g, '\t').replace(/\\134/g, '\\');
          const line = mountsText.split('\n').map((l) => l.split(' ')).find((parts) => parts.length >= 4 && decode(parts[1]) === mountpoint.path);
          if (line) {
            meta.filesystem = line[2];
            meta.readOnly = line[3].split(',').includes('ro');
          }
        } catch (_e) { /* ignore */ }
        if (!meta.filesystem) {
          try {
            meta.filesystem = this.safeExecSync('findmnt', ['-n', '-o', 'FSTYPE', '--target', mountpoint.path]).trim() || null;
          } catch (_e) { /* ignore */ }
        }
      } else if (platform === 'darwin') {
        const info = this.diskutilInfoSync(mountpoint.path);
        if (info.volumeName && info.volumeName !== 'Not applicable') meta.label = info.volumeName;
        meta.filesystem = info.filesystem;
        // NTFS sticks mount read-only on macOS; drivelist only reports media
        // read-only, so without this the copy fails late with EROFS.
        meta.readOnly = Boolean(info.volumeReadOnly);
        meta.totalBytes = info.totalBytes;
        meta.freeBytes = info.freeBytes;
      } else if (platform === 'win32') {
        const driveLetter = mountpoint.path.charAt(0).toUpperCase();
        if (/^[A-Z]$/.test(driveLetter)) {
          try {
            const psResult = this.safeExecSync('powershell.exe', [
              '-NoProfile', '-NonInteractive', '-Command',
              `Get-Volume -DriveLetter '${driveLetter}' | Select-Object FileSystemType,FileSystemLabel,Size,SizeRemaining | ConvertTo-Json -Compress`,
            ]);
            const parsed = JSON.parse(psResult.trim());
            meta.filesystem = parsed?.FileSystemType || null;
            meta.label = parsed?.FileSystemLabel || null;
            meta.totalBytes = Number(parsed?.Size) || null;
            meta.freeBytes = Number(parsed?.SizeRemaining) || null;
          } catch (psError) {
            // wmic is gone on current Windows 11 builds; keep it only as a fallback.
            try {
              const result = this.safeExecSync('wmic', [
                'logicaldisk', 'where', `DeviceID='${driveLetter}:'`,
                'get', 'FileSystem,FreeSpace,Size', '/format:csv',
              ]);
              const lines = result.trim().split(/\r?\n/).filter(Boolean);
              const parts = (lines[1] || '').split(',');
              if (parts.length >= 4) {
                meta.filesystem = parts[1] || null;
                meta.freeBytes = parseInt(parts[2], 10) || null;
                meta.totalBytes = parseInt(parts[3], 10) || null;
              }
            } catch (e) {
              console.warn('Failed to get Windows disk info:', psError.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error detecting filesystem:', e.message);
    }

    meta.filesystem = this.canonicalFilesystem(meta.filesystem);
    this._volumeMetaCache.set(key, { at: Date.now(), meta });
    return meta;
  }

  invalidateVolumeMeta() {
    if (this._volumeMetaCache) this._volumeMetaCache.clear();
  }

  /**
   * Format drive information for consistent output
   * @param {Object} drive - Raw drive object from drivelist
   * @returns {Object} Formatted drive info
   */
  formatDriveInfo(drive) {
    const mountpoint = { ...(drive.mountpoints.find((mp) => mp?.path && !mp.path.includes('[')) || drive.mountpoints[0] || {}) };

    let filesystem = null;
    let usedSpace = 0;
    let freeSpace = drive.size;
    let isReadOnly = Boolean(drive.isReadOnly);
    let description = drive.description;

    const validMountPath = mountpoint.path &&
      !mountpoint.path.includes('[') &&
      !mountpoint.path.includes(']');

    if (validMountPath) {
      const meta = this.getVolumeMeta(drive, mountpoint);
      filesystem = meta.filesystem;
      isReadOnly = isReadOnly || meta.readOnly;
      if ((!mountpoint.label || mountpoint.label === 'Unnamed Drive') && meta.label) {
        mountpoint.label = meta.label;
        description = meta.label;
      }

      // Cheap, cross-platform, no child process: refreshed on every poll.
      let spaceKnown = false;
      try {
        const st = fsSync.statfsSync(mountpoint.path);
        const total = Number(st.blocks) * Number(st.bsize);
        const free = Number(st.bavail) * Number(st.bsize);
        if (total > 0) {
          freeSpace = free;
          usedSpace = Math.max(0, total - Number(st.bfree) * Number(st.bsize));
          spaceKnown = true;
        }
      } catch (_e) { /* fall back to OS tool numbers below */ }
      if (!spaceKnown && Number.isFinite(meta.totalBytes) && Number.isFinite(meta.freeBytes)) {
        freeSpace = meta.freeBytes;
        usedSpace = Math.max(0, meta.totalBytes - meta.freeBytes);
      }
    }

    return {
      device: drive.device,
      devicePath: drive.devicePath,
      displayName: description || drive.device,
      description,
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
      isReadOnly,
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
    return zimNames.parseZimFilename(filename);
  }

  /**
   * Validate that a drive is safe to write to
   * @param {string} drivePath - Path to the drive
   * @returns {Promise<Object>} Validation result
   */
  async validateDrive(drivePath, { forFormat = false } = {}) {
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

      const formatted = this.formatDriveInfo(drive);
      // A read-only *mount* (e.g. NTFS on macOS) is fine to erase; read-only media is not.
      if (drive.isReadOnly || (!forFormat && formatted.isReadOnly)) {
        return {
          valid: false,
          error: ERROR_CODES.DRIVE_READ_ONLY,
          message: formatted.filesystem === 'ntfs'
            ? 'This drive is NTFS, which this computer can only read. Erase it as exFAT first.'
            : 'Drive is read-only',
        };
      }

      return {
        valid: true,
        drive: formatted,
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
    const validation = await this.validateDrive(drivePath, { forFormat: true });
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
          const pknameOutput = await this.safeExec('lsblk', ['-no', 'pkname', drivePath]);
          // Handle potential multiline output by taking only the first line
          const parent = pknameOutput.trim().split('\n')[0].trim();
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
          const lsblkOutput = await this.safeExec('lsblk', ['-n', '-o', 'NAME', '-r', diskDevice]);
          const devices = lsblkOutput.trim().split('\n');
          // Filter out the disk itself
          const partitions = devices.filter(d => `/dev/${d}` !== diskDevice && d !== path.basename(diskDevice));

          console.log('Unmounting partitions:', partitions);

          for (const partition of partitions) {
             if (!this.isSafeLinuxDeviceName(partition)) continue;
             const partPath = `/dev/${partition}`;
             try {
               await this.safeExec('udisksctl', ['unmount', '-b', partPath]);
               console.log(`Unmounted ${partPath}`);
             } catch (e) {
               // Ignore errors (already unmounted, etc)
             }
          }
        } catch (e) {
          console.warn('Error listing/unmounting partitions:', e.message);
        }

        // 3-6. Wipe, repartition and format in ONE privileged step.
        // pkexec's default policy does not cache authorization, so separate
        // pkexec calls meant 4 password prompts. The script receives its
        // inputs as positional arguments (never interpolated into shell code).
        //
        // MBR partition type matters: parted's default (0x83 "Linux") is not
        // mounted by Windows, so the stick looked empty/unformatted there.
        // "ntfs" yields id 0x07 (correct for exFAT and NTFS), "fat32" 0x0c.
        if (!['exfat', 'fat32', 'ntfs'].includes(fsNorm)) {
          throw new Error(`Unsupported filesystem on Linux: ${fsNorm}`);
        }
        const label = fsNorm === 'fat32' ? 'WIKIPREP' : 'WikiPrepared';
        const formatScript = [
          'set -eu',
          'disk="$1"; fs="$2"; label="$3"',
          'wipefs -a "$disk"',
          'if [ "$fs" = fat32 ]; then ptype=fat32; else ptype=ntfs; fi',
          'parted -s "$disk" mklabel msdos mkpart primary "$ptype" 1MiB 100%',
          'partprobe "$disk" 2>/dev/null || true',
          'udevadm settle 2>/dev/null || sleep 2',
          'part=""',
          'for i in 1 2 3 4 5 6 7 8 9 10; do',
          '  part=$(lsblk -nrpo NAME,TYPE "$disk" | awk \'$2=="part"{print $1; exit}\')',
          '  [ -n "$part" ] && [ -b "$part" ] && break',
          '  sleep 1',
          'done',
          '[ -n "$part" ] || { echo "new partition did not appear" >&2; exit 3; }',
          'case "$fs" in',
          '  exfat) mkfs.exfat -n "$label" "$part" ;;',
          '  fat32) mkfs.vfat -F 32 -n "$label" "$part" ;;',
          '  ntfs) mkfs.ntfs -f -L "$label" "$part" ;;',
          'esac',
          'echo "PARTITION=$part"',
        ].join('\n');

        console.log(`Repartitioning ${diskDevice} and formatting as ${fsNorm} (single pkexec)...`);
        let targetPartition = null;
        try {
          const out = await this.safeExec('pkexec', ['/bin/sh', '-c', formatScript, 'wikiprepared-format', diskDevice, fsNorm, label], { timeout: 600000 });
          const m = String(out).match(/PARTITION=(\S+)/);
          targetPartition = m ? m[1] : null;
        } catch (err) {
          const detail = (err.stderr || err.message || '').toString().trim();
          if (err.code === 126 || /dismissed|Not authorized/i.test(detail)) {
            throw new Error('Administrator permission was not granted, so the drive was not changed.');
          }
          throw new Error(`Failed to repartition/format drive: ${detail}`);
        }
        if (!targetPartition || !this.isSafeLinuxDevicePath(targetPartition)) {
          throw new Error(`Formatted, but could not identify the new partition (${targetPartition || 'none'}).`);
        }

        // 7. Mount the new partition explicitly so the app gets a real writable mountpoint.
        console.log(`Mounting ${targetPartition}...`);
        try {
          await this.safeExec('udisksctl', ['mount', '-b', targetPartition]);
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

        // FAT32 labels are limited to 11 characters; newfs_msdos rejects longer ones.
        const label = fsNorm === 'fat32' ? 'WIKIPREP' : 'WikiPrepared';
        const fsType = fsNorm === 'exfat' ? 'ExFAT' : 'MS-DOS FAT32';

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
          ? ['eraseDisk', fsType, label, 'MBRFormat', wholeDisk || deviceNode]
          : ['eraseVolume', fsType, label, deviceNode];

        console.log('Executing: diskutil', cmd.join(' '));
        await this.safeExec('diskutil', cmd, { timeout: 300000 });
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
        // FAT32 labels max out at 11 characters (Format-Volume errors otherwise).
        const label = fsNorm === 'fat32' ? 'WIKIPREP' : 'WikiPrepared';
        const letterOnly = driveLetter.replace(':', '');
        if (!/^[A-Z]$/.test(letterOnly)) throw new Error(`Invalid drive letter: ${driveLetter}`);

        // letterOnly is regex-validated and fsType/label are constants.
        const formatCommand = `$ErrorActionPreference='Stop'; Format-Volume -DriveLetter '${letterOnly}' -FileSystem ${fsType} -NewFileSystemLabel '${label}' -Force -Confirm:$false | Out-Null`;
        try {
          await this.safeExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', formatCommand], { timeout: 300000 });
        } catch (e) {
          const detail = `${e.stderr || ''} ${e.message || ''}`;
          if (!/access|denied|privilege|administrator|0x80070005|elevat/i.test(detail)) {
            throw new Error(`Windows could not format ${driveLetter}: ${detail.trim()}`);
          }
          // The app normally runs unelevated, so Format-Volume is refused.
          // Ask for elevation (UAC prompt) for just this one command.
          const encoded = Buffer.from(formatCommand, 'utf16le').toString('base64');
          const elevate = `$ErrorActionPreference='Stop'; $p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'; exit $p.ExitCode`;
          try {
            await this.safeExec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', elevate], { timeout: 600000 });
          } catch (e2) {
            const d2 = `${e2.stderr || ''} ${e2.message || ''}`;
            if (/cancel/i.test(d2)) {
              throw new Error('Administrator permission was not granted, so the drive was not changed.');
            }
            throw new Error(`Windows formatting failed even with administrator rights: ${d2.trim()}`);
          }
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
      this.invalidateVolumeMeta();
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
            const pknameOutput = await this.safeExec('lsblk', ['-no', 'pkname', drivePath]);
            const parent = pknameOutput.trim().split('\n')[0].trim();
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
            const lsblkOutput = await Promise.race([
              this.safeExec('lsblk', ['-ln', '-o', 'NAME,MOUNTPOINT', `/dev/${blockDevice}`]),
              new Promise((_, reject) => setTimeout(() => reject(new Error('lsblk timeout')), 5000))
            ]);

            const lines = lsblkOutput.trim().split('\n').map((l) => l.trim()).filter(Boolean);
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
                this.safeExec('udisksctl', ['unmount', '-b', partPath]),
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
                  this.safeExec('udisksctl', ['unmount', '-b', partPath, '--force']),
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
                    this.safeExec('pkexec', ['umount', '-l', partPath]),
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
              this.safeExec('udisksctl', ['power-off', '-b', `/dev/${blockDevice}`]),
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
            await this.safeExec('diskutil', ['eject', target]);
          } catch (e) {
            await this.safeExec('diskutil', ['unmountDisk', target]);
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
            // driveLetter is regex-validated ([A-Za-z]:) by resolveWindowsDriveLetter,
            // but we pass it as an argv element (no shell) for defense in depth.
            const letterOnly = driveLetter.replace(':', '');
            try {
              await this.safeExec('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command',
                `(New-Object -comObject Shell.Application).NameSpace(17).ParseName('${letterOnly}').InvokeVerb('Eject')`,
              ]);
            } catch (e) {
              // Fallback: dismount/remove mount point (often requires admin).
              try {
                await this.safeExec('mountvol', [driveLetter, '/p']);
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
