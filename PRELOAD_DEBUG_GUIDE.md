# Preload Script Loading Debug Guide

## Issue Summary

The preload script (`src/main/preload.js`) is not loading, which means `window.electronAPI` is undefined in the renderer process. This causes the white screen error.

## What I Fixed

1. **Added Error Handling in App.jsx:**
   - Detects when `window.electronAPI` is undefined
   - Shows user-friendly error screen instead of crashing
   - Added optional chaining (`?.`) everywhere to prevent crashes

2. **Fixed React Router Basename:**
   - Dynamically detects if app is served from `/main_window/`
   - Sets correct basename for React Router
   - Fixes "No routes matched location" error

## Debugging Steps

### Step 1: Check Terminal Output

When you run `npm start`, you should see these logs in the **terminal** (main process):

```
Using webpack preload path: [some path]
Preload path: [some path]
Preload exists: true
Loading from webpack entry: [URL]
Window is ready to show!
```

**If you DON'T see these logs:**
- The webpack plugin might not be injecting constants
- Try: `rm -rf node_modules/.cache && npm start`

### Step 2: Check Browser DevTools Console

In the DevTools console (renderer process), you should see:

```
=== PRELOAD SCRIPT STARTING ===
Preload: Loaded electron dependencies
Preload: Loaded IPC channels
Preload: All dependencies loaded successfully
Preload: Exposing electronAPI to main world...
Preload: API object keys: [...]
Preload: Successfully exposed electronAPI to main world
=== PRELOAD SCRIPT COMPLETED ===
```

**If you DON'T see ANY of these logs:**
- The preload script is not loading at all
- This is the root cause of your issue

### Step 3: Check What's Actually Happening

Add this to your terminal to see more debug info:

```bash
# Stop the app if running, then:
DEBUG=* npm start
```

Or add more logging to `src/main/index.js` after line 52:

```javascript
console.log('Preload path:', preloadPath);
console.log('Preload exists:', require('fs').existsSync(preloadPath));
console.log('Preload stats:', require('fs').statSync(preloadPath));
```

## Common Causes & Solutions

### Cause 1: Webpack Cache Issues

**Solution:**
```bash
rm -rf node_modules/.cache
rm -rf .webpack
npm start
```

### Cause 2: Webpack Constants Not Injected

The preload script path should come from `MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY` constant.

**Check:** Look at the terminal output. If you see:
```
Warning: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY not defined
Using fallback preload path: ...
```

Then webpack isn't injecting the constant properly.

**Solution:**
1. Check that `@electron-forge/plugin-webpack` is installed:
   ```bash
   npm list @electron-forge/plugin-webpack
   ```

2. Verify the webpack plugin config in `package.json` lines 120-140

3. Try reinstalling:
   ```bash
   npm install --save-dev @electron-forge/plugin-webpack
   ```

### Cause 3: Preload Script Has Syntax Errors

**Check:** Look for any errors in the browser console that mention the preload script.

**Solution:** The preload script (`src/main/preload.js`) looks correct, but you can verify by running:
```bash
node -c src/main/preload.js
```

This checks for syntax errors without running it.

### Cause 4: Context Isolation Issue

**Check:** In `src/main/index.js` line 62-64, verify:
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,  // Must be true
  preload: preloadPath,
}
```

### Cause 5: Path Resolution Issues

The preload path might be wrong. Let's check:

**Add debug logging** to `src/main/index.js` around line 43:

```javascript
try {
  preloadPath = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY;
  console.log('✅ Using webpack preload path:', preloadPath);
  console.log('   Path type:', typeof preloadPath);
  console.log('   Is absolute?:', require('path').isAbsolute(preloadPath));
  console.log('   File exists?:', require('fs').existsSync(preloadPath));

  if (!require('fs').existsSync(preloadPath)) {
    console.error('❌ PRELOAD FILE DOES NOT EXIST!');
    console.error('   Looking in:', preloadPath);
    console.error('   Current dir:', __dirname);
  }
} catch (e) {
  // ... existing fallback code
}
```

## Quick Fix to Test

If nothing else works, try this temporary workaround to verify IPC works:

**In `src/renderer/index.jsx`**, add before ReactDOM.render:

```javascript
console.log('=== MANUAL API CHECK ===');
console.log('window:', typeof window);
console.log('window.electronAPI:', typeof window.electronAPI);

if (typeof window.electronAPI === 'undefined') {
  console.error('❌ electronAPI not available!');
  console.log('Checking if we can access it differently...');

  // Try accessing via electron remote (only for debugging)
  try {
    const { ipcRenderer } = window.require('electron');
    console.log('✅ Can access ipcRenderer directly (but this is insecure!)');
  } catch (e) {
    console.error('❌ Cannot access electron at all:', e.message);
  }
} else {
  console.log('✅ electronAPI is available!');
  console.log('   Methods:', Object.keys(window.electronAPI));
}
```

## What Should Happen

After the preload script loads correctly:

1. **Terminal shows:** Preload path and file exists
2. **DevTools console shows:** All preload script logs
3. **App renders:** You see the navigation bar and dashboard
4. **No errors:** Router resolves correctly to `/dashboard`

## Next Steps After Fixing

Once the preload script loads (you see the logs), the app should work! You'll see:

1. ✅ The error screen goes away
2. ✅ Navigation bar appears
3. ✅ Dashboard loads with "Connect USB Drive" message
4. ✅ All tabs are clickable

## If Still Not Working

Please provide:

1. **Full terminal output** from `npm start`
2. **Full DevTools console output** (copy all logs)
3. **Screenshot** of what you see
4. **Node and npm versions:**
   ```bash
   node --version
   npm --version
   ```

## Last Resort: Nuclear Option

If absolutely nothing works:

```bash
# Backup your code changes
git stash

# Clean everything
rm -rf node_modules
rm -rf .webpack
rm -rf node_modules/.cache
rm package-lock.json

# Fresh install
npm install

# Try again
npm start

# Restore your changes
git stash pop
```

---

**The main issue is:** The preload script isn't loading at all. Once we fix that, everything else should work!
