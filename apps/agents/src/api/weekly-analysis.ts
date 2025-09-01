import { Request, Response } from 'express';
import { SupabaseService } from '../services/SupabaseService.js';
import { CalendarIntelligenceService } from '../services/CalendarIntelligenceService.js';
import { SmartInteractionService } from '../services/SmartInteractionService.js';

export async function analyzeWeek(req: Request, res: Response): Promise<Response | void> {
  try {
    const { user_id, timezone } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const userTimezone = timezone || 'UTC';
    console.log(`🌍 [WEEKLY-ANALYSIS] Using timezone: ${userTimezone}`);

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
    
    // Get today's events for context
    const todayEvents = events.filter(event => {
      const eventDate = new Date(event.event_starts_at);
      return eventDate.toDateString() === now.toDateString();
    });
    
    // Use ConversationAgent to generate dynamic greeting
    const ConversationAgent = (await import('../agents/conversation/ConversationAgent')).ConversationAgent;
    const agent = new ConversationAgent();
    
    // Create context for the agent
    const agentContext = {
      userId: user_id,
      sessionId: 'briefing-session',
      userSchema: `u_${user_id.replace(/-/g, '')}`,
      timezone: userTimezone,
      conversationHistory: [],
      userProfile: undefined
    };
    
    // Generate greeting using the agent
    const greetingPrompt = `Generate a personalized briefing greeting message. Current context:
- User timezone: ${userTimezone}
- Current time: ${now.toISOString()} UTC
- Today's events: ${todayEvents.length}
- Event titles: ${todayEvents.map(e => e.event_title).join(', ') || 'None'}

Requirements:
- Show the correct current time in the user's timezone
- Use appropriate greeting (Good morning/afternoon/evening)
- Mention how many events they have today
- Be concise and friendly
- Don't include any markdown formatting or special characters beyond basic punctuation

Format: "Good [morning/afternoon/evening]! It's [time]. You have [X] events today."`;

    const greetingResponse = await agent.processMessage(agentContext, greetingPrompt);
    
    // Extract the greeting from the agent response
    const greeting = greetingResponse.content || 
                    `Good day! You have ${todayEvents.length} events today.`;
    
    // Generate key insights based on patterns
    const keyInsights = [];
    
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

    res.json({
      success: true,
      analysis: {
        greeting,
        currentActivity: null,
        weekSummary: {
          totalEvents: events.length,
          todayEvents: todayEvents.length,
          tomorrowEvents: 0,
          busiestDay: 'Today',
          categories: {
            meetings: events.filter(e => e.event_title.toLowerCase().includes('meeting')).length,
            deepWork: deepWorkEvents.length,
            health: exerciseEvents.length,
            personal: events.filter(e => e.event_title.toLowerCase().match(/personal|family|friend/)).length
          }
        },
        insights: keyInsights,
        quickActions: []
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