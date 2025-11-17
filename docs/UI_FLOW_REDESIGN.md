# WikiPrepared UI Flow Redesign
## Comprehensive User Experience Design Document

**Version:** 2.0
**Date:** 2025-11-17
**Purpose:** Create an intuitive, non-technical user flow for creating and updating Wikipedia USB sticks

---

## Design Philosophy

**Target Audience:** Non-technical users who want to create offline Wikipedia USB sticks
**Key Principles:**
- Progressive disclosure: Show only what's needed at each step
- Clear visual feedback: Color-coded indicators and warnings
- Safety-first: Multiple confirmations for destructive operations
- Flexibility: Support both USB and local downloads

---

## Complete User Flow

```
App Start → Drive Scanning (automatic)
    ↓
Step 1: INITIAL CHOICE
    ├─→ "I want to update an existing Wikipedia stick"
    └─→ "I want to make a new Wikipedia stick"
    ↓
Step 2: DRIVE SELECTION
    ├─→ No USB detected → "Please insert USB" page
    │   └─→ Small text option: "I do not want to download to a USB"
    └─→ USB detected → Drive selection grid
        ├─→ Display drives with:
        │   ├─→ Storage size in GB
        │   ├─→ Green indicator: ≥64GB
        │   ├─→ Yellow indicator: <64GB
        │   └─→ Yellow warning: Unsupported filesystem (not exFAT/NTFS)
        └─→ Select drive → Continue
    ↓
Step 2.5: FILESYSTEM WARNING (if applicable)
    └─→ "This drive uses [FAT32/other] which doesn't support large files"
        ├─→ "Format to exFAT" (with safety confirmation)
        └─→ "Continue anyway" or "Go back"
    ↓
Step 3: MAIN CONFIGURATION (iTunes-style)
    ├─→ LEFT PANEL: ZIM File Selection
    │   ├─→ Existing ZIMs (if updating)
    │   │   └─→ "Check for updates" button
    │   ├─→ Language dropdown
    │   └─→ Wikipedia dump list (sorted by size)
    │       └─→ Shows: Name, Size, Description
    ├─→ RIGHT PANEL: Supported Devices/Readers
    │   ├─→ All selected by default
    │   ├─→ Options: Windows, Linux, macOS, Android
    │   ├─→ iOS note: "Download from App Store"
    │   └─→ Link to PWA version
    └─→ BOTTOM: Storage Bar
        ├─→ Shows current usage
        ├─→ "Flashing" animation when ZIM selected
        └─→ "Continue" button (right side)
    ↓
Step 3.5: DOWNLOAD STRATEGY
    ├─→ Option 1: "Download directly to USB"
    │   └─→ Warning: May need to delete old version first
    └─→ Option 2: "Download to computer first, then transfer" (RECOMMENDED)
        └─→ Safer, can delete old version during transfer
    ↓
Step 4: DOWNLOAD PROGRESS
    ├─→ Progress bar with percentage
    ├─→ Download speed (MB/s)
    ├─→ Estimated time remaining
    └─→ Warning: "Do not shut off computer or unplug USB"
    ↓
Step 5: USB TRANSFER (if downloaded locally)
    ├─→ "Transferring to USB..."
    ├─→ Check available space
    ├─→ Offer to delete old version if updating
    └─→ Progress bar
    ↓
COMPLETION
    └─→ "Your Wikipedia stick is ready!"
        ├─→ Summary of what was installed
        └─→ "Safely eject USB" button
```

---

## Detailed Screen Specifications

### **Step 1: Initial Choice Screen**

**Route:** `/start`

**Layout:**
```
┌─────────────────────────────────────────┐
│         WikiPrepared                    │
│  Create Your Offline Wikipedia USB      │
├─────────────────────────────────────────┤
│                                         │
│   ┌───────────────────────────────┐   │
│   │   📱 Update Existing Stick    │   │
│   │                               │   │
│   │   Update ZIM files and        │   │
│   │   readers on an existing      │   │
│   │   Wikipedia USB stick         │   │
│   └───────────────────────────────┘   │
│                                         │
│   ┌───────────────────────────────┐   │
│   │   ✨ Create New Stick         │   │
│   │                               │   │
│   │   Set up a fresh Wikipedia    │   │
│   │   USB stick from scratch      │   │
│   └───────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**
- Large, clickable cards with icons
- Clear descriptions of each option
- Hover effects for interactivity

**State:**
- `userIntent`: 'update' | 'create-new'

---

### **Step 2: Drive Selection Screen**

**Route:** `/drive-selection`

#### **2A: No USB Detected**

```
┌─────────────────────────────────────────┐
│  Please Insert a USB Drive              │
├─────────────────────────────────────────┤
│                                         │
│         🔌                              │
│                                         │
│   No USB drives detected                │
│                                         │
│   Please insert a USB drive with at    │
│   least 64GB of free space              │
│                                         │
│   Scanning for drives...                │
│                                         │
│                                         │
│   I do not want to download to a USB   │
│   (download locally instead)            │
│                                         │
└─────────────────────────────────────────┘
```

**Features:**
- Auto-refresh when USB is inserted (via drive watching)
- Small text link for local download option
- Loading animation while scanning

#### **2B: USB Drive Selection**

```
┌─────────────────────────────────────────┐
│  Select USB Drive                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ 💾 USB Drive │  │ 💾 USB Drive │   │
│  │              │  │              │   │
│  │ SanDisk      │  │ Kingston     │   │
│  │ 128 GB ✓     │  │ 32 GB        │   │
│  │ exFAT        │  │ FAT32 ⚠️     │   │
│  │              │  │              │   │
│  │ [SELECT]     │  │ [SELECT]     │   │
│  └──────────────┘  └──────────────┘   │
│   Green border      Yellow border      │
│                                         │
│  [< Back]              [Continue >]    │
└─────────────────────────────────────────┘
```

**Color Indicators:**
- **Green border**: ≥64GB, supported filesystem
- **Yellow border**: <64GB or unsupported filesystem
- **⚠️ Warning icon**: Filesystem doesn't support large files

**Drive Card Information:**
- Drive label/manufacturer
- Storage capacity in GB
- Filesystem type
- Mount point (for technical users)

**Selection Behavior:**
- Click entire card to select
- Only one drive can be selected
- Selected drive gets highlighted border
- Continue button enabled when drive selected

---

### **Step 2.5: Filesystem Warning Screen**

**Route:** `/filesystem-warning`
**Trigger:** Only shown if selected drive has FAT32 or other incompatible filesystem

```
┌─────────────────────────────────────────┐
│  ⚠️ Filesystem Compatibility Warning    │
├─────────────────────────────────────────┤
│                                         │
│  The selected drive uses FAT32, which   │
│  cannot store files larger than 4GB.    │
│                                         │
│  Most Wikipedia ZIM files are larger    │
│  than this limit.                       │
│                                         │
│  Recommendation:                        │
│  Format this drive to exFAT             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ ⚠️ WARNING: Formatting will erase │ │
│  │    all data on this drive!        │ │
│  │                                   │ │
│  │ Drive: SanDisk (E:) - 32GB        │ │
│  │                                   │ │
│  │ Type "FORMAT" to confirm:         │ │
│  │ [______________]                  │ │
│  │                                   │ │
│  │ [Cancel]  [Format to exFAT]       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Or:                                    │
│  [Continue with FAT32 anyway]           │
│  [< Go back and choose another drive]  │
│                                         │
└─────────────────────────────────────────┘
```

**Safety Measures:**
- Require typing "FORMAT" to confirm
- Show drive details clearly
- Red warning box
- Multiple escape routes (cancel, go back, continue anyway)

**Actions:**
- Format to exFAT → Proceed to main config
- Continue anyway → Proceed but with size restrictions
- Go back → Return to drive selection

---

### **Step 3: Main Configuration Screen (iTunes-style)**

**Route:** `/configure`

```
┌──────────────────────────────────────────────────────────────┐
│  Configure Your Wikipedia Stick                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────┐  ┌────────────────────────┐   │
│  │ 📚 Wikipedia Content    │  │ 📱 Reader Apps         │   │
│  ├─────────────────────────┤  ├────────────────────────┤   │
│  │                         │  │                        │   │
│  │ Existing ZIMs:          │  │ Select platforms:      │   │
│  │ ┌─────────────────────┐ │  │                        │   │
│  │ │ EN Wikipedia        │ │  │ ☑ Windows              │   │
│  │ │ 90GB • Oct 2025     │ │  │ ☑ Linux (AppImage)     │   │
│  │ │ [Check Updates]     │ │  │ ☑ macOS                │   │
│  │ └─────────────────────┘ │  │ ☑ Android (APK)        │   │
│  │                         │  │                        │   │
│  │ Add New:                │  │ ℹ️ iOS: Download from   │   │
│  │ Language: [English ▼]   │  │   App Store            │   │
│  │                         │  │                        │   │
│  │ ┌─────────────────────┐ │  │ 🌐 Web App (PWA):      │   │
│  │ │ ☐ Wikipedia (all)   │ │  │ [Open Link]            │   │
│  │ │   Maxi • 95GB       │ │  │                        │   │
│  │ ├─────────────────────┤ │  │                        │   │
│  │ │ ☐ Wikipedia (all)   │ │  │                        │   │
│  │ │   No Pics • 55GB    │ │  │                        │   │
│  │ ├─────────────────────┤ │  │                        │   │
│  │ │ ☐ Wikipedia (all)   │ │  │                        │   │
│  │ │   Mini • 8GB        │ │  │                        │   │
│  │ └─────────────────────┘ │  │                        │   │
│  │                         │  │                        │   │
│  │ [Show more languages]   │  │                        │   │
│  └─────────────────────────┘  └────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Storage: ███████░░░░░░░░░░░░░░ 65GB / 128GB          [>]  │
└──────────────────────────────────────────────────────────────┘
```

**Left Panel: ZIM File Selection**

**Existing ZIMs Section** (only for 'update' flow):
- Shows currently installed ZIM files
- Display: Language, size, date
- "Check for Updates" button per ZIM
- Visual indicator if update available

**Add New Section:**
1. **Language Dropdown**
   - Grouped by common languages first
   - Then alphabetical
   - Shows language code and name

2. **ZIM List** (for selected language)
   - Sorted by size (largest to smallest)
   - Checkbox selection
   - Shows: Topic, scope (Maxi/No Pics/Mini), size
   - Visual grouping by topic

**Right Panel: Reader Apps**

- Checkboxes for each platform
- All selected by default
- Can expand for more options
- iOS special note (App Store only)
- PWA link at bottom

**Bottom: Storage Bar**

```
Storage: ███████░░░░░░░░░░░░░░ 65GB / 128GB    [Continue >]
         ^^^^^^^ Current
                ^^^ Selected (flashing animation)
                   ^^^^^^^^^^^^ Free space
```

**Features:**
- Real-time calculation as items selected/deselected
- Flashing/pulsing animation when new item selected
- Shows breakdown on hover
- Red warning if exceeds capacity
- Continue button on right side

**State Management:**
- `selectedZims`: Array of ZIM objects
- `selectedReaders`: Array of platform strings
- `totalSize`: Calculated total
- `availableSpace`: Drive capacity

---

### **Step 3.5: Download Strategy Selection**

**Route:** `/download-strategy`

```
┌─────────────────────────────────────────┐
│  Download Method                        │
├─────────────────────────────────────────┤
│                                         │
│  Choose how to download:                │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 💾 Download to Computer First     │ │
│  │    (Recommended)                  │ │
│  │                                   │ │
│  │ ✓ Safer - USB can be removed     │ │
│  │ ✓ Can manage old versions         │ │
│  │ ✓ Faster transfers                │ │
│  │                                   │ │
│  │ Downloads: 95GB                   │ │
│  │ Then transfers to USB             │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 🔌 Download Directly to USB      │ │
│  │                                   │ │
│  │ ⚠️ Keep USB plugged in            │ │
│  │ ⚠️ May need to delete old files   │ │
│  │                                   │ │
│  │ Downloads: 95GB to USB            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [< Back]                 [Continue >] │
└─────────────────────────────────────────┘
```

**Logic:**
- If updating and not enough space: Show warning that old version must be deleted
- If creating new: Both options available equally
- Recommend local first for all cases

**State:**
- `downloadStrategy`: 'local-first' | 'direct-to-usb'

---

### **Step 4: Download Progress Screen**

**Route:** `/downloading`

```
┌─────────────────────────────────────────┐
│  Downloading...                         │
├─────────────────────────────────────────┤
│                                         │
│  Wikipedia English (all) - No Pics      │
│  ████████████░░░░░░░░░ 64%              │
│  35GB / 55GB                            │
│                                         │
│  Speed: 12.5 MB/s                       │
│  Time remaining: 28 minutes             │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ ⚠️ Important:                     │ │
│  │ • Do not shut down your computer  │ │
│  │ • Do not unplug the USB drive     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Current: Wikipedia EN (all) nopic     │
│  Queued:                                │
│   • Kiwix Reader (Windows)              │
│   • Kiwix Reader (Linux)                │
│   • Kiwix Reader (Android)              │
│                                         │
│  [Pause]  [Cancel]                      │
└─────────────────────────────────────────┘
```

**Features:**
- Progress bar with percentage
- Downloaded / Total size
- Real-time speed calculation
- ETA calculation
- List of queued items
- Pause/Resume capability
- Cancel with confirmation

**Updates:**
- IPC events from DownloadManager
- Update progress every 500ms (throttled)
- Smooth animations

**State:**
- `downloads`: Array of download objects
- `currentDownload`: Active download
- `overallProgress`: Combined progress

---

### **Step 5: USB Transfer Screen**

**Route:** `/transferring`
**Trigger:** Only if 'local-first' strategy selected

```
┌─────────────────────────────────────────┐
│  Transferring to USB...                 │
├─────────────────────────────────────────┤
│                                         │
│  Preparing transfer...                  │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Old version detected:             │ │
│  │                                   │ │
│  │ Wikipedia EN (all) nopic          │ │
│  │ Date: September 2025              │ │
│  │ Size: 53GB                        │ │
│  │                                   │ │
│  │ New version: October 2025 (55GB)  │ │
│  │                                   │ │
│  │ ☑ Delete old version to make room │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Copying files to USB...                │
│  ████████████████░░ 85%                 │
│  47GB / 55GB                            │
│                                         │
│  ⚠️ Do not remove USB drive             │
│                                         │
└─────────────────────────────────────────┘
```

**Process:**
1. Check available space on USB
2. Detect old versions of same ZIM
3. Offer to delete old version (checkbox, checked by default)
4. Show space calculation
5. Perform transfer with progress
6. Verify transferred files

**State:**
- `transferProgress`: 0-100
- `oldVersionsFound`: Array of old ZIM files
- `deleteOldVersions`: boolean

---

### **Completion Screen**

**Route:** `/complete`

```
┌─────────────────────────────────────────┐
│  ✅ Your Wikipedia Stick is Ready!      │
├─────────────────────────────────────────┤
│                                         │
│  Successfully installed:                │
│                                         │
│  📚 Wikipedia Content:                  │
│   • English (all) - No Pics (55GB)      │
│                                         │
│  📱 Reader Apps:                        │
│   • Kiwix Windows (portable)            │
│   • Kiwix Linux (AppImage)              │
│   • Kiwix Android (APK)                 │
│                                         │
│  Total used: 65GB / 128GB               │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Next steps:                       │ │
│  │ 1. Safely eject your USB          │ │
│  │ 2. Plug into any computer         │ │
│  │ 3. Run the Kiwix reader           │ │
│  │ 4. Enjoy offline Wikipedia!       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Safely Eject USB]  [Start Over]      │
└─────────────────────────────────────────┘
```

**Features:**
- Summary of what was installed
- Storage usage
- Clear next steps
- Eject USB button (uses OS eject API)
- Option to start over

---

## Component Architecture

### **Routing Structure**

```javascript
/start                  → InitialChoiceScreen
/drive-selection        → DriveSelectionScreen
/filesystem-warning     → FilesystemWarningScreen
/configure              → MainConfigScreen
/download-strategy      → DownloadStrategyScreen
/downloading            → DownloadProgressScreen
/transferring           → TransferProgressScreen
/complete               → CompletionScreen
```

### **State Management (Zustand)**

```javascript
// stores/appFlowStore.js
{
  // User choices
  userIntent: 'update' | 'create-new' | null,
  selectedDrive: DriveObject | null,
  selectedZims: ZimObject[],
  selectedReaders: string[],
  downloadStrategy: 'local-first' | 'direct-to-usb',

  // Computed
  totalSize: number,
  availableSpace: number,

  // Progress
  currentStep: string,
  downloads: DownloadObject[],
  transferProgress: number,

  // Actions
  setUserIntent: (intent) => void,
  selectDrive: (drive) => void,
  toggleZim: (zim) => void,
  toggleReader: (platform) => void,
  setDownloadStrategy: (strategy) => void,
  nextStep: () => void,
  previousStep: () => void,
  reset: () => void
}

// stores/drivesStore.js
{
  drives: DriveObject[],
  isScanning: boolean,
  lastScan: timestamp,

  // Actions
  scanDrives: () => Promise<void>,
  watchDrives: () => void,
  stopWatching: () => void
}

// stores/zimsStore.js
{
  catalog: ZimObject[],
  selectedLanguage: string,
  installedZims: ZimObject[],

  // Actions
  fetchCatalog: () => Promise<void>,
  setLanguage: (lang) => void,
  checkForUpdates: () => Promise<void>
}
```

### **Reusable Components**

```
components/
├── common/
│   ├── DriveCard.jsx           # Display drive with indicators
│   ├── ZimListItem.jsx         # ZIM file with checkbox
│   ├── StorageBar.jsx          # Animated storage bar
│   ├── ProgressBar.jsx         # Download/transfer progress
│   ├── ReaderSelector.jsx      # Platform checkboxes
│   └── StepHeader.jsx          # Consistent header
│
├── screens/
│   ├── InitialChoiceScreen.jsx
│   ├── DriveSelectionScreen.jsx
│   ├── FilesystemWarningScreen.jsx
│   ├── MainConfigScreen.jsx
│   ├── DownloadStrategyScreen.jsx
│   ├── DownloadProgressScreen.jsx
│   ├── TransferProgressScreen.jsx
│   └── CompletionScreen.jsx
│
└── layout/
    ├── AppLayout.jsx           # Consistent layout wrapper
    └── Navigation.jsx          # Back/Next navigation
```

---

## Technical Implementation Notes

### **Drive Scanning on Startup**

```javascript
// In main process (main.js)
app.whenReady().then(async () => {
  // Start drive watching immediately
  driveManager.watchDrives();

  // Create window
  createWindow();

  // Initial scan
  const drives = await driveManager.listDrives();
  mainWindow.webContents.send('drives:initial', drives);
});
```

### **Filesystem Detection**

```javascript
// Enhanced DriveManager.js
const SUPPORTED_FILESYSTEMS = ['exFAT', 'NTFS', 'ext4', 'APFS'];
const LARGE_FILE_FILESYSTEMS = ['exFAT', 'NTFS', 'ext4', 'APFS', 'HFS+'];

function checkFilesystemCompatibility(drive) {
  const fs = drive.filesystem;
  return {
    isSupported: LARGE_FILE_FILESYSTEMS.includes(fs),
    canStoreLargeFiles: fs !== 'FAT32',
    filesystem: fs,
    maxFileSize: fs === 'FAT32' ? '4GB' : 'Unlimited'
  };
}
```

### **Storage Calculation**

```javascript
// Utility function
function calculateTotalSize(selectedZims, selectedReaders) {
  const zimSize = selectedZims.reduce((acc, zim) => acc + zim.size, 0);
  const readerSize = calculateReaderSize(selectedReaders);
  return zimSize + readerSize;
}

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

### **Update Detection Logic**

```javascript
// In MainConfigScreen
async function checkForUpdates(installedZims, catalog) {
  const updates = [];

  for (const installed of installedZims) {
    const latest = findLatestVersion(installed, catalog);
    if (latest && latest.date > installed.date) {
      updates.push({
        installed,
        latest,
        sizeDiff: latest.size - installed.size
      });
    }
  }

  return updates;
}
```

---

## Visual Design Guidelines

### **Color Palette**

```css
/* Primary Colors */
--primary-blue: #1976d2;
--primary-dark: #115293;
--primary-light: #4791db;

/* Status Colors */
--success-green: #4caf50;
--warning-yellow: #ff9800;
--error-red: #f44336;
--info-blue: #2196f3;

/* Neutral Colors */
--gray-50: #fafafa;
--gray-100: #f5f5f5;
--gray-300: #e0e0e0;
--gray-500: #9e9e9e;
--gray-700: #616161;
--gray-900: #212121;

/* Storage Indicators */
--storage-used: #1976d2;
--storage-selected: #4caf50;  /* Flashing */
--storage-free: #e0e0e0;
```

### **Typography**

```css
/* Headers */
h1: 32px, bold, gray-900
h2: 24px, semibold, gray-800
h3: 20px, medium, gray-700

/* Body */
body: 16px, regular, gray-700
small: 14px, regular, gray-600
tiny: 12px, regular, gray-500
```

### **Spacing**

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
```

### **Animations**

```css
/* Storage bar flashing */
@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Loading spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Pulse */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

---

## Error Handling & Edge Cases

### **Drive Disconnected During Download**

```javascript
// Monitor drive availability
useEffect(() => {
  const handleDriveDisconnected = (disconnectedDrive) => {
    if (disconnectedDrive.device === selectedDrive.device) {
      pauseDownload();
      showAlert({
        type: 'error',
        title: 'USB Drive Disconnected',
        message: 'Please reconnect the USB drive to continue',
        actions: ['Retry', 'Download to Computer Instead']
      });
    }
  };

  window.electronAPI.on('drives:changed', handleDriveDisconnected);
  return () => window.electronAPI.off('drives:changed', handleDriveDisconnected);
}, [selectedDrive]);
```

### **Insufficient Space**

```javascript
// Before download
if (totalSize > availableSpace) {
  showAlert({
    type: 'warning',
    title: 'Not Enough Space',
    message: `You need ${formatBytes(totalSize - availableSpace)} more space.`,
    suggestions: [
      'Choose a smaller ZIM file',
      'Use a larger USB drive',
      'Remove some existing files'
    ]
  });
  return;
}
```

### **Network Failure During Download**

```javascript
// Retry logic with exponential backoff
async function downloadWithRetry(url, destination, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await downloadFile(url, destination);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### **Format Confirmation Safety**

```javascript
// Must type "FORMAT" exactly
const [confirmText, setConfirmText] = useState('');
const canFormat = confirmText === 'FORMAT';

<TextField
  value={confirmText}
  onChange={(e) => setConfirmText(e.target.value)}
  placeholder="Type FORMAT to confirm"
  error={confirmText && confirmText !== 'FORMAT'}
/>
<Button
  disabled={!canFormat}
  onClick={handleFormat}
>
  Format to exFAT
</Button>
```

---

## Accessibility Features

- **Keyboard Navigation**: All screens navigable with Tab/Enter
- **Screen Reader Support**: ARIA labels on all interactive elements
- **Color Blind Safe**: Don't rely on color alone (use icons + text)
- **Focus Indicators**: Clear focus states for all buttons/inputs
- **Error Announcements**: Screen reader announcements for errors
- **Progress Updates**: Live region updates for download progress

---

## Performance Optimizations

1. **Lazy Loading**: Load ZIM catalog on demand, not at startup
2. **Virtualization**: Use react-window for long ZIM lists
3. **Debouncing**: Debounce drive scanning and progress updates
4. **Memoization**: Memoize storage calculations
5. **Code Splitting**: Lazy load screens with React.lazy()

---

## Testing Checklist

- [ ] Flow: Create new stick (full path)
- [ ] Flow: Update existing stick (full path)
- [ ] Flow: Download to local first
- [ ] Flow: Download directly to USB
- [ ] Drive detection: Multiple drives
- [ ] Drive detection: No drives
- [ ] Drive detection: Drive disconnected during download
- [ ] Filesystem: FAT32 warning
- [ ] Filesystem: exFAT formatting
- [ ] Storage: Insufficient space warning
- [ ] Storage: Real-time calculation
- [ ] Update detection: Multiple updates available
- [ ] Download: Pause/Resume
- [ ] Download: Cancel
- [ ] Download: Network failure recovery
- [ ] Transfer: Old version deletion
- [ ] Transfer: Progress tracking
- [ ] Completion: Eject USB

---

## Migration Strategy

### **Phase 1: Foundation** (Current)
1. Set up Zustand stores
2. Implement React Router
3. Create base layout component
4. Drive scanning on startup

### **Phase 2: Core Screens**
5. Initial choice screen
6. Drive selection screen
7. Main config screen (basic)

### **Phase 3: Enhanced Features**
8. Filesystem warning & formatting
9. Download strategy selection
10. Storage bar with animations

### **Phase 4: Progress & Completion**
11. Download progress screen
12. Transfer progress screen
13. Completion screen

### **Phase 5: Polish**
14. Error handling
15. Animations and transitions
16. Accessibility improvements
17. Testing and bug fixes

---

## Success Metrics

**User Experience:**
- Time to complete first stick: <5 minutes (excluding download)
- User errors (wrong filesystem, insufficient space): <10%
- Task completion rate: >90%

**Technical:**
- App startup time: <2 seconds
- Drive scan time: <1 second
- UI responsiveness: 60fps animations
- Memory usage: <200MB

---

## Future Enhancements

1. **Profiles**: Save common configurations
2. **Batch Mode**: Create multiple sticks simultaneously
3. **Scheduling**: Schedule automatic updates
4. **Cloud Sync**: Sync configurations across devices
5. **Advanced Mode**: Toggle for power users
6. **Torrent Support**: P2P downloads for faster speeds
7. **Verification**: Automatic integrity checking
8. **Multi-language UI**: Internationalization

---

**End of Design Document**
