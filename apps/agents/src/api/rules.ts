import { Request, Response } from 'express';
import ruleService from '../services/RuleService.js';

/**
 * Get all rules for the authenticated user
 */
export async function getUserRules(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log('[RULES API] Fetching rules for user:', userId);

    const rules = await ruleService.getRules(userId);

    res.json({
      success: true,
      rules: rules
    });
  } catch (error) {
    console.error('[RULES API] Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
}

/**
 * Create a new rule
 */
export async function createUserRule(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { rule_text, description, priority, source } = req.body ?? {};

    if (!rule_text || rule_text.trim().length === 0) {
      res.status(400).json({ error: 'rule_text is required' });
      return;
    }

    console.log('➕ [RULES API] Creating rule for user:', userId);

    const rule = await ruleService.createRule(userId, {
      rule_text,
      description,
      priority,
      source
    });

    if (!rule) {
      res.status(400).json({
        success: false,
        error: 'Failed to create rule. The rule may already exist.'
      });
      return;
    }

    res.json({
      success: true,
      rule: rule,
      message: 'Rule created successfully'
    });
  } catch (error) {
    console.error('[RULES API] Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
}

/**
 * Update an existing rule
 */
export async function updateUserRule(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { rule_id, rule_text, description, priority, enabled } = req.body ?? {};

    if (!rule_id) {
      res.status(400).json({ error: 'rule_id is required' });
      return;
    }

    console.log('✏️ [RULES API] Updating rule:', rule_id, 'for user:', userId);

    const rule = await ruleService.updateRule(userId, rule_id, {
      rule_text,
      description,
      priority,
      enabled
    });

    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'Rule not found or update failed'
      });
      return;
    }

    res.json({
      success: true,
      rule: rule,
      message: 'Rule updated successfully'
    });
  } catch (error) {
    console.error('[RULES API] Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
}

/**
 * Delete a rule
 */
export async function deleteUserRule(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { rule_id } = req.body ?? {};

    if (!rule_id) {
      res.status(400).json({ error: 'rule_id is required' });
      return;
    }

    console.log('[RULES API] Deleting rule:', rule_id, 'for user:', userId);

    const result = await ruleService.deleteRule(userId, rule_id);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to delete rule'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('[RULES API] Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
}

/**
 * Toggle a rule's enabled status
 */
export async function toggleUserRule(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { rule_id, enabled } = req.body ?? {};

    if (!rule_id) {
      res.status(400).json({ error: 'rule_id is required' });
      return;
    }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    console.log('[RULES API] Toggling rule:', rule_id, 'to:', enabled, 'for user:', userId);

    const rule = await ruleService.toggleRule(userId, rule_id, enabled);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'Rule not found or toggle failed'
      });
      return;
    }

    res.json({
      success: true,
      rule: rule,
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('[RULES API] Error toggling rule:', error);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
}
