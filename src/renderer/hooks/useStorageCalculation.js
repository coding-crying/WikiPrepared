import { useMemo } from 'react';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useDrivesStore } from '../stores/drivesStore';
import { READER_SIZES } from '../utils/constants';

/**
 * Hook to calculate storage requirements
 */
export function useStorageCalculation() {
  const selectedZims = useAppFlowStore(state => state.selectedZims);
  const selectedReaders = useAppFlowStore(state => state.selectedReaders);
  const selectedDrive = useAppFlowStore(state => state.selectedDrive);
  const allDrives = useDrivesStore(state => state.drives);

  return useMemo(() => {
    // Calculate ZIM size
    const zimSize = selectedZims.reduce((acc, zim) => acc + (zim.size || 0), 0);

    // Calculate reader size
    const readerSize = selectedReaders.reduce(
      (acc, platform) => acc + (READER_SIZES[platform] || 0),
      0
    );

    // Total size needed
    const totalSize = zimSize + readerSize;

    // Available space
    let availableSpace;
    let usedSpace = 0;

    if (selectedDrive) {
      // USB drive selected - use its capacity
      availableSpace = selectedDrive.size;
      usedSpace = selectedDrive.used || 0;
    } else {
      // Local download - find system drive (mounted at / or C:\)
      const systemDrive = allDrives.find(d => {
        const mountpoints = d.mountpoints || [];
        return mountpoints.some(mp => mp.path === '/' || mp.path === 'C:\\' || mp.path === 'C:/');
      });

      if (systemDrive) {
        availableSpace = systemDrive.size;
        usedSpace = systemDrive.used || 0;
      } else {
        // Fallback: estimate 500GB for system drive
        availableSpace = 500 * 1024 * 1024 * 1024; // 500 GB in bytes
        usedSpace = 0;
      }
    }

    // Free space after selection
    const freeSpace = availableSpace - usedSpace - totalSize;

    // Check if there's enough space
    const hasSpace = totalSize <= (availableSpace - usedSpace);

    // Calculate percentage used
    const percentUsed = availableSpace > 0
      ? ((usedSpace + totalSize) / availableSpace) * 100
      : 0;

    return {
      zimSize,
      readerSize,
      totalSize,
      availableSpace,
      usedSpace,
      freeSpace,
      hasSpace,
      percentUsed,
      isLocalDownload: !selectedDrive
    };
  }, [selectedZims, selectedReaders, selectedDrive, allDrives]);
}
