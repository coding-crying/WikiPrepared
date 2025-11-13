import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Dashboard View
 *
 * Main overview showing:
 * - Connected USB drives
 * - Selected drive info
 * - Quick actions
 * - App status
 */
function DashboardView() {
  const navigate = useNavigate();
  const {
    drives,
    selectedDrive,
    setSelectedDrive,
    drivesLoading,
    addNotification,
  } = useStore();

  useEffect(() => {
    // Auto-select first drive if none selected
    if (!selectedDrive && drives.length > 0) {
      setSelectedDrive(drives[0]);
    }
  }, [drives, selectedDrive, setSelectedDrive]);

  const handleSelectDrive = (drive) => {
    setSelectedDrive(drive);
  };

  const handleScanForZims = async () => {
    if (!selectedDrive) {
      addNotification({
        type: 'warning',
        message: 'Please select a USB drive first'
      });
      return;
    }

    try {
      const zimFiles = await window.electronAPI.invoke(
        IPC_CHANNELS.DRIVES_SCAN,
        selectedDrive.mountpoint
      );

      addNotification({
        type: 'success',
        message: `Found ${zimFiles.length} ZIM files on ${selectedDrive.label}`,
        details: zimFiles.length > 0 ? zimFiles.map(z => z.filename).join(', ') : 'No ZIM files found',
        duration: 7000
      });

      // Update selected drive with ZIM info
      setSelectedDrive({
        ...selectedDrive,
        installedZims: zimFiles
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to scan drive',
        details: error.message
      });
    }
  };

  const quickActions = [
    {
      title: 'Browse ZIM Catalog',
      description: 'Download Wikipedia ZIM files',
      icon: '📚',
      action: () => navigate('/zim-browser'),
      color: '#2196f3'
    },
    {
      title: 'Check for Updates',
      description: 'Update existing ZIM files',
      icon: '🔄',
      action: () => navigate('/updates'),
      color: '#4caf50'
    },
    {
      title: 'Install Kiwix Reader',
      description: 'Add reader software to USB',
      icon: '📖',
      action: () => navigate('/kiwix-reader'),
      color: '#ff9800'
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Manage your offline Wikipedia USB drives</p>
      </div>

      <div style={styles.content}>
        {/* Drive Selection */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Connected USB Drives</h2>

          {drivesLoading ? (
            <div style={styles.loading}>Loading drives...</div>
          ) : drives.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🔌</div>
              <p style={styles.emptyText}>No USB drives detected</p>
              <p style={styles.emptyHint}>
                Please connect a USB drive to get started
              </p>
            </div>
          ) : (
            <div style={styles.driveGrid}>
              {drives.map((drive, index) => (
                <DriveCard
                  key={index}
                  drive={drive}
                  isSelected={selectedDrive?.device === drive.device}
                  onSelect={() => handleSelectDrive(drive)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Selected Drive Info */}
        {selectedDrive && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Selected Drive: {selectedDrive.label || selectedDrive.displayName}</h2>
            <div style={styles.driveDetails}>
              <DriveDetailItem
                label="Mount Point"
                value={selectedDrive.mountpoint || selectedDrive.device}
              />
              <DriveDetailItem
                label="Total Space"
                value={formatBytes(selectedDrive.size)}
              />
              <DriveDetailItem
                label="Free Space"
                value={formatBytes(selectedDrive.freeSpace || 0)}
              />
              <DriveDetailItem
                label="File System"
                value={selectedDrive.fileSystem || 'Unknown'}
              />
              <DriveDetailItem
                label="Installed ZIMs"
                value={selectedDrive.installedZims ? `${selectedDrive.installedZims.length} files` : 'Not scanned'}
              />
            </div>
            <button style={styles.scanButton} onClick={handleScanForZims}>
              🔍 Scan for ZIM Files
            </button>
          </section>
        )}

        {/* Installed ZIM Files */}
        {selectedDrive && selectedDrive.installedZims && selectedDrive.installedZims.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Installed ZIM Files ({selectedDrive.installedZims.length})</h2>
            <div style={styles.zimList}>
              {selectedDrive.installedZims.map((zim, index) => (
                <ZimFileCard key={index} zimFile={zim} />
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quick Actions</h2>
          <div style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <QuickActionCard key={index} action={action} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DriveCard({ drive, isSelected, onSelect }) {
  const usedPercent = ((drive.size - (drive.freeSpace || 0)) / drive.size) * 100;

  return (
    <div
      style={{
        ...styles.driveCard,
        ...(isSelected ? styles.driveCardSelected : {}),
      }}
      onClick={onSelect}
    >
      <div style={styles.driveCardHeader}>
        <div style={styles.driveIcon}>💾</div>
        <div style={styles.driveCardInfo}>
          <div style={styles.driveCardTitle}>
            {drive.label || drive.displayName || 'Unnamed Drive'}
          </div>
          <div style={styles.driveCardMountpoint}>
            {drive.mountpoint || drive.device}
          </div>
        </div>
        {drive.isUSB && <div style={styles.usbBadge}>USB</div>}
      </div>
      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${usedPercent}%`,
          }}
        />
      </div>
      <div style={styles.driveCardFooter}>
        <span>{formatBytes(drive.size - (drive.freeSpace || 0))} used</span>
        <span>{formatBytes(drive.freeSpace || 0)} free</span>
      </div>
    </div>
  );
}

function DriveDetailItem({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <div style={styles.detailLabel}>{label}:</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

function QuickActionCard({ action }) {
  return (
    <div
      style={{ ...styles.actionCard, borderTopColor: action.color }}
      onClick={action.action}
    >
      <div style={{ ...styles.actionIcon, color: action.color }}>
        {action.icon}
      </div>
      <h3 style={styles.actionTitle}>{action.title}</h3>
      <p style={styles.actionDescription}>{action.description}</p>
    </div>
  );
}

function ZimFileCard({ zimFile }) {
  const { filename, size, metadata } = zimFile;

  // Generate a friendly display name from metadata
  const getDisplayName = () => {
    if (!metadata || !metadata.valid) {
      return filename;
    }

    const parts = [];

    // Add language name
    if (metadata.languageName) {
      parts.push(metadata.languageName);
    } else if (metadata.language) {
      parts.push(metadata.language.toUpperCase());
    }

    // Add source
    if (metadata.source) {
      parts.push(metadata.source.charAt(0).toUpperCase() + metadata.source.slice(1));
    }

    // Add topic if not "all"
    if (metadata.topic && metadata.topic !== 'all') {
      parts.push(`(${metadata.topic})`);
    }

    return parts.join(' ') || filename;
  };

  const getScopeLabel = (scope) => {
    const labels = {
      'mini': 'Mini',
      'nopic': 'No Pictures',
      'maxi': 'Full with Pictures',
    };
    return labels[scope] || scope;
  };

  const getScopeColor = (scope) => {
    const colors = {
      'mini': '#4caf50',
      'nopic': '#ff9800',
      'maxi': '#f44336',
    };
    return colors[scope] || '#757575';
  };

  return (
    <div style={styles.zimFileCard}>
      <div style={styles.zimFileHeader}>
        <div style={styles.zimFileName}>{getDisplayName()}</div>
        {metadata && metadata.scope && (
          <div
            style={{
              ...styles.zimScopeBadge,
              backgroundColor: getScopeColor(metadata.scope)
            }}
          >
            {getScopeLabel(metadata.scope)}
          </div>
        )}
      </div>
      <div style={styles.zimFileDetails}>
        <span style={styles.zimFileDetail}>📁 {filename}</span>
        <span style={styles.zimFileDetail}>💾 {formatBytes(size)}</span>
        {metadata && metadata.date && (
          <span style={styles.zimFileDetail}>📅 {metadata.date}</span>
        )}
      </div>
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
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '500',
    color: '#424242',
    margin: '0 0 8px 0',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#757575',
    margin: 0,
  },
  driveGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  driveCard: {
    padding: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  driveCardSelected: {
    borderColor: '#2196f3',
    backgroundColor: '#e3f2fd',
  },
  driveCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  driveIcon: {
    fontSize: '32px',
    marginRight: '12px',
  },
  driveCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  driveCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#212121',
    marginBottom: '4px',
  },
  driveCardMountpoint: {
    fontSize: '13px',
    color: '#757575',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  usbBadge: {
    padding: '4px 8px',
    backgroundColor: '#4caf50',
    color: 'white',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196f3',
    transition: 'width 0.3s ease',
  },
  driveCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#616161',
  },
  driveDetails: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '12px',
    color: '#757575',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  detailValue: {
    fontSize: '16px',
    color: '#212121',
    fontWeight: '500',
  },
  scanButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  actionCard: {
    padding: '24px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    borderTop: '4px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  actionIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  actionTitle: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#212121',
  },
  actionDescription: {
    margin: 0,
    fontSize: '14px',
    color: '#616161',
  },
  zimList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  zimFileCard: {
    padding: '16px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    transition: 'all 0.2s ease',
  },
  zimFileHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  zimFileName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  zimScopeBadge: {
    padding: '4px 12px',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '12px',
  },
  zimFileDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  zimFileDetail: {
    fontSize: '13px',
    color: '#616161',
  },
};

export default DashboardView;
