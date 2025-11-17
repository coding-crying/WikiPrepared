import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './styles/theme';
import './styles/animations.css';

// Screens
import InitialChoiceScreen from './screens/InitialChoiceScreen';
import DriveSelectionScreen from './screens/DriveSelectionScreen';
import FilesystemWarningScreen from './screens/FilesystemWarningScreen';
import MainConfigScreen from './screens/MainConfigScreen';
import DownloadStrategyScreen from './screens/DownloadStrategyScreen';
import DownloadProgressScreen from './screens/DownloadProgressScreen';
import TransferProgressScreen from './screens/TransferProgressScreen';
import CompletionScreen from './screens/CompletionScreen';

// Debug component (only in development)
import ElectronAPIDebug from './components/common/ElectronAPIDebug';

import { ROUTES } from './utils/constants';

/**
 * Main Application Component
 * Redesigned with full UI flow for creating and updating Wikipedia USB sticks
 */
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Debug helper - remove in production */}
      {process.env.NODE_ENV === 'development' && <ElectronAPIDebug />}
      <Router>
        <Routes>
          {/* Redirect root to start */}
          <Route path="/" element={<Navigate to={ROUTES.START} replace />} />

          {/* Main flow */}
          <Route path={ROUTES.START} element={<InitialChoiceScreen />} />
          <Route path={ROUTES.DRIVE_SELECTION} element={<DriveSelectionScreen />} />
          <Route path={ROUTES.FILESYSTEM_WARNING} element={<FilesystemWarningScreen />} />
          <Route path={ROUTES.CONFIGURE} element={<MainConfigScreen />} />
          <Route path={ROUTES.DOWNLOAD_STRATEGY} element={<DownloadStrategyScreen />} />
          <Route path={ROUTES.DOWNLOADING} element={<DownloadProgressScreen />} />
          <Route path={ROUTES.TRANSFERRING} element={<TransferProgressScreen />} />
          <Route path={ROUTES.COMPLETE} element={<CompletionScreen />} />

          {/* Catch all - redirect to start */}
          <Route path="*" element={<Navigate to={ROUTES.START} replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
