import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SlotInfo } from 'react-big-calendar';
import { useAuth } from '../lib/authContext';
import { useCategories } from '../lib/categoryContext';
import { WeekCalendar } from '../components/calendar/WeekCalendar';
import { fetchUserEvents, updateEvent, createEvent, deleteEvent, CalendarEvent } from '../lib/calendarService';
import type { ExtendedCalendarEvent } from '../types/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fetchUserTasks, Task } from '../lib/taskService';
import { InteractionBox } from '../components/InteractionBox';
import { useInteractions } from '../lib/interactionContext';
import { useAgentInteractions } from '../lib/agentInteractionHook';
import { ChatPanel } from '../components/chat/ChatPanel';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/toast';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { MainCalendar, type CalendarInteractionArgs } from '../components/calendar/MainCalendar';
import type { ExtendedCalendarEvent } from '../types/calendar';
import { getCategoryColor } from '../lib/calendarCategories';

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';

export function CalendarPage() {
  const { user } = useAuth();
  const { categories, getCategoryColor } = useCategories();
  const { toast } = useToast();
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExtendedCalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('local');
  const { interactions, removeInteraction } = useInteractions();
  const eventLoadErrorShown = useRef(false);
  const taskLoadErrorShown = useRef(false);

  const transformEvent = useCallback((event: CalendarEvent): ExtendedCalendarEvent => {
    const category = event.category ?? 'Personal';
    const color = event.color ?? getCategoryColor(category);

    return {
      ...event,
      category,
      color,
      backgroundColor: color,
      borderColor: color,
      textColor: '#FFFFFF',
      start: event.start_time,
      end: event.end_time
    };
  }, []);

  // Connect to agent system for interactions
  useAgentInteractions();

  const loadUserTasks = useCallback(async () => {
    if (!user) return;

    try {
      const { tasks: userTasks, error } = await fetchUserTasks(user, { status: 'pending' });
      if (error) {
        console.error('Error loading user tasks:', error);
        setTasks([]);
        if (!taskLoadErrorShown.current) {
          toast({ title: 'Unable to load tasks', description: 'Please refresh to try again.', variant: 'error' });
          taskLoadErrorShown.current = true;
        }
        return;
      }

      taskLoadErrorShown.current = false;

      const sortedTasks = [...userTasks].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setTasks(sortedTasks);
    } catch (err) {
      console.error('Unexpected error loading tasks:', err);
      setTasks([]);
      if (!taskLoadErrorShown.current) {
        toast({ title: 'Unexpected task error', description: 'We could not load tasks right now.', variant: 'error' });
        taskLoadErrorShown.current = true;
      }
    }
  }, [toast, user]);

  const loadUserEvents = useCallback(async () => {
    if (!user) return;

    try {
      const { events: userEvents, error } = await fetchUserEvents(user);
      if (error) {
        console.error('Error loading user events:', error);
        setEvents([]);
        if (!eventLoadErrorShown.current) {
          toast({ title: 'Unable to load events', description: 'Please refresh to try again.', variant: 'error' });
          eventLoadErrorShown.current = true;
        }
        return;
      }

      eventLoadErrorShown.current = false;
      const formattedEvents = userEvents.map(transformEvent);
      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading user events:', error);
      setEvents([]);
      if (!eventLoadErrorShown.current) {
        toast({ title: 'Unexpected calendar error', description: 'We could not load your events.', variant: 'error' });
        eventLoadErrorShown.current = true;
      }
    }
  }, [toast, transformEvent, user]);

  // Fetch user timezone from profile
  useEffect(() => {
    if (!user) {
      return;
    }

    let isCancelled = false;

    const fetchTimezone = async () => {
      try {
        const response = await fetch(`${AGENT_SERVICE_URL}/api/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id })
        });

        if (!response.ok) {
          return;
        }

        const profile = await response.json();

        if (!isCancelled && profile?.timezone) {
          setUserTimezone(profile.timezone);
        }
      } catch (error) {
        console.error('Failed to fetch user timezone:', error);
      }
    };

    fetchTimezone();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  // Load real user events and tasks from the backend
  useEffect(() => {
    if (!user) {
      setEvents([]);
      setTasks([]);
      return;
    }

    loadUserEvents();
    loadUserTasks();

    const channel = supabase
      .channel(`events-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadUserEvents();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loadUserEvents, loadUserTasks, user]);

  function handleDateClick(date: Date) {
    setSelectedDate(date.toISOString());
    setSelectedEvent(null);
    setIsModalOpen(true);
  }, []);

  function handleEventClick(event: ExtendedCalendarEvent) {
    setSelectedEvent(event);
    setSelectedDate(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  }


  const handleInteractionResponse = useCallback((interactionId: string, response: string) => {
    removeInteraction(interactionId);
    if (response !== 'no') {
      setTimeout(() => {
        loadUserEvents();
      }, 1000);
    }
  }, [loadUserEvents, removeInteraction]);

  const handleEventDrop = useCallback(async (
    eventId: string,
    newStart: Date,
    newEnd: Date
  ) => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in again to manage events.', variant: 'warning' });
      return;
    }

    try {
      const { error } = await updateEvent(user, eventId, {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString()
      });
      
      if (error) {
        throw new Error(error);
      }

      await loadUserEvents();
    } catch (error) {
      console.error('Error updating event timing:', error);
      toast({ title: 'Unable to update event', description: 'Please try again.', variant: 'error' });
    }
  }, [loadUserEvents, toast, user]);

  const handleEventMove = useCallback(async (
    args: CalendarInteractionArgs
  ) => {
    const { event, start, end } = args;
    const fallbackEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);

    const success = await handleCalendarEventUpdate(event.id, {
      start_time: start.toISOString(),
      end_time: fallbackEnd.toISOString(),
    });

    if (!success) {
      await loadUserEvents();
    }
  }, [handleCalendarEventUpdate, loadUserEvents]);

  const handleEventResize = useCallback(async (
    args: CalendarInteractionArgs
  ) => {
    const { event, start, end } = args;

    if (!end) {
      await loadUserEvents();
      return;
    }

    const success = await handleCalendarEventUpdate(event.id, {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });

    if (!success) {
      await loadUserEvents();
    }
  }, [handleCalendarEventUpdate, loadUserEvents]);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="flex h-screen">
        {/* Left Side - Calendar */}
        <div className="flex-1 flex flex-col border-r-4 border-black">
          {/* Header */}
          <div className="bg-white p-2 border-b-2 border-black">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-light text-black">Calendar</h1>
              <div className="text-sm text-gray-500">Welcome, {user?.email}</div>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 p-2 bg-white">
            <div className="h-full bg-white rounded-lg p-1">
              <WeekCalendar
                events={events}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
                onEventDrop={handleEventDrop}
                userTimezone={userTimezone}
              />
            </div>
          </div>

          {/* Interactions Box - Bottom */}
          <div className="border-t-4 border-black">
            <InteractionBox 
              interactions={interactions}
              onResponseComplete={handleInteractionResponse}
            />
          </div>
        </div>

        {/* Right Side - Chat + Task List */}
        <div className="w-96 bg-white flex flex-col" style={{ maxWidth: '384px', minWidth: '384px' }}>
          {/* Chat Panel - Half Height */}
          <div className="h-1/2 p-3 overflow-hidden border-b-2 border-gray-200">
            <div className="h-full overflow-hidden">
              <ChatPanel onEventCreated={loadUserEvents} />
            </div>
          </div>

          {/* Task List - Half Height */}
          <div className="h-1/2 p-4 overflow-y-auto">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Upcoming Tasks</h3>
              <p className="text-xs text-gray-500">Sorted by due date</p>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900 flex-1">{task.title}</h4>
                      {task.priority && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.priority}
                        </span>
                      )}
                    </div>

                    {task.due_date && (
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <span>📅</span>
                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                      </div>
                    )}

                    {task.category && (
                      <div className="mt-1 flex items-center gap-1">
                        <div
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: getCategoryColor(task.category) }}
                        />
                        <span className="text-xs text-gray-700">
                          {task.category}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          event={selectedEvent}
          date={selectedDate}
          onSave={loadUserEvents}
          user={user}
          toast={toast}
          userTimezone={userTimezone}
        />
      )}

    </div>
  );
}

export default CalendarPage

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ExtendedCalendarEvent | null;
  date: string | null;
  onSave: () => void;
  user: { id: string; email?: string };
  toast: (options: { title: string; description: string; variant?: string }) => void;
  userTimezone: string;
}

function EventModal({ isOpen, onClose, event, date, onSave, user, toast, userTimezone }: EventModalProps) {
  const { categories, getCategoryColor } = useCategories();
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      // Convert UTC time to user's timezone for display in the form
      const startDate = toZonedTime(new Date(event.start_time), userTimezone);
      const endDate = toZonedTime(new Date(event.end_time), userTimezone);
      setStartTime(format(startDate, 'HH:mm'));
      setEndTime(format(endDate, 'HH:mm'));
      setDescription(event.description || '');
      setCategory(event.category || 'Personal');
    } else {
      setTitle('');
      setStartTime('10:00');
      setEndTime('11:00');
      setDescription('');
      setCategory('Personal');
    }
  }, [event, userTimezone]);

  async function handleSave() {
    if (!user || !title.trim()) return;

    const baseDate = date ? date.split('T')[0] : (event?.start_time.split('T')[0]);
    if (!baseDate) return;

    // Convert from user's timezone to UTC for storage
    const starts_at = fromZonedTime(`${baseDate}T${startTime}:00`, userTimezone);
    const ends_at = fromZonedTime(`${baseDate}T${endTime}:00`, userTimezone);

    const eventData = {
      title: title.trim(),
      start_time: starts_at.toISOString(),
      end_time: ends_at.toISOString(),
      description: description.trim(),
      category: category,
    };

    try {
      if (event) {
        await updateEvent(user, event.id, eventData);
        toast({
          title: 'Event updated',
          description: `"${title}" has been updated successfully`,
          variant: 'success'
        });
      } else {
        await createEvent(user, eventData);
        toast({
          title: 'Event created',
          description: `"${title}" has been added to your calendar`,
          variant: 'success'
        });
      }
      onSave();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: event ? 'Failed to update event' : 'Failed to create event',
        variant: 'error'
      });
    }
  }

  async function handleDelete() {
    if (!user || !event) return;
    try {
      await deleteEvent(user, event.id);
      toast({
        title: 'Event deleted',
        description: `"${event.title}" has been removed from your calendar`,
        variant: 'success'
      });
      onSave();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'error'
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-full max-w-[500px] sm:max-w-[520px] max-h-[85vh] overflow-y-auto rounded-3xl border border-border/70 bg-gradient-to-br from-background via-muted/40 to-muted shadow-2xl"
        aria-describedby="event-dialog-description"
      >
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {event ? '✏️ Edit Event' : '➕ Create Event'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {event ? 'Refresh the details of your existing event with a cleaner, more focused layout.' : 'Craft a new calendar event with thoughtfully spaced inputs for easier scanning.'}
          </p>
        </DialogHeader>
        <div id="event-dialog-description" className="sr-only">
          {event ? 'Edit the details of an existing calendar event' : 'Create a new calendar event by filling in the details below'}
        </div>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Event Title</label>
            <Input
              placeholder="Enter event title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-12 rounded-2xl border-2 border-border/60 bg-background/90 px-4 text-base shadow-sm transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>🕐</span> Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="h-12 rounded-2xl border-2 border-border/60 bg-background/90 px-4 text-base shadow-sm transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>🕐</span> End Time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="h-12 rounded-2xl border-2 border-border/60 bg-background/90 px-4 text-base shadow-sm transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>📝</span> Description
            </label>
            <textarea
              placeholder="Add event details..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full resize-none rounded-2xl border-2 border-border/60 bg-background/90 px-4 py-4 text-base text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>🏷️</span> Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-12 cursor-pointer rounded-2xl border-2 border-border/60 bg-background/90 px-4 text-base text-foreground shadow-sm transition-all focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.icon ? `${cat.icon} ${cat.name}` : cat.name}</option>
              ))}
            </select>
            {getCategoryColor(category) && (
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border/70 bg-accent/40 px-3 py-3 shadow-inner">
                <div
                  className="h-5 w-5 rounded-full border-2 border-border/80 shadow-sm"
                  style={{ backgroundColor: getCategoryColor(category) }}
                />
                <span className="text-sm text-muted-foreground font-medium">Event will appear in this color</span>
              </div>
            )}
          </div>


        </div>
        <DialogFooter className="flex justify-between pt-6 border-t border-border/60">
          <div>
            {event && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="h-11 rounded-2xl border border-destructive/30 bg-destructive px-6 font-semibold text-destructive-foreground shadow-sm transition-all hover:bg-destructive/90 hover:shadow-md"
              >
                🗑️ Delete
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-11 rounded-2xl border-2 border-border/70 bg-background/90 px-6 font-semibold text-foreground transition-all hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="h-11 rounded-2xl border border-primary/40 bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              {event ? '💾 Save' : '➕ Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
