// 🔥 黃金法則：每次發布新版本，一定要手動修改這裡的版號！(例如下一次改為 v2.8.5)
const APP_VERSION = "v2.8.40";
const CACHE_NAME = 'mahjong-cache-' + APP_VERSION;

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js'
];

// 1. 安裝階段：強制打破 HTTP 殭屍快取
self.addEventListener('install', (e) => {
    console.log('[SW] 安裝新版本:', CACHE_NAME);
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 🌟 核心修復：在網址後面加上隨機時間戳，強迫伺服器給我們「最新」的檔案
            return Promise.all(
                urlsToCache.map((url) => {
                    const request = new Request(`${url}?_bust=${Date.now()}`, { cache: 'no-store' });
                    return fetch(request).then((response) => {
                        if (!response.ok) throw new Error(`Network error for ${url}`);
                        // 抓到最新檔案後，把它存回原本乾淨的 URL 鍵值中 (例如 './app.js')
                        return cache.put(url, response);
                    });
                })
            );
        })
    );
});

// 2. 啟動階段：刪除舊快取並「強制接管」
self.addEventListener('activate', (e) => {
    console.log('[SW] 啟動新版，清理舊快取');
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] 刪除舊快取:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // 🌟 核心修復 2：強制新的 SW 立刻接管所有開啟的網頁
            return self.clients.claim();
        })
    );
});

// 3. 攔截請求：維持 Cache First 策略
self.addEventListener('fetch', (e) => {
    // 防呆機制：如果是帶有時間戳的安裝請求，直接放行不攔截
    if (e.request.url.includes('?_bust=')) return;

    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

// 4. 接收來自 app.js 動態島的更新指令
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        console.log('[SW] 收到 SKIP_WAITING，立刻強制接班！');
        self.skipWaiting();
    }
});