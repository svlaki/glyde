import React, { createContext, useContext, useState, useCallback } from 'react';
import { Interaction } from '../components/InteractionBox';

interface InteractionContextType {
  interactions: Interaction[];
  addInteraction: (interaction: Omit<Interaction, 'id'>) => void;
  removeInteraction: (id: string) => void;
  clearAllInteractions: () => void;
}

const InteractionContext = createContext<InteractionContextType | null>(null);

export function InteractionProvider({ children }: { children: React.ReactNode }) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const addInteraction = useCallback((interaction: Omit<Interaction, 'id'>) => {
    const newInteraction: Interaction = {
      ...interaction,
      id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setInteractions(prev => [...prev, newInteraction]);
  }, []);

  const removeInteraction = useCallback((id: string) => {
    setInteractions(prev => prev.filter(interaction => interaction.id !== id));
  }, []);

  const clearAllInteractions = useCallback(() => {
    setInteractions([]);
  }, []);

  return (
    <InteractionContext.Provider value={{
      interactions,
      addInteraction,
      removeInteraction,
      clearAllInteractions
    }}>
      {children}
    </InteractionContext.Provider>
  );
}

export function useInteractions() {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteractions must be used within an InteractionProvider');
  }
  return context;
}