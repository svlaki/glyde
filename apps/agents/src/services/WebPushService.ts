import webpush from 'web-push';
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

class WebPushService {
  private initialized = false;

  initialize(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contactEmail = process.env.VAPID_CONTACT_EMAIL || 'mailto:support@glyde.app';

    if (!publicKey || !privateKey) {
      console.warn('[WEB-PUSH] VAPID keys not configured — web push notifications disabled');
      return;
    }

    try {
      webpush.setVapidDetails(contactEmail, publicKey, privateKey);
      this.initialized = true;
      console.log('[WEB-PUSH] VAPID details configured');
    } catch (error) {
      console.error('[WEB-PUSH] Failed to set VAPID details:', error);
    }
  }

  async sendToUser(userId: string, notification: PushPayload): Promise<SendResult> {
    if (!this.initialized) {
      return { sent: 0, failed: 0 };
    }

    const client = getSupabaseService().getClient();
    const { data: tokens, error } = await client
      .from('device_tokens')
      .select('id, token')
      .eq('user_id', userId)
      .eq('platform', 'web');

    if (error || !tokens || tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    });

    let sent = 0;
    let failed = 0;
    const staleTokenIds: string[] = [];

    for (const { id, token } of tokens) {
      try {
        const subscription = JSON.parse(token);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (error: any) {
        failed++;
        const statusCode = error?.statusCode;
        console.error(`[WEB-PUSH] Failed to send — status: ${statusCode}, id: ${id}`);

        // 410 Gone or 404 Not Found means subscription is no longer valid
        if (statusCode === 410 || statusCode === 404) {
          staleTokenIds.push(id);
        }
      }
    }

    if (staleTokenIds.length > 0) {
      await client
        .from('device_tokens')
        .delete()
        .in('id', staleTokenIds);

      console.log(`[WEB-PUSH] Removed ${staleTokenIds.length} stale subscription(s) for user ${userId}`);
    }

    if (sent > 0 || failed > 0) {
      console.log(`[WEB-PUSH] User ${userId}: sent=${sent}, failed=${failed}`);
    }

    return { sent, failed };
  }
}

const webPushService = new WebPushService();
export default webPushService;
