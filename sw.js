// 🔥 每次你修改了 index.html 或圖片，請務必把這裡的 v1 改成 v2, v3...
const CACHE_NAME = 'mahjong-brain-v1.2.7'; 

const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png'
    // 如果你有其他圖檔路徑，也可以加在這裡，例如 './tiles/w1.svg'
];

// 1. 安裝階段：下載並快取檔案，然後「強制立刻接管」
self.addEventListener('install', event => {
    self.skipWaiting(); // 核心魔法：不要等舊版關閉，立刻強行安裝新版！
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// 2. 啟動階段：清除舊版本的快取，釋放手機空間
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // 如果快取名稱跟現在的版本號不一樣，就把它刪掉！
                    if (cacheName !== CACHE_NAME) {
                        console.log('刪除舊快取:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // 立刻控制所有已經打開的網頁
});

// 3. 攔截請求階段：採用「網路優先，退而求其次用快取」策略 (Network First)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});