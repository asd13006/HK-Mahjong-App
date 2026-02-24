// 🌟 唯一真相來源：未來不管加什麼新功能，你永遠只需要修改這一行的版本號！
const APP_VERSION = "v2.7.0 (Single Source Hack)";

const CACHE_NAME = 'mahjong-cache-' + APP_VERSION;
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