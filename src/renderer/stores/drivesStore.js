import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Check if electronAPI is available
const checkElectronAPI = () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    console.error('electronAPI is not available. Make sure preload script is loaded.');
    return false;
  }
  return true;
};

export const useDrivesStore = create(
  devtools(
    (set, get) => ({
      drives: [],
      driveZims: {}, // Map of device -> array of ZIM files found
      driveUpdates: {}, // Map of device -> array of updates available
      isScanning: false,
      lastScan: null,
      isWatching: false,

      // Actions
      scanDrives: async () => {
        if (!checkElectronAPI()) {
          console.warn('Skipping drive scan - electronAPI not available');
          set({ isScanning: false });
          return [];
        }

        set({ isScanning: true });
        try {
          const drives = await window.electronAPI.invoke('drives:list');
          set({
            drives,
            lastScan: Date.now(),
            isScanning: false
          });

          // Scan each drive for ZIMs in background (don't block)
          get().scanDrivesForZims(drives);

          return drives;
        } catch (error) {
          console.error('Failed to scan drives:', error);
          set({ isScanning: false });
          throw error;
        }
      },

      // Scan drives for existing ZIM files
      scanDrivesForZims: async (drives) => {
        if (!checkElectronAPI()) return;

        const driveZims = {};
        const driveUpdates = {};

        for (const drive of drives) {
          const mountpoint = drive.mountpoints?.[0]?.path || drive.mountpoint;
          // Skip drives without valid mount points or system paths
          if (!mountpoint || mountpoint.includes('[') || mountpoint === '/') continue;

          try {
            const zims = await window.electronAPI.invoke('drives:scan', mountpoint);
            if (zims && zims.length > 0) {
              driveZims[drive.device] = zims;
              
              // Update check disabled for now as it was showing false positives
              // driveUpdates[drive.device] = ...
            }
          } catch (error) {
            // Silently ignore scan errors - drive may not be accessible
          }
        }

        set({ driveZims, driveUpdates });
      },

      // Get ZIM count for a drive
      getZimCount: (devicePath) => {
        const zims = get().driveZims[devicePath];
        return zims ? zims.length : 0;
      },

      // Get update count for a drive
      getUpdateCount: (devicePath) => {
        const updates = get().driveUpdates[devicePath];
        return updates ? updates.length : 0;
      },

      // Get ZIMs for a specific drive
      getDriveZims: (devicePath) => {
        return get().driveZims[devicePath] || [];
      },

      startWatching: () => {
        if (!checkElectronAPI()) {
          console.warn('Skipping drive watching - electronAPI not available');
          return;
        }

        if (get().isWatching) return;

        window.electronAPI.invoke('drives:watch:start');

        // Listen for drive changes
        window.electronAPI.on('drives:changed', (drives) => {
          console.log('Drives changed:', drives);
          set({ drives, lastScan: Date.now() });
          // Re-scan for ZIMs when drives change
          get().scanDrivesForZims(drives);
        });

        set({ isWatching: true });
      },

      stopWatching: () => {
        if (!checkElectronAPI()) return;

        window.electronAPI.invoke('drives:watch:stop');
        window.electronAPI.off('drives:changed');
        set({ isWatching: false });
      },

      // Get drive by device path
      getDrive: (devicePath) => {
        return get().drives.find(d => d.device === devicePath);
      },

      // Get USB drives only
      getUsbDrives: () => {
        return get().drives.filter(d => d.isUSB);
      },

      // Check if drive supports large files (case insensitive)
      supportsLargeFiles: (drive) => {
        // Import dynamically to avoid circular dependency
        const fs = drive.filesystem?.toLowerCase();
        const supportedFS = ['exfat', 'ntfs', 'ext4', 'ext3', 'ext2', 'btrfs', 'xfs', 'zfs', 'apfs', 'hfs+', 'hfsplus', 'fuseblk'];
        return supportedFS.includes(fs);
      },

      // Check if drive is large enough (64GB+)
      isLargeEnough: (drive, minSizeGB = 64) => {
        const sizeGB = drive.size / (1024 ** 3);
        return sizeGB >= minSizeGB;
      }
    }),
    { name: 'Drives' }
  )
);
