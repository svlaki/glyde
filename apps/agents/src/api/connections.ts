import { Request, Response } from 'express';
import { google } from 'googleapis';
import { getConnectionService } from '../services/ConnectionService.js';
import { getGoogleCalendarSyncService } from '../services/GoogleCalendarSyncService.js';
import { getCalendarMappingService } from '../services/CalendarMappingService.js';

const connectionService = getConnectionService();
const googleSyncService = getGoogleCalendarSyncService();
const calendarMappingService = getCalendarMappingService();

/**
 * Get all connections for the authenticated user
 */
export async function getConnections(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log('[CONNECTIONS API] Fetching connections for user:', userId);

    const connections = await connectionService.getConnections(userId);

    // Return safe connection data (exclude tokens)
    const safeConnections = connections.map(conn => ({
      id: conn.id,
      provider: conn.provider,
      provider_account_id: conn.provider_account_id,
      calendar_name: conn.calendar_name,
      sync_status: conn.sync_status,
      sync_error: conn.sync_error,
      last_synced_at: conn.last_synced_at,
      is_active: conn.is_active,
      connected_at: conn.connected_at
    }));

    res.json({
      success: true,
      connections: safeConnections
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
}

/**
 * Get Google OAuth URL for connecting a calendar
 */
export async function getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CONNECTION_CALLBACK_URI || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      res.status(500).json({
        error: 'Google OAuth not configured. Missing required environment variables.'
      });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly'
    ];

    // Use prompt: consent to always get a refresh token
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: JSON.stringify({ userId, flow: 'connection' })
    });

    console.log('[CONNECTIONS API] Generated Google auth URL for user:', userId);

    res.json({
      success: true,
      authUrl,
      state: userId
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
}

/**
 * Handle Google OAuth callback - exchange code for tokens and create connection
 */
export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { code, state } = req.body ?? {};

    if (!code) {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    // Validate state
    let stateData: { userId?: string; flow?: string } = {};
    try {
      stateData = JSON.parse(state || '{}');
    } catch {
      // State might be just the userId string
      stateData = { userId: state };
    }

    if (stateData.userId !== userId) {
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    console.log('[CONNECTIONS API] Processing Google callback for user:', userId);

    // Exchange code for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CONNECTION_CALLBACK_URI || process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      res.status(400).json({ error: 'Failed to get access token from Google' });
      return;
    }

    // Get calendar info
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    let calendarName = 'Primary Calendar';
    let providerAccountId = '';

    try {
      const calendarInfo = await calendar.calendarList.get({ calendarId: 'primary' });
      calendarName = calendarInfo.data.summary || calendarInfo.data.id || 'Primary Calendar';
      providerAccountId = calendarInfo.data.id || '';
    } catch (calError) {
      console.warn('[CONNECTIONS API] Could not fetch calendar info:', calError);
    }

    // Create or update connection
    const connection = await connectionService.upsertConnection(userId, {
      provider: 'google',
      provider_account_id: providerAccountId,
      calendar_name: calendarName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined,
      token_expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : undefined,
      sync_status: 'pending'
    });

    console.log('[CONNECTIONS API] Connection created/updated:', connection.id);

    // Perform initial sync in background
    setImmediate(async () => {
      try {
        // 1. Sync calendar list from Google (creates mappings for each calendar)
        await calendarMappingService.syncCalendarList(connection);

        // 2. Auto-map calendars to aspects (creates aspects if needed)
        await calendarMappingService.autoMapCalendarsToAspects(connection);

        // 3. Sync events for all enabled calendars
        await googleSyncService.syncAllEnabledCalendars(connection);

        // 4. Set up watch subscription
        await googleSyncService.setupWatchSubscription(connection);

        // Update status to synced
        await connectionService.updateSyncStatus(connection.id, 'synced');
      } catch (syncError) {
        console.error('[CONNECTIONS API] Background sync failed:', syncError);
        await connectionService.updateSyncStatus(connection.id, 'error',
          syncError instanceof Error ? syncError.message : 'Sync failed');
      }
    });

    res.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        calendar_name: connection.calendar_name,
        sync_status: connection.sync_status,
        connected_at: connection.connected_at
      },
      message: 'Google Calendar connected successfully. Initial sync in progress.'
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error in Google callback:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to connect Google Calendar'
    });
  }
}

/**
 * Trigger a manual sync for a connection
 */
export async function triggerSync(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connection_id } = req.body ?? {};

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Get connection and verify ownership
    const connection = await connectionService.getConnectionById(connection_id);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to sync this connection' });
      return;
    }

    console.log('[CONNECTIONS API] Triggering sync for connection:', connection_id);

    // Perform sync based on provider
    if (connection.provider === 'google') {
      // Start sync in background
      setImmediate(async () => {
        try {
          if (connection.sync_token) {
            await googleSyncService.performDeltaSync(connection);
          } else {
            await googleSyncService.performInitialSync(connection);
          }
        } catch (syncError) {
          console.error('[CONNECTIONS API] Sync failed:', syncError);
        }
      });
    }

    res.json({
      success: true,
      message: 'Sync started'
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
}

/**
 * Disconnect (delete) a connection
 */
export async function disconnectConnection(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connection_id } = req.body ?? {};

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Get connection and verify ownership
    const connection = await connectionService.getConnectionById(connection_id);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to disconnect this connection' });
      return;
    }

    console.log('[CONNECTIONS API] Disconnecting connection:', connection_id);

    // Stop watch subscription if exists
    if (connection.provider === 'google' && connection.watch_channel_id) {
      try {
        await googleSyncService.stopWatchSubscription(connection);
      } catch (watchError) {
        console.warn('[CONNECTIONS API] Failed to stop watch subscription:', watchError);
      }
    }

    // Delete connection
    await connectionService.deleteConnection(connection_id, userId);

    res.json({
      success: true,
      message: 'Connection disconnected successfully'
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
}

/**
 * Handle Google Calendar webhook (push notification)
 * This endpoint does NOT require authentication - it's called by Google
 */
export async function handleGoogleWebhook(req: Request, res: Response): Promise<void> {
  // Immediately respond 200 to acknowledge receipt
  res.status(200).send();

  try {
    // Google sends these headers
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceId = req.headers['x-goog-resource-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;

    console.log('[CONNECTIONS API] Webhook received:', {
      channelId,
      resourceState
    });

    // Skip sync message (sent when watch is first set up)
    if (resourceState === 'sync') {
      console.log('[CONNECTIONS API] Received sync notification, ignoring');
      return;
    }

    if (!channelId) {
      console.warn('[CONNECTIONS API] Webhook missing channel ID');
      return;
    }

    // Find connection by channel ID
    const connection = await connectionService.findByChannelId(channelId);

    if (!connection) {
      console.warn('[CONNECTIONS API] Webhook for unknown channel:', channelId);
      return;
    }

    // Verify resource ID matches
    if (connection.watch_resource_id && connection.watch_resource_id !== resourceId) {
      console.warn('[CONNECTIONS API] Resource ID mismatch');
      return;
    }

    // Queue delta sync (don't block webhook response)
    setImmediate(async () => {
      try {
        console.log('[CONNECTIONS API] Starting delta sync for connection:', connection.id);
        await googleSyncService.performDeltaSync(connection);
      } catch (syncError) {
        console.error('[CONNECTIONS API] Delta sync failed:', syncError);
      }
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error processing webhook:', error);
    // Don't throw - already sent 200 response
  }
}

/**
 * Get all calendars for a connection (fetches from Google)
 */
export async function getCalendarList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connection_id } = req.body ?? {};

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Get connection and verify ownership
    const connection = await connectionService.getConnectionById(connection_id);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to access this connection' });
      return;
    }

    console.log('[CONNECTIONS API] Fetching calendar list for connection:', connection_id);

    // Fetch calendars from Google
    const calendars = await calendarMappingService.fetchGoogleCalendarList(connection);

    res.json({
      success: true,
      calendars
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error fetching calendar list:', error);
    res.status(500).json({ error: 'Failed to fetch calendars' });
  }
}

/**
 * Get calendar mappings for a connection
 */
export async function getCalendarMappings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connection_id } = req.body ?? {};

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Get connection and verify ownership
    const connection = await connectionService.getConnectionById(connection_id);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to access this connection' });
      return;
    }

    console.log('[CONNECTIONS API] Fetching calendar mappings for connection:', connection_id);

    const mappings = await calendarMappingService.getMappingsForConnection(connection_id);

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error fetching calendar mappings:', error);
    res.status(500).json({ error: 'Failed to fetch calendar mappings' });
  }
}

/**
 * Sync calendar list from Google and create/update mappings
 */
export async function syncCalendarList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { connection_id } = req.body ?? {};

    if (!connection_id) {
      res.status(400).json({ error: 'connection_id is required' });
      return;
    }

    // Get connection and verify ownership
    const connection = await connectionService.getConnectionById(connection_id);

    if (!connection) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    if (connection.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to access this connection' });
      return;
    }

    console.log('[CONNECTIONS API] Syncing calendar list for connection:', connection_id);

    const mappings = await calendarMappingService.syncCalendarList(connection);

    res.json({
      success: true,
      mappings,
      message: `Synced ${mappings.length} calendars`
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error syncing calendar list:', error);
    res.status(500).json({ error: 'Failed to sync calendar list' });
  }
}

/**
 * Update a calendar mapping (set aspect, toggle sync, toggle visibility)
 */
export async function updateCalendarMapping(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.authUserId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { mapping_id, category_id, is_synced, is_visible } = req.body ?? {};

    if (!mapping_id) {
      res.status(400).json({ error: 'mapping_id is required' });
      return;
    }

    // Get mapping and verify ownership
    const mapping = await calendarMappingService.getMappingById(mapping_id);

    if (!mapping) {
      res.status(404).json({ error: 'Calendar mapping not found' });
      return;
    }

    if (mapping.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to update this mapping' });
      return;
    }

    console.log('[CONNECTIONS API] Updating calendar mapping:', mapping_id);

    const updates: Record<string, unknown> = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (is_synced !== undefined) updates.is_synced = is_synced;
    if (is_visible !== undefined) updates.is_visible = is_visible;

    const updated = await calendarMappingService.updateMapping(mapping_id, updates);

    // If syncing was just enabled and this calendar hasn't been synced before, trigger initial sync
    if (is_synced === true && !mapping.is_synced && !mapping.sync_token) {
      const connection = await connectionService.getConnectionById(mapping.connection_id);
      if (connection) {
        setImmediate(async () => {
          try {
            console.log('[CONNECTIONS API] Triggering initial sync for newly enabled calendar:', mapping.google_calendar_id);
            await googleSyncService.performInitialSyncForCalendar(
              connection,
              mapping.google_calendar_id,
              mapping_id,
              updated.category_id || undefined
            );
          } catch (syncError) {
            console.error('[CONNECTIONS API] Initial sync failed for calendar:', syncError);
          }
        });
      }
    }

    res.json({
      success: true,
      mapping: updated
    });
  } catch (error) {
    console.error('[CONNECTIONS API] Error updating calendar mapping:', error);
    res.status(500).json({ error: 'Failed to update calendar mapping' });
  }
}
