// sw.js - Service Worker for Web Push Notifications

self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activated');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
    console.log('[Service Worker] Nhận được Push Event', event);

    if (event.data) {
        let data = {};
        try {
            data = event.data.json();
        } catch (e) {
            data = {
                title: 'Hệ thống thông báo',
                body: event.data.text()
            };
        }

        const options = {
            body: data.body || 'Bạn có thông báo mới',
            icon: '/icon-v2.png',
            data: data.url || '/',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            requireInteraction: true
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'TeraX', options)
        );
    }
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] User đã click vào thông báo', event);
    event.notification.close();

    let targetUrl = event.notification.data ? event.notification.data : '/';
    
    // Đảm bảo targetUrl dùng Hash Routing (vd: /#request/123 thay vì /request/123)
    if (targetUrl && !targetUrl.startsWith('/') && !targetUrl.startsWith('#') && !targetUrl.startsWith('http')) {
        targetUrl = '/#' + targetUrl;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
            // Nếu đã có tab CRC mở sẵn, chuyển hướng nó tới hash mới và focus
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url && 'focus' in client) {
                    client.navigate(new URL(targetUrl, self.location.origin).href);
                    return client.focus();
                }
            }
            // Nếu chưa mở, mở tab mới
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

self.addEventListener('pushsubscriptionchange', function(event) {
    console.log('[Service Worker] Token hết hạn, đang tự động làm mới...');

    event.waitUntil(
        self.registration.pushManager.subscribe(event.oldSubscription.options)
            .then(function(newSubscription) {
                // Gọi API backend để update lại token
                return fetch('/api/notifications/update-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
                        newSubscription: newSubscription
                    })
                });
            })
    );
});
