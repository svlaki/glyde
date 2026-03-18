import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseService } from '../services/SupabaseService.js';

const registerSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  platform: z.enum(['ios', 'android', 'web']),
});

const unregisterSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function registerDeviceToken(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      return;
    }

    const { token, platform } = parsed.data;
    const client = getSupabaseService().getClient();

    const { error } = await client
      .from('device_tokens')
      .upsert(
        { user_id: userId, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[PUSH] Failed to register device token:', error);
      res.status(500).json({ success: false, error: 'Failed to register device token' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[PUSH] Error registering device token:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function unregisterDeviceToken(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const parsed = unregisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0].message });
      return;
    }

    const { token } = parsed.data;
    const client = getSupabaseService().getClient();

    const { error } = await client
      .from('device_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('[PUSH] Failed to unregister device token:', error);
      res.status(500).json({ success: false, error: 'Failed to unregister device token' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[PUSH] Error unregistering device token:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
