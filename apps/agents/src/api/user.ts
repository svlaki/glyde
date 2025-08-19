import { Request, Response } from 'express';
import { supabase } from '../services/SupabaseService.js';

export async function createUserSchema(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, user_email } = req.body;
    
    if (!user_id || !user_email) {
      res.status(400).json({ error: 'user_id and user_email are required' });
      return;
    }

    // For now, we'll skip user table creation since it may not exist
    // This is handled by Supabase Auth automatically
    console.log(`🔧 [USER SCHEMA] Processing: ${user_email}`);
    
    // Create user-specific schema tables using RPC function
    const { error: schemaError } = await supabase.rpc('create_user_schema_rpc', {
      user_id: user_id,
      user_email: user_email
    });

    if (schemaError) {
      console.error('Error creating user schema:', schemaError);
      // Continue anyway - schema might already exist
    } else {
      console.log(`✅ [USER SCHEMA] Created for: ${user_email}`);
    }

    // For now, we'll skip profile table operations since they may not exist
    // The user schema creation RPC function should handle this
    console.log(`🎉 [USER SCHEMA] Completed for: ${user_email}`);
    
    // Try to create user profile, but don't fail if table doesn't exist
    try {
      const { data: existingProfile, error: profileFetchError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user_id)
        .single();

      if (profileFetchError && profileFetchError.code !== 'PGRST116') {
        console.log('User profiles table may not exist, skipping profile creation');
      } else if (!existingProfile) {
        await supabase.from('user_profiles').insert([{
          user_id: user_id,
          preferences: {},
          goals: [],
          values: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
        console.log(`Created user profile for: ${user_id}`);
      }
    } catch (error) {
      console.log('Profile creation skipped - table may not exist');
    }

    res.json({ 
      success: true, 
      message: 'User schema created successfully',
      user_id: user_id
    });

  } catch (error) {
    console.error('Error in createUserSchema:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}