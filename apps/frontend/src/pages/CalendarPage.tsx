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
import { EventModal } from '../components/EventModal';
import { getCategoryColor } from '../lib/calendarCategories';
import type { ExtendedCalendarEvent } from '../types/calendar';
import '../styles/calendar.css';

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
        />
      )}

    </div>
  );
}
