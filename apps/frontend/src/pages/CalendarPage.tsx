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

// Extended CalendarEvent interface for UI display
interface ExtendedCalendarEvent extends CalendarEvent {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}
import { ChatPanel } from '../components/chat/ChatPanel';

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
  const { user } = useAuth();
  const [events, setEvents] = useState<ExtendedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedInteraction, setSelectedInteraction] = useState<string>('');

  // Use rich sample data instead of loading from API
  useEffect(() => {
    setEvents(generateRichSampleData());
  }, []);

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

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="flex h-screen">
        {/* Left Side - Calendar */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white p-2">
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
                  title: e.event_title,
                  start: e.event_starts_at,
                  end: e.event_ends_at,
                  backgroundColor: e.backgroundColor || '#3B82F6',
                  borderColor: e.borderColor || '#3B82F6',
                  textColor: e.textColor || '#FFFFFF',
                }))}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                height="100%"
                themeSystem="standard"
                timeZone="local"
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
          <div className="h-[140px] p-2 bg-white">
            <div className="h-full">
              <div className="bg-white rounded-lg p-2 h-full">
                <h3 className="text-lg font-light text-black mb-4">Quick Interactions</h3>
                
                <div className="flex gap-4 h-full">
                  {/* First Interaction Box */}
                  <div className="flex-1 bg-white rounded-lg p-4 flex flex-col items-center justify-center">
                    <p className="text-base text-gray-600 mb-4 text-center">Would you like to learn Chinese tomorrow?</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        type="button"
                        onClick={() => setSelectedInteraction('chinese-yes')}
                        className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                        style={{ 
                          backgroundColor: 'rgba(167, 243, 208, 0.7)', 
                          border: '1px solid rgba(5, 150, 105, 0.2)',
                          color: '#064e3b',
                          boxShadow: selectedInteraction === 'chinese-yes' ? '0 0 0 2px rgba(167, 243, 208, 1)' : 'none'
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInteraction('chinese-no')}
                        className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                        style={{ 
                          backgroundColor: 'rgba(252, 165, 165, 0.7)',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                          color: '#7f1d1d',
                          boxShadow: selectedInteraction === 'chinese-no' ? '0 0 0 2px rgba(252, 165, 165, 1)' : 'none'
                        }}
                      >
                        No
                      </button>
                    </div>
                    {selectedInteraction && selectedInteraction.startsWith('chinese') && (
                      <div className="mt-2 text-xs text-gray-500">
                        Selected: <span className="font-semibold">{selectedInteraction.replace('chinese-', '')}</span>
                      </div>
                    )}
                  </div>

                  {/* Second Interaction Box */}
                  <div className="flex-1 bg-white rounded-lg p-4 flex flex-col items-center justify-center">
                    <p className="text-base text-gray-600 mb-4 text-center">Are you bad at Marvel Rivals?</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        type="button"
                        onClick={() => setSelectedInteraction('marvel-terrible')}
                        className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                        style={{
                          backgroundColor: 'rgba(253, 230, 138, 0.7)',
                          border: '1px solid rgba(217, 119, 6, 0.2)',
                          color: '#78350f',
                           boxShadow: selectedInteraction === 'marvel-terrible' ? '0 0 0 2px rgba(253, 230, 138, 1)' : 'none'
                        }}
                      >
                        Terrible
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInteraction('marvel-okay')}
                        className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                        style={{
                          backgroundColor: 'rgba(147, 197, 253, 0.7)',
                          border: '1px solid rgba(37, 99, 235, 0.2)',
                          color: '#1e3a8a',
                           boxShadow: selectedInteraction === 'marvel-okay' ? '0 0 0 2px rgba(147, 197, 253, 1)' : 'none'
                        }}
                      >
                        Okay
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedInteraction('marvel-pro')}
                        className="w-20 h-20 rounded-lg font-semibold text-sm transition-all duration-200 ease-in-out"
                        style={{
                          backgroundColor: 'rgba(196, 181, 253, 0.7)',
                          border: '1px solid rgba(124, 58, 237, 0.2)',
                          color: '#4c1d95',
                           boxShadow: selectedInteraction === 'marvel-pro' ? '0 0 0 2px rgba(196, 181, 253, 1)' : 'none'
                        }}
                      >
                        Pro
                      </button>
                    </div>
                    {selectedInteraction && selectedInteraction.startsWith('marvel') && (
                      <div className="mt-2 text-xs text-gray-500">
                        Selected: <span className="font-semibold">{selectedInteraction.replace('marvel-', '')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Chat */}
        <div className="w-96 bg-white flex flex-col">
          <div className="flex-1 p-3">
            <div className="h-full">
              <ChatPanel />
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
          onSave={() => setEvents(generateRichSampleData())}
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
      setStartTime(event.event_starts_at ? new Date(event.event_starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
      setEndTime(event.event_ends_at ? new Date(event.event_ends_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
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

    const starts_at = new Date(`${baseDate}T${startTime}`);
    const ends_at = new Date(`${baseDate}T${endTime}`);

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
      <DialogContent className="bg-white border-gray-200 text-black sm:max-w-md" aria-describedby="event-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-light text-black">{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <div id="event-dialog-description" className="sr-only">
          {event ? 'Edit the details of an existing calendar event' : 'Create a new calendar event by filling in the details below'}
        </div>
        <div className="space-y-4 py-4">
          <Input 
            placeholder="Event title"
            value={title} 
            onChange={e => setTitle(e.target.value)}
            className="bg-white border-gray-300 text-black placeholder-gray-500"
          />
          <Input 
            type="time" 
            value={startTime} 
            onChange={e => setStartTime(e.target.value)}
            className="bg-white border-gray-300 text-black"
          />
          <Input 
            type="time" 
            value={endTime} 
            onChange={e => setEndTime(e.target.value)}
            className="bg-white border-gray-300 text-black"
          />
          <Input 
            placeholder="Description"
            value={description} 
            onChange={e => setDescription(e.target.value)}
            className="bg-white border-gray-300 text-black placeholder-gray-500"
          />
        </div>
        <DialogFooter className="sm:justify-between">
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
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="border-gray-300 text-black hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}