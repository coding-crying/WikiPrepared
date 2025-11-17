import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Helper function to calculate reader sizes
function calculateReaderSize(platforms) {
  const sizes = {
    windows: 80 * 1024 * 1024,    // 80MB
    linux: 90 * 1024 * 1024,       // 90MB
    macos: 100 * 1024 * 1024,      // 100MB
    android: 45 * 1024 * 1024      // 45MB
  };
  return platforms.reduce((acc, platform) => acc + (sizes[platform] || 0), 0);
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
          return state.selectedDrive ? state.selectedDrive.size : 0;
        },

        hasEnoughSpace: () => {
          const state = get();
          if (!state.selectedDrive) return true; // Local download
          return state.getTotalSize() <= state.selectedDrive.size;
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
