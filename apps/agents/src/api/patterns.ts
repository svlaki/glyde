import { Request, Response } from 'express';
import { PatternDetectionService } from '../services/PatternDetectionService.js';

/**
 * Analyze user patterns from their calendar data
 */
export async function analyzePatterns(req: Request, res: Response) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('🔍 Analyzing patterns for user:', user_id);

    const patternService = new PatternDetectionService(user_id);
    const patterns = await patternService.analyzeUserPatterns();
    const insights = await patternService.generateInsights();

    console.log('✅ Pattern analysis complete:', {
      patternsFound: patterns.length,
      insightsGenerated: insights.length
    });

    return res.json({
      success: true,
      patterns,
      insights
    });
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze patterns'
    });
  }
}

/**
 * Get user preferences
 */
export async function getUserPreferences(req: Request, res: Response) {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const patternService = new PatternDetectionService(user_id);
    const preferences = await patternService.getUserPreferences();

    return res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
}

/**
 * Update user preference
 */
export async function updatePreference(req: Request, res: Response) {
  try {
    const { user_id, key, value, category } = req.body;

    if (!user_id || !key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'User ID, key, and value are required'
      });
    }

    const patternService = new PatternDetectionService(user_id);
    const updated = await patternService.updatePreference(key, value, category);

    return res.json({
      success: updated,
      message: updated ? 'Preference updated successfully' : 'Failed to update preference'
    });
  } catch (error) {
    console.error('Error updating preference:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update preference'
    });
  }
}