import React from 'react';

export interface Interaction {
  id: string;
  question: string;
  type: 'yes_no' | 'multiple_choice';
  options?: string[];
  onResponse: (response: string) => void;
  eventData?: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  };
}

interface InteractionBoxProps {
  interactions: Interaction[];
  onResponseComplete: (interactionId: string, response: string) => void;
}

export function InteractionBox({ interactions, onResponseComplete }: InteractionBoxProps) {
  if (interactions.length === 0) {
    return (
      <div className="h-[140px] p-2 bg-white">
        <div className="h-full">
          <div className="bg-white rounded-lg p-2 h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm">No pending interactions</p>
          </div>
        </div>
      </div>
    );
  }

  const handleResponse = (interaction: Interaction, response: string) => {
    interaction.onResponse(response);
    onResponseComplete(interaction.id, response);
  };

  return (
    <div className="h-[140px] p-2 bg-white">
      <div className="h-full">
        <div className="bg-white rounded-lg p-2 h-full">
          <h3 className="text-lg font-light text-black mb-4">Quick Interactions</h3>
          
          <div className="flex gap-4 h-full">
            {interactions.slice(0, 2).map((interaction) => (
              <div key={interaction.id} className="flex-1 bg-white rounded-lg p-4 flex flex-col items-center justify-center">
                <p className="text-base text-gray-600 mb-4 text-center">{interaction.question}</p>
                
                {interaction.type === 'yes_no' && (
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => handleResponse(interaction, 'yes')}
                      className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                      style={{ 
                        backgroundColor: 'rgba(167, 243, 208, 0.7)', 
                        border: '1px solid rgba(5, 150, 105, 0.2)',
                        color: '#064e3b'
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResponse(interaction, 'no')}
                      className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                      style={{ 
                        backgroundColor: 'rgba(252, 165, 165, 0.7)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        color: '#7f1d1d'
                      }}
                    >
                      No
                    </button>
                  </div>
                )}

                {interaction.type === 'multiple_choice' && interaction.options && (
                  <div className="flex gap-2 justify-center flex-wrap">
                    {interaction.options.map((option, index) => {
                      const colors = [
                        { bg: 'rgba(253, 230, 138, 0.7)', border: 'rgba(217, 119, 6, 0.2)', text: '#78350f' },
                        { bg: 'rgba(147, 197, 253, 0.7)', border: 'rgba(37, 99, 235, 0.2)', text: '#1e3a8a' },
                        { bg: 'rgba(196, 181, 253, 0.7)', border: 'rgba(124, 58, 237, 0.2)', text: '#4c1d95' }
                      ];
                      const color = colors[index % colors.length];
                      
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleResponse(interaction, option)}
                          className="w-16 h-16 rounded-lg font-semibold text-xs transition-all duration-200 ease-in-out"
                          style={{
                            backgroundColor: color.bg,
                            border: `1px solid ${color.border}`,
                            color: color.text
                          }}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}