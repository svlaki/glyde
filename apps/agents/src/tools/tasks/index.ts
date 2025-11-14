import { createTaskTool } from './create-task.js';
import { updateTaskTool } from './update-task.js';
import { deleteTaskTool } from './delete-task.js';
import { listTasksTool } from './list-tasks.js';
import { completeTaskTool } from './complete-task.js';
import { searchTasksTool } from './search-tasks.js';

export { createTaskTool, updateTaskTool, deleteTaskTool, listTasksTool, completeTaskTool, searchTasksTool };

export const taskTools = [
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  listTasksTool,
  completeTaskTool,
  searchTasksTool
];
