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
  Chip,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  LibraryBooks as ContentIcon,
  Apps as AppsIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ThumbUp as RecommendedIcon,
  CheckCircle as CheckIcon
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
import { formatBytes, formatDate } from '../utils/formatters';

/**
 * Step 2: Main configuration screen with tabs
 * Select ZIM files and reader apps
 */
export default function MainConfigScreen() {
  const navigate = useNavigate();
  const [expandedAccordion, setExpandedAccordion] = useState('addNew'); // 'existing' or 'addNew'
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [selectedScope, setSelectedScope] = useState('all'); // 'all', 'mini', 'nopic', 'maxi'
  const [selectedTopic, setSelectedTopic] = useState('all'); // 'all' or specific topic

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

  // Auto-select all downloadable readers by default (Windows, Linux, macOS, Android)
  // iOS is App Store only, so it's excluded
  useEffect(() => {
    if (selectedReaders.length === 0) {
      // Auto-select all except iOS
      ['windows', 'linux', 'macos', 'android'].forEach(platform => {
        if (!selectedReaders.includes(platform)) {
          toggleReader(platform);
        }
      });
    }
  }, []); // Only run once on mount

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

  // Smart recommendation logic
  let recommendedScope = null;
  let recommendedZim = null;
  let idealScope = null; // What COULD fit if drive was empty
  let idealZim = null;
  let hasSpaceConstraint = false;
  let recommendationMessage = null;

  // Determine ideal scope based on drive TOTAL capacity
  if (totalCapacity > 100 * 1024 * 1024 * 1024) { // > 100GB
    idealScope = 'maxi';
  } else if (totalCapacity > 50 * 1024 * 1024 * 1024) { // > 50GB
    idealScope = 'nopic';
  } else if (totalCapacity > 20 * 1024 * 1024 * 1024) { // > 20GB
    idealScope = 'mini';
  }

  // Find ideal ZIM
  if (idealScope) {
    idealZim = filteredZims.find(zim =>
      zim.scope === idealScope &&
      zim.topic === 'all' &&
      zim.language === selectedLanguage
    );
  }

  // Check filesystem compatibility for large files (>4GB on FAT32)
  const filesystem = selectedDrive?.fsType?.toLowerCase();
  const supportsLargeFiles = filesystem && ['exfat', 'ntfs', 'ext4', 'ext3', 'apfs', 'hfsplus', 'hfs+', 'hfs', 'btrfs', 'xfs', 'fuseblk'].includes(filesystem);

  // Now determine ACTUAL recommendation based on available space and filesystem
  const scopes = ['maxi', 'nopic', 'mini']; // Ordered by size (largest first)

  for (const scope of scopes) {
    const candidateZim = filteredZims.find(zim =>
      zim.scope === scope &&
      zim.topic === 'all' &&
      zim.language === selectedLanguage
    );

    if (candidateZim) {
      // Check if it fits in available space
      const wouldFit = candidateZim.size <= freeSpace;

      // Check filesystem compatibility for files >4GB
      const filesystemCompatible = supportsLargeFiles || candidateZim.size <= STORAGE.FAT32_MAX_FILE_SIZE;

      if (wouldFit && filesystemCompatible) {
        recommendedZim = candidateZim;
        recommendedScope = scope;

        // Check if we had to downgrade from ideal
        if (idealZim && idealZim.scope !== scope) {
          hasSpaceConstraint = true;
          recommendationMessage = `Your ${formatBytes(totalCapacity)} drive could fit ${idealZim.scope === 'maxi' ? 'the complete Wikipedia with images' : idealZim.scope === 'nopic' ? 'full Wikipedia without images' : 'the mini Wikipedia'} (${formatBytes(idealZim.size)}), but you have existing files using ${formatBytes(usedSpace)}. The largest version that fits now is the ${scope === 'nopic' ? 'No Pictures' : scope === 'mini' ? 'Mini' : 'Complete'} edition.`;
        }
        break;
      } else if (!filesystemCompatible) {
        // Filesystem issue
        if (scope === idealScope) {
          recommendationMessage = `Your drive's ${filesystem?.toUpperCase()} filesystem doesn't support files over 4GB. We recommend the ${scope === 'nopic' ? 'No Pictures' : 'Mini'} version instead, or reformat to exFAT.`;
        }
      }
    }
  }

  // If nothing fits, show warning
  if (!recommendedZim && idealZim) {
    recommendationMessage = `Your drive doesn't have enough space for any Wikipedia version. You need at least ${formatBytes(20 * 1024 * 1024 * 1024)} free for the Mini edition. Currently ${formatBytes(freeSpace)} available.`;
  }

  // Apply scope and topic filters
  const displayedZims = filteredZims.filter(zim => {
    if (selectedScope !== 'all' && zim.scope !== selectedScope) return false;
    if (selectedTopic !== 'all' && zim.topic !== selectedTopic) return false;
    return true;
  });

  // Get available topics for current language
  const availableTopics = [...new Set(filteredZims.map(zim => zim.topic))].filter(Boolean).sort();

  // Quick Pick handler
  const handleQuickPick = () => {
    if (recommendedZim && !selectedZims.some(z => z.filename === recommendedZim.filename)) {
      toggleZim(recommendedZim);
    }
  };

  // Installed->latest lookup for update selections.
  const latestByInstalledFilename = updates.reduce((acc, update) => {
    if (update?.installed?.filename && update?.latest) {
      acc[update.installed.filename] = update.latest;
    }
    return acc;
  }, {});

  const getSelectableInstalledZim = (installedZim) =>
    latestByInstalledFilename[installedZim.filename] || installedZim;

  const isInstalledZimSelected = (installedZim) => {
    if (selectedZims.some(z => z.filename === installedZim.filename)) {
      return true;
    }
    const latest = latestByInstalledFilename[installedZim.filename];
    return Boolean(latest && selectedZims.some(z => z.filename === latest.filename));
  };

  const upToDateCount = installedZims.filter(zim => zim.isUpToDate === true).length;
  const unknownStatusCount = installedZims.filter(zim => zim.isUpToDate === null).length;


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
        {/* Main Content - Single scrollable area */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* WIKIPEDIA CONTENT SECTION */}
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
                      {updates.length === 0 && upToDateCount > 0 && unknownStatusCount === 0 && (
                        <Chip
                          label="Up to date"
                          size="small"
                          color="success"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    {updates.length > 0 ? (
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {updates.length} ZIM file{updates.length > 1 ? 's have' : ' has'} newer versions available
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            // Select all latest catalog versions for installed files with updates.
                            updates.forEach((update) => {
                              const latest = update?.latest;
                              if (latest && !selectedZims.some(z => z.filename === latest.filename)) {
                                toggleZim(latest);
                              }
                            });
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Select All Updates
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="caption"
                          color={unknownStatusCount > 0 ? 'warning.main' : 'success.main'}
                        >
                          {unknownStatusCount > 0
                            ? `${upToDateCount} up to date, ${unknownStatusCount} not found in catalog`
                            : `No updates found. ${upToDateCount} ZIM file${upToDateCount !== 1 ? 's are' : ' is'} up to date`}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1 }}>
                      {installedZims.map((zim) => (
                        <ZimListItem
                          key={zim.filename}
                          zim={zim}
                          isSelected={isInstalledZimSelected(zim)}
                          onToggle={() => toggleZim(getSelectableInstalledZim(zim))}
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
                  <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={availableLanguages.includes(selectedLanguage) ? selectedLanguage : ''}
                        onChange={(e) => setLanguage(e.target.value)}
                        label="Language"
                        disabled={availableLanguages.length === 0 || isLoading}
                      >
                        {availableLanguages.map((lang) => (
                          <MenuItem key={lang} value={lang}>
                            {getLanguageName(lang)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {availableLanguages.length === 0 && <CircularProgress size={20} />}
                  </Box>

                  {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                      <CircularProgress size={32} />
                    </Box>
                  ) : (
                    <>
                      {/* RECOMMENDED SECTION - Prominent and Simple */}
                      {recommendedZim && selectedDrive && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            mb: 3,
                            bgcolor: 'rgba(25, 118, 210, 0.08)',
                            border: '2px solid',
                            borderColor: 'primary.main',
                            borderRadius: 2
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <RecommendedIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                            <Typography variant="h6" fontWeight={700} color="primary">
                              Recommended for Your USB
                            </Typography>
                          </Box>

                          {/* Space constraint or filesystem message */}
                          {hasSpaceConstraint || recommendationMessage ? (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              <Typography variant="body2">
                                {recommendationMessage}
                              </Typography>
                            </Alert>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              Based on your {formatBytes(totalCapacity)} drive with {formatBytes(freeSpace)} available:
                            </Typography>
                          )}

                          <Box sx={{
                            p: 2,
                            bgcolor: 'background.paper',
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            mb: 2
                          }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Box>
                                <Typography variant="h6" fontWeight={600}>
                                  {getLanguageName(recommendedZim.language)} Wikipedia
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {recommendedScope === 'maxi' && 'Complete with images'}
                                  {recommendedScope === 'nopic' && 'Full articles without images'}
                                  {recommendedScope === 'mini' && 'Essential articles only'}
                                </Typography>
                              </Box>
                              <Chip
                                label={formatBytes(recommendedZim.size)}
                                color="primary"
                                sx={{ fontWeight: 700 }}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {recommendedZim.articleCount && `${recommendedZim.articleCount.toLocaleString()} articles`}
                              {recommendedZim.date && ` · Updated ${formatDate(recommendedZim.date)}`}
                            </Typography>
                          </Box>

                          <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            fullWidth
                            onClick={handleQuickPick}
                            disabled={selectedZims.some(z => z.filename === recommendedZim.filename)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              py: 1.5,
                              fontSize: '1rem'
                            }}
                            startIcon={selectedZims.some(z => z.filename === recommendedZim.filename) ? <CheckIcon /> : <RecommendedIcon />}
                          >
                            {selectedZims.some(z => z.filename === recommendedZim.filename)
                              ? 'Selected'
                              : 'Select Recommended'}
                          </Button>
                        </Paper>
                      )}

                      {/* MORE OPTIONS - Collapsible */}
                      <Box>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                          endIcon={<ExpandMoreIcon sx={{ transform: showAdvancedOptions ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />}
                          sx={{
                            textTransform: 'none',
                            mb: showAdvancedOptions ? 2 : 0,
                            borderStyle: 'dashed'
                          }}
                        >
                          {showAdvancedOptions ? 'Hide' : 'Show'} More Options
                        </Button>

                        {showAdvancedOptions && (
                          <Box>
                            {/* Filters Section */}
                            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                              {/* Scope Filter */}
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    Content Type
                                  </Typography>
                                  <Tooltip
                                    title="Complete includes all articles with pictures (~100GB). No Pictures has full text without images (~45GB). Mini includes only essential articles (~10GB)."
                                    arrow
                                    placement="top"
                                  >
                                    <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                  </Tooltip>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip
                                    label="All Types"
                                    onClick={() => setSelectedScope('all')}
                                    color={selectedScope === 'all' ? 'primary' : 'default'}
                                    variant={selectedScope === 'all' ? 'filled' : 'outlined'}
                                    size="small"
                                    sx={{ fontWeight: selectedScope === 'all' ? 600 : 400 }}
                                  />
                                  <Chip
                                    label="Complete (with pictures)"
                                    onClick={() => setSelectedScope('maxi')}
                                    color={selectedScope === 'maxi' ? 'primary' : 'default'}
                                    variant={selectedScope === 'maxi' ? 'filled' : 'outlined'}
                                    size="small"
                                    sx={{ fontWeight: selectedScope === 'maxi' ? 600 : 400 }}
                                  />
                                  <Chip
                                    label="No Pictures"
                                    onClick={() => setSelectedScope('nopic')}
                                    color={selectedScope === 'nopic' ? 'primary' : 'default'}
                                    variant={selectedScope === 'nopic' ? 'filled' : 'outlined'}
                                    size="small"
                                    sx={{ fontWeight: selectedScope === 'nopic' ? 600 : 400 }}
                                  />
                                  <Chip
                                    label="Mini (essential only)"
                                    onClick={() => setSelectedScope('mini')}
                                    color={selectedScope === 'mini' ? 'primary' : 'default'}
                                    variant={selectedScope === 'mini' ? 'filled' : 'outlined'}
                                    size="small"
                                    sx={{ fontWeight: selectedScope === 'mini' ? 600 : 400 }}
                                  />
                                </Box>
                              </Box>

                              {/* Topic Filter */}
                              {availableTopics.length > 1 && (
                                <Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                      Topic
                                    </Typography>
                                    <Tooltip
                                      title="Filter by subject area. 'All Topics' includes the entire Wikipedia. Specific topics contain only articles in that subject."
                                      arrow
                                      placement="top"
                                    >
                                      <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }} />
                                    </Tooltip>
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Chip
                                      label="All Topics"
                                      onClick={() => setSelectedTopic('all')}
                                      color={selectedTopic === 'all' ? 'primary' : 'default'}
                                      variant={selectedTopic === 'all' ? 'filled' : 'outlined'}
                                      size="small"
                                      sx={{ fontWeight: selectedTopic === 'all' ? 600 : 400 }}
                                    />
                                    {availableTopics.map((topic) => (
                                      <Chip
                                        key={topic}
                                        label={topic === 'all' ? 'All Topics' : topic.charAt(0).toUpperCase() + topic.slice(1)}
                                        onClick={() => setSelectedTopic(topic)}
                                        color={selectedTopic === topic ? 'primary' : 'default'}
                                        variant={selectedTopic === topic ? 'filled' : 'outlined'}
                                        size="small"
                                        sx={{ fontWeight: selectedTopic === topic ? 600 : 400 }}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              )}
                            </Box>

                            {/* ZIM List */}
                            {displayedZims.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                {filteredZims.length === 0
                                  ? 'No Wikipedia dumps available for this language'
                                  : 'No content matches your filters. Try adjusting the filters above.'}
                              </Typography>
                            ) : (
                              <>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  Showing {displayedZims.length} of {filteredZims.length} available
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1 }}>
                                  {displayedZims.map((zim) => {
                                    const isRecommended = zim.filename === recommendedZim?.filename;
                                    return (
                                      <ZimListItem
                                        key={zim.filename}
                                        zim={zim}
                                        isSelected={selectedZims.some(z => z.filename === zim.filename)}
                                        onToggle={() => toggleZim(zim)}
                                        isRecommended={false}
                                      />
                                    );
                                  })}
                                </Box>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>

            {/* READER APPS SECTION - Below ZIM selection, less prominent */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.08)',
                borderStyle: 'dashed'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <AppsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Reader Apps
                </Typography>
                {selectedReaders.length > 0 && (
                  <Chip
                    label={`${selectedReaders.length} selected`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                All reader apps are automatically selected. Click any platform to deselect it if not needed.
              </Typography>
              <ReaderSelector
                selectedReaders={selectedReaders}
                onToggle={toggleReader}
              />
            </Paper>
          </Box>
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
