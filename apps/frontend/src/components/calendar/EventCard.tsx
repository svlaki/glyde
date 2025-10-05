import React from 'react';
import { format, parseISO } from 'date-fns';
import { ExtendedCalendarEvent } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: ExtendedCalendarEvent;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const startDate = parseISO(event.start_time);
  const endDate = parseISO(event.end_time);

  return (
    <div
      className={cn(
        "h-full rounded-md p-2 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
        "text-white overflow-hidden border-l-4"
      )}
      style={{
        backgroundColor: event.color || '#10b981',
        borderLeftColor: event.color || '#10b981'
      }}
      onClick={onClick}
    >
      <div className="flex flex-col h-full text-xs">
        <div className="font-semibold truncate">{event.title}</div>
        <div className="text-white/90 text-[10px]">
          {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
        </div>
        {event.location && (
          <div className="text-white/80 text-[10px] truncate mt-1">
            📍 {event.location}
          </div>
        )}
      </div>
    </div>
  );
}
