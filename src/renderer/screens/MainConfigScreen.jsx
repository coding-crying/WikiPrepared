import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  LibraryBooks as ContentIcon,
  Apps as AppsIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import { useZimsStore } from '../stores/zimsStore';
import { useStorageCalculation } from '../hooks/useStorageCalculation';
import ZimListItem from '../components/common/ZimListItem';
import ReaderSelector from '../components/common/ReaderSelector';
import StorageBar from '../components/common/StorageBar';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';
import { ROUTES, getLanguageName, STORAGE } from '../utils/constants';
import { formatBytes } from '../utils/formatters';

/**
 * Step 2: Main configuration screen with tabs
 * Select ZIM files and reader apps
 */
export default function MainConfigScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [expandedAccordion, setExpandedAccordion] = useState('addNew'); // 'existing' or 'addNew'

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  // App flow state
  const {
    selectedDrive,
    selectedZims,
    selectedReaders,
    toggleZim,
    toggleReader
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
    totalCapacity,
    usedSpace,
    freeSpace,
    hasSpace
  } = useStorageCalculation();

  const [localDiskInfo, setLocalDiskInfo] = useState(null);

  // Get the largest file size to check filesystem compatibility
  const largestFileSize = selectedZims.reduce((max, zim) => Math.max(max, zim.size || 0), 0);

  useEffect(() => {
    const initialize = async () => {
      // Fetch ZIM catalog first
      await fetchCatalog();

      // Always scan for installed ZIMs when a drive is selected
      if (selectedDrive) {
        const mountpoint = selectedDrive.mountpoints?.[0]?.path || selectedDrive.mountpoint;
        if (mountpoint) {
          try {
            const zims = await scanInstalledZims(mountpoint);
            if (zims && zims.length > 0) {
              await checkForUpdates();
            }
          } catch (err) {
            console.error('Failed to scan ZIMs:', err);
          }
        }
      }

      // Get local disk info for local download validation
      if (!selectedDrive) {
        window.electronAPI.invoke('download:get-local-disk-info')
          .then(setLocalDiskInfo)
          .catch(console.error);
      }
    };

    initialize();
  }, [selectedDrive]);

  const handleContinue = () => {
    if (selectedZims.length === 0) {
      alert('Please select at least one Wikipedia dump');
      return;
    }

    if (!hasSpace) {
      alert('Selected content exceeds available space. Please reduce your selection.');
      return;
    }

    // If no drive selected, validate local disk for local download
    if (!selectedDrive) {
      if (localDiskInfo) {
        if (localDiskInfo.freeSpace < totalSize) {
          alert(`Not enough space on local disk. Need ${formatBytes(totalSize)}, have ${formatBytes(localDiskInfo.freeSpace)}.`);
          return;
        }
        if (!localDiskInfo.supportsLargeFiles && largestFileSize > STORAGE.FAT32_MAX_FILE_SIZE) {
          alert(`Your filesystem (${localDiskInfo.filesystem}) doesn't support files over 4GB.`);
          return;
        }
      }
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

  // Determine recommended ZIM based on drive capacity
  // 128GB drive is usually ~119GiB. Full Wikipedia (maxi) is ~100-110GB.
  // 64GB drive is usually ~59GiB. Nopic is ~45GB.
  let recommendedScope = null;
  if (totalCapacity > 100 * 1024 * 1024 * 1024) { // > 100GB
    recommendedScope = 'maxi';
  } else if (totalCapacity > 50 * 1024 * 1024 * 1024) { // > 50GB
    recommendedScope = 'nopic';
  }

  // Count items for tab badges
  const selectedContentCount = selectedZims.length;
  const selectedReadersCount = selectedReaders.length;

  // Compute tooltip message for disabled Continue button
  const continueTooltip = selectedZims.length === 0
    ? "Please select at least one Wikipedia dump"
    : !hasSpace
      ? "Not enough space. Reduce selection or choose a larger drive"
      : "";

  return (
    <AppLayout
      title="Choose Content"
      subtitle={selectedDrive ? `Installing to: ${selectedDrive.label || selectedDrive.device}` : 'Downloading to local computer'}
      maxWidth="lg"
      currentStep={2}
    >
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            sx={{ minHeight: 42 }}
          >
            <Tab
              icon={<ContentIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Wikipedia Content
                  {selectedContentCount > 0 && (
                    <Chip label={selectedContentCount} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                  )}
                </Box>
              }
              sx={{ minHeight: 42, textTransform: 'none' }}
            />
            <Tab
              icon={<AppsIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Reader Apps
                  {selectedReadersCount > 0 && (
                    <Chip label={selectedReadersCount} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                  )}
                </Box>
              }
              sx={{ minHeight: 42, textTransform: 'none' }}
            />
          </Tabs>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
          {/* Content Tab */}
          {activeTab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Existing ZIMs on drive - Collapsible */}
              {installedZims.length > 0 && (
                <Accordion
                  expanded={expandedAccordion === 'existing'}
                  onChange={handleAccordionChange('existing')}
                  sx={{
                    bgcolor: 'background.paper',
                    '&:before': { display: 'none' },
                    border: '1px solid',
                    borderColor: expandedAccordion === 'existing' ? 'text.secondary' : 'divider',
                    mb: 1
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      minHeight: 48, 
                      '& .MuiAccordionSummary-content': { my: 1 },
                      bgcolor: expandedAccordion === 'existing' ? 'action.hover' : 'transparent'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} color={expandedAccordion === 'existing' ? 'text.primary' : 'text.secondary'}>
                        Existing Content on Drive
                      </Typography>
                      <Chip label={installedZims.length} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                      {updates.length > 0 && (
                        <Chip
                          label={`${updates.length} update${updates.length > 1 ? 's' : ''}`}
                          size="small"
                          color="warning"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    {updates.length > 0 && (
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {updates.length} ZIM file{updates.length > 1 ? 's have' : ' has'} newer versions available
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            // Select all ZIMs that have updates
                            const updatedZims = installedZims.filter(zim => zim.hasUpdate);
                            updatedZims.forEach(zim => {
                              if (!selectedZims.some(z => z.filename === zim.filename)) {
                                toggleZim(zim);
                              }
                            });
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Select All Updates
                        </Button>
                      </Box>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1 }}>
                      {installedZims.map((zim) => (
                        <ZimListItem
                          key={zim.filename}
                          zim={zim}
                          isSelected={selectedZims.some(z => z.filename === zim.filename)}
                          onToggle={() => toggleZim(zim)}
                          showUpdate={true}
                        />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Add New Content - Collapsible */}
              <Accordion
                expanded={expandedAccordion === 'addNew'}
                onChange={handleAccordionChange('addNew')}
                sx={{
                  bgcolor: 'background.paper',
                  '&:before': { display: 'none' },
                  border: '1px solid',
                  borderColor: expandedAccordion === 'addNew' ? 'primary.main' : 'divider',
                  flex: expandedAccordion === 'addNew' ? 1 : 'none',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ 
                    minHeight: 48, 
                    '& .MuiAccordionSummary-content': { my: 1 },
                    bgcolor: expandedAccordion === 'addNew' ? 'rgba(25, 118, 210, 0.04)' : 'transparent'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color={expandedAccordion === 'addNew' ? 'primary' : 'text.primary'}>
                      Add New Content
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2, flex: 1, overflow: 'auto', minHeight: 100 }}>
                  {/* Language Selector */}
                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Tooltip
                      title={availableLanguages.length === 0 ? "Loading available languages..." : ""}
                      arrow
                      placement="top"
                    >
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Language</InputLabel>
                        <Select
                          value={availableLanguages.includes(selectedLanguage) ? selectedLanguage : ''}
                          onChange={(e) => setLanguage(e.target.value)}
                          label="Language"
                          disabled={availableLanguages.length === 0}
                        >
                          {availableLanguages.map((lang) => (
                            <MenuItem key={lang} value={lang}>
                              {getLanguageName(lang)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Tooltip>
                    {availableLanguages.length === 0 && <CircularProgress size={20} />}
                  </Box>

                  {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                      <CircularProgress size={32} />
                    </Box>
                  ) : filteredZims.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No Wikipedia dumps available for this language
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gridAutoFlow: 'dense', gap: 1 }}>
                      {filteredZims.map((zim) => {
                        const isRecommended = zim.scope === recommendedScope && zim.topic === 'all';
                        return (
                          <ZimListItem
                            key={zim.filename}
                            zim={zim}
                            isSelected={selectedZims.some(z => z.filename === zim.filename)}
                            onToggle={() => toggleZim(zim)}
                            isRecommended={isRecommended}
                            sx={isRecommended ? { gridColumn: { sm: 'span 2' } } : {}}
                          />
                        );
                      })}
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {/* Reader Apps Tab */}
          {activeTab === 1 && (
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <ReaderSelector
                selectedReaders={selectedReaders}
                onToggle={toggleReader}
              />
            </Paper>
          )}
        </Box>

        {/* Selection Summary */}
        {(selectedZims.length > 0 || selectedReaders.length > 0) && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
              bgcolor: 'rgba(255,255,255,0.03)'
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Selected:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
              {selectedZims.slice(0, 3).map((zim) => (
                <Chip
                  key={zim.filename}
                  label={zim.language ? `${getLanguageName(zim.language)}` : zim.filename?.split('.')[0]}
                  size="small"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              ))}
              {selectedZims.length > 3 && (
                <Chip
                  label={`+${selectedZims.length - 3} more`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
              {selectedReaders.length > 0 && (
                <Chip
                  label={`${selectedReaders.length} reader${selectedReaders.length > 1 ? 's' : ''}`}
                  size="small"
                  color="secondary"
                  sx={{ height: 22, fontSize: '0.7rem' }}
                />
              )}
            </Box>
            <Typography variant="caption" fontWeight={600}>
              {formatBytes(totalSize)}
            </Typography>
          </Paper>
        )}

        {/* Navigation with Storage Bar */}
        <Box sx={{ flexShrink: 0 }}>
          <NavigationButtons
            onBack={handleBack}
            onNext={handleContinue}
            nextDisabled={selectedZims.length === 0 || !hasSpace}
            nextDisabledTooltip={continueTooltip}
            centerContent={
              selectedDrive ? (
                <StorageBar
                  used={usedSpace}
                  selected={totalSize}
                  total={totalCapacity}
                  showFlashing={selectedZims.length > 0}
                  compact={true}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Local download {localDiskInfo && `(${formatBytes(localDiskInfo.freeSpace)} free)`}
                </Typography>
              )
            }
          />
        </Box>
      </Box>
    </AppLayout>
  );
}
