import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '../shared/ipc-channels';

/**
 * Main Application Component
 *
 * This is a minimal MVP version to demonstrate the basic structure.
 * Full UI will be implemented in future sprints.
 */
function App() {
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Load initial data
    loadDrives();
    loadAppVersion();

    // Watch for drive changes
    window.electronAPI.invoke(IPC_CHANNELS.DRIVES_WATCH_START);

    // Listen for drive change events
    const unsubscribe = window.electronAPI.on(IPC_CHANNELS.DRIVES_CHANGED, (updatedDrives) => {
      console.log('Drives changed:', updatedDrives);
      setDrives(updatedDrives);
    });

    // Cleanup
    return () => {
      window.electronAPI.invoke(IPC_CHANNELS.DRIVES_WATCH_STOP);
      unsubscribe();
    };
  }, []);

  const loadDrives = async () => {
    try {
      setLoading(true);
      const driveList = await window.electronAPI.invoke(IPC_CHANNELS.DRIVES_LIST);
      setDrives(driveList);
    } catch (error) {
      console.error('Error loading drives:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppVersion = async () => {
    try {
      const version = await window.electronAPI.getAppVersion();
      setAppVersion(version);
    } catch (error) {
      console.error('Error loading app version:', error);
    }
  };

  const handleScanDrive = async (drive) => {
    try {
      const zimFiles = await window.electronAPI.invoke(IPC_CHANNELS.DRIVES_SCAN, drive.mountpoint);
      console.log('Found ZIM files:', zimFiles);
      alert(`Found ${zimFiles.length} ZIM files on drive ${drive.label}`);
    } catch (error) {
      console.error('Error scanning drive:', error);
      alert('Error scanning drive: ' + error.message);
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1>Kiwix USB Updater</h1>
        <span style={styles.version}>v{appVersion}</span>
      </header>

      <main style={styles.main}>
        <section style={styles.section}>
          <h2>Connected USB Drives</h2>

          {loading ? (
            <p>Loading drives...</p>
          ) : drives.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No USB drives detected</p>
              <p style={styles.hint}>
                Please connect a USB drive to get started
              </p>
            </div>
          ) : (
            <div style={styles.driveList}>
              {drives.map((drive, index) => (
                <div key={index} style={styles.driveCard}>
                  <div style={styles.driveInfo}>
                    <h3>{drive.label || drive.displayName}</h3>
                    <p style={styles.driveDetail}>
                      {drive.mountpoint || drive.device}
                    </p>
                    <p style={styles.driveDetail}>
                      Size: {formatBytes(drive.size)}
                    </p>
                    {drive.isUSB && (
                      <span style={styles.badge}>USB</span>
                    )}
                  </div>
                  <div style={styles.driveActions}>
                    <button
                      style={styles.button}
                      onClick={() => handleScanDrive(drive)}
                    >
                      Scan for ZIMs
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={styles.section}>
          <h2>Quick Start</h2>
          <div style={styles.quickStart}>
            <div style={styles.quickStartItem}>
              <h3>1. Connect USB Drive</h3>
              <p>Plug in your USB drive and it will appear above</p>
            </div>
            <div style={styles.quickStartItem}>
              <h3>2. Scan for ZIMs</h3>
              <p>Click "Scan for ZIMs" to see what's already on your drive</p>
            </div>
            <div style={styles.quickStartItem}>
              <h3>3. Download & Install</h3>
              <p>Browse Wikipedia ZIMs and download them to your drive</p>
              <p style={styles.hint}>(Full UI coming in next sprint)</p>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h2>Development Status</h2>
          <div style={styles.statusGrid}>
            <StatusItem status="complete" label="Project Setup" />
            <StatusItem status="complete" label="Drive Detection" />
            <StatusItem status="complete" label="ZIM Scanning" />
            <StatusItem status="pending" label="ZIM Catalog Browser" />
            <StatusItem status="pending" label="Download Manager" />
            <StatusItem status="pending" label="Update Detection" />
            <StatusItem status="pending" label="Kiwix Reader Install" />
            <StatusItem status="pending" label="Full UI/UX" />
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <p>Kiwix USB Updater - Making offline Wikipedia accessible</p>
        <p style={styles.hint}>
          Data from: <a href="https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/" target="_blank" rel="noreferrer">Wikimedia Dumps</a>
        </p>
      </footer>
    </div>
  );
}

function StatusItem({ status, label }) {
  const color = status === 'complete' ? '#4caf50' : '#9e9e9e';
  const icon = status === 'complete' ? '✓' : '○';

  return (
    <div style={{ ...styles.statusItem, color }}>
      <span style={styles.statusIcon}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196f3',
    color: 'white',
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  version: {
    opacity: 0.8,
    fontSize: '14px',
  },
  main: {
    flex: 1,
    padding: '20px 40px',
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
  },
  section: {
    backgroundColor: 'white',
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#757575',
  },
  hint: {
    fontSize: '14px',
    color: '#9e9e9e',
    marginTop: '8px',
  },
  driveList: {
    display: 'grid',
    gap: '16px',
  },
  driveCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  driveInfo: {
    flex: 1,
  },
  driveDetail: {
    fontSize: '14px',
    color: '#616161',
    margin: '4px 0',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#4caf50',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    marginTop: '8px',
  },
  driveActions: {
    marginLeft: '16px',
  },
  button: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  quickStart: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  quickStartItem: {
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
  },
  statusIcon: {
    marginRight: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  footer: {
    backgroundColor: '#424242',
    color: 'white',
    padding: '20px 40px',
    textAlign: 'center',
  },
};

export default App;
