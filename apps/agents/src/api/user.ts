import { Request, Response } from 'express';
import { supabase } from '../services/SupabaseService.js';

/**
 * Ensures user profile exists in public.profile table.
 * Note: Per-user schemas are no longer used - all data is in public schema with RLS.
 */
export async function createUserSchema(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    const { user_email } = req.body ?? {};

    if (!userId || !user_email) {
      res.status(400).json({ success: false, error: 'user_email is required' });
      return;
    }

    // Ensure profile exists in public.profile table
    const { error: profileError } = await supabase
      .from('profile')
      .upsert({
        id: userId,
        email: user_email
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      res.status(500).json({ success: false, error: 'Failed to create user profile' });
      return;
    }

    res.json({
      success: true,
      message: 'User profile initialized successfully',
      user_id: userId
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}