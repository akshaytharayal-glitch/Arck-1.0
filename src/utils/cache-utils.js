/**
 * Cache utility module for storing and retrieving API responses with a time-to-live (TTL)
 * @module cache-utils
 */

const cache = new Map();

/**
 * Set a value in the cache with a TTL
 * @param {string} key - The cache key
 * @param {any} value - The value to store
 * @param {number} ttl - The time-to-live in milliseconds
 */
function setCache(key, value, ttl) {
  const expiration = Date.now() + ttl;
  cache.set(key, { value, expiration });
}

/**
 * Get a value from the cache
 * @param {string} key - The cache key
 * @returns {any} The cached value or undefined if not found or expired
 */
function getCache(key) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expiration < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return cached.value;
}

/**
 * Clear the cache
 */
function clearCache() {
  cache.clear();
}

/**
 * Check if a key is in the cache
 * @param {string} key - The cache key
 * @returns {boolean} True if the key is in the cache, false otherwise
 */
function hasCache(key) {
  return cache.has(key);
}

/**
 * Get the expiration time of a cached value
 * @param {string} key - The cache key
 * @returns {number} The expiration time in milliseconds or -1 if not found
 */
function getCacheExpiration(key) {
  const cached = cache.get(key);
  if (!cached) return -1;
  return cached.expiration;
}

// Example usage:
// Set a value in the cache with a 1 minute TTL
// setCache('apiResponse', { data: 'example' }, 60000);

// Get the cached value
// const cachedValue = getCache('apiResponse');

// Clear the cache
// clearCache();

// Check if a key is in the cache
// const hasKey = hasCache('apiResponse');

// Get the expiration time of a cached value
// const expiration = getCacheExpiration('apiResponse');

// Export the cache utility functions
export { setCache, getCache, clearCache, hasCache, getCacheExpiration };

// Integrate with existing files
// In src/features/model-editing/model-editing.js
import { setCache, getCache } from '../utils/cache-utils';

// Use the cache to store and retrieve API responses
// setCache('modelData', modelData, 30000);
// const cachedModelData = getCache('modelData');

// In src/features/model-library/model-library.js
import { clearCache } from '../utils/cache-utils';

// Clear the cache when the user logs out
// clearCache();