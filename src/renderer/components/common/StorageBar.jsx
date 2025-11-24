import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { formatBytes } from '../../utils/formatters';
import '../../styles/animations.css';

/**
 * Compact storage bar with visual breakdown
 */
export default function StorageBar({
  used = 0,
  selected = 0,
  total,
  showFlashing = false,
  compact = false
}) {
  const usedPercent = total > 0 ? (used / total) * 100 : 0;
  const selectedPercent = total > 0 ? (selected / total) * 100 : 0;
  const totalPercent = usedPercent + selectedPercent;
  const isOverCapacity = totalPercent > 100;
  const freeSpace = Math.max(0, total - used - selected);

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="caption" display="block">
        Used: {formatBytes(used)}
      </Typography>
      {selected > 0 && (
        <Typography variant="caption" display="block" sx={{ color: isOverCapacity ? '#ff6b6b' : '#69db7c' }}>
          Selected: +{formatBytes(selected)}
        </Typography>
      )}
      <Typography variant="caption" display="block">
        Free: {formatBytes(freeSpace)}
      </Typography>
      <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
        Total: {formatBytes(total)}
      </Typography>
    </Box>
  );

  if (compact) {
    return (
      <Tooltip title={tooltipContent} arrow placement="top">
        <Box sx={{ flex: 1, mx: 2, maxWidth: 300 }}>
          {/* Compact bar */}
          <Box
            sx={{
              position: 'relative',
              height: 24,
              borderRadius: 1.5,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: isOverCapacity ? 'error.main' : 'rgba(255, 255, 255, 0.2)'
            }}
          >
            {/* Used space (muted blue-gray) */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                width: `${Math.min(usedPercent, 100)}%`,
                height: '100%',
                bgcolor: 'rgba(100, 120, 150, 0.8)',
                transition: 'width 0.3s ease-in-out'
              }}
            />

            {/* Selected space (accent color) */}
            {selected > 0 && (
              <Box
                className={showFlashing ? 'storage-flash' : ''}
                sx={{
                  position: 'absolute',
                  left: `${Math.min(usedPercent, 100)}%`,
                  width: `${Math.min(selectedPercent, 100 - Math.min(usedPercent, 100))}%`,
                  height: '100%',
                  bgcolor: isOverCapacity ? '#ff6b6b' : '#51cf66',
                  transition: 'width 0.3s ease-in-out, left 0.3s ease-in-out'
                }}
              />
            )}

            {/* Center text */}
            <Box
              sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {isOverCapacity ? (
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <WarningIcon sx={{ fontSize: 14 }} />
                    Over by {formatBytes(used + selected - total)}
                  </Box>
                ) : (
                  `${formatBytes(freeSpace)} free`
                )}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Tooltip>
    );
  }

  // Full size version
  return (
    <Box sx={{ width: '100%' }}>
      {/* Visual bar */}
      <Box
        sx={{
          position: 'relative',
          height: 32,
          borderRadius: 2,
          bgcolor: 'rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: isOverCapacity ? 'error.main' : 'rgba(255, 255, 255, 0.2)'
        }}
      >
        {/* Used space (muted blue-gray) */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            width: `${Math.min(usedPercent, 100)}%`,
            height: '100%',
            bgcolor: 'rgba(100, 120, 150, 0.8)',
            transition: 'width 0.3s ease-in-out'
          }}
        />

        {/* Selected space (green/red) */}
        {selected > 0 && (
          <Box
            className={showFlashing ? 'storage-flash' : ''}
            sx={{
              position: 'absolute',
              left: `${Math.min(usedPercent, 100)}%`,
              width: `${Math.min(selectedPercent, 100 - Math.min(usedPercent, 100))}%`,
              height: '100%',
              bgcolor: isOverCapacity ? '#ff6b6b' : '#51cf66',
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
            justifyContent: 'center'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            {formatBytes(used + selected)} / {formatBytes(total)}
            {isOverCapacity && ' - EXCEEDS CAPACITY'}
          </Typography>
        </Box>
      </Box>

      {/* Compact details row */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 0.5,
          px: 0.5
        }}
      >
        <Typography variant="caption" color="text.secondary">
          <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(100, 120, 150, 0.8)', mr: 0.5, verticalAlign: 'middle' }} />
          Used: {formatBytes(used)}
        </Typography>

        {selected > 0 && (
          <Typography
            variant="caption"
            sx={{
              color: isOverCapacity ? '#ff6b6b' : '#51cf66',
              fontWeight: 600
            }}
          >
            <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: isOverCapacity ? '#ff6b6b' : '#51cf66', mr: 0.5, verticalAlign: 'middle' }} />
            +{formatBytes(selected)}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary">
          Free: {formatBytes(freeSpace)}
        </Typography>
      </Box>

      {/* Over capacity warning */}
      {isOverCapacity && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            bgcolor: 'rgba(255, 107, 107, 0.15)',
            borderRadius: 1,
            border: '1px solid rgba(255, 107, 107, 0.3)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <WarningIcon fontSize="small" sx={{ color: '#ff6b6b' }} />
            <Typography variant="caption" sx={{ color: '#ff6b6b', fontWeight: 600 }}>
              Selected content exceeds available space by {formatBytes(used + selected - total)}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
