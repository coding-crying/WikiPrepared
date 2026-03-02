import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import { UsbOff as UsbOffIcon, Computer as ComputerIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { useDrivesStore } from '../stores/drivesStore';
import { useAppFlowStore } from '../stores/appFlowStore';
import DriveCard from '../components/common/DriveCard';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, supportsLargeFiles } from '../utils/constants';

/**
 * Step 2: Drive selection screen
 * Shows available USB drives and allows local download option
 */
export default function DriveSelectionScreen() {
  const navigate = useNavigate();
  const { drives, isScanning, scanDrives, startWatching, getUsbDrives } = useDrivesStore();
  const { selectedDrive, selectDrive } = useAppFlowStore();
  const [localDownloadSelected, setLocalDownloadSelected] = useState(false);

  useEffect(() => {
    // Initial scan
    scanDrives();
    // Start watching for drive changes
    startWatching();
    // Reset local download selection when entering this screen
    setLocalDownloadSelected(false);
  }, []);

  const usbDrives = getUsbDrives();

  // Something is selected if either a drive is selected OR local download is explicitly chosen
  const hasSelection = selectedDrive !== null || localDownloadSelected;

  const handleContinue = () => {
    // If local download selected (no drive)
    if (localDownloadSelected && !selectedDrive) {
      navigate(ROUTES.CONFIGURE);
      return;
    }

    // If drive selected, check filesystem warning
    if (selectedDrive) {
      const needsWarning = !supportsLargeFiles(selectedDrive.filesystem);
      if (needsWarning) {
        navigate(ROUTES.FILESYSTEM_WARNING);
      } else {
        navigate(ROUTES.CONFIGURE);
      }
    }
  };

  const handleSelectLocalDownload = () => {
    selectDrive(null); // Clear any drive selection
    setLocalDownloadSelected(true);
  };

  const handleSelectDrive = (drive) => {
    selectDrive(drive);
    setLocalDownloadSelected(false); // Clear local download selection
  };

  const handleBack = () => {
    selectDrive(null);
    navigate(ROUTES.START);
  };

  // Loading state
  if (isScanning && usbDrives.length === 0) {
    return (
      <AppLayout title="Scanning for Drives" currentStep={1}>
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h5" sx={{ mt: 3, fontWeight: 500 }}>
            Scanning for USB drives...
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, fontSize: '1.05rem' }}>
            Please wait while we detect connected drives
          </Typography>
        </Box>
      </AppLayout>
    );
  }

  // No drives detected
  if (usbDrives.length === 0) {
    return (
      <AppLayout title="Please Insert USB Drive" currentStep={1}>
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}
        >
          <UsbOffIcon sx={{ fontSize: '4.5rem', mb: 3, color: 'text.secondary' }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 500 }}>
            No USB drives detected
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Please insert a USB drive with at least 64GB of free space
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
              Scanning for drives...
            </Typography>
          </Box>

          {/* Download to Computer link */}
          <Box sx={{ mt: 5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.95rem' }}>
              Don't have a USB drive handy?
            </Typography>
            <Button
              variant="text"
              size="medium"
              startIcon={<ComputerIcon />}
              onClick={() => {
                handleSelectLocalDownload();
                navigate(ROUTES.CONFIGURE);
              }}
              sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.95rem' }}
            >
              Download to computer instead
            </Button>
          </Box>
        </Box>

        <NavigationButtons onBack={handleBack} showNext={false} />
      </AppLayout>
    );
  }

  // Drives available
  return (
    <AppLayout
      title="Select USB Drive"
      subtitle="Choose the USB drive where you want to install Wikipedia"
      currentStep={1}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          <Grid container spacing={3}>
            {usbDrives.map((drive) => (
              <Grid item xs={12} sm={6} md={4} key={drive.device}>
                <DriveCard
                  drive={drive}
                  isSelected={selectedDrive?.device === drive.device}
                  onSelect={() => handleSelectDrive(drive)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Download to Computer link - less prominent */}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.95rem' }}>
              Don't want to use a USB drive?
            </Typography>
            <Button
              variant="text"
              size="medium"
              startIcon={<ComputerIcon sx={{ fontSize: 20 }} />}
              onClick={handleSelectLocalDownload}
              sx={{
                color: localDownloadSelected ? 'primary.main' : 'text.secondary',
                textTransform: 'none',
                fontWeight: localDownloadSelected ? 600 : 400,
                fontSize: '0.95rem'
              }}
            >
              Download to computer instead
              {localDownloadSelected && (
                <CheckIcon sx={{ ml: 1, fontSize: 18, color: 'primary.main' }} />
              )}
            </Button>
          </Box>
        </Box>

        <Box sx={{ flexShrink: 0 }}>
          <NavigationButtons
            onBack={handleBack}
            onNext={handleContinue}
            nextDisabled={!hasSelection}
            nextDisabledTooltip="Please select a USB drive or choose local download"
          />
        </Box>
      </Box>
    </AppLayout>
  );
}
