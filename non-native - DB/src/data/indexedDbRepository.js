/**
 * IndexedDB Repository for Property Management
 * Integrates with server and handles offline operations
 */

import { logger } from '../utils/logger.js';
import { isNetworkOnline } from '../utils/networkStatus.js';
import * as serverRepo from '../services/serverRepository.js';
import * as offlineQueue from '../services/offlineQueue.js';

const DB_NAME = 'PropertyDB';
const DB_VERSION = 2; // Incremented to add serverId index
const STORE_NAME = 'properties';

// Observer pattern
class RepositoryObserver {
  constructor() {
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('[Repository] Error in observer callback', { error: error.message });
      }
    });
  }
}

const observer = new RepositoryObserver();

let dbInstance = null;
let propertiesCache = null;
let isInitialized = false;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      const error = new Error(`Failed to open database: ${request.error}`);
      logger.error('[Repository] Database open error', { error: error.message });
      reject(error);
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
          autoIncrement: false // Use string IDs from server
        });
        objectStore.createIndex('title', 'title', { unique: false });
        objectStore.createIndex('serverId', 'serverId', { unique: false });
      } else {
        // Upgrade existing database
        const transaction = event.target.transaction;
        const objectStore = transaction.objectStore(STORE_NAME);
        if (!objectStore.indexNames.contains('serverId')) {
          objectStore.createIndex('serverId', 'serverId', { unique: false });
        }
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

function logError(operation, error, context = {}) {
  const errorMessage = error?.message || String(error);
  logger.error(`[Repository] ${operation}`, { error: errorMessage, context });
  return errorMessage;
}

/**
 * READ: Get all properties
 * Values are retrieved only once and reused while the application is alive
 */
export async function getAll() {
  if (propertiesCache !== null && isInitialized) {
    logger.debug('[Repository] getAll - Returning cached properties', { count: propertiesCache.length });
    return [...propertiesCache];
  }

  try {
    logger.debug('[Repository] getAll - Fetching from IndexedDB');
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.getAll();

      request.onsuccess = () => {
        propertiesCache = request.result || [];
        isInitialized = true;
        logger.debug('[Repository] getAll - Success', { count: propertiesCache.length });
        resolve([...propertiesCache]);
      };

      request.onerror = () => {
        const error = new Error(`Failed to retrieve properties: ${request.error}`);
        const errorMessage = logError('getAll', error);
        reject(error);
      };
    });
  } catch (error) {
    const errorMessage = logError('getAll', error);
    throw new Error(`Error retrieving properties: ${errorMessage}`);
  }
}

export async function initialize() {
  try {
    await getAll();
  } catch (error) {
    logError('initialize', error);
    throw error;
  }
}

/**
 * CREATE: Add a new property
 * Only sends created element to server (id managed by server, user not aware of internal id)
 */
export async function add(property) {
  logger.info('[Repository] add - Creating property', { property });
  
  try {
    // Generate temporary local ID for offline support
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const propertyWithLocalId = { ...property, id: localId, serverId: null };
    
    // Save locally first
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.put(propertyWithLocalId);

      request.onsuccess = async () => {
        try {
          // Update cache
          propertiesCache = [...(propertiesCache || []), propertyWithLocalId];
          // Notify observers
          observer.notify(propertiesCache);
          
          // Try to sync with server if online
          if (isNetworkOnline()) {
            try {
              logger.debug('[Repository] add - Syncing with server', { localId });
              const serverProperty = await serverRepo.add(property);
              // Update local storage with server ID
              await updateLocalId(localId, serverProperty.id);
              logger.info('[Repository] add - Successfully synced with server', { localId, serverId: serverProperty.id });
              resolve(await getById(serverProperty.id));
            } catch (serverError) {
              logger.warn('[Repository] add - Failed to sync with server, queuing', { localId, error: serverError.message });
              // Queue for later sync
              await offlineQueue.enqueue('create', { ...property, localId });
              resolve(propertyWithLocalId);
            }
          } else {
            logger.debug('[Repository] add - Offline, queuing operation', { localId });
            // Queue for later sync
            await offlineQueue.enqueue('create', { ...property, localId });
            resolve(propertyWithLocalId);
          }
        } catch (error) {
          const errorMessage = logError('add', error, { property });
          reject(new Error(`Error after creating property: ${errorMessage}`));
        }
      };

      request.onerror = () => {
        const error = new Error(`Failed to create property: ${request.error}`);
        const errorMessage = logError('add', error, { property });
        reject(error);
      };
    });
  } catch (error) {
    const errorMessage = logError('add', error, { property });
    throw new Error(`Error creating property: ${errorMessage}`);
  }
}

/**
 * UPDATE: Update an existing property
 * Server element is reused (not deleted and recreated), ID remains the same
 */
export async function update(property) {
  if (!property || !property.id) {
    const error = new Error('Property ID is required for update');
    logError('update', error, { property });
    throw error;
  }

  logger.info('[Repository] update - Updating property', { id: property.id, property });

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const getRequest = objectStore.get(property.id);

      getRequest.onsuccess = async () => {
        if (!getRequest.result) {
          const error = new Error(`Property with ID ${property.id} not found`);
          logError('update', error, { propertyId: property.id });
          reject(error);
          return;
        }

        const updatedProperty = { ...property, serverId: getRequest.result.serverId || null };
        const putRequest = objectStore.put(updatedProperty);

        putRequest.onsuccess = async () => {
          // Update cache
          propertiesCache = (propertiesCache || []).map(p =>
            p.id === updatedProperty.id ? updatedProperty : p
          );
          // Notify observers
          observer.notify(propertiesCache);
          
          // Try to sync with server if online
          if (isNetworkOnline() && updatedProperty.serverId) {
            try {
              logger.debug('[Repository] update - Syncing with server', { id: updatedProperty.serverId });
              const serverProperty = await serverRepo.update({ ...updatedProperty, id: updatedProperty.serverId });
              logger.info('[Repository] update - Successfully synced with server', { id: updatedProperty.serverId });
              // Update local with server response
              await upsert(serverProperty);
              resolve(await getById(property.id));
            } catch (serverError) {
              logger.warn('[Repository] update - Failed to sync with server, queuing', { id: updatedProperty.serverId, error: serverError.message });
              // Queue for later sync
              await offlineQueue.enqueue('update', { ...updatedProperty, id: updatedProperty.serverId });
              resolve(updatedProperty);
            }
          } else if (!updatedProperty.serverId) {
            logger.debug('[Repository] update - Property not yet synced, will sync on create');
            resolve(updatedProperty);
          } else {
            logger.debug('[Repository] update - Offline, queuing operation', { id: updatedProperty.serverId });
            // Queue for later sync
            await offlineQueue.enqueue('update', { ...updatedProperty, id: updatedProperty.serverId });
            resolve(updatedProperty);
          }
        };

        putRequest.onerror = () => {
          const error = new Error(`Failed to update property: ${putRequest.error}`);
          const errorMessage = logError('update', error, { property });
          reject(error);
        };
      };

      getRequest.onerror = () => {
        const error = new Error(`Failed to retrieve property for update: ${getRequest.error}`);
        const errorMessage = logError('update', error, { propertyId: property.id });
        reject(error);
      };
    });
  } catch (error) {
    const errorMessage = logError('update', error, { property });
    throw new Error(`Error updating property: ${errorMessage}`);
  }
}

/**
 * DELETE: Remove a property by ID
 * Only the ID of the removed element is sent to the server
 */
export async function remove(id) {
  if (!id) {
    const error = new Error('Property ID is required for deletion');
    logError('remove', error);
    throw error;
  }

  logger.info('[Repository] remove - Deleting property', { id });

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const getRequest = objectStore.get(id);

      getRequest.onsuccess = async () => {
        if (!getRequest.result) {
          const error = new Error(`Property with ID ${id} not found`);
          logError('remove', error, { propertyId: id });
          reject(error);
          return;
        }

        const serverId = getRequest.result.serverId;
        const deleteRequest = objectStore.delete(id);

        deleteRequest.onsuccess = async () => {
          // Update cache
          propertiesCache = (propertiesCache || []).filter(p => p.id !== id);
          // Notify observers
          observer.notify(propertiesCache);
          
          // Try to sync with server if online and has serverId
          if (isNetworkOnline() && serverId) {
            try {
              logger.debug('[Repository] remove - Syncing with server', { serverId });
              await serverRepo.remove(serverId);
              logger.info('[Repository] remove - Successfully synced with server', { serverId });
              resolve(id);
            } catch (serverError) {
              logger.warn('[Repository] remove - Failed to sync with server, queuing', { serverId, error: serverError.message });
              // Queue for later sync
              await offlineQueue.enqueue('delete', { id: serverId });
              resolve(id);
            }
          } else if (serverId) {
            logger.debug('[Repository] remove - Offline, queuing operation', { serverId });
            // Queue for later sync
            await offlineQueue.enqueue('delete', { id: serverId });
            resolve(id);
          } else {
            logger.debug('[Repository] remove - Property never synced, no queue needed', { id });
            resolve(id);
          }
        };

        deleteRequest.onerror = () => {
          const error = new Error(`Failed to delete property: ${deleteRequest.error}`);
          const errorMessage = logError('remove', error, { propertyId: id });
          reject(error);
        };
      };

      getRequest.onerror = () => {
        const error = new Error(`Failed to retrieve property for deletion: ${getRequest.error}`);
        const errorMessage = logError('remove', error, { propertyId: id });
        reject(error);
      };
    });
  } catch (error) {
    const errorMessage = logError('remove', error, { propertyId: id });
    throw new Error(`Error deleting property: ${errorMessage}`);
  }
}


/**
 * Get property by ID
 */
export async function getById(id) {
  if (propertiesCache !== null && isInitialized) {
    const property = propertiesCache.find(p => p.id === id);
    if (property) return property;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = objectStore.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to get property: ${request.error}`));
    });
  } catch (error) {
    logger.error('[Repository] getById', { id, error: error.message });
    return null;
  }
}

/**
 * Update local ID to server ID mapping
 */
export async function updateLocalId(localId, serverId) {
  logger.debug('[Repository] updateLocalId', { localId, serverId });
  
  try {
    const property = await getById(localId);
    if (!property) {
      logger.warn('[Repository] updateLocalId - Property not found', { localId });
      return;
    }

    const updatedProperty = { ...property, serverId, id: serverId };
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      // Delete old entry
      const deleteRequest = objectStore.delete(localId);
      deleteRequest.onsuccess = () => {
        // Add with server ID
        const addRequest = objectStore.put(updatedProperty);
        addRequest.onsuccess = () => {
          // Update cache
          propertiesCache = (propertiesCache || []).filter(p => p.id !== localId);
          propertiesCache = [...propertiesCache, updatedProperty];
          observer.notify(propertiesCache);
          logger.info('[Repository] updateLocalId - Success', { localId, serverId });
          resolve(updatedProperty);
        };
        addRequest.onerror = () => reject(addRequest.error);
      };
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  } catch (error) {
    logger.error('[Repository] updateLocalId', { localId, serverId, error: error.message });
    throw error;
  }
}

/**
 * Upsert property (insert or update)
 */
export async function upsert(property) {
  logger.debug('[Repository] upsert', { id: property.id });
  
  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = objectStore.put(property);
      request.onsuccess = () => {
        // Update cache
        const index = (propertiesCache || []).findIndex(p => p.id === property.id);
        if (index >= 0) {
          propertiesCache[index] = property;
        } else {
          propertiesCache = [...(propertiesCache || []), property];
        }
        observer.notify(propertiesCache);
        resolve(property);
      };
      request.onerror = () => reject(new Error(`Failed to upsert property: ${request.error}`));
    });
  } catch (error) {
    logger.error('[Repository] upsert', { id: property.id, error: error.message });
    throw error;
  }
}

export function subscribe(callback) {
  return observer.subscribe(callback);
}

export function clearCache() {
  propertiesCache = null;
  isInitialized = false;
}

