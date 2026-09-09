import React, { useEffect, useRef, useState } from 'react';
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
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useZimsStore } from '../stores/zimsStore';
import { useDrivesStore } from '../stores/drivesStore';
import { useToastStore } from '../stores/toastStore';
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
  const { selectedDrive, selectedZims, selectedReaders, transferProgress, setTransferProgress } = useAppFlowStore();
  const { installedZims } = useZimsStore();
  const getDrive = useDrivesStore(state => state.getDrive);
  const { showToast } = useToastStore();

  const [oldVersionsToDelete, setOldVersionsToDelete] = useState([]);
  const [deleteOldVersions, setDeleteOldVersions] = useState(true);
  const [currentFile, setCurrentFile] = useState('');
  const [transferSpeed, setTransferSpeed] = useState(0);
  const [transferredSize, setTransferredSize] = useState(0);
  const [totalTransferSize, setTotalTransferSize] = useState(0);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  // Cancel confirmation dialog (in-app, themed)
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Guards against StrictMode double-mount auto-starting the transfer twice
  const transferInitiatedRef = useRef(false);

  const getCurrentDriveMountpoint = () => {
    const currentDrive = selectedDrive ? getDrive(selectedDrive.device) : null;
    return currentDrive?.mountpoints?.[0]?.path || currentDrive?.mountpoint || null;
  };

  useEffect(() => {
    if (transferInitiatedRef.current) return;
    transferInitiatedRef.current = true;
    checkForOldVersions();
  }, []);

  const checkForOldVersions = async () => {
    // Get fresh drive info to ensure valid mountpoint after formatting
    const currentDrive = selectedDrive ? getDrive(selectedDrive.device) : null;
    
    if (!currentDrive) {
      console.error('Selected drive not found in current drive list');
      showToast('Error: Drive not found. Please reconnect the drive.', 'error');
      navigate(ROUTES.DRIVE_SELECTION);
      return;
    }

    try {
      const mountpoint = currentDrive.mountpoints?.[0]?.path || currentDrive.mountpoint;
      if (!mountpoint) {
        console.error('No mountpoint found for drive');
        showToast('Error: Drive has no mount point. Try unplugging and replugging it.', 'error');
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

      if (oldVersions.length > 0) {
        setOldVersionsToDelete(oldVersions);
        setWaitingForConfirmation(true);
        // Wait for user to click "Start Transfer"
      } else {
        // No conflicts, start immediately
        await startTransfer(mountpoint);
      }

    } catch (error) {
      console.error('Failed to check old versions:', error);
      // Attempt transfer anyway if possible
      const mp = currentDrive.mountpoints?.[0]?.path || currentDrive.mountpoint;
      if (mp) await startTransfer(mp);
    }
  };

  const handleConfirmTransfer = async () => {
    setWaitingForConfirmation(false);
    setIsTransferring(true);
    
    const mountpoint = getCurrentDriveMountpoint();
    if (!mountpoint) {
      showToast('Error: Drive has no mount point. Try unplugging and replugging it.', 'error');
      return;
    }

    if (oldVersionsToDelete.length > 0 && deleteOldVersions) {
      await deleteOldFiles(oldVersionsToDelete);
    }
    
    await startTransfer(mountpoint);
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
      setIsTransferring(true);
      if (!mountpoint) {
        console.error('No mountpoint provided to startTransfer');
        return;
      }

      console.log('Starting transfer to:', mountpoint);

      // Start transfer
      await window.electronAPI.invoke('transfer:start', {
        destination: mountpoint,
        filesToTransfer: selectedZims.map(z => z.filename),
        selectedReaders
      });
    } catch (error) {
      console.error('Failed to start transfer:', error);
      showToast(`Failed to start transfer: ${error.message}`, 'error');
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
    showToast(`Transfer error: ${error.message}`, 'error', 8000);
  };

  // Register IPC listeners once on mount (StrictMode-safe), unsubscribe on unmount.
  // Using the unsubscribe functions returned by .on() instead of .off(), which
  // nukes ALL listeners on the channel.
  useEffect(() => {
    const unsubscribers = [
      window.electronAPI.on('transfer:progress', handleTransferProgress),
      window.electronAPI.on('transfer:completed', handleTransferCompleted),
      window.electronAPI.on('transfer:error', handleTransferError),
    ];
    return () => unsubscribers.forEach((unsub) => unsub && unsub());
  }, []);

  const handleCancelTransfer = async () => {
    setIsCancelling(true);
    try {
      await window.electronAPI.invoke('transfer:cancel');
      showToast('Cancelling transfer…', 'info');
    } catch (error) {
      console.error('Failed to request transfer cancel:', error);
      showToast(`Failed to cancel transfer: ${error.message}`, 'error');
    } finally {
      // The transfer:error handler will fire when main acknowledges the cancel;
      // re-enable the button in case the transfer finished in between.
      setTimeout(() => setIsCancelling(false), 2000);
    }
  };

  return (
    <AppLayout
      title={waitingForConfirmation ? "Review Transfer" : "Transferring to USB..."}
      subtitle={waitingForConfirmation ? "Please review actions before starting" : "Please wait while we copy files to your USB drive"}
      maxWidth="md"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Old versions confirmation */}
        {waitingForConfirmation && oldVersionsToDelete.length > 0 ? (
          <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
            <Typography variant="h6" gutterBottom>
              Space Management
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              We found older versions of the selected files on your USB drive.
            </Alert>
            
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Files recommended for deletion:
            </Typography>
            <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
              {oldVersionsToDelete.map((zim) => (
                <ListItem key={zim.filename}>
                  <ListItemText
                    primary={zim.filename}
                    secondary={`${formatBytes(zim.size)} • ${zim.date || 'Unknown Date'}`}
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
              label="Delete these old versions to free up space (Recommended)"
              sx={{ display: 'block', mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
              <Button 
                variant="contained" 
                size="large"
                onClick={handleConfirmTransfer}
                startIcon={<CheckIcon />}
              >
                Confirm & Start Transfer
              </Button>
            </Box>
          </Paper>
        ) : (
          /* Progress and Status */
          <>
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
              {currentFile ? (
                <Typography variant="body2" color="text.secondary">
                  Copying: {currentFile}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Preparing transfer...
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {transferProgress.toFixed(1)}% complete
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={isCancelling}
                  onClick={() => setShowCancelDialog(true)}
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel Transfer'}
                </Button>
              </Box>
            </Paper>
          </>
        )}

        {/* Cancel confirmation dialog */}
        <Dialog open={showCancelDialog} onClose={() => setShowCancelDialog(false)}>
          <DialogTitle>Cancel this transfer?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Copying will stop now. Incomplete files are removed from the USB
              drive; files that finished copying are kept.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowCancelDialog(false)}>Keep Transferring</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                setShowCancelDialog(false);
                handleCancelTransfer();
              }}
            >
              Cancel Transfer
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
