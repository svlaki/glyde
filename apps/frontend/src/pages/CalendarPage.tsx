import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/authContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { fetchUserEvents, updateEvent, CalendarEvent } from '../lib/calendarService';
import { fetchUserTasks, Task } from '../lib/taskService';
import { InteractionBox, Interaction } from '../components/InteractionBox';
import { useInteractions } from '../lib/interactionContext';
import { useAgentInteractions } from '../lib/agentInteractionHook';
import { ChatPanel } from '../components/chat/ChatPanel';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/toast';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';


export function CalendarPage() {
  const { user } = useAuth();
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
  }, [taskLoadErrorShown, toast, user]);

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
  }, [eventLoadErrorShown, toast, transformEvent, user]);

  function handleDateClick(info: { dateStr: string }) {
    setSelectedDate(info.dateStr);
    setSelectedEvent(null);
    setIsModalOpen(true);
  }

  function handleEventClick(info: { event: { id: string; title: string; extendedProps: any } }) {
    const event = events.find(e => e.id === info.event.id);
    if (event) {
      setSelectedEvent(event);
      setSelectedDate(null);
      setIsModalOpen(true);
    }
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

  const handleCalendarEventUpdate = useCallback(async (
    eventId: string,
    updates: { start_time?: string | null; end_time?: string | null }
  ) => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in again to manage events.', variant: 'warning' });
      return false;
    }

    const payload: Record<string, string> = {};
    if (updates.start_time) {
      payload.start_time = updates.start_time;
    }
    if (updates.end_time) {
      payload.end_time = updates.end_time;
    }

    if (Object.keys(payload).length === 0) {
      return true;
    }

    try {
      const { error } = await updateEvent(user, eventId, payload);
      if (error) {
        throw new Error(error);
      }

      await loadUserEvents();
      return true;
    } catch (error) {
      console.error('Error updating event timing:', error);
      toast({ title: 'Unable to update event', description: 'Please try again.', variant: 'error' });
      return false;
    }
  }, [loadUserEvents, toast, user]);

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
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                timeZone={userTimezone}
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={events}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                editable={true}
                droppable={true}
                eventDrop={async (info) => {
                  const start = info.event.start ? info.event.start.toISOString() : null;
                  const end = info.event.end
                    ? info.event.end.toISOString()
                    : info.event.start
                      ? new Date(info.event.start.getTime() + 60 * 60 * 1000).toISOString()
                      : null;

                  if (!start) {
                    info.revert();
                    return;
                  }

                  const success = await handleCalendarEventUpdate(info.event.id, {
                    start_time: start,
                    end_time: end
                  });

                  if (!success) {
                    info.revert();
                  }
                }}
                eventResize={async (info) => {
                  const start = info.event.start ? info.event.start.toISOString() : null;
                  const end = info.event.end ? info.event.end.toISOString() : null;

                  if (!start || !end) {
                    info.revert();
                    return;
                  }

                  const success = await handleCalendarEventUpdate(info.event.id, {
                    start_time: start,
                    end_time: end
                  });

                  if (!success) {
                    info.revert();
                  }
                }}
                height="100%"
                themeSystem="standard"
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                allDaySlot={false}
                dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
                eventDisplay="block"
                displayEventTime={true}
                eventClassNames="rounded-md shadow-sm"
                nowIndicator={true}
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
                      <div className="mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
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

// Category colors mapping
const CATEGORY_COLORS: Record<string, string> = {
  'Work': '#3b82f6',
  'School': '#8b5cf6',
  'Health & Hygiene': '#ef4444',
  'Social': '#f97316',
  'Family': '#ec4899',
  'Personal': '#10b981',
  'Fitness': '#f59e0b',
  'Hobbies': '#06b6d4',
  'Finance': '#10b981',
  'Shopping': '#78716c',
  'Travel': '#6366f1',
  'Self-Care': '#ec4899'
};

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
        className="sm:max-w-md w-full max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl"
        aria-describedby="event-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {event ? '✏️ Edit Event' : '➕ Create Event'}
          </DialogTitle>
        </DialogHeader>
        <div id="event-dialog-description" className="sr-only">
          {event ? 'Edit the details of an existing calendar event' : 'Create a new calendar event by filling in the details below'}
        </div>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Event Title</label>
            <Input
              placeholder="Enter event title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
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
                className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
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
                className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
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
              className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-all"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>🏷️</span> Category
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full h-11 px-4 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
            >
              {Object.keys(CATEGORY_COLORS).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {CATEGORY_COLORS[category] && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border border-border">
                <div
                  className="w-5 h-5 rounded-full border-2 border-border shadow-sm"
                  style={{ backgroundColor: CATEGORY_COLORS[category] }}
                />
                <span className="text-sm text-muted-foreground font-medium">Event will appear in this color</span>
              </div>
            )}
          </div>


        </div>
        <DialogFooter className="flex justify-between pt-6 border-t border-border">
          <div>
            {event && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                className="h-11 px-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
              >
                🗑️ Delete
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="h-11 px-6 border-2 border-border bg-background text-foreground hover:bg-accent font-semibold rounded-lg transition-all"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              {event ? '💾 Save' : '➕ Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
