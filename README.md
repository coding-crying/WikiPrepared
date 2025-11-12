# Kiwix USB Updater

A cross-platform desktop application for managing Kiwix reader installations and Wikipedia ZIM files on USB drives.

## Overview

Kiwix USB Updater simplifies the process of creating and maintaining offline Wikipedia USB drives. With an intuitive interface, users can:

- **Flash USB drives** with Kiwix reader software for Windows, Linux, and Mac
- **Browse and download** Wikipedia ZIM files filtered by language and size
- **Check for updates** to existing ZIM files on USB drives
- **Manage content** with easy-to-use download and installation tools

## Features

### Core Functionality
- 🔌 **Auto-detect USB drives** connected to your system
- 📚 **Browse Wikipedia ZIMs** from dumps.wikimedia.org with filters for:
  - Language (English, Spanish, French, German, etc.)
  - Size/Scope (Mini, NoPic, Maxi)
  - Topic (All, Computer, Geography, etc.)
- ⬇️ **Download manager** with progress tracking, pause/resume, and checksum verification
- 🔄 **Update detection** - scan USB drives and find newer versions of installed ZIMs
- 💻 **Kiwix reader installation** - automatically install portable Kiwix readers
- ✅ **Safe operations** - validates USB drives and prevents accidental data loss

### User Interface
- Clean, modern interface built with Material-UI
- Real-time progress tracking for downloads and file operations
- Filter and search capabilities for finding specific content
- Batch operations for updating multiple ZIMs at once

## Technology Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI component library
- **Node.js** - Backend operations
- **Material-UI** - Component framework

## Prerequisites

- Node.js 18+ LTS
- npm or yarn
- Administrator/root access for USB operations (on some systems)

## Installation

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/kiwix-usb-updater.git
cd kiwix-usb-updater

# Install dependencies
npm install

# Start development server
npm run dev
```

### Building from Source

```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:win      # Windows
npm run build:linux    # Linux (AppImage, .deb)
npm run build:mac      # macOS (.dmg)
```

## Usage

### 1. Connect USB Drive
- Plug in your USB drive
- The application will auto-detect it and display drive information

### 2. Install Kiwix Reader (Optional)
- Go to the "Kiwix Reader" tab
- Select platforms (Windows/Linux/Mac)
- Click "Install to USB"

### 3. Browse and Download ZIM Files
- Navigate to "ZIM Browser" tab
- Filter by language, size, or topic
- Click "Download" or "Install to USB" on desired ZIM files
- Monitor progress in the download queue

### 4. Check for Updates
- Go to "Update Manager" tab
- Click "Scan USB" to detect installed ZIMs
- Review available updates
- Select and update ZIMs as needed

## Project Structure

```
kiwix-usb-updater/
├── src/
│   ├── main/              # Electron main process
│   │   ├── managers/      # Core business logic
│   │   ├── services/      # Helper services
│   │   └── utils/         # Utilities
│   ├── renderer/          # React UI
│   │   ├── components/    # React components
│   │   ├── views/         # Page views
│   │   └── store/         # State management
│   └── shared/            # Shared code
├── public/                # Static assets
├── tests/                 # Test files
├── FEATURES.md            # Detailed feature specifications
├── ARCHITECTURE.md        # Technical architecture documentation
└── README.md              # This file
```

## Documentation

- [Features](FEATURES.md) - Comprehensive feature set and requirements
- [Architecture](ARCHITECTURE.md) - Technical architecture and implementation details

## Development Roadmap

- [x] Requirements gathering and planning
- [x] Feature set definition
- [x] Architecture design
- [ ] Sprint 1: Foundation (Electron + React setup, USB detection)
- [ ] Sprint 2: ZIM Catalog (Browse and download functionality)
- [ ] Sprint 3: Update Detection (Scan and compare versions)
- [ ] Sprint 4: Kiwix Reader Installation
- [ ] Sprint 5: Polish (Error handling, UI/UX improvements)
- [ ] Sprint 6: Testing & Distribution (Cross-platform testing, packaging)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Test on multiple platforms before submitting PR

## Data Sources

- **ZIM Files**: https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/
- **Kiwix Readers**: https://www.kiwix.org/en/download/

## License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

## Acknowledgments

- [Kiwix](https://www.kiwix.org/) - For creating amazing offline content readers
- [Wikimedia Foundation](https://www.wikimedia.org/) - For hosting ZIM file dumps
- [Electron](https://www.electronjs.org/) - For the cross-platform framework

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## FAQ

**Q: Why do I need administrator/root access?**
A: Some USB write operations require elevated privileges on certain operating systems. The app will prompt you when needed.

**Q: How much space do I need on my USB drive?**
A: It depends on which ZIMs you choose:
- Mini editions: 100MB - 1GB
- NoPic editions: 5GB - 20GB
- Maxi editions: 50GB - 90GB

**Q: Can I use this on multiple USB drives?**
A: Yes! The application supports managing multiple USB drives simultaneously.

**Q: Are downloads resumable if interrupted?**
A: Yes, the download manager supports pause/resume functionality.

**Q: How do I know if my ZIM files are up to date?**
A: Use the "Update Manager" tab to scan your USB drive and check for available updates.

## Troubleshooting

### USB drive not detected
- Ensure the drive is properly connected
- Try unplugging and reconnecting
- Check if the drive is mounted (Linux/Mac)
- Run the application with administrator privileges

### Downloads failing
- Check your internet connection
- Verify you have sufficient disk space
- Check firewall settings
- Try downloading to a different location

### Application won't start
- Ensure Node.js 18+ is installed
- Delete `node_modules` and run `npm install` again
- Check console for error messages

---

**Note**: This application is currently in development. Features and documentation are subject to change.
