import { Request, Response } from 'express';
import profileService from '../services/ProfileService.js';

export async function getUserProfile(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, section } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Fetching profile for user:', user_id);

    if (section) {
      const sectionData = await profileService.getProfileSection(user_id, section);
      res.json({
        success: true,
        section: section,
        data: sectionData
      });
    } else {
      const profile = await profileService.getProfile(user_id);
      const completeness = await profileService.getProfileCompleteness(user_id);
      const summary = await profileService.getProfileSummary(user_id);

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
    const { user_id, section, data } = req.body;

    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    console.log('Updating profile for user:', user_id);

    if (section) {
      await profileService.updateProfileSection(user_id, section, data);
      res.json({
        success: true,
        message: `Profile section ${section} updated successfully`
      });
    } else if (data) {
      await profileService.updateProfile(user_id, data);
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
    const { user_id, field, value } = req.body;

    if (!user_id || !field) {
      res.status(400).json({ error: 'user_id and field are required' });
      return;
    }

    console.log('Updating profile field:', field, 'for user:', user_id);

    await profileService.updateField(user_id, field, value);

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
    const { user_id, updates } = req.body;

    if (!user_id || !updates || !Array.isArray(updates)) {
      res.status(400).json({ error: 'user_id and updates array are required' });
      return;
    }

    console.log('Batch updating profile fields for user:', user_id);

    await profileService.batchUpdateFields(user_id, updates);

    res.json({
      success: true,
      message: `${updates.length} profile fields updated successfully`
    });

  } catch (error) {
    console.error('Error batch updating profile fields:', error);
    res.status(500).json({ error: 'Failed to batch update profile fields' });
  }
}
