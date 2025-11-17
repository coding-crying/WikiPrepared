import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import '../../styles/animations.css';

/**
 * Main layout wrapper for all screens
 */
export default function AppLayout({ title, subtitle, children, maxWidth = 'lg' }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        py: { xs: 2, md: 4 },
        overflow: 'auto'
      }}
    >
      <Container maxWidth={maxWidth}>
        {/* Header */}
        {title && (
          <Box sx={{ mb: { xs: 2, md: 4 }, textAlign: 'center' }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 700, color: 'primary.main', fontSize: { xs: '1.75rem', md: '2.125rem' } }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        )}

        {/* Main content */}
        <Paper
          elevation={2}
          sx={{
            p: { xs: 2, md: 4 },
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }}
          className="fade-in"
        >
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
