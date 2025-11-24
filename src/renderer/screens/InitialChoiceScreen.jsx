import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Link } from '@mui/material';
import { ArrowForward as ArrowIcon, Usb as UsbIcon } from '@mui/icons-material';
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
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              Create an offline Wikipedia USB
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ mb: 3, maxWidth: 420 }}
            >
              Download Wikipedia content and Kiwix readers to a USB drive.
              Access knowledge anywhere, no internet required.
            </Typography>

            {/* CTA Button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleGetStarted}
              endIcon={<ArrowIcon />}
              sx={{
                px: 4,
                py: 1.25,
                fontSize: '1rem'
              }}
            >
              Get Started
            </Button>

            {/* Features - horizontal on landscape */}
            <Box
              sx={{
                mt: 3,
                display: 'flex',
                gap: { xs: 3, md: 4 },
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', md: 'flex-start' }
              }}
            >
              {[
                { label: 'Works Offline', desc: 'No internet needed' },
                { label: 'Cross Platform', desc: 'Win, Mac, Linux' },
                { label: 'Auto Updates', desc: 'Keep content fresh' }
              ].map((feature) => (
                <Box key={feature.label} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                  <Typography variant="caption" fontWeight={600} display="block">
                    {feature.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {feature.desc}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Website link */}
            <Box sx={{ mt: 3 }}>
              <Link
                href="https://wikiprepared.com"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main', textDecoration: 'underline' }
                }}
              >
                wikiprepared.com
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </AppLayout>
  );
}
