import React from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * Download Manager View
 *
 * Manage active and queued downloads
 * Features:
 * - View all downloads
 * - Pause/Resume downloads
 * - Cancel downloads
 * - Clear completed
 */
function DownloadManagerView() {
  const {
    downloads,
    removeDownload,
    clearCompletedDownloads,
    addNotification,
  } = useStore();

  const downloadList = Object.values(downloads);
  const activeDownloads = downloadList.filter(d => ['downloading', 'queued', 'paused'].includes(d.status));
  const completedDownloads = downloadList.filter(d => d.status === 'completed');
  const failedDownloads = downloadList.filter(d => d.status === 'error');

  const handlePause = async (downloadId) => {
    try {
      await window.electronAPI.invoke(IPC_CHANNELS.DOWNLOAD_PAUSE, downloadId);
      addNotification({
        type: 'info',
        message: 'Download paused',
        duration: 2000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to pause download',
        details: error.message
      });
    }
  };

  const handleResume = async (downloadId) => {
    try {
      await window.electronAPI.invoke(IPC_CHANNELS.DOWNLOAD_RESUME, downloadId);
      addNotification({
        type: 'info',
        message: 'Download resumed',
        duration: 2000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to resume download',
        details: error.message
      });
    }
  };

  const handleCancel = async (downloadId) => {
    if (!confirm('Are you sure you want to cancel this download?')) {
      return;
    }

    try {
      await window.electronAPI.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, downloadId);
      removeDownload(downloadId);
      addNotification({
        type: 'info',
        message: 'Download cancelled',
        duration: 2000
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Failed to cancel download',
        details: error.message
      });
    }
  };

  const handleClearCompleted = () => {
    clearCompletedDownloads();
    addNotification({
      type: 'success',
      message: `Cleared ${completedDownloads.length} completed downloads`,
      duration: 3000
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Download Manager</h1>
          <p style={styles.subtitle}>
            Manage your ZIM file downloads
          </p>
        </div>
        {completedDownloads.length > 0 && (
          <button style={styles.button} onClick={handleClearCompleted}>
            🗑️ Clear Completed ({completedDownloads.length})
          </button>
        )}
      </div>

      <div style={styles.content}>
        {/* Stats */}
        <div style={styles.statsGrid}>
          <StatCard
            label="Active"
            value={activeDownloads.length}
            icon="⬇️"
            color="#2196f3"
          />
          <StatCard
            label="Completed"
            value={completedDownloads.length}
            icon="✓"
            color="#4caf50"
          />
          <StatCard
            label="Failed"
            value={failedDownloads.length}
            icon="✕"
            color="#f44336"
          />
          <StatCard
            label="Total"
            value={downloadList.length}
            icon="📊"
            color="#757575"
          />
        </div>

        {/* Downloads List */}
        {downloadList.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📥</div>
            <p style={styles.emptyText}>No downloads</p>
            <p style={styles.emptyHint}>
              Go to the ZIM Browser to start downloading files
            </p>
          </div>
        ) : (
          <>
            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Active Downloads ({activeDownloads.length})
                </h2>
                <div style={styles.downloadList}>
                  {activeDownloads.map((download) => (
                    <DownloadCard
                      key={download.id}
                      download={download}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Completed ({completedDownloads.length})
                </h2>
                <div style={styles.downloadList}>
                  {completedDownloads.map((download) => (
                    <DownloadCard
                      key={download.id}
                      download={download}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Failed Downloads */}
            {failedDownloads.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>
                  Failed ({failedDownloads.length})
                </h2>
                <div style={styles.downloadList}>
                  {failedDownloads.map((download) => (
                    <DownloadCard
                      key={download.id}
                      download={download}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              </section>
            )}
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

function DownloadCard({ download, onPause, onResume, onCancel }) {
  const getStatusInfo = () => {
    switch (download.status) {
      case 'queued':
        return { label: 'Queued', color: '#757575', icon: '⏸' };
      case 'downloading':
        return { label: 'Downloading', color: '#2196f3', icon: '⬇️' };
      case 'paused':
        return { label: 'Paused', color: '#ff9800', icon: '⏸' };
      case 'verifying':
        return { label: 'Verifying', color: '#9c27b0', icon: '🔍' };
      case 'completed':
        return { label: 'Completed', color: '#4caf50', icon: '✓' };
      case 'error':
        return { label: 'Failed', color: '#f44336', icon: '✕' };
      case 'cancelled':
        return { label: 'Cancelled', color: '#757575', icon: '⊗' };
      default:
        return { label: download.status, color: '#757575', icon: '?' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={styles.downloadCard}>
      <div style={styles.downloadHeader}>
        <div style={styles.downloadInfo}>
          <div style={styles.downloadFilename}>{download.filename}</div>
          <div style={styles.downloadMeta}>
            {download.size && <span>Size: {formatBytes(download.size)}</span>}
            {download.destination && <span>Destination: {download.destination}</span>}
          </div>
        </div>
        <div
          style={{
            ...styles.downloadStatus,
            backgroundColor: statusInfo.color
          }}
        >
          {statusInfo.icon} {statusInfo.label}
        </div>
      </div>

      {/* Progress Bar */}
      {['downloading', 'queued', 'paused', 'verifying'].includes(download.status) && (
        <div style={styles.progressSection}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${download.progress || 0}%`,
                backgroundColor: statusInfo.color
              }}
            />
          </div>
          <div style={styles.progressText}>
            {download.progress ? `${download.progress.toFixed(1)}%` : '0%'}
            {download.speed && ` - ${formatBytes(download.speed)}/s`}
            {download.eta && ` - ETA: ${formatTime(download.eta)}`}
          </div>
        </div>
      )}

      {/* Error Message */}
      {download.status === 'error' && download.error && (
        <div style={styles.errorMessage}>
          <strong>Error:</strong> {download.error}
        </div>
      )}

      {/* Actions */}
      <div style={styles.downloadActions}>
        {download.status === 'downloading' && (
          <button
            style={styles.actionButton}
            onClick={() => onPause(download.id)}
          >
            ⏸ Pause
          </button>
        )}
        {download.status === 'paused' && (
          <button
            style={styles.actionButton}
            onClick={() => onResume(download.id)}
          >
            ▶ Resume
          </button>
        )}
        {!['completed'].includes(download.status) && (
          <button
            style={styles.actionButtonDanger}
            onClick={() => onCancel(download.id)}
          >
            ✕ Cancel
          </button>
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

function formatTime(seconds) {
  if (!seconds || seconds === Infinity) return 'Unknown';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
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
  button: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
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
  downloadList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  downloadCard: {
    padding: '16px',
    backgroundColor: '#fafafa',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
  },
  downloadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  downloadInfo: {
    flex: 1,
    minWidth: 0,
  },
  downloadFilename: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#212121',
    marginBottom: '6px',
    wordBreak: 'break-word',
  },
  downloadMeta: {
    fontSize: '13px',
    color: '#757575',
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  downloadStatus: {
    padding: '6px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  progressSection: {
    marginBottom: '12px',
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '6px',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '12px',
    color: '#616161',
  },
  errorMessage: {
    padding: '12px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  downloadActions: {
    display: 'flex',
    gap: '8px',
  },
  actionButton: {
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  actionButtonDanger: {
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
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
};

export default DownloadManagerView;
