import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Description as FileIcon,
  Apps as AppsIcon,
  Usb as UsbIcon,
  FolderOpen as FolderIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useStorageCalculation } from '../hooks/useStorageCalculation';
import { useToastStore } from '../stores/toastStore';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES, PLATFORM_NAMES, getLanguageName, getScopeName, DOWNLOAD_STRATEGIES } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

/**
 * Completion screen
 * Shows summary and next steps
 */
export default function CompletionScreen() {
  const navigate = useNavigate();
  const {
    selectedZims,
    selectedReaders,
    selectedDrive,
    downloadStrategy,
    softReset
  } = useAppFlowStore();

  const { totalSize } = useStorageCalculation();
  const { showToast } = useToastStore();
  
  const [isCleaning, setIsCleaning] = React.useState(false);
  const [isCleaned, setIsCleaned] = React.useState(false);
  const [isEjecting, setIsEjecting] = React.useState(false);
  const [ejectResult, setEjectResult] = React.useState(null); // { severity, message }

  const handleEjectUSB = async () => {
    if (!selectedDrive) return;
    if (isEjecting) return;

    try {
      setIsEjecting(true);
      setEjectResult({ severity: 'info', message: 'Ejecting USB drive... Please wait.' });
      const platform = window.electronAPI?.platform;
      const ejectTarget = platform === 'win32'
        ? (selectedDrive.mountpoints?.[0]?.path || selectedDrive.mountpoint || selectedDrive.device)
        : (selectedDrive.device || selectedDrive.mountpoints?.[0]?.path || selectedDrive.mountpoint);
      const res = await window.electronAPI.invoke('drives:eject', ejectTarget);
      const msg = res?.message || 'USB drive ejected safely. You can now remove it.';
      setEjectResult({ severity: 'success', message: msg });
      showToast(msg, 'success');
    } catch (error) {
      console.error('Failed to eject drive:', error);
      const msg = `Failed to eject: ${error.message}`;
      setEjectResult({ severity: 'error', message: msg });
      showToast(msg, 'error');
    } finally {
      setIsEjecting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('This will delete the downloaded Wikipedia files to free up space on your computer.\n\nAre you sure you want to proceed?')) return;
    
    setIsCleaning(true);
    try {
      await window.electronAPI.invoke('download:clear-cache');
      showToast('Local files deleted successfully', 'success');
      setIsCleaned(true);
    } catch (error) {
      console.error('Cleanup failed:', error);
      showToast(`Failed to delete files: ${error.message}`, 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleStartOver = () => {
    softReset();
    navigate(ROUTES.START);
  };

  const handleOpenFolder = async () => {
    try {
      await window.electronAPI.invoke('download:open-folder');
      showToast('Download folder opened', 'success', 3000);
    } catch (error) {
      console.error('Failed to open folder:', error);
      showToast(`Failed to open folder: ${error.message}`, 'error');
    }
  };

  return (
    <AppLayout
      title="Your Wikipedia Stick is Ready!"
      subtitle="Successfully created your offline Wikipedia USB stick"
      maxWidth="md"
      currentStep={4}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Success header with icon */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <CheckIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" fontWeight={600} color="success.main">
            Installation Complete!
          </Typography>
        </Box>

        {/* Two-column layout for landscape */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          flex: 1,
          minHeight: 0
        }}>
          {/* Left column: Summary */}
          <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Installed Content
            </Typography>

            {/* Wikipedia Content - compact list */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {selectedZims.map((zim) => (
                <Box key={zim.filename} sx={{ display: 'flex', alignItems: 'center', py: 0.75, gap: 1 }}>
                  <FileIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {zim.topic ? (zim.topic.charAt(0).toUpperCase() + zim.topic.slice(1)) : 'Wikipedia'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {getLanguageName(zim.language)} - {getScopeName(zim.scope)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {formatBytes(zim.size)}
                  </Typography>
                </Box>
              ))}

              {/* Reader Apps */}
              {selectedReaders.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  {selectedReaders.map((platform) => (
                    <Box key={platform} sx={{ display: 'flex', alignItems: 'center', py: 0.75, gap: 1 }}>
                      <AppsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="body2">
                        Kiwix for {PLATFORM_NAMES[platform]}
                      </Typography>
                    </Box>
                  ))}
                </>
              )}
            </Box>

            {/* Total Size */}
            <Box sx={{
              mt: 2,
              pt: 1.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Typography variant="body2" color="text.secondary">
                Total installed
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {formatBytes(totalSize)}
                {selectedDrive && ` / ${formatBytes(selectedDrive.size)}`}
              </Typography>
            </Box>
          </Paper>

          {/* Right column: Next Steps */}
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.25)' }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              What's Next
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { 
                  step: '1', 
                  title: 'Eject your USB drive', 
                  desc: selectedDrive
                    ? (isEjecting ? 'Ejecting now... please wait' : (ejectResult?.severity === 'success' ? 'Safe to remove' : 'Use the button below'))
                    : 'Files saved to your computer'
                },
                { 
                  step: '2', 
                  title: 'Plug into any computer', 
                  desc: selectedReaders.length > 0 
                    ? `Works on ${selectedReaders.map(p => PLATFORM_NAMES[p]).join(', ')}`
                    : 'Requires Kiwix Reader installed' 
                },
                { 
                  step: '3', 
                  title: 'Run Kiwix reader', 
                  desc: selectedReaders.length > 0 
                    ? 'Open the app from the USB' 
                    : 'Download Kiwix from kiwix.org' 
                },
                { step: '4', title: 'Enjoy offline Wikipedia!', desc: 'No internet needed' }
              ].map((item) => (
                <Box key={item.step} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: 'rgba(96, 165, 250, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Typography variant="caption" fontWeight={700} color="primary.main">
                      {item.step}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            {selectedDrive && ejectResult && (
              <Alert severity={ejectResult.severity} sx={{ mt: 2 }}>
                {ejectResult.message}
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Actions - centered at bottom */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {selectedDrive ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={isEjecting ? <CircularProgress size={18} color="inherit" /> : <UsbIcon />}
              onClick={handleEjectUSB}
              size="large"
              disabled={isEjecting}
            >
              {isEjecting ? 'Ejecting…' : 'Safely Eject USB'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<FolderIcon />}
              onClick={handleOpenFolder}
              size="large"
              disabled={isEjecting}
            >
              Open Download Folder
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={handleStartOver}
            size="large"
            disabled={isEjecting}
          >
            Create Another Stick
          </Button>
          
          {/* Cleanup option for local-first strategy */}
          {downloadStrategy === DOWNLOAD_STRATEGIES.LOCAL_FIRST && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleCleanup}
              disabled={isEjecting || isCleaning || isCleaned}
              size="large"
            >
              {isCleaning ? 'Deleting...' : isCleaned ? 'Files Deleted' : 'Delete Local Files'}
            </Button>
          )}
        </Box>
      </Box>
    </AppLayout>
  );
}
