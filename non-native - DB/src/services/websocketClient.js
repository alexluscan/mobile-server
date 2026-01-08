/**
 * WebSocket Client
 * Listens for server changes in real-time
 */

import { logger } from '../utils/logger.js';

// Determine WebSocket URL based on API URL
const getWebSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  // Convert HTTP URL to WebSocket URL
  if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://').replace('/api', '');
  } else if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://').replace('/api', '');
  }
  return import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
};

const WS_BASE_URL = getWebSocketUrl();

let ws = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;
const listeners = new Set();

/**
 * Connect to WebSocket server
 */
export function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.debug('[WebSocket] Already connected');
    return;
  }

  try {
    logger.info('[WebSocket] Connecting to server', { url: WS_BASE_URL });
    ws = new WebSocket(WS_BASE_URL);

    ws.onopen = () => {
      logger.info('[WebSocket] Connected to server');
      reconnectAttempts = 0;
      notifyListeners('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        logger.debug('[WebSocket] Received message', { event: message.event, data: message.data });
        notifyListeners('message', message);
      } catch (error) {
        logger.error('[WebSocket] Failed to parse message', { error: error.message, data: event.data });
      }
    };

    ws.onerror = (error) => {
      logger.error('[WebSocket] Connection error', { error });
      notifyListeners('error', error);
    };

    ws.onclose = () => {
      logger.warn('[WebSocket] Connection closed');
      notifyListeners('disconnected');
      
      // Attempt to reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        logger.info(`[WebSocket] Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`);
        reconnectTimeout = setTimeout(() => {
          connect();
        }, reconnectDelay);
      } else {
        logger.error('[WebSocket] Max reconnection attempts reached');
      }
    };
  } catch (error) {
    logger.error('[WebSocket] Failed to create connection', { error: error.message });
  }
}

/**
 * Disconnect from WebSocket server
 */
export function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  logger.info('[WebSocket] Disconnected from server');
}

/**
 * Subscribe to WebSocket events
 */
export function subscribe(callback) {
  listeners.add(callback);
  
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Notify all listeners
 */
function notifyListeners(event, data) {
  listeners.forEach(callback => {
    try {
      callback(event, data);
    } catch (error) {
      logger.error('[WebSocket] Error in listener callback', { error: error.message });
    }
  });
}

/**
 * Check if WebSocket is connected
 */
export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN;
}

