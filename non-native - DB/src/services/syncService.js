/**
 * Sync Service
 * Handles synchronization between local storage and server
 * Processes offline queue when online
 */

import { logger } from '../utils/logger.js';
import { isNetworkOnline, subscribeToNetworkStatus } from '../utils/networkStatus.js';
import * as serverRepo from './serverRepository.js';
import * as offlineQueue from './offlineQueue.js';
import * as localRepo from '../data/indexedDbRepository.js';

let isSyncing = false;
let syncListeners = new Set();

/**
 * Subscribe to sync status
 */
export function subscribeToSyncStatus(callback) {
  syncListeners.add(callback);
  callback({ isSyncing, pendingOperations: 0 });
  
  return () => {
    syncListeners.delete(callback);
  };
}

/**
 * Notify sync status listeners
 */
async function notifySyncStatus() {
  const pendingOps = await offlineQueue.getAll().catch(() => []);
  const status = {
    isSyncing,
    pendingOperations: pendingOps.length
  };
  
  syncListeners.forEach(callback => {
    try {
      callback(status);
    } catch (error) {
      logger.error('[SyncService] Error in sync status listener', { error: error.message });
    }
  });
}

/**
 * Sync pending operations from offline queue
 */
export async function syncPendingOperations() {
  // Check network status - wait a bit if not immediately available
  if (!isNetworkOnline()) {
    logger.debug('[SyncService] Cannot sync - offline or server unreachable');
    // Wait a moment and check again (in case server just came online)
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!isNetworkOnline()) {
      return { success: 0, failed: 0 };
    }
  }

  if (isSyncing) {
    logger.debug('[SyncService] Sync already in progress');
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  notifySyncStatus();

  try {
    logger.info('[SyncService] Starting sync of pending operations');
    const pendingOps = await offlineQueue.getAll();
    
    if (pendingOps.length === 0) {
      logger.debug('[SyncService] No pending operations to sync');
      isSyncing = false;
      notifySyncStatus();
      return { success: 0, failed: 0 };
    }

    logger.info('[SyncService] Found pending operations', { count: pendingOps.length });

    let success = 0;
    let failed = 0;

    for (const op of pendingOps) {
      try {
        // Check network status before each operation
        if (!isNetworkOnline()) {
          logger.warn('[SyncService] Network went offline during sync, stopping');
          break;
        }
        
        await offlineQueue.incrementAttempts(op.id);
        
        let result;
        switch (op.operation) {
          case 'create':
            logger.debug('[SyncService] Syncing create operation', { id: op.id, data: op.data });
            // Extract property data and remove ALL ID fields
            // Remove localId (queue metadata), id (any existing ID), and serverId (if present)
            // This ensures server generates a fresh ID based on its own max ID
            const { localId, id, serverId, ...propertyData } = op.data;
            
            logger.debug('[SyncService] Sending create to server (no ID fields)', { 
              localId,
              removedIds: { id, serverId },
              propertyData 
            });
            
            // Send to server WITHOUT any ID - server will generate new ID based on max existing ID
            result = await serverRepo.add(propertyData);
            
            logger.debug('[SyncService] Create operation synced to server', { 
              localId, 
              serverId: result.id,
              property: result
            });
            
            // Update local storage with server-assigned ID
            // IMPORTANT: This must succeed before we dequeue, otherwise item will be lost
            if (localId) {
              try {
                // Check if local item still exists before updating
                const localItem = await localRepo.getById(localId);
                if (localItem) {
                  await localRepo.updateLocalId(localId, result.id);
                  logger.info('[SyncService] Successfully updated local ID', { localId, serverId: result.id });
                } else {
                  // Local item doesn't exist, just upsert the server property
                  logger.warn('[SyncService] Local item not found, upserting server property', { localId, serverId: result.id });
                  await localRepo.upsert(result);
                }
              } catch (updateError) {
                // If updateLocalId fails, upsert the server property instead
                logger.warn('[SyncService] updateLocalId failed, upserting server property', { 
                  localId, 
                  serverId: result.id,
                  error: updateError.message
                });
                await localRepo.upsert(result);
              }
            } else {
              // No localId - just upsert the server property
              logger.debug('[SyncService] No localId, upserting server property', { serverId: result.id });
              await localRepo.upsert(result);
            }
            
            // Only dequeue after successful sync and local update
            await offlineQueue.dequeue(op.id);
            success++;
            logger.info('[SyncService] Successfully synced create operation', { id: op.id, localId, serverId: result.id });
            break;

          case 'update':
            logger.debug('[SyncService] Syncing update operation', { id: op.id, data: op.data });
            result = await serverRepo.update(op.data);
            await offlineQueue.dequeue(op.id);
            success++;
            logger.info('[SyncService] Successfully synced update operation', { id: op.id });
            break;

          case 'delete':
            logger.debug('[SyncService] Syncing delete operation', { id: op.id, data: op.data });
            try {
              result = await serverRepo.remove(op.data.id);
              // DELETE is idempotent - if property doesn't exist (404), it's already deleted
              if (result.alreadyDeleted) {
                logger.info('[SyncService] Delete operation - property already deleted on server', { id: op.id, serverId: op.data.id });
              } else {
                logger.info('[SyncService] Successfully synced delete operation', { id: op.id });
              }
              await offlineQueue.dequeue(op.id);
              success++;
            } catch (deleteError) {
              // If 404 (already deleted), treat as success
              if (deleteError.message.includes('not found') || deleteError.message.includes('404')) {
                logger.info('[SyncService] Delete operation - property not found (already deleted)', { id: op.id, serverId: op.data.id });
                await offlineQueue.dequeue(op.id);
                success++;
              } else {
                throw deleteError; // Re-throw other errors
              }
            }
            break;

          default:
            logger.warn('[SyncService] Unknown operation type', { operation: op.operation });
            await offlineQueue.dequeue(op.id);
            break;
        }
      } catch (error) {
        failed++;
        const errorMsg = error.message || '';
        const errorMsgLower = errorMsg.toLowerCase();
        
        logger.error('[SyncService] Failed to sync operation', { 
          id: op.id, 
          operation: op.operation, 
          error: errorMsg,
          status: error.status,
          errorStack: error.stack
        });
        
        // Check if error is network-related or server error (should retry)
        // The error message might be transformed by getFriendlyErrorMessage, so check for various patterns
        const isNetworkError = error.status >= 500 || // Server errors (5xx)
                               error.status === 502 || // Bad Gateway
                               error.status === 503 || // Service Unavailable
                               error.status === 504 || // Gateway Timeout
                               errorMsgLower.includes('network') || 
                               errorMsgLower.includes('fetch') ||
                               errorMsgLower.includes('failed to fetch') ||
                               errorMsgLower.includes('cors') ||
                               errorMsgLower.includes('unable to connect') ||
                               errorMsgLower.includes('connection') ||
                               errorMsgLower.includes('timeout') ||
                               !error.status; // No status usually means network error
        
        // Only remove from queue if it's NOT a network/server error (should retry)
        // Keep network/server errors in queue for retry
        if (!isNetworkError) {
          logger.warn('[SyncService] Non-network error, removing from queue', { 
            id: op.id, 
            operation: op.operation,
            error: errorMsg,
            status: error.status
          });
          await offlineQueue.dequeue(op.id);
        } else {
          logger.info('[SyncService] Network/server error, keeping in queue for retry', { 
            id: op.id, 
            operation: op.operation,
            attempts: op.attempts || 0,
            error: errorMsg,
            status: error.status
          });
        }
      }
    }

    logger.info('[SyncService] Sync completed', { success, failed, total: pendingOps.length });
    isSyncing = false;
    notifySyncStatus();
    
    return { success, failed };
  } catch (error) {
    logger.error('[SyncService] Error during sync', { error: error.message });
    isSyncing = false;
    notifySyncStatus();
    throw error;
  }
}

/**
 * Sync local data with server (initial sync)
 */
export async function syncFromServer() {
  try {
    logger.info('[SyncService] Syncing data from server');
    const serverProperties = await serverRepo.getAll();
    
    logger.info('[SyncService] Received properties from server', { count: serverProperties.length });
    
    // Get count of local properties before clearing
    const localPropertiesBefore = await localRepo.getAll();
    logger.debug('[SyncService] Local properties before sync', { count: localPropertiesBefore.length });
    
    // Clear ALL local properties first - this ensures local DB matches server exactly
    // This is important: we want local DB to reflect server state, not merge
    logger.debug('[SyncService] Clearing all local properties before server sync');
    
    try {
      // Direct IndexedDB access to clear without syncing to server
      // This avoids dependency on clearAll export which might not be available in build
      const localProps = await localRepo.getAll();
      logger.debug('[SyncService] Found local properties to clear', { count: localProps.length });
      
      if (localProps.length > 0) {
        try {
          const dbName = 'PropertyDB';
          const storeName = 'properties';
          
          // Open IndexedDB directly
          const dbRequest = indexedDB.open(dbName, 2);
          await new Promise((resolve, reject) => {
            dbRequest.onsuccess = () => {
              const db = dbRequest.result;
              const transaction = db.transaction([storeName], 'readwrite');
              const objectStore = transaction.objectStore(storeName);
              
              // Delete each property
              let deleted = 0;
              let errors = 0;
              
              for (const prop of localProps) {
                const deleteRequest = objectStore.delete(prop.id);
                deleteRequest.onsuccess = () => deleted++;
                deleteRequest.onerror = () => {
                  errors++;
                  logger.warn('[SyncService] Error deleting property during clear', { id: prop.id });
                };
              }
              
              transaction.oncomplete = () => {
                logger.info('[SyncService] Successfully cleared properties', { deleted, errors, total: localProps.length });
                resolve();
              };
              
              transaction.onerror = () => {
                logger.error('[SyncService] Transaction error during clear', { error: transaction.error });
                reject(transaction.error);
              };
            };
            
            dbRequest.onerror = () => {
              logger.error('[SyncService] Failed to open IndexedDB for clear', { error: dbRequest.error });
              reject(dbRequest.error);
            };
          });
        } catch (indexedDbError) {
          logger.warn('[SyncService] Direct IndexedDB clear failed, using remove method', { error: indexedDbError.message });
          // Last resort: use remove method (will sync to server, but that's okay since we're clearing anyway)
          for (const prop of localProps) {
            try {
              await localRepo.remove(prop.id);
            } catch (err) {
              logger.warn('[SyncService] Error removing property during clear', { id: prop.id, error: err.message });
            }
          }
        }
      }
      
      // Clear cache
      localRepo.clearCache();
      logger.info('[SyncService] Successfully cleared properties before server sync');
    } catch (clearError) {
      logger.error('[SyncService] Error clearing local properties', { error: clearError.message });
      // Continue anyway - we'll try to upsert server properties which will overwrite
    }
    
    // Now add all server properties
    logger.debug('[SyncService] Adding server properties to local storage', { count: serverProperties.length });
    for (const serverProp of serverProperties) {
      try {
        await localRepo.upsert(serverProp);
        logger.debug('[SyncService] Upserted property', { id: serverProp.id, title: serverProp.title });
      } catch (upsertError) {
        logger.error('[SyncService] Error upserting property', { 
          id: serverProp.id, 
          error: upsertError.message 
        });
      }
    }
    
    // Reload all properties after sync to ensure cache is updated
    localRepo.clearCache(); // Clear cache to force reload
    const syncedProperties = await localRepo.getAll();
    logger.info('[SyncService] Successfully synced from server', { 
      serverCount: serverProperties.length,
      localCountBefore: localPropertiesBefore.length,
      localCountAfter: syncedProperties.length
    });
    return syncedProperties;
  } catch (error) {
    logger.error('[SyncService] Error syncing from server', { error: error.message });
    throw error;
  }
}

/**
 * Initialize sync service
 * Sets up network status listener and syncs when online
 */
export function initialize() {
  logger.info('[SyncService] Initializing sync service');
  
  // Listen for network status changes
  subscribeToNetworkStatus(async (isOnline) => {
    if (isOnline) {
      logger.info('[SyncService] Network online - starting sync');
      try {
        // IMPORTANT: Sync pending operations FIRST (push local changes to server)
        // This ensures offline-created/updated/deleted items are sent before
        // we sync from server (which might clear local data)
        logger.info('[SyncService] Step 1: Syncing pending operations to server');
        const syncResult = await syncPendingOperations();
        logger.info('[SyncService] Pending operations sync result', syncResult);
        
        // Wait a moment to ensure server has processed the new items
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // THEN sync from server (pull server changes to local)
        // This ensures we have the latest server state including newly synced items
        logger.info('[SyncService] Step 2: Syncing from server to local');
        await syncFromServer();
        logger.info('[SyncService] Sync completed successfully');
      } catch (error) {
        logger.error('[SyncService] Error during auto-sync', { error: error.message, stack: error.stack });
      }
    }
  });
}

