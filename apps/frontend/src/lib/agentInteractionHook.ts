import { useEffect, useRef } from 'react';
import { useAuth } from './authContext';
import { useInteractions } from './interactionContext';
import { Interaction } from '../components/InteractionBox';
import { post } from './apiClient';

export function useAgentInteractions() {
  const { user, session } = useAuth();
  const { addInteraction } = useInteractions();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const processedInteractionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !session?.access_token) return;

    async function pollForInteractions() {
      try {
        const response = await post<{ success?: boolean; interactions?: any[] }>(
          '/api/interactions/pending',
          {
            user_id: user!.id
          },
          {
            headers: {
              Authorization: `Bearer ${session!.access_token}`
            }
          }
        );

        if (response.ok && response.data?.success && Array.isArray(response.data.interactions)) {
          response.data.interactions.forEach((agentInteraction: any) => {
              // Skip if we've already processed this interaction
              if (processedInteractionIds.current.has(agentInteraction.id)) {
                return;
              }
              
              // Mark as processed
              processedInteractionIds.current.add(agentInteraction.id);
              
              const interaction: Omit<Interaction, 'id'> = {
                question: agentInteraction.question,
                type: agentInteraction.type || 'yes_no',
                options: agentInteraction.options,
                onResponse: async (response: string) => {
                  // Send response back to agent
                  try {
                    await post(
                      '/api/interactions/respond',
                      {
                        user_id: user!.id,
                        interaction_id: agentInteraction.id,
                        response
                      },
                      {
                        headers: {
                          Authorization: `Bearer ${session!.access_token}`
                        }
                      }
                    );
                    
                    // Keep in processed set so it won't show again
                    // processedInteractionIds.current.delete(agentInteraction.id);
                  } catch (error) {
                    console.error('Failed to send interaction response:', error);
                  }
                },
                eventData: agentInteraction.eventData
              };
              
              addInteraction(interaction);
            });
          }
        }
      } catch (error) {
        console.error('Failed to poll for interactions:', error);
      }
    }

    // Poll every 60 seconds for new interactions (reduced frequency for smarter interactions)
    pollingRef.current = setInterval(pollForInteractions, 60000);
    
    // Initial poll after a short delay to let the app settle
    setTimeout(pollForInteractions, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user, session, addInteraction]);
}