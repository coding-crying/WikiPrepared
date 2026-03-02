import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Link, Alert } from '@mui/material';
import { ArrowForward as ArrowIcon, Usb as UsbIcon, Schedule as ScheduleIcon, ShoppingCart as ShopIcon } from '@mui/icons-material';
import AppLayout from '../components/layout/AppLayout';
import { ROUTES } from '../utils/constants';

/**
 * Welcome/Start screen
 * Simple entry point that directs to drive selection
 */
export default function InitialChoiceScreen() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate(ROUTES.DRIVE_SELECTION);
  };

  return (
    <AppLayout hideSteps>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 3
        }}
      >
        {/* Two-column layout for landscape */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'center',
            gap: { xs: 4, md: 6 },
            maxWidth: 800
          }}
        >
          {/* Left: Icon */}
          <Box
            sx={{
              width: { xs: 100, md: 140 },
              height: { xs: 100, md: 140 },
              borderRadius: '50%',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <UsbIcon sx={{ fontSize: { xs: 48, md: 64 }, color: 'primary.main' }} />
          </Box>

          {/* Right: Content */}
          <Box sx={{ textAlign: { xs: 'center', md: 'left' }, maxWidth: 520 }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              Put Wikipedia on a USB stick
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 3, lineHeight: 1.7, fontSize: '1.05rem' }}
            >
              Once set up, your USB stick works anywhere without internet.
            </Typography>

            {/* CTA Button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleGetStarted}
              endIcon={<ArrowIcon />}
              sx={{
                px: 5,
                py: 1.5,
                fontSize: '1.1rem',
                mb: 3
              }}
            >
              Get Started
            </Button>

            {/* Time warning - simple text */}
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 1,
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <Typography variant="body2" sx={{ mb: 1, fontSize: '0.95rem' }}>
                <strong>Note:</strong> Full Wikipedia can take 10-20 hours to download.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                Keep this software running during the download.
              </Typography>
            </Box>

            {/* Slow internet option */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.95rem' }}>
              Slow internet?{' '}
              <Link
                href="https://wikiprepared.com/shop"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buy a premade USB stick
              </Link>
            </Typography>

            {/* Footer links */}
            <Box
              sx={{
                display: 'flex',
                gap: 2.5,
                alignItems: 'center',
                justifyContent: { xs: 'center', md: 'flex-start' }
              }}
            >
              <Link
                href="https://wikiprepared.com"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                }}
              >
                wikiprepared.com
              </Link>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Link
                href="https://wikiprepared.com/support"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                }}
              >
                Support the Project
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}
