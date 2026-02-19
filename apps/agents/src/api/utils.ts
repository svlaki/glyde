import { Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Send a standardized error response with structured logging
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  meta?: Record<string, unknown>
): void {
  logger.error(`API Error: ${message}`, meta);
  res.status(statusCode).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Shared UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Base schema for requests requiring user_id
 */
export const userIdSchema = z.object({
  user_id: uuidSchema
});

/**
 * Aspect schemas
 */
export const createAspectSchema = z.object({
  user_id: uuidSchema,
  name: z.string().min(1, 'Aspect name must be a non-empty string').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #3b82f6)'),
  description: z.string().max(500).optional(),
  context: z.record(z.unknown()).optional()
});

export const updateAspectSchema = z.object({
  user_id: uuidSchema,
  aspect_id: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
  description: z.string().max(500).optional(),
  context: z.record(z.unknown()).optional(),
  visibility: z.enum(['private', 'shared']).optional()
});

export const aspectIdSchema = z.object({
  user_id: uuidSchema,
  aspect_id: uuidSchema
});

export const aspectColorSchema = z.object({
  user_id: uuidSchema,
  aspect_name: z.string().min(1, 'aspect_name is required')
});

/**
 * Project schemas
 */
export const createProjectSchema = z.object({
  user_id: uuidSchema,
  name: z.string().min(1, 'Project name is required').max(200),
  aspect_id: uuidSchema,
  description: z.string().max(2000).optional(),
  deadline: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format').optional(),
  details: z.record(z.unknown()).optional()
});

export const updateProjectSchema = z.object({
  user_id: uuidSchema,
  project_id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  deadline: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format').optional().nullable(),
  details: z.record(z.unknown()).optional(),
  aspect_id: uuidSchema.optional()
});

export const projectIdSchema = z.object({
  user_id: uuidSchema,
  project_id: uuidSchema
});

export const tagProjectSchema = z.object({
  user_id: uuidSchema,
  entity_type: z.enum(['task', 'event']),
  entity_id: uuidSchema,
  project_id: uuidSchema.nullable()
});

/**
 * Event schemas
 */
export const createEventSchema = z.object({
  user_id: uuidSchema,
  title: z.string().min(1, 'Event title is required'),
  start_time: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format for start_time'),
  end_time: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format for end_time'),
  description: z.string().optional(),
  location: z.string().optional(),
  aspect: z.string().optional(),
  aspect_id: z.string().uuid().optional()
}).refine(data => new Date(data.start_time) < new Date(data.end_time), {
  message: 'start_time must be before end_time'
});

export const updateEventSchema = z.object({
  user_id: uuidSchema,
  event_id: uuidSchema
}).passthrough();

export const deleteEventSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema.optional()
});

export const createRecurringEventSchema = z.object({
  user_id: uuidSchema,
  title: z.string().min(1, 'Event title is required'),
  start_time: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format'),
  end_time: z.string().optional(),
  recurrence_rule: z.string().min(1, 'recurrence_rule is required (RFC 5545 format)'),
  recurrence_end: z.string().nullable().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  aspect: z.string().optional()
});

export const updateRecurringEventSchema = z.object({
  user_id: uuidSchema,
  event_id: uuidSchema,
  scope: z.enum(['entire_series', 'this_instance'])
}).passthrough();

export const deleteRecurringEventSchema = z.object({
  user_id: uuidSchema,
  event_id: uuidSchema,
  scope: z.enum(['entire_series', 'this_instance', 'all_future'])
});

/**
 * Connection schemas
 */
export const connectionIdSchema = z.object({
  connection_id: uuidSchema
});

export const mappingIdSchema = z.object({
  mapping_id: uuidSchema,
  aspect_id: z.string().uuid().nullable().optional(),
  is_synced: z.boolean().optional(),
  is_visible: z.boolean().optional()
});

/**
 * Parse request body with a Zod schema.
 * Returns parsed data on success, or sends error response and returns null.
 */
export function parseBody<T extends z.ZodTypeAny>(
  res: Response,
  schema: T,
  body: unknown
): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    sendErrorResponse(res, 400, firstError.message);
    return null;
  }
  return result.data;
}
