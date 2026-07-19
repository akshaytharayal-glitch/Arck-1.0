/**
 * Cache utility module for storing and retrieving API responses with a time-to-live (TTL).
 * @module cache-utils
 */

const cache = new Map();

/**
 * Set a value in the cache with a TTL.
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttl - The time-to-live in milliseconds.
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
 * @returns {any} The cached value, or undefined if not found.
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
 * Check if a key is in the cache.
 * @param {string} key - The cache key.
 * @returns {boolean} True if the key is in the cache, false otherwise.
 */
function hasCache(key) {
  return cache.has(key);
}

/**
 * Get the cache size.
 * @returns {number} The number of items in the cache.
 */
function getCacheSize() {
  return cache.size;
}

// Example usage:
// Set a value in the cache with a 1-minute TTL
// setCache('api-response', { data: 'example' }, 60000);

// Get a value from the cache
// const cachedValue = getCache('api-response');

// Clear the cache
// clearCache();

// Check if a key is in the cache
// const hasKey = hasCache('api-response');

// Get the cache size
// const cacheSize = getCacheSize();

// Export the cache utility functions
export { setCache, getCache, clearCache, hasCache, getCacheSize };

// Integrate with existing files
// In src/features/model-editing/model-editing.js:
// import { setCache, getCache } from '../utils/cache-utils';
// ...
// setCache('model-editing-response', response, 30000);
// const cachedResponse = getCache('model-editing-response');

// In src/features/model-library/model-library.js:
// import { clearCache } from '../utils/cache-utils';
// ...
// clearCache();

// In src/features/furniture-library/furniture-library.js:
// import { hasCache } from '../utils/cache-utils';
// ...
// const hasFurnitureCache = hasCache('furniture-library-response');

// In src/features/model-upload/model-upload.js:
// import { getCacheSize } from '../utils/cache-utils';
// ...
// const cacheSize = getCacheSize();