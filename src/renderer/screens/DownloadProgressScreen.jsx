import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
  Paper,
  Divider
} from '@mui/material';
import { Pause, PlayArrow, Cancel } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import ProgressBar from '../components/common/ProgressBar';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES, DOWNLOAD_STRATEGIES } from '../utils/constants';

/**
 * Step 4: Download progress screen
 * Shows download progress with speed and ETA
 */
export default function DownloadProgressScreen() {
  const navigate = useNavigate();
  const {
    selectedZims,
    selectedReaders,
    selectedDrive,
    downloadStrategy,
    downloads,
    setDownloads
  } = useAppFlowStore();

  const [currentDownload, setCurrentDownload] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Start downloads
    startDownloads();

    // Listen for download progress
    window.electronAPI.on('download:progress', handleDownloadProgress);
    window.electronAPI.on('download:completed', handleDownloadCompleted);
    window.electronAPI.on('download:error', handleDownloadError);

    return () => {
      window.electronAPI.off('download:progress');
      window.electronAPI.off('download:completed');
      window.electronAPI.off('download:error');
    };
  }, []);

  const startDownloads = async () => {
    try {
      // Determine destination
      const destination = downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB
        ? selectedDrive?.mountpoints?.[0]?.path
        : null; // null means local downloads folder

      // Queue ZIM downloads
      for (const zim of selectedZims) {
        await window.electronAPI.invoke('download:add', {
          url: zim.url,
          filename: zim.filename,
          destination
        });
      }

      // Queue reader downloads
      for (const platform of selectedReaders) {
        await window.electronAPI.invoke('download:add-reader', {
          platform,
          destination
        });
      }

      // Start all downloads
      await window.electronAPI.invoke('download:start-all');
    } catch (error) {
      console.error('Failed to start downloads:', error);
      alert(`Failed to start downloads: ${error.message}`);
    }
  };

  const handleDownloadProgress = (progressData) => {
    setCurrentDownload(progressData);
  };

  const handleDownloadCompleted = async (downloadId) => {
    console.log('Download completed:', downloadId);

    // Check if all downloads are complete
    const allDownloads = await window.electronAPI.invoke('download:get-all');
    const allComplete = allDownloads.every(d => d.status === 'completed');

    if (allComplete) {
      // Move to next step
      if (downloadStrategy === DOWNLOAD_STRATEGIES.LOCAL_FIRST && selectedDrive) {
        navigate(ROUTES.TRANSFERRING);
      } else {
        navigate(ROUTES.COMPLETE);
      }
    }
  };

  const handleDownloadError = (error) => {
    console.error('Download error:', error);
    alert(`Download error: ${error.message}`);
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

  return (
    <AppLayout
      title="Downloading..."
      subtitle="Please wait while we download your selected content"
      maxWidth="md"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Current download */}
        {currentDownload && (
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <ProgressBar
              progress={currentDownload.progress || 0}
              downloadedSize={currentDownload.downloadedSize || 0}
              totalSize={currentDownload.totalSize || 0}
              speed={currentDownload.speed || 0}
              eta={currentDownload.eta || 0}
              filename={currentDownload.filename}
              animated={!isPaused}
            />
          </Paper>
        )}

        {/* Important warnings */}
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Important:
          </Typography>
          <Typography variant="body2">
            • Do not shut down your computer
          </Typography>
          {downloadStrategy === DOWNLOAD_STRATEGIES.DIRECT_TO_USB && (
            <Typography variant="body2">
              • Do not unplug the USB drive
            </Typography>
          )}
        </Alert>

        {/* Queue */}
        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Download Queue
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <List dense>
            {/* Selected ZIMs */}
            <ListItem>
              <ListItemText
                primary="Wikipedia ZIM Files"
                secondary={`${selectedZims.length} file(s)`}
              />
            </ListItem>
            {selectedZims.map((zim) => (
              <ListItem key={zim.filename} sx={{ pl: 4 }}>
                <ListItemText
                  primary={zim.filename}
                  secondary="Queued"
                  primaryTypographyProps={{ variant: 'caption' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}

            {/* Reader apps */}
            {selectedReaders.length > 0 && (
              <>
                <ListItem>
                  <ListItemText
                    primary="Kiwix Reader Apps"
                    secondary={`${selectedReaders.length} platform(s)`}
                  />
                </ListItem>
                {selectedReaders.map((platform) => (
                  <ListItem key={platform} sx={{ pl: 4 }}>
                    <ListItemText
                      primary={`Kiwix ${platform}`}
                      secondary="Queued"
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </>
            )}
          </List>
        </Paper>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3, justifyContent: 'center' }}>
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
    </AppLayout>
  );
}
