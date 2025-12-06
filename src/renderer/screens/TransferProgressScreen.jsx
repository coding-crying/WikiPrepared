import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  Paper,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useZimsStore } from '../stores/zimsStore';
import { useDrivesStore } from '../stores/drivesStore';
import ProgressBar from '../components/common/ProgressBar';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

/**
 * Step 5: USB transfer screen
 * Transfer downloaded files from local to USB
 */
export default function TransferProgressScreen() {
  const navigate = useNavigate();
  const { selectedDrive, selectedZims, transferProgress, setTransferProgress } = useAppFlowStore();
  const { installedZims } = useZimsStore();
  const getDrive = useDrivesStore(state => state.getDrive);

  const [oldVersionsToDelete, setOldVersionsToDelete] = useState([]);
  const [deleteOldVersions, setDeleteOldVersions] = useState(true);
  const [currentFile, setCurrentFile] = useState('');
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [transferredSize, setTransferredSize] = useState(0);
  const [totalTransferSize, setTotalTransferSize] = useState(0);

  useEffect(() => {
    checkForOldVersions();
  }, []);

  const checkForOldVersions = async () => {
    // Get fresh drive info to ensure valid mountpoint after formatting
    const currentDrive = selectedDrive ? getDrive(selectedDrive.device) : null;
    
    if (!currentDrive) {
      console.error('Selected drive not found in current drive list');
      alert('Error: Drive not found. Please reconnect the drive.');
      navigate(ROUTES.DRIVE_SELECTION);
      return;
    }

    try {
      const mountpoint = currentDrive.mountpoints?.[0]?.path;
      if (!mountpoint) {
        console.error('No mountpoint found for drive');
        alert('Error: Drive has no mount point. Try unplugging and replugging it.');
        return;
      }

      // Scan for old versions that match our selected ZIMs
      const oldVersions = installedZims.filter(installed =>
        // Logic to detect if it's an old version of what we're installing
        selectedZims.some(newZim => 
           newZim.language === installed.language &&
           newZim.topic === installed.topic &&
           newZim.filename !== installed.filename // Different file = old version (usually)
        )
      );

      setOldVersionsToDelete(oldVersions);

      // Start transfer
      if (oldVersions.length > 0 && deleteOldVersions) {
        await deleteOldFiles(oldVersions);
      }

      await startTransfer(mountpoint);
    } catch (error) {
      console.error('Failed to check old versions:', error);
      // Attempt transfer anyway if possible
      const mp = currentDrive.mountpoints?.[0]?.path;
      if (mp) await startTransfer(mp);
    }
  };

  const deleteOldFiles = async (files) => {
    try {
      for (const file of files) {
        await window.electronAPI.invoke('file:delete', file.path);
      }
    } catch (error) {
      console.error('Failed to delete old files:', error);
    }
  };

  const startTransfer = async (mountpoint) => {
    try {
      if (!mountpoint) {
        console.error('No mountpoint provided to startTransfer');
        return;
      }

      console.log('Starting transfer to:', mountpoint);

      // Listen for transfer progress
      window.electronAPI.on('transfer:progress', handleTransferProgress);
      window.electronAPI.on('transfer:completed', handleTransferCompleted);
      window.electronAPI.on('transfer:error', handleTransferError);

      // Start transfer
      await window.electronAPI.invoke('transfer:start', {
        destination: mountpoint,
        filesToTransfer: selectedZims.map(z => z.filename)
      });
    } catch (error) {
      console.error('Failed to start transfer:', error);
      alert(`Failed to start transfer: ${error.message}`);
    }
  };

  const handleTransferProgress = (progressData) => {
    setTransferProgress(progressData.progress || 0);
    setCurrentFile(progressData.currentFile || '');
    setTransferSpeed(progressData.speed || 0);
    setTransferredSize(progressData.transferredSize || 0);
    setTotalTransferSize(progressData.totalSize || 0);
  };

  const handleTransferCompleted = () => {
    navigate(ROUTES.COMPLETE);
  };

  const handleTransferError = (error) => {
    console.error('Transfer error:', error);
    alert(`Transfer error: ${error.message}`);
  };

  useEffect(() => {
    return () => {
      window.electronAPI.off('transfer:progress');
      window.electronAPI.off('transfer:completed');
      window.electronAPI.off('transfer:error');
    };
  }, []);

  return (
    <AppLayout
      title="Transferring to USB..."
      subtitle="Please wait while we copy files to your USB drive"
      maxWidth="md"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Old versions warning */}
        {oldVersionsToDelete.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
            <Typography variant="subtitle2" gutterBottom>
              Old Versions Detected
            </Typography>
            <List dense>
              {oldVersionsToDelete.map((zim) => (
                <ListItem key={zim.filename}>
                  <ListItemText
                    primary={zim.filename}
                    secondary={`${formatBytes(zim.size)} • ${zim.date}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))}
            </List>
            <FormControlLabel
              control={
                <Checkbox
                  checked={deleteOldVersions}
                  onChange={(e) => setDeleteOldVersions(e.target.checked)}
                />
              }
              label="Delete old versions to make room for new ones"
            />
          </Paper>
        )}

        {/* Progress */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <ProgressBar
            progress={transferProgress}
            downloadedSize={transferredSize}
            totalSize={totalTransferSize}
            speed={transferSpeed}
            filename={currentFile}
            animated={true}
          />
        </Paper>

        {/* Warnings */}
        <Alert severity="warning">
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Important:
          </Typography>
          <Typography variant="body2">
            • Do not remove the USB drive during transfer
          </Typography>
          <Typography variant="body2">
            • Do not shut down your computer
          </Typography>
        </Alert>

        {/* Status */}
        <Paper variant="outlined" sx={{ p: 2, mt: 3, flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Transfer Status
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {currentFile && (
            <Typography variant="body2" color="text.secondary">
              Copying: {currentFile}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {transferProgress.toFixed(1)}% complete
          </Typography>
        </Paper>
      </Box>
    </AppLayout>
  );
}
