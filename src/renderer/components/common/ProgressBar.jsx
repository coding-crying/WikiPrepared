import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { formatBytes, formatSpeed, formatDuration } from '../../utils/formatters';
import '../../styles/animations.css';

/**
 * Enhanced progress bar with download info
 */
export default function ProgressBar({
  progress = 0,
  downloadedSize = 0,
  totalSize = 0,
  speed = 0,
  eta = 0,
  filename = '',
  showDetails = true,
  animated = true
}) {
  return (
    <Box sx={{ width: '100%' }}>
      {/* Filename */}
      {filename && (
        <Typography variant="body2" gutterBottom fontWeight={500}>
          {filename}
        </Typography>
      )}

      {/* Progress bar */}
      <Box sx={{ position: 'relative', mb: 1 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(progress, 100)}
          sx={{
            height: 12,
            borderRadius: 2,
            '& .MuiLinearProgress-bar': animated
              ? {
                  backgroundImage: `linear-gradient(
                    45deg,
                    rgba(255, 255, 255, 0.15) 25%,
                    transparent 25%,
                    transparent 50%,
                    rgba(255, 255, 255, 0.15) 50%,
                    rgba(255, 255, 255, 0.15) 75%,
                    transparent 75%,
                    transparent
                  )`,
                  backgroundSize: '20px 20px',
                  animation: 'progress 1s linear infinite'
                }
              : {}
          }}
        />
        {/* Percentage overlay */}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontWeight: 700,
            color: progress > 50 ? 'white' : 'text.primary',
            fontSize: '0.75rem'
          }}
        >
          {progress.toFixed(1)}%
        </Typography>
      </Box>

      {/* Details */}
      {showDetails && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            {formatBytes(downloadedSize)} / {formatBytes(totalSize)}
          </Typography>

          {speed > 0 && (
            <Typography variant="caption" color="text.secondary">
              Speed: {formatSpeed(speed)}
            </Typography>
          )}

          {eta > 0 && (
            <Typography variant="caption" color="text.secondary">
              ETA: {formatDuration(eta)}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
