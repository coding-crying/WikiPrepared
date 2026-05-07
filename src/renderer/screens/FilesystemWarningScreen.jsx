import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  Tooltip,
  InputAdornment
} from '@mui/material';
import { Warning as WarningIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useDrivesStore } from '../stores/drivesStore';
import { useToastStore } from '../stores/toastStore';
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
  const selectDrive = useAppFlowStore(state => state.selectDrive);
  const { showToast } = useToastStore();
  const scanDrives = useDrivesStore(state => state.scanDrives);
  const getDrive = useDrivesStore(state => state.getDrive);
  const [confirmText, setConfirmText] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);

  const canFormat = confirmText === 'FORMAT';

  const handleFormat = async () => {
    if (!canFormat || !selectedDrive) return;

    setIsFormatting(true);
    try {
      const result = await window.electronAPI.invoke('drives:format', {
        device: selectedDrive.device,
        filesystem: FILESYSTEMS.EXFAT
      });

      await scanDrives();

      const refreshedDrive = getDrive(selectedDrive.device) || result?.drive || null;
      if (refreshedDrive) {
        selectDrive(refreshedDrive);
      }

      showToast('Drive formatted successfully to exFAT', 'success');
      navigate(ROUTES.CONFIGURE);
    } catch (error) {
      console.error('Format failed:', error);
      showToast(`Format failed: ${error.message}`, 'error');
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
    <AppLayout title="Prepare USB Stick" currentStep={1}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom fontWeight={700}>
            We need to prepare this USB stick for Wikipedia.
          </Typography>
          <Typography variant="body2">
            The current format ({selectedDrive.filesystem}) cannot handle the large Wikipedia files.
          </Typography>
        </Alert>

        <Typography variant="h6" gutterBottom>
          Recommended Action: Erase & Prepare
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          This ensures the stick works perfectly on Windows, Mac, and Linux.
        </Typography>

        {/* Format option */}
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            mb: 3,
            borderColor: '#ef4444',
            bgcolor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <WarningIcon sx={{ color: '#ef4444', mr: 1, mt: 0.5, fontSize: 32 }} />
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#d32f2f' }}>
                DANGER: ALL FILES WILL BE DELETED
              </Typography>
              <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1 }}>
                Every picture, document, and file on "{selectedDrive.label || 'USB Drive'}" will be permanently erased.
              </Typography>
            </Box>
          </Box>

          <TextField
            fullWidth
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Type FORMAT to confirm"
            error={confirmText && confirmText !== 'FORMAT'}
            helperText={
              canFormat
                ? "✓ Correct! Click the button below to erase everything."
                : "Type FORMAT (all caps) to confirm you want to erase this drive."
            }
            InputProps={{
              endAdornment: canFormat && (
                <InputAdornment position="end">
                  <CheckIcon sx={{ color: 'success.main' }} />
                </InputAdornment>
              )
            }}
            sx={{
              mb: 2,
              bgcolor: 'background.paper',
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: canFormat ? 'success.main' : undefined
                }
              },
              '& .MuiFormHelperText-root': {
                color: canFormat ? 'success.main' : undefined
              }
            }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setConfirmText('');
              }}
              color="inherit"
            >
              Cancel
            </Button>
            <Tooltip
              title={
                isFormatting
                  ? "Erasing and preparing drive..."
                  : !canFormat
                    ? 'Type FORMAT above to enable this button'
                    : ""
              }
              arrow
              placement="top"
            >
              <span>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleFormat}
                  disabled={!canFormat || isFormatting}
                  size="large"
                >
                  {isFormatting ? 'Erasing...' : 'Erase Everything & Prepare Drive'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Paper>

          {/* Alternative options */}
          <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Other options:
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={handleContinueAnyway}
                color="warning"
              >
                Try without erasing (Not Recommended)
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
