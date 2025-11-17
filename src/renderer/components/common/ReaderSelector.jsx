import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Link,
  Alert
} from '@mui/material';
import {
  LaptopWindows,
  Apple,
  PhoneAndroid
} from '@mui/icons-material';
import { PLATFORMS, PLATFORM_NAMES } from '../../utils/constants';

/**
 * Reader platform selector with checkboxes
 */
export default function ReaderSelector({ selectedReaders, onToggle }) {
  const getPlatformIcon = (platform) => {
    switch (platform) {
      case PLATFORMS.WINDOWS:
      case PLATFORMS.LINUX:
        return <LaptopWindows />;
      case PLATFORMS.MACOS:
        return <Apple />;
      case PLATFORMS.ANDROID:
        return <PhoneAndroid />;
      default:
        return null;
    }
  };

  const platforms = [
    {
      id: PLATFORMS.WINDOWS,
      label: PLATFORM_NAMES[PLATFORMS.WINDOWS],
      description: 'Portable Windows application'
    },
    {
      id: PLATFORMS.LINUX,
      label: PLATFORM_NAMES[PLATFORMS.LINUX],
      description: 'AppImage for Linux'
    },
    {
      id: PLATFORMS.MACOS,
      label: PLATFORM_NAMES[PLATFORMS.MACOS],
      description: 'macOS application'
    },
    {
      id: PLATFORMS.ANDROID,
      label: PLATFORM_NAMES[PLATFORMS.ANDROID],
      description: 'Android APK'
    }
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Kiwix Reader Apps
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select which platforms to include
      </Typography>

      <FormGroup>
        {platforms.map((platform) => (
          <FormControlLabel
            key={platform.id}
            control={
              <Checkbox
                checked={selectedReaders.includes(platform.id)}
                onChange={() => onToggle(platform.id)}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getPlatformIcon(platform.id)}
                <Box>
                  <Typography variant="body1">{platform.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {platform.description}
                  </Typography>
                </Box>
              </Box>
            }
            sx={{ mb: 1 }}
          />
        ))}
      </FormGroup>

      {/* iOS note */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>iOS:</strong> Kiwix is available only through the{' '}
          <Link
            href="https://apps.apple.com/app/kiwix/id997079563"
            target="_blank"
            rel="noopener noreferrer"
          >
            App Store
          </Link>
        </Typography>
      </Alert>

      {/* PWA link */}
      <Alert severity="info" sx={{ mt: 1 }}>
        <Typography variant="body2">
          <strong>Web Version:</strong> Access Wikipedia through your browser with the{' '}
          <Link
            href="https://pwa.kiwix.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Progressive Web App
          </Link>
        </Typography>
      </Alert>
    </Box>
  );
}
