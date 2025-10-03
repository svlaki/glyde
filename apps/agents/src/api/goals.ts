import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserGoals(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, status, category, goal_type, target_before, target_after } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching goals for user:', user_id);

    const filters: any = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (goal_type) filters.goalType = goal_type;
    if (target_before) filters.targetBefore = target_before;
    if (target_after) filters.targetAfter = target_after;

    const goals = await getSupabaseService().getGoals(user_id, filters);

    res.json({
      success: true,
      goals: goals
    });

  } catch (error) {
    console.error('Error fetching user goals:', error);
    res.status(500).json({ error: 'Failed to fetch user goals' });
  }
}

export async function createUserGoal(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, ...goalData } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Creating goal for user:', user_id);
    console.log('Goal data:', goalData);

    const createdGoal = await getSupabaseService().createGoal(user_id, {
      title: goalData.title,
      description: goalData.description,
      category: goalData.category,
      targetDate: goalData.target_date,
      status: goalData.status,
      progress: goalData.progress,
      milestones: goalData.milestones,
      goalType: goalData.goal_type,
      parentGoalId: goalData.parent_goal_id,
      keyResults: goalData.key_results,
      blockers: goalData.blockers,
      resourcesNeeded: goalData.resources_needed,
      reflectionPrompts: goalData.reflection_prompts,
      priorityScore: goalData.priority_score,
      energyRequirement: goalData.energy_requirement,
      reviewFrequency: goalData.review_frequency
    });

    res.json({
      success: true,
      goal: createdGoal
    });

  } catch (error) {
    console.error('Error creating user goal:', error);
    res.status(500).json({ error: 'Failed to create user goal' });
  }
}

export async function updateUserGoal(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, goal_id, ...updates } = req.body;

    if (!user_id || !goal_id) {
      res.status(400).json({ error: 'user_id and goal_id are required' });
      return;
    }

    console.log('Updating goal:', goal_id, 'for user:', user_id);

    const updatedGoal = await getSupabaseService().updateGoal(user_id, goal_id, {
      title: updates.title,
      description: updates.description,
      category: updates.category,
      targetDate: updates.target_date,
      status: updates.status,
      progress: updates.progress,
      milestones: updates.milestones,
      goalType: updates.goal_type,
      parentGoalId: updates.parent_goal_id,
      keyResults: updates.key_results,
      blockers: updates.blockers,
      resourcesNeeded: updates.resources_needed,
      reflectionPrompts: updates.reflection_prompts,
      priorityScore: updates.priority_score,
      energyRequirement: updates.energy_requirement,
      reviewFrequency: updates.review_frequency
    });

    res.json({
      success: true,
      goal: updatedGoal
    });

  } catch (error) {
    console.error('Error updating user goal:', error);
    res.status(500).json({ error: 'Failed to update user goal' });
  }
}

export async function deleteUserGoal(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, goal_id } = req.body;

    if (!user_id || !goal_id) {
      res.status(400).json({ error: 'user_id and goal_id are required' });
      return;
    }

    console.log('Deleting goal:', goal_id, 'for user:', user_id);

    const result = await getSupabaseService().deleteGoal(user_id, goal_id);

    res.json(result);

  } catch (error) {
    console.error('Error deleting user goal:', error);
    res.status(500).json({ error: 'Failed to delete user goal' });
  }
}

export async function addGoalCheckIn(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, goal_id, ...checkInData } = req.body;

    if (!user_id || !goal_id) {
      res.status(400).json({ error: 'user_id and goal_id are required' });
      return;
    }

    console.log('Adding check-in for goal:', goal_id);

    const checkIn = await getSupabaseService().addGoalCheckIn(user_id, goal_id, {
      progressUpdate: checkInData.progress_update,
      moodRating: checkInData.mood_rating,
      confidenceLevel: checkInData.confidence_level,
      obstaclesEncountered: checkInData.obstacles_encountered,
      winsAndProgress: checkInData.wins_and_progress,
      nextSteps: checkInData.next_steps,
      reflectionNotes: checkInData.reflection_notes,
      agentInsights: checkInData.agent_insights
    });

    res.json({
      success: true,
      checkIn: checkIn
    });

  } catch (error) {
    console.error('Error adding goal check-in:', error);
    res.status(500).json({ error: 'Failed to add goal check-in' });
  }
}

export async function getGoalCheckIns(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, goal_id, limit } = req.body;

    if (!user_id || !goal_id) {
      res.status(400).json({ error: 'user_id and goal_id are required' });
      return;
    }

    console.log('Fetching check-ins for goal:', goal_id);

    const checkIns = await getSupabaseService().getGoalCheckIns(user_id, goal_id, limit);

    res.json({
      success: true,
      checkIns: checkIns
    });

  } catch (error) {
    console.error('Error fetching goal check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch goal check-ins' });
  }
}
