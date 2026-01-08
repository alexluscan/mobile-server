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
            result = await serverRepo.remove(op.data.id);
            await offlineQueue.dequeue(op.id);
            success++;
            logger.info('[SyncService] Successfully synced delete operation', { id: op.id });
            break;

          default:
            logger.warn('[SyncService] Unknown operation type', { operation: op.operation });
            await offlineQueue.dequeue(op.id);
            break;
        }
      } catch (error) {
        failed++;
        logger.error('[SyncService] Failed to sync operation', { 
          id: op.id, 
          operation: op.operation, 
          error: error.message 
        });
        
        // If error is not network-related, remove from queue
        if (!error.message.includes('network') && !error.message.includes('fetch')) {
          await offlineQueue.dequeue(op.id);
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
    // Check if clearAll exists (it should be exported from indexedDbRepository)
    if (localRepo.clearAll && typeof localRepo.clearAll === 'function') {
      await localRepo.clearAll();
    } else {
      logger.error('[SyncService] clearAll function not available', { 
        hasClearAll: !!localRepo.clearAll,
        type: typeof localRepo.clearAll
      });
      // Fallback: manually clear by deleting each property
      const localProps = await localRepo.getAll();
      for (const prop of localProps) {
        try {
          await localRepo.remove(prop.id);
        } catch (err) {
          logger.warn('[SyncService] Error removing property during clear', { id: prop.id, error: err.message });
        }
      }
      localRepo.clearCache();
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

