/**
 * EntityMappingService - Manages the mapping between database entities and knowledge graph UUIDs
 *
 * This service provides a persistent mapping between Supabase entity IDs and Zep graph UUIDs,
 * enabling proper synchronization between the database and knowledge graph.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';

export interface EntityMapping {
  id?: string;
  entityType: string;
  entityId: string;
  graphUuid: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export class EntityMappingService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Store a mapping between an entity and its graph UUID
   */
  async storeMapping(
    userId: string,
    entityType: string,
    entityId: string,
    graphUuid: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('entity_graph_mappings')
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          graph_uuid: graphUuid
        });

      if (error) {
        console.error('❌ [EntityMappingService] Database error storing mapping:', error);
        throw error;
      }

      console.log(`📝 [EntityMappingService] Stored mapping: ${entityType}:${entityId} -> ${graphUuid}`);
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to store mapping:', error);
      throw error;
    }
  }

  /**
   * Retrieve a mapping by entity type and ID
   */
  async getMapping(entityType: string, entityId: string): Promise<EntityMapping | null> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❓ [EntityMappingService] No mapping found for: ${entityType}:${entityId}`);
          return null;
        }
        console.error('❌ [EntityMappingService] Database error getting mapping:', error);
        return null;
      }

      const mapping: EntityMapping = {
        id: data.id,
        entityType: data.entity_type,
        entityId: data.entity_id,
        graphUuid: data.graph_uuid,
        userId: data.user_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      console.log(`🔍 [EntityMappingService] Found mapping: ${entityType}:${entityId} -> ${mapping.graphUuid}`);
      return mapping;
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to get mapping:', error);
      return null;
    }
  }

  /**
   * Update a mapping with a new graph UUID
   */
  async updateMapping(
    entityType: string,
    entityId: string,
    newGraphUuid: string
  ): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .update({
          graph_uuid: newGraphUuid,
          updated_at: new Date().toISOString()
        })
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .select();

      if (error) {
        console.error('❌ [EntityMappingService] Database error updating mapping:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ [EntityMappingService] No existing mapping found to update: ${entityType}:${entityId}`);
      } else {
        console.log(`🔄 [EntityMappingService] Updated mapping: ${entityType}:${entityId} -> ${newGraphUuid}`);
      }
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to update mapping:', error);
      throw error;
    }
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(entityType: string, entityId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .select();

      if (error) {
        console.error('❌ [EntityMappingService] Database error deleting mapping:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn(`⚠️ [EntityMappingService] No mapping found to delete: ${entityType}:${entityId}`);
      } else {
        console.log(`🗑️ [EntityMappingService] Deleted mapping: ${entityType}:${entityId}`);
      }
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to delete mapping:', error);
      throw error;
    }
  }

  /**
   * Get all mappings for a user
   */
  async getUserMappings(userId: string): Promise<EntityMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [EntityMappingService] Database error getting user mappings:', error);
        return [];
      }

      const mappings: EntityMapping[] = (data || []).map(row => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        graphUuid: row.graph_uuid,
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      console.log(`📊 [EntityMappingService] Found ${mappings.length} mappings for user ${userId}`);
      return mappings;
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to get user mappings:', error);
      return [];
    }
  }

  /**
   * Clean up all mappings for a user
   */
  async cleanupUserMappings(userId: string): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .delete()
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('❌ [EntityMappingService] Database error cleaning up user mappings:', error);
        throw error;
      }

      const deletedCount = data?.length || 0;
      console.log(`🧹 [EntityMappingService] Cleaned up ${deletedCount} mappings for user ${userId}`);
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to cleanup user mappings:', error);
      throw error;
    }
  }

  /**
   * Get mapping statistics
   */
  async getMappingStats(): Promise<{ totalMappings: number; byType: Record<string, number> }> {
    try {
      const { data, error } = await this.supabase
        .from('entity_graph_mappings')
        .select('entity_type');

      if (error) {
        console.error('❌ [EntityMappingService] Database error getting mapping stats:', error);
        return { totalMappings: 0, byType: {} };
      }

      const totalMappings = data?.length || 0;
      const byType: Record<string, number> = {};

      for (const row of data || []) {
        byType[row.entity_type] = (byType[row.entity_type] || 0) + 1;
      }

      return { totalMappings, byType };
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to get mapping stats:', error);
      return { totalMappings: 0, byType: {} };
    }
  }
}

export default EntityMappingService;