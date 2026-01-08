import { logger } from './logger.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = join(__dirname, 'data.json');

// In-memory storage
let properties = [];
let nextId = 1;

/**
 * Load data from file system
 */
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    properties = parsed.properties || [];
    
    // Calculate nextId from existing properties
    // Handle both numeric and string IDs
    if (properties.length > 0) {
      const ids = properties
        .map(p => {
          const id = p.id ? parseInt(p.id, 10) : 0;
          return isNaN(id) ? 0 : id;
        })
        .filter(id => id > 0);
      
      nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    } else {
      nextId = 1;
    }
    
    logger.debug('[REPOSITORY] Calculated nextId', { nextId, propertyCount: properties.length });
    
    logger.info('[REPOSITORY] Loaded data from file', { 
      count: properties.length,
      nextId 
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, start fresh
      properties = [];
      nextId = 1;
      logger.info('[REPOSITORY] No data file found, starting fresh');
      await saveData(); // Create empty file
    } else {
      logger.error('[REPOSITORY] Error loading data', { error: error.message });
      throw error;
    }
  }
}

/**
 * Save data to file system
 */
async function saveData() {
  try {
    const data = {
      properties,
      nextId,
      lastUpdated: new Date().toISOString()
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    logger.debug('[REPOSITORY] Saved data to file', { count: properties.length });
  } catch (error) {
    logger.error('[REPOSITORY] Error saving data', { error: error.message });
    // Don't throw - allow operation to continue even if save fails
  }
}

// Track initialization state
let initialized = false;

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
  
  // Persist to file
  await saveData();
  
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
  
  // Persist to file
  await saveData();
  
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
  
  // Persist to file
  await saveData();
  
  return { id };
}

/**
 * Initialize repository (load data from file)
 * Safe to call multiple times - won't reload if already initialized
 */
export async function initialize() {
  if (!initialized) {
    await loadData();
    initialized = true;
  }
  logger.info('[REPOSITORY] Repository initialized', { 
    propertiesCount: properties.length,
    nextId 
  });
}

