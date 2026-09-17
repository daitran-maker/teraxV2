const express = require('express');
const router = express.Router();
const repo = require('./notification.repository');
const service = require('./notification.service');

// Initialize schema on load
repo.ensureSchema().catch(err => {
  console.error('[NotificationController] Schema ensure error:', err.message);
});

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const filter = req.query.filter || null;

    const [items, unreadCount] = await Promise.all([
      repo.getByUser(userId, limit, offset, filter),
      repo.getUnreadCount(userId)
    ]);

    res.json({
      notifications: items,
      unread_count: unreadCount,
      total: items.length
    });
  } catch (err) {
    console.error('[NotificationController] GET / error:', err);
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
    res.json({ success: true, notification: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updatedCount = await repo.markAllAsRead(userId);
    res.json({ success: true, count: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/pin
router.put('/:id/pin', async (req, res) => {
  try {
    const userId = req.user?.employee_id || req.user?.email;
    const updated = await repo.togglePin(req.params.id, userId);
    res.json({ success: true, notification: updated });
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
    res.json({ success: true, notification: updated });
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
    const subscription = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await repo.savePushSubscription(userId, subscription);
    res.json({ success: true });
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
    res.json({ success: true });
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
