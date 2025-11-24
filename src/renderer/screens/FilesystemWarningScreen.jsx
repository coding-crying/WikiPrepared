import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, FILESYSTEMS } from '../utils/constants';
import { formatGB } from '../utils/formatters';

/**
 * Step 2.5: Filesystem warning and format option
 * Shown when selected drive has incompatible filesystem (e.g., FAT32)
 */
export default function FilesystemWarningScreen() {
  const navigate = useNavigate();
  const selectedDrive = useAppFlowStore(state => state.selectedDrive);
  const [confirmText, setConfirmText] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);

  const canFormat = confirmText === 'FORMAT';

  const handleFormat = async () => {
    if (!canFormat || !selectedDrive) return;

    setIsFormatting(true);
    try {
      // TODO: Call IPC to format drive
      await window.electronAPI.invoke('drives:format', {
        device: selectedDrive.device,
        filesystem: FILESYSTEMS.EXFAT
      });

      // After successful format, proceed
      navigate(ROUTES.CONFIGURE);
    } catch (error) {
      console.error('Format failed:', error);
      alert(`Format failed: ${error.message}`);
    } finally {
      setIsFormatting(false);
    }
  };

  const handleContinueAnyway = () => {
    navigate(ROUTES.CONFIGURE);
  };

  const handleBack = () => {
    navigate(ROUTES.DRIVE_SELECTION);
  };

  if (!selectedDrive) {
    navigate(ROUTES.DRIVE_SELECTION);
    return null;
  }

  const isFAT32 = selectedDrive.filesystem === FILESYSTEMS.FAT32;

  return (
    <AppLayout title="Filesystem Compatibility Warning" currentStep={1}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            The selected drive uses <strong>{selectedDrive.filesystem}</strong>,
            which {isFAT32 ? 'cannot store files larger than 4GB' : 'may not support large files'}.
          </Typography>
          <Typography variant="body2">
            Most Wikipedia ZIM files are larger than this limit and will not work on this drive.
          </Typography>
        </Alert>

        <Typography variant="h6" gutterBottom>
          Recommendation: Format to exFAT
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          exFAT supports large files and works on Windows, Mac, and Linux.
        </Typography>

        {/* Format option */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <WarningIcon sx={{ color: '#ef4444', mr: 1, mt: 0.5 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fca5a5' }}>
                WARNING: Formatting will erase ALL data on this drive!
              </Typography>
              <Typography variant="body2" sx={{ color: '#fca5a5', mt: 1 }}>
                Drive: {selectedDrive.label || selectedDrive.device} - {formatGB(selectedDrive.size)}
              </Typography>
              {selectedDrive.mountpoints && selectedDrive.mountpoints.length > 0 && (
                <Typography variant="body2" sx={{ color: '#fca5a5' }}>
                  Location: {selectedDrive.mountpoints[0].path}
                </Typography>
              )}
            </Box>
          </Box>

          <TextField
            fullWidth
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Type FORMAT to confirm"
            error={confirmText && confirmText !== 'FORMAT'}
            helperText="Type FORMAT (all caps) to enable formatting"
            sx={{ mb: 2, bgcolor: 'background.paper' }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleFormat}
              disabled={!canFormat || isFormatting}
            >
              {isFormatting ? 'Formatting...' : 'Format to exFAT'}
            </Button>
          </Box>
        </Paper>

          {/* Alternative options */}
          <Box sx={{ pt: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Or:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleContinueAnyway}
              >
                Continue with {selectedDrive.filesystem} anyway
              </Button>
              <Button
                variant="outlined"
                onClick={handleBack}
              >
                Choose a different drive
              </Button>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flexShrink: 0 }}>
          <NavigationButtons onBack={handleBack} showNext={false} />
        </Box>
      </Box>
    </AppLayout>
  );
}
