const webpush = require('web-push');
const repo = require('./notification.repository');
const { broadcastSSE } = require('../../../server/helpers/sseHelper');

const PUBLIC_VAPID_KEY = process.env.PUBLIC_VAPID_KEY || 'BB9c2sN9HL17iyM6UtISHRN-NEDR9v490BoaOkzWdOq8GOs08c-hDgMQvc0xORsps2mS9GoHIbyqzgdh7898_PI';
const PRIVATE_VAPID_KEY = process.env.PRIVATE_VAPID_KEY || 'K6kBBA6lRLAF0OD2ItuQtKwh-UIM_U3RPrzThM4fgfU';

try {
  webpush.setVapidDetails('mailto:admin@example.com', PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
} catch (e) {
  console.warn('[NotificationService] VAPID configuration error:', e.message);
}

class NotificationService {
  getVapidPublicKey() {
    return PUBLIC_VAPID_KEY;
  }

  async sendPushNotification(userEmail, title, body, url = '/') {
    try {
      const subscriptions = await repo.getPushSubscriptions(userEmail);
      if (!subscriptions || subscriptions.length === 0) return;

      const payload = JSON.stringify({ title, body, url });
      const promises = subscriptions.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        };
        try {
          await webpush.sendNotification(pushSub, payload);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await repo.removePushSubscription(sub.endpoint);
          }
        }
      });
      await Promise.allSettled(promises);
    } catch (err) {
      console.error('[NotificationService] sendPushNotification error:', err);
    }
  }

  async createNotification(userId, title, body, link = '/') {
    if (!userId) return null;
    try {
      const created = await repo.create(userId, title, body, link);
      
      // SSE broadcast for live badge
      broadcastSSE('notification', {
        type: 'new_notification',
        userId,
        notification: created
      });

      // Send Web Push notification
      this.sendPushNotification(userId, title, body, link).catch(() => {});

      return created;
    } catch (err) {
      console.error(`[NotificationService] Error creating notification for ${userId}:`, err);
      return null;
    }
  }

  async notifyUsers(userIds, title, body, link = '/') {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const uniqueUsers = [...new Set(userIds.filter(Boolean))];
    const results = await Promise.allSettled(
      uniqueUsers.map(uid => this.createNotification(uid, title, body, link))
    );
    return results;
  }

  /**
   * Event handler: Triggered asynchronously when an action is executed
   */
  async handleActionExecuted(payload) {
    const { actionId, tableName, recordId, user, record, nextRecord } = payload;
    try {
      const { triggerNotifications } = require('../../../server/helpers/notificationHelper');
      if (typeof triggerNotifications === 'function') {
        await triggerNotifications(tableName, record, nextRecord, 'update');
      }
    } catch (err) {
      console.error('[NotificationService] handleActionExecuted error:', err);
    }
  }
}

module.exports = new NotificationService();
