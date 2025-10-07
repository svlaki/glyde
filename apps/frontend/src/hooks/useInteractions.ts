import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
import { interactionService, InteractionWithCategory } from '../lib/interactions/interactionService';
import { useCategories } from '../lib/categoryContext';

export interface UIInteraction {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'confirmation';
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
      setInteractions(transformed);
    } catch (err) {
      console.error('Error loading interactions:', err);
      setError('Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, transformInteraction]);

  // Handle interaction response
  const respondToInteraction = useCallback(async (interactionId: string, response: string) => {
    try {
      await interactionService.respondToInteraction(interactionId, response);

      // Remove from UI immediately for better UX
      setInteractions(prev => prev.filter(i => i.id !== interactionId));
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
        // Add new interaction
        const transformed = transformInteraction(interaction);
        setInteractions(prev => [...prev, transformed].sort((a, b) => b.priority - a.priority));
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

  // Periodic check for expired interactions (every minute)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(async () => {
      await interactionService.expireOldInteractions();
      await loadInteractions();
    }, 60000);

    return () => clearInterval(interval);
  }, [user?.id, loadInteractions]);

  return {
    interactions,
    loading,
    error,
    respondToInteraction,
    dismissInteraction,
    refreshInteractions: loadInteractions,
  };
}