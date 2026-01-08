import React, { useState, useEffect } from "react";
import ListView from "./views/ListView";
import CreateView from "./views/CreateView";
import EditView from "./views/EditView";
import * as repo from "./data/indexedDbRepository";
import * as websocketClient from "./services/websocketClient";
import * as syncService from "./services/syncService";
import { isNetworkOnline, subscribeToNetworkStatus, checkServer, isServerReachable } from "./utils/networkStatus";
import { subscribeToSyncStatus } from "./services/syncService";
import { getFriendlyErrorMessage } from "./utils/errorMessages";
import { logger } from "./utils/logger";

export default function App() {
  const [mode, setMode] = useState("list");
  const [editItem, setEditItem] = useState(null);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, pendingOperations: 0 });

  // Load data once when the application starts
  useEffect(() => {
    let unsubscribe = null;
    let networkUnsubscribe = null;
    let syncUnsubscribe = null;
    let wsUnsubscribe = null;

    const handleWebSocketMessage = async (message) => {
      try {
        logger.debug('[App] Handling WebSocket message', { event: message.event });
        const { event, data } = message;
        
        switch (event) {
          case 'created':
            // Property created on server - update local storage
            logger.info('[App] Property created on server', { id: data.id });
            await repo.upsert(data);
            break;
            
          case 'updated':
            // Property updated on server - update local storage
            logger.info('[App] Property updated on server', { id: data.id });
            await repo.upsert(data);
            break;
            
          case 'deleted':
            // Property deleted on server - remove from local storage
            logger.info('[App] Property deleted on server', { id: data.id });
            const localProperties = await repo.getAll();
            const propertyToDelete = localProperties.find(p => p.serverId === data.id || p.id === data.id);
            if (propertyToDelete) {
              await repo.remove(propertyToDelete.id);
            }
            break;
            
          default:
            logger.warn('[App] Unknown WebSocket event', { event });
        }
      } catch (error) {
        logger.error('[App] Error handling WebSocket message', { error: error.message });
      }
    };

    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        logger.info('[App] Initializing application');
        
        // Initialize repository
        await repo.initialize();
        
        // Initialize sync service
        syncService.initialize();
        
        // Connect WebSocket
        websocketClient.connect();
        
        // Subscribe to WebSocket messages for real-time updates
        wsUnsubscribe = websocketClient.subscribe((event, data) => {
          logger.debug('[App] WebSocket event', { event, data });
          if (event === 'message' && data) {
            handleWebSocketMessage(data);
          }
        });
        
        // Wait for initial server connectivity check to complete
        await checkServer(); // Force immediate connectivity check
        
        // Wait a bit more for status to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to sync from server if reachable
        if (isServerReachable()) {
          try {
            logger.info('[App] Server reachable, syncing from server');
            await syncService.syncFromServer();
            await syncService.syncPendingOperations();
            logger.info('[App] Sync completed, reloading properties');
          } catch (syncError) {
            logger.warn('[App] Failed to sync from server, using local data', { error: syncError.message });
            // Continue with local data
          }
        } else {
          logger.info('[App] Server not reachable, using local data only');
        }
        
        // Load local data (will include synced data if sync succeeded)
        // Clear cache first to ensure fresh data
        repo.clearCache();
        const initialProperties = await repo.getAll();
        setProperties(initialProperties);
        logger.info('[App] Loaded properties', { count: initialProperties.length });

        // Subscribe to repository changes using observer
        unsubscribe = repo.subscribe((updatedProperties) => {
          logger.debug('[App] Repository changed', { count: updatedProperties.length });
          setProperties([...updatedProperties]);
        });
        
        // Subscribe to network status
        networkUnsubscribe = subscribeToNetworkStatus((online) => {
          logger.info('[App] Network status changed', { isOnline: online });
          setIsOnline(online);
        });
        
        // Subscribe to sync status
        syncUnsubscribe = subscribeToSyncStatus((status) => {
          setSyncStatus(status);
        });
        
      } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        logger.error('[App] Error initializing application', { error: err.message });
        setError(friendlyMessage);
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (networkUnsubscribe) {
        networkUnsubscribe();
      }
      if (syncUnsubscribe) {
        syncUnsubscribe();
      }
      if (wsUnsubscribe) {
        wsUnsubscribe();
      }
      websocketClient.disconnect();
    };
  }, []);

  const handlePropertyDeleted = (id) => {
    logger.debug('[App] Property deleted', { id });
  };

  const handlePropertyCreated = (newProperty) => {
    logger.debug('[App] Property created', { id: newProperty.id });
  };

  const handlePropertyUpdated = (updatedProperty) => {
    logger.debug('[App] Property updated', { id: updatedProperty.id });
  };

  if (loading) {
    return (
      <div className="app-container">
        <h1>Non-Native CRUD - Rent Properties</h1>
        <div>Loading properties...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <h1>Non-Native CRUD - Rent Properties</h1>
        <div className="error">{error}</div>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Non-Native CRUD - Rent Properties</h1>
      
      {/* Status Bar */}
      <div style={{ 
        margin: "10px 0", 
        padding: "8px", 
        borderRadius: "4px",
        backgroundColor: isOnline ? "#d4edda" : "#f8d7da",
        color: isOnline ? "#155724" : "#721c24",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <span>
          {isOnline ? "✓ Online" : "⚠ Offline - Working with local data"}
        </span>
        {syncStatus.pendingOperations > 0 && (
          <span>
            ({syncStatus.pendingOperations} pending {syncStatus.pendingOperations === 1 ? 'operation' : 'operations'})
          </span>
        )}
        {syncStatus.isSyncing && (
          <span>Syncing...</span>
        )}
      </div>

      {mode === "list" && (
        <>
          {!isOnline && (
            <div style={{ 
              margin: "10px 0", 
              padding: "10px", 
              backgroundColor: "#fff3cd", 
              color: "#856404",
              borderRadius: "4px",
              fontSize: "14px"
            }}>
              ⚠ You are currently offline. Changes will be synced when connection is restored.
            </div>
          )}
          <ListView
            properties={properties}
            goToCreate={() => setMode("create")}
            goToEdit={(prop) => {
              setEditItem(prop);
              setMode("edit");
            }}
            onPropertyDeleted={handlePropertyDeleted}
          />
        </>
      )}

      {mode === "create" && (
        <CreateView
          goBack={() => setMode("list")}
          onPropertyCreated={handlePropertyCreated}
        />
      )}

      {mode === "edit" && (
        <EditView
          property={editItem}
          goBack={() => setMode("list")}
          onPropertyUpdated={handlePropertyUpdated}
        />
      )}
    </div>
  );
}
