# Render Dashboard - Where to Find Important Settings

## Step-by-Step: Finding Settings in Render Dashboard

### When Creating a New Web Service (Backend)

#### 1. Basic Settings (Main Configuration Page)

After clicking **"New +" → "Web Service"** and connecting your repo:

**Location**: Main configuration page (first screen)

You'll see these fields:
- **Name**: Top field - e.g., `your-app-backend`
- **Region**: Dropdown menu - Choose closest to users
- **Branch**: Dropdown - Usually `main` or `master`
- **Root Directory**: Text field - **Leave blank** for your setup ✅

#### 2. Build & Start Settings

**Location**: Still on the main configuration page, below Basic Settings

Look for the **"Build"** section:
- **Environment**: Dropdown - Select **"Node"** ✅
- **Build Command**: Text field - Enter: `npm install` ✅
- **Start Command**: Text field - Enter: `node server/index.js` ✅

#### 3. Advanced Settings (WebSocket & More)

**Location**: Scroll down or click **"Advanced"** button/collapse section

**Look for these options:**
- ✅ **"Enable WebSocket"** - **CHECK THIS BOX!** (Critical!)
  - This is usually a checkbox or toggle switch
  - It might be labeled "Enable WebSocket Support" or "WebSocket"
  
- **Auto-Deploy**: Usually a toggle - Set to **"Yes"** ✅
  - This automatically deploys on every git push

#### 4. Environment Variables

**Location**: Scroll down to **"Environment"** or **"Environment Variables"** section
OR
Click **"Advanced"** → Look for **"Environment Variables"** section

Click **"Add Environment Variable"** button to add:
- `NODE_ENV` = `production`
- `LOG_LEVEL` = `INFO`
- `PORT` = (usually auto-set, but you can set to `10000`)

---

## Visual Guide: Render Dashboard Sections

```
Render Dashboard
│
├── Dashboard (Home)
│   └── Click "New +" button (top right)
│
├── Web Service Creation Flow:
│   │
│   ├── Step 1: Connect Repository
│   │   └── Connect GitHub/Bitbucket/GitLab
│   │
│   ├── Step 2: Basic Settings (Main Form)
│   │   ├── Name: [text field]
│   │   ├── Region: [dropdown]
│   │   ├── Branch: [dropdown]
│   │   └── Root Directory: [text field - LEAVE BLANK]
│   │
│   ├── Step 3: Build Settings (Same Page)
│   │   ├── Environment: [dropdown - SELECT "Node"]
│   │   ├── Build Command: [text field - "npm install"]
│   │   └── Start Command: [text field - "node server/index.js"]
│   │
│   ├── Step 4: Advanced Settings (Scroll Down)
│   │   ├── [ ] Enable WebSocket ← CHECK THIS! ✅
│   │   ├── Auto-Deploy: [toggle - YES]
│   │   └── Plan: [free/starter/etc]
│   │
│   └── Step 5: Environment Variables (Scroll Down)
│       ├── Add Environment Variable button
│       ├── Key: [NODE_ENV]
│       ├── Value: [production]
│       └── (Repeat for each variable)
│
└── After Creation: Service Dashboard
    ├── Settings Tab
    │   ├── General
    │   ├── Environment (can add variables here too)
    │   ├── Security
    │   └── Danger Zone
    │
    └── Logs Tab
        └── View deployment and runtime logs
```

---

## Detailed Location Guide

### 🔴 Critical Setting: Enable WebSocket (Backend Only!)

**⚠️ IMPORTANT**: WebSocket is ONLY for the **Web Service (backend)**, NOT for Static Site (frontend)!

**Where to Find:**
1. On the **Web Service creation page** (for your BACKEND)
2. Scroll down past Build Settings
3. Look for **"Advanced"** section (may be collapsed)
4. Find checkbox/toggle labeled:
   - "Enable WebSocket"
   - "WebSocket Support"
   - "WebSocket Enabled"
   - Or similar wording

**If you can't find it:**
- It might be in the **"Settings"** tab after creating the service
- Go to: Your Backend Service → **"Settings"** tab → Look for WebSocket option
- Or check: Settings → **"Advanced"** → WebSocket

**Why it's important:**
- Without this, WebSocket connections will fail
- Your real-time updates won't work
- The app will show errors in browser console

**For Frontend (Static Site):**
- ❌ **DO NOT** look for WebSocket setting on Static Site
- Static Sites are just files - they can't run WebSocket servers
- The frontend will CONNECT to the backend's WebSocket (which is enabled on the backend)

---

### ⚙️ Other Important Settings

#### Auto-Deploy
**Location**: Same "Advanced" section or main config
- Toggle or checkbox
- **Set to YES** for automatic deployments on git push

#### Health Check Path
**Location**: Advanced settings or Settings tab after creation
- Enter: `/health`
- Helps Render know if your service is healthy

#### Instance Type / Plan
**Location**: Advanced section or Plan selection
- **Free**: Good for testing (spins down after 15 min inactivity)
- **Starter**: Always-on, better for production (~$7/month)

---

## After Service is Created

### To Modify Settings Later:

1. **Go to Render Dashboard**
2. **Click on your service name** (e.g., `your-app-backend`)
3. **Click "Settings" tab** (left sidebar)
4. **You'll see:**
   - **General**: Name, Region, Branch
   - **Build & Deploy**: Build command, Start command
   - **Environment**: Environment variables (can add/edit here)
   - **Security**: Security headers, etc.
   - **Advanced**: Additional options including WebSocket

### To Add Environment Variables After Creation:

**Method 1: Settings Tab**
1. Service Dashboard → **"Settings"** tab
2. Scroll to **"Environment"** section
3. Click **"Add Environment Variable"**
4. Enter Key and Value
5. Click **"Save Changes"**
6. Service will automatically redeploy

**Method 2: Environment Tab**
1. Some Render layouts have separate **"Environment"** tab
2. Same process - Add variables and save

---

## Common Issues & Solutions

### ❌ "I can't find the WebSocket setting!"

**Solution 1**: It might only appear for certain service types
- Make sure you selected **"Web Service"** (not Static Site)
- WebSocket is only available for Web Services

**Solution 2**: Check after creation
- Create the service first
- Go to Settings → Advanced
- Look for WebSocket toggle

**Solution 3**: Contact Render support
- If you truly can't find it, it might be auto-enabled
- Or Render may have moved it to a different location

### ❌ "I set the wrong Start Command!"

**Solution**: 
1. Go to Service Dashboard
2. Settings tab → Build & Deploy section
3. Edit "Start Command"
4. Save Changes
5. Manual Deploy will trigger

### ❌ "Environment variables aren't working!"

**Solution**:
1. Verify variables start with correct prefixes
   - Backend: No prefix needed (`NODE_ENV`, `LOG_LEVEL`)
   - Frontend: Must start with `VITE_` (`VITE_API_URL`)
2. Check Settings → Environment tab
3. Make sure you clicked "Save Changes"
4. Wait for redeploy or manually deploy

---

## Quick Checklist

Before clicking **"Create Web Service"**, verify:

- [ ] **Name**: Set to something meaningful
- [ ] **Branch**: Correct branch (usually `main`)
- [ ] **Root Directory**: Left blank ✅
- [ ] **Environment**: Set to **"Node"** ✅
- [ ] **Build Command**: `npm install` ✅
- [ ] **Start Command**: `node server/index.js` ✅
- [ ] **Enable WebSocket**: **CHECKED** ✅ (CRITICAL!)
- [ ] **Auto-Deploy**: Enabled ✅
- [ ] **Environment Variables**: Added (`NODE_ENV`, `LOG_LEVEL`)
- [ ] **Plan**: Free (for testing) or Starter (for production)

---

## Pro Tips

1. **Screenshot your settings** before deploying (for reference)
2. **Check logs** after first deploy - look for any errors
3. **Test WebSocket** - Open browser console and check for connection
4. **Health check** - Visit `/health` endpoint to verify service is running
5. **Environment variables** can be changed anytime - just redeploys automatically

---

## Render UI Update Notes

Render occasionally updates their UI. If the interface looks different:
- Look for similar wording/functionality
- Settings are usually grouped logically
- "Advanced" sections often hide extra options
- If stuck, check Render documentation or support

---

## Still Can't Find Something?

1. **Check Render Docs**: [render.com/docs](https://render.com/docs)
2. **Render Support**: Dashboard → Help → Contact Support
3. **Community**: Render community forums
4. **Status Page**: Check if Render is experiencing issues

---

**Remember**: The most critical setting is **"Enable WebSocket"** - make sure it's checked! ✅
