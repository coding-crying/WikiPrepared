import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  Button,
  CircularProgress,
  Divider,
  Alert
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useZimsStore } from '../stores/zimsStore';
import { useStorageCalculation } from '../hooks/useStorageCalculation';
import ZimListItem from '../components/common/ZimListItem';
import ReaderSelector from '../components/common/ReaderSelector';
import StorageBar from '../components/common/StorageBar';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, getLanguageName } from '../utils/constants';

/**
 * Step 3: Main configuration screen (iTunes-style)
 * Select ZIM files and reader apps
 */
export default function MainConfigScreen() {
  const navigate = useNavigate();

  // App flow state
  const {
    selectedDrive,
    selectedZims,
    selectedReaders,
    toggleZim,
    toggleReader,
    userIntent
  } = useAppFlowStore();

  // ZIM store state
  const {
    catalog,
    isLoading,
    selectedLanguage,
    installedZims,
    updates,
    fetchCatalog,
    setLanguage,
    getFilteredZims,
    getAvailableLanguages,
    scanInstalledZims,
    checkForUpdates
  } = useZimsStore();

  // Storage calculation
  const {
    zimSize,
    readerSize,
    totalSize,
    availableSpace,
    usedSpace,
    hasSpace
  } = useStorageCalculation();

  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  useEffect(() => {
    // Fetch ZIM catalog
    fetchCatalog();

    // If updating mode and drive selected, scan for installed ZIMs
    if (userIntent === 'update' && selectedDrive) {
      const mountpoint = selectedDrive.mountpoints?.[0]?.path;
      if (mountpoint) {
        scanInstalledZims(mountpoint).catch(console.error);
      }
    }
  }, []);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      await checkForUpdates();
    } catch (error) {
      console.error('Failed to check updates:', error);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleContinue = () => {
    if (selectedZims.length === 0) {
      alert('Please select at least one Wikipedia dump');
      return;
    }

    if (!hasSpace) {
      alert('Selected content exceeds available space. Please reduce your selection.');
      return;
    }

    // If no drive selected, go straight to downloading (local download)
    if (!selectedDrive) {
      navigate(ROUTES.DOWNLOADING);
    } else {
      navigate(ROUTES.DOWNLOAD_STRATEGY);
    }
  };

  const handleBack = () => {
    navigate(ROUTES.DRIVE_SELECTION);
  };

  const filteredZims = getFilteredZims();
  const availableLanguages = getAvailableLanguages();

  return (
    <AppLayout
      title="Configure Your Wikipedia Stick"
      subtitle="Select content and reader apps to include"
      maxWidth="xl"
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Grid container spacing={3} sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
          {/* Left: ZIM Selection */}
          <Grid item xs={12} md={7}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                📚 Wikipedia Content
              </Typography>

              {/* Installed ZIMs (for update mode) */}
              {installedZims.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Installed ZIMs
                    </Typography>
                    <Button
                      size="small"
                      startIcon={isCheckingUpdates ? <CircularProgress size={16} /> : <RefreshIcon />}
                      onClick={handleCheckUpdates}
                      disabled={isCheckingUpdates}
                    >
                      Check for Updates
                    </Button>
                  </Box>

                  <List dense>
                    {installedZims.map((zim) => (
                      <ZimListItem
                        key={zim.filename}
                        zim={zim}
                        isSelected={selectedZims.some(z => z.filename === zim.filename)}
                        onToggle={() => toggleZim(zim)}
                        showUpdate={true}
                      />
                    ))}
                  </List>

                  {updates.length > 0 && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      {updates.length} update{updates.length > 1 ? 's' : ''} available!
                    </Alert>
                  )}

                  <Divider sx={{ my: 2 }} />
                </Box>
              )}

              {/* Add new ZIMs */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Add New Content
              </Typography>

              {/* Language selector */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Language</InputLabel>
                <Select
                  value={availableLanguages.includes(selectedLanguage) ? selectedLanguage : ''}
                  onChange={(e) => setLanguage(e.target.value)}
                  label="Language"
                  disabled={availableLanguages.length === 0}
                >
                  {availableLanguages.length === 0 ? (
                    <MenuItem value="">Loading languages...</MenuItem>
                  ) : (
                    availableLanguages.map((lang) => (
                      <MenuItem key={lang} value={lang}>
                        {getLanguageName(lang)}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {/* ZIM list */}
              {isLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Loading catalog...
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  <List dense>
                    {filteredZims.map((zim) => (
                      <ZimListItem
                        key={zim.filename}
                        zim={zim}
                        isSelected={selectedZims.some(z => z.filename === zim.filename)}
                        onToggle={() => toggleZim(zim)}
                      />
                    ))}
                  </List>

                  {filteredZims.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No Wikipedia dumps available for this language
                    </Typography>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right: Reader Apps */}
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              <ReaderSelector
                selectedReaders={selectedReaders}
                onToggle={toggleReader}
              />

              {/* Selected summary */}
              {selectedZims.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Selected Content:
                  </Typography>
                  <List dense>
                    {selectedZims.map((zim) => (
                      <Typography key={zim.filename} variant="caption" display="block">
                        • {getLanguageName(zim.language)} - {zim.scope}
                      </Typography>
                    ))}
                  </List>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Storage Bar - stays at bottom */}
        <Box sx={{ flexShrink: 0, mt: 2 }}>
          {selectedDrive ? (
            <StorageBar
              used={usedSpace}
              selected={totalSize}
              total={availableSpace}
              showFlashing={selectedZims.length > 0}
            />
          ) : (
            <Alert severity="info">
              Downloading to local computer
            </Alert>
          )}
        </Box>

        {/* Navigation Buttons - always visible at bottom */}
        <Box sx={{ flexShrink: 0 }}>
          <NavigationButtons
            onBack={handleBack}
            onNext={handleContinue}
            nextDisabled={selectedZims.length === 0 || !hasSpace}
          />
        </Box>
      </Box>
    </AppLayout>
  );
}
