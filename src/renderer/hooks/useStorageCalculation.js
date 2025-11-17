import { useMemo } from 'react';
import { useAppFlowStore } from '../stores/appFlowStore';
import { READER_SIZES } from '../utils/constants';

/**
 * Hook to calculate storage requirements
 */
export function useStorageCalculation() {
  const selectedZims = useAppFlowStore(state => state.selectedZims);
  const selectedReaders = useAppFlowStore(state => state.selectedReaders);
  const selectedDrive = useAppFlowStore(state => state.selectedDrive);

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

    // Available space (Infinity if no drive selected, i.e., local download)
    const availableSpace = selectedDrive ? selectedDrive.size : Infinity;

    // Used space on drive (if updating existing stick)
    const usedSpace = selectedDrive ? (selectedDrive.used || 0) : 0;

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
  }, [selectedZims, selectedReaders, selectedDrive]);
}
