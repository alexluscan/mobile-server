/**
 * Server Repository
 * Handles communication with the REST API server
 */

import { logger } from '../utils/logger.js';
import { getFriendlyErrorMessage, logError } from '../utils/errorMessages.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Make an API request
 */
async function apiRequest(method, endpoint, data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  logger.debug(`[ServerRepo] ${method} ${endpoint}`, { data });

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.details = errorData.details;
      // Preserve original error message for 404 checks
      error.originalMessage = errorData.error || error.message;
      throw error;
    }

    const result = await response.json();
    logger.debug(`[ServerRepo] ${method} ${endpoint} - Success`, { result });
    return result;
  } catch (error) {
    // Don't log 404 errors as errors in apiRequest - let the caller handle it
    if (error.status !== 404) {
      logger.error(`[ServerRepo] ${method} ${endpoint} - Error`, { 
        error: error.message,
        status: error.status 
      });
    } else {
      logger.debug(`[ServerRepo] ${method} ${endpoint} - Not found (404)`, { 
        error: error.message,
        status: error.status 
      });
    }
    throw error;
  }
}

/**
 * READ: Get all properties from server
 */
export async function getAll() {
  try {
    logger.info('[ServerRepo] getAll - Fetching all properties from server');
    const properties = await apiRequest('GET', '/properties');
    logger.info('[ServerRepo] getAll - Success', { count: properties.length });
    return properties;
  } catch (error) {
    const friendlyMessage = logError('getAll (server)', error);
    throw new Error(friendlyMessage);
  }
}

/**
 * CREATE: Create a property on the server
 * Only sends the property data without ID (server manages IDs)
 */
export async function add(propertyData) {
  try {
    // Remove ALL ID-related fields - server manages IDs and generates new ID based on max existing ID
    // Remove: id, serverId, localId (all potential ID fields)
    const { id, serverId, localId, ...propertyWithoutIds } = propertyData;
    
    logger.info('[ServerRepo] add - Creating property on server', { 
      property: propertyWithoutIds,
      removedIds: { id, serverId, localId }
    });
    const newProperty = await apiRequest('POST', '/properties', propertyWithoutIds);
    logger.info('[ServerRepo] add - Success', { id: newProperty.id });
    return newProperty;
  } catch (error) {
    const friendlyMessage = logError('add (server)', error, { property: propertyData });
    throw new Error(friendlyMessage);
  }
}

/**
 * UPDATE: Update a property on the server
 * Reuses the server element (doesn't delete and recreate)
 */
export async function update(property) {
  try {
    const { id } = property;
    if (!id) {
      throw new Error('Property ID is required for update');
    }
    
    logger.info(`[ServerRepo] update - Updating property ${id} on server`, { property });
    const updatedProperty = await apiRequest('PUT', `/properties/${id}`, property);
    logger.info(`[ServerRepo] update - Success`, { id: updatedProperty.id });
    return updatedProperty;
  } catch (error) {
    const friendlyMessage = logError('update (server)', error, { property });
    throw new Error(friendlyMessage);
  }
}

/**
 * DELETE: Delete a property from the server
 * Only sends the ID
 * DELETE is idempotent - if property doesn't exist (404), consider it successful
 */
export async function remove(id) {
  if (!id) {
    throw new Error('Property ID is required for deletion');
  }
  
  logger.info(`[ServerRepo] remove - Deleting property ${id} from server`);
  
    try {
      await apiRequest('DELETE', `/properties/${id}`);
      logger.info(`[ServerRepo] remove - Success`, { id });
      return { id };
    } catch (error) {
      // DELETE is idempotent - if property doesn't exist (404), it's already deleted
      // Check status code first (most reliable)
      if (error.status === 404) {
        logger.info(`[ServerRepo] remove - Property ${id} not found on server (already deleted)`, { 
          id,
          status: error.status
        });
        return { id, alreadyDeleted: true };
      }
      
      // Also check error message and details (in case status isn't set)
      const errorMsg = (error.message || '').toLowerCase();
      const errorDetails = (error.details || '').toLowerCase();
      const isNotFound = errorMsg.includes('not found') || 
                         errorMsg.includes('404') ||
                         errorDetails.includes('not found');
      
      if (isNotFound) {
        logger.info(`[ServerRepo] remove - Property ${id} not found on server (already deleted)`, { 
          id,
          message: error.message
        });
        return { id, alreadyDeleted: true };
      }
      
      // For other errors, log and throw friendly error
      const friendlyMessage = logError('remove (server)', error, { id });
      throw new Error(friendlyMessage);
    }
}

