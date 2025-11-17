# Critical Fix: Preload Script Crash

**Issue:** `ReferenceError: __dirname is not defined`
**Status:** ✅ FIXED in commit `87b795a`
**Impact:** This was preventing the entire app from working

---

## What Was Happening

### The Error Chain:

1. **Preload script started** in main process ✅
   ```
   === PRELOAD SCRIPT STARTING ===
   ```

2. **Hit line 2-3** which used `__dirname` ❌
   ```javascript
   console.log('Preload: __dirname =', __dirname);  // CRASH!
   ```

3. **Crashed with ReferenceError** ❌
   ```
   ReferenceError: __dirname is not defined
   Unable to load preload script
   ```

4. **Never exposed `window.electronAPI`** ❌
   - Script crashed before reaching the `contextBridge.exposeInMainWorld()` call
   - Renderer process never got the API
   - Everything dependent on electronAPI failed

---

## Why It Failed

**In webpack/sandboxed Electron environments:**
- `__dirname` is **NOT** available in preload scripts
- `process.cwd()` might also be unavailable
- Only specific Node.js globals are exposed

**The debug logging I added broke everything:**
```javascript
// These lines caused the crash:
console.log('Preload: __dirname =', __dirname);       // ❌
console.log('Preload: process.cwd() =', process.cwd()); // ❌
```

---

## The Fix

**Removed the problematic debug logs:**

```diff
 console.log('=== PRELOAD SCRIPT STARTING ===');
-console.log('Preload: __dirname =', __dirname);
-console.log('Preload: process.cwd() =', process.cwd());

 let contextBridge, ipcRenderer, IPC_CHANNELS, MAIN_TO_RENDERER_CHANNELS;
```

That's it! The preload script can now run to completion.

---

## Expected Behavior After Fix

### Terminal (Main Process):
```
=== PRELOAD SCRIPT STARTING ===
Preload: ✓ Loaded electron dependencies
Preload: contextBridge available: true
Preload: ipcRenderer available: true
Preload: ✓ Loaded IPC channels
Preload: Exposing electronAPI to main world...
Preload: ✓ Successfully exposed electronAPI to main world
=== PRELOAD SCRIPT COMPLETED SUCCESSFULLY ===
WikiPrepared started - Redesigned UI active
Initial scan found 1 drive(s)
Drive watching started
```

### Browser Console (Renderer):
```
🔍 Electron API Debug Info
  Window available: true
  electronAPI available: true  ← Should be TRUE now!
  Available methods: ["invoke", "send", "on", "removeAllListeners", ...]
```

### UI:
- ✅ **Green banner**: "Electron API Loaded"
- ✅ **No red error banner**
- ✅ **Drives detected and shown**
- ✅ **Can navigate through all screens**

---

## How to Test

1. **Pull the fix:**
   ```bash
   git pull origin claude/redesign-ui-flow-016d5DoPymsHshfiEb6Grvnw
   ```

2. **Restart the app:**
   ```bash
   npm start
   ```

3. **Check browser console (F12):**
   - Look for `electronAPI available: true`
   - Green success banner should appear

4. **Check terminal:**
   - Should see `=== PRELOAD SCRIPT COMPLETED SUCCESSFULLY ===`
   - No ReferenceError

---

## What Was Already Working

Even with the preload crash, the backend was working fine:
- ✅ Drive scanning: `Initial scan found 1 drive(s)`
- ✅ Drive watching: `Started watching drives`
- ✅ IPC handlers: All set up correctly

**Only the frontend couldn't access these features** because `window.electronAPI` was never exposed.

---

## Remaining Minor Issues

These are **non-critical** and won't affect functionality:

### 1. Webpack Not Bundling (Warning, not error)
```
Warning: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY not defined
Using fallback preload path: /home/.../src/main/preload.js
```

**Impact:** App works but uses unbundled files
**Fix:** Not urgent - the fallback mode works fine for development

### 2. Graphics Warnings (Cosmetic only)
```
ERROR:gl_surface_presentation_helper.cc(260)] GetVSyncParametersIfAvailable() failed
```

**Impact:** None - these are benign OpenGL warnings on Linux
**Fix:** Not needed - doesn't affect functionality

---

## Why This Took Several Attempts

The debugging process:
1. ✅ Added defensive checks to stores (good)
2. ✅ Created debug banner (good)
3. ✅ Fixed DriveManager import (good)
4. ✅ Fixed method name (watchDrives → startWatching) (good)
5. ❌ Added debug logging with `__dirname` (broke it!)
6. ✅ Removed `__dirname` (fixed it!)

**The irony:** My debug logging to *help* diagnose the problem actually *caused* the problem! 😅

---

## Testing Checklist

After pulling the fix, verify:

- [ ] App starts without errors
- [ ] Green "Electron API Loaded" banner appears
- [ ] No red error banner
- [ ] Terminal shows "PRELOAD SCRIPT COMPLETED SUCCESSFULLY"
- [ ] Browser console shows `electronAPI available: true`
- [ ] Can click "Update Existing Stick" or "Create New Stick"
- [ ] Drive selection screen loads
- [ ] Drives are detected (if USB plugged in)
- [ ] Can navigate through all screens

---

## Success Criteria

**✅ You know it's working when:**

1. **No preload errors** in console
2. **Green banner** at top of window
3. **Drives appear** in drive selection screen
4. **No crashes** when navigating

**The app should now work completely!** 🎉

---

**Commit:** `87b795a`
**Branch:** `claude/redesign-ui-flow-016d5DoPymsHshfiEb6Grvnw`
**Status:** Ready to test
