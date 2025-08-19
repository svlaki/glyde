import { Request, Response } from 'express';
import { supabase } from '../services/SupabaseService.js';
import { createUserEvent } from './events.js';

// Store pending interactions in memory (in production, use Redis or database)
const pendingInteractions = new Map();

// Test scenarios for development - Context-aware and intelligent suggestions
const TEST_SCENARIOS = {
  'morning-routine': {
    question: 'Start your day right - schedule your morning routine at 8:00 AM?',
    type: 'yes_no',
    eventData: {
      title: 'Morning Routine',
      startTime: '08:00',
      endTime: '08:30',
      description: 'Coffee, planning, and mindful start to the day'
    }
  },
  'deep-work-block': {
    question: 'You have a 3-hour free block this afternoon. What type of focused work?',
    type: 'multiple_choice',
    options: ['Strategic Planning', 'Creative Work', 'Learning & Development'],
    eventData: {
      title: 'Deep Work Session',
      startTime: (() => {
        const hour = Math.max(new Date().getHours() + 1, 14);
        return `${String(hour).padStart(2, '0')}:00`;
      })(),
      endTime: (() => {
        const hour = Math.max(new Date().getHours() + 4, 17);
        return `${String(hour).padStart(2, '0')}:00`;
      })(),
      description: 'Uninterrupted focused work time'
    }
  },
  'evening-reflection': {
    question: 'End your day with 30 minutes of reflection and tomorrow\'s planning?',
    type: 'yes_no',
    eventData: {
      title: 'Daily Reflection',
      startTime: '20:00',
      endTime: '20:30',
      description: 'Review today\'s accomplishments and plan tomorrow'
    }
  },
  'health-break': {
    question: 'You\'ve been at your computer for 4 hours. Time for a health break?',
    type: 'multiple_choice',
    options: ['Walk Outside', 'Quick Workout', 'Stretching'],
    eventData: {
      title: 'Health Break',
      startTime: '15:30',
      endTime: '16:00',
      description: 'Take care of your physical and mental health'
    }
  },
  'skill-development': {
    question: 'Friday afternoon is perfect for learning. What skill do you want to develop?',
    type: 'multiple_choice',
    options: ['Technical Skills', 'Leadership', 'Creative Skills'],
    eventData: {
      title: 'Skill Development',
      startTime: '15:00',
      endTime: '16:30',
      description: 'Invest in your personal and professional growth'
    }
  },
  'weekly-review': {
    question: 'Sunday is ideal for weekly review and next week\'s planning. Schedule it?',
    type: 'yes_no',
    eventData: {
      title: 'Weekly Review & Planning',
      startTime: '19:00',
      endTime: '20:00',
      description: 'Reflect on the week and plan ahead strategically'
    }
  },
  'social-connection': {
    question: 'You haven\'t scheduled social time this week. Coffee with a friend?',
    type: 'yes_no',
    eventData: {
      title: 'Social Connection',
      startTime: '11:00',
      endTime: '12:00',
      description: 'Nurture relationships and recharge socially'
    }
  },
  'urgent-task-focus': {
    question: 'You have urgent tasks due tomorrow. Schedule a dedicated focus session?',
    type: 'yes_no',
    eventData: {
      title: 'Urgent Task Focus',
      startTime: '09:00',
      endTime: '11:00',
      description: 'Tackle high-priority urgent tasks with full attention'
    }
  }
};

// Analyze user's calendar and generate intelligent interactions
async function generateContextualInteractions(userId: string): Promise<any[]> {
  try {
    const supabaseService = new (await import('../services/SupabaseService.js')).SupabaseService();
    const calendarIntelligence = new (await import('../services/CalendarIntelligenceService.js')).CalendarIntelligenceService(userId);
    const events = await supabaseService.getEvents(userId);
    
    const now = new Date();
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate.toDateString() === now.toDateString();
    });
    
    const interactions = [];
    
    // Get the week's events for better context
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate >= weekStart && eventDate <= weekEnd;
    });
    
    // Analyze the user's week patterns (we'll use this context but keep interactions simple for now)
    // const insights = await calendarIntelligence.analyzePatterns(weekEvents);
    
    // Only generate interactions if we don't already have pending ones
    const currentHour = new Date().getHours();
    
    // Priority 1: If today looks empty and it's still early, suggest planning
    if (todayEvents.length === 0 && currentHour < 14) {
      // Suggest morning routine if it's early in the day, afternoon planning if it's later
      if (currentHour < 12) {
        // Schedule for next available hour if it's morning
        const nextHour = Math.max(currentHour + 1, 9); // At least 9 AM
        interactions.push({
          id: `empty-day-${userId}-${Date.now()}`,
          question: 'Your day looks open! Start with a productive morning routine?',
          type: 'yes_no',
          eventData: {
            title: 'Productive Morning Start',
            startTime: `${String(nextHour).padStart(2, '0')}:00`,
            endTime: `${String(nextHour).padStart(2, '0')}:30`,
            description: 'Set intentions and priorities for a successful day'
          }
        });
      } else if (currentHour < 18) {
        // Schedule for an hour from now in the afternoon
        const nextHour = Math.min(currentHour + 1, 16); // Latest at 4 PM
        interactions.push({
          id: `afternoon-planning-${userId}-${Date.now()}`,
          question: 'Your afternoon is wide open! Schedule some focused work time?',
          type: 'multiple_choice',
          options: ['Deep Work', 'Planning', 'Creative Time'],
          eventData: {
            title: 'Focused Afternoon',
            startTime: `${String(nextHour).padStart(2, '0')}:00`,
            endTime: `${String(nextHour + 2).padStart(2, '0')}:00`,
            description: 'Make the most of your open afternoon'
          }
        });
      }
    } else if (todayEvents.length > 5) {
      interactions.push({
        id: `busy-day-${userId}-${Date.now()}`,
        question: 'Your schedule is packed! Block 15 minutes for a breathing break?',
        type: 'yes_no',
        eventData: {
          title: 'Mindfulness Break',
          startTime: '15:00',
          endTime: '15:15',
          description: 'Reset and recharge with mindful breathing'
        }
      });
    }
    
    // Check for meaningful gaps between meetings (only during reasonable hours)
    for (let i = 0; i < todayEvents.length - 1; i++) {
      const currentEnd = new Date(todayEvents[i].event_ends_at);
      const nextStart = new Date(todayEvents[i + 1].event_starts_at);
      const gapHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);
      
      // Only suggest gap filling for 2+ hour gaps during reasonable hours (9 AM - 9 PM local)
      if (gapHours >= 2) {
        const currentEndHour = currentEnd.getHours(); // Use local hours
        const nextStartHour = nextStart.getHours(); // Use local hours
        
        // Skip if the gap is outside reasonable working hours
        if (currentEndHour >= 9 && nextStartHour <= 21) {
          const gapStartTime = String(currentEnd.getHours()).padStart(2, '0') + ':' + String(currentEnd.getMinutes()).padStart(2, '0');
          const gapEndTime = String(nextStart.getHours()).padStart(2, '0') + ':' + String(nextStart.getMinutes()).padStart(2, '0');
          
          interactions.push({
            id: `gap-fill-${userId}-${Date.now()}-${i}`,
            question: `You have ${Math.round(gapHours)} hours free from ${gapStartTime} to ${gapEndTime}. What would be most valuable?`,
            type: 'multiple_choice',
            options: ['Deep Work', 'Planning', 'Exercise'],
            eventData: {
              title: 'Productive Gap Time',
              startTime: gapStartTime,
              endTime: gapEndTime,
              description: 'Make the most of your free time'
            }
          });
          break; // Only suggest one gap fill per request
        }
      }
    }
    
    // Only return 1 interaction at a time to avoid overwhelming the user
    return interactions.slice(0, 1);
  } catch (error) {
    console.error('Error generating contextual interactions:', error);
    return [];
  }
}

// Generate sample interactions for testing
export async function getPendingInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if user already has pending interactions
    const userInteractions = Array.from(pendingInteractions.values())
      .filter((interaction: any) => interaction.user_id === user_id);

    if (userInteractions.length > 0) {
      // Return existing interactions
      return res.json({
        success: true,
        interactions: userInteractions.map(i => ({
          id: i.id,
          question: i.question,
          type: i.type,
          options: 'options' in i ? i.options : undefined,
          eventData: i.eventData
        }))
      });
    }

    // Use SmartInteractionService for intelligent context-aware interactions
    const SmartInteractionService = (await import('../services/SmartInteractionService.js')).SmartInteractionService;
    const smartService = new SmartInteractionService();
    const smartInteractions = await smartService.generateSmartInteractions(user_id);
    
    // Store generated interactions
    smartInteractions.forEach(interaction => {
      pendingInteractions.set(interaction.id, {
        ...interaction,
        user_id,
        created_at: new Date().toISOString()
      });
    });

    res.json({
      success: true,
      interactions: smartInteractions
    });

  } catch (error) {
    console.error('Error getting pending interactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function respondToInteraction(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id, interaction_id, response } = req.body;
    console.log(`🎯 [INTERACTION RESPONSE] Received: user_id=${user_id}, interaction_id=${interaction_id}, response=${response}`);

    if (!user_id || !interaction_id || !response) {
      console.log('❌ [INTERACTION RESPONSE] Missing required fields');
      return res.status(400).json({ error: 'user_id, interaction_id, and response are required' });
    }

    const interaction = pendingInteractions.get(interaction_id);
    if (!interaction) {
      console.log(`❌ [INTERACTION RESPONSE] Interaction not found: ${interaction_id}`);
      return res.status(404).json({ error: 'Interaction not found' });
    }

    console.log(`✅ [INTERACTION RESPONSE] Found interaction: ${interaction.question}`);

    // Remove interaction from pending list FIRST to prevent loops
    pendingInteractions.delete(interaction_id);
    console.log(`🗑️ [INTERACTION RESPONSE] Removed interaction from pending list`);

    // Create event for "yes" responses or any non-"no" response for multiple choice
    if ((response === 'yes' || (interaction.type === 'multiple_choice' && response !== 'no')) && interaction.eventData) {
      console.log(`🏃 [INTERACTION RESPONSE] Creating event for "yes" response`);
      console.log(`🔍 [INTERACTION RESPONSE] Interaction event data:`, JSON.stringify(interaction.eventData, null, 2));
      
      try {
        const today = new Date();
        const baseDate = today.toISOString().split('T')[0];
        
        // Customize title based on response type
        let eventTitle = interaction.eventData.title;
        if (interaction.type === 'multiple_choice' && response !== 'yes') {
          eventTitle = `${response} Session`; // e.g., "Deep Work Session", "Planning Session"
        }

        // Create proper ISO timestamps that respect local timezone
        const [startHour, startMin] = interaction.eventData.startTime.split(':');
        const [endHour, endMin] = interaction.eventData.endTime.split(':');
        
        const startDate = new Date(today);
        startDate.setHours(parseInt(startHour), parseInt(startMin || '0'), 0, 0);
        
        const endDate = new Date(today);
        endDate.setHours(parseInt(endHour), parseInt(endMin || '0'), 0, 0);
        
        const eventData = {
          event_title: eventTitle,
          event_starts_at: startDate.toISOString(),
          event_ends_at: endDate.toISOString(),
          event_description: interaction.eventData.description || '',
        };

        console.log(`📅 [INTERACTION RESPONSE] Event data prepared:`, JSON.stringify(eventData, null, 2));
        console.log(`📅 [INTERACTION RESPONSE] Base date used:`, baseDate);

        // Create event using existing function
        const mockReq = { body: { user_id, event: eventData } } as Request;
        const mockRes = {
          json: (data: any) => {
            console.log(`✅ [INTERACTION RESPONSE] Event created successfully:`, JSON.stringify(data, null, 2));
            return data;
          },
          status: (code: number) => ({ 
            json: (data: any) => {
              console.log(`⚠️ [INTERACTION RESPONSE] Event creation status ${code}:`, JSON.stringify(data, null, 2));
              return data;
            }
          })
        } as any;

        console.log(`🔄 [INTERACTION RESPONSE] Calling createUserEvent with mockReq.body:`, JSON.stringify(mockReq.body, null, 2));
        await createUserEvent(mockReq, mockRes);
        console.log(`🎉 [INTERACTION RESPONSE] Event creation call completed`);
      } catch (error) {
        console.error('❌ [INTERACTION RESPONSE] Error creating event from interaction:', error);
        console.error('❌ [INTERACTION RESPONSE] Error type:', typeof error);
        console.error('❌ [INTERACTION RESPONSE] Error details:', JSON.stringify(error, null, 2));
      }
    } else {
      console.log(`👎 [INTERACTION RESPONSE] Response was "${response}" or no event data - skipping event creation`);
      if (!interaction.eventData) {
        console.log(`❌ [INTERACTION RESPONSE] No event data found in interaction:`, JSON.stringify(interaction, null, 2));
      }
    }

    res.json({
      success: true,
      message: (response === 'yes' || (interaction.type === 'multiple_choice' && response !== 'no')) ? 'Event created successfully' : 'Interaction dismissed'
    });

  } catch (error) {
    console.error('❌ [INTERACTION RESPONSE] Error responding to interaction:', error);
    res.status(500).json({ error: 'Failed to process interaction response' });
  }
}

// Trigger a specific test scenario for development
export async function triggerTestScenario(req: Request, res: Response) {
  try {
    const { user_id, scenario_id } = req.body;
    console.log(`🧪 [TEST TRIGGER] Received: user_id=${user_id}, scenario_id=${scenario_id}`);

    if (!user_id || !scenario_id) {
      console.log('❌ [TEST TRIGGER] Missing required fields');
      return res.status(400).json({ error: 'user_id and scenario_id are required' });
    }

    const scenario = TEST_SCENARIOS[scenario_id as keyof typeof TEST_SCENARIOS];
    if (!scenario) {
      console.log(`❌ [TEST TRIGGER] Invalid scenario_id: ${scenario_id}`);
      return res.status(400).json({ error: 'Invalid scenario_id' });
    }

    console.log(`✅ [TEST TRIGGER] Found scenario: ${scenario.question}`);

    // Clear any existing interactions for this user
    const keysToDelete = Array.from(pendingInteractions.keys())
      .filter(key => pendingInteractions.get(key)?.user_id === user_id);
    keysToDelete.forEach(key => pendingInteractions.delete(key));
    console.log(`🗑️ [TEST TRIGGER] Cleared ${keysToDelete.length} existing interactions`);

    // Create new interaction
    const interaction = {
      id: `test-${scenario_id}-${user_id}-${Date.now()}`,
      question: scenario.question,
      type: scenario.type,
      options: 'options' in scenario ? (scenario as any).options : undefined,
      eventData: scenario.eventData
    };

    pendingInteractions.set(interaction.id, {
      ...interaction,
      user_id,
      created_at: new Date().toISOString()
    });

    console.log(`✅ [TEST TRIGGER] Created interaction: ${interaction.id}`);

    return res.json({
      success: true,
      message: `Test scenario "${scenario_id}" triggered`,
      interaction
    });

  } catch (error) {
    console.error('❌ [TEST TRIGGER] Error triggering test scenario:', error);
    return res.status(500).json({ error: 'Failed to trigger test scenario' });
  }
}

// Clear all interactions for a user (dev utility)
export async function clearUserInteractions(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const keysToDelete = Array.from(pendingInteractions.keys())
      .filter(key => pendingInteractions.get(key)?.user_id === user_id);
    
    keysToDelete.forEach(key => pendingInteractions.delete(key));

    res.json({
      success: true,
      message: `Cleared ${keysToDelete.length} interactions for user`,
      cleared_count: keysToDelete.length
    });

  } catch (error) {
    console.error('Error clearing user interactions:', error);
    return res.status(500).json({ error: 'Failed to clear interactions' });
  }
}