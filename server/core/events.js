const EventEmitter = require('events');

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this.on('error', (err) => {
      console.error('[EventBus Error]:', err);
    });
  }

  /**
   * Emit an event safely without throwing synchronous listener errors to caller
   * @param {string} eventName 
   * @param {any} payload 
   */
  safeEmit(eventName, payload) {
    try {
      return this.emit(eventName, payload);
    } catch (err) {
      console.error(`[EventBus] Error emitting ${eventName}:`, err);
      return false;
    }
  }
}

const eventBus = new AppEventBus();

const EVENTS = {
  ACTION_EXECUTED: 'action.executed',
  REQUEST_STATUS_CHANGED: 'request.status_changed',
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_CREATED: 'notification.created',
  CMS_SYNC_TRIGGER: 'cms.sync.trigger'
};

module.exports = {
  eventBus,
  EVENTS
};
