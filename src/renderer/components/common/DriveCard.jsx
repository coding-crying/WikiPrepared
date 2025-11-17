import React from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Usb as UsbIcon,
  Warning
} from '@mui/icons-material';
import { formatBytes, formatGB, toGB } from '../../utils/formatters';
import { FILESYSTEMS, STORAGE } from '../../utils/constants';

/**
 * Drive card component with visual indicators
 */
export default function DriveCard({ drive, isSelected, onSelect }) {
  const sizeGB = toGB(drive.size);
  const isLargeEnough = sizeGB >= STORAGE.MIN_RECOMMENDED_GB;
  const hasCompatibleFS = FILESYSTEMS.LARGE_FILE_SUPPORT.includes(drive.filesystem);

  const getBorderColor = () => {
    if (isSelected) return 'primary.main';
    if (isLargeEnough && hasCompatibleFS) return 'success.main';
    return 'warning.main';
  };

  const getStatusIcon = () => {
    if (isLargeEnough && hasCompatibleFS) {
      return <CheckIcon sx={{ color: 'success.main', fontSize: 28 }} />;
    }
    return <WarningIcon sx={{ color: 'warning.main', fontSize: 28 }} />;
  };

  return (
    <Card
      onClick={onSelect}
      sx={{
        cursor: 'pointer',
        border: 3,
        borderColor: getBorderColor(),
        transition: 'all 0.2s ease-in-out',
        bgcolor: isSelected ? 'action.selected' : 'background.paper',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header with icon and status */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <UsbIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {drive.label || drive.description || 'USB Drive'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {drive.device}
            </Typography>
          </Box>
          {getStatusIcon()}
        </Box>

        {/* Mount point */}
        {drive.mountpoints && drive.mountpoints.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mounted at: {drive.mountpoints[0].path}
          </Typography>
        )}

        {/* Storage and filesystem chips */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={formatGB(drive.size)}
            color={isLargeEnough ? 'success' : 'warning'}
            size="small"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={drive.filesystem || 'Unknown'}
            color={hasCompatibleFS ? 'default' : 'warning'}
            size="small"
          />
          {drive.isUSB && (
            <Chip label="USB" size="small" variant="outlined" />
          )}
        </Stack>

        {/* Warnings */}
        {!hasCompatibleFS && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: 'warning.light',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <WarningIcon sx={{ color: 'warning.dark', mr: 1, fontSize: 20 }} />
            <Typography variant="caption" color="warning.dark">
              {drive.filesystem === FILESYSTEMS.FAT32
                ? 'FAT32 does not support files larger than 4GB'
                : 'Filesystem may not support large files'}
            </Typography>
          </Box>
        )}

        {!isLargeEnough && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: 'warning.light',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <WarningIcon sx={{ color: 'warning.dark', mr: 1, fontSize: 20 }} />
            <Typography variant="caption" color="warning.dark">
              Less than {STORAGE.MIN_RECOMMENDED_GB}GB - may not fit larger Wikipedia dumps
            </Typography>
          </Box>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Chip
              label="SELECTED"
              color="primary"
              sx={{ fontWeight: 700 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
