# Feature: Local Download Cache & Persistence

## Overview

When users download Wikipedia ZIM files locally (not directly to USB), these files should be saved in a persistent cache directory. This allows the same downloaded files to be reused when flashing multiple USB sticks without re-downloading.

## Use Case

A typical user workflow:
1. User wants to create 5 Wikipedia USB sticks for their school
2. They download 120GB of Wikipedia content once to their computer
3. They use these cached files to flash all 5 USB sticks
4. **Current problem**: Files are downloaded to temporary location and may be lost
5. **Desired behavior**: Files persist in cache and can be reused

## Benefits

- **Save bandwidth**: Large ZIM files (can be 100GB+) only downloaded once
- **Save time**: No need to re-download when creating multiple sticks
- **Offline capability**: Create sticks from cache even without internet
- **Resume support**: Interrupted downloads can be resumed
- **Storage management**: Users can see what's cached and free up space when needed

## Implementation Requirements

### 1. Persistent Cache Directory

**Location by platform:**
- **Windows**: `%APPDATA%\WikiPrepared\cache` or `%LOCALAPPDATA%\WikiPrepared\cache`
- **macOS**: `~/Library/Application Support/WikiPrepared/cache`
- **Linux**: `~/.local/share/WikiPrepared/cache` or `~/.cache/WikiPrepared`

**Main process responsibilities:**
- Create cache directory on app startup
- Provide IPC handler to get cache path: `cache:get-path`
- Ensure directory has proper permissions
- Handle disk space checks before downloading

### 2. Download Manager Updates

**Current behavior:**
```javascript
const destination = null; // Downloads to OS default downloads folder
```

**New behavior:**
```javascript
const destination = downloadStrategy === DOWNLOAD_STRATEGIES.LOCAL_FIRST
  ? await window.electronAPI.invoke('cache:get-path') // Persistent cache
  : selectedDrive?.mountpoints?.[0]?.path; // USB drive
```

**Download manager needs:**
- Track which files are already cached
- Verify file integrity with checksums (MD5/SHA256)
- Skip downloading if valid cached file exists
- Resume partial downloads

### 3. Cache Management UI

**Settings screen additions:**
- Show total cache size
- List all cached ZIM files with:
  - Filename
  - Size
  - Download date
  - Checksum status (verified/unverified)
- Actions:
  - Delete individual cached files
  - Clear entire cache
  - Set max cache size limit
  - Change cache directory location

**MainConfigScreen updates:**
- Show indicator if ZIM is already cached (green checkmark icon)
- Show "Download" vs "Copy from cache" in download screen
- Estimate time based on whether file is cached or needs download

### 4. File Transfer from Cache

**When flashing USB stick:**
1. Check if ZIM file exists in cache
2. If cached:
   - Verify checksum
   - Copy from cache to USB (fast)
   - Show "Copying from cache" instead of "Downloading"
3. If not cached:
   - Download to cache first
   - Then copy to USB

**TransferProgressScreen updates:**
- Show source: "Copying from local cache..." vs "Downloading..."
- Progress bar should reflect cache copy speed (much faster than download)

### 5. IPC Channels to Add

```javascript
// Cache management
CACHE_GET_PATH: 'cache:get-path',
CACHE_LIST_FILES: 'cache:list-files',
CACHE_GET_SIZE: 'cache:get-size',
CACHE_DELETE_FILE: 'cache:delete-file',
CACHE_CLEAR_ALL: 'cache:clear-all',
CACHE_VERIFY_FILE: 'cache:verify-file',
CACHE_SET_MAX_SIZE: 'cache:set-max-size',
CACHE_GET_SETTINGS: 'cache:get-settings',
```

### 6. Database/State Management

**Track cached files:**
```json
{
  "cachedZims": [
    {
      "filename": "wikipedia_en_all_2024-01.zim",
      "path": "/path/to/cache/wikipedia_en_all_2024-01.zim",
      "size": 95844474880,
      "downloadDate": "2024-11-17T12:34:56Z",
      "checksum": "abc123...",
      "checksumType": "sha256",
      "verified": true
    }
  ],
  "cacheSettings": {
    "maxSize": 500000000000, // 500GB
    "autoCleanOldFiles": true,
    "keepFilesForDays": 90
  }
}
```

Store in:
- JSON file: `~/.local/share/WikiPrepared/cache-index.json`
- Or SQLite database for better querying

## User Experience Flow

### First-time user (no cache):
1. Select "Download Locally"
2. Choose ZIM files
3. See message: "Files will be downloaded and saved for future use"
4. Downloads proceed to cache directory
5. After download: "Files saved! You can now flash USB sticks anytime."

### Returning user (has cache):
1. Select "Create New Stick"
2. Choose ZIM files
3. See indicators: ✓ Already downloaded (50GB) + 🔽 Need to download (20GB)
4. Estimated time based on cache hits
5. Cache files are copied (fast), new files downloaded

### Multiple USB creation:
1. User created first USB stick (files now cached)
2. Plug in second USB stick
3. Select "Create New Stick"
4. Same ZIM files selected
5. See: "Copying from cache - no download needed!"
6. USB creation completes in minutes instead of hours

## Priority & Complexity

**Priority**: High
- Major user pain point for creating multiple sticks
- Differentiates from competitors
- Saves users hours of download time

**Complexity**: Medium
- Cache directory management: Easy
- File integrity verification: Medium
- Download manager integration: Medium
- UI updates: Easy
- State management: Medium

**Estimated effort**: 2-3 days

## Related Files to Modify

1. `src/main/managers/CacheManager.js` (new)
2. `src/main/managers/DownloadManager.js` (update)
3. `src/main/ipc-handlers/cache-handlers.js` (new)
4. `src/renderer/screens/DownloadProgressScreen.jsx` (update)
5. `src/renderer/screens/MainConfigScreen.jsx` (update - show cache indicators)
6. `src/renderer/screens/SettingsScreen.jsx` (new - cache management)
7. `src/shared/ipc-channels.js` (add cache channels)
8. `src/main/preload.js` (expose cache IPC)

## Testing Checklist

- [ ] Cache directory created on first launch
- [ ] Files downloaded to cache correctly
- [ ] Checksums verified after download
- [ ] Cached files detected and shown in UI
- [ ] Copying from cache to USB works
- [ ] Resume interrupted downloads
- [ ] Delete cached files works
- [ ] Clear cache works
- [ ] Max cache size limit enforced
- [ ] Works on all platforms (Windows, macOS, Linux)

## Future Enhancements

- **Shared cache**: Multiple users on same computer share cache
- **Network cache**: School/organization has network-shared cache
- **Auto-update cache**: Periodically check for ZIM updates and prompt to update cache
- **Selective caching**: User chooses which files to keep cached vs download directly to USB
- **Cache analytics**: Show "You've saved X hours and Y GB by using cached files"
