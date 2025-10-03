import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserTasks(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, status, category, priority, due_before, due_after } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching tasks for user:', user_id);

    const filters: any = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    if (due_before) filters.dueBefore = due_before;
    if (due_after) filters.dueAfter = due_after;

    const tasks = await getSupabaseService().getTasks(user_id, filters);

    res.json({
      success: true,
      tasks: tasks
    });

  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
}

export async function createUserTask(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, ...taskData } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Creating task for user:', user_id);
    console.log('Task data:', taskData);

    const createdTask = await getSupabaseService().createTask(user_id, {
      title: taskData.title,
      description: taskData.description,
      category: taskData.category,
      dueDate: taskData.due_date,
      priority: taskData.priority,
      status: taskData.status,
      parentGoalId: taskData.parent_goal_id,
      color: taskData.color,
      energyRequired: taskData.energy_required,
      estimatedDuration: taskData.estimated_duration,
      contextRequired: taskData.context_required,
      recurringPattern: taskData.recurring_pattern,
      taskMetadata: taskData.task_metadata
    });

    res.json({
      success: true,
      task: createdTask
    });

  } catch (error) {
    console.error('Error creating user task:', error);
    res.status(500).json({ error: 'Failed to create user task' });
  }
}

export async function updateUserTask(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, task_id, ...updates } = req.body;

    if (!user_id || !task_id) {
      res.status(400).json({ error: 'user_id and task_id are required' });
      return;
    }

    console.log('Updating task:', task_id, 'for user:', user_id);

    const updatedTask = await getSupabaseService().updateTask(user_id, task_id, {
      title: updates.title,
      description: updates.description,
      category: updates.category,
      dueDate: updates.due_date,
      priority: updates.priority,
      status: updates.status,
      parentGoalId: updates.parent_goal_id,
      color: updates.color,
      energyRequired: updates.energy_required,
      estimatedDuration: updates.estimated_duration,
      actualDuration: updates.actual_duration,
      contextRequired: updates.context_required,
      completionNotes: updates.completion_notes,
      recurringPattern: updates.recurring_pattern,
      taskMetadata: updates.task_metadata
    });

    res.json({
      success: true,
      task: updatedTask
    });

  } catch (error) {
    console.error('Error updating user task:', error);
    res.status(500).json({ error: 'Failed to update user task' });
  }
}

export async function deleteUserTask(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, task_id } = req.body;

    if (!user_id || !task_id) {
      res.status(400).json({ error: 'user_id and task_id are required' });
      return;
    }

    console.log('Deleting task:', task_id, 'for user:', user_id);

    const result = await getSupabaseService().deleteTask(user_id, task_id);

    res.json(result);

  } catch (error) {
    console.error('Error deleting user task:', error);
    res.status(500).json({ error: 'Failed to delete user task' });
  }
}

export async function completeUserTask(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, task_id, notes, actual_duration } = req.body;

    if (!user_id || !task_id) {
      res.status(400).json({ error: 'user_id and task_id are required' });
      return;
    }

    console.log('Completing task:', task_id, 'for user:', user_id);

    const completedTask = await getSupabaseService().completeTask(user_id, task_id, notes, actual_duration);

    res.json({
      success: true,
      task: completedTask
    });

  } catch (error) {
    console.error('Error completing user task:', error);
    res.status(500).json({ error: 'Failed to complete user task' });
  }
}
