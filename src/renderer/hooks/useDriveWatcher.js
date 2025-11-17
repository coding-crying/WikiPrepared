import { useEffect } from 'react';
import { useDrivesStore } from '../stores/drivesStore';

/**
 * Hook to automatically scan and watch for drive changes
 */
export function useDriveWatcher() {
  const { startWatching, stopWatching, scanDrives } = useDrivesStore();

  useEffect(() => {
    // Initial scan
    scanDrives();

    // Start watching for changes
    startWatching();

    // Cleanup
    return () => {
      stopWatching();
    };
  }, []);

  return useDrivesStore(state => ({
    drives: state.drives,
    isScanning: state.isScanning,
    lastScan: state.lastScan
  }));
}
