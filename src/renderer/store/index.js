/**
 * Zustand Store - Centralized State Management
 *
 * This store manages all application state including:
 * - USB drives
 * - ZIM catalog and filters
 * - Downloads
 * - Settings
 * - UI state
 */

import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ============================================
  // DRIVES STATE
  // ============================================
  drives: [],
  selectedDrive: null,
  drivesLoading: false,
  drivesError: null,

  setDrives: (drives) => set({ drives }),
  setSelectedDrive: (drive) => set({ selectedDrive: drive }),
  setDrivesLoading: (loading) => set({ drivesLoading: loading }),
  setDrivesError: (error) => set({ drivesError: error }),

  // ============================================
  // ZIM CATALOG STATE
  // ============================================
  zimCatalog: [],
  filteredZims: [],
  catalogLoading: false,
  catalogError: null,
  catalogLastFetched: null,

  // Filters
  filters: {
    language: '',
    scope: '',
    topic: '',
    minSize: 0,
    maxSize: Infinity,
    minDate: '',
    maxDate: '',
    searchTerm: ''
  },

  sortBy: 'name', // name, size, date, language

  setZimCatalog: (catalog) => set({
    zimCatalog: catalog,
    filteredZims: get().applyFilters(catalog),
    catalogLastFetched: new Date()
  }),

  setCatalogLoading: (loading) => set({ catalogLoading: loading }),
  setCatalogError: (error) => set({ catalogError: error }),

  setFilter: (filterName, value) => set((state) => ({
    filters: { ...state.filters, [filterName]: value },
    filteredZims: state.applyFilters(state.zimCatalog)
  })),

  resetFilters: () => set((state) => ({
    filters: {
      language: '',
      scope: '',
      topic: '',
      minSize: 0,
      maxSize: Infinity,
      minDate: '',
      maxDate: '',
      searchTerm: ''
    },
    filteredZims: state.zimCatalog
  })),

  setSortBy: (sortBy) => set({ sortBy }),

  // Apply filters to catalog
  applyFilters: (catalog) => {
    const { filters, sortBy } = get();

    let filtered = catalog.filter(zim => {
      // Language filter
      if (filters.language && zim.language !== filters.language) return false;

      // Scope filter
      if (filters.scope && zim.scope !== filters.scope) return false;

      // Topic filter
      if (filters.topic && zim.topic !== filters.topic) return false;

      // Size filter
      if (zim.size < filters.minSize || zim.size > filters.maxSize) return false;

      // Date filter
      if (filters.minDate && zim.date < filters.minDate) return false;
      if (filters.maxDate && zim.date > filters.maxDate) return false;

      // Search term
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const searchable = `${zim.filename} ${zim.description} ${zim.languageName}`.toLowerCase();
        if (!searchable.includes(term)) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'size':
          return b.size - a.size;
        case 'date':
          return b.date.localeCompare(a.date);
        case 'language':
          return a.languageName.localeCompare(b.languageName);
        default:
          return 0;
      }
    });

    return filtered;
  },

  // ============================================
  // DOWNLOADS STATE
  // ============================================
  downloads: {},
  downloadQueue: [],

  setDownload: (downloadId, downloadData) => set((state) => ({
    downloads: { ...state.downloads, [downloadId]: downloadData }
  })),

  updateDownloadProgress: (downloadId, progress) => set((state) => ({
    downloads: {
      ...state.downloads,
      [downloadId]: { ...state.downloads[downloadId], ...progress }
    }
  })),

  removeDownload: (downloadId) => set((state) => {
    const newDownloads = { ...state.downloads };
    delete newDownloads[downloadId];
    return { downloads: newDownloads };
  }),

  clearCompletedDownloads: () => set((state) => {
    const newDownloads = {};
    Object.entries(state.downloads).forEach(([id, download]) => {
      if (download.status !== 'completed') {
        newDownloads[id] = download;
      }
    });
    return { downloads: newDownloads };
  }),

  // ============================================
  // UPDATE MANAGER STATE
  // ============================================
  installedZims: [],
  availableUpdates: [],
  updateScanLoading: false,
  updateCheckLoading: false,

  setInstalledZims: (zims) => set({ installedZims: zims }),
  setAvailableUpdates: (updates) => set({ availableUpdates: updates }),
  setUpdateScanLoading: (loading) => set({ updateScanLoading: loading }),
  setUpdateCheckLoading: (loading) => set({ updateCheckLoading: loading }),

  // ============================================
  // KIWIX READER STATE
  // ============================================
  kiwixVersions: {
    windows: null,
    linux: null,
    mac: null
  },
  installedReaders: [],
  kiwixLoading: false,

  setKiwixVersions: (versions) => set({ kiwixVersions: versions }),
  setInstalledReaders: (readers) => set({ installedReaders: readers }),
  setKiwixLoading: (loading) => set({ kiwixLoading: loading }),

  // ============================================
  // SETTINGS STATE
  // ============================================
  settings: {
    downloadPath: '',
    autoDeleteOldVersions: false,
    verifyChecksums: true,
    maxConcurrentDownloads: 2,
    bandwidthLimit: 0,
    updateCheckFrequency: 'manual',
    theme: 'light',
    downloadDirectToUSB: false
  },

  setSetting: (key, value) => set((state) => ({
    settings: { ...state.settings, [key]: value }
  })),

  setSettings: (settings) => set({ settings }),

  // ============================================
  // UI STATE
  // ============================================
  currentTab: 'dashboard',
  notifications: [],

  setCurrentTab: (tab) => set({ currentTab: tab }),

  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, {
      id: Date.now(),
      timestamp: new Date(),
      ...notification
    }]
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] }),

  // ============================================
  // APP STATE
  // ============================================
  appVersion: '',
  platform: '',

  setAppVersion: (version) => set({ appVersion: version }),
  setPlatform: (platform) => set({ platform: platform })
}));

export default useStore;
