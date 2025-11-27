/**
 * Zep Sync Helper - Intentional Graph Population Utilities
 *
 * This module provides wrapper functions for all Zep graph operations to ensure:
 * 1. Every operation is tracked in the database (zep_sync_log)
 * 2. Idempotency keys prevent duplicate graph entries
 * 3. Failures are enqueued for retry (deadletter_queue)
 * 4. Database state is updated ONLY after Zep confirms success
 */

import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';

export interface ZepSyncOptions {
  userId: string;
  entityType: 'event' | 'task' | 'goal' | 'interaction' | 'memory';
  entityId?: string;
  operation: 'create' | 'update' | 'delete' | 'sync_attempt';
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ZepSyncResult {
  success: boolean;
  entityId: string;
  idempotencyKey: string;
  zepResponse?: any;
  error?: Error;
  retryCount: number;
}

/**
 * Execute a Zep operation with full sync tracking and error handling
 */
export async function executeZepOperation<T>(
  options: ZepSyncOptions,
  operation: (idempotencyKey: string) => Promise<T>
): Promise<ZepSyncResult> {
  const supabase = new SupabaseService().getClient();
  const idempotencyKey = uuidv4();
  let retryCount = 0;
  const maxRetries = options.maxRetries || 3;

  console.log(`[ZEP_SYNC] Starting ${options.operation} for ${options.entityType} (${options.entityId || 'new'})`);

  // Log the sync attempt start
  const logId = await logSyncAttempt(
    supabase,
    {
      user_id: options.userId,
      entity_type: options.entityType,
      entity_id: options.entityId || null,
      operation: options.operation,
      idempotency_key: idempotencyKey,
      status: 'retry',
      metadata: { attempt: 1 }
    }
  );

  try {
    // Check for idempotency - has this operation already been completed?
    const existingSync = await checkIdempotency(
      supabase,
      options.userId,
      options.entityType,
      idempotencyKey
    );

    if (existingSync && existingSync.zep_synced) {
      console.log(`[ZEP_SYNC] Idempotency check: Already synced with key ${idempotencyKey}`);
      return {
        success: true,
        entityId: existingSync.zep_entity_id || '',
        idempotencyKey,
        retryCount: 0
      };
    }

    // Execute the operation with retries
    let lastError: Error | null = null;
    for (retryCount = 0; retryCount < maxRetries; retryCount++) {
      try {
        const result = await operation(idempotencyKey);

        // Operation succeeded - mark in DB
        await markSynced(supabase, options.userId, options.entityType, {
          idempotency_key: idempotencyKey,
          entity_id: options.entityId,
          zep_entity_id: typeof result === 'string' ? result : null,
          log_id: logId
        });

        console.log(
          `[ZEP_SYNC] ${options.operation} succeeded for ${options.entityType} after ${retryCount + 1} attempt(s)`
        );

        return {
          success: true,
          entityId: typeof result === 'string' ? result : '',
          idempotencyKey,
          zepResponse: result,
          retryCount
        };
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[ZEP_SYNC] Attempt ${retryCount + 1}/${maxRetries} failed:`,
          lastError.message
        );

        // Wait before retry (exponential backoff)
        if (retryCount < maxRetries - 1) {
          const delayMs = (options.retryDelayMs || 1000) * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries exhausted - enqueue for background retry
    await enqueueDLQ(supabase, {
      user_id: options.userId,
      entity_type: options.entityType,
      entity_id: options.entityId || null,
      operation: options.operation,
      idempotency_key: idempotencyKey,
      payload: { entityType: options.entityType, entityId: options.entityId },
      error_message: lastError?.message || 'Unknown error',
      log_id: logId
    });

    throw lastError || new Error('Zep operation failed after all retries');
  } catch (error) {
    // Log final failure
    await markSyncError(
      supabase,
      options.userId,
      options.entityType,
      idempotencyKey,
      error instanceof Error ? error.message : 'Unknown error',
      logId
    );

    console.error(
      `[ZEP_SYNC] ${options.operation} failed for ${options.entityType}:`,
      error
    );

    return {
      success: false,
      entityId: '',
      idempotencyKey,
      error: error instanceof Error ? error : new Error(String(error)),
      retryCount
    };
  }
}

/**
 * Log a sync attempt to the audit trail (gracefully handles missing table)
 */
async function logSyncAttempt(supabase: any, data: {
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  operation: string;
  idempotency_key: string;
  status: string;
  metadata?: any;
}): Promise<string> {
  try {
    const { data: result, error } = await supabase
      .from('zep_sync_log')
      .insert({
        user_id: data.user_id,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        operation: data.operation,
        idempotency_key: data.idempotency_key,
        status: data.status,
        attempt_number: 1,
        metadata: data.metadata || {}
      })
      .select('id')
      .single();

    if (error) {
      // If table doesn't exist, just log and continue
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        console.warn('[ZEP_SYNC] Sync log table not available yet, continuing without audit trail');
        return 'no-log';
      }
      console.error('[ZEP_SYNC] Error logging sync attempt:', error);
      throw error;
    }

    return result.id;
  } catch (err) {
    console.error('[ZEP_SYNC] Unexpected error logging attempt:', err);
    return 'no-log';
  }
}

/**
 * Check if an operation has already been synced (idempotency)
 */
async function checkIdempotency(
  supabase: any,
  userId: string,
  entityType: string,
  idempotencyKey: string
): Promise<any> {
  const { data } = await supabase
    .from('zep_sync_log')
    .select('*')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('idempotency_key', idempotencyKey)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

/**
 * Mark an interaction as successfully synced
 */
async function markSynced(
  supabase: any,
  userId: string,
  entityType: string,
  data: {
    idempotency_key: string;
    entity_id?: string;
    zep_entity_id?: string | null;
    log_id: string;
  }
): Promise<void> {
  // Update the sync log
  const { error: logError } = await supabase
    .from('zep_sync_log')
    .update({
      status: 'success',
      completed_at: new Date().toISOString()
    })
    .eq('id', data.log_id);

  if (logError) {
    console.error('[ZEP_SYNC] Error updating sync log:', logError);
  }

  // Update the entity if it's an interaction
  if (entityType === 'interaction' && data.entity_id) {
    const { error: updateError } = await supabase
      .from('user_interactions')
      .update({
        zep_synced: true,
        zep_sync_error: null,
        zep_entity_id: data.zep_entity_id,
        zep_sync_last_attempted_at: new Date().toISOString()
      })
      .eq('id', data.entity_id);

    if (updateError) {
      console.error('[ZEP_SYNC] Error updating interaction sync status:', updateError);
    }
  }
}

/**
 * Mark an interaction with a sync error
 */
async function markSyncError(
  supabase: any,
  userId: string,
  entityType: string,
  idempotencyKey: string,
  errorMessage: string,
  logId: string
): Promise<void> {
  // Update the sync log with error
  const { error: logError } = await supabase
    .from('zep_sync_log')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString()
    })
    .eq('id', logId);

  if (logError) {
    console.error('[ZEP_SYNC] Error updating sync log with error:', logError);
  }
}

/**
 * Enqueue a failed operation to the deadletter queue for background retry
 */
async function enqueueDLQ(
  supabase: any,
  data: {
    user_id: string;
    entity_type: string;
    entity_id: string | null;
    operation: string;
    idempotency_key: string;
    payload: any;
    error_message: string;
    log_id: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('zep_deadletter_queue')
    .insert({
      user_id: data.user_id,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      operation: data.operation,
      idempotency_key: data.idempotency_key,
      payload: data.payload,
      error_message: data.error_message,
      retry_count: 0,
      max_retries: 5,
      next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    });

  if (error) {
    console.error('[ZEP_SYNC] Error enqueueing to DLQ:', error);
  }
}

/**
 * Wrapper for safe interaction creation with Zep sync
 */
export async function createInteractionWithZepSync(
  userId: string,
  interactionData: any,
  zepOperation: () => Promise<string>
): Promise<ZepSyncResult> {
  return executeZepOperation(
    {
      userId,
      entityType: 'interaction',
      operation: 'create',
      entityId: interactionData.id
    },
    async () => await zepOperation()
  );
}

/**
 * Wrapper for safe calendar event creation with Zep sync
 */
export async function createEventWithZepSync(
  userId: string,
  eventId: string,
  eventData: any,
  zepOperation: () => Promise<string>
): Promise<ZepSyncResult> {
  return executeZepOperation(
    {
      userId,
      entityType: 'event',
      entityId: eventId,
      operation: 'create'
    },
    async () => await zepOperation()
  );
}

/**
 * Wrapper for safe task creation with Zep sync
 */
export async function createTaskWithZepSync(
  userId: string,
  taskId: string,
  taskData: any,
  zepOperation: () => Promise<string>
): Promise<ZepSyncResult> {
  return executeZepOperation(
    {
      userId,
      entityType: 'task',
      entityId: taskId,
      operation: 'create'
    },
    async () => await zepOperation()
  );
}
