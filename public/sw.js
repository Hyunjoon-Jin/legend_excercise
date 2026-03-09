// Install - 즉시 활성화
self.addEventListener('install', function (event) {
    self.skipWaiting();
});

// Activate - 모든 클라이언트를 즉시 제어
self.addEventListener('activate', function (event) {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body || '',
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            vibrate: [100, 50, 100],
            tag: data.tag || 'legend-notification',
            renotify: true,
            requireInteraction: false,
            data: {
                url: data.url || '/',
                dateOfArrival: Date.now(),
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'Legend 알림', options)
        );
    } catch (e) {
        // JSON 파싱 실패 시 텍스트로 폴백
        const text = event.data.text();
        event.waitUntil(
            self.registration.showNotification('Legend 알림', {
                body: text,
                icon: '/icon-192x192.png',
            })
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // 이미 열린 탭이 있으면 포커스
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // 없으면 새 탭 열기
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
