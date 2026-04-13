import { Request, Response } from 'express';
import { z } from 'zod';
import { SuggestionService } from '../services/SuggestionService.js';
import { SchedulerAgent } from '../agents/scheduler/SchedulerAgent.js';
import { logger } from '../utils/logger.js';
import { sendErrorResponse, parseBody, uuidSchema } from './utils.js';

const suggestionService = new SuggestionService();

// --- Zod Schemas ---

const listSuggestionsSchema = z.object({
  user_id: uuidSchema,
  status: z.enum(['open', 'snoozed', 'completed', 'archived']).optional(),
  aspect_id: uuidSchema.optional(),
});

const createSuggestionSchema = z.object({
  user_id: uuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  suggestion_type: z.enum(['goal_step', 'task_step', 'prep_step', 'habit', 'general']),
  source_entity_type: z.enum(['goal', 'task', 'event', 'aspect']).optional(),
  source_entity_id: uuidSchema.optional(),
  aspect_id: uuidSchema.optional(),
  estimated_minutes: z.number().int().min(1).max(480).optional(),
  energy_level: z.enum(['low', 'medium', 'high']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSuggestionSchema = z.object({
  user_id: uuidSchema,
  suggestion_id: uuidSchema,
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['open', 'snoozed', 'completed', 'archived']).optional(),
  estimated_minutes: z.number().int().min(1).max(480).optional(),
  energy_level: z.enum(['low', 'medium', 'high']).optional(),
  aspect_id: uuidSchema.optional(),
});

const listSlotsSchema = z.object({
  user_id: uuidSchema,
  start_date: z.string(),
  end_date: z.string(),
});

const createSlotSchema = z.object({
  user_id: uuidSchema,
  start_time: z.string(),
  end_time: z.string(),
  suggestion_id: uuidSchema,
  source_agent: z.string().optional(),
  reasoning: z.string().optional(),
  expires_at: z.string().optional(),
});

const moveSlotSchema = z.object({
  user_id: uuidSchema,
  slot_id: uuidSchema,
  start_time: z.string(),
  end_time: z.string(),
});

const resizeSlotSchema = z.object({
  user_id: uuidSchema,
  slot_id: uuidSchema,
  end_time: z.string(),
});

const swapSlotSchema = z.object({
  user_id: uuidSchema,
  slot_id: uuidSchema,
  suggestion_id: uuidSchema.optional(),
});

const confirmSlotSchema = z.object({
  user_id: uuidSchema,
  slot_id: uuidSchema,
});

const dismissSlotSchema = z.object({
  user_id: uuidSchema,
  slot_id: uuidSchema,
  reason: z.string().max(500).optional(),
});

// --- Suggestion Handlers ---

export async function listUserSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, listSuggestionsSchema, req.body);
    if (!parsed) return;

    const suggestions = await suggestionService.listSuggestions(parsed.user_id, {
      status: parsed.status,
      aspect_id: parsed.aspect_id,
    });

    res.json({ success: true, suggestions });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to list suggestions', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createUserSuggestion(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, createSuggestionSchema, req.body);
    if (!parsed) return;

    const suggestion = await suggestionService.createSuggestion(parsed.user_id, {
      title: parsed.title,
      description: parsed.description,
      suggestion_type: parsed.suggestion_type,
      source_entity_type: parsed.source_entity_type,
      source_entity_id: parsed.source_entity_id,
      aspect_id: parsed.aspect_id,
      estimated_minutes: parsed.estimated_minutes,
      energy_level: parsed.energy_level,
      metadata: parsed.metadata,
    });

    if (!suggestion) {
      sendErrorResponse(res, 500, 'Failed to create suggestion');
      return;
    }

    res.json({ success: true, suggestion });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to create suggestion', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function updateUserSuggestion(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, updateSuggestionSchema, req.body);
    if (!parsed) return;

    const suggestion = await suggestionService.updateSuggestion(parsed.user_id, {
      suggestion_id: parsed.suggestion_id,
      title: parsed.title,
      description: parsed.description,
      status: parsed.status,
      estimated_minutes: parsed.estimated_minutes,
      energy_level: parsed.energy_level,
      aspect_id: parsed.aspect_id,
    });

    if (!suggestion) {
      sendErrorResponse(res, 404, 'Suggestion not found or failed to update');
      return;
    }

    res.json({ success: true, suggestion });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to update suggestion', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// --- Slot Handlers ---

export async function listUserSlots(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, listSlotsSchema, req.body);
    if (!parsed) return;

    const slots = await suggestionService.listSlots(parsed.user_id, {
      start_date: parsed.start_date,
      end_date: parsed.end_date,
    });

    res.json({ success: true, slots });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to list slots', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, createSlotSchema, req.body);
    if (!parsed) return;

    const slot = await suggestionService.createSlot(parsed.user_id, {
      start_time: parsed.start_time,
      end_time: parsed.end_time,
      suggestion_id: parsed.suggestion_id,
      source_agent: parsed.source_agent,
      reasoning: parsed.reasoning,
      expires_at: parsed.expires_at,
    });

    if (!slot) {
      sendErrorResponse(res, 500, 'Failed to create slot');
      return;
    }

    res.json({ success: true, slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to create slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function moveUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, moveSlotSchema, req.body);
    if (!parsed) return;

    const slot = await suggestionService.moveSlot(parsed.user_id, {
      slot_id: parsed.slot_id,
      start_time: parsed.start_time,
      end_time: parsed.end_time,
    });

    if (!slot) {
      sendErrorResponse(res, 404, 'Slot not found or failed to move');
      return;
    }

    res.json({ success: true, slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to move slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function resizeUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, resizeSlotSchema, req.body);
    if (!parsed) return;

    const slot = await suggestionService.resizeSlot(parsed.user_id, {
      slot_id: parsed.slot_id,
      end_time: parsed.end_time,
    });

    if (!slot) {
      sendErrorResponse(res, 404, 'Slot not found or failed to resize');
      return;
    }

    res.json({ success: true, slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to resize slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function swapUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, swapSlotSchema, req.body);
    if (!parsed) return;

    const slot = parsed.suggestion_id
      ? await suggestionService.swapTargeted(parsed.user_id, parsed.slot_id, parsed.suggestion_id)
      : await suggestionService.swapRandom(parsed.user_id, parsed.slot_id);

    if (!slot) {
      sendErrorResponse(res, 404, 'No alternative suggestions available for swap');
      return;
    }

    res.json({ success: true, slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to swap slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function confirmUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, confirmSlotSchema, req.body);
    if (!parsed) return;

    const result = await suggestionService.confirmSlot(parsed.user_id, parsed.slot_id);

    if (!result) {
      sendErrorResponse(res, 404, 'Slot not found or failed to confirm');
      return;
    }

    res.json({ success: true, event_id: result.event_id, slot: result.slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to confirm slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Replenish slots using lightweight DB-only placement (no LLM call).
 * Finds free time windows and places unplaced suggestions.
 * Called after confirm/dismiss to maintain visible slots.
 */
export async function replenishUserSlots(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, z.object({ user_id: uuidSchema }), req.body);
    if (!parsed) return;

    const created = await suggestionService.replenishSlotsLightweight(parsed.user_id);
    const newActiveCount = await suggestionService.getActiveSlotCount(parsed.user_id);
    res.json({ success: true, replenished: created, active_count: newActiveCount });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to replenish slots', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Heavy generate — calls SchedulerAgent with full context to batch-generate ~20 suggestions.
 * Called once daily or when backlog is low. Expensive but thorough.
 */
export async function generateSuggestionsBatch(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, z.object({ user_id: uuidSchema }), req.body);
    if (!parsed) return;

    const scheduler = new SchedulerAgent();
    await scheduler.initialize();

    await scheduler.processMessage(
      { userId: parsed.user_id, timezone: 'UTC', sessionId: 'batch-generate', conversationHistory: [] },
      `Generate a fresh batch of 15-20 action suggestions for the user based on their goals, tasks, notes, aspects, and calendar patterns. Ensure variety across aspects and energy levels. Also place 4 suggestion slots in free time windows on their calendar for the next few days.`
    );

    const activeCount = await suggestionService.getActiveSlotCount(parsed.user_id);
    const openCount = await suggestionService.listSuggestions(parsed.user_id, { status: 'open' });

    res.json({ success: true, active_slots: activeCount, open_suggestions: openCount.length });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to generate suggestions batch', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function dismissUserSlot(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(res, dismissSlotSchema, req.body);
    if (!parsed) return;

    const slot = await suggestionService.dismissSlot(parsed.user_id, parsed.slot_id, parsed.reason);

    if (!slot) {
      sendErrorResponse(res, 404, 'Slot not found or failed to dismiss');
      return;
    }

    res.json({ success: true, slot });
  } catch (error) {
    sendErrorResponse(res, 500, 'Failed to dismiss slot', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
