/**
 * Offline Queue Manager
 * Persists pending operations locally and processes them when online
 */

import { logger } from '../utils/logger.js';

const QUEUE_STORAGE_KEY = 'offline_queue';
const DB_NAME = 'OfflineQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'operations';

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('[OfflineQueue] Failed to open database', { error: request.error });
      reject(new Error(`Failed to open offline queue database: ${request.error}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
        objectStore.createIndex('operation', 'operation', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function getDB() {
  if (!dbInstance) {
    await openDB();
  }
  return dbInstance;
}

/**
 * Add an operation to the offline queue
 */
export async function enqueue(operation, data) {
  try {
    logger.debug('[OfflineQueue] Enqueuing operation', { operation, data });
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    const queueItem = {
      operation, // 'create', 'update', 'delete'
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    
    await new Promise((resolve, reject) => {
      const request = objectStore.add(queueItem);
      request.onsuccess = () => {
        logger.info('[OfflineQueue] Operation enqueued', { 
          id: request.result,
          operation 
        });
        resolve(request.result);
      };
      request.onerror = () => {
        logger.error('[OfflineQueue] Failed to enqueue operation', { 
          error: request.error 
        });
        reject(new Error(`Failed to enqueue operation: ${request.error}`));
      };
    });
  } catch (error) {
    logger.error('[OfflineQueue] Error enqueuing operation', { 
      operation, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get all pending operations
 */
export async function getAll() {
  try {
    logger.debug('[OfflineQueue] Fetching all pending operations');
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = objectStore.getAll();
      
      request.onsuccess = () => {
        const operations = request.result || [];
        logger.debug('[OfflineQueue] Fetched operations', { count: operations.length });
        resolve(operations.sort((a, b) => a.timestamp - b.timestamp));
      };
      
      request.onerror = () => {
        logger.error('[OfflineQueue] Failed to fetch operations', { 
          error: request.error 
        });
        reject(new Error(`Failed to fetch operations: ${request.error}`));
      };
    });
  } catch (error) {
    logger.error('[OfflineQueue] Error fetching operations', { error: error.message });
    throw error;
  }
}

/**
 * Remove an operation from the queue
 */
export async function dequeue(id) {
  try {
    logger.debug('[OfflineQueue] Dequeuing operation', { id });
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = objectStore.delete(id);
      
      request.onsuccess = () => {
        logger.info('[OfflineQueue] Operation dequeued', { id });
        resolve();
      };
      
      request.onerror = () => {
        logger.error('[OfflineQueue] Failed to dequeue operation', { 
          id,
          error: request.error 
        });
        reject(new Error(`Failed to dequeue operation: ${request.error}`));
      };
    });
  } catch (error) {
    logger.error('[OfflineQueue] Error dequeuing operation', { 
      id, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Update operation attempt count
 */
export async function incrementAttempts(id) {
  try {
    logger.debug('[OfflineQueue] Incrementing attempts', { id });
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const getRequest = objectStore.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          resolve();
          return;
        }
        
        item.attempts = (item.attempts || 0) + 1;
        
        const putRequest = objectStore.put(item);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (error) {
    logger.error('[OfflineQueue] Error incrementing attempts', { 
      id, 
      error: error.message 
    });
  }
}

/**
 * Clear all operations from the queue
 */
export async function clear() {
  try {
    logger.debug('[OfflineQueue] Clearing queue');
    
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    await new Promise((resolve, reject) => {
      const request = objectStore.clear();
      
      request.onsuccess = () => {
        logger.info('[OfflineQueue] Queue cleared');
        resolve();
      };
      
      request.onerror = () => {
        logger.error('[OfflineQueue] Failed to clear queue', { error: request.error });
        reject(new Error(`Failed to clear queue: ${request.error}`));
      };
    });
  } catch (error) {
    logger.error('[OfflineQueue] Error clearing queue', { error: error.message });
    throw error;
  }
}

