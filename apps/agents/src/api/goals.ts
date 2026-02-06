import { Request, Response } from 'express';
import { getSupabaseService } from '../services/SupabaseService.js';

export async function getUserGoals(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, aspect, goal_type, target_before, target_after } = req.body;

    console.log('Fetching goals for user:', userId);

    const filters: any = {};
    if (status) filters.status = status;
    if (aspect) filters.aspect = aspect;
    if (goal_type) filters.goalType = goal_type;
    if (target_before) filters.targetBefore = target_before;
    if (target_after) filters.targetAfter = target_after;

    const goals = await getSupabaseService().getGoals(userId, filters);

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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { user_id: _ignoredUserId, ...goalData } = req.body ?? {};

    console.log('Creating goal for user:', userId);
    console.log('Goal data:', goalData);

    const createdGoal = await getSupabaseService().createGoal(userId, {
      title: goalData.title,
      description: goalData.description,
      aspect: goalData.aspect,
      targetDate: goalData.target_date,
      status: goalData.status,
      progress: goalData.progress,
      milestones: goalData.milestones,
      milestoneType: goalData.milestone_type,
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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { goal_id, ...updates } = req.body ?? {};

    if (!goal_id) {
      res.status(400).json({ error: 'goal_id is required' });
      return;
    }

    console.log('Updating goal:', goal_id, 'for user:', userId);

    const updatedGoal = await getSupabaseService().updateGoal(userId, goal_id, {
      title: updates.title,
      description: updates.description,
      aspect: updates.aspect,
      targetDate: updates.target_date,
      status: updates.status,
      progress: updates.progress,
      milestones: updates.milestones,
      milestoneType: updates.milestone_type,
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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { goal_id } = req.body ?? {};

    if (!goal_id) {
      res.status(400).json({ error: 'goal_id is required' });
      return;
    }

    console.log('Deleting goal:', goal_id, 'for user:', userId);

    const result = await getSupabaseService().deleteGoal(userId, goal_id);

    res.json(result);

  } catch (error) {
    console.error('Error deleting user goal:', error);
    res.status(500).json({ error: 'Failed to delete user goal' });
  }
}

export async function addGoalCheckIn(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { goal_id, ...checkInData } = req.body ?? {};

    if (!goal_id) {
      res.status(400).json({ error: 'goal_id is required' });
      return;
    }

    console.log('Adding check-in for goal:', goal_id);

    const checkIn = await getSupabaseService().addGoalCheckIn(userId, goal_id, {
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
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { goal_id, limit } = req.body ?? {};

    if (!goal_id) {
      res.status(400).json({ error: 'goal_id is required' });
      return;
    }

    console.log('Fetching check-ins for goal:', goal_id);

    const checkIns = await getSupabaseService().getGoalCheckIns(userId, goal_id, limit);

    res.json({
      success: true,
      checkIns: checkIns
    });

  } catch (error) {
    console.error('Error fetching goal check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch goal check-ins' });
  }
}
