/**
 * EntityMappingService - Manages the mapping between database entities and knowledge graph UUIDs
 *
 * This service provides a persistent mapping between Supabase entity IDs and Zep graph UUIDs,
 * enabling proper synchronization between the database and knowledge graph.
 */

import { SupabaseService } from './SupabaseService.js';

export interface EntityMapping {
  entityType: string;
  entityId: string;
  graphUuid: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export class EntityMappingService {
  private supabaseService: SupabaseService;
  private cache: Map<string, EntityMapping> = new Map();

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Generate a unique key for entity mapping
   */
  private getEntityKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
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
      const mapping: EntityMapping = {
        entityType,
        entityId,
        graphUuid,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // For now, we'll store in cache until we add a proper database table
      // TODO: Add entity_graph_mappings table to Supabase
      const key = this.getEntityKey(entityType, entityId);
      this.cache.set(key, mapping);

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
      const key = this.getEntityKey(entityType, entityId);
      const mapping = this.cache.get(key);

      if (mapping) {
        console.log(`🔍 [EntityMappingService] Found mapping: ${entityType}:${entityId} -> ${mapping.graphUuid}`);
        return mapping;
      }

      // TODO: Query from database when we add the table
      console.log(`❓ [EntityMappingService] No mapping found for: ${entityType}:${entityId}`);
      return null;
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
      const key = this.getEntityKey(entityType, entityId);
      const existingMapping = this.cache.get(key);

      if (existingMapping) {
        existingMapping.graphUuid = newGraphUuid;
        existingMapping.updatedAt = new Date().toISOString();
        this.cache.set(key, existingMapping);
        console.log(`🔄 [EntityMappingService] Updated mapping: ${entityType}:${entityId} -> ${newGraphUuid}`);
      } else {
        console.warn(`⚠️ [EntityMappingService] No existing mapping found to update: ${entityType}:${entityId}`);
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
      const key = this.getEntityKey(entityType, entityId);
      const mapping = this.cache.get(key);

      if (mapping) {
        this.cache.delete(key);
        console.log(`🗑️ [EntityMappingService] Deleted mapping: ${entityType}:${entityId}`);
      } else {
        console.warn(`⚠️ [EntityMappingService] No mapping found to delete: ${entityType}:${entityId}`);
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
      // Filter cache by userId
      const userMappings = Array.from(this.cache.values()).filter(
        mapping => mapping.userId === userId
      );

      console.log(`📊 [EntityMappingService] Found ${userMappings.length} mappings for user ${userId}`);
      return userMappings;
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
      const userMappings = await this.getUserMappings(userId);

      for (const mapping of userMappings) {
        const key = this.getEntityKey(mapping.entityType, mapping.entityId);
        this.cache.delete(key);
      }

      console.log(`🧹 [EntityMappingService] Cleaned up ${userMappings.length} mappings for user ${userId}`);
    } catch (error) {
      console.error('❌ [EntityMappingService] Failed to cleanup user mappings:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalMappings: number; byType: Record<string, number> } {
    const totalMappings = this.cache.size;
    const byType: Record<string, number> = {};

    for (const mapping of this.cache.values()) {
      byType[mapping.entityType] = (byType[mapping.entityType] || 0) + 1;
    }

    return { totalMappings, byType };
  }
}

export default EntityMappingService;