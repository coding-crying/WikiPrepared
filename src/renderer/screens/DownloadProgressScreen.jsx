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
  Schedule as QueuedIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: status === 'downloading' || status === 'paused' ? 1 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          {getStatusIcon()}
          <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, fontSize: '0.8rem' }}>
            {filename}
          </Typography>
        </Box>
        <Chip
          label={getStatusLabel()}
          size="small"
          color={status === 'completed' ? 'success' : status === 'error' ? 'error' : status === 'downloading' ? 'primary' : 'default'}
          sx={{ ml: 1, height: 22, fontSize: '0.7rem' }}
        />
      </Box>

      {/* Progress bar for active downloads */}
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

  const [downloadProgress, setDownloadProgress] = useState({});
  const [isPaused, setIsPaused] = useState(false);
  const [allComplete, setAllComplete] = useState(false);

  const handleDownloadProgress = useCallback((progressData) => {
    console.log('Progress update:', progressData.filename, progressData.progress?.toFixed(1) + '%');
    setDownloadProgress(prev => ({
      ...prev,
      [progressData.filename]: progressData
    }));
  }, []);

  const handleDownloadCompleted = useCallback(async (data) => {
    console.log('Download completed event:', data);

    // Update the specific download's status
    const filename = data?.filename || data?.id;
    if (filename) {
      setDownloadProgress(prev => ({
        ...prev,
        [filename]: { ...prev[filename], status: 'completed', progress: 100 }
      }));
    }

    // Check if all downloads are complete
    try {
      const allDownloads = await window.electronAPI.invoke('download:get-all');
      console.log('All downloads status:', allDownloads.map(d => `${d.filename}: ${d.status}`));

      if (allDownloads.length > 0 && allDownloads.every(d => d.status === 'completed')) {
        console.log('All downloads complete! Navigating...');
        setAllComplete(true);

        // Small delay to show completion before navigating
        setTimeout(() => {
          if (downloadStrategy === DOWNLOAD_STRATEGIES.LOCAL_FIRST && selectedDrive) {
            navigate(ROUTES.TRANSFERRING);
          } else {
            navigate(ROUTES.COMPLETE);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error checking download status:', error);
    }
  }, [downloadStrategy, selectedDrive, navigate]);

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
  }, []);

  useEffect(() => {
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

  const startDownloads = async () => {
    try {
      // Determine destination
      const destination = downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB
        ? selectedDrive?.mountpoints?.[0]?.path
        : null;

      // Queue ZIM downloads
      for (const zim of selectedZims) {
        await window.electronAPI.invoke('download:add', {
          url: zim.url,
          filename: zim.filename,
          size: zim.size
        }, destination);
      }

      // Start all downloads
      await window.electronAPI.invoke('download:start-all');
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
