# React + Vite - CRUD Project with Server Integration

This is a React + Vite application for managing rental properties with full server integration, offline support, and real-time synchronization.

## Features

- **Server Integration**: Full REST API integration with Express server
- **Real-time Updates**: WebSocket support for real-time server changes
- **Offline Support**: Local persistence with IndexedDB and offline queue
- **Auto-sync**: Automatic synchronization when connection is restored
- **Error Handling**: User-friendly error messages
- **Debug Logging**: Comprehensive logging for client and server operations

## Architecture

### Client Side
- **Repository**: `src/data/indexedDbRepository.js` - Local IndexedDB storage with server sync
- **Server Repository**: `src/services/serverRepository.js` - REST API client
- **WebSocket Client**: `src/services/websocketClient.js` - Real-time updates listener
- **Sync Service**: `src/services/syncService.js` - Handles offline/online sync
- **Offline Queue**: `src/services/offlineQueue.js` - Persists pending operations

### Server Side
- **Express Server**: `server/index.js` - REST API and WebSocket server
- **Repository**: `server/repository.js` - In-memory storage with logging
- **Logger**: `server/logger.js` - Server-side debug logging

## Requirements

- Node.js 18+ 
- npm or yarn

## Installation

```bash
npm install
```

## Running the Application

### Option 1: Run Both Server and Client Together
```bash
npm run dev:all
```

### Option 2: Run Separately

**Terminal 1 - Start the Server:**
```bash
npm run server
```
Server will run on `http://localhost:3001`

**Terminal 2 - Start the Client:**
```bash
npm run dev
```
Client will run on `http://localhost:5173` (or another port if 5173 is busy)

## API Endpoints

- `GET /api/properties` - Get all properties
- `GET /api/properties/:id` - Get property by ID
- `POST /api/properties` - Create property (server manages ID)
- `PUT /api/properties/:id` - Update property (reuses server element)
- `DELETE /api/properties/:id` - Delete property (only ID sent)

## WebSocket Events

The server broadcasts the following events:
- `created` - Property created
- `updated` - Property updated
- `deleted` - Property deleted

## Offline Behavior

- **Create while offline**: Saved locally with temporary ID, queued for sync
- **Update while offline**: Saved locally, queued for sync when online
- **Delete while offline**: Removed locally, queued for sync when online
- **Read while offline**: Displays local data with offline indicator
- **Auto-sync**: When connection is restored, all pending operations are synced

## Environment Variables

Create a `.env` file (optional):

```
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

## Debug Logging

Debug logs are enabled in development mode. To enable in production:
- Client: Set `localStorage.setItem('debug', 'true')` in browser console
- Server: Set `LOG_LEVEL=DEBUG` environment variable

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Start**: 
- Backend: Deploy to [Railway](https://railway.app) (excellent WebSocket support)
- Frontend: Deploy to [Vercel](https://vercel.com) (best React hosting)

See [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) for step-by-step instructions.

## Development

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

### Available Scripts

- `npm run dev` - Start Vite dev server
- `npm run server` - Start Express server
- `npm run dev:all` - Start both server and client concurrently
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Server Implementation Details

- Server manages property IDs (client should not provide ID on create)
- Server reuses elements on update (doesn't delete and recreate)
- All server operations have debug logs
- WebSocket server broadcasts all CRUD operations

## Client Implementation Details

- Values retrieved only once on startup and cached
- Separate repository layer for server communication
- WebSocket listener for real-time server changes
- Offline queue persists operations that survive restarts
- Friendly error messages (no raw technical messages shown to users)
- All client operations have debug logs
