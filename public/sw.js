// Service Worker for Travel Pack Notifications
const CACHE_NAME = 'travel-pack-v1'

self.addEventListener('install', (event) => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

// 브라우저 Push 메시지 수신 처리
self.addEventListener('push', (event) => {
    if (!event.data) return

    const data = event.data.json()

    const options = {
        body: data.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: data.tag || 'travel-pack',
        data: data.url ? { url: data.url } : {},
        requireInteraction: true,
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Travel Pack 알림', options)
    )
})

// 알림 클릭 시 처리
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const targetUrl = event.notification.data?.url || '/'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existingClient = clients.find(c => c.url.includes(targetUrl))
            if (existingClient) {
                return existingClient.focus()
            }
            return self.clients.openWindow(targetUrl)
        })
    )
})
