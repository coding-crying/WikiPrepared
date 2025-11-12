# Kiwix USB Updater - Technical Architecture

## Technology Stack

### Frontend
- **Electron**: Cross-platform desktop framework
- **React**: UI component library
- **Electron Forge**: Building and packaging
- **Material-UI / Ant Design**: Component framework for consistent UI
- **Redux / Zustand**: State management
- **React Router**: Navigation between views

### Backend (Node.js)
- **Node.js**: JavaScript runtime (v18+ LTS)
- **Electron IPC**: Communication between main and renderer processes
- **Native modules**: For system-level operations

### Key Libraries

#### USB & Drive Management
- **drivelist**: Enumerate and identify USB drives safely
  - Cross-platform drive detection
  - Drive metadata (size, mountpoint, description)
  - USB vs internal drive identification
- **node-disk-info**: Additional drive information
- **node-usb** (optional): Lower-level USB access if needed

#### File Operations
- **fs/promises**: Native Node.js file system (async/await)
- **fs-extra**: Enhanced file operations (copy, move, remove)
- **etcher-sdk**: Reliable writing to removable media
  - Used by Balena Etcher (proven reliability)
  - Block-level writing
  - Verification capabilities
- **stream**: For efficient large file handling

#### Download Management
- **axios**: HTTP client for downloads
- **got** or **node-fetch**: Alternative HTTP clients
- **progress-stream**: Monitor download progress
- **checksum**: MD5/SHA256 verification
- **cheerio**: Parse HTML from dumps.wikimedia.org catalog

#### ZIM File Handling
- **libzim-wasm** (optional): Read ZIM metadata without external tools
- **child_process**: Run zimdump/zimcheck if needed
- **zim-types**: TypeScript types for ZIM files (if available)

#### Utilities
- **date-fns**: Date parsing and formatting
- **filesize**: Human-readable file sizes
- **sanitize-filename**: Safe filename handling
- **semver**: Version comparison for updates

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Drive      │  │   Download   │  │    ZIM       │  │
│  │   Manager    │  │   Manager    │  │   Manager    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                          │                                │
│                   ┌──────▼───────┐                       │
│                   │  IPC Handler  │                       │
│                   └──────┬───────┘                       │
└────────────────────────────┬─────────────────────────────┘
                             │ IPC
┌────────────────────────────▼─────────────────────────────┐
│                 Electron Renderer Process                 │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │                  React App                       │    │
│  │                                                   │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │    │
│  │  │Dashboard │  │  ZIM     │  │ Update   │      │    │
│  │  │   View   │  │ Browser  │  │ Manager  │      │    │
│  │  └──────────┘  └──────────┘  └──────────┘      │    │
│  │                                                   │    │
│  │  ┌──────────────────────────────────────┐       │    │
│  │  │         State Management              │       │    │
│  │  │         (Redux/Zustand)               │       │    │
│  │  └──────────────────────────────────────┘       │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

## Module Structure

```
kiwix-usb-updater/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.js            # Main entry point
│   │   ├── ipc-handlers.js     # IPC communication handlers
│   │   ├── managers/
│   │   │   ├── DriveManager.js      # USB drive operations
│   │   │   ├── DownloadManager.js   # File download orchestration
│   │   │   ├── ZimManager.js        # ZIM catalog & metadata
│   │   │   └── KiwixManager.js      # Kiwix reader downloads
│   │   ├── services/
│   │   │   ├── CatalogService.js    # Fetch/parse Wikimedia catalog
│   │   │   ├── FileService.js       # File operations (copy, verify)
│   │   │   ├── UpdateService.js     # Version comparison
│   │   │   └── ChecksumService.js   # File integrity verification
│   │   └── utils/
│   │       ├── logger.js           # Logging utility
│   │       └── config.js           # App configuration
│   │
│   ├── renderer/                # Electron renderer process
│   │   ├── index.jsx           # React entry point
│   │   ├── App.jsx             # Main app component
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── ProgressBar.jsx
│   │   │   │   └── Modal.jsx
│   │   │   ├── dashboard/
│   │   │   │   ├── DriveList.jsx
│   │   │   │   ├── DriveInfo.jsx
│   │   │   │   └── QuickActions.jsx
│   │   │   ├── zim-browser/
│   │   │   │   ├── FilterPanel.jsx
│   │   │   │   ├── ZimGrid.jsx
│   │   │   │   ├── ZimCard.jsx
│   │   │   │   └── DownloadQueue.jsx
│   │   │   ├── kiwix-reader/
│   │   │   │   ├── PlatformSelector.jsx
│   │   │   │   └── InstallButton.jsx
│   │   │   └── update-manager/
│   │   │       ├── UpdateList.jsx
│   │   │       └── UpdateRow.jsx
│   │   ├── views/
│   │   │   ├── DashboardView.jsx
│   │   │   ├── ZimBrowserView.jsx
│   │   │   ├── UpdateManagerView.jsx
│   │   │   └── SettingsView.jsx
│   │   ├── store/
│   │   │   ├── index.js            # Store configuration
│   │   │   ├── slices/
│   │   │   │   ├── drivesSlice.js
│   │   │   │   ├── zimsSlice.js
│   │   │   │   ├── downloadsSlice.js
│   │   │   │   └── settingsSlice.js
│   │   │   └── actions/
│   │   │       └── ipcActions.js    # IPC call wrappers
│   │   ├── styles/
│   │   │   └── global.css
│   │   └── utils/
│   │       └── formatters.js        # Display formatting utilities
│   │
│   └── shared/                  # Shared between main and renderer
│       ├── constants.js
│       ├── types.js
│       └── ipc-channels.js      # IPC channel name constants
│
├── public/                      # Static assets
│   ├── index.html
│   └── icons/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── package.json
├── forge.config.js              # Electron Forge configuration
├── webpack.config.js
└── README.md
```

## Core Components Detail

### 1. DriveManager (Main Process)

**Responsibilities:**
- Detect connected USB drives
- Monitor drive connection/disconnection events
- Provide drive metadata (capacity, free space, mount point)
- Validate drive safety (USB only, not system drive)
- Scan USB for existing content

**Key Methods:**
```javascript
class DriveManager {
  async listDrives()
  async getDriveInfo(drivePath)
  async scanZimFiles(drivePath)
  async validateDrive(drivePath)
  watchDrives(callback)
  async ejectDrive(drivePath)
}
```

### 2. ZimManager (Main Process)

**Responsibilities:**
- Fetch ZIM catalog from dumps.wikimedia.org
- Parse directory listings (HTML scraping)
- Extract metadata from filenames
- Filter ZIMs by language, size, topic
- Cache catalog locally

**Key Methods:**
```javascript
class ZimManager {
  async fetchCatalog()
  async parseZimListing(html)
  async filterZims(filters)
  extractMetadata(filename)
  async getCachedCatalog()
  async updateCatalog()
}
```

**ZIM Filename Parsing:**
```
Format: wikipedia_<lang>_<topic>_<scope>_<YYYY-MM>.zim

Examples:
- wikipedia_en_all_maxi_2025-11.zim
- wikipedia_es_all_nopic_2025-10.zim
- wikipedia_fr_all_mini_2025-11.zim

Extraction:
- Language: en, es, fr, de, etc.
- Topic: all, computer, geography, etc.
- Scope: mini, nopic, maxi
- Date: YYYY-MM
```

### 3. DownloadManager (Main Process)

**Responsibilities:**
- Queue management for downloads
- Parallel download coordination
- Progress tracking
- Resume interrupted downloads
- Checksum verification
- Error handling and retry logic

**Key Methods:**
```javascript
class DownloadManager {
  async addToQueue(url, destination, metadata)
  async startDownload(downloadId)
  pauseDownload(downloadId)
  resumeDownload(downloadId)
  cancelDownload(downloadId)
  async verifyChecksum(filepath, expectedHash)
  getDownloadProgress(downloadId)
}
```

**Download Queue Item:**
```javascript
{
  id: string,
  url: string,
  destination: string,
  filename: string,
  totalSize: number,
  downloadedSize: number,
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error',
  progress: number (0-100),
  speed: number (bytes/sec),
  eta: number (seconds),
  error: string | null,
  metadata: object
}
```

### 4. UpdateService (Main Process)

**Responsibilities:**
- Parse installed ZIM filenames
- Compare versions with online catalog
- Determine update availability
- Generate update recommendations

**Key Methods:**
```javascript
class UpdateService {
  async scanInstalledZims(drivePath)
  async checkForUpdates(installedZims, catalog)
  compareVersions(installedDate, latestDate)
  generateUpdateList(comparisons)
}
```

### 5. KiwixManager (Main Process)

**Responsibilities:**
- Fetch available Kiwix reader versions
- Download platform-specific readers
- Install readers to USB with portable configuration
- Detect installed reader versions

**Key Methods:**
```javascript
class KiwixManager {
  async getLatestVersions()
  async downloadReader(platform, destination)
  async installToUSB(platform, usbPath)
  async detectInstalledReaders(usbPath)
}
```

### 6. CatalogService (Main Process)

**Responsibilities:**
- HTTP requests to dumps.wikimedia.org
- HTML parsing with Cheerio
- Extract file listings and metadata
- Handle pagination if needed

**Key Methods:**
```javascript
class CatalogService {
  async fetchPage(url)
  parseDirectoryListing(html)
  extractFileInfo(linkElement)
  async fetchFileSize(url)
}
```

## IPC Communication

### Channel Definitions

```javascript
// src/shared/ipc-channels.js
export const IPC_CHANNELS = {
  // Drives
  DRIVES_LIST: 'drives:list',
  DRIVES_INFO: 'drives:info',
  DRIVES_SCAN: 'drives:scan',
  DRIVES_EJECT: 'drives:eject',
  DRIVES_WATCH: 'drives:watch',

  // ZIM Catalog
  ZIM_FETCH_CATALOG: 'zim:fetch-catalog',
  ZIM_FILTER: 'zim:filter',
  ZIM_SEARCH: 'zim:search',

  // Downloads
  DOWNLOAD_ADD: 'download:add',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_PROGRESS: 'download:progress', // Event

  // Updates
  UPDATE_SCAN: 'update:scan',
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',

  // Kiwix Reader
  KIWIX_GET_VERSIONS: 'kiwix:get-versions',
  KIWIX_DOWNLOAD: 'kiwix:download',
  KIWIX_INSTALL: 'kiwix:install',

  // File Operations
  FILE_COPY: 'file:copy',
  FILE_VERIFY: 'file:verify',
  FILE_DELETE: 'file:delete',
}
```

### IPC Flow Example (Download ZIM)

```
Renderer                        Main Process
   │                                 │
   │  download:add                   │
   ├────────────────────────────────>│
   │                                 │ DownloadManager.addToQueue()
   │  {downloadId}                   │
   │<────────────────────────────────┤
   │                                 │
   │  download:start                 │
   ├────────────────────────────────>│
   │                                 │ DownloadManager.startDownload()
   │                                 │        │
   │                                 │        ├─> axios.get(url, {stream})
   │                                 │        │
   │  download:progress (event)      │<───────┘ (multiple times)
   │<────────────────────────────────┤
   │                                 │
   │  download:progress (complete)   │
   │<────────────────────────────────┤
```

## Data Models

### Drive Info
```javascript
{
  device: string,           // /dev/sdb, E:, etc.
  mountpoint: string,       // /media/usb, E:\, etc.
  label: string,            // Drive label
  size: number,             // Total bytes
  free: number,             // Free bytes
  used: number,             // Used bytes
  isUSB: boolean,
  isRemovable: boolean,
  filesystemType: string,   // FAT32, exFAT, NTFS, etc.
  installedZims: ZimInfo[],
  installedReaders: ReaderInfo[]
}
```

### ZIM Info
```javascript
{
  filename: string,
  url: string,
  language: string,
  languageName: string,
  topic: string,
  scope: 'mini' | 'nopic' | 'maxi',
  size: number,
  date: string,              // YYYY-MM
  articleCount: number,      // If available
  description: string,
  checksum: string,          // MD5 or SHA256
  isInstalled: boolean,
  installedPath: string | null,
  hasUpdate: boolean,
  latestVersion: string | null
}
```

### Reader Info
```javascript
{
  platform: 'windows' | 'linux' | 'mac',
  version: string,
  installedPath: string | null,
  isPortable: boolean,
  executableName: string
}
```

## Security Considerations

### Electron Security
1. **Context Isolation**: Enable `contextIsolation: true`
2. **Node Integration**: Disable in renderer (`nodeIntegration: false`)
3. **Preload Scripts**: Use preload.js for IPC exposure
4. **Content Security Policy**: Restrict resource loading
5. **Permissions**: Request only necessary permissions

### File Operations
1. **Path Validation**: Sanitize all file paths
2. **Drive Validation**: Confirm USB before write operations
3. **User Confirmation**: Require explicit confirmation for destructive actions
4. **Sandboxing**: Limit file system access to necessary directories

### Network Security
1. **HTTPS Only**: All downloads over HTTPS
2. **Checksum Verification**: Mandatory integrity checks
3. **No Code Execution**: Don't execute downloaded files automatically
4. **Certificate Validation**: Verify SSL certificates

## Error Handling Strategy

### Levels
1. **User-Facing**: Show meaningful error messages
2. **Logging**: Log all errors for debugging
3. **Recovery**: Provide recovery options where possible
4. **Fallbacks**: Graceful degradation

### Common Error Scenarios
- Network failures during download → Retry with exponential backoff
- Insufficient disk space → Warn before download starts
- USB disconnected during operation → Pause and notify
- Corrupted download → Delete and re-download
- Permission issues → Request elevation or show instructions

## Performance Optimization

### Large File Handling
- **Streaming**: Use streams for large file operations
- **Chunking**: Download in chunks for resumability
- **Progress Throttling**: Update UI progress max 1x/second

### UI Responsiveness
- **Web Workers**: Offload heavy computations
- **Virtual Scrolling**: For large ZIM lists
- **Debouncing**: For search/filter inputs
- **Lazy Loading**: Load data as needed

### Memory Management
- **Pagination**: For catalog browsing
- **Cleanup**: Clear completed downloads from memory
- **Caching**: Cache catalog but with TTL

## Testing Strategy

### Unit Tests
- Individual managers and services
- Utility functions
- ZIM filename parsing
- Version comparison logic

### Integration Tests
- IPC communication flows
- Download process end-to-end
- Drive detection and scanning
- Update detection logic

### E2E Tests
- Complete user workflows
- UI interactions
- Cross-platform compatibility

### Manual Testing Checklist
- [ ] USB detection on each platform
- [ ] Large file downloads (>10GB)
- [ ] Interrupted download recovery
- [ ] Update detection accuracy
- [ ] Multi-drive scenarios
- [ ] Disk full scenarios
- [ ] Network failure scenarios

## Build & Distribution

### Development
```bash
npm install
npm run dev              # Start with hot reload
```

### Building
```bash
npm run build            # Build for current platform
npm run build:win        # Windows
npm run build:linux      # Linux (AppImage, deb)
npm run build:mac        # macOS (dmg)
```

### Packaging with Electron Forge
- **Windows**: NSIS installer, portable .exe
- **Linux**: AppImage, .deb, .rpm
- **Mac**: .dmg with code signing

### Auto-Updates (Future)
- Use `electron-updater`
- Check for updates on launch
- Download and install in background
- Notify user when ready

## Development Roadmap

### Sprint 1: Foundation (2 weeks)
- Project setup with Electron + React
- Basic UI layout
- USB drive detection
- File operations (copy, delete)

### Sprint 2: ZIM Catalog (2 weeks)
- Fetch and parse Wikimedia catalog
- Display ZIM list with filters
- Basic download functionality
- Progress tracking

### Sprint 3: Update Detection (1 week)
- Scan USB for installed ZIMs
- Compare with online catalog
- Display update status
- Update workflow

### Sprint 4: Kiwix Reader (1 week)
- Download Kiwix readers
- Install to USB with portable config
- Version detection

### Sprint 5: Polish (2 weeks)
- Error handling
- UI/UX improvements
- Checksum verification
- Settings panel

### Sprint 6: Testing & Distribution (2 weeks)
- Cross-platform testing
- Bug fixes
- Build pipeline
- Documentation

## Dependencies

### Core
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0"
}
```

### State Management
```json
{
  "zustand": "^4.4.7"
}
```

### UI Framework
```json
{
  "@mui/material": "^5.15.0",
  "@emotion/react": "^11.11.0",
  "@emotion/styled": "^11.11.0"
}
```

### Drive & File Operations
```json
{
  "drivelist": "^11.1.0",
  "fs-extra": "^11.2.0",
  "etcher-sdk": "^8.0.0"
}
```

### Download & Network
```json
{
  "axios": "^1.6.0",
  "progress-stream": "^2.0.0",
  "cheerio": "^1.0.0-rc.12"
}
```

### Utilities
```json
{
  "date-fns": "^2.30.0",
  "filesize": "^10.1.0",
  "sanitize-filename": "^1.6.3",
  "semver": "^7.5.4"
}
```

### Development
```json
{
  "@electron-forge/cli": "^7.2.0",
  "@electron-forge/maker-deb": "^7.2.0",
  "@electron-forge/maker-dmg": "^7.2.0",
  "@electron-forge/maker-squirrel": "^7.2.0",
  "@electron-forge/maker-zip": "^7.2.0",
  "webpack": "^5.89.0",
  "webpack-dev-server": "^4.15.0"
}
```
