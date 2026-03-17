/* ==========================================
   🛠️ 工具函式 (utils.js)
   ========================================== */

// 防止 XSS：將使用者輸入轉義後才插入 DOM
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 防抖函式：避免高頻率重複呼叫
export function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// 安全讀取 localStorage（防止 JSON 損壞或配額超限）
export function safeGetHistory() {
    try {
        const raw = localStorage.getItem('mahjongHistory');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(r =>
            r && typeof r.faan === 'number' &&
            typeof r.isWin === 'boolean' &&
            typeof r.timestamp === 'number'
        );
    } catch {
        return [];
    }
}

export function safeSaveHistory(history) {
    try {
        localStorage.setItem('mahjongHistory', JSON.stringify(history));
    } catch {
        // 配額超限時靜默失敗，不影響應用運作
    }
}

/* ------------------------------------------
   👆 FastClick 處理器（含清理機制）
   ------------------------------------------ */

export function attachFastClick(el, action, tapClass = '') {
    if (el._hasFastClick) {
        el._action = action;
        return;
    }
    el._action = action;
    el._hasFastClick = true;

    // 使用 AbortController 以便日後統一移除所有事件
    const ac = new AbortController();
    el._fastClickAC = ac;
    const opts = { signal: ac.signal };
    const passiveOpts = { passive: true, signal: ac.signal };

    let touchHandled = false;
    let isScrolling = false;
    let startX = 0;
    let startY = 0;
    el.addEventListener(
        'touchstart',
        (e) => {
            touchHandled = true;
            isScrolling = false;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            if (tapClass) el.classList.add(tapClass);
        },
        passiveOpts,
    );
    el.addEventListener(
        'touchmove',
        (e) => {
            if (!touchHandled) return;
            let moveX = Math.abs(e.touches[0].clientX - startX);
            let moveY = Math.abs(e.touches[0].clientY - startY);
            if (moveX > 10 || moveY > 10) {
                isScrolling = true;
                if (tapClass) el.classList.remove(tapClass);
            }
        },
        passiveOpts,
    );
    el.addEventListener('touchend', (e) => {
        if (tapClass) el.classList.remove(tapClass);
        if (touchHandled && !isScrolling) {
            if (el._action) el._action(e);
        }
        setTimeout(() => {
            touchHandled = false;
        }, 400);
    }, opts);
    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (!touchHandled) {
            if (tapClass) {
                el.classList.add(tapClass);
                setTimeout(() => el.classList.remove(tapClass), 100);
            }
            if (el._action) el._action(e);
        }
    }, opts);
    el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, opts);
}

// 清除元素上的 FastClick 事件監聽器，防止記憶體洩漏
export function detachFastClick(el) {
    if (el._fastClickAC) {
        el._fastClickAC.abort();
        delete el._fastClickAC;
        delete el._action;
        delete el._hasFastClick;
    }
}
