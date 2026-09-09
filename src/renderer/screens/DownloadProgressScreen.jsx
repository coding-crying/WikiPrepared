import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  Button,
  Paper,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Pause,
  PlayArrow,
  Cancel,
  ArrowBack,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as QueuedIcon,
  FolderOpen as FolderIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useToastStore } from '../stores/toastStore';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES, DOWNLOAD_STRATEGIES } from '../utils/constants';
import { formatBytes, formatSpeed, formatDuration } from '../utils/formatters';
const USB_LIBRARY_DIRNAME = 'Library (.zim files)';

/**
 * Individual download item component
 */
function DownloadItem({ filename, status, progress, downloadedSize, totalSize, speed, eta, warning }) {
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'error':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />;
      case 'verifying':
      case 'downloading':
        return null;
      default:
        return <QueuedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'completed':
        return warning ? 'Completed (Unverified)' : 'Completed';
      case 'error':
        return 'Failed';
      case 'verifying':
        return 'Verifying...';
      case 'downloading':
        return `${progress.toFixed(1)}%`;
      case 'paused':
        return 'Paused';
      default:
        return 'Queued';
    }
  };

  return (
    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: status === 'downloading' || status === 'paused' || status === 'verifying' ? 1 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          {getStatusIcon()}
          <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, fontSize: '0.8rem' }}>
            {filename}
          </Typography>
        </Box>
        <Chip
          label={getStatusLabel()}
          size="small"
          color={
            status === 'completed'
              ? (warning ? 'warning' : 'success')
              : status === 'error'
                ? 'error'
                : status === 'verifying'
                  ? 'info'
                  : status === 'downloading'
                    ? 'primary'
                    : 'default'
          }
          sx={{ ml: 1, height: 22, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Progress bar and details for active downloads */}
      {(status === 'downloading' || status === 'paused') && (
        <>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 1,
              mb: 0.5,
              bgcolor: 'action.hover'
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {formatBytes(downloadedSize)} / {formatBytes(totalSize)}
            </Typography>
            {speed > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {formatSpeed(speed)} - {formatDuration(eta)} left
              </Typography>
            )}
          </Box>
        </>
      )}

      {/* Verifying state */}
      {status === 'verifying' && (
        <>
           <LinearProgress
            variant="indeterminate"
            color="info"
            sx={{
              height: 6,
              borderRadius: 1,
              mb: 0.5,
              bgcolor: 'action.hover'
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Verifying file integrity...
          </Typography>
        </>
      )}

      {/* Show size for completed/queued - inline */}
      {(status === 'completed' || status === 'queued') && totalSize > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
          {formatBytes(totalSize)}
        </Typography>
      )}

      {status === 'completed' && warning && (
        <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
          {warning}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Step 4: Download progress screen
 * Shows download progress with speed and ETA for each item
 */
export default function DownloadProgressScreen() {
  const navigate = useNavigate();
  const {
    selectedZims,
    selectedReaders,
    selectedDrive,
    downloadStrategy
  } = useAppFlowStore();

  const { showToast } = useToastStore();
  const [downloadProgress, setDownloadProgress] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [downloadLocation, setDownloadLocation] = useState(null);
  const [kiwixVersions, setKiwixVersions] = useState({});
  // In-app confirmation dialog state ({ title, message, onConfirm } | null)
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // Ref to prevent double-start in StrictMode
  const hasStartedRef = React.useRef(false);
  // Ref to prevent double-navigation
  const navigatingRef = React.useRef(false);

  const handleDownloadProgress = useCallback((progressData) => {
    console.log('Progress update:', progressData.filename, progressData.progress?.toFixed(1) + '%');
    setDownloadProgress(prev => ({
      ...prev,
      [progressData.filename]: progressData
    }));
  }, []);

  // Check for completion whenever download progress changes
  const checkCompletion = useCallback(() => {
    // Check ZIMs
    const zimsComplete = selectedZims.every(zim => {
        // Skip check if ZIM has no URL (skipped download)
        if (!zim.url) return true;
        const status = downloadProgress[zim.filename]?.status;
        return status === 'completed';
    });

    // Check Readers
    // We need to know the filenames to check status. 
    // If kiwixVersions is not loaded yet, we can't fully check, but that's fine for initial renders.
    const readersComplete = selectedReaders.every(platform => {
         const versionInfo = kiwixVersions[platform];
         // If we don't have version info yet, assume not complete (unless selectedReaders is empty)
         if (!versionInfo) return false;
         
         const status = downloadProgress[versionInfo.filename]?.status;
         return status === 'completed';
    });

    return zimsComplete && readersComplete;
  }, [selectedZims, selectedReaders, downloadProgress, kiwixVersions]);

  const isAllCompleted = checkCompletion();

  const performNavigation = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    console.log('Navigating to next screen...');
    if (downloadStrategy === DOWNLOAD_STRATEGIES.LOCAL_FIRST && selectedDrive) {
      navigate(ROUTES.TRANSFERRING);
    } else {
      navigate(ROUTES.COMPLETE);
    }
  }, [downloadStrategy, selectedDrive, navigate]);

  useEffect(() => {
    if (isAllCompleted) {
      console.log('Auto-navigation triggered');
      // Small delay for visual feedback
      const timer = setTimeout(performNavigation, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAllCompleted, performNavigation]);

  const handleDownloadCompleted = useCallback(async (data) => {
    console.log('Download completed event:', data);

    // Update the specific download's status
    const filename = data?.filename || data?.id;
    if (filename) {
      setDownloadProgress(prev => ({
        ...prev,
        [filename]: { ...prev[filename], status: 'completed', progress: 100 }
      }));

      // Show toast for individual download completion
      showToast(`Download complete: ${filename}`, 'success', 4000);
    }
  }, [showToast]);

  // Calculate overall progress from individual downloads
  const overallProgress = React.useMemo(() => {
    const downloads = Object.values(downloadProgress);
    if (downloads.length === 0) return 0;

    // Calculate total size
    const totalZimSize = selectedZims.reduce((sum, zim) => sum + (zim.size || 0), 0);
    
    // Estimate reader size if not known (250MB safe default)
    const readerSize = selectedReaders.reduce((sum, platform) => {
        const info = kiwixVersions[platform];
        return sum + (info?.size || 250 * 1024 * 1024);
    }, 0);

    const totalSize = totalZimSize + readerSize;

    if (totalSize === 0) return 0;

    let totalDownloaded = 0;
    
    // Sum downloaded bytes
    downloads.forEach(d => {
        totalDownloaded += (d.downloadedSize || 0);
    });

    return Math.min(100, (totalDownloaded / totalSize) * 100);
  }, [downloadProgress, selectedZims, selectedReaders, kiwixVersions]);

  const hasUnverified = React.useMemo(() => {
    return Object.values(downloadProgress).some((d) => d && d.status === 'completed' && d.warning);
  }, [downloadProgress]);

  const handleDownloadError = useCallback((error) => {
    console.error('Download error:', error);
    const filename = error?.filename || 'Unknown file';
    const message = error?.message || 'Unknown error';
    showToast(`Download failed: ${filename} - ${message}`, 'error', 8000);
  }, [showToast]);

  // Start downloads once (guarded against StrictMode double-invoke)
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Fetch download location if downloading locally
    const fetchDownloadLocation = async () => {
      if (downloadStrategy !== DOWNLOAD_STRATEGIES.DIRECT_TO_USB) {
        try {
          const location = await window.electronAPI.invoke('download:get-location');
          setDownloadLocation(location);
        } catch (error) {
          console.error('Failed to get download location:', error);
        }
      }
    };
    fetchDownloadLocation();

    // Fetch Kiwix versions for UI mapping AND THEN start downloads
    const init = async () => {
        try {
            const versions = await window.electronAPI.invoke('kiwix:get-versions');
            setKiwixVersions(versions);
            // Pass versions to startDownloads to avoid race condition with state update
            startDownloads(versions);
        } catch (err) {
            console.error('Failed to init downloads:', err);
        }
    };
    init();
  }, []);

  // Register IPC listeners in their own unguarded effect: StrictMode
  // double-mount runs mount → cleanup → mount, so listeners must be
  // re-registered on the second mount (a start guard would leave zero
  // listeners attached and the UI would go deaf to progress events).
  useEffect(() => {
    const unsubProgress = window.electronAPI.on('download:progress', handleDownloadProgress);
    const unsubCompleted = window.electronAPI.on('download:completed', handleDownloadCompleted);
    const unsubError = window.electronAPI.on('download:error', handleDownloadError);

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubCompleted) unsubCompleted();
      if (unsubError) unsubError();
    };
  }, [handleDownloadProgress, handleDownloadCompleted, handleDownloadError]);

  // Poll for download status every 2 seconds (Fallback for missed IPC events)
  useEffect(() => {
    const intervalId = setInterval(async () => {
      // Don't poll if we are already navigating
      if (navigatingRef.current) return;
      
      try {
        const downloads = await window.electronAPI.invoke('download:get-all');
        if (downloads && downloads.length > 0) {
          setDownloadProgress(prev => {
            const next = { ...prev };
            let hasUpdates = false;
            
            downloads.forEach(d => {
              // Only update if status changed or progress advanced significantly
              const current = next[d.filename];
              if (!current || current.status !== d.status || d.progress > (current.progress || 0) + 1) {
                next[d.filename] = d;
                hasUpdates = true;
              }
            });
            
            return hasUpdates ? next : prev;
          });
        }
      } catch (err) {
        console.warn('Polling status failed:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const startDownloads = async (versions = kiwixVersions) => {
    try {
      const joinPathForTarget = (basePath, child) => {
        if (!basePath) return null;
        const normalized = basePath.replace(/[\\/]+$/, '');
        // Preserve Windows-style separators when mount paths are drive-letter based.
        const sep = /^[A-Za-z]:\\/.test(normalized) ? '\\' : '/';
        return `${normalized}${sep}${child}`;
      };

      // Determine destination - USB root for readers, visible library folder for ZIMs
      const usbRoot = downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB
        ? selectedDrive?.mountpoints?.[0]?.path
        : null;
      const destination = usbRoot; // For readers (handled by installToUSB -> .data/)
      const zimDestination = joinPathForTarget(usbRoot, USB_LIBRARY_DIRNAME); // For ZIMs

      let instantCompleteCount = 0;
      const totalItems = selectedReaders.length + selectedZims.length;

      // Fetch Kiwix reader versions
      let kiwixVersions = {};
      try {
        kiwixVersions = await window.electronAPI.invoke('kiwix:get-versions');
      } catch (err) {
        console.error('Failed to fetch Kiwix versions:', err);
      }

      console.log('DEBUG: selectedReaders:', selectedReaders);
      console.log('DEBUG: kiwixVersions keys:', Object.keys(kiwixVersions));

      // Queue Kiwix Readers
      for (const platform of selectedReaders) {
         const versionInfo = versions[platform];
         if (versionInfo && versionInfo.url) {
             // For direct-to-USB, install readers to platform-specific USB locations (.data/, extracted Windows)
             if (downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB && usbRoot) {
               setDownloadProgress(prev => ({
                 ...prev,
                 [versionInfo.filename]: {
                   status: 'downloading',
                   progress: 0,
                   downloadedSize: 0,
                   totalSize: versionInfo.size || 0
                 }
               }));

               await window.electronAPI.invoke('kiwix:install', platform, usbRoot);
               instantCompleteCount++;
               setDownloadProgress(prev => ({
                 ...prev,
                 [versionInfo.filename]: {
                   status: 'completed',
                   progress: 100,
                   downloadedSize: versionInfo.size || 0,
                   totalSize: versionInfo.size || 0
                 }
               }));
             } else {
               // Local-first and no-drive flows still use DownloadManager queue
               const result = await window.electronAPI.invoke('download:add', {
                   url: versionInfo.url,
                   filename: versionInfo.filename,
                   size: versionInfo.size
               }, destination);
               
               // If backend reports it's already completed (cached), update UI immediately
               if (result.status === 'completed') {
                    console.log(`Reader already completed (cached): ${versionInfo.filename}`);
                    instantCompleteCount++;
                    setDownloadProgress(prev => ({
                      ...prev,
                      [versionInfo.filename]: { 
                          status: 'completed',
                          progress: 100,
                          downloadedSize: versionInfo.size,
                          totalSize: versionInfo.size
                      }
                    }));
               }
             }
         } else {
             console.warn(`No version info found for reader: ${platform}`);
             // Treat missing version info as "skipped/complete" to avoid blocking
             instantCompleteCount++;
         }
      }

      // Queue ZIM downloads
      for (const zim of selectedZims) {
        if (!zim.url) {
          console.log(`Skipping download for ${zim.filename} (no URL/already local)`);
          instantCompleteCount++;
          // Mark as completed in UI immediately
          setDownloadProgress(prev => ({
            ...prev,
            [zim.filename]: { 
              status: 'completed', 
              progress: 100,
              downloadedSize: zim.size,
              totalSize: zim.size 
            }
          }));
          continue;
        }

        const result = await window.electronAPI.invoke('download:add', {
          url: zim.url,
          filename: zim.filename,
          size: zim.size
        }, zimDestination);

        // If backend reports it's already completed (found locally), update UI immediately
        if (result.status === 'completed') {
          console.log(`Download already completed (cached): ${zim.filename}`);
          instantCompleteCount++;
          setDownloadProgress(prev => ({
            ...prev,
            [zim.filename]: { 
              status: 'completed', 
              progress: 100,
              downloadedSize: result.totalSize,
              totalSize: result.totalSize 
            }
          }));
        }
      }

      // Start all downloads
      await window.electronAPI.invoke('download:start-all');

      // Fast-path: If everything was instantly completed/skipped, navigate now
      if (instantCompleteCount === totalItems && totalItems > 0) {
        console.log('All items instantly complete. Navigating via fast-path...');
        performNavigation();
      }

    } catch (error) {
      console.error('Failed to start downloads:', error);
      showToast(`Failed to start downloads: ${error.message}`, 'error');
    }
  };

  const handlePauseResume = async () => {
    try {
      if (isPaused) {
        await window.electronAPI.invoke('download:resume-all');
      } else {
        await window.electronAPI.invoke('download:pause-all');
      }
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('Failed to pause/resume:', error);
    }
  };

  const handleCancel = async () => {
    setConfirmDialog({
      title: 'Cancel all downloads?',
      message: 'All in-progress downloads will be stopped and partial files removed.',
      confirmLabel: 'Cancel Downloads',
      onConfirm: async () => {
        try {
          await window.electronAPI.invoke('download:cancel-all');
          navigate(ROUTES.CONFIGURE);
        } catch (error) {
          console.error('Failed to cancel:', error);
        }
      }
    });
  };

  const handleBack = async () => {
    setConfirmDialog({
      title: 'Go back and cancel downloads?',
      message: 'Going back will cancel all downloads. Continue?',
      confirmLabel: 'Go Back',
      onConfirm: async () => {
        try {
          await window.electronAPI.invoke('download:cancel-all');
        } catch (error) {
          console.error('Failed to cancel:', error);
        } finally {
          navigate(ROUTES.DOWNLOAD_STRATEGY);
        }
      }
    });
  };

  const handleOpenFolder = async () => {
    try {
      await window.electronAPI.invoke('download:open-folder');
    } catch (error) {
      console.error('Failed to open folder:', error);
      showToast('Failed to open download folder', 'error');
    }
  };

  // Calculate overall stats
  const totalFiles = selectedZims.length + selectedReaders.length;
  const completedFiles = Object.values(downloadProgress).filter(p => p.status === 'completed').length;

  return (
    <AppLayout
      title="Downloading..."
      subtitle={`${completedFiles} of ${totalFiles} files completed`}
      currentStep={3}
      maxWidth="md"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Overall progress */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight={500}>Overall Progress</Typography>
            <Typography variant="body2" color="text.secondary">{overallProgress.toFixed(0)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{ height: 10, borderRadius: 1 }}
          />
        </Paper>

        {/* Important warnings */}
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Do not shut down your computer
            {downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB && ' or unplug the USB drive'}
          </Typography>
        </Alert>

        {hasUnverified && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Some downloads completed without a server-provided SHA-256 checksum. The app created local `.sha256` baselines
              so the USB Audit screen can detect future corruption, but these files were not verified against the server.
            </Typography>
          </Alert>
        )}

        {/* Download location info for local downloads */}
        {downloadLocation && downloadStrategy !== DOWNLOAD_STRATEGIES.DIRECT_TO_USB && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Download Location
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                  {downloadLocation}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderIcon />}
                onClick={handleOpenFolder}
                sx={{ flexShrink: 0 }}
              >
                Open Folder
              </Button>
            </Box>
          </Paper>
        )}

        {/* Individual downloads - grid for landscape */}
        <Paper variant="outlined" sx={{ p: 2, flex: 1, overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            Downloads
          </Typography>

          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
            gap: 1.5
          }}>
            {selectedZims.map((zim) => {
              const progress = downloadProgress[zim.filename] || {};
              return (
                <DownloadItem
                  key={zim.filename}
                  filename={zim.filename}
                  status={progress.status || 'queued'}
                  progress={progress.progress || 0}
                  downloadedSize={progress.downloadedSize || 0}
                  totalSize={progress.totalSize || zim.size || 0}
                  speed={progress.speed || 0}
                  eta={progress.eta || 0}
                  warning={progress.warning || null}
                />
              );
            })}

            {selectedReaders.map((platform) => {
              const versionInfo = kiwixVersions[platform];
              const filename = versionInfo?.filename || `Kiwix Reader (${platform})`; // Fallback
              const progress = downloadProgress[filename] || {};
              
              return (
                <DownloadItem
                  key={platform}
                  filename={filename} // Show actual filename
                  status={progress.status || 'queued'}
                  progress={progress.progress || 0}
                  downloadedSize={progress.downloadedSize || 0}
                  totalSize={progress.totalSize || versionInfo?.size || 0}
                  speed={progress.speed || 0}
                  eta={progress.eta || 0}
                  warning={progress.warning || null}
                />
              );
            })}
          </Box>
        </Paper>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={isPaused ? <PlayArrow /> : <Pause />}
              onClick={handlePauseResume}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Cancel />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Box>

      {/* In-app confirmation dialog (replaces native confirm()) */}
      <Dialog
        open={confirmDialog !== null}
        onClose={() => setConfirmDialog(null)}
      >
        <DialogTitle>{confirmDialog?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(null)}>Stay</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const action = confirmDialog?.onConfirm;
              setConfirmDialog(null);
              if (action) action();
            }}
          >
            {confirmDialog?.confirmLabel || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
