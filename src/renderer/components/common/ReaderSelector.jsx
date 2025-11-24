import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardActionArea, Link, Grid, Chip } from '@mui/material';
import { CheckCircle as CheckIcon, Cached as CachedIcon } from '@mui/icons-material';
import { FaWindows, FaLinux, FaApple, FaAndroid } from 'react-icons/fa';
import { PLATFORMS, READER_SIZES } from '../../utils/constants';
import { formatBytes } from '../../utils/formatters';

/**
 * Platform tile component
 */
function PlatformTile({ platform, label, icon: Icon, size, isSelected, onToggle, isCached }) {
  return (
    <Card
      sx={{
        bgcolor: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'background.paper',
        border: '2px solid',
        borderColor: isSelected ? 'success.main' : 'divider',
        transition: 'all 0.2s ease',
        position: 'relative',
        '&:hover': {
          borderColor: isSelected ? 'success.main' : 'rgba(255, 255, 255, 0.3)',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <CardActionArea onClick={onToggle} sx={{ p: 2, textAlign: 'center' }}>
        {/* Selected indicator */}
        {isSelected && (
          <CheckIcon
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: 20,
              color: 'success.main'
            }}
          />
        )}

        {/* Cached indicator */}
        {isCached && !isSelected && (
          <CachedIcon
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              fontSize: 16,
              color: 'info.main'
            }}
          />
        )}

        {/* Platform icon */}
        <Box sx={{ fontSize: 36, color: isSelected ? 'text.primary' : 'text.secondary', mb: 1 }}>
          <Icon />
        </Box>

        {/* Platform name */}
        <Typography variant="subtitle2" fontWeight={600}>
          {label}
        </Typography>

        {/* Size and cache status */}
        <Typography variant="caption" color="text.secondary">
          {formatBytes(size)}
          {isCached && (
            <Chip
              label="Cached"
              size="small"
              sx={{
                ml: 0.5,
                height: 16,
                fontSize: '0.6rem',
                bgcolor: 'info.dark'
              }}
            />
          )}
        </Typography>
      </CardActionArea>
    </Card>
  );
}

/**
 * Reader platform selector with large tiles
 */
export default function ReaderSelector({ selectedReaders, onToggle }) {
  const [cacheInfo, setCacheInfo] = useState({});

  useEffect(() => {
    // Fetch cache info on mount
    async function loadCacheInfo() {
      try {
        const info = await window.electronAPI.invoke('kiwix:get-cache-info');
        setCacheInfo(info);
      } catch (error) {
        console.error('Failed to load Kiwix cache info:', error);
      }
    }
    loadCacheInfo();
  }, []);

  const platforms = [
    {
      id: PLATFORMS.WINDOWS,
      label: 'Windows',
      icon: FaWindows,
      size: READER_SIZES[PLATFORMS.WINDOWS]
    },
    {
      id: PLATFORMS.LINUX,
      label: 'Linux',
      icon: FaLinux,
      size: READER_SIZES[PLATFORMS.LINUX]
    },
    {
      id: PLATFORMS.MACOS,
      label: 'macOS',
      icon: FaApple,
      size: READER_SIZES[PLATFORMS.MACOS]
    },
    {
      id: PLATFORMS.ANDROID,
      label: 'Android',
      icon: FaAndroid,
      size: READER_SIZES[PLATFORMS.ANDROID]
    }
  ];

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Kiwix Reader Apps
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Include reader apps for these platforms
      </Typography>

      {/* Platform tiles grid */}
      <Grid container spacing={1.5}>
        {platforms.map((platform) => (
          <Grid item xs={6} sm={3} key={platform.id}>
            <PlatformTile
              platform={platform.id}
              label={platform.label}
              icon={platform.icon}
              size={platform.size}
              isSelected={selectedReaders.includes(platform.id)}
              onToggle={() => onToggle(platform.id)}
              isCached={cacheInfo[platform.id]?.cached}
            />
          </Grid>
        ))}
      </Grid>

      {/* iOS and PWA info - prominent cards */}
      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
          Other Platforms
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* iOS Card */}
          <Box
            component="a"
            href="https://apps.apple.com/app/kiwix/id997079563"
            target="_blank"
            rel="noopener"
            sx={{
              flex: 1,
              minWidth: 140,
              p: 1.5,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            <FaApple style={{ fontSize: 24, color: '#999' }} />
            <Box>
              <Typography variant="body2" fontWeight={600}>iOS / iPadOS</Typography>
              <Typography variant="caption" color="text.secondary">App Store</Typography>
            </Box>
          </Box>

          {/* PWA Card */}
          <Box
            component="a"
            href="https://pwa.kiwix.org"
            target="_blank"
            rel="noopener"
            sx={{
              flex: 1,
              minWidth: 140,
              p: 1.5,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            <Box sx={{ fontSize: 24, color: '#999' }}>🌐</Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>Web Browser</Typography>
              <Typography variant="caption" color="text.secondary">pwa.kiwix.org</Typography>
            </Box>
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          These options don't require downloading - users can access Kiwix directly from their device's app store or any modern web browser.
        </Typography>
      </Box>
    </Box>
  );
}
