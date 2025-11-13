import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// Views
import DashboardView from './views/DashboardView';
import ZimBrowserView from './views/ZimBrowserView';
import DownloadManagerView from './views/DownloadManagerView';
import UpdateManagerView from './views/UpdateManagerView';
import KiwixReaderView from './views/KiwixReaderView';
import SettingsView from './views/SettingsView';

// Components
import Navigation from './components/Navigation';
import Notifications from './components/Notifications';

/**
 * Main Application Component
 *
 * Features:
 * - Tab-based navigation with React Router
 * - Zustand state management
 * - Real-time drive monitoring
 * - Download progress tracking
 * - Notification system
 */
function App() {
  const {
    setDrives,
    setAppVersion,
    setPlatform,
    updateDownloadProgress,
    addNotification
  } = useStore();

  useEffect(() => {
    // Initialize app
    initializeApp();

    // Set up drive monitoring
    startDriveWatching();

    // Set up download progress listeners
    setupDownloadListeners();

    // Cleanup on unmount
    return () => {
      window.electronAPI.invoke(IPC_CHANNELS.DRIVES_WATCH_STOP);
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Load app version
      const version = await window.electronAPI.getAppVersion();
      setAppVersion(version);

      // Get platform
      const platform = window.electronAPI.platform;
      setPlatform(platform);

      // Load initial drives
      await loadDrives();

      // Load settings
      await loadSettings();
    } catch (error) {
      console.error('Error initializing app:', error);
      addNotification({
        type: 'error',
        message: 'Failed to initialize application',
        details: error.message
      });
    }
  };

  const loadDrives = async () => {
    try {
      const drives = await window.electronAPI.invoke(IPC_CHANNELS.DRIVES_LIST);
      setDrives(drives);
    } catch (error) {
      console.error('Error loading drives:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.invoke(IPC_CHANNELS.SETTINGS_GET);
      if (settings) {
        useStore.getState().setSettings(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const startDriveWatching = async () => {
    try {
      // Start watching for drive changes
      await window.electronAPI.invoke(IPC_CHANNELS.DRIVES_WATCH_START);

      // Listen for drive change events
      window.electronAPI.on(IPC_CHANNELS.DRIVES_CHANGED, (drives) => {
        console.log('Drives changed:', drives);
        setDrives(drives);
        addNotification({
          type: 'info',
          message: 'USB drives updated',
          duration: 3000
        });
      });
    } catch (error) {
      console.error('Error starting drive watch:', error);
    }
  };

  const setupDownloadListeners = () => {
    // Download progress events
    window.electronAPI.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, (data) => {
      const { downloadId, progress } = data;
      updateDownloadProgress(downloadId, progress);
    });

    // Download completed events
    window.electronAPI.on(IPC_CHANNELS.DOWNLOAD_COMPLETED, (data) => {
      const { downloadId, filename } = data;
      updateDownloadProgress(downloadId, { status: 'completed', progress: 100 });
      addNotification({
        type: 'success',
        message: `Download completed: ${filename}`,
        duration: 5000
      });
    });

    // Download error events
    window.electronAPI.on(IPC_CHANNELS.DOWNLOAD_ERROR, (data) => {
      const { downloadId, error } = data;
      updateDownloadProgress(downloadId, { status: 'error', error: error.message });
      addNotification({
        type: 'error',
        message: `Download failed: ${error.message}`,
        duration: 7000
      });
    });
  };

  return (
    <Router>
      <div style={styles.app}>
        <Navigation />
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/zim-browser" element={<ZimBrowserView />} />
            <Route path="/downloads" element={<DownloadManagerView />} />
            <Route path="/updates" element={<UpdateManagerView />} />
            <Route path="/kiwix-reader" element={<KiwixReaderView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Routes>
        </main>
        <Notifications />
      </div>
    </Router>
  );
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflow: 'auto',
  },
};

export default App;
