import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardActionArea, Link, Grid, Chip } from '@mui/material';
import { CheckCircle as CheckIcon, Cached as CachedIcon } from '@mui/icons-material';
import { FaWindows, FaLinux, FaApple, FaAndroid } from 'react-icons/fa';
import { PLATFORMS, READER_SIZES } from '../../utils/constants';
import { formatBytes } from '../../utils/formatters';

/**
 * Platform tile component - Compact version
 */
function PlatformTile({ platform, label, icon: Icon, size, isSelected, onToggle, isCached }) {
  return (
    <Card
      sx={{
        bgcolor: isSelected ? 'rgba(76, 175, 80, 0.1)' : 'background.paper',
        border: '1.5px solid',
        borderColor: isSelected ? 'success.main' : 'divider',
        transition: 'all 0.2s ease',
        position: 'relative',
        '&:hover': {
          borderColor: isSelected ? 'success.main' : 'rgba(255, 255, 255, 0.3)',
          transform: 'translateY(-1px)'
        }
      }}
    >
      <CardActionArea onClick={onToggle} sx={{ p: 1.5, textAlign: 'center' }}>
        {/* Selected indicator */}
        {isSelected && (
          <CheckIcon
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              fontSize: 16,
              color: 'success.main'
            }}
          />
        )}

        {/* Cached indicator */}
        {isCached && !isSelected && (
          <CachedIcon
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              fontSize: 14,
              color: 'info.main'
            }}
          />
        )}

        {/* Platform icon */}
        <Box sx={{ fontSize: 28, color: isSelected ? 'text.primary' : 'text.secondary', mb: 0.5 }}>
          <Icon />
        </Box>

        {/* Platform name */}
        <Typography variant="body2" fontWeight={600}>
          {label}
        </Typography>

        {/* Size and cache status */}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {formatBytes(size)}
          {isCached && (
            <Chip
              label="Cached"
              size="small"
              sx={{
                ml: 0.5,
                height: 14,
                fontSize: '0.55rem',
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
      {/* Platform tiles grid - Compact 4 columns */}
      <Grid container spacing={1}>
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

      {/* iOS and PWA info - Compact cards with caveats */}
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
          Other Platforms (not downloaded)
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {/* iOS Card - Compact */}
          <Box
            component="a"
            href="https://apps.apple.com/app/kiwix/id997079563"
            target="_blank"
            rel="noopener"
            sx={{
              flex: 1,
              minWidth: 120,
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 0.5,
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
            <FaApple style={{ fontSize: 20, color: '#999' }} />
            <Box>
              <Typography variant="caption" fontWeight={600}>iOS / iPadOS</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                App Store only
              </Typography>
            </Box>
          </Box>

          {/* PWA Card - Compact */}
          <Box
            component="a"
            href="https://pwa.kiwix.org"
            target="_blank"
            rel="noopener"
            sx={{
              flex: 1,
              minWidth: 120,
              p: 1,
              bgcolor: 'background.paper',
              borderRadius: 0.5,
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
            <Box sx={{ fontSize: 20, color: '#999' }}>🌐</Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Web Browser</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                pwa.kiwix.org
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
