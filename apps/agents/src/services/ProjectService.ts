import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';
import { logger } from '../utils/logger.js';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  deadline?: string;
  details?: Record<string, any>;
  aspect_id?: string;
  aspect_name?: string;
  aspect_color?: string;
  aspect_icon?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name: string;
  aspect_id: string;
  description?: string;
  deadline?: string;
  details?: Record<string, any>;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string | null;
  deadline?: string | null;
  details?: Record<string, any>;
  aspect_id?: string;
}

export class ProjectService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  async getProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_projects_with_aspects', { p_user_id: userId });

      if (error) {
        logger.error('[ProjectService] Error fetching projects:', error);
        return [];
      }

      return ((data || []) as Project[]).filter(p => !p.archived_at);
    } catch (error) {
      logger.error('[ProjectService] Exception fetching projects:', error);
      return [];
    }
  }

  async getProjectById(userId: string, projectId: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_projects_with_aspects', { p_user_id: userId });

      if (error) {
        logger.error('[ProjectService] Error fetching project by id:', error);
        return null;
      }

      return (data || []).find((p: Project) => p.id === projectId) || null;
    } catch (error) {
      logger.error('[ProjectService] Exception fetching project by id:', error);
      return null;
    }
  }

  async getProjectByName(userId: string, name: string): Promise<Project | null> {
    try {
      const { data, error } = await this.supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', name)
        .single();

      if (error) {
        return null;
      }

      return data as Project;
    } catch (error) {
      logger.error('[ProjectService] Exception fetching project by name:', error);
      return null;
    }
  }

  async createProject(userId: string, input: ProjectCreateInput): Promise<Project | null> {
    try {
      if (!input.name || input.name.trim().length === 0) {
        throw new Error('Project name is required');
      }

      if (!input.aspect_id) {
        throw new Error('Aspect ID is required');
      }

      const { data, error } = await this.supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: input.name.trim(),
          description: input.description?.trim(),
          deadline: input.deadline,
          details: input.details || {},
          aspect_id: input.aspect_id,
        })
        .select()
        .single();

      if (error) {
        logger.error('[ProjectService] Error creating project:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Created project: ${input.name}`);
      return data as Project;
    } catch (error) {
      logger.error('[ProjectService] Exception creating project:', error);
      throw error;
    }
  }

  async updateProject(
    userId: string,
    projectId: string,
    updates: ProjectUpdateInput
  ): Promise<Project | null> {
    try {
      const updateData: Record<string, any> = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.description !== undefined) updateData.description = updates.description?.trim();
      if (updates.deadline !== undefined) updateData.deadline = updates.deadline;
      if (updates.details !== undefined) updateData.details = updates.details;
      if (updates.aspect_id !== undefined) updateData.aspect_id = updates.aspect_id;

      const { data, error } = await this.supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        logger.error('[ProjectService] Error updating project:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Project not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Updated project: ${projectId}`);
      return data as Project;
    } catch (error) {
      logger.error('[ProjectService] Exception updating project:', error);
      throw error;
    }
  }

  async archiveProject(userId: string, projectId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('projects')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[ProjectService] Error archiving project:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Archived project: ${projectId}`);
    } catch (error) {
      logger.error('[ProjectService] Exception archiving project:', error);
      throw error;
    }
  }

  async unarchiveProject(userId: string, projectId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('projects')
        .update({ archived_at: null })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[ProjectService] Error unarchiving project:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Unarchived project: ${projectId}`);
    } catch (error) {
      logger.error('[ProjectService] Exception unarchiving project:', error);
      throw error;
    }
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[ProjectService] Error deleting project:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Deleted project: ${projectId}`);
    } catch (error) {
      logger.error('[ProjectService] Exception deleting project:', error);
      throw error;
    }
  }

  async getArchivedProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_projects_with_aspects', { p_user_id: userId });

      if (error) {
        logger.error('[ProjectService] Error fetching archived projects:', error);
        return [];
      }

      return ((data || []) as Project[]).filter(p => p.archived_at !== null);
    } catch (error) {
      logger.error('[ProjectService] Exception fetching archived projects:', error);
      return [];
    }
  }

  async getProjectTasks(userId: string, projectId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('[ProjectService] Error fetching project tasks:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('[ProjectService] Exception fetching project tasks:', error);
      return [];
    }
  }

  async getProjectEvents(userId: string, projectId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('[ProjectService] Error fetching project events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('[ProjectService] Exception fetching project events:', error);
      return [];
    }
  }

  async tagEntity(
    userId: string,
    entityType: 'task' | 'event',
    entityId: string,
    projectId: string | null
  ): Promise<void> {
    try {
      const table = entityType === 'task' ? 'tasks' : 'events';

      const { error } = await this.supabase
        .from(table)
        .update({ project_id: projectId })
        .eq('id', entityId)
        .eq('user_id', userId);

      if (error) {
        logger.error(`[ProjectService] Error tagging ${entityType}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info(`[ProjectService] Tagged ${entityType} ${entityId} to project ${projectId}`);
    } catch (error) {
      logger.error(`[ProjectService] Exception tagging ${entityType}:`, error);
      throw error;
    }
  }
}

export default new ProjectService();
