import apn from '@parse/node-apn';
import { getSupabaseService } from './SupabaseService.js';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
}

interface SendResult {
  sent: number;
  failed: number;
}

class PushNotificationService {
  private provider: apn.Provider | null = null;
  private initialized = false;

  initialize(): void {
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const keyContent = process.env.APNS_KEY_CONTENT;
    const production = process.env.APNS_PRODUCTION === 'true';

    if (!keyId || !teamId || !keyContent) {
      console.warn('[PUSH] APNs credentials not configured — push notifications disabled');
      console.warn(`[PUSH] APNS_KEY_ID: ${keyId ? 'set' : 'MISSING'}, APNS_TEAM_ID: ${teamId ? 'set' : 'MISSING'}, APNS_KEY_CONTENT: ${keyContent ? 'set' : 'MISSING'}`);
      return;
    }

    try {
      // Restore PEM format: env vars may flatten newlines or strip them entirely
      let key = keyContent.replace(/\\n/g, '\n');
      if (!key.includes('\n')) {
        // Key is completely flat — reconstruct PEM structure
        const pemBody = key
          .replace('-----BEGIN PRIVATE KEY-----', '')
          .replace('-----END PRIVATE KEY-----', '')
          .trim();
        key = `-----BEGIN PRIVATE KEY-----\n${pemBody}\n-----END PRIVATE KEY-----`;
      }

      this.provider = new apn.Provider({
        token: {
          key,
          keyId,
          teamId,
        },
        production,
      });
      this.initialized = true;
      console.log(`[PUSH] APNs provider initialized (production: ${production})`);
    } catch (error) {
      console.error('[PUSH] Failed to initialize APNs provider:', error);
    }
  }

  async sendToUser(userId: string, notification: PushPayload): Promise<SendResult> {
    console.log(`[PUSH] sendToUser called for ${userId}, initialized: ${this.initialized}`);
    if (!this.initialized || !this.provider) {
      console.log('[PUSH] Provider not initialized, skipping');
      return { sent: 0, failed: 0 };
    }

    const client = getSupabaseService().getClient();
    const { data: tokens, error } = await client
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('platform', 'ios');

    console.log(`[PUSH] Found ${tokens?.length ?? 0} token(s) for user ${userId}`, error ? `error: ${error.message}` : '');

    if (error || !tokens || tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const bundleId = process.env.APNS_BUNDLE_ID || 'com.svlaki.glyde';

    const note = new apn.Notification();
    note.alert = { title: notification.title, body: notification.body };
    note.sound = notification.sound || 'default';
    note.topic = bundleId;
    note.pushType = 'alert';
    // iOS 15+ properties for banner/sound presentation (supported by @parse/node-apn at runtime)
    (note as any).interruptionLevel = 'time-sensitive';
    (note as any).relevanceScore = 1.0;
    note.payload = notification.data || {};

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    for (const { token } of tokens) {
      try {
        const result = await this.provider.send(note, token);
        console.log(`[PUSH] APNs result — sent: ${result.sent.length}, failed: ${result.failed.length}`);

        if (result.sent.length > 0) {
          sent++;
        }

        for (const failure of result.failed) {
          failed++;
          const status = failure.status;
          const reason = failure.response?.reason;
          console.error(`[PUSH] APNs failure — status: ${status}, reason: ${reason}, device: ${failure.device?.slice(0, 8)}...`);

          if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
            staleTokens.push(token);
          }
        }
      } catch (error) {
        console.error(`[PUSH] Error sending to token ${token.slice(0, 8)}...:`, error);
        failed++;
      }
    }

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await client
        .from('device_tokens')
        .delete()
        .eq('user_id', userId)
        .in('token', staleTokens);

      console.log(`[PUSH] Removed ${staleTokens.length} stale token(s) for user ${userId}`);
    }

    return { sent, failed };
  }

  shutdown(): void {
    if (this.provider) {
      this.provider.shutdown();
      this.provider = null;
      this.initialized = false;
      console.log('[PUSH] APNs provider shut down');
    }
  }
}

const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
