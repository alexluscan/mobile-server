# Quick Deployment Guide

## 🚀 Recommended: Railway (Backend) + Vercel (Frontend)

### Step 1: Deploy Backend to Railway (5 minutes)

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Railway auto-detects Node.js
5. Click **"Settings"** → **"Deploy"**:
   - **Start Command**: `node server/index.js` (or use `npm start` which we added)
   - **Root Directory**: Leave blank (or `server` if needed)
6. Deploy automatically happens!
7. Copy your backend URL (e.g., `https://your-app.railway.app`)

### Step 2: Deploy Frontend to Vercel (5 minutes)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New Project"** → Import your repository
3. Configure:
   - **Framework Preset**: Vite (auto-detected)
   - **Build Command**: `npm run build` (auto-set)
   - **Output Directory**: `dist` (auto-set)
4. Add Environment Variables:
   - `VITE_API_URL` = `https://your-backend.railway.app/api`
   - `VITE_WS_URL` = `wss://your-backend.railway.app`
   - Replace with your Railway backend URL!
5. Click **"Deploy"**
6. Done! Your app is live 🎉

### Test Your Deployment

1. **Backend Health Check**: `https://your-backend.railway.app/health`
2. **Backend API**: `https://your-backend.railway.app/api/properties`
3. **Frontend**: `https://your-app.vercel.app`

---

## 🎯 Render (All-in-One) - No Project Splitting Required! ✅

**Your current structure works perfectly!** Both backend and frontend deploy from the same repository.

### Deploy Backend to Render

1. Go to [render.com](https://render.com) → Sign up with GitHub
2. **New +** → **Web Service** → Connect your GitHub repo (same repo for both!)
3. Configure:
   - **Name**: `your-app-backend`
   - **Branch**: `main`
   - **Root Directory**: Leave blank (uses root of repo) ✅
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js` ✅
   - **Enable WebSocket** ✅ (IMPORTANT! Check this box!)
   - **Auto-Deploy**: Yes
4. Add env vars (Advanced → Add Environment Variable):
   - `NODE_ENV=production`
   - `LOG_LEVEL=INFO`
5. Create Web Service → Wait 3-5 min → Copy URL

### Deploy Frontend to Render

1. In Render dashboard, **New +** → **Static Site** → Connect **same GitHub repo**
2. Configure:
   - **Name**: `your-app-frontend`
   - **Branch**: `main` (same as backend)
   - **Root Directory**: Leave blank ✅
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist` ✅
3. Add env vars (Add Environment Variable):
   - `VITE_API_URL=https://your-app-backend.onrender.com/api`
   - `VITE_WS_URL=wss://your-app-backend.onrender.com`
   - ⚠️ Replace `your-app-backend` with your actual backend name!
4. Create Static Site → Wait 2-3 min → Done!

**See [RENDER_DEPLOY.md](./RENDER_DEPLOY.md) for detailed step-by-step instructions.**

---

## ⚙️ Environment Variables

### Backend (Railway/Render)
```
NODE_ENV=production
LOG_LEVEL=INFO
PORT (auto-set by service)
```

### Frontend (Vercel/Render)
```
VITE_API_URL=https://your-backend.railway.app/api
VITE_WS_URL=wss://your-backend.railway.app
```

**Important**: 
- Replace `your-backend.railway.app` with your actual backend URL
- Use `wss://` (not `ws://`) for HTTPS
- Restart deployment after adding env vars

---

## 📋 Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend environment variables set correctly
- [ ] Test API endpoint: `/api/properties`
- [ ] Test WebSocket connection
- [ ] Test CRUD operations
- [ ] Check browser console for errors
- [ ] Test offline/online functionality

---

## 🆘 Troubleshooting

**WebSocket not connecting?**
- Ensure backend supports WebSockets (Railway ✅, Render ✅)
- Use `wss://` for HTTPS sites
- Check CORS settings (already configured ✅)

**CORS errors?**
- Backend has `cors()` middleware ✅
- Check if frontend URL is whitelisted (currently allows all)

**Build failing?**
- Check build logs in service dashboard
- Ensure all dependencies in `package.json`
- Verify Node.js version compatibility

**Environment variables not working?**
- Restart deployment after adding vars
- Frontend vars must start with `VITE_`
- Check build logs to verify vars are loaded

---

## 💰 Cost Comparison

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **Railway** | $5 credit/month | Backend (WebSocket support) |
| **Vercel** | Free (generous) | Frontend (best performance) |
| **Render** | Free (with limits) | Both (simpler setup) |

**Recommendation**: Start with Railway + Vercel for best performance and features!

---

## 📚 Full Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions and more deployment options.

