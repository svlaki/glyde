/**
 * Search Tools - Web search capabilities powered by Tavily
 *
 * Tools for searching the web for real-time information about:
 * - Restaurants and venues (address, hours, contact info)
 * - Locations and businesses
 * - Current events and news
 * - General factual queries
 */

export { webSearchTool } from './web-search.js';

// Export as collection for easy registration
export const searchTools = [
  (await import('./web-search.js')).webSearchTool,
];
