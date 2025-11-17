import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Button,
  CircularProgress
} from '@mui/material';
import { useDrivesStore } from '../stores/drivesStore';
import { useAppFlowStore } from '../stores/appFlowStore';
import DriveCard from '../components/common/DriveCard';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, FILESYSTEMS } from '../utils/constants';

/**
 * Step 2: Drive selection screen
 * Shows available USB drives and allows local download option
 */
export default function DriveSelectionScreen() {
  const navigate = useNavigate();
  const { drives, isScanning, scanDrives, startWatching, getUsbDrives } = useDrivesStore();
  const { selectedDrive, selectDrive } = useAppFlowStore();

  useEffect(() => {
    // Initial scan
    scanDrives();
    // Start watching for drive changes
    startWatching();
  }, []);

  const usbDrives = getUsbDrives();

  const handleContinue = () => {
    if (!selectedDrive) return;

    // Check if filesystem warning needed
    const needsWarning = !FILESYSTEMS.LARGE_FILE_SUPPORT.includes(
      selectedDrive.filesystem
    );

    if (needsWarning) {
      navigate(ROUTES.FILESYSTEM_WARNING);
    } else {
      navigate(ROUTES.CONFIGURE);
    }
  };

  const handleLocalDownload = () => {
    selectDrive(null); // No drive selected means local download
    navigate(ROUTES.CONFIGURE);
  };

  const handleBack = () => {
    selectDrive(null);
    navigate(ROUTES.START);
  };

  // Loading state
  if (isScanning && usbDrives.length === 0) {
    return (
      <AppLayout title="Scanning for Drives">
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
          <Typography variant="h6" sx={{ mt: 3 }}>
            Scanning for USB drives...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please wait while we detect connected drives
          </Typography>
        </Box>
      </AppLayout>
    );
  }

  // No drives detected
  if (usbDrives.length === 0) {
    return (
      <AppLayout title="Please Insert USB Drive">
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
          <Typography variant="h1" sx={{ mb: 2, fontSize: '4rem' }}>
            🔌
          </Typography>
          <Typography variant="h6" gutterBottom>
            No USB drives detected
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Please insert a USB drive with at least 64GB of free space
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Scanning for drives...
            </Typography>
          </Box>

          <Button
            variant="text"
            size="small"
            onClick={handleLocalDownload}
            sx={{ mt: 6 }}
          >
            I do not want to download to a USB
          </Button>
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
    >
      <Box sx={{ flex: 1 }}>
        <Grid container spacing={3}>
          {usbDrives.map((drive) => (
            <Grid item xs={12} sm={6} md={4} key={drive.device}>
              <DriveCard
                drive={drive}
                isSelected={selectedDrive?.device === drive.device}
                onSelect={() => selectDrive(drive)}
              />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button
            variant="text"
            size="small"
            onClick={handleLocalDownload}
          >
            Download to computer instead (not to USB)
          </Button>
        </Box>
      </Box>

      <NavigationButtons
        onBack={handleBack}
        onNext={handleContinue}
        nextDisabled={!selectedDrive}
      />
    </AppLayout>
  );
}
