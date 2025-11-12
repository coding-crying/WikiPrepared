# Getting Started with Kiwix USB Updater Development

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher (LTS recommended)
- **npm** 9.x or higher (comes with Node.js)
- **Git** for version control
- A code editor (VS Code recommended)

### Platform-Specific Requirements

#### Windows
- Windows 10 or 11
- Windows Build Tools may be required for native modules

#### Linux
- Ubuntu 20.04+ or equivalent
- Build essentials: `sudo apt-get install build-essential`
- USB access permissions (you may need to be in the `plugdev` group)

#### macOS
- macOS 10.13 (High Sierra) or higher
- Xcode Command Line Tools: `xcode-select --install`

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/kiwix-usb-updater.git
cd kiwix-usb-updater
```

### 2. Install Dependencies

```bash
npm install
```

This will install all the required dependencies including:
- Electron (desktop framework)
- React (UI library)
- Node.js libraries for USB/drive management
- Build tools

**Note:** The first installation may take several minutes as it downloads Electron binaries and native modules.

### 3. Start Development Server

```bash
npm run dev
```

This will:
- Build the application
- Launch Electron
- Enable hot reloading for the renderer process
- Open DevTools automatically

## Project Structure

```
kiwix-usb-updater/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   ├── index.js       # Main entry point
│   │   ├── preload.js     # Preload script (security bridge)
│   │   ├── ipc-handlers.js # IPC communication handlers
│   │   ├── managers/      # Core business logic
│   │   └── services/      # Helper services
│   ├── renderer/          # Electron renderer (React UI)
│   │   ├── App.jsx        # Main React component
│   │   ├── index.jsx      # React entry point
│   │   ├── components/    # React components
│   │   └── store/         # State management
│   └── shared/            # Shared code (main + renderer)
├── public/                # Static assets
├── FEATURES.md            # Feature specifications
├── ARCHITECTURE.md        # Technical architecture
└── README.md              # Project overview
```

## Development Workflow

### Running the App

```bash
# Start with hot reload (development)
npm run dev

# Start without rebuild
npm start
```

### Building

```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:win      # Windows
npm run build:linux    # Linux (AppImage, .deb)
npm run build:mac      # macOS (.dmg)
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Linting
npm run lint
npm run lint:fix
```

## Understanding the Architecture

### Main Process (Node.js)

The main process runs Node.js and has access to:
- File system
- USB drive detection
- Network requests
- Native OS APIs

**Key files:**
- `src/main/index.js` - Application entry point
- `src/main/managers/DriveManager.js` - USB drive management
- `src/main/managers/ZimManager.js` - ZIM catalog management
- `src/main/managers/DownloadManager.js` - Download orchestration

### Renderer Process (React)

The renderer process is a web page that displays the UI:
- React components
- No direct access to Node.js APIs (security)
- Communicates with main process via IPC

**Key files:**
- `src/renderer/App.jsx` - Main UI component
- `src/renderer/index.jsx` - React initialization

### IPC Communication

Communication between main and renderer processes uses Electron's IPC:

```javascript
// In renderer:
const drives = await window.electronAPI.invoke('drives:list');

// In main (ipc-handlers.js):
ipcMain.handle('drives:list', async () => {
  return await driveManager.listDrives();
});
```

**Security:** The preload script (`src/main/preload.js`) provides a safe API bridge.

## Common Development Tasks

### Adding a New Feature

1. **Define the feature** in FEATURES.md
2. **Design the architecture** in ARCHITECTURE.md
3. **Implement backend logic** in `src/main/managers/` or `src/main/services/`
4. **Add IPC handlers** in `src/main/ipc-handlers.js`
5. **Create UI components** in `src/renderer/components/`
6. **Wire up with IPC** in your React components
7. **Test** the feature
8. **Document** your changes

### Debugging

#### Main Process
- Console logs appear in terminal where you ran `npm run dev`
- Use `console.log()` in main process files
- Set breakpoints in VS Code (attach to main process)

#### Renderer Process
- DevTools open automatically in development
- Use React DevTools extension
- Console logs appear in DevTools
- Set breakpoints in Sources tab

### Adding Dependencies

```bash
# Production dependency
npm install <package-name>

# Development dependency
npm install --save-dev <package-name>
```

**Note:** Some packages with native modules may require rebuilding:

```bash
npm run postinstall
```

## Troubleshooting

### USB Drives Not Detected

**Linux:**
```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER
# Log out and back in
```

**macOS:**
- Grant Disk Access permission in System Preferences > Security & Privacy

**Windows:**
- Run as Administrator if needed

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild native modules
npm run postinstall
```

### Permission Errors

Some operations (USB write, file copy) may require elevated permissions:
- **Windows:** Run as Administrator
- **Linux:** Use `sudo` or add user to appropriate groups
- **macOS:** Grant necessary permissions in System Preferences

## Next Steps

1. **Read the documentation:**
   - [FEATURES.md](FEATURES.md) - Feature specifications
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
   - [README.md](README.md) - Project overview

2. **Explore the code:**
   - Start with `src/main/index.js` (main process entry)
   - Then look at `src/renderer/App.jsx` (UI entry)
   - Review managers in `src/main/managers/`

3. **Try these tasks:**
   - Connect a USB drive and see it detected
   - Scan a USB drive for .zim files
   - Browse the code to understand data flow

4. **Join development:**
   - Check open issues on GitHub
   - Pick a feature from FEATURES.md
   - Submit a pull request

## Resources

### Official Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [Node.js Documentation](https://nodejs.org/docs)

### Kiwix Resources
- [Kiwix Website](https://www.kiwix.org/)
- [Kiwix GitHub](https://github.com/kiwix)
- [ZIM File Format](https://wiki.openzim.org/wiki/ZIM_file_format)
- [Wikimedia Dumps](https://dumps.wikimedia.org/other/kiwix/zim/wikipedia/)

### Development Tools
- [VS Code](https://code.visualstudio.com/)
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Electron Forge](https://www.electronforge.io/)

## Getting Help

- **Issues:** Report bugs or request features on GitHub Issues
- **Discussions:** Ask questions in GitHub Discussions
- **Documentation:** Check FEATURES.md and ARCHITECTURE.md
- **Code:** Add comments and JSDoc to your code

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See our coding guidelines in ARCHITECTURE.md.

---

**Happy coding!** If you encounter issues, check the troubleshooting section or open an issue on GitHub.
