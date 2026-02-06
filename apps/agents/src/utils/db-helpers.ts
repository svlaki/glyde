import { getSupabaseClient } from './supabase.js';

/**
 * Task database helpers
 */
export async function createTask(userId: string, data: {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  category?: string;
  energy_required?: string;
  estimated_duration?: number;
}) {
  const supabase = getSupabaseClient();
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      completed: false,
      ...data
    })
    .select()
    .single();

  if (error) throw error;
  return task;
}

export async function updateTask(userId: string, taskId: string, updates: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(userId: string, taskId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId)
    .eq('id', taskId);

  if (error) throw error;
}

export async function getTasks(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Goal database helpers
 */
export async function createGoal(userId: string, data: {
  title: string;
  description?: string;
  target_date?: string;
  category?: string;
  metrics?: any;
}) {
  const supabase = getSupabaseClient();
  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      status: 'active',
      ...data
    })
    .select()
    .single();

  if (error) throw error;
  return goal;
}

export async function updateGoal(userId: string, goalId: string, updates: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('goals')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', goalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGoals(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Category database helpers
 */
export async function createCategory(userId: string, data: {
  name: string;
  color?: string;
}) {
  const supabase = getSupabaseClient();
  const { data: category, error } = await supabase
    .from('aspects')
    .insert({
      user_id: userId,
      ...data
    })
    .select()
    .single();

  if (error) throw error;
  return category;
}

export async function updateCategory(userId: string, categoryId: string, updates: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('aspects')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCategory(userId: string, categoryId: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('aspects')
    .delete()
    .eq('user_id', userId)
    .eq('id', categoryId);

  if (error) throw error;
}

export async function getCategories(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('aspects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false});

  if (error) throw error;
  return data || [];
}

/**
 * Profile database helpers
 */
export async function getProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: any) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      user_id: userId,
      ...updates
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
