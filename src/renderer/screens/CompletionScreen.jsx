import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Alert,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Description as FileIcon,
  Apps as AppsIcon,
  Usb as UsbIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useStorageCalculation } from '../hooks/useStorageCalculation';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES, PLATFORM_NAMES, getLanguageName, getScopeName } from '../utils/constants';
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
    softReset
  } = useAppFlowStore();

  const { totalSize } = useStorageCalculation();

  const handleEjectUSB = async () => {
    if (!selectedDrive) return;

    try {
      await window.electronAPI.invoke('drives:eject', selectedDrive.device);
      alert('USB drive ejected safely. You can now remove it.');
    } catch (error) {
      console.error('Failed to eject drive:', error);
      alert(`Failed to eject: ${error.message}`);
    }
  };

  const handleStartOver = () => {
    softReset();
    navigate(ROUTES.START);
  };

  return (
    <AppLayout
      title="✅ Your Wikipedia Stick is Ready!"
      subtitle="Successfully created your offline Wikipedia USB stick"
      maxWidth="md"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Success message */}
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={600}>
            All content has been successfully installed!
          </Typography>
        </Alert>

        {/* Summary */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Installation Summary
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {/* Wikipedia Content */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FileIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Wikipedia Content
              </Typography>
            </Box>
            <List dense>
              {selectedZims.map((zim) => (
                <ListItem key={zim.filename}>
                  <ListItemIcon>
                    <CheckIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${getLanguageName(zim.language)} - ${getScopeName(zim.scope)}`}
                    secondary={formatBytes(zim.size)}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Reader Apps */}
          {selectedReaders.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AppsIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Kiwix Reader Apps
                </Typography>
              </Box>
              <List dense>
                {selectedReaders.map((platform) => (
                  <ListItem key={platform}>
                    <ListItemIcon>
                      <CheckIcon color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Kiwix for ${PLATFORM_NAMES[platform]}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Total Size */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            <strong>Total installed:</strong> {formatBytes(totalSize)}
            {selectedDrive && ` / ${formatBytes(selectedDrive.size)}`}
          </Typography>
        </Paper>

        {/* Next Steps */}
        <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: 'info.light' }}>
          <Typography variant="h6" gutterBottom>
            Next Steps
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="1. Safely eject your USB drive"
                secondary={selectedDrive ? 'Use the button below' : 'Files saved to your computer'}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Plug the USB into any computer"
                secondary="Works on Windows, Mac, and Linux"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Run the Kiwix reader application"
                secondary="Open the Kiwix app from the USB drive"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="4. Enjoy offline Wikipedia!"
                secondary="No internet connection required"
              />
            </ListItem>
          </List>
        </Paper>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 'auto' }}>
          {selectedDrive && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<UsbIcon />}
              onClick={handleEjectUSB}
              size="large"
            >
              Safely Eject USB
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={handleStartOver}
            size="large"
          >
            Create Another Stick
          </Button>
        </Box>
      </Box>
    </AppLayout>
  );
}
