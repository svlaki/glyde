import { Request, Response } from 'express';
import { supabase } from '../services/SupabaseService.js';
import { createUserEvent } from './events.js';

// Store pending interactions in memory (in production, use Redis or database)
const pendingInteractions = new Map();



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
        
        // Check for conflicts before creating event
        const supabaseService = new (await import('../services/SupabaseService.js')).SupabaseService();
        const existingEvents = await supabaseService.getEvents(user_id);
        
        // Create proposed time slots
        const [startHour, startMin] = interaction.eventData.startTime.split(':');
        const [endHour, endMin] = interaction.eventData.endTime.split(':');
        
        const startDate = new Date(today);
        startDate.setHours(parseInt(startHour), parseInt(startMin || '0'), 0, 0);
        
        const endDate = new Date(today);
        endDate.setHours(parseInt(endHour), parseInt(endMin || '0'), 0, 0);
        
        // Check for time conflicts
        const hasConflict = existingEvents.some(event => {
          const eventStart = new Date(event.event_starts_at);
          const eventEnd = new Date(event.event_ends_at);
          
          // Check if proposed event overlaps with existing event
          return (startDate < eventEnd && endDate > eventStart);
        });
        
        if (hasConflict) {
          console.log(`⚠️ [INTERACTION RESPONSE] Time conflict detected, skipping event creation`);
          return res.json({
            success: true,
            message: 'Time conflict detected - suggestion dismissed'
          });
        }
        
        // Customize title based on response type
        let eventTitle = interaction.eventData.title;
        if (interaction.type === 'multiple_choice' && response !== 'yes') {
          eventTitle = response; // Use the selected option as the event title
        }
        
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