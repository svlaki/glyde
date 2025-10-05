import { Request, Response } from 'express';
import profileService from '../services/ProfileService.js';

export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { section } = req.body ?? {};

    console.log('Fetching profile for user:', userId);

    if (section) {
      const sectionData = await profileService.getProfileSection(userId, section);
      res.json({
        success: true,
        section: section,
        data: sectionData
      });
    } else {
      const profile = await profileService.getProfile(userId);
      const completeness = await profileService.getProfileCompleteness(userId);
      const summary = await profileService.getProfileSummary(userId);

      res.json({
        success: true,
        profile: profile,
        completeness: completeness,
        summary: summary
      });
    }

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

export async function updateUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { section, data } = req.body ?? {};

    console.log('Updating profile for user:', userId);

    if (section) {
      await profileService.updateProfileSection(userId, section, data);
      res.json({
        success: true,
        message: `Profile section ${section} updated successfully`
      });
    } else if (data) {
      await profileService.updateProfile(userId, data);
      res.json({
        success: true,
        message: 'Profile updated successfully'
      });
    } else {
      res.status(400).json({ error: 'Either section with data or complete profile data is required' });
    }

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
}

export async function updateProfileField(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { field, value } = req.body ?? {};

    if (!field) {
      res.status(400).json({ error: 'field is required' });
      return;
    }

    console.log('Updating profile field:', field, 'for user:', userId);

    // Parse field path (e.g., "values.coreValues" -> column: "values", field: "coreValues")
    const pathParts = field.split('.');
    const column = pathParts[0];
    const fieldName = pathParts.slice(1).join('.');
    
    if (!fieldName) {
      // Direct column update
      await profileService.updateProfile(userId, { [column]: value });
    } else {
      // Nested field update
      await profileService.updateField(userId, column, fieldName, value);
    }

    res.json({
      success: true,
      message: `Profile field ${field} updated successfully`
    });

  } catch (error) {
    console.error('Error updating profile field:', error);
    res.status(500).json({ error: 'Failed to update profile field' });
  }
}

export async function batchUpdateProfileFields(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { updates } = req.body ?? {};

    if (!updates || !Array.isArray(updates)) {
      res.status(400).json({ error: 'updates array is required' });
      return;
    }

    console.log('Batch updating profile fields for user:', userId);

    await profileService.batchUpdateFields(userId, updates);

    res.json({
      success: true,
      message: `${updates.length} profile fields updated successfully`
    });

  } catch (error) {
    console.error('Error batch updating profile fields:', error);
    res.status(500).json({ error: 'Failed to batch update profile fields' });
  }
}
