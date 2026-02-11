import { Request, Response } from 'express';
import { OnboardingService } from '../services/OnboardingService.js';

/**
 * Complete onboarding
 * POST /api/onboarding/complete
 * Supports both V1 (old) and V2 (new) onboarding formats
 */
export async function completeOnboarding(req: Request, res: Response) {
  try {
    const userId = req.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Check if this is V2 format (has fullName) or V1 format (has name + preferences)
    const isV2 = 'fullName' in req.body;

    if (isV2) {
      // V2 Format: New onboarding structure
      const {
        fullName,
        preferredName,
        birthday,
        selectedCalendars,
        otherCalendar,
        occupation,
        fieldOfStudy,
        aspects,
        goals,
        timezone
      } = req.body;

      // Validate required V2 fields
      if (!fullName || !birthday || !occupation || !aspects || !goals || !timezone) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields for V2 onboarding'
        });
        return;
      }

      // Complete V2 onboarding
      await OnboardingService.completeOnboardingV2(userId, {
        fullName,
        preferredName,
        birthday,
        selectedCalendars: selectedCalendars || [],
        otherCalendar,
        occupation,
        fieldOfStudy,
        aspects,
        goals,
        timezone
      });
    } else {
      // V1 Format: Old onboarding structure
      const { name, occupation, goals, aspects, timezone, preferences } = req.body;

      // Validate required V1 fields
      if (!name || !occupation || !goals || !aspects || !timezone || !preferences) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
        return;
      }

      // Validate preferences structure
      if (!preferences.work_hours || !preferences.communication || !preferences.productivity) {
        res.status(400).json({
          success: false,
          error: 'Invalid preferences structure'
        });
        return;
      }

      // Complete V1 onboarding
      await OnboardingService.completeOnboarding(userId, {
        name,
        occupation,
        goals,
        aspects,
        timezone,
        preferences
      });
    }

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error: any) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete onboarding'
    });
  }
}

/**
 * Save step data progressively
 * POST /api/onboarding/save-step
 */
export async function saveOnboardingStep(req: Request, res: Response) {
  try {
    const userId = req.authUserId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { step, data } = req.body;

    if (!step || !data) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: step, data'
      });
      return;
    }

    // Save step data
    await OnboardingService.saveStepData(userId, step, data);

    res.json({
      success: true,
      message: `Step ${step} saved successfully`
    });
  } catch (error: any) {
    console.error('Error saving onboarding step:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save onboarding step'
    });
  }
}
