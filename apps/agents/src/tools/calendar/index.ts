// Calendar management tools
export { createEventTool } from './create-event.js';
export { updateEventTool } from './update-event.js';
export { deleteEventTool } from './delete-event.js';
export { deleteMultipleEventsTool } from './delete-multiple-events.js';
export { bulkUpdateEventsTool } from './bulk-update-events.js';
export { searchEventsTool } from './search-events.js';
export { listEventsTool } from './list-events.js';
export { analyzeScheduleTool } from './analyze-schedule.js';
export { createRecurringEventTool } from './create-recurring-event.js';
export { updateRecurringEventTool } from './update-recurring-event.js';
export { deleteRecurringEventTool } from './delete-recurring-event.js';

// Export all calendar tools as an array for easy registration
import { createEventTool } from './create-event.js';
import { updateEventTool } from './update-event.js';
import { deleteEventTool } from './delete-event.js';
import { deleteMultipleEventsTool } from './delete-multiple-events.js';
import { bulkUpdateEventsTool } from './bulk-update-events.js';
import { searchEventsTool } from './search-events.js';
import { listEventsTool } from './list-events.js';
import { analyzeScheduleTool } from './analyze-schedule.js';
import { createRecurringEventTool } from './create-recurring-event.js';
import { updateRecurringEventTool } from './update-recurring-event.js';
import { deleteRecurringEventTool } from './delete-recurring-event.js';

export const calendarTools = [
  createEventTool,
  updateEventTool,
  deleteEventTool,
  deleteMultipleEventsTool,
  bulkUpdateEventsTool,
  searchEventsTool,
  listEventsTool,
  analyzeScheduleTool,
  createRecurringEventTool,
  updateRecurringEventTool,
  deleteRecurringEventTool,
];