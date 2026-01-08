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
  if (!isNetworkOnline()) {
    logger.debug('[SyncService] Cannot sync - offline');
    return { success: 0, failed: 0 };
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
        await offlineQueue.incrementAttempts(op.id);
        
        let result;
        switch (op.operation) {
          case 'create':
            logger.debug('[SyncService] Syncing create operation', { id: op.id, data: op.data });
            // Extract property data without localId
            const { localId, ...propertyData } = op.data;
            result = await serverRepo.add(propertyData);
            // Update local storage with server-assigned ID
            if (localId) {
              await localRepo.updateLocalId(localId, result.id);
            }
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
  if (!isNetworkOnline()) {
    logger.debug('[SyncService] Cannot sync from server - offline');
    throw new Error('Cannot sync from server while offline');
  }

  try {
    logger.info('[SyncService] Syncing data from server');
    const serverProperties = await serverRepo.getAll();
    
    // Update local storage with server data
    // This is a simple merge strategy - in production, you might want conflict resolution
    for (const serverProp of serverProperties) {
      await localRepo.upsert(serverProp);
    }
    
    logger.info('[SyncService] Successfully synced from server', { count: serverProperties.length });
    return serverProperties;
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
        // First sync from server
        await syncFromServer();
        // Then sync pending operations
        await syncPendingOperations();
      } catch (error) {
        logger.error('[SyncService] Error during auto-sync', { error: error.message });
      }
    }
  });
}

