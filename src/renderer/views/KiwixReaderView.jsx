import React, { useEffect } from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Kiwix Reader View
 *
 * Install Kiwix reader software to USB drives
 */
function KiwixReaderView() {
  const {
    selectedDrive,
    kiwixVersions,
    installedReaders,
    kiwixLoading,
    platform,
    setKiwixVersions,
    setInstalledReaders,
    setKiwixLoading,
    addNotification,
  } = useStore();

  useEffect(() => {
    loadKiwixVersions();
    if (selectedDrive) {
      detectInstalledReaders();
    }
  }, [selectedDrive]);

  const loadKiwixVersions = async () => {
    try {
      setKiwixLoading(true);
      const versions = await window.electronAPI.invoke(
        IPC_CHANNELS.KIWIX_GET_VERSIONS
      );
      setKiwixVersions(versions);
    } catch (error) {
      console.error('Error loading Kiwix versions:', error);
      addNotification({
        type: 'error',
        message: 'Failed to load Kiwix versions',
        details: error.message
      });
    } finally {
      setKiwixLoading(false);
    }
  };

  const detectInstalledReaders = async () => {
    if (!selectedDrive) return;

    try {
      const readers = await window.electronAPI.invoke(
        IPC_CHANNELS.KIWIX_DETECT_INSTALLED,
        selectedDrive.mountpoint
      );
      setInstalledReaders(readers);
    } catch (error) {
      console.error('Error detecting installed readers:', error);
    }
  };

  const handleInstall = async (targetPlatform) => {
    if (!selectedDrive) {
      addNotification({
        type: 'warning',
        message: 'Please select a USB drive first'
      });
      return;
    }

    try {
      setKiwixLoading(true);
      await window.electronAPI.invoke(
        IPC_CHANNELS.KIWIX_INSTALL,
        targetPlatform,
        selectedDrive.mountpoint
      );
      addNotification({
        type: 'success',
        message: `Successfully installed Kiwix reader for ${targetPlatform}`,
        duration: 5000
      });
      await detectInstalledReaders();
    } catch (error) {
      console.error('Error installing Kiwix reader:', error);
      addNotification({
        type: 'error',
        message: `Failed to install Kiwix reader for ${targetPlatform}`,
        details: error.message
      });
    } finally {
      setKiwixLoading(false);
    }
  };

  const platforms = [
    {
      id: 'windows',
      name: 'Windows',
      icon: '🪟',
      description: 'Portable .exe for Windows PCs',
      color: '#0078d4'
    },
    {
      id: 'linux',
      name: 'Linux',
      icon: '🐧',
      description: 'AppImage for Linux distributions',
      color: '#f7931e'
    },
    {
      id: 'mac',
      name: 'macOS',
      icon: '🍎',
      description: 'Application bundle for Mac',
      color: '#555555'
    }
  ];

  const isInstalled = (platformId) => {
    return installedReaders.some(r => r.platform === platformId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Kiwix Reader Installation</h1>
          <p style={styles.subtitle}>
            Install portable Kiwix reader software to your USB drive
          </p>
        </div>
      </div>

      <div style={styles.content}>
        {!selectedDrive ? (
          <div style={styles.warning}>
            <div style={styles.warningIcon}>⚠️</div>
            <p style={styles.warningText}>No USB drive selected</p>
            <p style={styles.warningHint}>
              Please go to the Dashboard and select a USB drive first
            </p>
          </div>
        ) : (
          <>
            {/* Info Section */}
            <section style={styles.infoSection}>
              <h2 style={styles.infoTitle}>About Kiwix Reader</h2>
              <p style={styles.infoText}>
                Kiwix is a free and open-source offline reader for web content,
                especially designed for Wikipedia and other wikis. Installing the
                reader on your USB drive allows you to browse ZIM files on any
                computer without needing an internet connection.
              </p>
              <div style={styles.infoFeatures}>
                <div style={styles.infoFeature}>
                  <span style={styles.infoFeatureIcon}>✓</span>
                  <span>Portable - runs without installation</span>
                </div>
                <div style={styles.infoFeature}>
                  <span style={styles.infoFeatureIcon}>✓</span>
                  <span>Multi-platform support</span>
                </div>
                <div style={styles.infoFeature}>
                  <span style={styles.infoFeatureIcon}>✓</span>
                  <span>Fast full-text search</span>
                </div>
                <div style={styles.infoFeature}>
                  <span style={styles.infoFeatureIcon}>✓</span>
                  <span>Bookmark and history features</span>
                </div>
              </div>
            </section>

            {/* Platform Selection */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Select Platforms to Install</h2>
              <p style={styles.sectionSubtitle}>
                Choose which platform versions to install. You can install multiple
                versions to support different operating systems.
              </p>

              <div style={styles.platformGrid}>
                {platforms.map((plt) => (
                  <PlatformCard
                    key={plt.id}
                    platform={plt}
                    version={kiwixVersions[plt.id]}
                    isInstalled={isInstalled(plt.id)}
                    isCurrentPlatform={platform === plt.id}
                    isLoading={kiwixLoading}
                    onInstall={() => handleInstall(plt.id)}
                  />
                ))}
              </div>
            </section>

            {/* Installed Readers */}
            {installedReaders.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Installed Readers</h2>
                <div style={styles.installedList}>
                  {installedReaders.map((reader, index) => (
                    <div key={index} style={styles.installedItem}>
                      <div style={styles.installedIcon}>
                        {platforms.find(p => p.id === reader.platform)?.icon}
                      </div>
                      <div style={styles.installedInfo}>
                        <div style={styles.installedName}>
                          Kiwix for {reader.platform}
                        </div>
                        <div style={styles.installedPath}>
                          {reader.installedPath}
                        </div>
                        {reader.version && (
                          <div style={styles.installedVersion}>
                            Version: {reader.version}
                          </div>
                        )}
                      </div>
                      <div style={styles.installedBadge}>
                        ✓ Installed
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Usage Instructions */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Usage Instructions</h2>
              <div style={styles.instructions}>
                <div style={styles.instructionStep}>
                  <div style={styles.stepNumber}>1</div>
                  <div style={styles.stepContent}>
                    <h3 style={styles.stepTitle}>Install Reader(s)</h3>
                    <p style={styles.stepText}>
                      Select and install the Kiwix reader for your target platform(s)
                    </p>
                  </div>
                </div>
                <div style={styles.instructionStep}>
                  <div style={styles.stepNumber}>2</div>
                  <div style={styles.stepContent}>
                    <h3 style={styles.stepTitle}>Add ZIM Files</h3>
                    <p style={styles.stepText}>
                      Use the ZIM Browser to download Wikipedia content to your USB
                    </p>
                  </div>
                </div>
                <div style={styles.instructionStep}>
                  <div style={styles.stepNumber}>3</div>
                  <div style={styles.stepContent}>
                    <h3 style={styles.stepTitle}>Use on Any Computer</h3>
                    <p style={styles.stepText}>
                      Plug in your USB and run the Kiwix reader to access offline Wikipedia
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function PlatformCard({ platform, version, isInstalled, isCurrentPlatform, isLoading, onInstall }) {
  return (
    <div style={styles.platformCard}>
      <div
        style={{
          ...styles.platformHeader,
          borderTopColor: platform.color
        }}
      >
        <div style={{ ...styles.platformIcon, color: platform.color }}>
          {platform.icon}
        </div>
        <div>
          <h3 style={styles.platformName}>{platform.name}</h3>
          {isCurrentPlatform && (
            <div style={styles.currentPlatformBadge}>Current Platform</div>
          )}
        </div>
      </div>

      <p style={styles.platformDescription}>{platform.description}</p>

      {version && (
        <div style={styles.platformVersion}>
          Latest Version: <strong>{version}</strong>
        </div>
      )}

      <button
        style={{
          ...styles.installButton,
          ...(isInstalled ? styles.installButtonInstalled : {}),
          backgroundColor: isInstalled ? '#4caf50' : platform.color
        }}
        onClick={onInstall}
        disabled={isLoading || isInstalled}
      >
        {isInstalled ? '✓ Installed' : isLoading ? '⏳ Installing...' : '⬇️ Install'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '32px',
    fontWeight: '600',
    color: '#212121',
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#757575',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  warning: {
    backgroundColor: '#fff3e0',
    padding: '60px 20px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  warningIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  warningText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#e65100',
    margin: '0 0 8px 0',
  },
  warningHint: {
    fontSize: '14px',
    color: '#ef6c00',
    margin: 0,
  },
  infoSection: {
    backgroundColor: '#e3f2fd',
    padding: '24px',
    borderRadius: '8px',
    borderLeft: '4px solid #2196f3',
  },
  infoTitle: {
    margin: '0 0 12px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1565c0',
  },
  infoText: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#424242',
  },
  infoFeatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  infoFeature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#424242',
  },
  infoFeatureIcon: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: '16px',
  },
  section: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#212121',
  },
  sectionSubtitle: {
    margin: '0 0 20px 0',
    fontSize: '14px',
    color: '#757575',
  },
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  platformCard: {
    padding: '20px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    borderTop: '4px solid',
  },
  platformHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  platformIcon: {
    fontSize: '48px',
  },
  platformName: {
    margin: '0 0 4px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#212121',
  },
  currentPlatformBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  platformDescription: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#616161',
  },
  platformVersion: {
    fontSize: '13px',
    color: '#757575',
    marginBottom: '16px',
  },
  installButton: {
    width: '100%',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  installButtonInstalled: {
    cursor: 'default',
    opacity: 0.8,
  },
  installedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  installedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
  },
  installedIcon: {
    fontSize: '32px',
  },
  installedInfo: {
    flex: 1,
  },
  installedName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#212121',
    marginBottom: '4px',
  },
  installedPath: {
    fontSize: '12px',
    color: '#757575',
    marginBottom: '2px',
  },
  installedVersion: {
    fontSize: '12px',
    color: '#616161',
  },
  installedBadge: {
    padding: '6px 12px',
    backgroundColor: '#4caf50',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
  },
  instructions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  instructionStep: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196f3',
    color: 'white',
    borderRadius: '50%',
    fontSize: '18px',
    fontWeight: '700',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    margin: '0 0 6px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#212121',
  },
  stepText: {
    margin: 0,
    fontSize: '14px',
    color: '#616161',
    lineHeight: '1.5',
  },
};

export default KiwixReaderView;
