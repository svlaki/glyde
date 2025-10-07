import { supabase } from '../../lib/supabase';

export interface GetInteractionResponsesParams {
  agentId: string;
  interactionIds?: string[]; // Optional: specific interactions to check
  since?: string; // Optional: ISO date to get responses since
  limit?: number; // Optional: max number of responses to return
}

export interface InteractionResponseData {
  interactionId: string;
  userId: string;
  question: string;
  response: string;
  respondedAt: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export interface GetInteractionResponsesResult {
  success: boolean;
  responses?: InteractionResponseData[];
  error?: string;
}

/**
 * Tool for agents to retrieve user responses to interactions they created
 */
export async function getInteractionResponses(params: GetInteractionResponsesParams): Promise<GetInteractionResponsesResult> {
  try {
    const { agentId, interactionIds, since, limit = 50 } = params;

    if (!agentId) {
      return {
        success: false,
        error: 'Agent ID is required'
      };
    }

    // Build the query
    let query = supabase
      .from('interaction_responses')
      .select(`
        interaction_id,
        user_id,
        response,
        responded_at,
        interaction:user_interactions!interaction_id (
          question,
          entity_type,
          entity_id,
          metadata,
          agent_id
        )
      `)
      .eq('interaction.agent_id', agentId)
      .order('responded_at', { ascending: false })
      .limit(limit);

    // Add optional filters
    if (interactionIds && interactionIds.length > 0) {
      query = query.in('interaction_id', interactionIds);
    }

    if (since) {
      query = query.gte('responded_at', since);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching interaction responses:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Transform the data to flatten the structure
    const responses: InteractionResponseData[] = (data || [])
      .filter(item => item.interaction) // Filter out any without interaction data
      .map(item => ({
        interactionId: item.interaction_id,
        userId: item.user_id,
        question: item.interaction.question,
        response: item.response,
        respondedAt: item.responded_at,
        entityType: item.interaction.entity_type,
        entityId: item.interaction.entity_id,
        metadata: item.interaction.metadata
      }));

    return {
      success: true,
      responses
    };
  } catch (error) {
    console.error('Unexpected error fetching interaction responses:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Subscribe to real-time interaction responses for an agent
 */
export function subscribeToInteractionResponses(
  agentId: string,
  callback: (response: InteractionResponseData) => void
) {
  const channel = supabase
    .channel(`agent-responses:${agentId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'interaction_responses'
      },
      async (payload) => {
        // Get the full interaction details
        const { data: interaction } = await supabase
          .from('user_interactions')
          .select('*')
          .eq('id', payload.new.interaction_id)
          .eq('agent_id', agentId)
          .single();

        if (interaction) {
          callback({
            interactionId: payload.new.interaction_id,
            userId: payload.new.user_id,
            question: interaction.question,
            response: payload.new.response,
            respondedAt: payload.new.responded_at,
            entityType: interaction.entity_type,
            entityId: interaction.entity_id,
            metadata: interaction.metadata
          });
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    channel.unsubscribe();
  };
}

/**
 * Schema for LangChain/LangGraph tool integration
 */
export const getInteractionResponsesSchema = {
  name: 'get_interaction_responses',
  description: 'Retrieve user responses to interactions created by this agent',
  parameters: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The agent ID to get responses for'
      },
      interactionIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific interaction IDs to check'
      },
      since: {
        type: 'string',
        description: 'Optional: ISO date string to get responses since'
      },
      limit: {
        type: 'number',
        description: 'Optional: maximum number of responses to return (default 50)'
      }
    },
    required: ['agentId']
  }
};