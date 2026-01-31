import { getConnectionService } from '../services/ConnectionService.js';
import { getGoogleCalendarSyncService } from '../services/GoogleCalendarSyncService.js';

const connectionService = getConnectionService();
const googleSyncService = getGoogleCalendarSyncService();

// Renew watches 12 hours before they expire
const RENEWAL_BUFFER_HOURS = 12;
// Check every 6 hours
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Renew watch subscriptions that are expiring soon
 */
export async function renewExpiringWatches(): Promise<void> {
  console.log('[WATCH-RENEWAL] Checking for expiring watch subscriptions...');

  try {
    const expiringConnections = await connectionService.getExpiringSoonWatches(
      RENEWAL_BUFFER_HOURS * 60 // Convert to minutes
    );

    if (expiringConnections.length === 0) {
      console.log('[WATCH-RENEWAL] No watch subscriptions need renewal');
      return;
    }

    console.log(`[WATCH-RENEWAL] Found ${expiringConnections.length} connections to renew`);

    for (const connection of expiringConnections) {
      try {
        console.log(`[WATCH-RENEWAL] Renewing watch for connection: ${connection.id}`);
        await googleSyncService.renewWatchSubscription(connection);
        console.log(`[WATCH-RENEWAL] Successfully renewed watch for: ${connection.id}`);
      } catch (error) {
        console.error(`[WATCH-RENEWAL] Failed to renew watch for ${connection.id}:`, error);
        // Continue with other connections even if one fails
      }
    }

    console.log('[WATCH-RENEWAL] Renewal check completed');
  } catch (error) {
    console.error('[WATCH-RENEWAL] Error during renewal check:', error);
  }
}

let renewalInterval: NodeJS.Timeout | null = null;

/**
 * Start the watch renewal background job
 */
export function startWatchRenewalJob(): void {
  if (renewalInterval) {
    console.log('[WATCH-RENEWAL] Job already running');
    return;
  }

  console.log('[WATCH-RENEWAL] Starting watch renewal job');
  console.log(`[WATCH-RENEWAL] Will check every ${CHECK_INTERVAL_MS / (60 * 60 * 1000)} hours`);
  console.log(`[WATCH-RENEWAL] Will renew watches ${RENEWAL_BUFFER_HOURS} hours before expiry`);

  // Run immediately on startup
  renewExpiringWatches().catch(err => {
    console.error('[WATCH-RENEWAL] Initial check failed:', err);
  });

  // Then run on interval
  renewalInterval = setInterval(() => {
    renewExpiringWatches().catch(err => {
      console.error('[WATCH-RENEWAL] Scheduled check failed:', err);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the watch renewal background job
 */
export function stopWatchRenewalJob(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
    console.log('[WATCH-RENEWAL] Job stopped');
  }
}
