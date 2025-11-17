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
        py: 4
      }}
    >
      <Container maxWidth={maxWidth}>
        {/* Header */}
        {title && (
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 700, color: 'primary.main' }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        )}

        {/* Main content */}
        <Paper
          elevation={2}
          sx={{
            p: 4,
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}
          className="fade-in"
        >
          {children}
        </Paper>
      </Container>
    </Box>
  );
}
