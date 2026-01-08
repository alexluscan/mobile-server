# Fix: "Cannot GET" Error on Backend

## Problem
When accessing your backend URL on Render, you get:
```
Cannot GET /
```
Or similar errors for undefined routes.

## Cause
Express returns "Cannot GET /" when you access the root URL (`/`) because there's no route handler for it. The backend only has:
- `/health` - Health check
- `/api/properties` - API endpoints

## Solution Applied ✅

I've added:

1. **Root Route Handler** (`/`)
   - Returns API information and available endpoints
   - Helpful for testing and documentation

2. **404 Handler** (Catch-all)
   - Handles any undefined routes
   - Returns a friendly JSON error with available endpoints
   - Better than Express's default "Cannot GET" message

## Available Backend Routes

After the fix, your backend has:

### Root & Health
- `GET /` - API information and endpoints list
- `GET /health` - Health check endpoint

### Properties API
- `GET /api/properties` - Get all properties
- `GET /api/properties/:id` - Get property by ID
- `POST /api/properties` - Create property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### WebSocket
- `ws://your-backend.onrender.com` or `wss://your-backend.onrender.com`

## Testing Your Backend

### Test Root Route
```bash
curl https://your-backend.onrender.com/
```
Should return:
```json
{
  "message": "Property Management API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "properties": "/api/properties",
    "propertiesById": "/api/properties/:id"
  }
}
```

### Test Health Check
```bash
curl https://your-backend.onrender.com/health
```
Should return:
```json
{
  "status": "ok"
}
```

### Test Properties API
```bash
curl https://your-backend.onrender.com/api/properties
```
Should return an array (empty or with properties).

### Test 404 Handler
```bash
curl https://your-backend.onrender.com/nonexistent
```
Should return a friendly error with available endpoints.

## Deployment

After this fix:
1. Commit and push the changes
2. Render will auto-redeploy your backend
3. Test the root URL - should work now!

## Browser Testing

You can also test in a browser:
- Visit: `https://your-backend.onrender.com/`
- Should see JSON with API information
- Visit: `https://your-backend.onrender.com/health`
- Should see: `{"status":"ok"}`

## Summary

✅ Root route (`/`) now returns API info
✅ 404 handler provides friendly error messages
✅ All routes are properly documented
✅ Backend is more user-friendly

The "Cannot GET" error is now fixed! 🎉
