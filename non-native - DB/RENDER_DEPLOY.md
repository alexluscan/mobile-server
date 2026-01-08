# Deploy to Render - Complete Guide

You **do NOT need to split** your project! Render can deploy both frontend and backend from the same repository.

## Current Project Structure ✅

```
your-project/
├── server/              # Backend (Express + WebSocket)
│   ├── index.js
│   ├── repository.js
│   └── logger.js
├── src/                 # Frontend (React + Vite)
│   ├── App.jsx
│   ├── components/
│   └── ...
├── package.json         # Shared dependencies
├── vite.config.js
└── render.yaml          # Render config (optional)
```

**This structure works perfectly!** ✅

---

## Step-by-Step: Deploy Backend First

### 1. Create Render Account
- Go to [render.com](https://render.com)
- Sign up with GitHub (recommended)

### 2. Create Backend Web Service

1. Click **"New +"** → **"Web Service"**
2. **Connect your GitHub repository**
3. Select your repository
4. Click **"Connect"**

### 3. Configure Backend Service

**Basic Settings:**
- **Name**: `your-app-backend` (or any name you like)
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave **blank** (Render will use root)

**Build Settings:**
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server/index.js`

**Important Settings:**
- ✅ **Enable WebSocket**: Check this box! (Critical for real-time updates)
- **Auto-Deploy**: Yes (deploys on every push)

**Environment Variables** (Click "Advanced"):
```
NODE_ENV=production
LOG_LEVEL=INFO
PORT=10000
```
*(Render sets PORT automatically, but you can set it explicitly)*

### 4. Create Service
- Click **"Create Web Service"**
- Wait for deployment (3-5 minutes)
- Copy your backend URL (e.g., `https://your-app-backend.onrender.com`)

### 5. Test Backend
- Open: `https://your-app-backend.onrender.com/health`
- Should return: `{"status":"ok"}`
- Test API: `https://your-app-backend.onrender.com/api/properties`

---

## Step-by-Step: Deploy Frontend

### 1. Create Static Site Service

1. In Render dashboard, click **"New +"** → **"Static Site"**
2. **Connect the same GitHub repository** (same repo as backend!)
3. Click **"Connect"**

### 2. Configure Frontend Service

**Basic Settings:**
- **Name**: `your-app-frontend` (or any name)
- **Branch**: `main` (same as backend)

**Build Settings:**
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

**Environment Variables** (Click "Add Environment Variable"):
```
VITE_API_URL=https://your-app-backend.onrender.com/api
VITE_WS_URL=wss://your-app-backend.onrender.com
```
**⚠️ IMPORTANT**: Replace `your-app-backend.onrender.com` with your actual backend URL!

**Important Notes:**
- Use `wss://` (not `ws://`) for HTTPS/WebSocket
- These variables are only available during build time
- You'll need to redeploy after changing them

### 3. Create Static Site
- Click **"Create Static Site"**
- Wait for build and deployment (2-3 minutes)
- Your frontend will be live!

---

## Using render.yaml (Optional - Easier Setup)

Instead of configuring via UI, you can use the `render.yaml` file I created:

1. **Keep the render.yaml file** in your repo root
2. In Render dashboard, click **"New +"** → **"Blueprint"**
3. Connect your repository
4. Render will auto-detect and use `render.yaml`
5. **Update environment variables**:
   - Set `VITE_API_URL` and `VITE_WS_URL` with your backend URL

### Manual render.yaml Setup

If you want to create it manually, here's the config:

```yaml
services:
  # Backend Service
  - type: web
    name: your-app-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node server/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: INFO
    healthCheckPath: /health
    
  # Frontend Service (Static Site)
  - type: web
    name: your-app-frontend
    env: static
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    envVars:
      - key: VITE_API_URL
        sync: false  # Must set manually
      - key: VITE_WS_URL
        sync: false  # Must set manually
```

---

## Important Notes

### ✅ What Works Automatically

1. **Same Repository**: Both services can use the same GitHub repo
2. **Shared package.json**: Both services use the root `package.json`
3. **Build Commands**: Frontend builds from root, backend runs from `server/`
4. **WebSocket Support**: Render supports WebSockets on Web Services ✅

### ⚠️ Important Configuration

1. **Backend Start Command**: Must be `node server/index.js`
2. **Frontend Build Command**: Must include `npm run build`
3. **Frontend Publish Directory**: Must be `dist`
4. **Environment Variables**: Frontend vars must start with `VITE_`
5. **WebSocket URL**: Must use `wss://` for HTTPS

### 🔄 Deployment Flow

1. **Push to GitHub** → Both services auto-deploy
2. **Backend deploys** → Updates API and WebSocket server
3. **Frontend deploys** → Rebuilds with latest backend URL
4. **Both services stay in sync** automatically!

---

## Post-Deployment Checklist

### Backend Verification
- [ ] Health check works: `https://your-backend.onrender.com/health`
- [ ] API works: `https://your-backend.onrender.com/api/properties`
- [ ] WebSocket is enabled in Render settings
- [ ] Check Render logs for errors

### Frontend Verification
- [ ] Frontend loads: `https://your-frontend.onrender.com`
- [ ] Environment variables are set correctly
- [ ] API calls work (check browser console)
- [ ] WebSocket connects (check browser console)
- [ ] CRUD operations work
- [ ] Offline/online functionality works

### Testing
- [ ] Create a property → Should sync to server
- [ ] Update a property → Should update on server
- [ ] Delete a property → Should delete on server
- [ ] Open in another browser → WebSocket updates should work
- [ ] Test offline mode → Operations should queue
- [ ] Go online → Queue should sync

---

## Troubleshooting

### Backend Issues

**"Cannot find module" error:**
- Ensure `startCommand` is `node server/index.js`
- Check that `server/` directory exists
- Verify all dependencies are in root `package.json`

**WebSocket not connecting:**
- ✅ Ensure "Enable WebSocket" is checked in Render settings
- Check Render logs for WebSocket errors
- Verify using `wss://` (not `ws://`) in frontend

**Port binding errors:**
- Render sets PORT automatically (usually 10000)
- Server code uses `process.env.PORT || 3001` ✅
- This should work automatically

### Frontend Issues

**Environment variables not working:**
- Frontend vars must start with `VITE_`
- Redeploy frontend after changing env vars
- Check build logs to verify vars are loaded

**API calls failing:**
- Verify `VITE_API_URL` is set correctly
- Check CORS in backend (already configured ✅)
- Ensure backend URL includes `/api` at end

**Build fails:**
- Check build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

**"Cannot connect to server":**
- Check backend is running (health check)
- Verify `VITE_API_URL` and `VITE_WS_URL` are correct
- Check browser console for specific errors

---

## Free Tier Limits

**Render Free Tier:**
- ✅ Web Services: Free (spins down after 15 min inactivity)
- ✅ Static Sites: Free (always on)
- ⚠️ Cold starts: First request after inactivity takes 30-60 seconds
- ⚠️ WebSocket: Works but may disconnect on spin-down

**For Production:**
- Consider upgrading to paid tier for always-on backend
- Or use Railway for better free tier for backend

---

## Custom Domain (Optional)

1. In Render dashboard, click your service
2. Go to **"Settings"** → **"Custom Domain"**
3. Add your domain
4. Update DNS records as instructed
5. Render provides free SSL certificate ✅

---

## Quick Reference

### Backend Configuration
```
Type: Web Service
Environment: Node
Build: npm install
Start: node server/index.js
WebSocket: ✅ Enable
Health Check: /health
```

### Frontend Configuration
```
Type: Static Site
Build: npm install && npm run build
Publish: dist
Env Vars:
  VITE_API_URL=https://your-backend.onrender.com/api
  VITE_WS_URL=wss://your-backend.onrender.com
```

---

## Summary

✅ **No project splitting needed!**
✅ Deploy backend as Web Service
✅ Deploy frontend as Static Site
✅ Both from same repository
✅ Render handles everything automatically

**Total setup time: 10-15 minutes** 🚀

Need help? Check Render logs in dashboard or see [Render Docs](https://render.com/docs)

