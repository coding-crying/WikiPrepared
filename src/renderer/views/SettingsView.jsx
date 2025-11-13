import React, { useState } from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Settings View
 *
 * Configure application settings
 */
function SettingsView() {
  const { settings, setSetting, setSettings, addNotification } = useStore();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleChange = (key, value) => {
    setSetting(key, value);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.invoke(IPC_CHANNELS.SETTINGS_SET, settings);
      setHasUnsavedChanges(false);
      addNotification({
        type: 'success',
        message: 'Settings saved successfully',
        duration: 3000
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      addNotification({
        type: 'error',
        message: 'Failed to save settings',
        details: error.message
      });
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      await window.electronAPI.invoke(IPC_CHANNELS.SETTINGS_RESET);
      const defaultSettings = await window.electronAPI.invoke(IPC_CHANNELS.SETTINGS_GET);
      setSettings(defaultSettings);
      setHasUnsavedChanges(false);
      addNotification({
        type: 'success',
        message: 'Settings reset to defaults',
        duration: 3000
      });
    } catch (error) {
      console.error('Error resetting settings:', error);
      addNotification({
        type: 'error',
        message: 'Failed to reset settings',
        details: error.message
      });
    }
  };

  const handleSelectDownloadPath = async () => {
    try {
      const result = await window.electronAPI.invoke(
        IPC_CHANNELS.APP_SHOW_OPEN_DIALOG,
        {
          properties: ['openDirectory']
        }
      );

      if (!result.canceled && result.filePaths.length > 0) {
        handleChange('downloadPath', result.filePaths[0]);
      }
    } catch (error) {
      console.error('Error selecting download path:', error);
      addNotification({
        type: 'error',
        message: 'Failed to select download path',
        details: error.message
      });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Settings</h1>
          <p style={styles.subtitle}>
            Configure application preferences
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.buttonSecondary}
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
          {hasUnsavedChanges && (
            <button
              style={styles.buttonPrimary}
              onClick={handleSave}
            >
              💾 Save Changes
            </button>
          )}
        </div>
      </div>

      <div style={styles.content}>
        {/* Download Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Download Settings</h2>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>Default Download Path</label>
            <div style={styles.pathSelector}>
              <input
                type="text"
                style={styles.pathInput}
                value={settings.downloadPath || 'Use system default'}
                readOnly
              />
              <button
                style={styles.browseButton}
                onClick={handleSelectDownloadPath}
              >
                Browse...
              </button>
            </div>
            <p style={styles.settingHint}>
              Where to download ZIM files before transferring to USB
            </p>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={settings.downloadDirectToUSB}
                onChange={(e) => handleChange('downloadDirectToUSB', e.target.checked)}
              />
              Download directly to USB
            </label>
            <p style={styles.settingHint}>
              Skip temporary download location and write directly to USB drive
            </p>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>Maximum Concurrent Downloads</label>
            <div style={styles.inputWithSlider}>
              <input
                type="range"
                style={styles.slider}
                min="1"
                max="5"
                value={settings.maxConcurrentDownloads}
                onChange={(e) => handleChange('maxConcurrentDownloads', parseInt(e.target.value))}
              />
              <input
                type="number"
                style={styles.numberInput}
                min="1"
                max="5"
                value={settings.maxConcurrentDownloads}
                onChange={(e) => handleChange('maxConcurrentDownloads', parseInt(e.target.value))}
              />
            </div>
            <p style={styles.settingHint}>
              How many ZIM files to download simultaneously
            </p>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>Bandwidth Limit (MB/s)</label>
            <div style={styles.inputWithSlider}>
              <input
                type="range"
                style={styles.slider}
                min="0"
                max="100"
                step="5"
                value={settings.bandwidthLimit}
                onChange={(e) => handleChange('bandwidthLimit', parseInt(e.target.value))}
              />
              <input
                type="number"
                style={styles.numberInput}
                min="0"
                max="100"
                step="5"
                value={settings.bandwidthLimit}
                onChange={(e) => handleChange('bandwidthLimit', parseInt(e.target.value))}
              />
            </div>
            <p style={styles.settingHint}>
              0 = unlimited. Limit download speed to preserve bandwidth
            </p>
          </div>
        </section>

        {/* File Management */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>File Management</h2>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={settings.autoDeleteOldVersions}
                onChange={(e) => handleChange('autoDeleteOldVersions', e.target.checked)}
              />
              Automatically delete old versions after updating
            </label>
            <p style={styles.settingHint}>
              Remove outdated ZIM files when newer versions are downloaded
            </p>
          </div>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={settings.verifyChecksums}
                onChange={(e) => handleChange('verifyChecksums', e.target.checked)}
              />
              Verify file integrity after downloads
            </label>
            <p style={styles.settingHint}>
              Use checksums to ensure downloaded files are not corrupted
            </p>
          </div>
        </section>

        {/* Update Settings */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Update Settings</h2>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>Automatic Update Check</label>
            <select
              style={styles.select}
              value={settings.updateCheckFrequency}
              onChange={(e) => handleChange('updateCheckFrequency', e.target.value)}
            >
              <option value="manual">Manual only</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <p style={styles.settingHint}>
              How often to automatically check for ZIM file updates
            </p>
          </div>
        </section>

        {/* Appearance */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Appearance</h2>

          <div style={styles.settingGroup}>
            <label style={styles.settingLabel}>Theme</label>
            <div style={styles.themeSelector}>
              <button
                style={{
                  ...styles.themeButton,
                  ...(settings.theme === 'light' ? styles.themeButtonActive : {})
                }}
                onClick={() => handleChange('theme', 'light')}
              >
                ☀️ Light
              </button>
              <button
                style={{
                  ...styles.themeButton,
                  ...(settings.theme === 'dark' ? styles.themeButtonActive : {})
                }}
                onClick={() => handleChange('theme', 'dark')}
              >
                🌙 Dark
              </button>
              <button
                style={{
                  ...styles.themeButton,
                  ...(settings.theme === 'auto' ? styles.themeButtonActive : {})
                }}
                onClick={() => handleChange('theme', 'auto')}
              >
                🔄 Auto
              </button>
            </div>
            <p style={styles.settingHint}>
              Choose your preferred color scheme (coming soon)
            </p>
          </div>
        </section>

        {/* Advanced */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Advanced</h2>

          <div style={styles.infoBox}>
            <div style={styles.infoIcon}>ℹ️</div>
            <div>
              <p style={styles.infoTitle}>Cache and Data</p>
              <p style={styles.infoText}>
                The app caches the ZIM catalog for 24 hours to reduce server load.
                You can manually refresh the catalog from the ZIM Browser page.
              </p>
            </div>
          </div>

          <div style={styles.dangerZone}>
            <h3 style={styles.dangerZoneTitle}>Danger Zone</h3>
            <p style={styles.dangerZoneText}>
              These actions cannot be undone. Use with caution.
            </p>
            <button style={styles.dangerButton} onClick={handleReset}>
              🗑️ Reset All Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  headerActions: {
    display: 'flex',
    gap: '12px',
  },
  buttonPrimary: {
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonSecondary: {
    backgroundColor: 'white',
    color: '#757575',
    border: '2px solid #e0e0e0',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#212121',
    paddingBottom: '12px',
    borderBottom: '2px solid #f0f0f0',
  },
  settingGroup: {
    marginBottom: '24px',
  },
  settingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#424242',
    marginBottom: '8px',
  },
  settingHint: {
    margin: '6px 0 0 0',
    fontSize: '13px',
    color: '#757575',
    lineHeight: '1.4',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  pathSelector: {
    display: 'flex',
    gap: '8px',
  },
  pathInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#f5f5f5',
  },
  browseButton: {
    padding: '10px 20px',
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  inputWithSlider: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: '6px',
    cursor: 'pointer',
  },
  numberInput: {
    width: '80px',
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  themeSelector: {
    display: 'flex',
    gap: '12px',
  },
  themeButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#fafafa',
    border: '2px solid #e0e0e0',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  themeButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    color: '#1565c0',
  },
  infoBox: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#e3f2fd',
    borderRadius: '6px',
    marginBottom: '20px',
  },
  infoIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  infoTitle: {
    margin: '0 0 6px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1565c0',
  },
  infoText: {
    margin: 0,
    fontSize: '13px',
    color: '#424242',
    lineHeight: '1.5',
  },
  dangerZone: {
    padding: '20px',
    backgroundColor: '#ffebee',
    borderRadius: '6px',
    border: '2px solid #ef9a9a',
  },
  dangerZoneTitle: {
    margin: '0 0 8px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#c62828',
  },
  dangerZoneText: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#d32f2f',
  },
  dangerButton: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default SettingsView;
