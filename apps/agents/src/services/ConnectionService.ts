import { google } from 'googleapis';
import { getSupabaseClient } from './SupabaseService.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export interface UserConnection {
  id: string;
  user_id: string;
  provider: 'google' | 'microsoft';
  provider_account_id: string | null;
  calendar_name: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  sync_token: string | null;
  last_synced_at: string | null;
  sync_status: 'pending' | 'syncing' | 'synced' | 'error';
  sync_error: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expiry: string | null;
  is_active: boolean;
  connected_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionInput {
  provider: 'google' | 'microsoft';
  provider_account_id?: string;
  calendar_name?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  sync_status?: 'pending' | 'syncing' | 'synced' | 'error';
}

export interface UpdateConnectionInput {
  provider_account_id?: string;
  calendar_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  sync_token?: string;
  last_synced_at?: string;
  sync_status?: 'pending' | 'syncing' | 'synced' | 'error';
  sync_error?: string | null;
  watch_channel_id?: string | null;
  watch_resource_id?: string | null;
  watch_expiry?: string | null;
  is_active?: boolean;
}

export class ConnectionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Get all connections for a user
   */
  async getConnections(userId: string): Promise<UserConnection[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('user_id', userId)
        .order('connected_at', { ascending: false });

      if (error) {
        logger.error('[ConnectionService] Error fetching connections:', error);
        return [];
      }

      return (data || []) as UserConnection[];
    } catch (error) {
      logger.error('[ConnectionService] Exception fetching connections:', error);
      return [];
    }
  }

  /**
   * Get a specific connection by provider
   */
  async getConnection(userId: string, provider: string): Promise<UserConnection | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        logger.error('[ConnectionService] Error fetching connection:', error);
        return null;
      }

      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception fetching connection:', error);
      return null;
    }
  }

  /**
   * Get a connection by its ID
   */
  async getConnectionById(connectionId: string): Promise<UserConnection | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (error) {
        logger.error('[ConnectionService] Error fetching connection by ID:', error);
        return null;
      }

      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception fetching connection by ID:', error);
      return null;
    }
  }

  /**
   * Create a new connection
   */
  async createConnection(userId: string, input: CreateConnectionInput): Promise<UserConnection | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .insert({
          user_id: userId,
          provider: input.provider,
          provider_account_id: input.provider_account_id || null,
          calendar_name: input.calendar_name || null,
          access_token: input.access_token,
          refresh_token: input.refresh_token || null,
          token_expires_at: input.token_expires_at || null,
          sync_status: input.sync_status || 'pending',
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('[ConnectionService] Error creating connection:', error);
        throw new Error(`Failed to create connection: ${error.message}`);
      }

      logger.info('[ConnectionService] Connection created:', data.id);
      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception creating connection:', error);
      throw error;
    }
  }

  /**
   * Update an existing connection (upsert by user + provider)
   */
  async upsertConnection(userId: string, input: CreateConnectionInput): Promise<UserConnection> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .upsert({
          user_id: userId,
          provider: input.provider,
          provider_account_id: input.provider_account_id || null,
          calendar_name: input.calendar_name || null,
          access_token: input.access_token,
          refresh_token: input.refresh_token || null,
          token_expires_at: input.token_expires_at || null,
          sync_status: input.sync_status || 'pending',
          is_active: true,
          connected_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider'
        })
        .select()
        .single();

      if (error) {
        logger.error('[ConnectionService] Error upserting connection:', error);
        throw new Error(`Failed to upsert connection: ${error.message}`);
      }

      logger.info('[ConnectionService] Connection upserted:', data.id);
      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception upserting connection:', error);
      throw error;
    }
  }

  /**
   * Update a connection by ID
   */
  async updateConnection(connectionId: string, updates: UpdateConnectionInput): Promise<UserConnection> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.provider_account_id !== undefined) updateData.provider_account_id = updates.provider_account_id;
      if (updates.calendar_name !== undefined) updateData.calendar_name = updates.calendar_name;
      if (updates.access_token !== undefined) updateData.access_token = updates.access_token;
      if (updates.refresh_token !== undefined) updateData.refresh_token = updates.refresh_token;
      if (updates.token_expires_at !== undefined) updateData.token_expires_at = updates.token_expires_at;
      if (updates.sync_token !== undefined) updateData.sync_token = updates.sync_token;
      if (updates.last_synced_at !== undefined) updateData.last_synced_at = updates.last_synced_at;
      if (updates.sync_status !== undefined) updateData.sync_status = updates.sync_status;
      if (updates.sync_error !== undefined) updateData.sync_error = updates.sync_error;
      if (updates.watch_channel_id !== undefined) updateData.watch_channel_id = updates.watch_channel_id;
      if (updates.watch_resource_id !== undefined) updateData.watch_resource_id = updates.watch_resource_id;
      if (updates.watch_expiry !== undefined) updateData.watch_expiry = updates.watch_expiry;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { data, error } = await this.supabase
        .from('user_connections')
        .update(updateData)
        .eq('id', connectionId)
        .select()
        .single();

      if (error) {
        logger.error('[ConnectionService] Error updating connection:', error);
        throw new Error(`Failed to update connection: ${error.message}`);
      }

      logger.info('[ConnectionService] Connection updated:', connectionId);
      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception updating connection:', error);
      throw error;
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', userId);

      if (error) {
        logger.error('[ConnectionService] Error deleting connection:', error);
        throw new Error(`Failed to delete connection: ${error.message}`);
      }

      logger.info('[ConnectionService] Connection deleted:', connectionId);
    } catch (error) {
      logger.error('[ConnectionService] Exception deleting connection:', error);
      throw error;
    }
  }

  /**
   * Get count of synced events for a connection (for disconnect preview)
   */
  async getSyncedEventCount(connectionId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('connection_id', connectionId);

      if (error) {
        logger.error('[ConnectionService] Error counting synced events:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('[ConnectionService] Exception counting synced events:', error);
      return 0;
    }
  }

  /**
   * Clean up events and mappings when disconnecting.
   * deleteEvents=true: removes all synced events
   * deleteEvents=false: converts synced events to local events (nulls connection_id and google_event_id)
   */
  async cleanupOnDisconnect(connectionId: string, userId: string, deleteEvents: boolean): Promise<void> {
    try {
      if (deleteEvents) {
        const { error } = await this.supabase
          .from('events')
          .delete()
          .eq('connection_id', connectionId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[ConnectionService] Error deleting synced events:', error);
        } else {
          logger.info('[ConnectionService] Deleted synced events for connection:', connectionId);
        }
      } else {
        const { error } = await this.supabase
          .from('events')
          .update({ connection_id: null, google_event_id: null, source: 'local' })
          .eq('connection_id', connectionId)
          .eq('user_id', userId);

        if (error) {
          logger.error('[ConnectionService] Error converting events to local:', error);
        } else {
          logger.info('[ConnectionService] Converted synced events to local for connection:', connectionId);
        }
      }

      // Delete calendar mappings
      const { error: mappingError } = await this.supabase
        .from('user_calendar_mappings')
        .delete()
        .eq('connection_id', connectionId);

      if (mappingError) {
        logger.error('[ConnectionService] Error deleting calendar mappings:', mappingError);
      } else {
        logger.info('[ConnectionService] Deleted calendar mappings for connection:', connectionId);
      }
    } catch (error) {
      logger.error('[ConnectionService] Exception in cleanup:', error);
    }
  }

  /**
   * Find a connection by watch channel ID (for webhook processing)
   */
  async findByChannelId(channelId: string): Promise<UserConnection | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('watch_channel_id', channelId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('[ConnectionService] Error finding connection by channel ID:', error);
        return null;
      }

      return data as UserConnection;
    } catch (error) {
      logger.error('[ConnectionService] Exception finding connection by channel ID:', error);
      return null;
    }
  }

  /**
   * Get connections with watch subscriptions expiring soon
   */
  async getExpiringSoonWatches(minutesFromNow: number): Promise<UserConnection[]> {
    try {
      const expiryThreshold = new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('user_connections')
        .select('*')
        .eq('is_active', true)
        .not('watch_expiry', 'is', null)
        .lte('watch_expiry', expiryThreshold);

      if (error) {
        logger.error('[ConnectionService] Error fetching expiring watches:', error);
        return [];
      }

      return (data || []) as UserConnection[];
    } catch (error) {
      logger.error('[ConnectionService] Exception fetching expiring watches:', error);
      return [];
    }
  }

  /**
   * Update sync status for a connection
   */
  async updateSyncStatus(
    connectionId: string,
    status: 'pending' | 'syncing' | 'synced' | 'error',
    error?: string
  ): Promise<void> {
    try {
      const updates: Record<string, any> = {
        sync_status: status,
        updated_at: new Date().toISOString()
      };

      if (status === 'synced') {
        updates.last_synced_at = new Date().toISOString();
        updates.sync_error = null;
      } else if (status === 'error' && error) {
        updates.sync_error = error;
      }

      const { error: dbError } = await this.supabase
        .from('user_connections')
        .update(updates)
        .eq('id', connectionId);

      if (dbError) {
        logger.error('[ConnectionService] Error updating sync status:', dbError);
      }
    } catch (err) {
      logger.error('[ConnectionService] Exception updating sync status:', err);
    }
  }

  /**
   * Update watch subscription details
   */
  async updateWatchSubscription(
    connectionId: string,
    channelId: string,
    resourceId: string,
    expiry: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_connections')
        .update({
          watch_channel_id: channelId,
          watch_resource_id: resourceId,
          watch_expiry: expiry,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) {
        logger.error('[ConnectionService] Error updating watch subscription:', error);
        throw new Error(`Failed to update watch subscription: ${error.message}`);
      }

      logger.info('[ConnectionService] Watch subscription updated for connection:', connectionId);
    } catch (err) {
      logger.error('[ConnectionService] Exception updating watch subscription:', err);
      throw err;
    }
  }

  /**
   * Clear watch subscription details
   */
  async clearWatchSubscription(connectionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_connections')
        .update({
          watch_channel_id: null,
          watch_resource_id: null,
          watch_expiry: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

      if (error) {
        logger.error('[ConnectionService] Error clearing watch subscription:', error);
      }
    } catch (err) {
      logger.error('[ConnectionService] Exception clearing watch subscription:', err);
    }
  }

  /**
   * Get a valid access token, refreshing if needed
   */
  async getValidAccessToken(connection: UserConnection): Promise<string> {
    // Check if token is expired or will expire in 5 minutes
    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at);
      const now = new Date();
      const bufferMs = 5 * 60 * 1000; // 5 minutes

      if (expiresAt.getTime() - now.getTime() < bufferMs) {
        logger.info('[ConnectionService] Token expired or expiring soon, refreshing...');
        const refreshed = await this.refreshToken(connection);
        return refreshed.access_token;
      }
    }

    return connection.access_token;
  }

  /**
   * Refresh an OAuth token
   */
  async refreshToken(connection: UserConnection): Promise<UserConnection> {
    if (!connection.refresh_token) {
      throw new Error('No refresh token available for connection');
    }

    if (connection.provider === 'google') {
      return this.refreshGoogleToken(connection);
    } else if (connection.provider === 'microsoft') {
      return this.refreshMicrosoftToken(connection);
    }

    throw new Error(`Unsupported provider: ${connection.provider}`);
  }

  /**
   * Refresh a Google OAuth token
   */
  private async refreshGoogleToken(connection: UserConnection): Promise<UserConnection> {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      const updated = await this.updateConnection(connection.id, {
        access_token: credentials.access_token!,
        token_expires_at: credentials.expiry_date
          ? new Date(credentials.expiry_date).toISOString()
          : undefined
      });

      logger.info('[ConnectionService] Google token refreshed for connection:', connection.id);
      return updated;
    } catch (error) {
      logger.error('[ConnectionService] Failed to refresh Google token:', error);
      await this.updateSyncStatus(connection.id, 'error', 'Failed to refresh token');
      throw new Error('Failed to refresh Google OAuth token');
    }
  }

  /**
   * Refresh a Microsoft OAuth token
   */
  private async refreshMicrosoftToken(connection: UserConnection): Promise<UserConnection> {
    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      refresh_token: connection.refresh_token!,
      grant_type: 'refresh_token',
      scope: 'Calendars.Read offline_access'
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(data.error_description || 'Token refresh failed');
      }

      const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

      const updated = await this.updateConnection(connection.id, {
        access_token: data.access_token,
        refresh_token: data.refresh_token || connection.refresh_token,
        token_expires_at: expiresAt
      });

      logger.info('[ConnectionService] Microsoft token refreshed for connection:', connection.id);
      return updated;
    } catch (error) {
      logger.error('[ConnectionService] Failed to refresh Microsoft token:', error);
      await this.updateSyncStatus(connection.id, 'error', 'Failed to refresh token');
      throw new Error('Failed to refresh Microsoft OAuth token');
    }
  }
}

// Export singleton instance
const connectionServiceInstance = new ConnectionService();
export function getConnectionService(): ConnectionService {
  return connectionServiceInstance;
}
