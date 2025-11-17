# Component Architecture
## WikiPrepared UI Redesign - Technical Implementation

**Version:** 2.0
**Date:** 2025-11-17

---

## Directory Structure

```
src/
├── renderer/
│   ├── App.jsx                      # Root component with Router
│   ├── index.jsx                    # Entry point
│   │
│   ├── stores/                      # Zustand state management
│   │   ├── appFlowStore.js          # Main application flow state
│   │   ├── drivesStore.js           # Drive detection and management
│   │   └── zimsStore.js             # ZIM catalog and selection
│   │
│   ├── screens/                     # Main screen components
│   │   ├── InitialChoiceScreen.jsx
│   │   ├── DriveSelectionScreen.jsx
│   │   ├── FilesystemWarningScreen.jsx
│   │   ├── MainConfigScreen.jsx
│   │   ├── DownloadStrategyScreen.jsx
│   │   ├── DownloadProgressScreen.jsx
│   │   ├── TransferProgressScreen.jsx
│   │   └── CompletionScreen.jsx
│   │
│   ├── components/                  # Reusable components
│   │   ├── common/
│   │   │   ├── DriveCard.jsx
│   │   │   ├── ZimListItem.jsx
│   │   │   ├── StorageBar.jsx
│   │   │   ├── ProgressBar.jsx
│   │   │   ├── ReaderSelector.jsx
│   │   │   ├── LanguageDropdown.jsx
│   │   │   └── StepHeader.jsx
│   │   │
│   │   └── layout/
│   │       ├── AppLayout.jsx
│   │       └── NavigationButtons.jsx
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useDriveWatcher.js
│   │   ├── useDownloadProgress.js
│   │   └── useStorageCalculation.js
│   │
│   ├── utils/                       # Utility functions
│   │   ├── formatters.js            # Format bytes, dates, etc.
│   │   ├── validators.js            # Validation logic
│   │   └── constants.js             # App constants
│   │
│   └── styles/                      # Global styles
│       ├── theme.js                 # MUI theme customization
│       └── animations.css           # CSS animations
│
└── main/                            # Electron main process
    ├── managers/                    # Existing backend managers
    │   ├── DriveManager.js          # Enhanced with format support
    │   ├── ZimManager.js
    │   ├── DownloadManager.js
    │   └── KiwixManager.js
    │
    └── services/
        └── FormatService.js         # NEW: USB formatting service
```

---

## State Management Architecture

### **1. App Flow Store** (`appFlowStore.js`)

Manages the overall application flow and user selections.

```javascript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useAppFlowStore = create(
  devtools(
    persist(
      (set, get) => ({
        // Current state
        currentStep: '/start',
        userIntent: null, // 'update' | 'create-new'
        selectedDrive: null,
        selectedZims: [],
        selectedReaders: ['windows', 'linux', 'macos', 'android'], // All by default
        downloadStrategy: null, // 'local-first' | 'direct-to-usb'

        // Computed values
        getTotalSize: () => {
          const state = get();
          const zimSize = state.selectedZims.reduce((acc, zim) => acc + zim.size, 0);
          const readerSize = calculateReaderSize(state.selectedReaders);
          return zimSize + readerSize;
        },

        getAvailableSpace: () => {
          const state = get();
          return state.selectedDrive ? state.selectedDrive.size : 0;
        },

        // Actions
        setUserIntent: (intent) => set({ userIntent: intent }),

        selectDrive: (drive) => set({ selectedDrive: drive }),

        toggleZim: (zim) => set((state) => {
          const exists = state.selectedZims.find(z => z.filename === zim.filename);
          if (exists) {
            return { selectedZims: state.selectedZims.filter(z => z.filename !== zim.filename) };
          } else {
            return { selectedZims: [...state.selectedZims, zim] };
          }
        }),

        toggleReader: (platform) => set((state) => {
          const exists = state.selectedReaders.includes(platform);
          if (exists) {
            return { selectedReaders: state.selectedReaders.filter(p => p !== platform) };
          } else {
            return { selectedReaders: [...state.selectedReaders, platform] };
          }
        }),

        setDownloadStrategy: (strategy) => set({ downloadStrategy: strategy }),

        setCurrentStep: (step) => set({ currentStep: step }),

        reset: () => set({
          currentStep: '/start',
          userIntent: null,
          selectedDrive: null,
          selectedZims: [],
          selectedReaders: ['windows', 'linux', 'macos', 'android'],
          downloadStrategy: null
        })
      }),
      {
        name: 'app-flow-storage',
        partialize: (state) => ({
          // Only persist user preferences
          selectedReaders: state.selectedReaders
        })
      }
    )
  )
);

// Helper function
function calculateReaderSize(platforms) {
  const sizes = {
    windows: 80 * 1024 * 1024,    // 80MB
    linux: 90 * 1024 * 1024,       // 90MB
    macos: 100 * 1024 * 1024,      // 100MB
    android: 45 * 1024 * 1024      // 45MB
  };
  return platforms.reduce((acc, platform) => acc + (sizes[platform] || 0), 0);
}
```

---

### **2. Drives Store** (`drivesStore.js`)

Manages USB drive detection and monitoring.

```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useDrivesStore = create(
  devtools((set, get) => ({
    drives: [],
    isScanning: false,
    lastScan: null,
    isWatching: false,

    // Actions
    scanDrives: async () => {
      set({ isScanning: true });
      try {
        const drives = await window.electronAPI.invoke('drives:list');
        set({
          drives,
          lastScan: Date.now(),
          isScanning: false
        });
        return drives;
      } catch (error) {
        console.error('Failed to scan drives:', error);
        set({ isScanning: false });
        throw error;
      }
    },

    startWatching: () => {
      if (get().isWatching) return;

      window.electronAPI.invoke('drives:watch-start');

      // Listen for drive changes
      window.electronAPI.on('drives:changed', (drives) => {
        set({ drives, lastScan: Date.now() });
      });

      set({ isWatching: true });
    },

    stopWatching: () => {
      window.electronAPI.invoke('drives:watch-stop');
      window.electronAPI.off('drives:changed');
      set({ isWatching: false });
    },

    // Get drive by device path
    getDrive: (devicePath) => {
      return get().drives.find(d => d.device === devicePath);
    }
  }))
);
```

---

### **3. ZIMs Store** (`zimsStore.js`)

Manages ZIM catalog, filtering, and update detection.

```javascript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useZimsStore = create(
  devtools((set, get) => ({
    catalog: [],
    isLoading: false,
    selectedLanguage: 'en',
    installedZims: [],
    updates: [],

    // Actions
    fetchCatalog: async (forceRefresh = false) => {
      set({ isLoading: true });
      try {
        const catalog = await window.electronAPI.invoke('zim:fetch-catalog', forceRefresh);
        set({ catalog, isLoading: false });
        return catalog;
      } catch (error) {
        console.error('Failed to fetch catalog:', error);
        set({ isLoading: false });
        throw error;
      }
    },

    setLanguage: (language) => set({ selectedLanguage: language }),

    getFilteredZims: () => {
      const { catalog, selectedLanguage } = get();
      return catalog
        .filter(zim => zim.language === selectedLanguage)
        .sort((a, b) => b.size - a.size); // Sort by size descending
    },

    scanInstalledZims: async (drivePath) => {
      try {
        const installed = await window.electronAPI.invoke('drives:scan', drivePath);
        set({ installedZims: installed });
        return installed;
      } catch (error) {
        console.error('Failed to scan installed ZIMs:', error);
        throw error;
      }
    },

    checkForUpdates: async () => {
      const { installedZims, catalog } = get();
      if (installedZims.length === 0) return [];

      const updates = [];
      for (const installed of installedZims) {
        const latest = catalog.find(zim =>
          zim.language === installed.language &&
          zim.topic === installed.topic &&
          zim.scope === installed.scope &&
          zim.date > installed.date
        );

        if (latest) {
          updates.push({
            installed,
            latest,
            sizeDiff: latest.size - installed.size
          });
        }
      }

      set({ updates });
      return updates;
    }
  }))
);
```

---

## Component Specifications

### **Screen Components**

#### **1. InitialChoiceScreen** (`/start`)

```javascript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { Update as UpdateIcon, Add as AddIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import AppLayout from '../components/layout/AppLayout';

export default function InitialChoiceScreen() {
  const navigate = useNavigate();
  const setUserIntent = useAppFlowStore(state => state.setUserIntent);

  const handleChoice = (intent) => {
    setUserIntent(intent);
    navigate('/drive-selection');
  };

  return (
    <AppLayout title="Welcome to WikiPrepared">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600, mx: 'auto' }}>
        <Card
          sx={{
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
          }}
          onClick={() => handleChoice('update')}
        >
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <UpdateIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Update Existing Stick
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update ZIM files and readers on an existing Wikipedia USB stick
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
          }}
          onClick={() => handleChoice('create-new')}
        >
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <AddIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Create New Stick
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Set up a fresh Wikipedia USB stick from scratch
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  );
}
```

---

#### **2. DriveSelectionScreen** (`/drive-selection`)

```javascript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Typography, Button, CircularProgress } from '@mui/material';
import { useDrivesStore } from '../stores/drivesStore';
import { useAppFlowStore } from '../stores/appFlowStore';
import DriveCard from '../components/common/DriveCard';
import AppLayout from '../components/layout/AppLayout';
import NavigationButtons from '../components/layout/NavigationButtons';

export default function DriveSelectionScreen() {
  const navigate = useNavigate();
  const { drives, isScanning, scanDrives, startWatching } = useDrivesStore();
  const { selectedDrive, selectDrive } = useAppFlowStore();

  useEffect(() => {
    scanDrives();
    startWatching();
  }, []);

  const handleContinue = () => {
    if (!selectedDrive) return;

    // Check if filesystem warning needed
    const needsWarning = !['exFAT', 'NTFS', 'ext4', 'APFS'].includes(selectedDrive.filesystem);
    if (needsWarning) {
      navigate('/filesystem-warning');
    } else {
      navigate('/configure');
    }
  };

  const handleLocalDownload = () => {
    selectDrive(null); // No drive selected
    navigate('/configure');
  };

  if (isScanning) {
    return (
      <AppLayout title="Scanning for Drives">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 3 }}>
            Scanning for USB drives...
          </Typography>
        </Box>
      </AppLayout>
    );
  }

  if (drives.length === 0) {
    return (
      <AppLayout title="Please Insert USB Drive">
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h2" sx={{ mb: 2 }}>🔌</Typography>
          <Typography variant="h6" gutterBottom>
            No USB drives detected
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Please insert a USB drive with at least 64GB of free space
          </Typography>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Scanning for drives...
          </Typography>

          <Button
            variant="text"
            size="small"
            onClick={handleLocalDownload}
            sx={{ mt: 6 }}
          >
            I do not want to download to a USB
          </Button>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Select USB Drive">
      <Grid container spacing={3}>
        {drives.map(drive => (
          <Grid item xs={12} sm={6} md={4} key={drive.device}>
            <DriveCard
              drive={drive}
              isSelected={selectedDrive?.device === drive.device}
              onSelect={() => selectDrive(drive)}
            />
          </Grid>
        ))}
      </Grid>

      <NavigationButtons
        onBack={() => navigate('/start')}
        onNext={handleContinue}
        nextDisabled={!selectedDrive}
      />
    </AppLayout>
  );
}
```

---

### **Reusable Components**

#### **DriveCard** (`components/common/DriveCard.jsx`)

```javascript
import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { Warning as WarningIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { formatBytes } from '../../utils/formatters';

export default function DriveCard({ drive, isSelected, onSelect }) {
  const sizeGB = drive.size / (1024 ** 3);
  const isLargeEnough = sizeGB >= 64;
  const hasCompatibleFS = ['exFAT', 'NTFS', 'ext4', 'APFS'].includes(drive.filesystem);

  const getBorderColor = () => {
    if (isSelected) return 'primary.main';
    if (isLargeEnough && hasCompatibleFS) return 'success.main';
    return 'warning.main';
  };

  return (
    <Card
      onClick={onSelect}
      sx={{
        cursor: 'pointer',
        border: 3,
        borderColor: getBorderColor(),
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            💾 {drive.label || 'USB Drive'}
          </Typography>
          {isLargeEnough && hasCompatibleFS ? (
            <CheckIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          {drive.device}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <Chip
            label={formatBytes(drive.size)}
            color={isLargeEnough ? 'success' : 'warning'}
            size="small"
            sx={{ mr: 1 }}
          />
          <Chip
            label={drive.filesystem}
            color={hasCompatibleFS ? 'default' : 'warning'}
            size="small"
          />
        </Box>

        {!hasCompatibleFS && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
            ⚠️ Filesystem may not support large files
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
```

---

#### **StorageBar** (`components/common/StorageBar.jsx`)

```javascript
import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { formatBytes } from '../../utils/formatters';
import './StorageBar.css';

export default function StorageBar({ used, selected, total, showFlashing = false }) {
  const usedPercent = (used / total) * 100;
  const selectedPercent = (selected / total) * 100;
  const totalPercent = ((used + selected) / total) * 100;

  const isOverCapacity = totalPercent > 100;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ position: 'relative', height: 40 }}>
        {/* Base bar (free space) */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            bgcolor: 'grey.200',
            borderRadius: 1
          }}
        />

        {/* Used space */}
        <Box
          sx={{
            position: 'absolute',
            width: `${Math.min(usedPercent, 100)}%`,
            height: '100%',
            bgcolor: 'primary.main',
            borderRadius: 1,
            transition: 'width 0.3s ease'
          }}
        />

        {/* Selected space (flashing) */}
        <Box
          className={showFlashing ? 'storage-flash' : ''}
          sx={{
            position: 'absolute',
            left: `${usedPercent}%`,
            width: `${Math.min(selectedPercent, 100 - usedPercent)}%`,
            height: '100%',
            bgcolor: isOverCapacity ? 'error.main' : 'success.main',
            borderRadius: 1,
            transition: 'width 0.3s ease, left 0.3s ease'
          }}
        />

        {/* Text overlay */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="body2" fontWeight="bold" color={isOverCapacity ? 'error.main' : 'text.primary'}>
            {formatBytes(used + selected)} / {formatBytes(total)}
            {isOverCapacity && ' - EXCEEDS CAPACITY'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Used: {formatBytes(used)}
        </Typography>
        {selected > 0 && (
          <Typography variant="caption" color="success.main">
            Selected: +{formatBytes(selected)}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          Free: {formatBytes(total - used - selected)}
        </Typography>
      </Box>
    </Box>
  );
}
```

**StorageBar.css:**
```css
@keyframes storage-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.storage-flash {
  animation: storage-flash 1s ease-in-out infinite;
}
```

---

#### **ZimListItem** (`components/common/ZimListItem.jsx`)

```javascript
import React from 'react';
import { ListItem, ListItemButton, Checkbox, ListItemText, Chip } from '@mui/material';
import { formatBytes } from '../../utils/formatters';

export default function ZimListItem({ zim, isSelected, onToggle }) {
  const getScope Display = (scope) => {
    const displays = {
      maxi: 'Complete',
      nopic: 'No Pictures',
      mini: 'Mini'
    };
    return displays[scope] || scope;
  };

  return (
    <ListItem disablePadding>
      <ListItemButton onClick={onToggle} dense>
        <Checkbox
          edge="start"
          checked={isSelected}
          tabIndex={-1}
          disableRipple
        />
        <ListItemText
          primary={`${zim.topic} - ${getScopeDisplay(zim.scope)}`}
          secondary={`${formatBytes(zim.size)} • ${zim.date}`}
        />
        {zim.hasUpdate && (
          <Chip label="Update Available" color="primary" size="small" />
        )}
      </ListItemButton>
    </ListItem>
  );
}
```

---

## Custom Hooks

### **useDriveWatcher**

```javascript
import { useEffect } from 'react';
import { useDrivesStore } from '../stores/drivesStore';

export function useDriveWatcher() {
  const { startWatching, stopWatching, scanDrives } = useDrivesStore();

  useEffect(() => {
    scanDrives();
    startWatching();

    return () => {
      stopWatching();
    };
  }, []);
}
```

---

### **useStorageCalculation**

```javascript
import { useMemo } from 'react';
import { useAppFlowStore } from '../stores/appFlowStore';

export function useStorageCalculation() {
  const { selectedZims, selectedReaders, selectedDrive } = useAppFlowStore();

  return useMemo(() => {
    const zimSize = selectedZims.reduce((acc, zim) => acc + zim.size, 0);
    const readerSizes = {
      windows: 80 * 1024 * 1024,
      linux: 90 * 1024 * 1024,
      macos: 100 * 1024 * 1024,
      android: 45 * 1024 * 1024
    };
    const readerSize = selectedReaders.reduce((acc, platform) => acc + (readerSizes[platform] || 0), 0);

    const total = zimSize + readerSize;
    const available = selectedDrive ? selectedDrive.size : Infinity;
    const hasSpace = total <= available;

    return {
      zimSize,
      readerSize,
      totalSize: total,
      availableSpace: available,
      hasSpace,
      percentUsed: (total / available) * 100
    };
  }, [selectedZims, selectedReaders, selectedDrive]);
}
```

---

## Utility Functions

### **formatters.js**

```javascript
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond) {
  return formatBytes(bytesPerSecond) + '/s';
}

export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long'
  });
}
```

---

## Routing Configuration

### **App.jsx**

```javascript
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './styles/theme';

// Screens
import InitialChoiceScreen from './screens/InitialChoiceScreen';
import DriveSelectionScreen from './screens/DriveSelectionScreen';
import FilesystemWarningScreen from './screens/FilesystemWarningScreen';
import MainConfigScreen from './screens/MainConfigScreen';
import DownloadStrategyScreen from './screens/DownloadStrategyScreen';
import DownloadProgressScreen from './screens/DownloadProgressScreen';
import TransferProgressScreen from './screens/TransferProgressScreen';
import CompletionScreen from './screens/CompletionScreen';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/start" replace />} />
          <Route path="/start" element={<InitialChoiceScreen />} />
          <Route path="/drive-selection" element={<DriveSelectionScreen />} />
          <Route path="/filesystem-warning" element={<FilesystemWarningScreen />} />
          <Route path="/configure" element={<MainConfigScreen />} />
          <Route path="/download-strategy" element={<DownloadStrategyScreen />} />
          <Route path="/downloading" element={<DownloadProgressScreen />} />
          <Route path="/transferring" element={<TransferProgressScreen />} />
          <Route path="/complete" element={<CompletionScreen />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
```

---

## Theme Configuration

### **theme.js**

```javascript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#4791db',
      dark: '#115293'
    },
    secondary: {
      main: '#dc004e'
    },
    success: {
      main: '#4caf50'
    },
    warning: {
      main: '#ff9800'
    },
    error: {
      main: '#f44336'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 500
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          padding: '10px 24px'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    }
  }
});

export default theme;
```

---

## Implementation Phases

### **Phase 1: Foundation** ✓
- [x] Set up Zustand stores
- [x] Configure React Router
- [x] Create theme and base layout
- [ ] Drive scanning on app startup

### **Phase 2: Core Screens**
- [ ] InitialChoiceScreen
- [ ] DriveSelectionScreen (with watching)
- [ ] MainConfigScreen (basic version)

### **Phase 3: Enhanced Features**
- [ ] FilesystemWarningScreen with formatting
- [ ] DownloadStrategyScreen
- [ ] Storage bar with flashing animation
- [ ] ZIM update detection

### **Phase 4: Progress & Completion**
- [ ] DownloadProgressScreen
- [ ] TransferProgressScreen
- [ ] CompletionScreen
- [ ] Drive ejection

### **Phase 5: Polish**
- [ ] Error handling and recovery
- [ ] Loading states
- [ ] Animations and transitions
- [ ] Testing and bug fixes

---

**End of Architecture Document**
