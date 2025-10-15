import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SlotInfo } from 'react-big-calendar';
import { useAuth } from '../lib/authContext';
import { useCategories } from '../lib/categoryContext';
import { fetchUserEvents, updateEvent, createEvent, deleteEvent, CalendarEvent } from '../lib/calendarService';
import type { ExtendedCalendarEvent } from '../types/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fetchUserTasks, Task } from '../lib/taskService';
import { InteractionBox } from '../components/InteractionBox';
import { ChatPanel } from '../components/chat/ChatPanel';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/toast';
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { MainCalendar, type CalendarInteractionArgs } from '../components/calendar/MainCalendar';
import { getCategoryColor } from '../lib/calendarCategories';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { Drawer, Button as MantineButton, NavLink, Divider, Menu } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/calendar', label: 'Calendar', icon: '📅' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
  { path: '/goals', label: 'Goals', icon: '🎯' },
  { path: '/profile', label: 'Profile', icon: '👤' },
  { path: '/categories', label: 'Categories', icon: '🏷️' }
];

const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';

export function CalendarPage() {
  const { user, session, signOut } = useAuth();
  const { categories, getCategoryColor } = useCategories();
  const { toast } = useToast();
  const location = useLocation();
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExtendedCalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('America/Chicago'); // Default to Chicago, will be overridden by profile
  const [mobileOpen, setMobileOpen] = useState(false);
  const [triggeringAgent, setTriggeringAgent] = useState(false);
  const eventLoadErrorShown = useRef(false);
  const taskLoadErrorShown = useRef(false);

  const transformEvent = useCallback((event: CalendarEvent): ExtendedCalendarEvent => {
    const category = event.category ?? 'Personal';
    const color = event.color ?? getCategoryColor(category);

    // Don't add start/end Date properties here - MainCalendar will create them from start_time/end_time
    return {
      ...event,
      category,
      color,
      backgroundColor: color,
      borderColor: color,
      textColor: '#FFFFFF',
    };
  }, [getCategoryColor]);


  const loadUserTasks = useCallback(async () => {
    if (!user || !session?.access_token) return;

    try {
      const { tasks: userTasks, error } = await fetchUserTasks(user, session.access_token, { status: 'pending' });
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

      console.log('📋 [CalendarPage] Loaded tasks with categories:', sortedTasks.map(t => ({
        title: t.title,
        category: t.category,
        category_name: t.category_name,
        category_color: t.category_color
      })));

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

    console.log('[CalendarPage] Loading events for user:', user.id);

    try {
      const { events: userEvents, error } = await fetchUserEvents(user, session?.access_token);

      console.log('[CalendarPage] Fetch result:', { count: userEvents?.length, error });

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

      console.log('[CalendarPage] Formatted events:', formattedEvents.length);
      console.log('[CalendarPage] Sample event:', formattedEvents[0]);

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error loading user events:', error);
      setEvents([]);
      if (!eventLoadErrorShown.current) {
        toast({ title: 'Unexpected calendar error', description: 'We could not load your events.', variant: 'error' });
        eventLoadErrorShown.current = true;
      }
    }
  }, [toast, transformEvent, user, session]);

  // Fetch user timezone from profile
  useEffect(() => {
    if (!user || !session?.access_token) {
      return;
    }

    let isCancelled = false;

    const fetchTimezone = async () => {
      try {
        const response = await fetch(`${AGENT_SERVICE_URL}/api/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
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
  }, [user, session]);

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

  const handleDateClick = useCallback((slotInfo: SlotInfo) => {
    setSelectedDate(slotInfo.start.toISOString());
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



  const handleCalendarEventUpdate = useCallback(async (
    eventId: string,
    updates: { start_time: string; end_time: string }
  ): Promise<boolean> => {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in again to manage events.', variant: 'warning' });
      return false;
    }

    try {
      const { error } = await updateEvent(user, eventId, updates, session?.access_token);

      if (error) {
        throw new Error(error);
      }

      await loadUserEvents();
      return true;
    } catch (error) {
      console.error('Error updating event:', error);
      toast({ title: 'Unable to update event', description: 'Please try again.', variant: 'error' });
      return false;
    }
  }, [loadUserEvents, toast, user, session]);;

  const handleEventMove = useCallback(async (
    args: CalendarInteractionArgs
  ) => {
    const { event, start, end } = args;
    const fallbackEnd = end ?? new Date(start.getTime() + 60 * 60 * 1000);

    // Convert from user's timezone to UTC for storage
    // The dates from react-big-calendar are already in the user's timezone after resolveDate conversion
    const startUTC = fromZonedTime(start, userTimezone);
    const endUTC = fromZonedTime(fallbackEnd, userTimezone);

    await handleCalendarEventUpdate(event.id, {
      start_time: startUTC.toISOString(),
      end_time: endUTC.toISOString(),
    });
  }, [handleCalendarEventUpdate, userTimezone]);

  const handleEventResize = useCallback(async (
    args: CalendarInteractionArgs
  ) => {
    const { event, start, end } = args;

    if (!end) {
      return;
    }

    // Convert from user's timezone to UTC for storage
    // The dates from react-big-calendar are already in the user's timezone after resolveDate conversion
    const startUTC = fromZonedTime(start, userTimezone);
    const endUTC = fromZonedTime(end, userTimezone);

    await handleCalendarEventUpdate(event.id, {
      start_time: startUTC.toISOString(),
      end_time: endUTC.toISOString(),
    });
  }, [handleCalendarEventUpdate, userTimezone]);

  // Auto-trigger proactive agent on login (once per session)
  const hasTriggeredProactiveRef = useRef(false);
  useEffect(() => {
    if (!user || !session?.access_token || !userTimezone) return;
    if (hasTriggeredProactiveRef.current) return;

    hasTriggeredProactiveRef.current = true;

    // Wait a bit for tasks/events to load, then trigger proactive agent
    const timer = setTimeout(async () => {
      try {
        console.log('[CalendarPage] Auto-triggering proactive agent on login');
        const response = await fetch(`${AGENT_SERVICE_URL}/api/agents/proactive/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ timezone: userTimezone })
        });

        const result = await response.json();
        console.log('[CalendarPage] Proactive agent result:', result);
      } catch (error) {
        console.error('[CalendarPage] Failed to auto-trigger proactive agent:', error);
      }
    }, 3000); // Wait 3 seconds for initial data to load

    return () => clearTimeout(timer);
  }, [user, session, userTimezone]);

  const handleTriggerProactiveAgent = useCallback(async () => {
    if (!user || !session?.access_token) {
      toast({
        title: 'Unable to run agents',
        description: 'Please sign in again to trigger proactive suggestions.',
        variant: 'warning'
      });
      return;
    }

    setTriggeringAgent(true);
    try {
      const response = await fetch(`${AGENT_SERVICE_URL}/api/agents/proactive/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ timezone: userTimezone })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Unexpected error while running the agent');
      }

      toast({
        title: 'Proactive planner updated',
        description: result?.message || 'Created fresh suggestions based on your schedule.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to trigger proactive agent:', error);
      toast({
        title: 'Agent run failed',
        description: error instanceof Error ? error.message : 'Something went wrong while running the agent.',
        variant: 'error'
      });
    } finally {
      setTriggeringAgent(false);
    }
  }, [session, toast, user, userTimezone]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-screen">
        {/* Left Side - Calendar */}
        <div className="flex-1 flex flex-col border-r-4 border-border">
          {/* Compact Header with Menu and Dark Mode */}
          <div className="bg-card px-3 py-1 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                  aria-label="Toggle menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-foreground">Calendar</span>
              </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Menu withinPortal>
              <Menu.Target>
                <MantineButton size="xs" variant="light" loading={triggeringAgent}>
                  Agents
                </MantineButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Automation</Menu.Label>
                <Menu.Item onClick={handleTriggerProactiveAgent} disabled={triggeringAgent}>
                  Run proactive planner
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Coming soon</Menu.Label>
                <Menu.Item disabled>More agents on the way</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <span className="text-xs text-muted-foreground">Welcome, {user?.email}</span>
          </div>
        </div>
      </div>

          {/* Calendar */}
          <div className="flex-1 p-2 bg-background min-h-0 overflow-hidden">
            <div className="h-full bg-card rounded-lg p-1 overflow-hidden">
              <MainCalendar
                events={events}
                onSelectEvent={handleEventClick}
                onSelectSlot={handleDateClick}
                onEventDrop={handleEventMove}
                onEventResize={handleEventResize}
                userTimezone={userTimezone}
              />
            </div>
          </div>

          {/* Interactions Box - Bottom */}
          <div>
            <InteractionBox />
          </div>
        </div>

        {/* Right Side - Chat + Task List */}
        <div className="bg-card flex flex-col" style={{ width: '320px', minWidth: '320px', maxWidth: '320px' }}>
          {/* Chat Panel - Half Height */}
          <div className="h-1/2 p-3 overflow-hidden border-b-2 border-border">
            <div className="h-full overflow-hidden">
              <ChatPanel onEventCreated={loadUserEvents} />
            </div>
          </div>

          {/* Task List - Half Height */}
          <div className="h-1/2 p-4 overflow-y-auto">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-foreground">To-Do</h3>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const categoryColor = task.category_color || getCategoryColor(task.category || '');

                  return (
                    <div
                      key={task.id}
                      className="bg-card border-l-4 border-r border-t border-b border-border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                      style={{ borderLeftColor: categoryColor }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-medium text-foreground flex-1">{task.title}</h4>
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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>📅</span>
                          <span>{new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {(task.category_name || task.category) && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground">
                            {task.category_name || task.category}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
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
          accessToken={session?.access_token}
        />
      )}

      {/* Navigation Drawer */}
      <Drawer
        opened={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="text-lg font-bold">Navigation</span>
          </div>
        }
        padding="md"
        size="sm"
      >
        <div className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              component={Link}
              to={item.path}
              label={item.label}
              leftSection={<span className="text-xl">{item.icon}</span>}
              active={location.pathname === item.path}
              onClick={() => setMobileOpen(false)}
              variant="filled"
              styles={{
                root: {
                  borderRadius: '8px',
                  fontWeight: 600,
                },
              }}
            />
          ))}
        </div>

        <Divider my="md" />

        <MantineButton
          variant="subtle"
          color="red"
          fullWidth
          onClick={() => {
            setMobileOpen(false)
            signOut()
          }}
        >
          Sign Out
        </MantineButton>
      </Drawer>

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
  accessToken?: string;
}

function EventModal({ isOpen, onClose, event, date, onSave, user, toast, userTimezone, accessToken }: EventModalProps) {
  const { categories, getCategoryColor } = useCategories();
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
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
      
      // Validate dates before formatting
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        setEventDate(format(startDate, 'yyyy-MM-dd'));
        setStartTime(format(startDate, 'HH:mm'));
        setEndTime(format(endDate, 'HH:mm'));
      } else {
        setEventDate(format(new Date(), 'yyyy-MM-dd'));
        setStartTime('10:00');
        setEndTime('11:00');
      }
      setDescription(event.description || '');
      setCategory(event.category || 'Personal');
    } else if (date) {
      // Extract time from the clicked slot
      const clickedDate = new Date(date);
      setTitle('');
      setEventDate(format(clickedDate, 'yyyy-MM-dd'));
      
      // Check if it's midnight (day click) or actual time (slot click)
      const hours = clickedDate.getHours();
      const minutes = clickedDate.getMinutes();
      if (hours === 0 && minutes === 0) {
        // Day header was clicked, use default time
        setStartTime('10:00');
        setEndTime('11:00');
      } else {
        // Time slot was clicked, use that time
        setStartTime(format(clickedDate, 'HH:mm'));
        const endDate = new Date(clickedDate.getTime() + 60 * 60 * 1000); // +1 hour
        setEndTime(format(endDate, 'HH:mm'));
      }
      setDescription('');
      setCategory('Personal');
    } else {
      setTitle('');
      setEventDate(format(new Date(), 'yyyy-MM-dd'));
      setStartTime('10:00');
      setEndTime('11:00');
      setDescription('');
      setCategory('Personal');
    }
  }, [event, date, userTimezone]);

  async function handleSave() {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in to create events.', variant: 'warning' });
      return;
    }
    
    if (!title.trim()) {
      toast({ title: 'Missing title', description: 'Please enter an event title.', variant: 'warning' });
      return;
    }

    if (!eventDate) {
      toast({ title: 'Missing date', description: 'Please select a date for the event.', variant: 'warning' });
      return;
    }

    // Convert from user's timezone to UTC for storage
    const starts_at = fromZonedTime(`${eventDate}T${startTime}:00`, userTimezone);
    const ends_at = fromZonedTime(`${eventDate}T${endTime}:00`, userTimezone);

    const eventData = {
      title: title.trim(),
      start_time: starts_at.toISOString(),
      end_time: ends_at.toISOString(),
      description: description.trim(),
      category: category,
    };

    try {
      if (event) {
        await updateEvent(user, event.id, eventData, accessToken);
        toast({
          title: 'Event updated',
          description: `"${title}" has been updated successfully`,
          variant: 'success'
        });
      } else {
        await createEvent(user, eventData, accessToken);
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
      const { success, error } = await deleteEvent(user, event.id, accessToken);

      if (!success) {
        throw new Error(error ?? 'Failed to delete event');
      }

      toast({
        title: 'Event deleted',
        description: `"${event.title}" has been removed from your calendar`,
        variant: 'success'
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
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

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>📅</span> Date
            </label>
            <Input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              className="h-12 rounded-2xl border-2 border-border/60 bg-background/90 px-4 text-base shadow-sm transition-all focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary"
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
