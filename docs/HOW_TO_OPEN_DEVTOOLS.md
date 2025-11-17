# How to Open DevTools in Electron (Browser Console)

## Quick Method

When the Electron app window is open, press one of these:

- **F12** (most systems)
- **Ctrl + Shift + I** (Linux/Windows)
- **Cmd + Option + I** (macOS)

This will open the Developer Tools panel where you can see:
- **Console tab** - JavaScript logs and errors
- **Network tab** - File loading
- **Elements tab** - DOM inspection

---

## Alternative: Force DevTools to Open

If the keyboard shortcuts don't work, I've already configured the app to open DevTools automatically in development mode.

Check `src/main/index.js` around line 102-106:

```javascript
// Open DevTools in development
if (process.env.NODE_ENV === 'development') {
  mainWindow.webContents.openDevTools();
}
```

This should automatically open DevTools when you run `npm start`.

---

## What to Look For

### In the Console Tab:

**✅ Success:**
```
🔍 Electron API Debug Info
  Window available: true
  electronAPI available: true
  Available methods: ["invoke", "send", "on", ...]
```

**❌ Failure:**
```
❌ electronAPI is NOT available!
This means the preload script did not expose the API properly.
```

### Common Logs:

- Any errors in red
- The `ElectronAPIDebug` component output
- React errors
- IPC-related messages

---

## Current Issue Analysis

Based on your terminal output, the main issues are:

### 1. ✅ FIXED: `driveManager.watchDrives is not a function`
Changed to `startWatching()` in the latest commit.

### 2. ❌ STILL BROKEN: Preload Script Not Loading in Renderer

**Evidence:**
```
Using fallback preload path: /home/whywillwizardry/Desktop/WikiPrepared/src/main/preload.js
Warning: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY not defined
```

This means:
- Electron Forge's webpack isn't bundling properly
- The preload script exists on disk
- But it's not being injected into the renderer process

**The preload script runs in the MAIN process** (you see logs in terminal)
**But it needs to expose APIs to the RENDERER process** (browser window)

---

## The Real Problem: Webpack Not Bundling

The app is falling back to non-webpack mode, which doesn't work properly for the preload script.

### Check Webpack Config

Look for `forge.config.js` in the project root:

```bash
ls -la forge.config.js
cat forge.config.js
```

It should have webpack plugin configuration like:

```javascript
plugins: [
  {
    name: '@electron-forge/plugin-webpack',
    config: {
      mainConfig: './webpack.main.config.js',
      renderer: {
        config: './webpack.renderer.config.js',
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.jsx',
            name: 'main_window',
            preload: {
              js: './src/main/preload.js'
            }
          }
        ]
      }
    }
  }
]
```

### If webpack config is correct but still failing:

Try rebuilding everything:

```bash
# Clean everything
rm -rf node_modules .webpack out
npm install

# Start fresh
npm start
```

---

## Workaround: Manual Preload Loading

If webpack continues to fail, we can try a simpler approach.

### Option 1: Check if preload is actually loading

Add this to the VERY TOP of `src/renderer/index.jsx`:

```javascript
console.log('=== RENDERER STARTING ===');
console.log('window.electronAPI available?', !!window.electronAPI);
if (window.electronAPI) {
  console.log('electronAPI methods:', Object.keys(window.electronAPI));
} else {
  console.error('❌ window.electronAPI is undefined!');
  console.log('This means preload script did not run or failed');
}
```

This will tell us if the preload script actually ran.

### Option 2: Force preload load (if webpack broken)

Edit `src/main/index.js` around line 60:

```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js'), // Simpler path
}
```

---

## Step-by-Step Debugging

1. **Open the app** (`npm start`)

2. **Press F12** to open DevTools

3. **Look in Console tab** for:
   - `=== RENDERER STARTING ===`
   - `window.electronAPI available?`
   - Any red error messages

4. **Check Terminal** for:
   - `=== PRELOAD SCRIPT STARTING ===`
   - `=== PRELOAD SCRIPT COMPLETED SUCCESSFULLY ===`

5. **Share with me:**
   - Screenshot of DevTools console
   - Full terminal output
   - Whether you see preload logs in terminal

---

## Expected vs Actual

**Expected:**
- Terminal shows: `=== PRELOAD SCRIPT COMPLETED SUCCESSFULLY ===`
- Browser shows: `electronAPI available? true`
- UI shows: Green "Electron API Loaded" banner

**Actual (your case):**
- Terminal shows: Preload logs??? (we need to see this)
- Browser shows: ??? (need to open DevTools)
- UI shows: Red "Electron API Not Available" banner

---

## Next Steps

1. Pull the latest fixes:
   ```bash
   git pull origin claude/redesign-ui-flow-016d5DoPymsHshfiEb6Grvnw
   ```

2. Restart the app:
   ```bash
   npm start
   ```

3. **Press F12** immediately when window opens

4. Take screenshots of:
   - Terminal output (all of it)
   - Browser DevTools console

5. Look for "=== PRELOAD SCRIPT STARTING ===" in BOTH:
   - Terminal (should be there)
   - Browser console (might not be there)

If preload logs appear in terminal but NOT in browser console, that confirms the preload isn't being injected into the renderer.
