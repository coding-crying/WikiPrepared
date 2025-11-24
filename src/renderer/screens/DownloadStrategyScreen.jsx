import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Chip, Stack, Alert, CircularProgress } from '@mui/material';
import {
  CloudDownload as CloudIcon,
  Usb as UsbIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, DOWNLOAD_STRATEGIES, STORAGE } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

/**
 * Step 3.5: Download strategy selection
 * Choose between downloading to USB directly or to local first
 * Validates local disk space and filesystem before offering local-first option
 */
export default function DownloadStrategyScreen() {
  const navigate = useNavigate();
  const {
    setDownloadStrategy,
    getTotalSize,
    selectedZims
  } = useAppFlowStore();

  const totalSize = getTotalSize();
  const [localDiskInfo, setLocalDiskInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get the largest file size to check filesystem compatibility
  const largestFileSize = selectedZims.reduce((max, zim) => Math.max(max, zim.size || 0), 0);

  useEffect(() => {
    async function fetchLocalDiskInfo() {
      try {
        const info = await window.electronAPI.invoke('download:get-local-disk-info');
        setLocalDiskInfo(info);
      } catch (error) {
        console.error('Failed to get local disk info:', error);
        setLocalDiskInfo(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLocalDiskInfo();
  }, []);

  // Determine if local-first is available
  const canUseLocalFirst = localDiskInfo &&
    localDiskInfo.freeSpace >= totalSize &&
    (localDiskInfo.supportsLargeFiles || largestFileSize <= STORAGE.FAT32_MAX_FILE_SIZE);

  const localFirstUnavailableReason = !localDiskInfo
    ? 'Unable to detect local disk'
    : localDiskInfo.freeSpace < totalSize
      ? `Not enough space (need ${formatBytes(totalSize)}, have ${formatBytes(localDiskInfo.freeSpace)})`
      : !localDiskInfo.supportsLargeFiles && largestFileSize > STORAGE.FAT32_MAX_FILE_SIZE
        ? `Filesystem (${localDiskInfo.filesystem}) doesn't support files over 4GB`
        : null;

  const handleChoice = (strategy) => {
    setDownloadStrategy(strategy);
    navigate(ROUTES.DOWNLOADING);
  };

  const handleBack = () => {
    navigate(ROUTES.CONFIGURE);
  };

  if (isLoading) {
    return (
      <AppLayout title="Checking Storage" subtitle="Analyzing available disk space..." currentStep={2}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Choose Download Method"
      subtitle={`Total download size: ${formatBytes(totalSize)}`}
      currentStep={2}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxWidth: 700,
            mx: 'auto',
            mb: 2
          }}
        >
          {/* Local First Option */}
          <Card
            sx={{
              cursor: canUseLocalFirst ? 'pointer' : 'not-allowed',
              border: 2,
              borderColor: canUseLocalFirst ? 'success.main' : 'grey.700',
              opacity: canUseLocalFirst ? 1 : 0.6,
              transition: 'all 0.2s ease-in-out',
              '&:hover': canUseLocalFirst ? {
                transform: 'translateY(-4px)',
                boxShadow: 6
              } : {}
            }}
            onClick={() => canUseLocalFirst && handleChoice(DOWNLOAD_STRATEGIES.LOCAL_FIRST)}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <CloudIcon sx={{ fontSize: 40, color: canUseLocalFirst ? 'success.main' : 'grey.500', mr: 2 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6">
                      Download to Computer First
                    </Typography>
                    {canUseLocalFirst && (
                      <Chip label="Recommended" color="success" size="small" />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Download files to your computer, then transfer to USB
                  </Typography>
                </Box>
              </Box>

              {canUseLocalFirst ? (
                <Stack spacing={0.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />
                    <Typography variant="body2">Safer - USB can be removed during download</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />
                    <Typography variant="body2">Faster final transfer</Typography>
                  </Box>
                  {localDiskInfo && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {formatBytes(localDiskInfo.freeSpace)} available on {localDiskInfo.filesystem || 'local disk'}
                    </Typography>
                  )}
                </Stack>
              ) : (
                <Alert severity="warning" icon={<ErrorIcon />} sx={{ mt: 1 }}>
                  {localFirstUnavailableReason}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Direct to USB Option */}
          <Card
            sx={{
              cursor: 'pointer',
              border: 2,
              borderColor: !canUseLocalFirst ? 'primary.main' : 'transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6
              }
            }}
            onClick={() => handleChoice(DOWNLOAD_STRATEGIES.DIRECT_TO_USB)}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <UsbIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6">
                      Download Directly to USB
                    </Typography>
                    {!canUseLocalFirst && (
                      <Chip label="Available" color="primary" size="small" />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Download files directly to the USB drive
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={0.5}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />
                  <Typography variant="body2">Saves computer storage space</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />
                  <Typography variant="body2">One-step process</Typography>
                </Box>
              </Stack>

              <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: 1 }}>
                <Stack spacing={0.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningIcon sx={{ fontSize: 18, color: 'warning.main', mr: 1 }} />
                    <Typography variant="caption" sx={{ color: 'warning.main' }}>
                      Keep USB plugged in during download
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flexShrink: 0 }}>
          <NavigationButtons onBack={handleBack} showNext={false} />
        </Box>
      </Box>
    </AppLayout>
  );
}
