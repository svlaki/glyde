/**
 * PatternAggregationService - Aggregates user patterns into central graph
 *
 * Purpose:
 * - Discovers common patterns across all users
 * - Aggregates patterns by type and confidence
 * - Adds validated community patterns to central graph
 * - Provides collective intelligence for recommendations
 *
 * Runs periodically (daily/weekly) to keep central graph updated
 */

import { ZepGraphService, type PatternAggregation, type GraphSearchResult } from './ZepGraphService.js';
import { createClient } from '@supabase/supabase-js';
import { env } from '../utils/env.js';

interface UserData {
  id: string;
  email?: string;
}

interface AggregatedPattern {
  pattern_type: string;
  description: string;
  user_ids: string[];
  observations: any[];
  avg_confidence: number;
  total_observations: number;
  first_detected: string;
  last_observed: string;
}

export class PatternAggregationService {
  private zepService: ZepGraphService;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.zepService = new ZepGraphService();
    this.supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get all users from Supabase
   */
  private async getAllUsers(): Promise<UserData[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email')
      .limit(1000); // Process in batches if needed

    if (error) {
      console.error('Failed to fetch users:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Collect patterns from a single user's graph
   */
  private async collectUserPatterns(userId: string): Promise<any[]> {
    try {
      const result = await this.zepService.searchUserGraphAdvanced(userId, '', {
        minRating: 0.6, // Only validated patterns
        edgeTypes: ['HAS_PATTERN'],
        scope: 'edges'
      });

      return result.edges || [];
    } catch (error) {
      console.error(`Failed to collect patterns for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Aggregate patterns across all users
   */
  private aggregatePatterns(userPatterns: Map<string, any[]>): Map<string, AggregatedPattern> {
    const aggregated = new Map<string, AggregatedPattern>();

    for (const [userId, patterns] of userPatterns.entries()) {
      for (const pattern of patterns) {
        const fact = pattern.fact || {};
        const patternType = fact.pattern_type || 'unknown';
        const key = patternType;

        if (!aggregated.has(key)) {
          aggregated.set(key, {
            pattern_type: patternType,
            description: fact.description || `Common pattern: ${patternType}`,
            user_ids: [],
            observations: [],
            avg_confidence: 0,
            total_observations: 0,
            first_detected: pattern.created_at || new Date().toISOString(),
            last_observed: pattern.valid_at || new Date().toISOString()
          });
        }

        const agg = aggregated.get(key)!;

        // Add user if not already included
        if (!agg.user_ids.includes(userId)) {
          agg.user_ids.push(userId);
        }

        // Add observation
        agg.observations.push({
          user_id: userId,
          confidence: fact.confidence_score || 0.5,
          observation_count: fact.observation_count || 1,
          created_at: pattern.created_at,
          valid_at: pattern.valid_at
        });

        // Update metrics
        agg.total_observations += (fact.observation_count || 1);

        // Update date range
        if (pattern.created_at && pattern.created_at < agg.first_detected) {
          agg.first_detected = pattern.created_at;
        }
        if (pattern.valid_at && pattern.valid_at > agg.last_observed) {
          agg.last_observed = pattern.valid_at;
        }
      }
    }

    // Calculate average confidence for each pattern
    for (const [key, agg] of aggregated.entries()) {
      const totalConfidence = agg.observations.reduce((sum, obs) => sum + obs.confidence, 0);
      agg.avg_confidence = totalConfidence / agg.observations.length;
    }

    return aggregated;
  }

  /**
   * Filter patterns that meet community threshold
   */
  private filterCommunityPatterns(
    aggregated: Map<string, AggregatedPattern>,
    minUsers: number = 3,
    minConfidence: number = 0.6
  ): AggregatedPattern[] {
    const communityPatterns: AggregatedPattern[] = [];

    for (const [key, pattern] of aggregated.entries()) {
      if (pattern.user_ids.length >= minUsers && pattern.avg_confidence >= minConfidence) {
        communityPatterns.push(pattern);
      }
    }

    // Sort by user count (most common patterns first)
    return communityPatterns.sort((a, b) => b.user_ids.length - a.user_ids.length);
  }

  /**
   * Add community patterns to central graph
   */
  private async addPatternsToCentralGraph(patterns: AggregatedPattern[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        await this.zepService.addCommunityPattern({
          pattern_type: pattern.pattern_type,
          description: `${pattern.description} (observed across ${pattern.user_ids.length} users)`,
          user_count: pattern.user_ids.length,
          avg_confidence: pattern.avg_confidence,
          pattern_category: this.categorizePattern(pattern.pattern_type)
        });

        console.log(`✅ Added community pattern: ${pattern.pattern_type} (${pattern.user_ids.length} users, ${pattern.avg_confidence.toFixed(2)} conf)`);
      } catch (error) {
        console.error(`Failed to add community pattern ${pattern.pattern_type}:`, error);
      }
    }
  }

  /**
   * Categorize pattern for better organization
   */
  private categorizePattern(patternType: string): string {
    const type = patternType.toLowerCase();

    if (type.includes('productivity') || type.includes('peak') || type.includes('focus')) {
      return 'productivity';
    } else if (type.includes('time') || type.includes('schedule') || type.includes('hour')) {
      return 'scheduling';
    } else if (type.includes('energy') || type.includes('fatigue')) {
      return 'energy';
    } else if (type.includes('meeting') || type.includes('collaboration')) {
      return 'collaboration';
    } else if (type.includes('break') || type.includes('rest')) {
      return 'wellbeing';
    } else {
      return 'general';
    }
  }

  /**
   * Main aggregation pipeline - run this periodically
   */
  async aggregateAllUserPatterns(options?: {
    minUsers?: number;
    minConfidence?: number;
    maxUsers?: number; // For testing, limit number of users processed
  }): Promise<{
    totalUsers: number;
    patternsFound: number;
    communityPatterns: number;
    patterns: AggregatedPattern[];
  }> {
    const startTime = Date.now();
    console.log('🔄 Starting pattern aggregation pipeline...');

    try {
      // 1. Get all users
      const allUsers = await this.getAllUsers();
      const users = options?.maxUsers
        ? allUsers.slice(0, options.maxUsers)
        : allUsers;

      console.log(`📊 Processing ${users.length} users...`);

      // 2. Collect patterns from each user
      const userPatterns = new Map<string, any[]>();
      let totalPatternsFound = 0;

      for (const user of users) {
        const patterns = await this.collectUserPatterns(user.id);
        if (patterns.length > 0) {
          userPatterns.set(user.id, patterns);
          totalPatternsFound += patterns.length;
        }
      }

      console.log(`📈 Found ${totalPatternsFound} total patterns across ${userPatterns.size} users`);

      // 3. Aggregate patterns by type
      const aggregated = this.aggregatePatterns(userPatterns);
      console.log(`🔗 Aggregated into ${aggregated.size} unique pattern types`);

      // 4. Filter community patterns (minimum user threshold)
      const communityPatterns = this.filterCommunityPatterns(
        aggregated,
        options?.minUsers || 3,
        options?.minConfidence || 0.6
      );

      console.log(`✨ Identified ${communityPatterns.length} community patterns`);

      // 5. Add to central graph
      await this.addPatternsToCentralGraph(communityPatterns);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Pattern aggregation completed in ${duration}s`);

      return {
        totalUsers: users.length,
        patternsFound: totalPatternsFound,
        communityPatterns: communityPatterns.length,
        patterns: communityPatterns
      };
    } catch (error) {
      console.error('❌ Pattern aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Get aggregation statistics
   */
  async getAggregationStats(): Promise<{
    totalPatterns: number;
    byCategory: Record<string, number>;
    topPatterns: Array<{ type: string; userCount: number; confidence: number }>;
  }> {
    try {
      const communityPatterns = await this.zepService.searchCommunityPatterns('', 1);

      const stats = {
        totalPatterns: communityPatterns.length,
        byCategory: {} as Record<string, number>,
        topPatterns: [] as Array<{ type: string; userCount: number; confidence: number }>
      };

      // Parse pattern info from descriptions
      for (const pattern of communityPatterns) {
        // Extract pattern type from description
        const match = pattern.match(/^(.+?)\s+\(/);
        if (match) {
          const type = match[1];
          const category = this.categorizePattern(type);
          stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get aggregation stats:', error);
      return {
        totalPatterns: 0,
        byCategory: {},
        topPatterns: []
      };
    }
  }
}

/**
 * Create a scheduled job to run pattern aggregation
 * This should be called from a cron job or scheduled task
 */
export async function runPatternAggregation(): Promise<void> {
  const service = new PatternAggregationService();

  try {
    const result = await service.aggregateAllUserPatterns({
      minUsers: 3,       // Minimum 3 users for community pattern
      minConfidence: 0.6  // Minimum 60% confidence
    });

    console.log('Pattern Aggregation Results:', {
      totalUsers: result.totalUsers,
      patternsFound: result.patternsFound,
      communityPatterns: result.communityPatterns,
      topPatterns: result.patterns.slice(0, 5).map(p => ({
        type: p.pattern_type,
        users: p.user_ids.length,
        confidence: p.avg_confidence.toFixed(2)
      }))
    });
  } catch (error) {
    console.error('Pattern aggregation job failed:', error);
  }
}
