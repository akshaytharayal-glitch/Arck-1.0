// src/utils/cache-utils.js
/**
 * In-memory cache utility with TTL (time to live) for API responses.
 * This utility helps reduce the number of API requests by caching frequently accessed data.
 */

const cache = {};

/**
 * Set a value in the cache with a TTL (time to live) in milliseconds.
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttl - The time to live in milliseconds.
 */
function setCache(key, value, ttl) {
  const now = Date.now();
  cache[key] = { value, expires: now + ttl };
}

/**
 * Get a value from the cache.
 * @param {string} key - The cache key.
 * @returns {any} The cached value or null if not found or expired.
 */
function getCache(key) {
  const now = Date.now();
  if (cache[key] && cache[key].expires > now) {
    return cache[key].value;
  }
  return null;
}

/**
 * Remove a value from the cache.
 * @param {string} key - The cache key.
 */
function removeCache(key) {
  delete cache[key];
}

/**
 * Clear the entire cache.
 */
function clearCache() {
  cache = {};
}

// Example usage:
// Set a value in the cache with a TTL of 1 minute (60000 ms)
// setCache('apiResponse', { data: 'example data' }, 60000);

// Get a value from the cache
// const cachedValue = getCache('apiResponse');

// Remove a value from the cache
// removeCache('apiResponse');

// Clear the entire cache
// clearCache();

// Export the cache utility functions
export { setCache, getCache, removeCache, clearCache };

// Integrate with existing files
// For example, in src/features/model-editing/model-editing.js
import { setCache, getCache } from '../utils/cache-utils';

// Cache API responses for 1 minute (60000 ms)
const cacheTtl = 60000;

// Set cache for model editing API response
setCache('modelEditingResponse', modelEditingResponse, cacheTtl);

// Get cached model editing API response
const cachedModelEditingResponse = getCache('modelEditingResponse');

// Use the cached response if available
if (cachedModelEditingResponse) {
  // Use the cached response
} else {
  // Make a new API request and cache the response
}