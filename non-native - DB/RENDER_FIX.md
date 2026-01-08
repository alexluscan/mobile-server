# Fix: "vite: not found" Error on Render

## Problem
When deploying frontend to Render Static Site, you get:
```
sh: 1: vite: not found
==> Build failed 😞
```

## Cause
Render's Static Site deployment might not install `devDependencies` by default, and `vite` is in `devDependencies`.

## Solution

### Option 1: Update Build Command in Render Dashboard (Recommended)

1. Go to your **Static Site** service in Render
2. Click **"Settings"** tab
3. Find **"Build Command"** field
4. Change from:
   ```
   npm install && npm run build
   ```
   To one of these:
   ```
   npm install --include=dev && npm run build
   ```
   OR:
   ```
   NODE_ENV=development npm install && npm run build
   ```
   OR (if you have package-lock.json):
   ```
   npm ci && npm run build
   ```

5. Click **"Save Changes"**
6. Render will automatically redeploy

### Option 2: Use render.yaml (If Using Blueprint)

If you're using `render.yaml` for deployment, update it:

```yaml
  - type: web
    name: frontend
    env: static
    buildCommand: npm install --include=dev && npm run build
    staticPublishPath: ./dist
```

### Option 3: Move vite to dependencies (Not Recommended)

You could move `vite` from `devDependencies` to `dependencies`, but this is not ideal because:
- Vite is only needed for building, not runtime
- Increases production bundle size unnecessarily

## Why This Happens

- `vite` is a build tool, so it's correctly in `devDependencies`
- Some deployment platforms skip `devDependencies` in production mode
- Static Sites need build tools to compile the frontend
- The `--include=dev` flag ensures devDependencies are installed

## Verify Fix

After updating the build command:
1. Check Render logs - should see `vite` being used
2. Build should complete successfully
3. `dist` folder should be generated
4. Frontend should deploy

## Alternative: Use npm ci

If you have `package-lock.json` committed:
```
npm ci && npm run build
```

`npm ci` respects `package-lock.json` and installs all dependencies including devDependencies.

## Quick Fix Summary

**In Render Dashboard:**
- Static Site → Settings → Build Command
- Change to: `npm install --include=dev && npm run build`
- Save → Auto-redeploys

That's it! ✅

---

# Fix: "Cannot GET" Error on Render Static Site

## Problem
When accessing your frontend on Render, you get:
```
Cannot GET /some-route
```

Or when refreshing the page, you see "Cannot GET" error.

## Cause
This is a **client-side routing issue**. React SPAs (Single Page Applications) handle routing in the browser, but when you refresh or directly access a route, the server tries to find that file. Since it doesn't exist, you get "Cannot GET".

## Solution

### Option 1: Use Root Path Only (Temporary Fix)

For now, always access your frontend from the root URL:
```
https://your-frontend.onrender.com/
```
Not:
```
https://your-frontend.onrender.com/create  ❌
```

### Option 2: Configure Render Redirects (Recommended)

Render Static Sites support redirects. Add this configuration:

**Method A: Using `_redirects` file (if supported)**

I've already created `public/_redirects` with:
```
/*    /index.html   200
```

**Method B: Configure in Render Dashboard**

1. Go to your **Static Site** in Render
2. Click **"Settings"** tab
3. Look for **"Redirects/Rewrites"** section
4. Add redirect rule:
   - **From**: `/*`
   - **To**: `/index.html`
   - **Status**: `200` (not 301/302!)

**Method C: Use `static.json` (Render-specific)**

Create `static.json` in your project root:

```json
{
  "root": "dist",
  "routes": {
    "/*": "/index.html"
  }
}
```

### Option 3: Update Build Output

If the above don't work, Render might need the redirects in the `dist` folder. You can:

1. Copy `_redirects` to `dist` folder after build
2. Update build command to:
   ```
   npm install --include=dev && npm run build && cp public/_redirects dist/_redirects
   ```

## Which URL Are You Accessing?

**Working URLs:**
- ✅ `https://your-frontend.onrender.com/`
- ✅ `https://your-frontend.onrender.com/index.html`

**Not Working (until redirects are configured):**
- ❌ `https://your-frontend.onrender.com/create` (if you had routing)
- ❌ Any path other than root

## Current App Routing

Your app uses **state-based routing** (not URL routes), so all navigation happens in memory. This means:
- You should always access from root URL: `/`
- No need for client-side routing redirects (but good to have for future)

## Quick Test

1. Access: `https://your-frontend.onrender.com/`
2. Should load the app
3. Use the app's buttons to navigate (works fine)
4. Don't refresh on a "different page" (or configure redirects)

## Summary

**Immediate Fix:**
- Always access from root: `/`

**Proper Fix:**
- Add redirect configuration in Render (Settings → Redirects)
- Or use `static.json` in project root
- Or ensure `_redirects` file is copied to `dist` folder

The `_redirects` file I created should work, but you may need to configure it in Render's dashboard settings.
