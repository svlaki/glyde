/**
 * Zep Deadletter Queue Retry Job
 *
 * Background job that processes failed Zep sync operations from the deadletter queue.
 * Retries operations with exponential backoff and eventual failure handling.
 *
 * Run this periodically (e.g., every 5 minutes) to ensure failed syncs eventually succeed.
 *
 * Usage:
 *   npx tsx apps/agents/src/jobs/zep-deadletter-retry.ts
 */

import { SupabaseService } from '../services/SupabaseService.js';
import { ZepGraphService } from '../services/ZepGraphService.js';
import { executeZepOperation } from '../utils/zep-sync-helper.js';

const BATCH_SIZE = 10;
const MAX_CONCURRENT = 3;

interface DeadletterItem {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  operation: string;
  idempotency_key: string;
  payload: any;
  error_message: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
}

async function retryDeadletterQueue() {
  console.log('[DLQ-RETRY] Starting deadletter queue retry job...\n');

  const supabaseService = new SupabaseService();
  const supabase = supabaseService.getClient();
  let totalProcessed = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  try {
    // Fetch items ready for retry (next_retry_at <= now)
    const { data: items, error } = await supabase
      .from('zep_deadletter_queue')
      .select('*')
      .lte('next_retry_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      throw new Error(`Failed to fetch deadletter items: ${error.message}`);
    }

    if (!items || items.length === 0) {
      console.log('[DLQ-RETRY] ✅ No items to retry\n');
      return;
    }

    console.log(`[DLQ-RETRY] Found ${items.length} items to process\n`);

    // Process items with concurrency control
    for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
      const batch = items.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.all(
        batch.map(item => retryItem(item, supabase))
      );

      // Update counts
      results.forEach(result => {
        totalProcessed++;
        if (result.success) {
          totalSucceeded++;
        } else {
          totalFailed++;
        }
      });
    }

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('[DLQ-RETRY] Job Complete');
    console.log('═══════════════════════════════════════════');
    console.log(`Total processed:  ${totalProcessed}`);
    console.log(`Succeeded:        ${totalSucceeded}`);
    console.log(`Failed:           ${totalFailed}`);
    console.log('═══════════════════════════════════════════\n');
  } catch (error) {
    console.error('[DLQ-RETRY] ❌ Job failed:', error);
    process.exit(1);
  }
}

async function retryItem(
  item: DeadletterItem,
  supabase: any
): Promise<{ success: boolean; itemId: string }> {
  const { id, user_id, entity_type, operation, payload, idempotency_key, retry_count, max_retries } = item;

  console.log(
    `[DLQ-RETRY] Processing: ${entity_type} (${operation}) - Attempt ${retry_count + 1}/${max_retries}`
  );

  try {
    // Skip if max retries exceeded
    if (retry_count >= max_retries) {
      console.warn(`[DLQ-RETRY] ⚠️  Max retries exceeded for item ${id}. Moving to failed state.`);

      await supabase
        .from('zep_deadletter_queue')
        .update({
          last_attempted_at: new Date().toISOString(),
          retry_count: retry_count + 1
        })
        .eq('id', id);

      // Log final failure
      await supabase
        .from('zep_sync_log')
        .insert({
          user_id,
          entity_type,
          entity_id: item.entity_id,
          operation,
          idempotency_key,
          status: 'failed',
          error_message: `Max retries (${max_retries}) exceeded`,
          attempt_number: retry_count + 1,
          metadata: { from_dlq: true }
        });

      return { success: false, itemId: id };
    }

    // Attempt the operation
    const zepGraphService = new ZepGraphService();
    let operationSucceeded = false;

    try {
      switch (operation) {
        case 'create_event':
          if (payload.eventId && user_id) {
            await zepGraphService.addCalendarEvent(user_id, {
              eventId: payload.eventId,
              title: payload.title,
              category: payload.category || '',
              duration_minutes: payload.duration_minutes,
              energy_level: payload.energy_level || 'medium',
              location: payload.location,
              attendee_count: payload.attendee_count || 0
            });
            operationSucceeded = true;
          }
          break;

        case 'create_task':
          if (payload.taskId && user_id) {
            await zepGraphService.addTask(user_id, {
              taskId: payload.taskId,
              title: payload.title,
              priority: payload.priority || 'medium',
              category: payload.category,
              estimated_duration: payload.estimated_duration,
              actual_duration: payload.actual_duration,
              satisfaction_rating: payload.satisfaction_rating,
              energy_required: payload.energy_required || 'medium'
            });
            operationSucceeded = true;
          }
          break;

        case 'create_goal':
          if (payload.goalId && user_id) {
            await zepGraphService.addGoal(user_id, {
              goalId: payload.goalId,
              title: payload.title,
              goal_type: payload.goal_type || 'custom',
              status: payload.status || 'active',
              progress_percentage: payload.progress_percentage || 0,
              deadline: payload.deadline,
              time_invested_minutes: payload.time_invested_minutes || 0
            });
            operationSucceeded = true;
          }
          break;

        case 'delete_event':
          // Deletion is handled via invalidation - just mark as synced
          operationSucceeded = true;
          break;

        default:
          console.warn(`[DLQ-RETRY] ⚠️  Unknown operation type: ${operation}`);
      }
    } catch (opError) {
      const errorMsg = opError instanceof Error ? opError.message : String(opError);
      console.error(`[DLQ-RETRY] ❌ Operation failed: ${errorMsg}`);

      // Schedule next retry with exponential backoff
      const backoffMs = 5 * 60 * 1000 * Math.pow(2, Math.min(retry_count, 3)); // 5min, 10min, 20min, 40min
      const nextRetry = new Date(Date.now() + backoffMs);

      await supabase
        .from('zep_deadletter_queue')
        .update({
          retry_count: retry_count + 1,
          next_retry_at: nextRetry.toISOString(),
          last_attempted_at: new Date().toISOString(),
          error_message: errorMsg
        })
        .eq('id', id);

      console.log(`[DLQ-RETRY] ⏰ Next retry scheduled for ${nextRetry.toISOString()}`);
      return { success: false, itemId: id };
    }

    if (operationSucceeded) {
      // Operation succeeded - remove from DLQ and mark as synced
      await supabase
        .from('zep_deadletter_queue')
        .delete()
        .eq('id', id);

      // Update sync log
      await supabase
        .from('zep_sync_log')
        .insert({
          user_id,
          entity_type,
          entity_id: item.entity_id,
          operation,
          idempotency_key,
          status: 'success',
          attempt_number: retry_count + 1,
          metadata: { from_dlq: true, dlq_item_id: id }
        });

      // If it was an interaction, mark as synced in the interactions table
      if (entity_type === 'interaction' && item.entity_id) {
        await supabase
          .from('user_interactions')
          .update({
            zep_synced: true,
            zep_sync_error: null
          })
          .eq('id', item.entity_id);
      }

      console.log(`[DLQ-RETRY] ✅ Successfully retried and removed from queue: ${id}\n`);
      return { success: true, itemId: id };
    }

    return { success: false, itemId: id };
  } catch (error) {
    console.error(`[DLQ-RETRY] ❌ Unexpected error processing item ${id}:`, error);
    return { success: false, itemId: id };
  }
}

// Run the job
retryDeadletterQueue()
  .then(() => {
    console.log('[DLQ-RETRY] ✅ Job completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('[DLQ-RETRY] ❌ Job failed:', error);
    process.exit(1);
  });
