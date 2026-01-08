import { logger } from './logger.js';

// In-memory storage
let properties = [];
let nextId = 1;

/**
 * READ: Get all properties
 */
export async function getAll() {
  logger.debug('[REPOSITORY] getAll - Fetching all properties');
  return [...properties];
}

/**
 * READ: Get property by ID
 */
export async function getById(id) {
  logger.debug(`[REPOSITORY] getById - Fetching property ${id}`);
  const property = properties.find(p => p.id === id);
  if (property) {
    logger.debug(`[REPOSITORY] getById - Found property ${id}`);
  } else {
    logger.debug(`[REPOSITORY] getById - Property ${id} not found`);
  }
  return property || null;
}

/**
 * CREATE: Add a new property
 * Server manages IDs - user should not provide id
 */
export async function add(propertyData) {
  logger.info('[REPOSITORY] add - Creating new property', { propertyData });
  
  const newProperty = {
    ...propertyData,
    id: String(nextId++)
  };
  
  properties.push(newProperty);
  logger.info(`[REPOSITORY] add - Created property with ID ${newProperty.id}`, { property: newProperty });
  
  return newProperty;
}

/**
 * UPDATE: Update an existing property
 * Reuses the element (doesn't delete and recreate)
 */
export async function update(property) {
  const { id } = property;
  logger.info(`[REPOSITORY] update - Updating property ${id}`, { property });
  
  if (!id) {
    const error = new Error('Property ID is required for update');
    logger.error('[REPOSITORY] update - Missing ID');
    throw error;
  }
  
  const index = properties.findIndex(p => p.id === id);
  if (index === -1) {
    logger.warn(`[REPOSITORY] update - Property ${id} not found`);
    return null;
  }
  
  // Reuse the element - update in place
  properties[index] = { ...property };
  logger.info(`[REPOSITORY] update - Updated property ${id}`, { property: properties[index] });
  
  return properties[index];
}

/**
 * DELETE: Remove a property by ID
 */
export async function remove(id) {
  logger.info(`[REPOSITORY] remove - Deleting property ${id}`);
  
  if (!id) {
    const error = new Error('Property ID is required for deletion');
    logger.error('[REPOSITORY] remove - Missing ID');
    throw error;
  }
  
  const index = properties.findIndex(p => p.id === id);
  if (index === -1) {
    logger.warn(`[REPOSITORY] remove - Property ${id} not found`);
    return null;
  }
  
  properties.splice(index, 1);
  logger.info(`[REPOSITORY] remove - Deleted property ${id}`);
  
  return { id };
}

