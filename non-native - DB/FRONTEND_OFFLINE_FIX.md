# Fix: Frontend Shows "Offline" When Backend is Running

## Problem
Frontend deployed on Render shows "⚠ Offline - Working with local data" even though backend is running.

## Common Causes

### 1. Environment Variables Not Set in Render ⚠️ MOST LIKELY

**Check:** Go to your Static Site in Render → Settings → Environment

Make sure these are set:
```
VITE_API_URL=https://mobile-server-hbae.onrender.com/api
VITE_WS_URL=wss://mobile-server-hbae.onrender.com
```

**⚠️ Important:**
- Use `https://` (not `http://`)
- Use `wss://` (not `ws://`) for WebSocket
- Include `/api` in `VITE_API_URL`
- **After adding/changing env vars, you MUST redeploy!**

### 2. Environment Variables Not Loaded at Build Time

**Issue:** Vite environment variables are only available at **build time**, not runtime.

**Solution:**
1. Make sure env vars are set in Render BEFORE building
2. After setting env vars, trigger a **Manual Deploy**:
   - Static Site → Manual Deploy → Deploy latest commit

### 3. Backend URL Incorrect

**Verify your backend URL:**
- Should be: `https://mobile-server-hbae.onrender.com`
- Test: `https://mobile-server-hbae.onrender.com/health`
- Should return: `{"status":"ok"}`

### 4. CORS Issues (Less Likely)

Backend already has `cors()` middleware, but verify:
- Backend should allow all origins (already configured)
- Check browser console for CORS errors

### 5. Health Check Timeout

The health check might be timing out. I've updated the code to:
- Increase timeout to 5 seconds
- Better error logging
- More detailed debugging

## Step-by-Step Fix

### Step 1: Verify Environment Variables in Render

1. Go to Render Dashboard
2. Click your **Static Site** (frontend)
3. Click **"Settings"** tab
4. Scroll to **"Environment Variables"** section
5. Verify these exist:
   ```
   VITE_API_URL = https://mobile-server-hbae.onrender.com/api
   VITE_WS_URL = wss://mobile-server-hbae.onrender.com
   ```

### Step 2: Test Backend is Reachable

Open in browser or use curl:
```
https://mobile-server-hbae.onrender.com/health
```

Should return: `{"status":"ok"}`

### Step 3: Redeploy Frontend

**After setting/changing environment variables:**

1. Go to Static Site dashboard
2. Click **"Manual Deploy"** tab
3. Click **"Deploy latest commit"**
4. Wait for build to complete

**Why:** Vite reads environment variables at build time, not runtime!

### Step 4: Check Browser Console

After redeploying, open your frontend in browser and:
1. Open Developer Tools (F12)
2. Go to **Console** tab
3. Look for:
   - `[Network] Server connectivity check` logs
   - Any error messages
   - Check the URL being used

### Step 5: Verify Build Logs

In Render, check your Static Site build logs:
1. Click **"Logs"** tab
2. Look for:
   - Environment variables being loaded
   - Any build errors
   - Check if `VITE_API_URL` is being used

## Debugging

### Check What URL Frontend is Using

Add this temporarily to your browser console (after page loads):
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('WS URL:', import.meta.env.VITE_WS_URL);
```

Should show:
```
API URL: https://mobile-server-hbae.onrender.com/api
WS URL: wss://mobile-server-hbae.onrender.com
```

If it shows `undefined` or `http://localhost:3001`, env vars aren't set!

### Check Network Tab

1. Open Developer Tools → **Network** tab
2. Refresh page
3. Look for requests to:
   - `/health` endpoint
   - Check if it's going to correct URL
   - Check response status

## Quick Checklist

- [ ] Environment variables set in Render Static Site settings
- [ ] `VITE_API_URL` includes `/api` at end
- [ ] Using `https://` and `wss://` (not `http://` or `ws://`)
- [ ] Backend URL is correct: `https://mobile-server-hbae.onrender.com`
- [ ] Backend `/health` endpoint works
- [ ] Frontend was redeployed AFTER setting env vars
- [ ] Browser console shows correct API URL
- [ ] No CORS errors in console
- [ ] Network tab shows health check request

## Most Common Fix

**99% of the time it's:**

1. Environment variables not set in Render
2. Frontend not redeployed after setting env vars

**Solution:**
1. Set env vars in Render Static Site settings
2. Manual Deploy → Deploy latest commit
3. Wait for build
4. Test again

## Updated Code

I've updated the network status check to:
- ✅ Longer timeout (5 seconds)
- ✅ Better error logging
- ✅ More detailed debugging info
- ✅ Handles trailing slashes correctly

After you commit and push these changes, redeploy frontend with env vars set, and it should work!
