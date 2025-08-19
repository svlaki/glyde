import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';
import { CalendarIntelligenceService } from '../services/CalendarIntelligenceService.js';
import { SmartInteractionService } from '../services/SmartInteractionService.js';

export async function analyzeWeek(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const supabaseService = new SupabaseService();
    const calendarIntelligence = new CalendarIntelligenceService(user_id);
    
    // Get this week's events
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const events = await supabaseService.getEvents(
      user_id, 
      weekStart.toISOString(), 
      weekEnd.toISOString()
    );
    
    // Analyze patterns and generate insights
    const insights = await calendarIntelligence.analyzeWeekPatterns(events);
    
    // Generate smart suggestions based on patterns
    const suggestions = [];
    const today = new Date();
    const currentHour = today.getHours();
    const dayOfWeek = today.getDay();
    
    // Today's events
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate.toDateString() === today.toDateString();
    });
    
    // Tomorrow's events
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate.toDateString() === tomorrow.toDateString();
    });
    
    // 1. Greeting based on time of day and current activity
    let greeting = '';
    let currentActivity = null;
    
    // Find current or next event
    const upcomingEvent = todayEvents.find(event => {
      const startTime = new Date(event.event_starts_at);
      const endTime = new Date(event.event_ends_at);
      return startTime > now || (startTime <= now && endTime > now);
    });
    
    if (currentHour < 12) {
      greeting = `Good morning! It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    } else if (currentHour < 17) {
      greeting = `Good afternoon! It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    } else {
      greeting = `Good evening! It's ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    }
    
    if (upcomingEvent) {
      const startTime = new Date(upcomingEvent.event_starts_at);
      if (startTime <= now) {
        greeting += ` You're currently in "${upcomingEvent.event_title}".`;
        currentActivity = upcomingEvent.event_title;
      } else {
        const minutesUntil = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60));
        if (minutesUntil < 60) {
          greeting += ` "${upcomingEvent.event_title}" starts in ${minutesUntil} minutes.`;
        }
      }
    }
    
    greeting += ` You have ${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'total events'} today.`;
    
    // 2. Key insights based on patterns
    const keyInsights = [];
    
    // Check for overbooked days
    const busyDays = {};
    events.forEach(event => {
      const date = new Date(event.event_starts_at).toDateString();
      busyDays[date] = (busyDays[date] || 0) + 1;
    });
    
    const overbooked = Object.entries(busyDays).filter(([_, count]) => count > 6);
    if (overbooked.length > 0) {
      keyInsights.push({
        type: 'warning',
        message: `You have ${overbooked.length} overbooked ${overbooked.length === 1 ? 'day' : 'days'} this week. Consider rescheduling some meetings.`
      });
    }
    
    // Check for no break time today
    if (todayEvents.length > 3) {
      const hasBreak = todayEvents.some(e => 
        e.event_title.toLowerCase().includes('break') || 
        e.event_title.toLowerCase().includes('lunch')
      );
      if (!hasBreak) {
        keyInsights.push({
          type: 'suggestion',
          message: 'No breaks scheduled today. Your productivity will benefit from short breaks.'
        });
      }
    }
    
    // Check for exercise this week
    const exerciseEvents = events.filter(e => 
      e.event_title.toLowerCase().match(/gym|workout|exercise|yoga|run|walk|fitness/)
    );
    if (exerciseEvents.length === 0) {
      keyInsights.push({
        type: 'health',
        message: 'No exercise scheduled this week. Physical activity boosts mental performance.'
      });
    }
    
    // Check for deep work time
    const deepWorkEvents = events.filter(e => 
      e.event_title.toLowerCase().includes('deep work') || 
      e.event_title.toLowerCase().includes('focus')
    );
    if (deepWorkEvents.length < 3) {
      keyInsights.push({
        type: 'productivity',
        message: 'Limited deep work time scheduled. Consider blocking time for focused work.'
      });
    }
    
    // 3. Quick actions based on current context
    const quickActions = [];
    
    // If morning and no events for next 2 hours
    if (currentHour >= 6 && currentHour < 10) {
      const nextTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const hasNearEvent = todayEvents.some(e => {
        const start = new Date(e.event_starts_at);
        return start > now && start < nextTwoHours;
      });
      
      if (!hasNearEvent) {
        quickActions.push({
          label: 'Schedule Morning Focus',
          action: 'create_event',
          eventData: {
            title: 'Morning Focus Session',
            startTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`,
            endTime: `${(currentHour + 3).toString().padStart(2, '0')}:00`,
            description: 'Prime time for your most important work'
          }
        });
      }
    }
    
    // If it's Friday, suggest weekly review
    if (dayOfWeek === 5 && currentHour >= 15) {
      const hasReview = todayEvents.some(e => 
        e.event_title.toLowerCase().includes('review') || 
        e.event_title.toLowerCase().includes('planning')
      );
      
      if (!hasReview) {
        quickActions.push({
          label: 'Schedule Weekly Review',
          action: 'create_event',
          eventData: {
            title: 'Weekly Review & Planning',
            startTime: '17:00',
            endTime: '17:30',
            description: 'Reflect on this week and plan the next'
          }
        });
      }
    }
    
    // If tomorrow has early meeting, suggest prep time today
    if (tomorrowEvents.length > 0) {
      const earlyMeeting = tomorrowEvents.find(e => {
        const hour = new Date(e.event_starts_at).getHours();
        return hour < 10 && e.event_title.toLowerCase().includes('meeting');
      });
      
      if (earlyMeeting && currentHour < 20) {
        quickActions.push({
          label: `Prep for tomorrow's "${earlyMeeting.event_title}"`,
          action: 'create_event',
          eventData: {
            title: `Prep: ${earlyMeeting.event_title}`,
            startTime: '20:00',
            endTime: '20:30',
            description: 'Review agenda and prepare materials'
          }
        });
      }
    }
    
    res.json({
      success: true,
      analysis: {
        greeting,
        currentActivity,
        weekSummary: {
          totalEvents: events.length,
          todayEvents: todayEvents.length,
          tomorrowEvents: tomorrowEvents.length,
          busiestDay: Object.entries(busyDays).sort((a, b) => b[1] - a[1])[0]?.[0],
          categories: {
            meetings: events.filter(e => e.event_title.toLowerCase().includes('meeting')).length,
            deepWork: deepWorkEvents.length,
            health: exerciseEvents.length,
            personal: events.filter(e => e.event_title.toLowerCase().match(/personal|family|friend/)).length
          }
        },
        insights: keyInsights,
        quickActions: quickActions.slice(0, 2) // Limit to 2 suggestions
      }
    });

  } catch (error) {
    console.error('Error analyzing week:', error);
    return res.status(500).json({ error: 'Failed to analyze week' });
  }
}

export async function generateInteractionFromChat(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id, chat_context } = req.body;
    
    if (!user_id || !chat_context) {
      return res.status(400).json({ error: 'user_id and chat_context are required' });
    }

    const smartService = new SmartInteractionService();
    
    // Analyze chat context to determine if an interaction is needed
    const lastMessage = chat_context[chat_context.length - 1];
    if (!lastMessage) {
      return res.json({ success: true, interaction: null });
    }
    
    // Look for scheduling-related keywords
    const schedulingKeywords = [
      'schedule', 'book', 'meeting', 'appointment', 'calendar', 
      'tomorrow', 'next week', 'later', 'time', 'when', 'plan'
    ];
    
    const messageText = lastMessage.content.toLowerCase();
    const hasSchedulingIntent = schedulingKeywords.some(keyword => messageText.includes(keyword));
    
    if (!hasSchedulingIntent) {
      return res.json({ success: true, interaction: null });
    }
    
    // Generate a contextual interaction based on the chat
    const interactions = await smartService.generateSmartInteractions(user_id);
    
    // If we have interactions, return the most relevant one
    if (interactions.length > 0) {
      return res.json({
        success: true,
        interaction: interactions[0]
      });
    }
    
    return res.json({ success: true, interaction: null });

  } catch (error) {
    console.error('Error generating interaction from chat:', error);
    return res.status(500).json({ error: 'Failed to generate interaction' });
  }
}