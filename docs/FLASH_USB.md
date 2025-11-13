# Flash USB Feature

The Flash USB feature allows you to prepare USB drives with Wikipedia ZIM files and Kiwix readers for offline use.

## Overview

This feature provides a complete workflow for creating portable offline Wikipedia collections:

1. **Drive Selection & Analysis** - Select a USB drive and analyze compatibility
2. **Content Selection** - Choose ZIM files and Kiwix readers to install
3. **Preparation** - Format drive if needed (exFAT recommended)
4. **Flashing** - Copy all content with progress tracking
5. **Auto-Detection** - Prepared drives are automatically detected when plugged in later

## How It Works

### Step 1: Select Drive

- Plug in a USB drive
- The app detects all connected USB/removable drives
- Select your target drive
- The app analyzes:
  - **Filesystem**: FAT32, exFAT, NTFS, etc.
  - **Free Space**: Available storage
  - **Compatibility**: Warnings for FAT32 (4GB file limit) or Linux-only filesystems

**Recommendations:**
- ✅ **exFAT**: Best choice for cross-platform compatibility (Windows, Mac, Linux)
- ⚠️ **FAT32**: 4GB file size limit - large ZIM files will fail
- ⚠️ **NTFS**: Limited macOS/Linux support
- ⚠️ **ext4**: Windows/macOS can't read without drivers

### Step 2: Select Content

**ZIM Files:**
- Select from the online catalog
- First 20 shown, use ZIM Browser for full filtering
- See filename and size for each

**Kiwix Readers:**
- Select platforms to install:
  - 🪟 Windows
  - 🐧 Linux
  - 🍎 macOS
- Readers are placed in `/kiwix-readers/[platform]/` folder

### Step 3: Review & Prepare

**Review:**
- Target drive info
- Number of ZIMs and readers
- Total size required
- Free space available

**Format Option:**
- If drive is incompatible (FAT32, wrong filesystem), you can format it
- ⚠️ **WARNING**: Formatting erases ALL data on the drive!
- Recommended: exFAT for best compatibility

**Validation:**
- App checks if enough free space is available
- Blocks flashing if space insufficient

### Step 4: Flash Progress

Real-time progress tracking:
- Overall progress bar (0-100%)
- Current operation status
- Operations:
  1. Format drive (if requested)
  2. Create folder structure
  3. Copy ZIM files (with individual progress)
  4. Download and copy Kiwix readers
  5. Create metadata and README

## Folder Structure

After flashing, the USB drive contains:

```
/
├── .kiwix-usb-updater.json    # Metadata for auto-detection
├── README.txt                  # Usage instructions
├── zims/                       # ZIM files
│   ├── wikipedia_en_all_maxi_2024-01.zim
│   └── wikipedia_es_all_maxi_2023-12.zim
└── kiwix-readers/              # Kiwix desktop applications
    ├── windows/
    │   └── kiwix-desktop_windows_x64_3.3.0.exe
    ├── linux/
    │   └── kiwix-desktop_linux_x86_64_3.3.0.appimage
    └── macos/
        └── kiwix-desktop_macos_3.3.0.dmg
```

## Metadata File

`.kiwix-usb-updater.json` format:

```json
{
  "version": "1.0",
  "createdAt": "2024-01-15T10:30:00Z",
  "createdBy": "Kiwix USB Updater",
  "appVersion": "0.1.0",
  "content": {
    "zims": [
      {
        "filename": "wikipedia_en_all_maxi_2024-01.zim",
        "url": "https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/wikipedia_en_all_maxi_2024-01.zim",
        "size": 95000000000,
        "installedAt": "2024-01-15T10:35:00Z"
      }
    ],
    "kiwix": ["windows", "linux", "macos"]
  }
}
```

## Auto-Detection System

When you plug in a prepared USB drive:

1. **Dashboard detects metadata file** - Shows "📦 Prepared Drive" indicator
2. **Instant access to installed content** - No need to rescan
3. **Update checking** - Navigate to Updates page to:
   - Check if installed ZIMs have newer versions available
   - Download only what needs updating
   - Automatic version comparison based on metadata

## Technical Details

### Formatting

**Linux:**
- Uses `mkfs.exfat`, `mkfs.vfat`, or `mkfs.ntfs`
- Requires `exfat-utils` package
- May require sudo privileges

**macOS:**
- Uses `diskutil eraseDisk`
- Supported: exFAT, FAT32
- NTFS not natively supported

**Windows:**
- Uses `format` command
- Requires administrator privileges
- Supports: exFAT, FAT32, NTFS

### Privilege Requirements

Drive formatting requires elevated privileges:
- **Linux**: sudo access
- **macOS**: Administrator password (diskutil prompts)
- **Windows**: Run as Administrator

### Progress Tracking

The Flash USB process emits progress events:
- `FLASH_PROGRESS` - IPC event with progress updates
- Progress percentage (0-100)
- Current operation status text
- Individual file copy progress

### Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Not enough space" | Drive too small | Use larger drive or select fewer ZIMs |
| "Permission denied" | Insufficient privileges | Run with sudo/administrator |
| "Drive not found" | Drive unplugged | Reconnect drive |
| "Format failed" | Drive in use/mounted | Unmount and retry |
| "Download failed" | Network error | Check internet connection |

## Use Cases

### 1. Offline Education
- Prepare USBs with Wikipedia in multiple languages
- Distribute to schools without internet
- Include Kiwix reader for each platform

### 2. Emergency Response
- Medical/technical reference materials
- Multi-language support
- Self-contained with reader software

### 3. Research in Remote Areas
- Pre-load relevant ZIM collections
- No internet dependency
- Cross-platform compatibility

### 4. Libraries & Community Centers
- Rotating ZIM collections
- Easy to update with latest versions
- One USB, all platforms supported

## Limitations

1. **File Size**: FAT32 has 4GB limit - use exFAT for large ZIMs
2. **Privileges**: Formatting requires elevated permissions
3. **Network**: Requires internet to download content
4. **Time**: Large ZIMs take time to download/copy
5. **Platform Specific**: Format commands vary by OS

## Future Enhancements

Planned features:
- [ ] Resume interrupted flash operations
- [ ] Batch flash multiple USB drives
- [ ] Custom folder structure options
- [ ] Compression for faster copying
- [ ] Checksum verification after copying
- [ ] Scheduled auto-updates for prepared drives
- [ ] Create bootable USB option
- [ ] Kiwix Hotspot integration

## FAQ

**Q: Can I add more ZIMs to a prepared drive later?**
A: Yes! Just plug in the drive, go to ZIM Browser, and download more files. The metadata will be updated automatically.

**Q: What if formatting fails?**
A: Check privileges (sudo/administrator). Also ensure drive is unmounted/not in use.

**Q: Can I use the drive for other files too?**
A: Yes! The flashing process only uses `/zims/` and `/kiwix-readers/` folders. Rest of the drive is available.

**Q: How do I update content on a prepared drive?**
A: Plug in the drive, go to Updates page. The app detects what's installed and checks for newer versions.

**Q: Which filesystem should I choose?**
A: **exFAT** for best compatibility. Readable on Windows, macOS, and Linux (with exfat-utils).

**Q: Can I flash multiple drives at once?**
A: Not yet, but this is a planned feature.

**Q: Do I need Kiwix reader on the USB?**
A: No, it's optional. Users can download readers separately from kiwix.org. Including them makes the USB self-contained.

## See Also

- [README.md](../README.md) - Main documentation
- [ZIM Browser](./ZIM_BROWSER.md) - Finding and downloading ZIMs
- [Updates](./UPDATES.md) - Checking for ZIM updates
- [Kiwix.org](https://www.kiwix.org/) - Official Kiwix website
