import React, { useEffect, useState } from 'react';
import { Alert, Box, Typography, Button, Paper, List, ListItem } from '@mui/material';
import { Warning, CheckCircle } from '@mui/icons-material';

/**
 * Development component to debug electronAPI availability
 * Shows detailed info about what's available and what's not
 */
export default function ElectronAPIDebug() {
  const [debugInfo, setDebugInfo] = useState({
    hasWindow: false,
    hasElectronAPI: false,
    apiMethods: [],
    error: null
  });

  useEffect(() => {
    const info = {
      hasWindow: typeof window !== 'undefined',
      hasElectronAPI: typeof window !== 'undefined' && !!window.electronAPI,
      apiMethods: [],
      error: null
    };

    if (info.hasElectronAPI) {
      try {
        info.apiMethods = Object.keys(window.electronAPI);
      } catch (error) {
        info.error = error.message;
      }
    }

    setDebugInfo(info);

    // Log to console
    console.group('🔍 Electron API Debug Info');
    console.log('Window available:', info.hasWindow);
    console.log('electronAPI available:', info.hasElectronAPI);
    if (info.hasElectronAPI) {
      console.log('Available methods:', info.apiMethods);
    } else {
      console.error('❌ electronAPI is NOT available!');
      console.log('This means the preload script did not expose the API properly.');
      console.log('Check:');
      console.log('  1. Is preload.js being loaded?');
      console.log('  2. Is contextBridge working?');
      console.log('  3. Are there any errors in the main process console?');
    }
    console.groupEnd();
  }, []);

  if (!debugInfo.hasElectronAPI) {
    return (
      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          bgcolor: 'error.main',
          color: 'white',
          p: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Warning sx={{ fontSize: 40 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold">
              ⚠️ Electron API Not Available
            </Typography>
            <Typography variant="body2">
              The preload script did not expose window.electronAPI. This app cannot function without it.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', p: 2, borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Troubleshooting Steps:
          </Typography>
          <List dense>
            <ListItem sx={{ color: 'white' }}>
              1. Check the main process console for preload script errors
            </ListItem>
            <ListItem sx={{ color: 'white' }}>
              2. Verify preload.js is in the correct location
            </ListItem>
            <ListItem sx={{ color: 'white' }}>
              3. Ensure contextIsolation is enabled in webPreferences
            </ListItem>
            <ListItem sx={{ color: 'white' }}>
              4. Check that MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY is correct
            </ListItem>
          </List>
        </Box>

        <Button
          variant="contained"
          sx={{ mt: 2, bgcolor: 'white', color: 'error.main' }}
          onClick={() => window.location.reload()}
        >
          Reload Window
        </Button>
      </Paper>
    );
  }

  // API is available - show success
  return (
    <Alert
      severity="success"
      icon={<CheckCircle />}
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: 400
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold">
        ✓ Electron API Loaded
      </Typography>
      <Typography variant="caption" display="block">
        {debugInfo.apiMethods.length} methods available
      </Typography>
    </Alert>
  );
}
