# Fix: Backend Data Not Persisting on Render

## Problem
Backend data is lost after server restart/redeploy. The `data.json` file is not persisting.

## Cause
Render's filesystem on free tier can be **ephemeral** - files may be wiped on restarts or redeploys. The `data.json` file needs to be stored in a persistent location or we need to use a database.

## Solutions

### Option 1: Use Render Disk Storage (Recommended for Production)
Render offers persistent disk storage that survives restarts.

**Steps:**
1. Go to your Web Service in Render
2. Settings → Add Disk
3. Mount path: `/data` (or any path you choose)
4. Update `DATA_FILE` path to use the mounted disk

**Update server/repository.js:**
```javascript
// Use persistent disk if available, fallback to local directory
const PERSISTENT_DISK = process.env.RENDER_DISK_PATH || null;
const DATA_FILE = PERSISTENT_DISK 
  ? join(PERSISTENT_DISK, 'data.json')
  : join(__dirname, 'data.json');
```

### Option 2: Use External Database (Best for Production)
Use a real database like PostgreSQL, MongoDB, or SQLite.

### Option 3: Accept Ephemeral Storage (For Development/Testing)
For now, accept that data resets on redeploy but persists during the same session.

**Note:** On Render free tier, services can spin down after 15 minutes of inactivity, and data may be lost.

## Current Status

The code now:
- ✅ Saves to `data.json` after every operation
- ✅ Loads from `data.json` on startup
- ✅ Handles file not found gracefully
- ✅ Calculates nextId correctly from existing data

**However**, on Render's ephemeral filesystem, data may still be lost on redeploys.

## Quick Test

To verify backend is working:
1. Create a property via API
2. Check backend logs for "Saved data to file"
3. Check if `data.json` exists (won't persist on Render free tier)
4. Restart server - data should persist if filesystem is persistent

## Recommendation

For production, use **Option 1 (Persistent Disk)** or **Option 2 (Database)**.

For development/testing, the current implementation is fine - just know data resets on redeploy.
