import { createTaskTool } from './create-task.js';
import { updateTaskTool } from './update-task.js';
import { deleteTaskTool } from './delete-task.js';
import { listTasksTool } from './list-tasks.js';
import { completeTaskTool } from './complete-task.js';

export { createTaskTool, updateTaskTool, deleteTaskTool, listTasksTool, completeTaskTool };

export const taskTools = [
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  listTasksTool,
  completeTaskTool
];
