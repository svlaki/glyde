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
import { DevTestPanel } from '../components/DevTestPanel';
import { supabase } from '../lib/supabase';

// Extended CalendarEvent interface for UI display
interface ExtendedCalendarEvent extends CalendarEvent {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

// Generate rich sample data for the calendar
function generateRichSampleData(): ExtendedCalendarEvent[] {
  const today = new Date();
  const events: ExtendedCalendarEvent[] = [];
  
  // Define event types with colors
  const eventTypes = [
    { type: 'meeting', color: 'rgba(147, 197, 253, 0.8)', textColor: '#1F2937' }, // Pastel blue
    { type: 'personal', color: 'rgba(167, 243, 208, 0.8)', textColor: '#1F2937' }, // Pastel green
    { type: 'work', color: 'rgba(253, 230, 138, 0.8)', textColor: '#1F2937' }, // Pastel yellow
    { type: 'appointment', color: 'rgba(252, 165, 165, 0.8)', textColor: '#1F2937' }, // Pastel red
    { type: 'event', color: 'rgba(196, 181, 253, 0.8)', textColor: '#1F2937' }, // Pastel purple
    { type: 'deadline', color: 'rgba(249, 168, 212, 0.8)', textColor: '#1F2937' }, // Pastel pink
  ];

  // Sample events for the next 2 weeks
  const sampleEvents = [
    { title: 'Team Standup', type: 'meeting', duration: 1, day: 0, hour: 9, description: 'Quick daily check-in to align on tasks.' },
    { title: 'Project Review', type: 'work', duration: 2, day: 0, hour: 14, description: 'Review progress on the new feature branch.' },
    { title: 'Doctor Appointment', type: 'appointment', duration: 1, day: 1, hour: 10, description: 'Annual check-up. Remember to bring ID.' },
    { title: 'Lunch with Sarah', type: 'personal', duration: 1.5, day: 1, hour: 12, description: '' },
    { title: 'Client Call', type: 'meeting', duration: 1, day: 2, hour: 15, description: 'Discuss Q3 results and plan for Q4.' },
    { title: 'Gym Session', type: 'personal', duration: 1.5, day: 2, hour: 18, description: 'Leg day.' },
    { title: 'Design Workshop', type: 'work', duration: 3, day: 3, hour: 10, description: 'Brainstorming session for the new UI.' },
    { title: 'Coffee Chat', type: 'personal', duration: 1, day: 3, hour: 16, description: '' },
    { title: 'Sprint Planning', type: 'meeting', duration: 2, day: 4, hour: 9, description: 'Plan tasks for the upcoming sprint.' },
    { title: 'Product Demo', type: 'work', duration: 1, day: 4, hour: 14, description: 'Showcase the new features to stakeholders.' },
    { title: 'Weekend Brunch', type: 'personal', duration: 2, day: 5, hour: 11, description: '' },
    { title: 'Movie Night', type: 'event', duration: 3, day: 5, hour: 19, description: 'Watch the new sci-fi movie.' },
    { title: 'Yoga Class', type: 'personal', duration: 1, day: 6, hour: 8, description: '' },
    { title: 'Family Dinner', type: 'personal', duration: 2, day: 6, hour: 18, description: '' },
    { title: 'Code Review', type: 'work', duration: 1, day: 7, hour: 10, description: 'Review pull request #123.' },
    { title: 'All Hands Meeting', type: 'meeting', duration: 1, day: 7, hour: 15, description: 'Company-wide updates.' },
    { title: 'Dentist', type: 'appointment', duration: 1, day: 8, hour: 9, description: 'Routine cleaning.' },
    { title: 'Project Deadline', type: 'deadline', duration: 0.5, day: 8, hour: 17, description: 'Final submission for Project Phoenix.' },
    { title: 'Team Lunch', type: 'personal', duration: 1.5, day: 9, hour: 12, description: '' },
    { title: 'Client Presentation', type: 'work', duration: 2, day: 9, hour: 14, description: 'Present the final product to the client.' },
    { title: 'Book Club', type: 'event', duration: 2, day: 10, hour: 19, description: '' },
    { title: 'Morning Run', type: 'personal', duration: 1, day: 11, hour: 7, description: '' },
    { title: 'Strategy Session', type: 'meeting', duration: 3, day: 11, hour: 13, description: 'Long-term planning for the next fiscal year.' },
    { title: 'Concert', type: 'event', duration: 4, day: 12, hour: 20, description: '' },
    { title: 'Grocery Shopping', type: 'personal', duration: 1, day: 13, hour: 10, description: 'Don\'t forget to buy milk.' },
    { title: 'Board Game Night', type: 'event', duration: 3, day: 13, hour: 18, description: '' },
  ];

  sampleEvents.forEach((event, index) => {
    const eventDate = new Date(today);
    eventDate.setDate(today.getDate() + event.day);
    eventDate.setHours(event.hour, 0, 0, 0);
    
    const endDate = new Date(eventDate);
    endDate.setHours(eventDate.getHours() + Math.floor(event.duration), (event.duration % 1) * 60, 0, 0);
    
    const eventTypeData = eventTypes.find(t => t.type === event.type) || eventTypes[0];
    
    events.push({
      id: `sample-${index + 1}`,
      event_title: event.title,
      event_starts_at: eventDate.toISOString(),
      event_ends_at: endDate.toISOString(),
      event_description: event.description || `${event.type.charAt(0).toUpperCase() + event.type.slice(1)} event`,
      backgroundColor: eventTypeData.color,
      textColor: eventTypeData.textColor,
      borderColor: eventTypeData.color,
    });
  });

  return events;
}

export function CalendarPage() {
  const { user, session } = useAuth();
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { interactions, addInteraction, removeInteraction } = useInteractions();
  
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
        // Transform user events to match the calendar format
        const formattedEvents: ExtendedCalendarEvent[] = userEvents.map(event => {
          // Calculate color based on event title
          const title = event.event_title.toLowerCase();
          let color = event.color || '#3B82F6';
          
          // Only recalculate if color is default blue
          if (color === '#3b82f6' || color === '#3B82F6') {
            if (title.includes('meeting') || title.includes('sync') || title.includes('call')) {
              color = '#60A5FA'; // Light Blue
            } else if (title.includes('deep work') || title.includes('focus')) {
              color = '#2563EB'; // Dark Blue
            } else if (title.includes('planning') || title.includes('review')) {
              color = '#A78BFA'; // Purple
            } else if (title.includes('dentist') || title.includes('doctor') || title.includes('appointment')) {
              color = '#059669'; // Dark Green
            } else if (title.includes('exercise') || title.includes('gym') || title.includes('workout')) {
              color = '#34D399'; // Bright Green
            } else if (title.includes('break') || title.includes('lunch')) {
              color = '#F59E0B'; // Amber
            } else if (title.includes('mindfulness') || title.includes('meditation')) {
              color = '#6EE7B7'; // Light Green
            } else if (title.includes('dinner') || title.includes('breakfast')) {
              color = '#FB923C'; // Orange
            } else if (title.includes('personal') || title.includes('family')) {
              color = '#F472B6'; // Pink
            }
          }
          
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
            color: color
          };
        });
        
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

  async function handleCreateEventFromInteraction(eventData: { title: string; startTime: string; endTime: string; description?: string }) {
    if (!user) return;

    const today = new Date();
    const baseDate = today.toISOString().split('T')[0];
    
    const starts_at = new Date(`${baseDate}T${eventData.startTime}:00`);
    const ends_at = new Date(`${baseDate}T${eventData.endTime}:00`);

    const newEvent = {
      event_title: eventData.title,
      event_starts_at: starts_at.toISOString(),
      event_ends_at: ends_at.toISOString(),
      event_description: eventData.description || '',
    };

    const { event, error } = await createEvent(user, newEvent);
    if (!error && event) {
      await loadUserEvents(); // Refresh calendar
    } else {
      console.error('Failed to create event from interaction:', error);
    }
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
      {/* Development Test Panel */}
      <DevTestPanel />
      
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
                timeZone="UTC"
                eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
                slotMinTime="06:00:00"
                slotMaxTime="23:00:00"
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

  useEffect(() => {
    if (event) {
      setTitle(event.event_title || '');
      // Convert UTC time to local time for display in the form
      const startDate = new Date(event.event_starts_at);
      const endDate = new Date(event.event_ends_at);
      setStartTime(startDate.toTimeString().slice(0, 5)); // HH:MM format
      setEndTime(endDate.toTimeString().slice(0, 5)); // HH:MM format
      setDescription(event.event_description || '');
    } else {
      setTitle('');
      setStartTime('10:00');
      setEndTime('11:00');
      setDescription('');
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