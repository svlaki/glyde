import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseService.js';

export interface Rule {
  id: string;
  user_id: string;
  rule_text: string;
  description?: string;
  enabled: boolean;
  priority: number;
  source: 'manual' | 'agent';
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  rule_text: string;
  description?: string;
  priority?: number;
  source?: 'manual' | 'agent';
}

export interface UpdateRuleInput {
  rule_text?: string;
  description?: string;
  priority?: number;
  enabled?: boolean;
}

export class RuleService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all rules for a user
   */
  async getRules(userId: string): Promise<Rule[]> {
    try {
      const { data, error } = await this.supabase
        .from('rules')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [RuleService] Error fetching rules:', error);
        return [];
      }

      return (data || []) as Rule[];
    } catch (error) {
      console.error('❌ [RuleService] Exception fetching rules:', error);
      return [];
    }
  }

  /**
   * Get only enabled rules for a user (for agent context injection)
   */
  async getEnabledRules(userId: string): Promise<Rule[]> {
    try {
      const { data, error } = await this.supabase
        .from('rules')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [RuleService] Error fetching enabled rules:', error);
        return [];
      }

      return (data || []) as Rule[];
    } catch (error) {
      console.error('❌ [RuleService] Exception fetching enabled rules:', error);
      return [];
    }
  }

  /**
   * Get a single rule by ID
   */
  async getRule(userId: string, ruleId: string): Promise<Rule | null> {
    try {
      const { data, error } = await this.supabase
        .from('rules')
        .select('*')
        .eq('user_id', userId)
        .eq('id', ruleId)
        .maybeSingle();

      if (error) {
        console.error('❌ [RuleService] Error fetching rule:', error);
        return null;
      }

      return data as Rule | null;
    } catch (error) {
      console.error('❌ [RuleService] Exception fetching rule:', error);
      return null;
    }
  }

  /**
   * Create a new rule
   */
  async createRule(userId: string, input: CreateRuleInput): Promise<Rule | null> {
    try {
      // Validate rule_text is not empty
      if (!input.rule_text || input.rule_text.trim().length === 0) {
        console.error('❌ [RuleService] Rule text cannot be empty');
        return null;
      }

      const { data, error } = await this.supabase
        .from('rules')
        .insert({
          user_id: userId,
          rule_text: input.rule_text.trim(),
          description: input.description?.trim() || null,
          priority: input.priority ?? 5,
          source: input.source || 'manual',
          enabled: true
        })
        .select()
        .single();

      if (error) {
        // Handle duplicate rule error
        if (error.code === '23505') {
          console.error('❌ [RuleService] Duplicate rule - this rule already exists');
          return null;
        }
        console.error('❌ [RuleService] Error creating rule:', error);
        return null;
      }

      console.log('✅ [RuleService] Rule created successfully:', data.id);
      return data as Rule;
    } catch (error) {
      console.error('❌ [RuleService] Exception creating rule:', error);
      return null;
    }
  }

  /**
   * Update an existing rule
   */
  async updateRule(userId: string, ruleId: string, updates: UpdateRuleInput): Promise<Rule | null> {
    try {
      // Build update object, only including non-undefined values
      const updateData: Record<string, any> = {};

      if (updates.rule_text !== undefined) {
        if (updates.rule_text.trim().length === 0) {
          console.error('❌ [RuleService] Rule text cannot be empty');
          return null;
        }
        updateData.rule_text = updates.rule_text.trim();
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description?.trim() || null;
      }
      if (updates.priority !== undefined) {
        updateData.priority = updates.priority;
      }
      if (updates.enabled !== undefined) {
        updateData.enabled = updates.enabled;
      }

      if (Object.keys(updateData).length === 0) {
        console.error('❌ [RuleService] No valid updates provided');
        return null;
      }

      const { data, error } = await this.supabase
        .from('rules')
        .update(updateData)
        .eq('user_id', userId)
        .eq('id', ruleId)
        .select()
        .single();

      if (error) {
        // Handle duplicate rule error
        if (error.code === '23505') {
          console.error('❌ [RuleService] Duplicate rule - this rule already exists');
          return null;
        }
        console.error('❌ [RuleService] Error updating rule:', error);
        return null;
      }

      console.log('✅ [RuleService] Rule updated successfully:', ruleId);
      return data as Rule;
    } catch (error) {
      console.error('❌ [RuleService] Exception updating rule:', error);
      return null;
    }
  }

  /**
   * Delete a rule
   */
  async deleteRule(userId: string, ruleId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('rules')
        .delete()
        .eq('user_id', userId)
        .eq('id', ruleId);

      if (error) {
        console.error('❌ [RuleService] Error deleting rule:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [RuleService] Rule deleted successfully:', ruleId);
      return { success: true };
    } catch (error) {
      console.error('❌ [RuleService] Exception deleting rule:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Toggle a rule's enabled status
   */
  async toggleRule(userId: string, ruleId: string, enabled: boolean): Promise<Rule | null> {
    return this.updateRule(userId, ruleId, { enabled });
  }

  /**
   * Search rules by text (for agent to find existing rules)
   */
  async searchRules(userId: string, searchQuery: string): Promise<Rule[]> {
    try {
      const { data, error } = await this.supabase
        .from('rules')
        .select('*')
        .eq('user_id', userId)
        .or(`rule_text.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('priority', { ascending: false });

      if (error) {
        console.error('❌ [RuleService] Error searching rules:', error);
        return [];
      }

      return (data || []) as Rule[];
    } catch (error) {
      console.error('❌ [RuleService] Exception searching rules:', error);
      return [];
    }
  }

  /**
   * Format rules for injection into agent system prompt
   */
  formatRulesForPrompt(rules: Rule[]): string {
    if (rules.length === 0) {
      return '';
    }

    const formattedRules = rules
      .sort((a, b) => b.priority - a.priority)
      .map(r => `- ${r.rule_text}`)
      .join('\n');

    return formattedRules;
  }
}

export default new RuleService();
