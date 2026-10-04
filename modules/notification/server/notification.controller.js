const express = require('express');
const router = express.Router();
const repo = require('./notification.repository');
const service = require('./notification.service');

// Initialize schema on load
repo.ensureSchema().catch(err => {
  console.error('[NotificationController] Schema ensure error:', err.message);
});

// GET /api/notifications
// Fetch paginated notifications for current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset, 10) : (page - 1) * limit;
    const filter = req.query.filter || null;

    const [items, unreadCount, totalCount] = await Promise.all([
      repo.getByUser(userId, limit, offset, filter),
      repo.getUnreadCount(userId),
      repo.getTotalCount(userId, filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.json({
      data: items,
      notifications: items,
      total: totalCount,
      page,
      limit,
      totalPages,
      unread_count: unreadCount,
      unreadCount
    });
  } catch (err) {
    console.error('[NotificationController] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count
// Returns count of unread notifications for badge
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const unreadCount = await repo.getUnreadCount(userId);
    res.json({ count: unreadCount, unread_count: unreadCount });
  } catch (err) {
    console.error('[NotificationController] GET /unread-count error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/tasks
// Fetch flagged notifications for Dashboard Task Pending
router.get('/tasks', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tasks = await repo.getTasks(userId);
    res.json(tasks);
  } catch (err) {
    console.error('[NotificationController] GET /tasks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: service.getVapidPublicKey() });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updated = await repo.markAsRead(req.params.id, userId);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: updated, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all & PUT /api/notifications/mark-all-read
const handleMarkAllRead = async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updatedCount = await repo.markAllAsRead(userId);
    res.json({ success: true, count: updatedCount, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
router.put('/read-all', handleMarkAllRead);
router.put('/mark-all-read', handleMarkAllRead);

// PUT /api/notifications/:id/pin
router.put('/:id/pin', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updated = await repo.togglePin(req.params.id, userId);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: updated, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/flag
router.put('/:id/flag', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const note = req.body?.note || '';
    const updated = await repo.toggleFlag(req.params.id, userId, note);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: updated, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/complete-task
router.put('/:id/complete-task', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updated = await repo.completeTask(req.params.id, userId);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, notification: updated, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/watches
router.get('/watches', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const watches = await repo.getWatches(userId);
    res.json(watches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/watch
router.post('/watch', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
    await repo.watchRequest(userId, requestId);
    res.json({ message: 'Now watching request', requestId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/unwatch
router.put('/unwatch', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Missing requestId' });
    await repo.unwatchRequest(userId, requestId);
    res.json({ message: 'Unfollowed request', requestId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const deleted = await repo.softDelete(req.params.id, userId);
    res.json({ success: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const subscription = req.body?.subscription || req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await repo.savePushSubscription(userId, subscription);
    res.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/update-subscription
router.post('/update-subscription', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const { oldEndpoint, newSubscription } = req.body;
    const subscription = newSubscription?.subscription || newSubscription;
    if (oldEndpoint) {
      await repo.removePushSubscription(oldEndpoint);
    }
    if (userId && subscription && subscription.endpoint && subscription.keys) {
      await repo.savePushSubscription(userId, subscription);
    }
    res.json({ success: true, message: 'Subscription updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await repo.removePushSubscription(endpoint);
    }
    res.json({ success: true, message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/send-test
router.post('/send-test', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const { title = 'Thông báo thử nghiệm', body = 'Hệ thống thông báo TeraX v2 hoạt động tốt!', url = '/' } = req.body;
    await service.createNotification(userId, title, body, url);
    res.json({ success: true, message: 'Đã gửi thông báo thử nghiệm.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
