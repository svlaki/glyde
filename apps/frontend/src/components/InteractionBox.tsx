import React from 'react';
import { useInteractions, UIInteraction } from '../hooks/useInteractions';

export function InteractionBox() {
  const { interactions, loading, error, respondToInteraction, dismissInteraction } = useInteractions();

  if (loading) {
    return (
      <div className="h-[180px] p-3 bg-card border-t-2 border-border">
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading interactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[180px] p-3 bg-card border-t-2 border-border">
        <div className="h-full flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="h-[180px] p-3 bg-card border-t-2 border-border">
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">No pending interactions</p>
        </div>
      </div>
    );
  }

  const handleResponse = async (interaction: UIInteraction, response: string) => {
    await respondToInteraction(interaction.id, response);
  };

  // Sort interactions by priority (higher first)
  const sortedInteractions = [...interactions]
    .sort((a, b) => (b.priority || 5) - (a.priority || 5))
    .slice(0, 3); // Show max 3 cards

  return (
    <div className="h-[180px] p-3 bg-card border-t-2 border-border">
      <div className="h-full flex gap-3 overflow-x-auto">
        {sortedInteractions.map((interaction) => {
          const categoryColor = interaction.categoryColor || '#6b7280'; // Use color from DB or default gray

          // Calculate text color based on background brightness
          const getContrastColor = (bgColor: string) => {
            const color = bgColor.replace('#', '');
            const r = parseInt(color.substr(0, 2), 16);
            const g = parseInt(color.substr(2, 2), 16);
            const b = parseInt(color.substr(4, 2), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 140 ? '#000000' : '#FFFFFF';
          };

          const textColor = getContrastColor(categoryColor);

          return (
            <div
              key={interaction.id}
              className="relative flex-shrink-0 w-[140px] h-full rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
              style={{
                backgroundColor: categoryColor,
                border: `2px solid ${categoryColor}`,
              }}
            >
              {/* Card Border Design - Playing Card Style */}
              <div className="absolute inset-1 rounded-lg border-2 opacity-30"
                style={{ borderColor: textColor }}
              />

              {/* Card Content */}
              <div className="relative h-full p-3 flex flex-col justify-between">
                {/* Question */}
                <div className="flex-1 flex items-center pt-1">
                  <p className="text-xs font-medium text-center leading-tight"
                     style={{ color: textColor }}>
                    {interaction.question}
                  </p>
                </div>

                {/* Bottom: Action Buttons */}
                <div className="mt-2">
                  {interaction.type === 'yes_no' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleResponse(interaction, 'yes')}
                        className="flex-1 py-2 px-2 rounded-md text-xs font-bold transition-all hover:scale-105"
                        style={{
                          backgroundColor: `${textColor}20`,
                          color: textColor,
                          border: `1px solid ${textColor}40`
                        }}
                      >
                        ✓ Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResponse(interaction, 'no')}
                        className="flex-1 py-2 px-2 rounded-md text-xs font-bold transition-all hover:scale-105"
                        style={{
                          backgroundColor: `${textColor}20`,
                          color: textColor,
                          border: `1px solid ${textColor}40`
                        }}
                      >
                        ✗ No
                      </button>
                    </div>
                  )}

                  {interaction.type === 'confirmation' && (
                    <button
                      type="button"
                      onClick={() => handleResponse(interaction, 'confirm')}
                      className="w-full py-2 px-2 rounded-md text-xs font-bold transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${textColor}20`,
                        color: textColor,
                        border: `1px solid ${textColor}40`
                      }}
                    >
                      ✓ Confirm
                    </button>
                  )}

                  {interaction.type === 'multiple_choice' && interaction.options && (
                    <div className="flex flex-col gap-1">
                      {interaction.options.slice(0, 3).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleResponse(interaction, option)}
                          className="py-1 px-2 rounded text-xs font-medium transition-all hover:scale-105"
                          style={{
                            backgroundColor: `${textColor}20`,
                            color: textColor,
                            border: `1px solid ${textColor}40`
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Event Data Preview (if available) */}
                {interaction.metadata?.eventTitle && (
                  <div className="mt-1 pt-1 border-t opacity-60"
                    style={{ borderColor: `${textColor}30` }}
                  >
                    <p className="text-xs truncate" style={{ color: textColor }}>
                      {interaction.metadata.eventTitle}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}