import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useDrivesStore = create(
  devtools(
    (set, get) => ({
      drives: [],
      isScanning: false,
      lastScan: null,
      isWatching: false,

      // Actions
      scanDrives: async () => {
        set({ isScanning: true });
        try {
          const drives = await window.electronAPI.invoke('drives:list');
          set({
            drives,
            lastScan: Date.now(),
            isScanning: false
          });
          return drives;
        } catch (error) {
          console.error('Failed to scan drives:', error);
          set({ isScanning: false });
          throw error;
        }
      },

      startWatching: () => {
        if (get().isWatching) return;

        window.electronAPI.invoke('drives:watch-start');

        // Listen for drive changes
        window.electronAPI.on('drives:changed', (drives) => {
          console.log('Drives changed:', drives);
          set({ drives, lastScan: Date.now() });
        });

        set({ isWatching: true });
      },

      stopWatching: () => {
        window.electronAPI.invoke('drives:watch-stop');
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

      // Check if drive supports large files
      supportsLargeFiles: (drive) => {
        const largeFileFS = ['exFAT', 'NTFS', 'ext4', 'APFS', 'HFS+'];
        return largeFileFS.includes(drive.filesystem);
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
