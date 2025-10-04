import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { fetchUserEvents, createEvent, updateEvent, deleteEvent, CalendarEvent } from '../lib/calendarService';
import { fetchUserTasks, Task } from '../lib/taskService';
import { InteractionBox, Interaction } from '../components/InteractionBox';
import { useInteractions } from '../lib/interactionContext';
import { useAgentInteractions } from '../lib/agentInteractionHook';
import { ChatPanel } from '../components/chat/ChatPanel';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/toast';

// Extended CalendarEvent interface for UI display
interface ExtendedCalendarEvent extends CalendarEvent {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  title?: string; // For FullCalendar compatibility
  start?: string;  // For FullCalendar compatibility
  end?: string;    // For FullCalendar compatibility
}


export function CalendarPage() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string>('America/Chicago');
  const { interactions, removeInteraction } = useInteractions();

  // Connect to agent system for interactions
  useAgentInteractions();

  // Fetch user timezone from profile
  useEffect(() => {
    if (user) {
      const fetchTimezone = async () => {
        try {
          const agentServiceUrl = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';
          const response = await fetch(`${agentServiceUrl}/api/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id })
          });
          if (response.ok) {
            const profile = await response.json();
            if (profile.timezone) {
              setUserTimezone(profile.timezone);
            }
          }
        } catch (error) {
          console.error('Failed to fetch user timezone:', error);
        }
      };
      fetchTimezone();
    }
  }, [user]);

  // Load real user events and tasks from the backend
  useEffect(() => {
    if (user) {
      loadUserEvents();
      loadUserTasks();

      // Set up real-time subscription to events table in public schema
      const channel = supabase
        .channel(`events-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'events',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            // Reload events when any change occurs
            loadUserEvents();
          }
        )
        .subscribe();

      // Cleanup subscription on unmount
      return () => {
        channel.unsubscribe();
      };
    }
  }, [user]);

  async function loadUserTasks() {
    if (!user) return;

    try {
      const { tasks: userTasks, error } = await fetchUserTasks(user, { status: 'pending' });
      if (error) {
        console.error('Error loading user tasks:', error);
        setTasks([]);
      } else {
        // Sort tasks by due date (soonest first)
        const sortedTasks = userTasks.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        setTasks(sortedTasks);
      }
    } catch (err) {
      console.error('Unexpected error loading tasks:', err);
      setTasks([]);
    }
  }

  async function loadUserEvents() {
    if (!user) return;

    try {
      const { events: userEvents, error } = await fetchUserEvents(user);
      if (error) {
        console.error('Error loading user events:', error);
        // Show empty calendar if there's an error
        setEvents([]);
      } else {
        // Log event count instead of full data
        
        // Transform user events to match the calendar format
        const formattedEvents: ExtendedCalendarEvent[] = userEvents.map(event => {
          // Use category-based color from backend
          const color = event.color || '#6B7280'; // Default gray if no color
          const category = event.category || 'Personal';


          return {
            id: event.id,
            user_id: event.user_id,
            title: event.title,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location,
            description: event.description,
            created_at: event.created_at,
            updated_at: event.updated_at,
            category: category,
            start: event.start_time,
            end: event.end_time,
            backgroundColor: color,
            borderColor: color,
            textColor: '#FFFFFF',
            color: color
          };
        });
        
        // Log formatted event count instead of full data
        
        // Show user events (empty array if no events)
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error loading user events:', error);
      // Show empty calendar on error
      setEvents([]);
    }
  }

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


  function handleInteractionResponse(interactionId: string, response: string) {
    removeInteraction(interactionId);
    // Refresh calendar to show any newly created events
    // Refresh for any positive response (yes or any multiple choice option that's not 'no')
    if (response !== 'no') {
      // Small delay to ensure backend processing is complete
      setTimeout(() => {
        loadUserEvents();
      }, 1000);
    }
  }

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
                events={events.map(e => ({
                  ...e,
                  id: e.id,
                  title: e.title,
                  start: e.start_time,
                  end: e.end_time,
                  backgroundColor: e.color || e.backgroundColor || '#3B82F6',
                  borderColor: e.color || e.borderColor || '#3B82F6',
                  textColor: '#FFFFFF',
                }))}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                editable={true}
                droppable={true}
                eventDrop={async (info) => {
                  // Update event when dragged to new time
                  const updatedEvent = {
                    start_time: info.event.start?.toISOString(),
                    end_time: info.event.end?.toISOString() || new Date(info.event.start!.getTime() + 60 * 60 * 1000).toISOString(),
                  };
                  
                  try {
                    const response = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events/update`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                      },
                      body: JSON.stringify({
                        user_id: user?.id,
                        event_id: info.event.id,
                        event: updatedEvent
                      })
                    });
                    
                    if (response.ok) {
                      // Refresh the calendar to show the update
                      await loadUserEvents();
                    } else {
                      info.revert();
                      console.error('Failed to update event');
                    }
                  } catch (error) {
                    info.revert();
                    console.error('Error updating event:', error);
                  }
                }}
                eventResize={async (info) => {
                  // Update event duration when resized
                  const updatedEvent = {
                    start_time: info.event.start?.toISOString(),
                    end_time: info.event.end?.toISOString(),
                  };
                  
                  try {
                    const response = await fetch(`${import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000'}/api/events/update`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                      },
                      body: JSON.stringify({
                        user_id: user?.id,
                        event_id: info.event.id,
                        event: updatedEvent
                      })
                    });
                    
                    if (response.ok) {
                      // Refresh the calendar to show the update
                      await loadUserEvents();
                    } else {
                      info.revert();
                      console.error('Failed to resize event');
                    }
                  } catch (error) {
                    info.revert();
                    console.error('Error resizing event:', error);
                  }
                }}
                height="100%"
                themeSystem="standard"
                timeZone="local"
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

      {/* Custom Calendar Styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        .fc-theme-standard {
          background-color: rgb(255, 255, 255);
          color: rgb(0, 0, 0);
          font-family: system-ui, -apple-system, sans-serif;
        }
        .fc-theme-standard .fc-toolbar-title {
          color: rgb(0, 0, 0);
          font-weight: 300;
          font-size: 1.5rem;
        }
        .fc-theme-standard .fc-col-header-cell {
          background-color: rgb(249, 250, 251);
          color: rgb(75, 85, 99);
          border-color: rgb(229, 231, 235);
          font-weight: 500;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .fc-theme-standard .fc-daygrid-day,
        .fc-theme-standard .fc-timegrid-slot {
          background-color: rgb(255, 255, 255);
          border-color: rgb(229, 231, 235);
        }
        .fc-theme-standard .fc-day-today {
          background-color: rgba(59, 130, 246, 0.05) !important;
        }
        .fc-theme-standard .fc-button {
          background-color: rgb(255, 255, 255);
          border: 1px solid rgb(229, 231, 235);
          color: rgb(0, 0, 0);
          font-weight: 500;
          border-radius: 9999px;
          padding: 0.5rem 1rem;
        }
        .fc-theme-standard .fc-button:hover {
          background-color: rgb(249, 250, 251);
        }
        .fc-theme-standard .fc-button-active {
          background-color: rgb(0, 0, 0) !important;
          border-color: rgb(0, 0, 0) !important;
          color: white !important;
        }
        .fc-theme-standard .fc-button-active:hover {
          background-color: rgb(31, 41, 55) !important;
          border-color: rgb(31, 41, 55) !important;
        }
        .fc-theme-standard .fc-event {
          border-radius: 0.375rem;
          border: none;
          font-weight: 500;
          font-size: 0.875rem;
          padding: 2px 6px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .fc-theme-standard .fc-event:hover {
          filter: brightness(0.95);
          box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
        }
        .fc-theme-standard .fc-timegrid-axis {
          color: rgb(107, 114, 128);
          font-size: 0.75rem;
        }
        .fc-theme-standard .fc-timegrid-now-indicator-line {
          border-color: #ef4444 !important;
          border-width: 1px !important;
          width: 100% !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 40 !important;
        }
        .fc-theme-standard .fc-timegrid-now-indicator-arrow {
          display: none !important;
        }
        .fc-theme-standard .fc-timegrid-slot-label {
          color: rgb(107, 114, 128);
        }
        .fc-theme-standard .fc-scrollgrid {
          border-color: rgb(229, 231, 235);
        }
        .fc-theme-standard .fc-scrollgrid-section > * {
          border-color: rgb(229, 231, 235);
        }
        .fc-theme-standard .fc-more-link {
          color: rgb(59, 130, 246);
        }
        .fc-theme-standard .fc-more-link:hover {
          color: rgb(37, 99, 235);
        }
        .fc-theme-standard .fc-timegrid-divider {
          border-color: rgb(229, 231, 235);
        }
        .fc-theme-standard .fc-timegrid-slot-minor {
          border-color: rgb(243, 244, 246);
        }
      `}} />
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
}

function EventModal({ isOpen, onClose, event, date, onSave, user, toast }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      // Convert UTC time to local time for display in the form
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);
      setStartTime(startDate.toTimeString().slice(0, 5)); // HH:MM format
      setEndTime(endDate.toTimeString().slice(0, 5)); // HH:MM format
      setDescription(event.description || '');
      setCategory(event.category || 'Personal');
    } else {
      setTitle('');
      setStartTime('10:00');
      setEndTime('11:00');
      setDescription('');
      setCategory('Personal');
    }
  }, [event]);

  async function handleSave() {
    if (!user || !title.trim()) return;

    const baseDate = date ? date.split('T')[0] : (event?.start_time.split('T')[0]);
    if (!baseDate) return;

    // Create dates in local timezone and convert to ISO string
    const starts_at = new Date(`${baseDate}T${startTime}:00`);
    const ends_at = new Date(`${baseDate}T${endTime}:00`);

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