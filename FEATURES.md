# Kiwix USB Updater - Feature Set

## Project Overview
A cross-platform desktop application for managing Kiwix reader installations and ZIM files on USB drives. Built with Electron + Node.js for Windows, Linux, and Mac.

## Core Features

### 1. USB Drive Management
- **Auto-detect USB drives** connected to the system
- **Drive information display**: capacity, free space, current contents
- **Safe drive selection** with warnings to prevent data loss
- **Support for multiple USB drives** simultaneously
- **Drive format validation** (FAT32, exFAT, NTFS compatibility check)

### 2. Kiwix Reader Installation
- **Download latest Kiwix readers** from official sources
- **Multi-platform support**:
  - Windows: Portable .exe version
  - Linux: AppImage version
  - Mac: .dmg or portable version
- **Selective installation**: User can choose which platform readers to install
- **Portable configuration**: Automatically create `.portable` file for portable operation
- **Version management**: Display installed version and available updates

### 3. ZIM File Management

#### 3.1 Browse & Download
- **Catalog browser** for available ZIM files from dumps.wikimedia.org
- **Filter by language**:
  - Dropdown or search for language codes (en, es, fr, de, etc.)
  - Display language names in addition to codes
- **Filter by size/scope**:
  - Mini (lead sections only, ~100MB-1GB)
  - NoPic (full text without images, ~5-20GB)
  - Maxi (full content with images, ~50-90GB)
- **Filter by topic**: all, computer, geography, chemistry, etc.
- **Search functionality**: Find specific Wikipedia editions
- **Metadata display**:
  - File size
  - Last updated date
  - Article count
  - Description
- **Download manager**:
  - Parallel downloads with progress bars
  - Pause/resume capability
  - Download speed and ETA
  - Checksum verification (MD5/SHA256)
  - Resume interrupted downloads

#### 3.2 Update Detection
- **Scan existing USB** for installed ZIM files
- **Parse ZIM filenames** to extract version dates
- **Compare with online catalog** to find newer versions
- **Display update status**:
  - Up to date (green)
  - Update available (yellow)
  - Unknown/corrupted (red)
- **Batch update**: Select multiple files to update
- **Smart update**: Option to delete old version after successful download

#### 3.3 Installation to USB
- **Copy ZIM files** to USB drive with progress indication
- **Verify integrity** after copying
- **Organize files**: Create proper directory structure
- **Space management**: Warn if insufficient space
- **Conflict resolution**: Handle duplicate files

### 4. User Interface

#### 4.1 Main Dashboard
- **Connected drives panel**: List all detected USB drives
- **Selected drive overview**: Show capacity, free space, installed content
- **Quick actions**: Install Kiwix, Browse ZIMs, Check for Updates

#### 4.2 Kiwix Reader Tab
- **Platform selector**: Checkboxes for Windows/Linux/Mac readers
- **Version information**: Show latest available version
- **Installation status**: Show which readers are installed on selected USB
- **Install/Update button**: One-click installation

#### 4.3 ZIM Browser Tab
- **Filter panel** (left sidebar):
  - Language selector
  - Size/scope selector
  - Topic selector
  - Sort by: name, size, date
- **Content grid/list** (main area):
  - ZIM file cards with metadata
  - Add to download queue button
  - Install directly to USB option
- **Download queue** (bottom panel):
  - Active downloads with progress
  - Queued downloads
  - Clear completed button

#### 4.4 Update Manager Tab
- **Scan USB button**: Detect installed ZIMs
- **Update list**: Table showing:
  - ZIM name
  - Current version
  - Latest version
  - Size
  - Update status
  - Action buttons (Update/Delete)
- **Select all updates** checkbox
- **Batch update button**

#### 4.5 Settings
- **Default download location**: Temporary folder for downloads
- **Download behavior**:
  - Direct to USB or download then copy
  - Auto-delete old versions
  - Checksum verification on/off
- **Network settings**:
  - Concurrent downloads limit
  - Bandwidth throttling
- **Update check frequency**: Manual, daily, weekly
- **Theme**: Light/Dark mode

### 5. Safety Features
- **Drive lock protection**: Prevent writing to non-USB drives
- **Confirmation dialogs**: For destructive operations
- **Backup prompts**: Warn users to backup USB before operations
- **Safe eject**: Option to safely eject USB after operations
- **Error recovery**: Handle interrupted operations gracefully

### 6. Advanced Features (Phase 2)
- **Custom collections**: Save favorite ZIM configurations
- **Scheduled updates**: Automatic update checks on schedule
- **Multi-USB sync**: Clone configuration to multiple USB drives
- **Compression**: Compress less-used ZIMs to save space
- **Usage statistics**: Track which ZIMs are accessed most
- **Export configuration**: Save/load USB setup profiles

## Technical Requirements

### Performance
- Download speeds: Utilize full available bandwidth
- UI responsiveness: Non-blocking operations
- Memory efficiency: Handle large file lists without excessive RAM

### Compatibility
- **Windows**: 10, 11 (possibly 7/8 with testing)
- **Linux**: Ubuntu 20.04+, Fedora, Debian, Arch
- **Mac**: macOS 10.13+ (High Sierra and newer)

### Security
- **HTTPS downloads**: Secure connections only
- **Checksum verification**: Validate downloaded files
- **No elevation prompts**: Run without admin/root when possible
- **Sandboxed operations**: Electron security best practices

## Success Metrics
- Successfully flash USB with Kiwix reader
- Download and install ZIM files by language/size filters
- Detect and update outdated ZIM files
- Cross-platform functionality on Windows, Linux, Mac
- Intuitive UI requiring minimal technical knowledge

## Development Phases

### Phase 1: MVP (Minimum Viable Product)
1. USB drive detection and selection
2. Basic ZIM catalog browser with language filter
3. Download single ZIM file to local system
4. Copy ZIM to USB drive
5. Basic progress indicators

### Phase 2: Core Features
1. Kiwix reader installation
2. Multi-download management
3. Update detection and management
4. All filters (language, size, topic)
5. Checksum verification

### Phase 3: Polish & Advanced
1. Complete UI/UX refinement
2. Advanced features
3. Error handling and recovery
4. Comprehensive testing
5. Documentation and help system

### Phase 4: Platform-Specific Testing
1. Windows installer and testing
2. Linux packaging (AppImage, .deb, .rpm)
3. Mac .dmg packaging and signing
4. Cross-platform bug fixes
