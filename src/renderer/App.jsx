import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import useStore from './store';
import { IPC_CHANNELS } from '../shared/ipc-channels';

// Views
import DashboardView from './views/DashboardView';
import ZimBrowserView from './views/ZimBrowserView';
import DownloadManagerView from './views/DownloadManagerView';
import FlashUSBView from './views/FlashUSBView';
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

  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    // Check if electronAPI is available
    if (typeof window.electronAPI === 'undefined') {
      console.error('window.electronAPI is not defined! Preload script may not have loaded.');
      setApiError('Electron API not available. Please restart the application.');
      return;
    }

    setApiReady(true);

    // Initialize app
    initializeApp();

    // Set up drive monitoring
    startDriveWatching();

    // Set up download progress listeners
    setupDownloadListeners();

    // Cleanup on unmount
    return () => {
      if (window.electronAPI?.invoke) {
        window.electronAPI.invoke(IPC_CHANNELS.DRIVES_WATCH_STOP).catch(err => {
          console.error('Error stopping drive watch:', err);
        });
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      if (!window.electronAPI?.getAppVersion) {
        throw new Error('electronAPI.getAppVersion not available');
      }

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
      if (!window.electronAPI?.invoke) {
        throw new Error('electronAPI.invoke not available');
      }
      const drives = await window.electronAPI.invoke(IPC_CHANNELS.DRIVES_LIST);
      setDrives(drives);
    } catch (error) {
      console.error('Error loading drives:', error);
    }
  };

  const loadSettings = async () => {
    try {
      if (!window.electronAPI?.invoke) {
        throw new Error('electronAPI.invoke not available');
      }
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
      if (!window.electronAPI?.invoke || !window.electronAPI?.on) {
        throw new Error('electronAPI methods not available');
      }

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
    if (!window.electronAPI?.on) {
      console.error('electronAPI.on not available, cannot setup download listeners');
      return;
    }

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

  // Show error screen if API is not available
  if (apiError) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorContent}>
          <div style={styles.errorIcon}>⚠️</div>
          <h1 style={styles.errorTitle}>Application Error</h1>
          <p style={styles.errorMessage}>{apiError}</p>
          <p style={styles.errorHint}>
            The preload script did not load correctly. This usually happens when:
          </p>
          <ul style={styles.errorList}>
            <li>The application was not started correctly (use <code>npm start</code>)</li>
            <li>Webpack configuration issues</li>
            <li>Electron Forge is not properly configured</li>
          </ul>
          <button
            style={styles.reloadButton}
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  // Show loading screen while API initializes
  if (!apiReady) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>⏳</div>
        <p style={styles.loadingText}>Initializing application...</p>
      </div>
    );
  }

  // Determine basename for router (handle /main_window/ path from webpack dev server)
  const basename = window.location.pathname.includes('/main_window') ? '/main_window' : '';

  return (
    <Router basename={basename}>
      <div style={styles.app}>
        <Navigation />
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/zim-browser" element={<ZimBrowserView />} />
            <Route path="/downloads" element={<DownloadManagerView />} />
            <Route path="/flash-usb" element={<FlashUSBView />} />
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
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  errorContent: {
    maxWidth: '600px',
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  errorTitle: {
    margin: '0 0 16px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#d32f2f',
  },
  errorMessage: {
    margin: '0 0 20px 0',
    fontSize: '16px',
    color: '#424242',
  },
  errorHint: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#616161',
    textAlign: 'left',
  },
  errorList: {
    margin: '0 0 24px 0',
    padding: '0 0 0 20px',
    textAlign: 'left',
    fontSize: '14px',
    color: '#616161',
    lineHeight: '1.6',
  },
  reloadButton: {
    padding: '12px 24px',
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  loadingSpinner: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  loadingText: {
    fontSize: '16px',
    color: '#616161',
  },
};

export default App;
