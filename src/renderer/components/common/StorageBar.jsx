import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { formatBytes } from '../../utils/formatters';
import '../../styles/animations.css';

/**
 * Storage bar with visual breakdown and flashing animation
 */
export default function StorageBar({
  used = 0,
  selected = 0,
  total,
  showFlashing = false,
  showDetails = true
}) {
  const usedPercent = total > 0 ? (used / total) * 100 : 0;
  const selectedPercent = total > 0 ? (selected / total) * 100 : 0;
  const totalPercent = usedPercent + selectedPercent;
  const isOverCapacity = totalPercent > 100;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Visual bar */}
      <Box
        sx={{
          position: 'relative',
          height: 48,
          borderRadius: 2,
          bgcolor: 'grey.200',
          overflow: 'hidden'
        }}
      >
        {/* Used space (blue) */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            width: `${Math.min(usedPercent, 100)}%`,
            height: '100%',
            bgcolor: 'primary.main',
            transition: 'width 0.3s ease-in-out'
          }}
        />

        {/* Selected space (green/red with flashing) */}
        {selected > 0 && (
          <Box
            className={showFlashing ? 'storage-flash' : ''}
            sx={{
              position: 'absolute',
              left: `${Math.min(usedPercent, 100)}%`,
              width: `${Math.min(selectedPercent, 100 - usedPercent)}%`,
              height: '100%',
              bgcolor: isOverCapacity ? 'error.main' : 'success.main',
              transition: 'width 0.3s ease-in-out, left 0.3s ease-in-out'
            }}
          />
        )}

        {/* Center text overlay */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: totalPercent > 50 ? 'white' : 'text.primary'
          }}
        >
          <Typography variant="body1" fontWeight="bold">
            {formatBytes(used + selected)} / {formatBytes(total)}
            {isOverCapacity && ' - EXCEEDS CAPACITY!'}
          </Typography>
        </Box>
      </Box>

      {/* Details */}
      {showDetails && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 1,
            px: 1
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Used: {formatBytes(used)}
          </Typography>

          {selected > 0 && (
            <Typography
              variant="caption"
              sx={{
                color: isOverCapacity ? 'error.main' : 'success.main',
                fontWeight: 600
              }}
            >
              + {formatBytes(selected)} selected
            </Typography>
          )}

          <Typography variant="caption" color="text.secondary">
            Free: {formatBytes(Math.max(0, total - used - selected))}
          </Typography>
        </Box>
      )}

      {/* Over capacity warning */}
      {isOverCapacity && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: 'error.light',
            borderRadius: 1
          }}
        >
          <Typography variant="caption" color="error.dark" fontWeight="600">
            ⚠️ Selected content exceeds available space by {formatBytes(used + selected - total)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
