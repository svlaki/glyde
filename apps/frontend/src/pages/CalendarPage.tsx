import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { fetchUserEvents, createEvent, CalendarEvent } from '../lib/calendarService'
import { ChatPanel } from '../components/chat/ChatPanel'

export function CalendarPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  
  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user])
  
  async function loadEvents() {
    if (!user) return
    
    setLoading(true)
    setError(null)
    
    try {
      const today = new Date()
      const twoMonthsLater = new Date(today)
      twoMonthsLater.setMonth(today.getMonth() + 2)
      
      const { events: fetchedEvents, error: fetchError } = await fetchUserEvents(
        user,
        new Date(today.getFullYear(), today.getMonth(), 1),
        twoMonthsLater
      )
      
      // Always set events if we have them, even if there's an error
      if (fetchedEvents && fetchedEvents.length > 0) {
        setEvents(fetchedEvents)
      }
      
      // Set error if there is one
      if (fetchError) {
        setError(fetchError)
      }
    } catch (err: any) {
      console.error('Error loading events:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  function handleDateClick(info: any) {
    setSelectedDate(info.dateStr)
    setNewEventTitle('')
    setIsModalOpen(true)
  }
  
  function handleEventClick(info: any) {
    alert(`Event: ${info.event.title}`)
  }
  
  async function handleAddEvent() {
    if (!user || !newEventTitle.trim() || !selectedDate) {
      return
    }
    
    const newEvent = {
      event_title: newEventTitle.trim(),
      event_starts_at: `${selectedDate}T10:00:00`,
      event_ends_at: `${selectedDate}T11:00:00`
    }
    
    try {
      // For demonstration purposes, we'll add it to local state first
      const tempEvent: CalendarEvent = {
        ...newEvent,
        id: `temp-${Date.now()}`
      }
      
      setEvents(prev => [...prev, tempEvent])
      setIsModalOpen(false)
      
      // Then attempt to save to database
      const { event: savedEvent, error: saveError } = await createEvent(user, newEvent)
      
      if (saveError) {
        console.error('Error saving event:', saveError)
        alert(`Note: Event was only added locally. Error saving to database: ${saveError}`)
      } else if (savedEvent) {
        // Replace the temp event with the saved one
        setEvents(prev => prev.map(e => 
          e.id === tempEvent.id ? savedEvent : e
        ))
      }
    } catch (err: any) {
      console.error('Error adding event:', err)
      alert(`Error adding event: ${err.message}`)
    }
  }
  
  function handleRefresh() {
    if (!user) return
    loadEvents()
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
                  <Button 
                    variant="outline" 
                    className="mt-4 border-red-500 text-red-200 hover:bg-red-900/50"
                    onClick={handleRefresh}
                  >
                    Try Again
                  </Button>
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
                  events={events.map(e => ({
                    ...e,
                    title: e.event_title,
                    start: e.event_starts_at,
                    end: e.event_ends_at
                  }))}
                  dateClick={handleDateClick}
                  eventClick={handleEventClick}
                  height="auto"
                  aspectRatio={1.8}
                  themeSystem="standard"
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: 'short'
                  }}
                />
              </div>
            </>
          )}
        </div>
        {/* ChatPanel below calendar, full width on mobile, max-w-lg on desktop */}
        <div className="w-full max-w-lg mt-4">
          <ChatPanel />
        </div>
      </div>
      
      {/* Event creation dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-gray-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Event on {selectedDate}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="event-title" className="text-sm font-medium text-gray-300">
                Event Title
              </label>
              <Input
                id="event-title"
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                placeholder="Enter event title"
                className="bg-gray-700 border-gray-600 text-gray-100"
              />
            </div>
            
            <p className="text-gray-400 text-sm">
              This is a simplified demo. In the full implementation, you'll be able to set time, 
              location, and other details.
            </p>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button onClick={handleAddEvent} disabled={!newEventTitle.trim()}>
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add custom styles for FullCalendar dark mode */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* Dark mode styles for FullCalendar */
        .fc-theme-standard {
          background-color: rgb(31, 41, 55); /* gray-800 */
          color: rgb(243, 244, 246); /* gray-100 */
        }
        
        .fc-theme-standard .fc-toolbar-title {
          color: rgb(243, 244, 246); /* gray-100 */
        }
        
        .fc-theme-standard .fc-col-header-cell {
          background-color: rgb(55, 65, 81); /* gray-700 */
          color: rgb(209, 213, 219); /* gray-300 */
        }
        
        .fc-theme-standard .fc-daygrid-day {
          background-color: rgb(31, 41, 55); /* gray-800 */
          border-color: rgb(75, 85, 99); /* gray-600 */
        }
        
        .fc-theme-standard .fc-day-today {
          background-color: rgba(79, 70, 229, 0.1) !important; /* indigo-600 with opacity */
        }
        
        .fc-theme-standard .fc-button {
          background-color: rgb(55, 65, 81); /* gray-700 */
          border-color: rgb(75, 85, 99); /* gray-600 */
          color: rgb(209, 213, 219); /* gray-300 */
        }
        
        .fc-theme-standard .fc-button-active {
          background-color: rgb(79, 70, 229) !important; /* indigo-600 */
          border-color: rgb(79, 70, 229) !important; /* indigo-600 */
          color: white !important;
        }
        
        .fc-theme-standard .fc-event {
          background-color: rgb(79, 70, 229); /* indigo-600 */
          border-color: rgb(67, 56, 202); /* indigo-700 */
        }
      `}} />
    </div>
  )
} 