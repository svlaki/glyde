import { createGoalTool } from './create-goal.js';
import { updateGoalTool } from './update-goal.js';
import { listGoalsTool } from './list-goals.js';
import { checkInGoalTool } from './check-in-goal.js';
import { deleteGoalTool } from './delete-goal.js';

export { createGoalTool, updateGoalTool, listGoalsTool, checkInGoalTool, deleteGoalTool };

export const goalTools = [
  createGoalTool,
  updateGoalTool,
  listGoalsTool,
  checkInGoalTool,
  deleteGoalTool
];
