const router = require('./notification.controller');
const notificationService = require('./notification.service');
const notificationRepository = require('./notification.repository');
const { eventBus, EVENTS } = require('../../core/events');

// Subscribe to system events asynchronously (Modular Monolith pattern)
eventBus.on(EVENTS.ACTION_EXECUTED, (payload) => {
  notificationService.handleActionExecuted(payload).catch(err => {
    console.error('[NotificationModule] Error handling ACTION_EXECUTED:', err);
  });
});

eventBus.on(EVENTS.NOTIFICATION_SEND, (payload) => {
  const { userId, title, body, link } = payload;
  notificationService.createNotification(userId, title, body, link).catch(err => {
    console.error('[NotificationModule] Error handling NOTIFICATION_SEND:', err);
  });
});

module.exports = {
  router,
  notificationService,
  notificationRepository
};
