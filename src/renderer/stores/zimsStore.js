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

export const useZimsStore = create(
  devtools(
    (set, get) => ({
      catalog: [],
      isLoading: false,
      selectedLanguage: 'en',
      installedZims: [],
      updates: [],
      error: null,

      // Actions
      fetchCatalog: async (forceRefresh = false) => {
        if (!checkElectronAPI()) {
          console.warn('Skipping catalog fetch - electronAPI not available');
          set({ isLoading: false, error: 'electronAPI not available' });
          return [];
        }

        set({ isLoading: true, error: null });
        try {
          const catalog = await window.electronAPI.invoke('zim:fetch-catalog', forceRefresh);
          set({ catalog, isLoading: false });
          return catalog;
        } catch (error) {
          console.error('Failed to fetch catalog:', error);
          set({ isLoading: false, error: error.message });
          throw error;
        }
      },

      setLanguage: (language) => set({ selectedLanguage: language }),

      getFilteredZims: () => {
        const { catalog, selectedLanguage } = get();
        return catalog
          .filter(zim => zim.language === selectedLanguage)
          .sort((a, b) => b.size - a.size); // Sort by size descending
      },

      getAvailableLanguages: () => {
        const { catalog } = get();
        const languages = [...new Set(catalog.map(zim => zim.language))];
        return languages.sort();
      },

      scanInstalledZims: async (drivePath) => {
        if (!checkElectronAPI()) {
          console.warn('Skipping ZIM scan - electronAPI not available');
          return [];
        }

        try {
          const installed = await window.electronAPI.invoke('drives:scan', drivePath);
          set({ installedZims: installed });
          return installed;
        } catch (error) {
          console.error('Failed to scan installed ZIMs:', error);
          set({ error: error.message });
          throw error;
        }
      },

      checkForUpdates: async () => {
        const { installedZims, catalog } = get();
        if (installedZims.length === 0) return [];

        const updates = [];
        const updatedInstalledZims = installedZims.map(installed => {
          // For ZIMs without valid metadata (renamed files), we can't check for updates
          if (!installed.valid || !installed.language || !installed.topic) {
            return { ...installed, hasUpdate: false, isUpToDate: null }; // null = unknown
          }

          const matches = catalog.filter(zim =>
            zim.language === installed.language &&
            zim.topic === installed.topic &&
            zim.scope === installed.scope
          );

          if (matches.length > 0) {
            // Use the newest matching catalog entry by YYYY-MM date.
            const latest = matches.reduce((currentLatest, candidate) => {
              const latestDate = currentLatest?.date || '';
              const candidateDate = candidate?.date || '';
              return candidateDate > latestDate ? candidate : currentLatest;
            }, matches[0]);

            const canCompareByDate = Boolean(installed.date && latest?.date);
            const hasUpdate = canCompareByDate ? latest.date > installed.date : false;
            const isUpToDate = canCompareByDate ? !hasUpdate : null;

            if (hasUpdate) {
              updates.push({
                installed,
                latest,
                sizeDiff: latest.size - installed.size
              });
            }
            return {
              ...installed,
              hasUpdate,
              isUpToDate,
              latestDate: latest?.date || null,
              latestFilename: latest?.filename || null
            };
          }

          // No matching ZIM in catalog (maybe deprecated or custom)
          return { ...installed, hasUpdate: false, isUpToDate: null };
        });

        set({ installedZims: updatedInstalledZims, updates });
        return updates;
      },

      // Get ZIM by filename
      getZim: (filename) => {
        const { catalog } = get();
        return catalog.find(z => z.filename === filename);
      },

      // Mark ZIMs with updates available
      markUpdates: () => {
        const { catalog, updates } = get();
        const updatedCatalog = catalog.map(zim => {
          const hasUpdate = updates.some(u =>
            u.latest.filename === zim.filename
          );
          return { ...zim, hasUpdate };
        });
        set({ catalog: updatedCatalog });
      },

      clearError: () => set({ error: null }),

      reset: () => set({
        selectedLanguage: 'en',
        installedZims: [],
        updates: [],
        error: null
      })
    }),
    { name: 'Zims' }
  )
);
