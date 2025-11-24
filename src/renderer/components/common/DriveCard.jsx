import React from 'react';
import { Card, CardActionArea, Typography, Box, Chip, LinearProgress, Tooltip } from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Usb as UsbIcon,
  LibraryBooks as ZimIcon,
  Warning as WarningIcon,
  CheckCircleOutline as GoodIcon
} from '@mui/icons-material';
import { formatBytes, formatGB, toGB } from '../../utils/formatters';
import { supportsLargeFiles, STORAGE } from '../../utils/constants';
import { useDrivesStore } from '../../stores/drivesStore';

/**
 * Drive card component - taller layout with clear capacity/filesystem info
 */
export default function DriveCard({ drive, isSelected, onSelect }) {
  const sizeGB = toGB(drive.size);
  const freeGB = toGB(drive.freeSpace || 0);
  const isLargeEnough = sizeGB >= STORAGE.MIN_RECOMMENDED_GB;
  const hasCompatibleFS = supportsLargeFiles(drive.filesystem);
  const usedPercent = drive.size > 0 ? ((drive.size - (drive.freeSpace || 0)) / drive.size) * 100 : 0;
  const freePercent = 100 - usedPercent;

  // Get ZIM info from store
  const driveZims = useDrivesStore(state => state.getDriveZims(drive.device));
  const zimCount = driveZims.length;

  // Filesystem display info
  const getFilesystemInfo = () => {
    const fs = drive.filesystem?.toUpperCase() || 'Unknown';
    if (hasCompatibleFS) {
      return { label: fs, desc: 'Supports large files', good: true };
    }
    if (fs === 'FAT32') {
      return { label: 'FAT32', desc: '4GB max file size', good: false };
    }
    return { label: fs, desc: 'May have file size limits', good: false };
  };

  const fsInfo = getFilesystemInfo();

  return (
    <Card
      onClick={onSelect}
      sx={{
        cursor: 'pointer',
        border: 2,
        borderColor: isSelected ? 'primary.main' : 'transparent',
        bgcolor: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'background.paper',
        transition: 'all 0.15s ease-in-out',
        position: 'relative',
        '&:hover': {
          zIndex: 1,
          borderColor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          bgcolor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'
        }
      }}
    >
      <CardActionArea sx={{ p: 2.5 }}>
        {/* Top: Icon and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: isSelected ? 'primary.main' : 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isSelected ? (
              <CheckIcon sx={{ fontSize: 24, color: 'primary.contrastText' }} />
            ) : (
              <UsbIcon sx={{ fontSize: 24, color: 'text.secondary' }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {drive.label || drive.description || 'USB Drive'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {zimCount > 0 ? (
                <Tooltip
                  title={`${zimCount} Wikipedia file${zimCount > 1 ? 's' : ''} found - Update or add content`}
                  arrow
                >
                  <Chip
                    icon={<ZimIcon sx={{ fontSize: 12 }} />}
                    label={`${zimCount} ZIM${zimCount > 1 ? 's' : ''}`}
                    size="small"
                    color="success"
                    sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { ml: 0.5 } }}
                  />
                </Tooltip>
              ) : (
                <Chip
                  label="Empty"
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem', opacity: 0.6 }}
                />
              )}
            </Box>
          </Box>
        </Box>

        {/* Storage Section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              {formatBytes(drive.freeSpace || drive.size)} free
            </Typography>
            <Typography variant="caption" color="text.secondary">
              of {formatGB(drive.size)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={usedPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                bgcolor: usedPercent > 90 ? 'error.main' :
                         usedPercent > 75 ? 'warning.main' : 'rgba(255, 255, 255, 0.3)'
              }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {freePercent.toFixed(0)}% available ({freeGB.toFixed(1)} GB)
          </Typography>
        </Box>

        {/* Filesystem Info */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: fsInfo.good ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
            border: '1px solid',
            borderColor: fsInfo.good ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {fsInfo.good ? (
              <GoodIcon sx={{ fontSize: 16, color: 'success.main' }} />
            ) : (
              <WarningIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            )}
            <Typography variant="caption" fontWeight={600}>
              {fsInfo.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {fsInfo.desc}
            </Typography>
          </Box>
        </Box>

        {/* Size Warning */}
        {!isLargeEnough && (
          <Box
            sx={{
              mt: 1,
              p: 1,
              borderRadius: 1,
              bgcolor: 'rgba(255, 152, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography variant="caption" color="warning.main">
              Drive is smaller than recommended {STORAGE.MIN_RECOMMENDED_GB}GB
            </Typography>
          </Box>
        )}
      </CardActionArea>
    </Card>
  );
}
