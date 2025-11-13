import React, { useState } from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Update Manager View
 *
 * Scan USB for installed ZIMs and check for updates
 */
function UpdateManagerView() {
  const {
    selectedDrive,
    installedZims,
    availableUpdates,
    updateScanLoading,
    updateCheckLoading,
    setInstalledZims,
    setAvailableUpdates,
    setUpdateScanLoading,
    setUpdateCheckLoading,
    addNotification,
  } = useStore();

  const [selectedUpdates, setSelectedUpdates] = useState([]);

  const handleScanUSB = async () => {
    if (!selectedDrive) {
      addNotification({
        type: 'warning',
        message: 'Please select a USB drive first'
      });
      return;
    }

    try {
      setUpdateScanLoading(true);
      const zims = await window.electronAPI.invoke(
        IPC_CHANNELS.UPDATE_SCAN_USB,
        selectedDrive.mountpoint
      );
      setInstalledZims(zims);
      addNotification({
        type: 'success',
        message: `Found ${zims.length} ZIM files on ${selectedDrive.label}`,
        duration: 4000
      });

      // Automatically check for updates after scanning
      if (zims.length > 0) {
        await handleCheckUpdates(zims);
      }
    } catch (error) {
      console.error('Error scanning USB:', error);
      addNotification({
        type: 'error',
        message: 'Failed to scan USB drive',
        details: error.message
      });
    } finally {
      setUpdateScanLoading(false);
    }
  };

  const handleCheckUpdates = async (zims = installedZims) => {
    try {
      setUpdateCheckLoading(true);
      const updates = await window.electronAPI.invoke(
        IPC_CHANNELS.UPDATE_CHECK,
        zims
      );
      setAvailableUpdates(updates);

      const outdatedCount = updates.filter(u => u.status === 'outdated').length;
      if (outdatedCount > 0) {
        addNotification({
          type: 'info',
          message: `${outdatedCount} ZIM file(s) have updates available`,
          duration: 5000
        });
      } else {
        addNotification({
          type: 'success',
          message: 'All ZIM files are up to date!',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error checking updates:', error);
      addNotification({
        type: 'error',
        message: 'Failed to check for updates',
        details: error.message
      });
    } finally {
      setUpdateCheckLoading(false);
    }
  };

  const handleUpdateSingle = async (update) => {
    try {
      await window.electronAPI.invoke(
        IPC_CHANNELS.UPDATE_INSTALL,
        update,
        selectedDrive.mountpoint
      );
      addNotification({
        type: 'success',
        message: `Started updating ${update.filename}`,
        duration: 4000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to start update',
        details: error.message
      });
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedUpdates.length === 0) {
      addNotification({
        type: 'warning',
        message: 'No updates selected'
      });
      return;
    }

    try {
      const updates = availableUpdates.filter(u => selectedUpdates.includes(u.filename));
      await window.electronAPI.invoke(
        IPC_CHANNELS.UPDATE_BATCH_INSTALL,
        updates,
        selectedDrive.mountpoint
      );
      addNotification({
        type: 'success',
        message: `Started updating ${selectedUpdates.length} ZIM file(s)`,
        duration: 5000
      });
      setSelectedUpdates([]);
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to start batch update',
        details: error.message
      });
    }
  };

  const toggleSelectUpdate = (filename) => {
    setSelectedUpdates(prev =>
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const selectAllOutdated = () => {
    const outdated = availableUpdates
      .filter(u => u.status === 'outdated')
      .map(u => u.installed.filename);
    setSelectedUpdates(outdated);
  };

  const outdatedUpdates = availableUpdates.filter(u => u.status === 'outdated');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Update Manager</h1>
          <p style={styles.subtitle}>
            Check for and install ZIM file updates
          </p>
        </div>
        <div style={styles.headerActions}>
          {installedZims.length > 0 && (
            <button
              style={styles.button}
              onClick={() => handleCheckUpdates()}
              disabled={updateCheckLoading}
            >
              {updateCheckLoading ? '⏳ Checking...' : '🔄 Recheck Updates'}
            </button>
          )}
          <button
            style={styles.button}
            onClick={handleScanUSB}
            disabled={updateScanLoading || !selectedDrive}
          >
            {updateScanLoading ? '⏳ Scanning...' : '🔍 Scan USB Drive'}
          </button>
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
        ) : installedZims.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📦</div>
            <p style={styles.emptyText}>No ZIM files scanned yet</p>
            <p style={styles.emptyHint}>
              Click "Scan USB Drive" to check for installed ZIM files
            </p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div style={styles.statsGrid}>
              <StatCard
                label="Installed"
                value={installedZims.length}
                icon="📚"
                color="#2196f3"
              />
              <StatCard
                label="Up to Date"
                value={availableUpdates.filter(u => u.status === 'up_to_date').length}
                icon="✓"
                color="#4caf50"
              />
              <StatCard
                label="Updates Available"
                value={outdatedUpdates.length}
                icon="🔄"
                color="#ff9800"
              />
              <StatCard
                label="Unknown"
                value={availableUpdates.filter(u => u.status === 'unknown').length}
                icon="?"
                color="#757575"
              />
            </div>

            {/* Batch Actions */}
            {outdatedUpdates.length > 0 && (
              <div style={styles.batchActions}>
                <button
                  style={styles.buttonSecondary}
                  onClick={selectAllOutdated}
                >
                  Select All Outdated
                </button>
                {selectedUpdates.length > 0 && (
                  <button
                    style={styles.buttonPrimary}
                    onClick={handleBatchUpdate}
                  >
                    Update {selectedUpdates.length} Selected
                  </button>
                )}
              </div>
            )}

            {/* Updates Table */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>ZIM Files</h2>
              {availableUpdates.length === 0 ? (
                <div style={styles.loading}>Loading update information...</div>
              ) : (
                <div style={styles.table}>
                  <div style={styles.tableHeader}>
                    <div style={styles.tableHeaderCell}>Select</div>
                    <div style={styles.tableHeaderCell}>File Name</div>
                    <div style={styles.tableHeaderCell}>Current Version</div>
                    <div style={styles.tableHeaderCell}>Latest Version</div>
                    <div style={styles.tableHeaderCell}>Status</div>
                    <div style={styles.tableHeaderCell}>Action</div>
                  </div>
                  {availableUpdates.map((update, index) => (
                    <UpdateRow
                      key={index}
                      update={update}
                      isSelected={selectedUpdates.includes(update.installed.filename)}
                      onToggleSelect={() => toggleSelectUpdate(update.installed.filename)}
                      onUpdate={handleUpdateSingle}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, color }}>{icon}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function UpdateRow({ update, isSelected, onToggleSelect, onUpdate }) {
  const getStatusInfo = () => {
    switch (update.status) {
      case 'up_to_date':
        return { label: 'Up to Date', color: '#4caf50', icon: '✓' };
      case 'outdated':
        return { label: 'Update Available', color: '#ff9800', icon: '🔄' };
      case 'unknown':
        return { label: 'Unknown', color: '#757575', icon: '?' };
      case 'not_found':
        return { label: 'Not Found Online', color: '#f44336', icon: '✕' };
      case 'newer':
        return { label: 'Newer than Online', color: '#2196f3', icon: '⭐' };
      default:
        return { label: update.status, color: '#757575', icon: '?' };
    }
  };

  const statusInfo = getStatusInfo();
  const canUpdate = update.status === 'outdated';

  return (
    <div style={styles.tableRow}>
      <div style={styles.tableCell}>
        {canUpdate && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={styles.checkbox}
          />
        )}
      </div>
      <div style={styles.tableCell}>
        <div style={styles.filename}>{update.installed.filename}</div>
      </div>
      <div style={styles.tableCell}>{update.installedDate || 'N/A'}</div>
      <div style={styles.tableCell}>{update.latestDate || 'N/A'}</div>
      <div style={styles.tableCell}>
        <div
          style={{
            ...styles.statusBadge,
            backgroundColor: statusInfo.color
          }}
        >
          {statusInfo.icon} {statusInfo.label}
        </div>
      </div>
      <div style={styles.tableCell}>
        {canUpdate && (
          <button
            style={styles.updateButton}
            onClick={() => onUpdate(update)}
          >
            ⬇️ Update
          </button>
        )}
      </div>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
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
  button: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
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
  },
  buttonSecondary: {
    backgroundColor: 'white',
    color: '#2196f3',
    border: '2px solid #2196f3',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
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
  empty: {
    backgroundColor: 'white',
    padding: '80px 20px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#424242',
    margin: '0 0 8px 0',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#757575',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '36px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#212121',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#757575',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  batchActions: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#212121',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#757575',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '60px 2fr 120px 120px 180px 120px',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    fontWeight: '600',
    fontSize: '13px',
    color: '#424242',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableHeaderCell: {
    display: 'flex',
    alignItems: 'center',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '60px 2fr 120px 120px 180px 120px',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#fafafa',
    borderRadius: '4px',
    alignItems: 'center',
  },
  tableCell: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#212121',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  filename: {
    fontWeight: '500',
    wordBreak: 'break-word',
  },
  statusBadge: {
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  updateButton: {
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

export default UpdateManagerView;
