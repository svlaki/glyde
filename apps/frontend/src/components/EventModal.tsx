import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type { ToastVariant } from './ui/toast';
import { createEvent, updateEvent, deleteEvent } from '../lib/calendarService';
import { CATEGORY_COLORS, getCategoryColor } from '../lib/calendarCategories';
import type { ExtendedCalendarEvent } from '../types/calendar';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ExtendedCalendarEvent | null;
  date: string | null;
  onSave: () => void;
  user: User | null;
  toast: (options: { title: string; description: string; variant?: ToastVariant }) => void;
}

const DEFAULT_START_TIME = '10:00';
const DEFAULT_END_TIME = '11:00';

export function EventModal({ isOpen, onClose, event, date, onSave, user, toast }: EventModalProps) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Personal');

  useEffect(() => {
    if (event) {
      setTitle(event.title ?? '');
      const startDate = event.start_time ? new Date(event.start_time) : null;
      const endDate = event.end_time ? new Date(event.end_time) : null;
      setEventDate(startDate ? startDate.toISOString().split('T')[0] : '');
      setStartTime(startDate ? startDate.toTimeString().slice(0, 5) : DEFAULT_START_TIME);
      setEndTime(endDate ? endDate.toTimeString().slice(0, 5) : DEFAULT_END_TIME);
      setDescription(event.description ?? '');
      setCategory(event.category ?? 'Personal');
    } else if (date) {
      // Extract time from the clicked slot if available
      const clickedDate = new Date(date);
      setTitle('');
      setEventDate(clickedDate.toISOString().split('T')[0]);

      // Use the clicked time, or default to 10am if it's midnight (day click vs time slot click)
      const hours = clickedDate.getHours();
      const minutes = clickedDate.getMinutes();
      if (hours === 0 && minutes === 0) {
        // Day header was clicked, use default time
        setStartTime(DEFAULT_START_TIME);
        setEndTime(DEFAULT_END_TIME);
      } else {
        // Time slot was clicked, use that time
        setStartTime(clickedDate.toTimeString().slice(0, 5));
        const endDate = new Date(clickedDate.getTime() + 60 * 60 * 1000); // +1 hour
        setEndTime(endDate.toTimeString().slice(0, 5));
      }
      setDescription('');
      setCategory('Personal');
    } else {
      setTitle('');
      setEventDate(new Date().toISOString().split('T')[0]);
      setStartTime(DEFAULT_START_TIME);
      setEndTime(DEFAULT_END_TIME);
      setDescription('');
      setCategory('Personal');
    }
  }, [event, date]);

  const currentCategoryColor = useMemo(
    () => getCategoryColor(category),
    [category]
  );

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  async function handleSave() {
    if (!user) {
      toast({ title: 'Not signed in', description: 'Please sign in again to manage events.', variant: 'warning' });
      return;
    }

    if (!eventDate) {
      toast({ title: 'Missing date', description: 'Please select a date for the event.', variant: 'warning' });
      return;
    }

    const start = new Date(`${eventDate}T${startTime}:00`);
    const end = new Date(`${eventDate}T${endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast({ title: 'Invalid time', description: 'Enter a valid start and end time.', variant: 'error' });
      return;
    }

    if (end <= start) {
      toast({ title: 'Time conflict', description: 'End time must be after the start time.', variant: 'warning' });
      return;
    }

    const eventPayload = {
      title: title.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      description: description.trim(),
      category
    };

    try {
      if (event) {
        const { error } = await updateEvent(user, event.id, eventPayload);
        if (error) {
          throw new Error(error);
        }

        toast({
          title: 'Event updated',
          description: `"${title}" has been updated successfully`,
          variant: 'success'
        });
      } else {
        const { error } = await createEvent(user, eventPayload);
        if (error) {
          throw new Error(error);
        }

        toast({
          title: 'Event created',
          description: `"${title}" has been added to your calendar`,
          variant: 'success'
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save event', error);
      toast({
        title: 'Unable to save event',
        description: event ? 'We could not update this event. Please try again.' : 'We could not create the event. Please try again.',
        variant: 'error'
      });
    }
  }

  async function handleDelete() {
    if (!user || !event) {
      return;
    }

    try {
      const { success, error } = await deleteEvent(user, event.id);

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
      console.error('Failed to delete event', error);
      toast({
        title: 'Unable to delete event',
        description: 'We could not delete this event. Please try again.',
        variant: 'error'
      });
    }
  }

  const categoryOptions = useMemo(() => Object.keys(CATEGORY_COLORS), []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md w-full max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            {event ? 'Edit Event' : 'Create Event'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Event Title</label>
            <Input
              placeholder="Enter event title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Date
            </label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Start Time
              </label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                End Time
              </label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-11 text-base bg-background border-input focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Description
            </label>
            <textarea
              placeholder="Add event details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none transition-all"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-4 bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all cursor-pointer"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border border-border">
              <div
                className="w-5 h-5 rounded-full border-2 border-border shadow-sm"
                style={{ backgroundColor: currentCategoryColor }}
                aria-hidden
              />
              <span className="text-sm text-muted-foreground font-medium">Event will appear in this color</span>
            </div>
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
                Delete
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
              {event ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
