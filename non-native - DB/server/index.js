import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import * as repository from './repository.js';
import { logger } from './logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS configuration - allow requests from frontend origin
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow requests from frontend origin or any origin in development
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://mobile-server-frontend.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ].filter(Boolean);
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      logger.warn('[SERVER] CORS blocked request from origin', { origin });
      callback(null, true); // Allow all for now, but log it
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Debug logging middleware
app.use((req, res, next) => {
  logger.debug(`[HTTP] ${req.method} ${req.path}`, { 
    body: req.body,
    query: req.query,
    params: req.params 
  });
  next();
});

// GET all properties
app.get('/api/properties', async (req, res) => {
  try {
    logger.info('[SERVER] GET /api/properties - Fetching all properties');
    const properties = await repository.getAll();
    logger.debug('[SERVER] GET /api/properties - Success', { count: properties.length });
    res.json(properties);
  } catch (error) {
    logger.error('[SERVER] GET /api/properties - Error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// GET property by ID
app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[SERVER] GET /api/properties/${id} - Fetching property`);
    const property = await repository.getById(id);
    if (!property) {
      logger.debug(`[SERVER] GET /api/properties/${id} - Not found`);
      return res.status(404).json({ error: 'Property not found' });
    }
    logger.debug(`[SERVER] GET /api/properties/${id} - Success`);
    res.json(property);
  } catch (error) {
    logger.error(`[SERVER] GET /api/properties/${req.params.id} - Error`, { error: error.message });
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// CREATE property
app.post('/api/properties', async (req, res) => {
  try {
    const propertyData = req.body;
    logger.info('[SERVER] POST /api/properties - Creating property', { property: propertyData });
    
    // Remove id if present - server manages IDs
    const { id, ...propertyWithoutId } = propertyData;
    
    const newProperty = await repository.add(propertyWithoutId);
    logger.debug('[SERVER] POST /api/properties - Success', { id: newProperty.id });
    
    // Notify WebSocket clients
    notifyClients('created', newProperty);
    
    res.status(201).json(newProperty);
  } catch (error) {
    logger.error('[SERVER] POST /api/properties - Error', { error: error.message });
    res.status(400).json({ error: 'Failed to create property', details: error.message });
  }
});

// UPDATE property
app.put('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const propertyData = req.body;
    logger.info(`[SERVER] PUT /api/properties/${id} - Updating property`, { property: propertyData });
    
    // Ensure ID matches URL
    const updatedProperty = { ...propertyData, id };
    
    const result = await repository.update(updatedProperty);
    if (!result) {
      logger.debug(`[SERVER] PUT /api/properties/${id} - Not found`);
      return res.status(404).json({ error: 'Property not found' });
    }
    
    logger.debug(`[SERVER] PUT /api/properties/${id} - Success`);
    
    // Notify WebSocket clients
    notifyClients('updated', result);
    
    res.json(result);
  } catch (error) {
    logger.error(`[SERVER] PUT /api/properties/${req.params.id} - Error`, { error: error.message });
    res.status(400).json({ error: 'Failed to update property', details: error.message });
  }
});

// DELETE property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[SERVER] DELETE /api/properties/${id} - Deleting property`);
    
    const deleted = await repository.remove(id);
    if (!deleted) {
      logger.debug(`[SERVER] DELETE /api/properties/${id} - Not found`);
      return res.status(404).json({ error: 'Property not found' });
    }
    
    logger.debug(`[SERVER] DELETE /api/properties/${id} - Success`);
    
    // Notify WebSocket clients
    notifyClients('deleted', { id });
    
    res.json({ id, deleted: true });
  } catch (error) {
    logger.error(`[SERVER] DELETE /api/properties/${req.params.id} - Error`, { error: error.message });
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Property Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      properties: '/api/properties',
      propertiesById: '/api/properties/:id'
    },
    websocket: 'ws://' + req.get('host'),
    note: 'All API endpoints are under /api prefix'
  });
});

// Redirect /properties to /api/properties for convenience
app.get('/properties', (req, res) => {
  res.redirect(301, '/api/properties');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler for undefined routes
app.use((req, res) => {
  logger.debug(`[SERVER] 404 - Route not found: ${req.method} ${req.path}`);
  
  // Check if user forgot /api prefix
  const suggestedPath = req.path.startsWith('/api') ? null : `/api${req.path}`;
  
  const response = {
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /properties (redirects to /api/properties)',
      'GET /api/properties',
      'GET /api/properties/:id',
      'POST /api/properties',
      'PUT /api/properties/:id',
      'DELETE /api/properties/:id'
    ]
  };
  
  // Add suggestion if path looks like it's missing /api prefix
  if (suggestedPath) {
    response.suggestion = `Did you mean: ${suggestedPath}?`;
    response.note = 'All API endpoints require /api prefix (except /properties which redirects)';
  }
  
  res.status(404).json(response);
});

// Create HTTP server
const server = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Store WebSocket clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  logger.info(`[SERVER] WebSocket client connected (total: ${clients.size})`);
  
  ws.on('close', () => {
    clients.delete(ws);
    logger.info(`[SERVER] WebSocket client disconnected (total: ${clients.size})`);
  });
  
  ws.on('error', (error) => {
    logger.error('[SERVER] WebSocket error', { error: error.message });
  });
});

// Notify all connected clients
function notifyClients(event, data) {
  const message = JSON.stringify({ event, data });
  logger.debug('[SERVER] Broadcasting WebSocket message', { event, dataId: data.id || data?.id });
  
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Initialize repository and start server
repository.initialize().then(() => {
  server.listen(PORT, () => {
    logger.info(`[SERVER] Server running on http://localhost:${PORT}`);
    logger.info(`[SERVER] WebSocket server ready on ws://localhost:${PORT}`);
  });
}).catch((error) => {
  logger.error('[SERVER] Failed to initialize repository', { error: error.message });
  process.exit(1);
});

