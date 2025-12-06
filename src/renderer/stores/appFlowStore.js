import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Helper function to calculate reader sizes
// Using a safe upper bound (250MB) to prevent out-of-space errors
// as actual binary sizes vary and are often larger than historical averages
const SAFE_READER_SIZE = 250 * 1024 * 1024;

function calculateReaderSize(platforms) {
  return platforms.length * SAFE_READER_SIZE;
}

export const useAppFlowStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Current state
        currentStep: '/start',
        userIntent: null, // 'update' | 'create-new'
        selectedDrive: null,
        selectedZims: [],
        selectedReaders: ['windows', 'linux', 'macos', 'android'], // All by default
        downloadStrategy: null, // 'local-first' | 'direct-to-usb'

        // Download/transfer state
        downloads: [],
        transferProgress: 0,
        isProcessing: false,

        // Computed values
        getTotalSize: () => {
          const state = get();
          const zimSize = state.selectedZims.reduce((acc, zim) => acc + zim.size, 0);
          const readerSize = calculateReaderSize(state.selectedReaders);
          return zimSize + readerSize;
        },

        getZimSize: () => {
          const state = get();
          return state.selectedZims.reduce((acc, zim) => acc + zim.size, 0);
        },

        getReaderSize: () => {
          const state = get();
          return calculateReaderSize(state.selectedReaders);
        },

        getAvailableSpace: () => {
          const state = get();
          // Return usable space (approx 95% of raw bytes to account for filesystem overhead)
          return state.selectedDrive ? Math.floor(state.selectedDrive.size * 0.95) : 0;
        },

        hasEnoughSpace: () => {
          const state = get();
          if (!state.selectedDrive) return true; // Local download
          
          const totalSize = state.getTotalSize();
          const availableSpace = state.selectedDrive.freeSpace || state.selectedDrive.size;
          
          // Apply a 5% safety margin to the available space
          // This prevents 99% full failures due to block size alignment/overhead
          const safeAvailableSpace = Math.floor(availableSpace * 0.95);
          
          return totalSize <= safeAvailableSpace;
        },

        // Actions
        setUserIntent: (intent) => set({ userIntent: intent }),

        selectDrive: (drive) => set({ selectedDrive: drive }),

        toggleZim: (zim) => set((state) => {
          const exists = state.selectedZims.find(z => z.filename === zim.filename);
          if (exists) {
            return {
              selectedZims: state.selectedZims.filter(z => z.filename !== zim.filename)
            };
          } else {
            return {
              selectedZims: [...state.selectedZims, zim]
            };
          }
        }),

        removeZim: (zimFilename) => set((state) => ({
          selectedZims: state.selectedZims.filter(z => z.filename !== zimFilename)
        })),

        clearSelectedZims: () => set({ selectedZims: [] }),

        toggleReader: (platform) => set((state) => {
          const exists = state.selectedReaders.includes(platform);
          if (exists) {
            return {
              selectedReaders: state.selectedReaders.filter(p => p !== platform)
            };
          } else {
            return {
              selectedReaders: [...state.selectedReaders, platform]
            };
          }
        }),

        setDownloadStrategy: (strategy) => set({ downloadStrategy: strategy }),

        setCurrentStep: (step) => set({ currentStep: step }),

        setDownloads: (downloads) => set({ downloads }),

        setTransferProgress: (progress) => set({ transferProgress: progress }),

        setIsProcessing: (isProcessing) => set({ isProcessing }),

        reset: () => set({
          currentStep: '/start',
          userIntent: null,
          selectedDrive: null,
          selectedZims: [],
          selectedReaders: ['windows', 'linux', 'macos', 'android'],
          downloadStrategy: null,
          downloads: [],
          transferProgress: 0,
          isProcessing: false
        }),

        // Reset only flow, keep selections for "start over"
        softReset: () => set({
          currentStep: '/start',
          downloads: [],
          transferProgress: 0,
          isProcessing: false
        })
      }),
      {
        name: 'app-flow-storage',
        partialize: (state) => ({
          // Only persist user preferences
          selectedReaders: state.selectedReaders
        })
      }
    ),
    { name: 'AppFlow' }
  )
);
