import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
import { interactionService, InteractionWithCategory } from '../lib/interactions/interactionService';
import { useCategories } from '../lib/categoryContext';

export interface UIInteraction {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice';
  options?: string[];
  priority: number;
  category?: string;
  categoryColor?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export function useInteractions() {
  const [interactions, setInteractions] = useState<UIInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { categories } = useCategories();

  // Transform DB interaction to UI format
  const transformInteraction = useCallback((dbInteraction: InteractionWithCategory): UIInteraction => {
    // Find category details
    const category = dbInteraction.category ||
      (dbInteraction.category_id ? categories.find(c => c.id === dbInteraction.category_id) : null);

    return {
      id: dbInteraction.id,
      question: dbInteraction.question,
      type: dbInteraction.interaction_type as UIInteraction['type'],
      options: dbInteraction.options,
      priority: dbInteraction.priority,
      category: category?.name,
      categoryColor: category?.color,
      entityId: dbInteraction.entity_id,
      metadata: dbInteraction.metadata,
    };
  }, [categories]);

  // Load initial interactions
  const loadInteractions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // First expire any old interactions
      await interactionService.expireOldInteractions();

      // Then fetch pending interactions
      const pending = await interactionService.getPendingInteractions();
      const transformed = pending.map(transformInteraction);

      // Merge with existing interactions, avoiding duplicates
      setInteractions(prev => {
        // Create a map of existing IDs for quick lookup
        const existingIds = new Set(prev.map(i => i.id));
        // Filter out any incoming interactions that already exist
        const newInteractions = transformed.filter(i => !existingIds.has(i.id));
        // Combine and sort
        return [...prev, ...newInteractions].sort((a, b) => b.priority - a.priority);
      });
    } catch (err) {
      console.error('Error loading interactions:', err);
      setError('Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, transformInteraction]);

  // Handle interaction response
  const respondToInteraction = useCallback(async (interactionId: string, response: string, onChatMessage?: (message: string) => void) => {
    try {
      console.log('[useInteractions] Responding to interaction:', interactionId, 'response:', response);
      const result = await interactionService.respondToInteraction(interactionId, response);
      console.log('[useInteractions] Interaction response result:', result);

      // Remove from UI immediately for better UX
      setInteractions(prev => prev.filter(i => i.id !== interactionId));

      // If agent provided a response and callback is provided, send to chat
      if (result.agentResponse) {
        console.log('[useInteractions] Got agent response, calling callback:', result.agentResponse);
        if (onChatMessage) {
          onChatMessage(result.agentResponse);
        } else {
          console.warn('[useInteractions] onChatMessage callback not provided, response will not appear in chat');
        }
      } else {
        console.warn('[useInteractions] No agentResponse in result');
      }
    } catch (err) {
      console.error('Error responding to interaction:', err);
      setError('Failed to save response');
    }
  }, []);

  // Handle interaction dismissal
  const dismissInteraction = useCallback(async (interactionId: string) => {
    try {
      await interactionService.dismissInteraction(interactionId);

      // Remove from UI immediately
      setInteractions(prev => prev.filter(i => i.id !== interactionId));
    } catch (err) {
      console.error('Error dismissing interaction:', err);
      setError('Failed to dismiss interaction');
    }
  }, []);

  // Initialize service and set up listeners
  useEffect(() => {
    if (!user?.id) return;

    const initializeService = async () => {
      await interactionService.initialize(user.id);
      await loadInteractions();
    };

    initializeService();

    // Listen for real-time updates
    const handleInteractionUpdate = async (event: CustomEvent) => {
      const { type, interaction } = event.detail;

      if (type === 'INSERT' && interaction.status === 'pending') {
        // Add new interaction only if not already present
        setInteractions(prev => {
          // Check if interaction already exists
          if (prev.some(i => i.id === interaction.id)) {
            console.log('[useInteractions] Ignoring duplicate interaction:', interaction.id);
            return prev;
          }
          const transformed = transformInteraction(interaction);
          return [...prev, transformed].sort((a, b) => b.priority - a.priority);
        });
      } else if (type === 'UPDATE') {
        if (interaction.status !== 'pending') {
          // Remove if no longer pending
          setInteractions(prev => prev.filter(i => i.id !== interaction.id));
        } else {
          // Update existing interaction
          const transformed = transformInteraction(interaction);
          setInteractions(prev =>
            prev.map(i => i.id === interaction.id ? transformed : i)
              .sort((a, b) => b.priority - a.priority)
          );
        }
      } else if (type === 'DELETE') {
        // Remove deleted interaction
        setInteractions(prev => prev.filter(i => i.id !== interaction.id));
      }
    };

    window.addEventListener('interaction-update', handleInteractionUpdate as EventListener);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('interaction-update', handleInteractionUpdate as EventListener);
      interactionService.cleanup();
    };
  }, [user?.id, loadInteractions, transformInteraction]);

  // Periodic refresh: check for new interactions every 10 seconds initially, then every 60 seconds
  useEffect(() => {
    if (!user?.id) return;

    // Fast poll for first 2 minutes (catch startup interactions quickly)
    let fastPollInterval: NodeJS.Timeout | null = setInterval(async () => {
      await interactionService.expireOldInteractions();
      await loadInteractions();
    }, 10000); // 10 seconds

    // After 2 minutes, switch to slower polling
    const slowPollTimer = setTimeout(() => {
      if (fastPollInterval) clearInterval(fastPollInterval);
      fastPollInterval = setInterval(async () => {
        await interactionService.expireOldInteractions();
        await loadInteractions();
      }, 60000); // 60 seconds
    }, 120000); // 2 minutes

    return () => {
      if (fastPollInterval) clearInterval(fastPollInterval);
      clearTimeout(slowPollTimer);
    };
  }, [user?.id, loadInteractions]);

  const generateSuggestions = useCallback(async () => {
    try {
      await interactionService.generateSuggestions();
      // After generation, wait a moment then refresh to pick up new interactions
      setTimeout(() => {
        loadInteractions();
      }, 500);
    } catch (err) {
      console.error('Error generating suggestions:', err);
      setError('Failed to generate suggestions');
    }
  }, [loadInteractions]);

  return {
    interactions,
    loading,
    error,
    respondToInteraction,
    dismissInteraction,
    refreshInteractions: loadInteractions,
    generateSuggestions,
  };
}