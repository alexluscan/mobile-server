/**
 * Network status utility
 * Checks both browser network status and server connectivity
 */

import { logger } from './logger.js';

let isOnline = navigator.onLine;
let serverReachable = false;
const listeners = new Set();

// Listen for online/offline events
window.addEventListener('online', async () => {
  logger.info('[Network] Connection restored');
  isOnline = true;
  // Check server connectivity when network comes back
  await checkServerConnectivity();
  notifyListeners();
});

window.addEventListener('offline', () => {
  logger.warn('[Network] Connection lost');
  isOnline = false;
  serverReachable = false;
  notifyListeners();
});

/**
 * Check if server is actually reachable
 */
async function checkServerConnectivity() {
  if (!isOnline) {
    serverReachable = false;
    return false;
  }

  try {
    // Get base URL (with or without /api)
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    // Extract base URL without /api for health check
    const baseUrl = API_BASE_URL.replace('/api', '');
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      cache: 'no-cache',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    
    serverReachable = response.ok;
    logger.debug('[Network] Server connectivity check', { 
      reachable: serverReachable,
      status: response.status 
    });
  } catch (error) {
    serverReachable = false;
    logger.debug('[Network] Server not reachable', { error: error.message });
  }
  
  return serverReachable;
}

/**
 * Initialize server connectivity check
 */
async function initialize() {
  // Check immediately if online
  if (isOnline) {
    await checkServerConnectivity();
  }
  
  // Periodically check server connectivity while online
  setInterval(async () => {
    if (isOnline && !serverReachable) {
      await checkServerConnectivity();
      if (serverReachable) {
        notifyListeners();
      }
    }
  }, 10000); // Check every 10 seconds
}

// Initialize on load
initialize();

function notifyListeners() {
  const effectiveStatus = isOnline && serverReachable;
  listeners.forEach(callback => {
    try {
      callback(effectiveStatus);
    } catch (error) {
      logger.error('[Network] Error in status listener', { error: error.message });
    }
  });
}

/**
 * Check if network is online (browser-level)
 */
export function isNetworkOnline() {
  return isOnline && serverReachable;
}

/**
 * Check if network is online (browser-level only, ignores server status)
 */
export function isBrowserOnline() {
  return isOnline;
}

/**
 * Check if server is reachable
 */
export function isServerReachable() {
  return serverReachable;
}

/**
 * Manually check server connectivity
 */
export async function checkServer() {
  return await checkServerConnectivity();
}

export function subscribeToNetworkStatus(callback) {
  listeners.add(callback);
  // Immediately call with current status
  const effectiveStatus = isOnline && serverReachable;
  callback(effectiveStatus);
  
  return () => {
    listeners.delete(callback);
  };
}

