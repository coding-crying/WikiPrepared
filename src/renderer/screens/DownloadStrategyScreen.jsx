import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Chip, Stack } from '@mui/material';
import {
  CloudDownload as CloudIcon,
  Usb as UsbIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, DOWNLOAD_STRATEGIES } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

/**
 * Step 3.5: Download strategy selection
 * Choose between downloading to USB directly or to local first
 */
export default function DownloadStrategyScreen() {
  const navigate = useNavigate();
  const {
    setDownloadStrategy,
    getTotalSize
  } = useAppFlowStore();

  const totalSize = getTotalSize();

  const handleChoice = (strategy) => {
    setDownloadStrategy(strategy);
    navigate(ROUTES.DOWNLOADING);
  };

  const handleBack = () => {
    navigate(ROUTES.CONFIGURE);
  };

  const strategies = [
    {
      id: DOWNLOAD_STRATEGIES.LOCAL_FIRST,
      icon: CloudIcon,
      title: 'Download to Computer First',
      subtitle: 'Recommended',
      description: 'Download files to your computer, then transfer to USB',
      benefits: [
        'Safer - USB can be removed during download',
        'Can manage old versions during transfer',
        'Faster final transfer'
      ],
      color: 'success.main',
      isRecommended: true
    },
    {
      id: DOWNLOAD_STRATEGIES.DIRECT_TO_USB,
      icon: UsbIcon,
      title: 'Download Directly to USB',
      description: 'Download files directly to the USB drive',
      benefits: [
        'Saves computer storage space',
        'One-step process'
      ],
      warnings: [
        'Keep USB plugged in during download',
        'May need to delete old files first'
      ],
      color: 'primary.main',
      isRecommended: false
    }
  ];

  return (
    <AppLayout
      title="Choose Download Method"
      subtitle={`Total download size: ${formatBytes(totalSize)}`}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 700,
          mx: 'auto'
        }}
      >
        {strategies.map((strategy) => (
          <Card
            key={strategy.id}
            sx={{
              cursor: 'pointer',
              border: 2,
              borderColor: strategy.isRecommended ? 'success.main' : 'transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6
              }
            }}
            onClick={() => handleChoice(strategy.id)}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <strategy.icon sx={{ fontSize: 48, color: strategy.color, mr: 2 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="h6">
                      {strategy.title}
                    </Typography>
                    {strategy.isRecommended && (
                      <Chip
                        label="Recommended"
                        color="success"
                        size="small"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {strategy.description}
                  </Typography>
                </Box>
              </Box>

              {/* Benefits */}
              {strategy.benefits && (
                <Box sx={{ mb: 1 }}>
                  <Stack spacing={0.5}>
                    {strategy.benefits.map((benefit, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                        <CheckIcon sx={{ fontSize: 18, color: 'success.main', mr: 1 }} />
                        <Typography variant="body2">
                          {benefit}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Warnings */}
              {strategy.warnings && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    bgcolor: 'warning.light',
                    borderRadius: 1
                  }}
                >
                  <Stack spacing={0.5}>
                    {strategy.warnings.map((warning, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center' }}>
                        <WarningIcon sx={{ fontSize: 18, color: 'warning.dark', mr: 1 }} />
                        <Typography variant="caption" color="warning.dark">
                          {warning}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>

      <NavigationButtons onBack={handleBack} showNext={false} />
    </AppLayout>
  );
}
