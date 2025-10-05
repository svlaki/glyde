import React, { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, addWeeks, isSameDay, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExtendedCalendarEvent } from '@/types/calendar';
import { EventCard } from './EventCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WeekCalendarProps {
  events: ExtendedCalendarEvent[];
  onEventClick: (event: ExtendedCalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => Promise<void>;
  userTimezone: string;
}

export function WeekCalendar({
  events,
  onEventClick,
  onDateClick,
  onEventDrop,
  userTimezone
}: WeekCalendarProps) {
  // Calculate week start so that today is the second day (index 1)
  const getWeekStartForToday = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return startOfWeek(yesterday, { weekStartsOn: 0 });
  };
  
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartForToday());

  // Generate array of days for the current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Navigate to previous week
  const goToPreviousWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, -1));
  };

  // Navigate to next week
  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  // Go to today
  const goToToday = () => {
    setCurrentWeekStart(getWeekStartForToday());
  };

  // Hours for time grid (12 AM to 11 PM) - full 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, ExtendedCalendarEvent[]> = {};

    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = events.filter(event => {
        const eventDate = parseISO(event.start_time);
        return isSameDay(eventDate, day);
      });
    });

    return grouped;
  }, [events, weekDays]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with navigation */}
      <Card className="flex items-center justify-between p-4 border-b rounded-none">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(currentWeekStart, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Week view grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 min-w-[800px]">
          {/* Time column */}
          <div className="col-span-1 border-r border-border">
            <div className="h-12 border-b border-border" /> {/* Header spacer */}
            {hours.map(hour => (
              <div
                key={hour}
                className="h-20 border-b border-border flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground"
              >
                {format(new Date().setHours(hour, 0), 'ha')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[dayKey] || [];
            const isToday = isSameDay(day, new Date());

            return (
              <div key={dayIndex} className="col-span-1 border-r border-border last:border-r-0">
                {/* Day header */}
                <div className={`h-12 border-b border-border flex flex-col items-center justify-center ${isToday ? 'bg-primary/10' : ''}`}>
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>

                {/* Time grid for this day */}
                <div className="relative">
                  {hours.map((hour, hourIndex) => (
                    <div
                      key={hourIndex}
                      className="h-20 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => {
                        const clickedDate = new Date(day);
                        clickedDate.setHours(hour, 0, 0, 0);
                        onDateClick(clickedDate);
                      }}
                    />
                  ))}

                  {/* Events overlay */}
                  <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
                    <div className="relative h-full px-1 pointer-events-auto">
                      {dayEvents.map((event, idx) => {
                        const startDate = parseISO(event.start_time);
                        const endDate = parseISO(event.end_time);

                        // Calculate position and height
                        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                        const endHour = endDate.getHours() + endDate.getMinutes() / 60;

                        // Clamp to visible range (12 AM - 11:59 PM)
                        const clampedStartHour = Math.max(0, Math.min(24, startHour));
                        const clampedEndHour = Math.max(0, Math.min(24, endHour));

                        const topOffset = (clampedStartHour / 24) * 100; // 12 AM = 0%, 11:59 PM = 100%
                        const height = ((clampedEndHour - clampedStartHour) / 24) * 100;

                        // Skip events with no valid time range
                        if (clampedEndHour <= clampedStartHour) {
                          return null;
                        }

                        return (
                          <div
                            key={event.id}
                            className="absolute left-0 right-0"
                            style={{
                              top: `${topOffset}%`,
                              height: `${Math.max(height, 2)}%`, // Minimum 2% height
                              zIndex: 10 + idx
                            }}
                          >
                            <EventCard
                              event={event}
                              onClick={() => onEventClick(event)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
