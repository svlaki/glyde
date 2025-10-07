import { supabase } from '../../lib/supabase';

export interface CreateInteractionParams {
  userId: string;
  agentId: string;
  question: string;
  interactionType: 'yes_no' | 'multiple_choice' | 'confirmation';
  options?: string[];
  priority?: number; // 1-10, default 5
  categoryId?: string;
  entityType?: 'event' | 'task' | 'goal';
  entityId?: string;
  metadata?: Record<string, any>;
  expiresAt?: string; // ISO date string
}

export interface CreateInteractionResult {
  success: boolean;
  interactionId?: string;
  error?: string;
}

/**
 * Tool for agents to create interactions that appear in the user's interaction box
 * These are playing card-shaped prompts that ask the user for decisions or confirmations
 */
export async function createInteraction(params: CreateInteractionParams): Promise<CreateInteractionResult> {
  try {
    const {
      userId,
      agentId,
      question,
      interactionType,
      options,
      priority = 5,
      categoryId,
      entityType,
      entityId,
      metadata,
      expiresAt
    } = params;

    // Validate required fields
    if (!userId || !agentId || !question || !interactionType) {
      return {
        success: false,
        error: 'Missing required fields: userId, agentId, question, and interactionType are required'
      };
    }

    // Validate interaction type
    if (!['yes_no', 'multiple_choice', 'confirmation'].includes(interactionType)) {
      return {
        success: false,
        error: 'Invalid interaction type. Must be yes_no, multiple_choice, or confirmation'
      };
    }

    // Validate options for multiple choice
    if (interactionType === 'multiple_choice' && (!options || options.length === 0)) {
      return {
        success: false,
        error: 'Multiple choice interactions require options array'
      };
    }

    // Validate priority range
    if (priority < 1 || priority > 10) {
      return {
        success: false,
        error: 'Priority must be between 1 and 10'
      };
    }

    // Create the interaction in the database
    const { data, error } = await supabase
      .from('user_interactions')
      .insert({
        user_id: userId,
        agent_id: agentId,
        interaction_type: interactionType,
        question,
        options: options || null,
        priority,
        category_id: categoryId || null,
        entity_type: entityType || null,
        entity_id: entityId || null,
        metadata: metadata || null,
        expires_at: expiresAt || null,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating interaction:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      interactionId: data.id
    };
  } catch (error) {
    console.error('Unexpected error creating interaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Schema for LangChain/LangGraph tool integration
 */
export const createInteractionSchema = {
  name: 'create_interaction',
  description: 'Create an interaction card that appears in the user\'s interaction box for decisions or confirmations',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The user ID to create the interaction for'
      },
      agentId: {
        type: 'string',
        description: 'The ID of the agent creating this interaction'
      },
      question: {
        type: 'string',
        description: 'The question or prompt to show the user'
      },
      interactionType: {
        type: 'string',
        enum: ['yes_no', 'multiple_choice', 'confirmation'],
        description: 'Type of interaction buttons to display'
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Options for multiple choice interactions (max 3 will be shown)'
      },
      priority: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Priority level (1-10, higher shows first)'
      },
      categoryId: {
        type: 'string',
        description: 'Category ID to determine the card color'
      },
      entityType: {
        type: 'string',
        enum: ['event', 'task', 'goal'],
        description: 'Type of entity this interaction relates to'
      },
      entityId: {
        type: 'string',
        description: 'ID of the related entity'
      },
      metadata: {
        type: 'object',
        description: 'Additional context data (e.g., eventTitle for display)'
      },
      expiresAt: {
        type: 'string',
        description: 'ISO date string when the interaction expires'
      }
    },
    required: ['userId', 'agentId', 'question', 'interactionType']
  }
};