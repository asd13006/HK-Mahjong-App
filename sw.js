// 每次你修改了 app.js 或 style.css 後，只要把這裡的 v2.6.0 改成 v2.6.1，
// 用戶的手機就會自動觸發「動態島」更新提示！
const CACHE_NAME = 'mahjong-cache-v2.6.2';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

// 接收來自 app.js 的指令：瞬間切換到新版本
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});