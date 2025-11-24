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

    // Available space - use freeSpace if available (accounts for existing content)
    let totalCapacity;
    let usedSpace = 0;
    let freeSpace = 0;

    if (selectedDrive) {
      // USB drive selected - use actual free space if available
      totalCapacity = selectedDrive.size || 0;
      usedSpace = selectedDrive.usedSpace || 0;
      freeSpace = selectedDrive.freeSpace || (totalCapacity - usedSpace);
    } else {
      // Local download - find system drive (mounted at / or C:\)
      const systemDrive = allDrives.find(d => {
        const mountpoints = d.mountpoints || [];
        return mountpoints.some(mp => mp.path === '/' || mp.path === 'C:\\' || mp.path === 'C:/');
      });

      if (systemDrive) {
        totalCapacity = systemDrive.size || 0;
        usedSpace = systemDrive.usedSpace || 0;
        freeSpace = systemDrive.freeSpace || (totalCapacity - usedSpace);
      } else {
        // Fallback: estimate 500GB for system drive
        totalCapacity = 500 * 1024 * 1024 * 1024; // 500 GB in bytes
        usedSpace = 0;
        freeSpace = totalCapacity;
      }
    }

    // Remaining free space after selection
    const remainingSpace = freeSpace - totalSize;

    // Check if there's enough space (compare against actual free space, not total capacity)
    const hasSpace = totalSize <= freeSpace;

    // Calculate percentage used (of total capacity)
    const percentUsed = totalCapacity > 0
      ? ((usedSpace + totalSize) / totalCapacity) * 100
      : 0;

    return {
      zimSize,
      readerSize,
      totalSize,
      availableSpace: freeSpace, // Available = free space (for backward compatibility)
      totalCapacity,
      usedSpace,
      freeSpace,
      remainingSpace,
      hasSpace,
      percentUsed,
      isLocalDownload: !selectedDrive
    };
  }, [selectedZims, selectedReaders, selectedDrive, allDrives]);
}
