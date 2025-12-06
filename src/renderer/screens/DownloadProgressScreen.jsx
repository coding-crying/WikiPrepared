import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  Button,
  Paper,
  LinearProgress,
  Chip
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

/**
 * Individual download item component
 */
function DownloadItem({ filename, status, progress, downloadedSize, totalSize, speed, eta }) {
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
        return 'Completed';
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
          color={status === 'completed' ? 'success' : status === 'error' ? 'error' : status === 'verifying' ? 'info' : status === 'downloading' ? 'primary' : 'default'}
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
    if (selectedZims.length === 0) return false;
    return selectedZims.every(zim => {
      const status = downloadProgress[zim.filename]?.status;
      return status === 'completed';
    });
  }, [selectedZims, downloadProgress]);

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

    // Calculate weighted progress based on file sizes
    const totalSize = selectedZims.reduce((sum, zim) => sum + (zim.size || 0), 0);
    if (totalSize === 0) {
      // Fallback to simple average if sizes unknown
      const totalProgress = downloads.reduce((sum, d) => sum + (d.progress || 0), 0);
      return totalProgress / Math.max(selectedZims.length, 1);
    }

    let weightedProgress = 0;
    for (const zim of selectedZims) {
      const progress = downloadProgress[zim.filename];
      const zimProgress = progress?.status === 'completed' ? 100 : (progress?.progress || 0);
      const weight = (zim.size || 0) / totalSize;
      weightedProgress += zimProgress * weight;
    }

    return weightedProgress;
  }, [downloadProgress, selectedZims]);

  const handleDownloadError = useCallback((error) => {
    console.error('Download error:', error);
    const filename = error?.filename || 'Unknown file';
    const message = error?.message || 'Unknown error';
    showToast(`Download failed: ${filename} - ${message}`, 'error', 8000);
  }, [showToast]);

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

    // Start downloads
    startDownloads();

    // Listen for download progress
    const unsubProgress = window.electronAPI.on('download:progress', handleDownloadProgress);
    const unsubCompleted = window.electronAPI.on('download:completed', handleDownloadCompleted);
    const unsubError = window.electronAPI.on('download:error', handleDownloadError);

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubCompleted) unsubCompleted();
      if (unsubError) unsubError();
    };
  }, []);

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

  const startDownloads = async () => {
    try {
      // Determine destination
      const destination = downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB
        ? selectedDrive?.mountpoints?.[0]?.path
        : null;

      let instantCompleteCount = 0;

      // Mock complete readers since we don't download them yet
      // This prevents them from looking "stuck" in the UI
      for (const reader of selectedReaders) {
         // Use a special key for readers in progress map? 
         // DownloadItem uses `Kiwix Reader (${platform})` as filename
         const key = `Kiwix Reader (${reader})`;
         setDownloadProgress(prev => ({
            ...prev,
            [key]: { status: 'completed', progress: 100 }
         }));
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
        }, destination);

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
      if (instantCompleteCount === selectedZims.length) {
        console.log('All items instantly complete. Navigating via fast-path...');
        performNavigation();
      }

    } catch (error) {
      console.error('Failed to start downloads:', error);
      alert(`Failed to start downloads: ${error.message}`);
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
    if (!confirm('Are you sure you want to cancel all downloads?')) return;

    try {
      await window.electronAPI.invoke('download:cancel-all');
      navigate(ROUTES.CONFIGURE);
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  };

  const handleBack = async () => {
    if (!confirm('Going back will cancel all downloads. Continue?')) return;

    try {
      await window.electronAPI.invoke('download:cancel-all');
      navigate(ROUTES.DOWNLOAD_STRATEGY);
    } catch (error) {
      console.error('Failed to cancel:', error);
      navigate(ROUTES.DOWNLOAD_STRATEGY);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.electronAPI.invoke('download:open-folder');
    } catch (error) {
      console.error('Failed to open folder:', error);
      alert('Failed to open folder');
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
                />
              );
            })}

            {selectedReaders.map((platform) => (
              <DownloadItem
                key={platform}
                filename={`Kiwix Reader (${platform})`}
                status="queued"
                progress={0}
                downloadedSize={0}
                totalSize={0}
                speed={0}
                eta={0}
              />
            ))}
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
    </AppLayout>
  );
}
