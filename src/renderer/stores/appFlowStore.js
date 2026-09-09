import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Helper function to calculate reader sizes
// Using a safe upper bound (250MB) to prevent out-of-space errors
// as actual binary sizes vary and are often larger than historical averages
const SAFE_READER_SIZE = 250 * 1024 * 1024;
const DEFAULT_SELECTED_READERS = ['windows', 'linux', 'macos', 'android'];
const LEGACY_READER_ALIASES = { mac: 'macos' };
const VALID_READERS = new Set(DEFAULT_SELECTED_READERS);

function calculateReaderSize(platforms) {
  return platforms.length * SAFE_READER_SIZE;
}

function normalizeSelectedReaders(readers) {
  if (!Array.isArray(readers)) return [...DEFAULT_SELECTED_READERS];

  const normalized = readers
    .map((reader) => LEGACY_READER_ALIASES[reader] || reader)
    .filter((reader) => VALID_READERS.has(reader));

  return Array.from(new Set(normalized));
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
        selectedReaders: [...DEFAULT_SELECTED_READERS], // All by default
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
          // Use free space (not total size) with a 5% safety margin for
          // filesystem overhead and block-size alignment.
          if (!state.selectedDrive) return 0;
          const free = state.selectedDrive.freeSpace ?? state.selectedDrive.size;
          return Math.floor(free * 0.95);
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
          const normalizedPlatform = LEGACY_READER_ALIASES[platform] || platform;
          const normalizedReaders = normalizeSelectedReaders(state.selectedReaders);
          const exists = normalizedReaders.includes(normalizedPlatform);
          if (exists) {
            return {
              selectedReaders: normalizedReaders.filter((p) => p !== normalizedPlatform)
            };
          } else {
            return {
              selectedReaders: [...normalizedReaders, normalizedPlatform]
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
          selectedReaders: [...DEFAULT_SELECTED_READERS],
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
        version: 2,
        migrate: (persistedState, version) => {
          if (!persistedState || typeof persistedState !== 'object') {
            return persistedState;
          }

          // Migrate legacy "mac" key to "macos" and drop duplicates/invalid values.
          if (version < 2) {
            return {
              ...persistedState,
              selectedReaders: normalizeSelectedReaders(persistedState.selectedReaders)
            };
          }

          return {
            ...persistedState,
            selectedReaders: normalizeSelectedReaders(persistedState.selectedReaders)
          };
        },
        partialize: (state) => ({
          // Only persist user preferences
          selectedReaders: normalizeSelectedReaders(state.selectedReaders)
        })
      }
    ),
    { name: 'AppFlow' }
  )
);
