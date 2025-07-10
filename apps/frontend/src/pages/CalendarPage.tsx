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
import { ChatPanel } from '../components/chat/ChatPanel';

export function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const twoMonthsLater = new Date(today);
      twoMonthsLater.setMonth(today.getMonth() + 2);
      const { events: fetchedEvents, error: fetchError } = await fetchUserEvents(
        user,
        new Date(today.getFullYear(), today.getMonth(), 1),
        twoMonthsLater
      );
      if (fetchedEvents) {
        setEvents(fetchedEvents);
      }
      if (fetchError) {
        setError(fetchError);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, loadEvents]);

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
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-8 items-center">
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Your Calendar</h1>
            <p className="text-gray-400">Welcome, {user?.email}</p>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-[600px] bg-gray-800 rounded-lg p-8">
              <div className="animate-pulse text-xl">Loading your events...</div>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-900/30 border border-red-500 text-red-200 p-4 rounded-lg mb-4">
                  <p className="font-medium">Error loading calendar</p>
                  <p className="text-sm mt-1">{error}</p>
                  <Button variant="outline" className="mt-4 border-red-500 text-red-200 hover:bg-red-900/50" onClick={loadEvents}>Try Again</Button>
                </div>
              )}
              <div className="bg-gray-800 rounded-lg p-4 shadow-xl fc-dark">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  events={events.map(e => {
                    // Convert UTC time to local time for display
                    const startDate = new Date(e.event_starts_at);
                    const endDate = new Date(e.event_ends_at);
                    
                    // Create new date objects that represent the same "wall clock" time in local timezone
                    const localStart = new Date(startDate.getTime() + (startDate.getTimezoneOffset() * 60000));
                    const localEnd = new Date(endDate.getTime() + (endDate.getTimezoneOffset() * 60000));
                    
                    return { 
                      ...e, 
                      title: e.event_title, 
                      start: localStart.toISOString(), 
                      end: localEnd.toISOString() 
                    };
                  })}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  height="auto"
                  aspectRatio={1.8}
                  themeSystem="standard"
                  timeZone="local"
                  eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: 'short' }}
                />
              </div>
            </>
          )}
        </div>
        <div className="w-full max-w-lg mt-4">
          <ChatPanel />
        </div>
      </div>
      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          event={selectedEvent}
          date={selectedDate}
          onSave={loadEvents}
          user={user}
        />
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .fc-theme-standard { background-color: rgb(31, 41, 55); color: rgb(243, 244, 246); }
        .fc-theme-standard .fc-toolbar-title { color: rgb(243, 244, 246); }
        .fc-theme-standard .fc-col-header-cell { background-color: rgb(55, 65, 81); color: rgb(209, 213, 219); }
        .fc-theme-standard .fc-daygrid-day { background-color: rgb(31, 41, 55); border-color: rgb(75, 85, 99); }
        .fc-theme-standard .fc-day-today { background-color: rgba(79, 70, 229, 0.1) !important; }
        .fc-theme-standard .fc-button { background-color: rgb(55, 65, 81); border-color: rgb(75, 85, 99); color: rgb(209, 213, 219); }
        .fc-theme-standard .fc-button-active { background-color: rgb(79, 70, 229) !important; border-color: rgb(79, 70, 229) !important; color: white !important; }
        .fc-theme-standard .fc-event { background-color: rgb(79, 70, 229); border-color: rgb(67, 56, 202); }
      `}} />
    </div>
  );
}

function EventModal({ isOpen, onClose, event, date, onSave, user }) {
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

    const starts_at = new Date(`${date || event.event_starts_at.split('T')[0]}T${startTime}`);
    const ends_at = new Date(`${date || event.event_starts_at.split('T')[0]}T${endTime}`);

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
      <DialogContent className="bg-gray-800 border-gray-700 text-gray-100 sm:max-w-md" aria-describedby="event-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{event ? 'Edit Event' : 'Add Event'}</DialogTitle>
        </DialogHeader>
        <div id="event-dialog-description" className="sr-only">
          {event ? 'Edit the details of an existing calendar event' : 'Create a new calendar event by filling in the details below'}
        </div>
        <div className="space-y-4 py-4">
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          <Input label="End Time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <DialogFooter className="sm:justify-between">
          <div>
            {event && <Button variant="destructive" onClick={handleDelete}>Delete</Button>}
          </div>
          <div>
            <Button variant="outline" onClick={onClose} className="mr-2">Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}