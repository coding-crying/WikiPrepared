# Troubleshooting: electronAPI Not Available

**Error:** `Cannot read properties of undefined (reading 'invoke')`
**Cause:** The preload script is not properly exposing `window.electronAPI` to the renderer process

---

## Quick Fix

The app now includes a debug banner that will show at the top of the screen when electronAPI is not available. It will tell you exactly what's wrong.

**After pulling the latest changes:**

```bash
git pull origin claude/redesign-ui-flow-016d5DoPymsHshfiEb6Grvnw
npm start
```

You should now see either:
- ✅ **Green success message** - "Electron API Loaded"
- ❌ **Red error banner** - "Electron API Not Available"

---

## Root Cause Analysis

The error occurs because:

1. The renderer process tries to call `window.electronAPI.invoke()`
2. But `window.electronAPI` is `undefined`
3. This means the preload script (`src/main/preload.js`) didn't run or failed

---

## Debugging Steps

### 1. Check Main Process Console

Open the **terminal where you ran `npm start`** and look for these messages:

**✅ Success looks like:**
```
=== PRELOAD SCRIPT STARTING ===
Preload: Loaded electron dependencies
Preload: Loaded IPC channels
Preload: All dependencies loaded successfully
Preload: Exposing electronAPI to main world...
Preload: Successfully exposed electronAPI to main world
=== PRELOAD SCRIPT COMPLETED ===
```

**❌ Failure might show:**
```
Error loading dependencies...
Error exposing electronAPI...
```

### 2. Check Renderer Console

Open **DevTools** in the Electron window (press F12 or Ctrl+Shift+I) and look for:

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

### 3. Verify Preload Path

Check `src/main/index.js` around line 40-50. It should log:

```javascript
console.log('Preload path:', preloadPath);
console.log('Preload exists:', require('fs').existsSync(preloadPath));
```

**What to look for:**
- The path should point to a real file
- `Preload exists:` should be `true`

---

## Common Issues & Solutions

### Issue 1: Preload Script Not Loading

**Symptoms:**
- No preload logs in console
- `Preload exists: false`

**Solution:**
```bash
# Rebuild the app
npm run build
npm start
```

### Issue 2: Context Isolation Issue

**Symptoms:**
- Preload runs but electronAPI still undefined
- Error: "contextBridge is not defined"

**Check:** `src/main/index.js` line 60-65
```javascript
webPreferences: {
  nodeIntegration: false,      // ✓ Should be false
  contextIsolation: true,      // ✓ Should be true
  preload: preloadPath,        // ✓ Should be set
}
```

### Issue 3: Webpack Bundle Issue

**Symptoms:**
- Works in dev mode but not in packaged app
- Preload path points to wrong location

**Solution:**
```bash
# Clean and rebuild
rm -rf .webpack
npm run make
```

### Issue 4: IPC Channels Not Registered

**Symptoms:**
- electronAPI exists but calls fail
- "Invalid IPC channel" errors

**Check:** `src/main/ipc-handlers.js`
Ensure all handlers are registered:
```javascript
setupIpcHandlers() {
  ipcMain.handle('drives:list', ...)
  ipcMain.handle('drives:scan', ...)
  ipcMain.handle('zim:fetch-catalog', ...)
  // etc.
}
```

---

## Testing the Fix

After pulling the latest changes, you should see:

**1. On App Start:**
- Either a green success banner or red error banner at the top

**2. In Console:**
- Detailed debug logs showing what's available

**3. When Navigating:**
- No more crashes
- Graceful fallback if API not available
- Warning messages instead of errors

---

## Emergency Fallback

If the preload script is fundamentally broken, you can temporarily test the UI in "demo mode":

**Create `src/renderer/utils/mockElectronAPI.js`:**
```javascript
// Mock electronAPI for testing UI without Electron
export const mockElectronAPI = {
  invoke: async (channel, ...args) => {
    console.log('Mock invoke:', channel, args);

    // Return mock data based on channel
    if (channel === 'drives:list') {
      return [
        {
          device: '/dev/sdb1',
          label: 'USB Drive',
          size: 128 * 1024 * 1024 * 1024,
          filesystem: 'exFAT',
          isUSB: true,
          mountpoints: [{ path: '/media/usb' }]
        }
      ];
    }

    if (channel === 'zim:fetch-catalog') {
      return [
        {
          filename: 'wikipedia_en_all_nopic_2025-11.zim',
          language: 'en',
          topic: 'all',
          scope: 'nopic',
          size: 55 * 1024 * 1024 * 1024,
          date: '2025-11'
        }
      ];
    }

    return null;
  },

  on: (channel, callback) => {
    console.log('Mock on:', channel);
    return () => {};
  },

  off: (channel) => {
    console.log('Mock off:', channel);
  }
};

// Only use in development
if (process.env.NODE_ENV === 'development' && !window.electronAPI) {
  window.electronAPI = mockElectronAPI;
}
```

Then import it in `App.jsx`:
```javascript
import './utils/mockElectronAPI'; // Add this at the top
```

This will let you test the UI flow even if the preload script is broken.

---

## What Changed in the Latest Update

**1. Added Defensive Checks** (`src/renderer/stores/drivesStore.js`, `zimsStore.js`)
```javascript
// Now checks if electronAPI exists before using it
const checkElectronAPI = () => {
  if (!window.electronAPI) {
    console.error('electronAPI not available');
    return false;
  }
  return true;
};
```

**2. Added Debug Component** (`src/renderer/components/common/ElectronAPIDebug.jsx`)
- Shows visual banner when API is missing
- Logs detailed info to console
- Provides troubleshooting steps

**3. Graceful Fallbacks**
- Returns empty arrays instead of crashing
- Logs warnings instead of throwing errors
- UI still renders but shows "no drives found"

---

## Expected Behavior After Fix

**Before (❌):**
```
App crashes with "Cannot read properties of undefined"
Can't navigate anywhere
Complete failure
```

**After (✅):**
```
App starts normally
Shows initial choice screen
Can navigate between screens
If electronAPI missing: shows warning banner
Graceful degradation instead of crashes
```

---

## Need More Help?

**Check these logs:**

1. **Main process console** (terminal where you ran `npm start`)
   - Look for preload script logs
   - Check for errors during startup

2. **Renderer process console** (DevTools in Electron window - press F12)
   - Look for "Electron API Debug Info"
   - Check for red error messages

3. **File existence:**
   ```bash
   # Check if preload script exists
   find . -name "preload.js" -type f
   ```

**Share these details if issue persists:**
- Output of main process console
- Output of renderer console
- Screenshot of the debug banner
- Node version: `node --version`
- Electron version from `package.json`

---

**Status:** Fixed in commit `b53610f`
**Branch:** `claude/redesign-ui-flow-016d5DoPymsHshfiEb6Grvnw`
