import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserTasks(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, category, priority, due_before, due_after } = req.body;

    console.log('Fetching tasks for user:', userId);

    const filters: any = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    if (due_before) filters.dueBefore = due_before;
    if (due_after) filters.dueAfter = due_after;

    const tasks = await getSupabaseService().getTasks(userId, filters);

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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { user_id: _ignoredUserId, ...taskData } = req.body ?? {};

    console.log('Creating task for user:', userId);
    console.log('Task data:', taskData);

    const createdTask = await getSupabaseService().createTask(userId, {
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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { task_id, ...updates } = req.body ?? {};

    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' });
      return;
    }

    console.log('Updating task:', task_id, 'for user:', userId);

    const updatedTask = await getSupabaseService().updateTask(userId, task_id, {
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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { task_id } = req.body ?? {};

    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' });
      return;
    }

    console.log('Deleting task:', task_id, 'for user:', userId);

    const result = await getSupabaseService().deleteTask(userId, task_id);

    res.json(result);

  } catch (error) {
    console.error('Error deleting user task:', error);
    res.status(500).json({ error: 'Failed to delete user task' });
  }
}

export async function completeUserTask(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { task_id, notes, actual_duration } = req.body ?? {};

    if (!task_id) {
      res.status(400).json({ error: 'task_id is required' });
      return;
    }

    console.log('Completing task:', task_id, 'for user:', userId);

    const completedTask = await getSupabaseService().completeTask(userId, task_id, notes, actual_duration);

    res.json({
      success: true,
      task: completedTask
    });

  } catch (error) {
    console.error('Error completing user task:', error);
    res.status(500).json({ error: 'Failed to complete user task' });
  }
}
