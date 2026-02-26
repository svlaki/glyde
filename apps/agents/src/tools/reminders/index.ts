import { createReminderTool } from './create-reminder.js';
import { updateReminderTool } from './update-reminder.js';
import { deleteReminderTool } from './delete-reminder.js';
import { listRemindersTool } from './list-reminders.js';

export { createReminderTool, updateReminderTool, deleteReminderTool, listRemindersTool };

export const reminderTools = [createReminderTool, updateReminderTool, deleteReminderTool, listRemindersTool];
