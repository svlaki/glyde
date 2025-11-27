import { supabase } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';

export interface DBInteraction {
  id: string;
  user_id: string;
  agent_id: string;
  interaction_type: 'yes_no' | 'multiple_choice' | 'confirmation' | 'input';
  question: string;
  options?: string[];
  priority: number;
  category_id?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  expires_at?: string;
  created_at: string;
  status: 'pending' | 'responded' | 'expired' | 'cancelled';
}

export interface DBInteractionResponse {
  id: string;
  interaction_id: string;
  user_id: string;
  response: string;
  responded_at: string;
}

export interface InteractionWithCategory extends DBInteraction {
  category?: {
    id: string;
    name: string;
    color: string;
  };
}

class InteractionService {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;

  async initialize(userId: string) {
    this.userId = userId;
    await this.setupRealtimeSubscription();
  }

  private async setupRealtimeSubscription() {
    if (!this.userId) return;

    // Clean up existing subscription
    if (this.channel) {
      await this.channel.unsubscribe();
    }

    // Create new subscription for user's interactions
    this.channel = supabase
      .channel(`interactions:${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_interactions',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          // Emit custom event for React components to listen to
          window.dispatchEvent(
            new CustomEvent('interaction-update', {
              detail: {
                type: payload.eventType,
                interaction: payload.new || payload.old
              }
            })
          );
        }
      )
      .subscribe();
  }

  async getPendingInteractions(): Promise<InteractionWithCategory[]> {
    if (!this.userId) throw new Error('User not initialized');

    const { data, error } = await supabase
      .from('user_interactions')
      .select(`
        *,
        category:categories(id, name, color)
      `)
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching interactions:', error);
      throw error;
    }

    return data || [];
  }

  async respondToInteraction(interactionId: string, response: string): Promise<{ agentResponse?: string; metadata?: any }> {
    if (!this.userId) throw new Error('User not initialized');

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('No active session found');
    }

    // Save the interaction response and get agent response in one call
    // The backend handles all the context-aware processing
    const respondResponse = await fetch(`${AGENT_SERVICE_URL}/api/interactions/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        interaction_id: interactionId,
        response
      })
    });

    if (!respondResponse.ok) {
      const errorBody = await respondResponse.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to respond to interaction');
    }

    const result = await respondResponse.json();
    return {
      agentResponse: result.agentResponse,
      metadata: result.metadata
    };
  }

  async dismissInteraction(interactionId: string): Promise<void> {
    if (!this.userId) throw new Error('User not initialized');

    const { error } = await supabase
      .from('user_interactions')
      .update({ status: 'cancelled' })
      .eq('id', interactionId)
      .eq('user_id', this.userId);

    if (error) {
      console.error('Error dismissing interaction:', error);
      throw error;
    }
  }

  async createInteraction(interaction: Omit<DBInteraction, 'id' | 'created_at' | 'user_id'>): Promise<DBInteraction> {
    if (!this.userId) throw new Error('User not initialized');

    const { data, error } = await supabase
      .from('user_interactions')
      .insert({
        ...interaction,
        user_id: this.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating interaction:', error);
      throw error;
    }

    return data;
  }

  async getInteractionHistory(limit: number = 50): Promise<Array<DBInteraction & { response?: DBInteractionResponse }>> {
    if (!this.userId) throw new Error('User not initialized');

    const { data, error } = await supabase
      .from('user_interactions')
      .select(`
        *,
        response:interaction_responses!interaction_id(*)
      `)
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching interaction history:', error);
      throw error;
    }

    return data || [];
  }

  async expireOldInteractions(): Promise<void> {
    if (!this.userId) throw new Error('User not initialized');

    const { error } = await supabase
      .from('user_interactions')
      .update({ status: 'expired' })
      .eq('user_id', this.userId)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error expiring interactions:', error);
    }
  }

  async generateSuggestions(): Promise<void> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('No active session found');
    }

    if (!this.userId) {
      throw new Error('User not initialized');
    }

    // Call the agent to generate suggestions
    // The agent will use create_interaction tool to create interactive prompts
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const apiResponse = await fetch(`${AGENT_SERVICE_URL}/api/agent/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        context: {
          userId: this.userId,
          sessionId: `suggestions-${Date.now()}`,
          timezone: userTimezone,
          conversationHistory: []
        },
        message: 'Generate some personalized suggestions or interactions based on my calendar, tasks, and goals. Create interactive prompts that I can respond to.',
        isInternal: true // Internal message - don't store in chat
      })
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to generate suggestions');
    }
  }

  cleanup() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
  }
}

export const interactionService = new InteractionService();