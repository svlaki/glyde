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
import { InteractionBox, Interaction } from '../components/InteractionBox';
import { useInteractions } from '../lib/interactionContext';
import { useAgentInteractions } from '../lib/agentInteractionHook';
import { ChatPanel } from '../components/chat/ChatPanel';
import { supabase } from '../lib/supabase';

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
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { interactions, removeInteraction } = useInteractions();
  
  // Connect to agent system for interactions
  useAgentInteractions();

  // Load real user events from the backend
  useEffect(() => {
    if (user) {
      loadUserEvents();
      
      // Set up real-time subscription to events table in user's schema
      const userSchema = `u_${user.id.replace(/-/g, '')}`;
      const channel = supabase
        .channel(`events-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: userSchema,
            table: 'events'
          },
          (payload) => {
            console.log('Real-time event change detected:', payload);
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
        console.log(`📅 [CALENDAR] Loaded ${userEvents.length} events`);
        
        // Transform user events to match the calendar format
        const formattedEvents: ExtendedCalendarEvent[] = userEvents.map(event => {
          // Use archetype-based color from backend
          const color = event.color || '#6B7280'; // Default gray if no color
          const archetype = event.archetype || 'generic';
          
          console.log(`📅 [ARCHETYPE] Event "${event.event_title}" has archetype "${archetype}" with color ${color}`);
          
          return {
            id: event.id,
            event_title: event.event_title,
            event_starts_at: event.event_starts_at,
            event_ends_at: event.event_ends_at,
            event_location: event.event_location,
            event_description: event.event_description,
            event_created_at: event.event_created_at,
            event_updated_at: event.event_updated_at,
            title: event.event_title,
            start: event.event_starts_at,
            end: event.event_ends_at,
            backgroundColor: color,
            borderColor: color,
            textColor: '#FFFFFF',
            color: color,
            archetype: archetype,
            archetype_data: event.archetype_data || {}
          };
        });
        
        // Log formatted event count instead of full data
        console.log(`📅 [CALENDAR] Formatted ${formattedEvents.length} events for display`);
        
        // Show user events (empty array if no events)
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error loading user events:', error);
      // Show empty calendar on error
      setEvents([]);
    }
  }

  function handleDateClick(info: any) {
    setSelectedDate(info.dateStr);
    setSelectedEvent(null);
    setIsModalOpen(true);
  }

  function handleEventClick(info: any) {
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
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={events.map(e => ({
                  ...e,
                  id: e.id,
                  title: e.event_title,
                  start: e.event_starts_at,
                  end: e.event_ends_at,
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
                    event_starts_at: info.event.start?.toISOString(),
                    event_ends_at: info.event.end?.toISOString() || new Date(info.event.start!.getTime() + 60 * 60 * 1000).toISOString(),
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
                    event_starts_at: info.event.start?.toISOString(),
                    event_ends_at: info.event.end?.toISOString(),
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

        {/* Right Side - Chat */}
        <div className="w-96 bg-white flex flex-col" style={{ maxWidth: '384px', minWidth: '384px' }}>
          <div className="flex-1 p-3 overflow-hidden">
            <div className="h-full overflow-hidden">
              <ChatPanel onEventCreated={loadUserEvents} />
            </div>
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

// Helper function to render archetype-specific data
function renderArchetypeData(archetype: string, data: any): React.ReactNode {
  if (!data || typeof data !== 'object') return 'No additional data';

  switch (archetype) {
    case 'workout':
      if (data.exercises && Array.isArray(data.exercises)) {
        return (
          <div>
            <strong>Exercises:</strong>
            <ul className="list-disc list-inside mt-1">
              {data.exercises.map((exercise: any, index: number) => (
                <li key={index}>
                  {exercise.name} - {exercise.sets} sets × {exercise.reps} reps
                </li>
              ))}
            </ul>
          </div>
        );
      }
      break;
    
    case 'grocery':
      if (data.items && Array.isArray(data.items)) {
        return (
          <div>
            <strong>Shopping List:</strong>
            <ul className="list-disc list-inside mt-1">
              {data.items.map((item: any, index: number) => (
                <li key={index} className={item.completed ? 'line-through text-gray-500' : ''}>
                  {item.item} ({item.quantity})
                </li>
              ))}
            </ul>
          </div>
        );
      }
      break;

    case 'meeting':
      return (
        <div className="space-y-1">
          {data.attendees && Array.isArray(data.attendees) && <div><strong>Attendees:</strong> {data.attendees.join(', ')}</div>}
          {data.agenda && <div><strong>Agenda:</strong> {data.agenda}</div>}
          {data.meeting_link && <div><strong>Link:</strong> <a href={data.meeting_link} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">Join Meeting</a></div>}
        </div>
      );

    case 'travel':
      return (
        <div className="space-y-1">
          {data.destination && <div><strong>Destination:</strong> {data.destination}</div>}
          {data.departure_time && <div><strong>Departure:</strong> {data.departure_time}</div>}
          {data.transport && <div><strong>Transport:</strong> {data.transport}</div>}
        </div>
      );

    case 'appointment':
      return (
        <div className="space-y-1">
          {data.provider && <div><strong>Provider:</strong> {data.provider}</div>}
          {data.type && <div><strong>Type:</strong> {data.type}</div>}
          {data.location && <div><strong>Location:</strong> {data.location}</div>}
        </div>
      );

    case 'work_focus':
      if (data.tasks && Array.isArray(data.tasks)) {
        return (
          <div>
            <strong>Tasks:</strong>
            <ul className="list-disc list-inside mt-1">
              {data.tasks.map((task: any, index: number) => (
                <li key={index} className={task.completed ? 'line-through text-gray-500' : ''}>
                  {task.task}
                </li>
              ))}
            </ul>
          </div>
        );
      }
      break;

    case 'personal':
      return (
        <div className="space-y-1">
          {data.notes && <div><strong>Notes:</strong> {data.notes}</div>}
        </div>
      );

    default:
      // For generic or unknown archetypes, display all data fields
      return (
        <div className="space-y-1">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <strong className="capitalize">{key.replace(/_/g, ' ')}:</strong> {String(value)}
            </div>
          ))}
        </div>
      );
  }

  return 'No additional data';
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ExtendedCalendarEvent | null;
  date: string | null;
  onSave: () => void;
  user: any;
}

function EventModal({ isOpen, onClose, event, date, onSave, user }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [archetype, setArchetype] = useState('generic');
  const [archetypeData, setArchetypeData] = useState<any>({});

  useEffect(() => {
    if (event) {
      setTitle(event.event_title || '');
      // Convert UTC time to local time for display in the form
      const startDate = new Date(event.event_starts_at);
      const endDate = new Date(event.event_ends_at);
      setStartTime(startDate.toTimeString().slice(0, 5)); // HH:MM format
      setEndTime(endDate.toTimeString().slice(0, 5)); // HH:MM format
      setDescription(event.event_description || '');
      setArchetype(event.archetype || 'generic');
      setArchetypeData(event.archetype_data || {});
    } else {
      setTitle('');
      setStartTime('10:00');
      setEndTime('11:00');
      setDescription('');
      setArchetype('generic');
      setArchetypeData({});
    }
  }, [event]);

  async function handleSave() {
    if (!user || !title.trim()) return;

    const baseDate = date ? date.split('T')[0] : (event?.event_starts_at.split('T')[0]);
    if (!baseDate) return;

    // Create dates in local timezone and convert to ISO string
    const starts_at = new Date(`${baseDate}T${startTime}:00`);
    const ends_at = new Date(`${baseDate}T${endTime}:00`);

    const eventData = { 
      event_title: title.trim(), 
      event_starts_at: starts_at.toISOString(),
      event_ends_at: ends_at.toISOString(),
      event_description: description.trim(),
      archetype: archetype,
      archetype_data: archetypeData,
    };

    if (event) {
      await updateEvent(user, event.id, eventData);
    } else {
      await createEvent(user, eventData);
    }
    onSave();
    onClose();
  }

  async function handleDelete() {
    if (!user || !event) return;
    await deleteEvent(user, event.id);
    onSave();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="fixed bg-white border-2 border-gray-400 text-black sm:max-w-md shadow-2xl z-[100]" 
        style={{ 
          backgroundColor: '#ffffff', 
          opacity: '1 !important',
          backdropFilter: 'none'
        }} 
        aria-describedby="event-dialog-description"
      >
        <DialogHeader className="bg-white">
          <DialogTitle className="text-xl font-semibold text-gray-900 bg-white">
            {event ? 'Edit Event' : 'Create New Event'}
          </DialogTitle>
        </DialogHeader>
        <div id="event-dialog-description" className="sr-only">
          {event ? 'Edit the details of an existing calendar event' : 'Create a new calendar event by filling in the details below'}
        </div>
        <div className="space-y-4 py-4 bg-white">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
            <Input 
              placeholder="Enter event title..."
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white border-gray-300 text-black placeholder-gray-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-white border-gray-300 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-white border-gray-300 text-black"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea 
              placeholder="Add event details..."
              value={description} 
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          {/* Event Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select 
              value={archetype} 
              onChange={e => setArchetype(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="generic">Generic</option>
              <option value="workout">Workout</option>
              <option value="grocery">Grocery</option>
              <option value="meeting">Meeting</option>
              <option value="appointment">Appointment</option>
              <option value="travel">Travel</option>
              <option value="work_focus">Work Focus</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          {/* Archetype-specific forms */}
          {archetype === 'workout' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Workout Details</h3>
              <div className="space-y-2">
                <textarea
                  placeholder="Enter exercises (one per line, format: Exercise Name - Sets x Reps)"
                  value={(archetypeData.exercises || []).map((ex: any) => `${ex.name} - ${ex.sets} x ${ex.reps}`).join('\n')}
                  onChange={e => {
                    const exercises = e.target.value.split('\n').filter(line => line.trim()).map(line => {
                      const match = line.match(/^(.+?)\s*-\s*(\d+)\s*x\s*(\d+)$/);
                      if (match) {
                        return { name: match[1].trim(), sets: parseInt(match[2]), reps: parseInt(match[3]) };
                      }
                      return { name: line.trim(), sets: 1, reps: 1 };
                    });
                    setArchetypeData({...archetypeData, exercises});
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {archetype === 'grocery' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Shopping List</h3>
              <div className="space-y-2">
                <textarea
                  placeholder="Enter items (one per line, format: Item Name - Quantity)"
                  value={(archetypeData.items || []).map((item: any) => `${item.item} - ${item.quantity}`).join('\n')}
                  onChange={e => {
                    const items = e.target.value.split('\n').filter(line => line.trim()).map(line => {
                      const parts = line.split(' - ');
                      return { 
                        item: parts[0]?.trim() || line.trim(), 
                        quantity: parts[1]?.trim() || '1',
                        completed: false 
                      };
                    });
                    setArchetypeData({...archetypeData, items});
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {archetype === 'meeting' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Meeting Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Attendees</label>
                  <input
                    placeholder="Enter attendees (comma-separated)"
                    value={(archetypeData.attendees || []).join(', ')}
                    onChange={e => setArchetypeData({...archetypeData, attendees: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Agenda</label>
                  <textarea
                    placeholder="Meeting agenda..."
                    value={archetypeData.agenda || ''}
                    onChange={e => setArchetypeData({...archetypeData, agenda: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Meeting Link</label>
                  <input
                    placeholder="Zoom/Teams/Meet URL"
                    value={archetypeData.meeting_link || ''}
                    onChange={e => setArchetypeData({...archetypeData, meeting_link: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {archetype === 'appointment' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Appointment Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                  <input
                    placeholder="Doctor, dentist, etc."
                    value={archetypeData.provider || ''}
                    onChange={e => setArchetypeData({...archetypeData, provider: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <input
                    placeholder="Checkup, consultation, etc."
                    value={archetypeData.type || ''}
                    onChange={e => setArchetypeData({...archetypeData, type: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    placeholder="Address or clinic name"
                    value={archetypeData.location || ''}
                    onChange={e => setArchetypeData({...archetypeData, location: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {archetype === 'travel' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Travel Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Destination</label>
                  <input
                    placeholder="Where are you going?"
                    value={archetypeData.destination || ''}
                    onChange={e => setArchetypeData({...archetypeData, destination: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Departure Time</label>
                  <input
                    placeholder="When do you leave?"
                    value={archetypeData.departure_time || ''}
                    onChange={e => setArchetypeData({...archetypeData, departure_time: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transport</label>
                  <input
                    placeholder="Flight, car, train, etc."
                    value={archetypeData.transport || ''}
                    onChange={e => setArchetypeData({...archetypeData, transport: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {archetype === 'work_focus' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Work Tasks</h3>
              <div className="space-y-2">
                <textarea
                  placeholder="Enter tasks (one per line)"
                  value={(archetypeData.tasks || []).map((task: any) => task.task).join('\n')}
                  onChange={e => {
                    const tasks = e.target.value.split('\n').filter(line => line.trim()).map(line => ({
                      task: line.trim(),
                      completed: false
                    }));
                    setArchetypeData({...archetypeData, tasks});
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {archetype === 'personal' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Personal Notes</h3>
              <div className="space-y-2">
                <textarea
                  placeholder="Add personal notes..."
                  value={archetypeData.notes || ''}
                  onChange={e => setArchetypeData({...archetypeData, notes: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-black placeholder-gray-500"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Display archetype information if viewing an existing event */}
          {event && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Event Type Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-medium text-gray-600">Archetype: </span>
                  <span className="text-xs text-gray-800 capitalize">{event.archetype || 'generic'}</span>
                  {event.color && (
                    <div 
                      className="inline-block w-3 h-3 rounded-full ml-2" 
                      style={{ backgroundColor: event.color }}
                    />
                  )}
                </div>
                
                {/* Display archetype-specific data */}
                {event.archetype_data && Object.keys(event.archetype_data).length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-600">Additional Data:</span>
                    <div className="mt-1 text-xs text-gray-700 bg-gray-50 p-2 rounded">
                      {renderArchetypeData(event.archetype || 'generic', event.archetype_data)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          <div>
            {event && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-gray-300 text-black hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {event ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}