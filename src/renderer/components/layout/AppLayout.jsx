import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import StepIndicator from '../common/StepIndicator';
import ToastContainer from '../common/ToastContainer';
import '../../styles/animations.css';

// Import logo
import logoImage from '../../../../public/images/wikiprepared-wordmark.png';

// Define wizard steps
const WIZARD_STEPS = [
  { id: 'drive', label: 'Select Drive' },
  { id: 'content', label: 'Choose Content' },
  { id: 'download', label: 'Download' },
  { id: 'complete', label: 'Done' }
];

/**
 * Main layout wrapper for all screens
 */
export default function AppLayout({
  title,
  subtitle,
  children,
  maxWidth = 'lg',
  currentStep = null,  // 1-4 for wizard steps, null to hide
  hideSteps = false
}) {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden'
      }}
    >
      <Container
        maxWidth={maxWidth}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          overflow: 'hidden'
        }}
      >
        {/* Compact Header: Logo+Name | Screen Title | Step Indicator */}
        <Box
          sx={{
            mb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            minHeight: 36
          }}
        >
          {/* Left: Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: { xs: 100, md: 160 } }}>
            <Box
              component="img"
              src={logoImage}
              alt="WikiPrepared"
              sx={{
                height: { xs: 24, md: 28 },
                filter: 'invert(1)',
                opacity: 0.9
              }}
            />
          </Box>

          {/* Center: Screen Title */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
            {title && (
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, color: 'text.primary', textAlign: 'center' }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Right: Step Indicator */}
          <Box sx={{ minWidth: { xs: 100, md: 160 }, display: 'flex', justifyContent: 'flex-end' }}>
            {currentStep && !hideSteps && (
              <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />
            )}
          </Box>
        </Box>

        {/* Main content */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            minHeight: 0,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider'
          }}
          className="fade-in"
        >
          {children}
        </Paper>
      </Container>

      {/* Global toast notifications */}
      <ToastContainer />
    </Box>
  );
}
