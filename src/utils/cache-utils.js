// src/utils/cache-utils.js
/**
 * In-memory cache utility with TTL (time to live) for API responses.
 * This module provides a simple caching mechanism to reduce the number of API requests.
 */

const cache = new Map();

/**
 * Set a value in the cache with a TTL (time to live) in milliseconds.
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttl - The time to live in milliseconds.
 */
function setCache(key, value, ttl) {
  const timeout = setTimeout(() => {
    cache.delete(key);
  }, ttl);
  cache.set(key, { value, timeout });
}

/**
 * Get a value from the cache.
 * @param {string} key - The cache key.
 * @returns {any} The cached value or undefined if not found.
 */
function getCache(key) {
  const cached = cache.get(key);
  if (cached) {
    return cached.value;
  }
  return undefined;
}

/**
 * Clear the cache.
 */
function clearCache() {
  cache.forEach((cached, key) => {
    clearTimeout(cached.timeout);
    cache.delete(key);
  });
}

/**
 * Check if a key is cached.
 * @param {string} key - The cache key.
 * @returns {boolean} True if the key is cached, false otherwise.
 */
function isCached(key) {
  return cache.has(key);
}

// Example usage:
// Set a value in the cache with a TTL of 1 minute (60000 ms)
// setCache('api-response', { data: 'example' }, 60000);

// Get a value from the cache
// const cachedValue = getCache('api-response');

// Clear the cache
// clearCache();

// Check if a key is cached
// const isCachedValue = isCached('api-response');

// Export the cache utilities
export { setCache, getCache, clearCache, isCached };

// Integrate with existing files
// For example, in src/features/model-editing/model-editing.js
// import { setCache, getCache } from '../utils/cache-utils';

// In src/features/model-editing/model-editing.js
// ...
// const cachedModel = getCache(`model-${modelId}`);
// if (cachedModel) {
//   // Use the cached model
// } else {
//   // Fetch the model from the API and cache it
//   const model = await fetchModelFromAPI(modelId);
//   setCache(`model-${modelId}`, model, 60000);
// }
// ...