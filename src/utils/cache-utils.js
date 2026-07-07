// src/utils/cache-utils.js
/**
 * In-memory cache utility with TTL (time to live) for API responses.
 * This utility helps reduce the number of API calls and improve performance.
 */

const cache = {};

/**
 * Set a value in the cache with a TTL.
 * @param {string} key - The cache key.
 * @param {any} value - The value to cache.
 * @param {number} ttl - The time to live in milliseconds.
 */
const setCache = (key, value, ttl) => {
  const currentTime = new Date().getTime();
  cache[key] = { value, expiresAt: currentTime + ttl };
};

/**
 * Get a value from the cache.
 * @param {string} key - The cache key.
 * @returns {any} The cached value or null if not found or expired.
 */
const getCache = (key) => {
  if (!cache[key]) return null;
  const currentTime = new Date().getTime();
  if (cache[key].expiresAt < currentTime) {
    delete cache[key];
    return null;
  }
  return cache[key].value;
};

/**
 * Clear the cache.
 */
const clearCache = () => {
  cache = {};
};

/**
 * Check if a key exists in the cache.
 * @param {string} key - The cache key.
 * @returns {boolean} True if the key exists in the cache, false otherwise.
 */
const hasCache = (key) => {
  return Object.keys(cache).includes(key);
};

// Example usage:
// Set a value in the cache with a TTL of 1 minute
// setCache('apiResponse', { data: 'example data' }, 60000);

// Get a value from the cache
// const cachedValue = getCache('apiResponse');

// Clear the cache
// clearCache();

// Check if a key exists in the cache
// const hasKey = hasCache('apiResponse');

// Export the cache utility functions
export { setCache, getCache, clearCache, hasCache };

// Integrate with existing files
// For example, in src/features/model-editing/model-editing.js
// import { setCache, getCache } from '../utils/cache-utils';

// const fetchModelData = async () => {
//   const cachedData = getCache('modelData');
//   if (cachedData) return cachedData;
//   const response = await fetch('/api/model-data');
//   const data = await response.json();
//   setCache('modelData', data, 30000); // Cache for 30 seconds
//   return data;
// };