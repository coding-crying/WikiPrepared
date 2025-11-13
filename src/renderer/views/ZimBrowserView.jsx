import React, { useEffect, useState } from 'react';
import useStore from '../store';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

/**
 * ZIM Browser View
 *
 * Browse and download Wikipedia ZIM files
 * Features:
 * - Catalog fetching from Wikimedia
 * - Filters (language, scope, topic, size)
 * - Search
 * - Download to local or USB
 */
function ZimBrowserView() {
  const {
    filteredZims,
    catalogLoading,
    catalogError,
    catalogLastFetched,
    filters,
    sortBy,
    selectedDrive,
    setZimCatalog,
    setCatalogLoading,
    setCatalogError,
    setFilter,
    setSortBy,
    resetFilters,
    setDownload,
    addNotification,
  } = useStore();

  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    // Load catalog on mount if not already loaded
    if (!catalogLastFetched) {
      loadCatalog(false);
    }
  }, []);

  const loadCatalog = async (forceRefresh = false) => {
    try {
      setCatalogLoading(true);
      setCatalogError(null);
      const catalog = await window.electronAPI.invoke(
        IPC_CHANNELS.ZIM_FETCH_CATALOG,
        forceRefresh
      );
      setZimCatalog(catalog);
      addNotification({
        type: 'success',
        message: `Loaded ${catalog.length} ZIM files from catalog`,
        duration: 3000
      });
    } catch (error) {
      console.error('Error loading catalog:', error);
      setCatalogError(error.message);
      addNotification({
        type: 'error',
        message: 'Failed to load ZIM catalog',
        details: error.message
      });
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleDownload = async (zim, directToUSB = false) => {
    if (directToUSB && !selectedDrive) {
      addNotification({
        type: 'warning',
        message: 'Please select a USB drive first'
      });
      return;
    }

    try {
      const destination = directToUSB
        ? selectedDrive.mountpoint
        : null; // Will use default download path

      const download = await window.electronAPI.invoke(
        IPC_CHANNELS.DOWNLOAD_ADD,
        zim,
        destination
      );

      setDownload(download.id, {
        id: download.id,
        filename: zim.filename,
        url: zim.url,
        size: zim.size,
        progress: 0,
        status: 'queued',
        destination: directToUSB ? selectedDrive.label : 'Downloads'
      });

      await window.electronAPI.invoke(IPC_CHANNELS.DOWNLOAD_START, download.id);

      addNotification({
        type: 'success',
        message: `Started downloading ${zim.filename}`,
        duration: 4000
      });
    } catch (error) {
      console.error('Error starting download:', error);
      addNotification({
        type: 'error',
        message: 'Failed to start download',
        details: error.message
      });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>ZIM Browser</h1>
          <p style={styles.subtitle}>
            Browse and download Wikipedia ZIM files
          </p>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.button}
            onClick={() => loadCatalog(true)}
            disabled={catalogLoading}
          >
            {catalogLoading ? '⏳ Loading...' : '🔄 Refresh Catalog'}
          </button>
          <button
            style={styles.buttonSecondary}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? '🔼 Hide Filters' : '🔽 Show Filters'}
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Filters Panel */}
        {showFilters && (
          <FilterPanel
            filters={filters}
            onFilterChange={setFilter}
            onReset={resetFilters}
          />
        )}

        {/* Results Header */}
        <div style={styles.resultsHeader}>
          <div style={styles.resultsInfo}>
            <strong>{filteredZims.length}</strong> ZIM files found
            {catalogLastFetched && (
              <span style={styles.lastUpdated}>
                Last updated: {new Date(catalogLastFetched).toLocaleString()}
              </span>
            )}
          </div>
          <div style={styles.sortControls}>
            <label style={styles.sortLabel}>Sort by:</label>
            <select
              style={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="date">Date</option>
              <option value="language">Language</option>
            </select>
          </div>
        </div>

        {/* Catalog Grid */}
        {catalogLoading ? (
          <div style={styles.loading}>
            <div style={styles.loadingSpinner}>⏳</div>
            <p>Loading ZIM catalog...</p>
          </div>
        ) : catalogError ? (
          <div style={styles.error}>
            <div style={styles.errorIcon}>❌</div>
            <p style={styles.errorText}>Failed to load catalog</p>
            <p style={styles.errorDetails}>{catalogError}</p>
            <button style={styles.button} onClick={() => loadCatalog(true)}>
              Try Again
            </button>
          </div>
        ) : filteredZims.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔍</div>
            <p style={styles.emptyText}>No ZIM files match your filters</p>
            <button style={styles.buttonSecondary} onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={styles.zimGrid}>
            {filteredZims.map((zim, index) => (
              <ZimCard
                key={index}
                zim={zim}
                onDownload={handleDownload}
                hasSelectedDrive={!!selectedDrive}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPanel({ filters, onFilterChange, onReset }) {
  const languages = [
    { code: '', name: 'All Languages' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
  ];

  const scopes = [
    { value: '', label: 'All Sizes' },
    { value: 'mini', label: 'Mini (100MB-1GB)' },
    { value: 'nopic', label: 'NoPic (5-20GB)' },
    { value: 'maxi', label: 'Maxi (50-90GB)' },
  ];

  const topics = [
    { value: '', label: 'All Topics' },
    { value: 'all', label: 'All Topics' },
    { value: 'computer', label: 'Computer' },
    { value: 'geography', label: 'Geography' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'biology', label: 'Biology' },
    { value: 'history', label: 'History' },
  ];

  return (
    <div style={styles.filterPanel}>
      <div style={styles.filterHeader}>
        <h3 style={styles.filterTitle}>Filters</h3>
        <button style={styles.resetButton} onClick={onReset}>
          Reset All
        </button>
      </div>

      <div style={styles.filterGrid}>
        {/* Search */}
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Search</label>
          <input
            type="text"
            style={styles.filterInput}
            placeholder="Search ZIM files..."
            value={filters.searchTerm}
            onChange={(e) => onFilterChange('searchTerm', e.target.value)}
          />
        </div>

        {/* Language */}
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Language</label>
          <select
            style={styles.filterSelect}
            value={filters.language}
            onChange={(e) => onFilterChange('language', e.target.value)}
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scope */}
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Size/Scope</label>
          <select
            style={styles.filterSelect}
            value={filters.scope}
            onChange={(e) => onFilterChange('scope', e.target.value)}
          >
            {scopes.map((scope) => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
        </div>

        {/* Topic */}
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Topic</label>
          <select
            style={styles.filterSelect}
            value={filters.topic}
            onChange={(e) => onFilterChange('topic', e.target.value)}
          >
            {topics.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {topic.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ZimCard({ zim, onDownload, hasSelectedDrive }) {
  const getScopeColor = (scope) => {
    switch (scope) {
      case 'mini': return '#4caf50';
      case 'nopic': return '#ff9800';
      case 'maxi': return '#f44336';
      default: return '#757575';
    }
  };

  return (
    <div style={styles.zimCard}>
      <div style={styles.zimCardHeader}>
        <div style={styles.zimLanguage}>{zim.languageName || zim.language}</div>
        <div
          style={{
            ...styles.zimScope,
            backgroundColor: getScopeColor(zim.scope)
          }}
        >
          {zim.scope}
        </div>
      </div>

      <h3 style={styles.zimTitle}>{zim.filename}</h3>
      <p style={styles.zimDescription}>{zim.description}</p>

      <div style={styles.zimMeta}>
        <div style={styles.zimMetaItem}>
          <span style={styles.zimMetaLabel}>Size:</span>
          <span style={styles.zimMetaValue}>{formatBytes(zim.size)}</span>
        </div>
        <div style={styles.zimMetaItem}>
          <span style={styles.zimMetaLabel}>Date:</span>
          <span style={styles.zimMetaValue}>{zim.date}</span>
        </div>
        {zim.articleCount && (
          <div style={styles.zimMetaItem}>
            <span style={styles.zimMetaLabel}>Articles:</span>
            <span style={styles.zimMetaValue}>{zim.articleCount.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div style={styles.zimActions}>
        <button
          style={styles.downloadButton}
          onClick={() => onDownload(zim, false)}
        >
          ⬇️ Download
        </button>
        {hasSelectedDrive && (
          <button
            style={styles.downloadButtonUSB}
            onClick={() => onDownload(zim, true)}
          >
            💾 Download to USB
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
  buttonSecondary: {
    backgroundColor: 'white',
    color: '#2196f3',
    border: '2px solid #2196f3',
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
    gap: '20px',
  },
  filterPanel: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  filterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  filterTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#212121',
  },
  resetButton: {
    backgroundColor: 'transparent',
    color: '#2196f3',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#424242',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  filterInput: {
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
  },
  filterSelect: {
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '16px 20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  resultsInfo: {
    fontSize: '14px',
    color: '#424242',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  lastUpdated: {
    color: '#757575',
    fontSize: '13px',
  },
  sortControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sortLabel: {
    fontSize: '14px',
    color: '#424242',
    fontWeight: '500',
  },
  sortSelect: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  zimGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  zimCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'box-shadow 0.2s ease',
  },
  zimCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  zimLanguage: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2196f3',
    textTransform: 'uppercase',
  },
  zimScope: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
    color: 'white',
    textTransform: 'uppercase',
  },
  zimTitle: {
    margin: '0 0 8px 0',
    fontSize: '15px',
    fontWeight: '600',
    color: '#212121',
    wordBreak: 'break-word',
  },
  zimDescription: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: '#616161',
    lineHeight: '1.5',
  },
  zimMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #f0f0f0',
  },
  zimMetaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
  },
  zimMetaLabel: {
    color: '#757575',
    fontWeight: '500',
  },
  zimMetaValue: {
    color: '#212121',
    fontWeight: '600',
  },
  zimActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  downloadButton: {
    gridColumn: 'span 2',
    backgroundColor: '#2196f3',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  downloadButtonUSB: {
    gridColumn: 'span 2',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  loading: {
    backgroundColor: 'white',
    padding: '80px 20px',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#757575',
  },
  loadingSpinner: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  error: {
    backgroundColor: 'white',
    padding: '60px 20px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  errorText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#424242',
    margin: '0 0 8px 0',
  },
  errorDetails: {
    fontSize: '14px',
    color: '#757575',
    marginBottom: '20px',
  },
  empty: {
    backgroundColor: 'white',
    padding: '60px 20px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#757575',
    marginBottom: '20px',
  },
};

export default ZimBrowserView;
