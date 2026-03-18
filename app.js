/* ==========================================
   🧠 香港麻雀計番神器 - 核心運作大腦 (app.js)
   ========================================== */

; (function () {
    'use strict';

    /* ------------------------------------------
       📦 全域狀態（封裝於 IIFE 內）
       ------------------------------------------ */

    const APP_VERSION = 'v2.9.3'; // 更新版號以重置快取
    let currentResultSnapshot = null;
    let isClearing = false;

    /* ------------------------------------------
       🛠️ 工具函式
       ------------------------------------------ */

    // 防止 XSS：將使用者輸入轉義後才插入 DOM
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // 防抖函式：避免高頻率重複呼叫
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // 安全讀取 localStorage（防止 JSON 損壞或配額超限）
    function safeGetHistory() {
        try {
            const raw = localStorage.getItem('mahjongHistory');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            // 驗證每筆紀錄的必要欄位
            return parsed.filter(r =>
                r && typeof r.faan === 'number' &&
                typeof r.isWin === 'boolean' &&
                typeof r.timestamp === 'number'
            );
        } catch {
            return [];
        }
    }

    function safeSaveHistory(history) {
        try {
            localStorage.setItem('mahjongHistory', JSON.stringify(history));
        } catch {
            // 配額超限時靜默失敗，不影響應用運作
        }
    }

    /* ------------------------------------------
       👆 FastClick 處理器（含清理機制）
       ------------------------------------------ */

    function attachFastClick(el, action, tapClass = '') {
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
    function detachFastClick(el) {
        if (el._fastClickAC) {
            el._fastClickAC.abort();
            delete el._fastClickAC;
            delete el._action;
            delete el._hasFastClick;
        }
    }

    /* ------------------------------------------
       🎬 動畫與頁面切換
       ------------------------------------------ */

    function smoothHeightUpdate(elementId, updateDOM) {
        const el = document.getElementById(elementId);
        if (!el) {
            updateDOM();
            return;
        }
        const oldHeight = el.offsetHeight;
        updateDOM();
        el.style.height = 'auto';
        const newHeight = el.offsetHeight;
        if (oldHeight !== newHeight && oldHeight > 0) {
            el.style.height = oldHeight + 'px';
            const oldOverflow = el.style.overflow;
            el.style.overflow = 'hidden';
            el.style.willChange = 'height';
            el.offsetHeight;
            el.style.transition = 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.height = newHeight + 'px';
            setTimeout(() => {
                el.style.height = 'auto';
                el.style.transition = '';
                el.style.overflow = oldOverflow;
                el.style.willChange = 'auto';
            }, 300);
        }
    }

    function animatePageBlocks(pageEl) {
        const children = pageEl.children;
        for (let i = 0; i < children.length; i++) {
            children[i].classList.remove('page-block-enter');
            children[i].style.animationDelay = '';
        }
        void pageEl.offsetHeight;
        for (let i = 0; i < children.length; i++) {
            children[i].style.animationDelay = `${i * 0.12}s`;
            children[i].classList.add('page-block-enter');
        }
    }

    function switchPage(targetId) {
        document.querySelectorAll('.nav-item').forEach((nav) => {
            nav.classList.remove('active');
            nav.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
        const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
        if (targetNav) {
            targetNav.classList.add('active');
            targetNav.setAttribute('aria-selected', 'true');
        }
        const pageEl = document.getElementById(targetId);
        pageEl.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        animatePageBlocks(pageEl);
        if (targetId === 'page-profile') updateProfileData();
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach((item) => {
            attachFastClick(
                item,
                () => {
                    if (item.classList.contains('active')) return;
                    if (navigator.vibrate) navigator.vibrate([10]);
                    switchPage(item.getAttribute('data-target'));
                },
                'is-tapped-chip',
            );
        });
    }

    /* ------------------------------------------
       🀄 牌型定義與條件常數
       ------------------------------------------ */

    const TILE_DEFS = [
        { type: 'w', label: '萬', count: 9, startId: 0 },
        { type: 't', label: '筒', count: 9, startId: 9 },
        { type: 's', label: '索', count: 9, startId: 18 },
        { type: 'z', names: ['東', '南', '西', '北', '中', '發', '白'], startId: 27 },
    ];
    const CONDITIONS = [
        { id: 'selfDrawn', label: '自摸 (1番)', faan: 1 },
        { id: 'concealed', label: '門前清 (1番)', faan: 1 },
        { id: 'lastTile', label: '海底撈月 (1番)', faan: 1 },
        { id: 'kongSelfDrawn', label: '槓上自摸 (2番)', faan: 2 },
        { id: 'doubleKongSelfDrawn', label: '槓上槓自摸 (8番)', faan: 8 },
        { id: 'robKong', label: '搶槓 (1番)', faan: 1 },
        { id: 'heaven', label: '天糊 (13番)' },
        { id: 'earth', label: '地糊 (13番)' },
    ];
    const FLOWERS = [
        { id: 's1', name: '春', group: 'season', wind: 0 },
        { id: 's2', name: '夏', group: 'season', wind: 1 },
        { id: 's3', name: '秋', group: 'season', wind: 2 },
        { id: 's4', name: '冬', group: 'season', wind: 3 },
        { id: 'p1', name: '梅', group: 'plant', wind: 0 },
        { id: 'p2', name: '蘭', group: 'plant', wind: 1 },
        { id: 'p3', name: '菊', group: 'plant', wind: 2 },
        { id: 'p4', name: '竹', group: 'plant', wind: 3 },
    ];

    // 牠牌 ID 常數（避免魔術數字）
    const SUIT_SIZE = 9;        // 每種花色的牠數
    const WIND_START = 27;      // 風牠起始 ID（東=27, 南=28, 西=29, 北=30）
    const DRAGON_START = 31;    // 三元牠起始 ID（中=31, 發=32, 白=33）
    const TOTAL_TILE_TYPES = 34;
    const WIND_IDS = [27, 28, 29, 30];
    const DRAGON_IDS = [31, 32, 33];
    const ORPHAN_IDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

    /* ------------------------------------------
       💾 應用狀態
       ------------------------------------------ */

    let hand = [];
    let activeConditions = new Set();
    let roundWind = 0;
    let seatWind = 0;
    let activeFlowers = new Set();
    let tileKeyCounter = 0;
    let lastMax = 14;
    let wikiScrollPos = 0;
    let wikiDetailTransitioning = false;

    function init() {
        renderConditions();
        renderFlowers();
        renderKeyboard();
        renderHand();
        document.getElementById('appVersionProfile').innerText = APP_VERSION;

        // 恢復最原始的動態島點擊事件
        attachFastClick(
            document.getElementById('islandHeaderBtn'),
            () => {
                const island = document.getElementById('conditionsIsland');
                island.classList.toggle('expanded');
                const isExpanded = island.classList.contains('expanded');
                document.getElementById('islandHeaderBtn').setAttribute('aria-expanded', String(isExpanded));
                if (navigator.vibrate) navigator.vibrate([5]);
            },
            'is-tapped-island',
        );

        document
            .querySelectorAll('#roundWindSelector .wind-tab')
            .forEach((tab, i) => attachFastClick(tab, () => setRoundWind(i), 'is-tapped-chip'));
        document
            .querySelectorAll('#seatWindSelector .wind-tab')
            .forEach((tab, i) => attachFastClick(tab, () => setSeatWind(i), 'is-tapped-chip'));
        attachFastClick(document.getElementById('clearBtnId'), clearHand, 'is-tapped-chip');
        attachFastClick(
            document.getElementById('calcBtn'),
            () => {
                if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
                switchPage('page-result');
                runEngine();
            },
            'is-tapped-chip',
        );
        attachFastClick(
            document.getElementById('backToInputBtn'),
            () => {
                if (navigator.vibrate) navigator.vibrate([10]);
                switchPage('page-input');
                resetResultCard();
            },
            'is-tapped-chip',
        );
        attachFastClick(
            document.getElementById('clearHistoryBtn'),
            () => {
                if (confirm('⚠️ 確定要清空所有生涯戰績嗎？這個動作無法復原喔！')) {
                    try { localStorage.removeItem('mahjongHistory'); } catch { }
                    renderHistory();
                    updateProfileData();
                }
            },
            'is-tapped-chip',
        );
        attachFastClick(
            document.getElementById('btnSystemClear'),
            () => {
                if (confirm('⚠️ 確定要清除系統暫存嗎？這會重置介面，但不會刪除戰績。')) {
                    window.location.reload(true);
                }
            },
            'is-tapped-chip',
        );

        attachFastClick(
            document.getElementById('btnBackToWiki'),
            () => {
                if (navigator.vibrate) navigator.vibrate([10]);
                document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
                document.getElementById('page-wiki').classList.add('active');
                wikiDetailTransitioning = true;
                setTimeout(() => { wikiDetailTransitioning = false; }, 500);
                window.scrollTo({ top: wikiScrollPos, behavior: 'instant' });
            },
            'is-tapped-chip',
        );

        const searchInput = document.getElementById('wikiSearch');
        if (searchInput) {
            const debouncedSearch = debounce((value) => {
                const activeFilter = document.querySelector('.w-filter.active').getAttribute('data-filter');
                populateWiki(activeFilter, value);
            }, 200);
            searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
        }

        updateIslandSummary();
        setupNavigation();
        setupWikiFilters();
        renderHistory();
        populateWiki();
        populateDailyFeatured();
    }

    /* ------------------------------------------
       🔀 條件互斥規則（集中管理）
       ------------------------------------------ */

    // 條件衝突對應表：每個條件被啟用時，需要排除的其他條件
    const CONDITION_CONFLICTS = {
        heaven: { clearAll: true },
        earth: { clearAll: true },
        selfDrawn: { remove: ['robKong'] },
        robKong: { remove: ['selfDrawn', 'kongSelfDrawn', 'doubleKongSelfDrawn', 'lastTile'] },
        kongSelfDrawn: { require: ['selfDrawn'], remove: ['robKong', 'lastTile', 'doubleKongSelfDrawn'] },
        doubleKongSelfDrawn: { require: ['selfDrawn'], remove: ['robKong', 'lastTile', 'kongSelfDrawn'] },
        lastTile: { remove: ['kongSelfDrawn', 'doubleKongSelfDrawn', 'robKong'] },
    };

    // 取消條件時的連帶清除規則
    const CONDITION_DEACTIVATE = {
        selfDrawn: ['kongSelfDrawn', 'doubleKongSelfDrawn'],
    };

    function resolveConditionConflicts(condId) {
        if (activeConditions.has(condId)) {
            // 取消條件
            activeConditions.delete(condId);
            const deactivateList = CONDITION_DEACTIVATE[condId];
            if (deactivateList) deactivateList.forEach((id) => activeConditions.delete(id));
        } else {
            // 啟用條件
            const rule = CONDITION_CONFLICTS[condId];
            if (rule && rule.clearAll) {
                activeConditions.clear();
                activeConditions.add(condId);
                return;
            }
            activeConditions.add(condId);
            // 非天糊/地糊時，排除天糊與地糊
            activeConditions.delete('heaven');
            activeConditions.delete('earth');
            if (rule) {
                if (rule.require) rule.require.forEach((id) => activeConditions.add(id));
                if (rule.remove) rule.remove.forEach((id) => activeConditions.delete(id));
            }
        }
    }

    /* ------------------------------------------
       🎛️ 介面渲染：條件 / 花牌 / 鍵盤
       ------------------------------------------ */

    function renderConditions() {
        const bar = document.getElementById('conditionsBar');
        if (bar.children.length === 0) {
            CONDITIONS.forEach((cond) => {
                const chip = document.createElement('div');
                chip.className = 'condition-chip';
                chip.id = `cond-${cond.id}`;
                chip.innerText = cond.label.split(' ')[0];
                attachFastClick(
                    chip,
                    () => {
                        resolveConditionConflicts(cond.id);
                        updateIslandSummary();
                        if (navigator.vibrate) navigator.vibrate([10]);
                        checkAndRunEngine();
                    },
                    'is-tapped-chip',
                );
                bar.appendChild(chip);
            });
        }
    }
    function updateIslandSummary() {
        let activeLabels = [];
        CONDITIONS.forEach((cond) => {
            const chip = document.getElementById(`cond-${cond.id}`);
            if (chip) {
                if (activeConditions.has(cond.id)) {
                    chip.classList.add('active');
                    activeLabels.push(cond.label.split(' ')[0]);
                } else {
                    chip.classList.remove('active');
                }
            }
        });
        const windNames = ['東', '南', '西', '北'];
        activeLabels.push(`${windNames[roundWind]}圈${windNames[seatWind]}位`);
        if (activeFlowers.size > 0) activeLabels.push(`${activeFlowers.size}花`);
        const title = document.getElementById('islandTitle');
        const iconHtml = '<i class="ic">tune</i> ';
        const newLabel = activeLabels.length === 0 ? '牌局設定' : activeLabels.join(', ');
        const isActive = activeLabels.length > 0;
        if (title.dataset.label !== newLabel && title.dataset.label !== undefined) {
            title.classList.add('slide-out');
            setTimeout(() => {
                title.dataset.label = newLabel;
                title.innerHTML = iconHtml + newLabel;
                title.classList.toggle('island-title-active', isActive);
                title.classList.remove('slide-out');
                title.classList.add('slide-in');
                void title.offsetWidth;
                title.classList.remove('slide-in');
            }, 200);
        } else {
            title.dataset.label = newLabel;
            title.innerHTML = iconHtml + newLabel;
            title.classList.toggle('island-title-active', isActive);
        }
    }
    function setRoundWind(index) {
        roundWind = index;
        const container = document.getElementById('roundWindSelector');
        container
            .querySelectorAll('.wind-tab')
            .forEach((tab, i) => (tab.className = `wind-tab ${i === index ? 'active' : ''}`));
        const glider = container.querySelector('.glass-glider');
        if (glider) glider.style.transform = `translateX(${index * 100}%)`;
        updateIslandSummary();
        if (navigator.vibrate) navigator.vibrate([10]);
        checkAndRunEngine();
    }
    function setSeatWind(index) {
        seatWind = index;
        const container = document.getElementById('seatWindSelector');
        container
            .querySelectorAll('.wind-tab')
            .forEach((tab, i) => (tab.className = `wind-tab ${i === index ? 'active' : ''}`));
        const glider = container.querySelector('.glass-glider');
        if (glider) glider.style.transform = `translateX(${index * 100}%)`;
        updateIslandSummary();
        if (navigator.vibrate) navigator.vibrate([10]);
        checkAndRunEngine();
    }
    function renderFlowers() {
        const grid = document.getElementById('flowerGrid');
        if (grid.children.length === 0) {
            FLOWERS.forEach((f, index) => {
                const btn = document.createElement('div');
                btn.className = 'flower-tile';
                btn.id = `flower-${f.id}`;
                if (activeFlowers.has(f.id)) btn.classList.add('active');
                btn.style.backgroundImage = `url('tiles/f${index + 1}.svg')`;
                attachFastClick(btn, () => {
                    if (activeFlowers.has(f.id)) activeFlowers.delete(f.id);
                    else activeFlowers.add(f.id);
                    btn.classList.toggle('active');
                    document.getElementById('flowerCount').innerText = `已選 ${activeFlowers.size} 隻`;
                    updateIslandSummary();
                    if (navigator.vibrate) navigator.vibrate([10]);
                    checkAndRunEngine();
                });
                grid.appendChild(btn);
            });
        }
    }

    // ✨ 這裡保留了鍵盤防呆功能
    function renderKeyboard() {
        const kb = document.getElementById('keyboard');
        if (kb.children.length > 0) return;
        TILE_DEFS.forEach((def) => {
            const row = document.createElement('div');
            row.className = 'suit-row';
            const limit = def.names ? def.names.length : def.count;
            for (let i = 0; i < limit; i++) {
                const id = def.startId + i;
                const btn = document.createElement('div');
                btn.className = `tile ${def.type}`;
                btn.dataset.id = id; // 綁定 ID
                btn.style.backgroundImage = `url('tiles/${def.type}${i + 1}.svg')`;
                attachFastClick(btn, () => addTile(id), 'is-tapped-tile');
                row.appendChild(btn);
            }
            kb.appendChild(row);
        });
    }

    // ✨ 這裡保留了鍵盤防呆功能
    function updateKeyboardState() {
        let counts = new Array(TOTAL_TILE_TYPES).fill(0);
        hand.forEach((item) => counts[item.id]++);
        document.querySelectorAll('#keyboard .tile').forEach((btn) => {
            let id = parseInt(btn.dataset.id);
            if (counts[id] >= 4) btn.classList.add('disabled-tile');
            else btn.classList.remove('disabled-tile');
        });
    }

    /* ------------------------------------------
       🧮 計番引擎核心
       ------------------------------------------ */

    function getTileInfo(id) {
        if (id < SUIT_SIZE) return { type: 'w', num: id + 1, suit: '萬' };
        if (id < SUIT_SIZE * 2) return { type: 't', num: id - SUIT_SIZE + 1, suit: '筒' };
        if (id < WIND_START) return { type: 's', num: id - SUIT_SIZE * 2 + 1, suit: '索' };
        const zNames = ['東', '南', '西', '北', '中', '發', '白'];
        return { type: 'z', num: zNames[id - WIND_START], suit: '' };
    }
    function findAllMelds(counts, index, currentMelds, allValidMelds) {
        if (currentMelds.length === 4) {
            let isValid = true;
            for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
                if (counts[i] !== 0) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) allValidMelds.push([...currentMelds]);
            return;
        }
        while (index < TOTAL_TILE_TYPES && counts[index] === 0) index++;
        if (index === TOTAL_TILE_TYPES) return;
        if (counts[index] >= 4) {
            counts[index] -= 4;
            currentMelds.push({ type: 'kong', val: index });
            findAllMelds(counts, index, currentMelds, allValidMelds);
            currentMelds.pop();
            counts[index] += 4;
        }
        if (counts[index] >= 3) {
            counts[index] -= 3;
            currentMelds.push({ type: 'pong', val: index });
            findAllMelds(counts, index, currentMelds, allValidMelds);
            currentMelds.pop();
            counts[index] += 3;
        }
        if (index < WIND_START && index % SUIT_SIZE <= 6) {
            if (counts[index] > 0 && counts[index + 1] > 0 && counts[index + 2] > 0) {
                counts[index]--;
                counts[index + 1]--;
                counts[index + 2]--;
                currentMelds.push({ type: 'chow', start: index });
                findAllMelds(counts, index, currentMelds, allValidMelds);
                counts[index]++;
                counts[index + 1]++;
                counts[index + 2]++;
                currentMelds.pop();
            }
        }
    }
    function getCurrentMax() {
        let counts = new Array(TOTAL_TILE_TYPES).fill(0);
        hand.forEach((item) => counts[item.id]++);
        let kongs = 0;
        counts.forEach((c) => {
            if (c === 4) kongs++;
        });
        let max = 14 + kongs;
        if (hand.length >= 14) {
            let tempCounts = [...counts];
            if (checkWinCondition(tempCounts)) return hand.length;
        }
        return max;
    }
    function checkWinCondition(counts) {
        if (isThirteenOrphans(counts) || isNineGates(counts)) return true;
        if (activeConditions.has('heaven') || activeConditions.has('earth')) return true;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
            if (counts[i] >= 2) {
                let tempCounts = [...counts];
                tempCounts[i] -= 2;
                let allValidMelds = [];
                findAllMelds(tempCounts, 0, [], allValidMelds);
                if (allValidMelds.length > 0) return true;
            }
        }
        return false;
    }
    function resetResultCard() {
        document.getElementById('resultHeroCard').className = 'glass-card result-hero';
        document.getElementById('resultBadge').className = 'result-badge';
        document.getElementById('resultBadge').innerText = '等待中';
        document.body.className = '';
        document.getElementById('heroScoreValue').innerText = '--';
        document.getElementById('heroScoreValue').classList.remove('baau-pang-text');
        document.getElementById('heroScoreUnit').style.display = 'inline';
        document.getElementById('heroMainPatternName').innerText = '--';
        document.getElementById('heroMainPatternName').className = 'main-pattern-name text-success';
        document.getElementById('resRoundWind').innerText = '--';
        document.getElementById('resSeatWind').innerText = '--';
        document.getElementById('resFlowers').innerText = '--';
        document.getElementById('detailList').innerHTML = '<div class="detail-empty">尚未結算</div>';
        currentResultSnapshot = null;
    }
    function checkAndRunEngine() {
        let currentMax = getCurrentMax();
        const actionText = document.getElementById('actionText');
        const calcBtn = document.getElementById('calcBtn');
        if (activeFlowers.size >= 7 || hand.length === currentMax) {
            actionText.style.display = 'none';
            calcBtn.style.display = 'block';
        } else {
            actionText.style.display = 'block';
            calcBtn.style.display = 'none';
            actionText.innerText = `請選取 ${currentMax} 張牌`;
        }
    }
    /* ------------------------------------------
       ✅ 輸入驗證
       ------------------------------------------ */

    function validateTileId(id) {
        return Number.isInteger(id) && id >= 0 && id < TOTAL_TILE_TYPES;
    }

    function validateHand() {
        // 檢查每張牌不超過 4 張
        const counts = new Array(TOTAL_TILE_TYPES).fill(0);
        for (const item of hand) {
            if (!validateTileId(item.id)) return false;
            counts[item.id]++;
            if (counts[item.id] > 4) return false;
        }
        // 總牌數不超過最大值（14 + 槓）
        const kongs = counts.filter((c) => c === 4).length;
        if (hand.length > 14 + kongs) return false;
        return true;
    }

    /* ------------------------------------------
       🖐️ 手牌操作
       ------------------------------------------ */

    function addTile(id) {
        if (!validateTileId(id)) return;
        let count = hand.filter((t) => t.id === id).length;
        if (count >= 4) return;
        hand.push({ id: id, key: tileKeyCounter++ });
        let projectedMax = getCurrentMax();
        if (hand.length > projectedMax) {
            hand.pop();
            tileKeyCounter--;
            return;
        }
        hand.sort((a, b) => a.id - b.id);
        if (navigator.vibrate) navigator.vibrate([8]);
        renderHand();
    }
    function removeTile(index) {
        hand.splice(index, 1);
        if (navigator.vibrate) navigator.vibrate([8]);
        renderHand();
    }

    function renderHand() {
        const grid = document.getElementById('handGrid');
        let currentMax = getCurrentMax();
        const oldPos = {};
        grid.querySelectorAll('.tile[data-key]').forEach((el) => {
            oldPos[el.dataset.key] = el.getBoundingClientRect();
            el.classList.remove('breathing');
        });
        const updateGridDOM = () => {
            const existingTiles = new Map();
            grid.querySelectorAll('.tile[data-key]').forEach((el) => {
                existingTiles.set(el.dataset.key, el);
            });
            grid.querySelectorAll('.tile.empty').forEach((el) => el.remove());
            hand.forEach((item) => {
                let el = existingTiles.get(String(item.key));
                if (!el) {
                    const info = getTileInfo(item.id);
                    el = document.createElement('div');
                    el.className = `tile ${info.type} enter-anim`;
                    el.dataset.key = item.key;
                    let imgNum = info.num;
                    if (info.type === 'z') {
                        const zNames = ['東', '南', '西', '北', '中', '發', '白'];
                        imgNum = zNames.indexOf(info.num) + 1;
                    }
                    el.style.backgroundImage = `url('tiles/${info.type}${imgNum}.svg')`;
                }
                attachFastClick(
                    el,
                    () => {
                        const currentIdx = hand.findIndex((t) => t.key === item.key);
                        if (currentIdx > -1) removeTile(currentIdx);
                    },
                    'is-tapped-tile',
                );
                grid.appendChild(el);
            });
            existingTiles.forEach((el, key) => {
                if (!hand.find((t) => String(t.key) === key)) {
                    detachFastClick(el);
                    el.remove();
                }
            });
            for (let i = hand.length; i < currentMax; i++) {
                const empty = document.createElement('div');
                empty.className = 'tile empty';
                if (i >= lastMax && currentMax > lastMax) {
                    empty.classList.add('empty-enter-anim');
                }
                grid.appendChild(empty);
            }
            document.getElementById('tileCount').innerText = `暗牌已選 ${hand.length} / ${currentMax}`;
            const tileCountEl = document.getElementById('tileCount');
            if (hand.length === currentMax) tileCountEl.classList.add('tile-count-full');
            else tileCountEl.classList.remove('tile-count-full');
        };
        if (lastMax !== currentMax) smoothHeightUpdate('handCard', updateGridDOM);
        else updateGridDOM();
        grid.querySelectorAll('.tile[data-key]').forEach((el) => {
            const key = el.dataset.key;
            if (oldPos[key]) {
                el.classList.remove('enter-anim');
                const newRect = el.getBoundingClientRect();
                const oldRect = oldPos[key];
                const dx = oldRect.left - newRect.left;
                const dy = oldRect.top - newRect.top;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                    el.style.transition = 'none';
                    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                    el.offsetHeight;
                    el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    el.style.transform = 'translate3d(0,0,0)';
                    setTimeout(() => {
                        el.style.transition = '';
                        el.style.transform = '';
                    }, 300);
                } else {
                    el.style.transition = '';
                    el.style.transform = '';
                }
            }
        });
        // 恢復呼吸動畫
        setTimeout(() => {
            grid.querySelectorAll('.tile[data-key]').forEach((el, index) => {
                el.style.animationDelay = `${index * 0.15}s`;
                el.classList.add('breathing');
            });
        }, 300);
        lastMax = currentMax;
        checkAndRunEngine();
        updateKeyboardState(); // ✨ 這裡保留了鍵盤防呆功能
    }

    function clearHand() {
        if (isClearing) return;
        if (
            hand.length === 0 &&
            activeConditions.size === 0 &&
            activeFlowers.size === 0 &&
            roundWind === 0 &&
            seatWind === 0
        )
            return;
        isClearing = true;
        if (navigator.vibrate) navigator.vibrate([15]);
        const currentTiles = document.querySelectorAll('#handGrid .tile:not(.empty)');
        const oldMax = getCurrentMax();
        currentTiles.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const clone = el.cloneNode(true);
            clone.classList.remove('enter-anim');
            clone.classList.remove('breathing');
            clone.style.position = 'fixed';
            clone.style.left = `${rect.left}px`;
            clone.style.top = `${rect.top}px`;
            clone.style.width = `${rect.width}px`;
            clone.style.height = `${rect.height}px`;
            clone.style.margin = '0';
            clone.style.zIndex = '999';
            clone.style.transition = 'none';
            clone.style.animation = `popOut 0.35s cubic-bezier(0.36, 0, 0.66, -0.56) forwards`;
            clone.style.animationDelay = `${index * 0.025}s`;
            clone.style.willChange = 'transform, opacity';
            document.body.appendChild(clone);
            setTimeout(() => clone.remove(), 400 + index * 25);
        });
        activeConditions.clear();
        activeFlowers.clear();
        roundWind = 0;
        seatWind = 0;
        updateIslandSummary();
        document.querySelectorAll('.flower-tile.active').forEach((el) => el.classList.remove('active'));
        document
            .querySelectorAll('#roundWindSelector .wind-tab, #seatWindSelector .wind-tab')
            .forEach((el) => el.classList.remove('active'));
        document.querySelectorAll('#roundWindSelector .wind-tab')[0].classList.add('active');
        document.querySelectorAll('#seatWindSelector .wind-tab')[0].classList.add('active');
        const roundGlider = document.querySelector('#roundWindSelector .glass-glider');
        if (roundGlider) roundGlider.style.transform = `translateX(0%)`;
        const seatGlider = document.querySelector('#seatWindSelector .glass-glider');
        if (seatGlider) seatGlider.style.transform = `translateX(0%)`;
        hand = [];
        resetResultCard();
        document.getElementById('flowerCount').innerText = `已選 0 隻`;
        const grid = document.getElementById('handGrid');
        grid.innerHTML = '';
        for (let i = 0; i < oldMax; i++) {
            const empty = document.createElement('div');
            empty.className = 'tile empty';
            grid.appendChild(empty);
        }
        document.getElementById('tileCount').innerText = `暗牌已選 0 / 14`;
        setTimeout(
            () => {
                lastMax = oldMax;
                renderHand();
                isClearing = false;
            },
            400 + currentTiles.length * 25,
        );
    }
    function getExtras(counts) {
        let faan = 0;
        let tags = [];
        let fCount = activeFlowers.size;
        if (fCount === 0) {
            faan += 1;
            tags.push({ text: '無花 (1番)' });
        } else if (fCount === 8) {
            faan += 8;
            tags.push({ text: '大花胡 (8番)' });
        } else if (fCount === 7) {
            faan += 3;
            tags.push({ text: '花胡 (3番)' });
        } else {
            let hasSeasonSet = ['s1', 's2', 's3', 's4'].every((id) => activeFlowers.has(id));
            let hasPlantSet = ['p1', 'p2', 'p3', 'p4'].every((id) => activeFlowers.has(id));
            if (hasSeasonSet) {
                faan += 2;
                tags.push({ text: '一台花 [四季] (2番)' });
            }
            if (hasPlantSet) {
                faan += 2;
                tags.push({ text: '一台花 [四君] (2番)' });
            }
            if (!hasSeasonSet && activeFlowers.has(`s${seatWind + 1}`)) {
                faan += 1;
                tags.push({ text: '正花 (1番)' });
            }
            if (!hasPlantSet && activeFlowers.has(`p${seatWind + 1}`)) {
                faan += 1;
                tags.push({ text: '正花 (1番)' });
            }
        }
        let condFaan = 0;
        CONDITIONS.forEach((cond) => {
            if (cond.id === 'heaven' || cond.id === 'earth') return;
            if (activeConditions.has(cond.id) && cond.faan) {
                if (
                    cond.id === 'selfDrawn' &&
                    (activeConditions.has('kongSelfDrawn') ||
                        activeConditions.has('doubleKongSelfDrawn') ||
                        activeConditions.has('lastTile'))
                )
                    return;
                condFaan += cond.faan;
                tags.push({ text: cond.label });
            }
        });
        faan += condFaan;
        return { faan, tags };
    }
    function isNineGates(counts) {
        let sum = 0;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) sum += counts[i];
        if (sum !== 14) return false;
        for (let s = 0; s < 3; s++) {
            let start = s * SUIT_SIZE;
            let suitSum = 0;
            for (let i = 0; i < SUIT_SIZE; i++) suitSum += counts[start + i];
            if (suitSum === 14) {
                let base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
                let isValid = true;
                for (let i = 0; i < SUIT_SIZE; i++) if (counts[start + i] < base[i]) isValid = false;
                if (isValid) return true;
            }
        }
        return false;
    }
    function isThirteenOrphans(counts) {
        let sum = 0;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) sum += counts[i];
        if (sum !== 14) return false;
        let hasPair = false;
        for (let id of ORPHAN_IDS) {
            if (counts[id] === 0) return false;
            if (counts[id] === 2) hasPair = true;
        }
        return hasPair;
    }
    function runEngine() {
        // 執行引擎前先驗證手牌合法性
        if (!validateHand()) {
            displayResult(0, [{ text: '手牌資料異常 (詐糊)' }], false);
            return;
        }
        let counts = new Array(TOTAL_TILE_TYPES).fill(0);
        hand.forEach((item) => counts[item.id]++);
        let fCount = activeFlowers.size;
        if (fCount === 8) return displayResult(8, [{ text: '八仙過海 (8番)' }], true);
        let currentMax = getCurrentMax();
        let specialFaan = 0;
        let specialTags = [];
        let isSpecial = false;
        if (hand.length === currentMax) {
            if (activeConditions.has('heaven')) {
                specialFaan = 13;
                specialTags.push({ text: '天糊 (13番)' });
                isSpecial = true;
            } else if (activeConditions.has('earth')) {
                specialFaan = 13;
                specialTags.push({ text: '地糊 (13番)' });
                isSpecial = true;
            } else if (isThirteenOrphans(counts)) {
                specialFaan = 13;
                specialTags.push({ text: '十三么 (13番)' });
                isSpecial = true;
            } else if (isNineGates(counts)) {
                specialFaan = 13;
                specialTags.push({ text: '九子連環 (13番)' });
                isSpecial = true;
            }
        }
        if (isSpecial) return displayResult(specialFaan, specialTags, true);
        let validBreakdowns = [];
        if (hand.length === currentMax) {
            for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
                if (counts[i] >= 2) {
                    let tempCounts = [...counts];
                    tempCounts[i] -= 2;
                    let allValidMelds = [];
                    findAllMelds(tempCounts, 0, [], allValidMelds);
                    for (let melds of allValidMelds) {
                        validBreakdowns.push({ eye: i, melds: melds });
                    }
                }
            }
        }
        if (validBreakdowns.length === 0) {
            if (fCount === 7) return displayResult(3, [{ text: '花糊 (3番)' }], true);
            if (hand.length < currentMax) return;
            return displayResult(0, [{ text: '未成糊牌結構 (詐糊)' }], false);
        }
        let bestResult = { faan: -1, tags: [] };
        for (let breakdown of validBreakdowns) {
            let res = evaluateStandardPatterns(breakdown, counts);
            if (res.faan > bestResult.faan) bestResult = res;
        }
        if (bestResult.faan < 3) {
            let zaWuTags = [...bestResult.tags, { text: '不足三番起糊 (詐糊)' }];
            return displayResult(bestResult.faan, zaWuTags, false);
        }
        displayResult(bestResult.faan, bestResult.tags, true);
    }
    function evaluateStandardPatterns(breakdown, counts) {
        let faan = 0;
        let tags = [];
        let isExceptional = false;
        let kongsCount = 0;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
            if (counts[i] === 4) kongsCount++;
        }
        let suits = new Set();
        let hasZ = false;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
            if (counts[i] > 0) {
                if (i < SUIT_SIZE) suits.add('w');
                else if (i < SUIT_SIZE * 2) suits.add('t');
                else if (i < WIND_START) suits.add('s');
                else hasZ = true;
            }
        }
        if (suits.size === 0 && hasZ) {
            faan += 10;
            tags.push({ text: '字一色 (10番)' });
            isExceptional = true;
        } else if (suits.size === 1) {
            if (kongsCount < 4) {
                if (!hasZ) {
                    faan += 7;
                    tags.push({ text: '清一色 (7番)' });
                } else {
                    faan += 3;
                    tags.push({ text: '混一色 (3番)' });
                }
            }
        }
        const isAllPongs = breakdown.melds.every((m) => m.type === 'pong' || m.type === 'kong');
        const isAllChows = breakdown.melds.every((m) => m.type === 'chow');
        if (isAllPongs) {
            let isAllTerminals = true;
            for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
                if (counts[i] > 0 && i < WIND_START && i % SUIT_SIZE !== 0 && i % SUIT_SIZE !== 8) isAllTerminals = false;
            }
            if (isAllTerminals && !hasZ) {
                faan += 10;
                tags.push({ text: '清么九 (10番)' });
                isExceptional = true;
            } else if (isAllTerminals && hasZ) {
                if (kongsCount < 4) {
                    faan += 4;
                    tags.push({ text: '花么九 (4番)' });
                }
            } else if (activeConditions.has('concealed') && kongsCount < 4) {
                faan += 8;
                tags.push({ text: '坎坎糊 (8番)' });
                isExceptional = true;
            } else if (kongsCount < 4) {
                faan += 3;
                tags.push({ text: '對對糊 (3番)' });
            }
            if (kongsCount === 4) {
                faan += 13;
                tags.push({ text: '十八羅漢 (13番)' });
                isExceptional = true;
            }
        } else if (isAllChows) {
            faan += 1;
            tags.push({ text: '平糊 (1番)' });
        }
        let dPongs = 0,
            dEyes = 0;
        DRAGON_IDS.forEach((id) => {
            if (counts[id] >= 3) dPongs++;
            else if (counts[id] === 2) dEyes++;
        });
        if (dPongs === 3) {
            faan += 8;
            tags.push({ text: '大三元 (8番)' });
            isExceptional = true;
        } else if (dPongs === 2 && dEyes === 1) {
            faan += 5;
            tags.push({ text: '小三元 (5番)' });
        } else if (dPongs > 0) {
            if (counts[DRAGON_START] >= 3) {
                faan += 1;
                tags.push({ text: '紅中 (1番)' });
            }
            if (counts[DRAGON_START + 1] >= 3) {
                faan += 1;
                tags.push({ text: '發財 (1番)' });
            }
            if (counts[DRAGON_START + 2] >= 3) {
                faan += 1;
                tags.push({ text: '白板 (1番)' });
            }
        }
        let wPongs = 0,
            wEyes = 0;
        WIND_IDS.forEach((id) => {
            if (counts[id] >= 3) wPongs++;
            else if (counts[id] === 2) wEyes++;
        });
        if (wPongs === 4) {
            faan += 13;
            tags.push({ text: '大四喜 (13番)' });
            isExceptional = true;
        } else if (wPongs === 3 && wEyes === 1) {
            faan += 6;
            tags.push({ text: '小四喜 (6番)' });
            isExceptional = true;
        } else {
            if (!isExceptional) {
                let roundWindId = WIND_START + roundWind;
                let seatWindId = WIND_START + seatWind;
                let windNames = ['東', '南', '西', '北'];
                if (counts[roundWindId] >= 3) {
                    faan += 1;
                    tags.push({ text: `${windNames[roundWind]}圈 (1番)` });
                }
                if (counts[seatWindId] >= 3) {
                    faan += 1;
                    tags.push({ text: `${windNames[seatWind]}位 (1番)` });
                }
            }
        }
        if (!isExceptional) {
            let extras = getExtras(counts);
            faan += extras.faan;
            tags.push(...extras.tags);
        }
        if (faan === 0 && !isExceptional) tags.push({ text: '雞糊 (0番)' });
        return { faan, tags };
    }

    /* ------------------------------------------
       📊 結果顯示與歷史紀錄
       ------------------------------------------ */

    function displayResult(faan, tags, isWin) {
        const isZaWu = !isWin && hand.length === getCurrentMax();
        const isBaauPang = isWin && faan >= 13;
        const heroCard = document.getElementById('resultHeroCard');
        const badge = document.getElementById('resultBadge');
        const scoreVal = document.getElementById('heroScoreValue');
        const scoreUnit = document.getElementById('heroScoreUnit');
        const mainPattern = document.getElementById('heroMainPatternName');

        heroCard.className = 'glass-card result-hero';
        badge.className = 'result-badge';
        document.body.className = '';
        if (isZaWu) document.body.classList.add('failure-mode');
        else if (isBaauPang) document.body.classList.add('limit-mode');
        else if (isWin) document.body.classList.add('success-mode');
        const windNames = ['東', '南', '西', '北'];
        document.getElementById('resRoundWind').innerText = windNames[roundWind];
        document.getElementById('resSeatWind').innerText = windNames[seatWind];
        document.getElementById('resFlowers').innerText = activeFlowers.size === 0 ? '無花' : `${activeFlowers.size} 隻`;

        let mainName = '平糊';
        if (isZaWu) {
            badge.innerHTML = '<i class="ic">error</i> 判定失敗';
            badge.classList.add('fail');
            scoreVal.innerText = '--';
            scoreUnit.style.display = 'none';
            mainPattern.innerText = '詐糊';
            mainPattern.className = 'main-pattern-name text-danger';
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        } else {
            scoreVal.innerText = faan;
            scoreUnit.style.display = 'inline';
            if (isBaauPang) {
                scoreVal.innerText = '爆棚';
                scoreUnit.style.display = 'none';
                scoreVal.classList.add('baau-pang-text');
                badge.innerHTML = '<i class="ic">auto_awesome</i> 極限爆棚';
                badge.classList.add('legendary');
            } else if (faan >= 7) {
                badge.innerHTML = '<i class="ic">auto_fix_high</i> 史詩大牌';
                badge.classList.add('epic');
            } else {
                badge.innerHTML = '<i class="ic">check_circle</i> 結算成功';
                badge.classList.add('common');
            }
            let maxFaan = -1;
            tags.forEach((t) => {
                let text = typeof t === 'string' ? t : t.text;
                const match = text.match(/(.*?)\s*\((\d+)番\)/);
                if (match) {
                    let f = parseInt(match[2]);
                    if (f > maxFaan) {
                        maxFaan = f;
                        mainName = match[1].trim();
                    }
                }
            });
            mainPattern.innerText = mainName;
            mainPattern.className = 'main-pattern-name text-success';
            if (navigator.vibrate) {
                if (isBaauPang) navigator.vibrate([30, 50, 30, 50, 30]);
                else navigator.vibrate([30, 50, 30]);
            }
        }

        const detailList = document.getElementById('detailList');
        detailList.innerHTML = '';
        let cleanSubPatterns = tags.map((t) => (typeof t === 'string' ? t : t.text).split(' ')[0]).join(', ');
        currentResultSnapshot = {
            faan: isZaWu ? 0 : faan,
            isWin: isWin,
            isBaauPang: isBaauPang,
            mainPattern: isZaWu ? '詐糊' : mainName,
            subPatterns: cleanSubPatterns,
            timestamp: new Date().getTime(),
        };

        // 自動儲存戰績
        if (currentResultSnapshot) {
            let history = safeGetHistory();
            history.unshift(currentResultSnapshot);
            if (history.length > 50) history.pop();
            safeSaveHistory(history);
            renderHistory();
            updateProfileData();
        }

        tags.forEach((t, index) => {
            let text = typeof t === 'string' ? t : t.text;
            const match = text.match(/(.*?)\s*\((.*?)\)/);
            let name = text;
            let scoreText = '';
            if (match) {
                name = match[1].trim();
                scoreText = match[2].trim();
            }
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.style.animationDelay = `${index * 0.1}s`;
            let icon = 'poker_chip';
            if (name.includes('花')) icon = 'local_florist';
            else if (name.includes('圈') || name.includes('位')) icon = 'air';

            // 使用 createElement 代替 innerHTML，避免任何潛在注入
            const nameDiv = document.createElement('div');
            nameDiv.className = 'detail-item-name';
            const iconDiv = document.createElement('div');
            iconDiv.className = 'detail-item-icon ic';
            iconDiv.textContent = icon;
            nameDiv.appendChild(iconDiv);
            nameDiv.appendChild(document.createTextNode(name));

            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'detail-item-score';
            scoreDiv.textContent = scoreText;
            if (isZaWu) {
                scoreDiv.classList.add('score-fail');
            }

            item.appendChild(nameDiv);
            item.appendChild(scoreDiv);
            detailList.appendChild(item);
        });
    }

    /* ------------------------------------------
       📜 歷史紀錄管理
       ------------------------------------------ */

    function renderHistory() {
        let history = safeGetHistory();
        const listContainer = document.getElementById('historyList');

        const statMax = document.getElementById('statMaxFaan');
        const statTotal = document.getElementById('statTotalGames');
        const statWinRate = document.getElementById('statWinRate');
        const statWinRateBar = document.getElementById('statWinRateBar');

        if (history.length === 0) {
            listContainer.innerHTML = '<div class="history-empty">暫無戰績紀錄，快去胡一把大牌吧！</div>';
            statMax.innerText = '0';
            statTotal.innerText = '0';
            statWinRate.innerText = '0%';
            statWinRateBar.style.width = '0%';
            return;
        }

        let maxFaan = 0;
        let totalFaan = 0;
        let winCount = 0;
        listContainer.innerHTML = '';

        history.forEach((record, index) => {
            if (record.isWin) {
                if (record.faan > maxFaan) maxFaan = record.faan;
                totalFaan += record.faan;
                winCount++;
            }

            const date = new Date(record.timestamp);
            const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            let badgeClass = 'bg-fail';
            let badgeVal = '--';

            let typeBadgeText = '詐糊';
            let typeBadgeClass = 'history-card-type-badge type-fail';

            if (record.isWin) {
                badgeVal = record.isBaauPang ? '爆' : record.faan;
                if (record.faan >= 13) badgeClass = 'bg-legendary';
                else if (record.faan >= 7) badgeClass = 'bg-epic';
                else badgeClass = 'bg-rare';

                if (record.subPatterns.includes('自摸')) {
                    typeBadgeText = '自摸';
                    typeBadgeClass = 'history-card-type-badge type-self';
                } else {
                    typeBadgeText = '食糊';
                    typeBadgeClass = 'history-card-type-badge type-win';
                }
            }

            const item = document.createElement('div');
            item.className = 'history-card';
            item.style.animationDelay = `${index * 0.05}s`;

            // 使用 createElement 代替 innerHTML，防止 localStorage 資料注入
            const badge = document.createElement('div');
            badge.className = `history-card-badge ${badgeClass}`;
            const bVal = document.createElement('div');
            bVal.className = 'b-val';
            bVal.textContent = badgeVal;
            const bUnit = document.createElement('div');
            bUnit.className = 'b-unit';
            bUnit.textContent = '番';
            badge.appendChild(bVal);
            badge.appendChild(bUnit);

            const info = document.createElement('div');
            info.className = 'history-card-info';

            const header = document.createElement('div');
            header.className = 'history-card-header';
            const title = document.createElement('div');
            title.className = 'history-card-title';
            title.textContent = record.isWin ? record.mainPattern : '判定失敗';
            const typeBadge = document.createElement('span');
            typeBadge.className = typeBadgeClass;
            typeBadge.textContent = typeBadgeText;
            header.appendChild(title);
            header.appendChild(typeBadge);

            const sub = document.createElement('div');
            sub.className = 'history-card-sub';
            sub.textContent = record.subPatterns || '無附加番種';

            const time = document.createElement('div');
            time.className = 'history-card-time';
            time.innerHTML = '<i class="ic">calendar_today</i> ' + timeStr;

            info.appendChild(header);
            info.appendChild(sub);
            info.appendChild(time);

            item.appendChild(badge);
            item.appendChild(info);
            listContainer.appendChild(item);
        });

        statTotal.innerText = history.length;
        statMax.innerText = maxFaan >= 13 ? '13+' : maxFaan;

        let winRate = Math.round((winCount / history.length) * 100);
        statWinRate.innerText = winRate + '%';

        setTimeout(() => {
            statWinRateBar.style.width = winRate + '%';
        }, 100);
    }

    /* ------------------------------------------
       📖 百科系統
       ------------------------------------------ */

    function populateWiki(filterType = 'all', searchQuery = '') {
        const area = document.getElementById('wikiContentArea');
        area.innerHTML = '';

        const query = searchQuery.toLowerCase().trim();

        const renderList = (title, types) => {
            const items = DICTIONARY.filter((item) => {
                const matchType = types.includes(item.type);
                const matchQuery = query === '' || item.name.toLowerCase().includes(query);
                return matchType && matchQuery;
            });
            if (items.length === 0) return;

            let titleHtml = document.createElement('div');
            titleHtml.className = 'wiki-section-header';
            titleHtml.innerText = title;
            area.appendChild(titleHtml);

            let listContainer = document.createElement('div');
            listContainer.className = 'wiki-list-container';

            items.forEach((item, index) => {
                const badgeClass = item.type === 'common' ? 'badge-common' : 'badge-mid';

                let div = document.createElement('div');
                div.className = 'w-list-item glass-card wiki-anim-item';
                div.style.animationDelay = `${index * 0.05}s`;

                const iconBox = document.createElement('div');
                iconBox.className = 'w-item-icon-box';
                const iconEl = document.createElement('i');
                iconEl.className = 'ic';
                iconEl.textContent = item.icon;
                iconBox.appendChild(iconEl);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'w-item-info';
                const headerDiv = document.createElement('div');
                headerDiv.className = 'w-item-header';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'w-item-title';
                titleSpan.textContent = item.name;
                const badgeSpan = document.createElement('span');
                badgeSpan.className = `w-item-badge ${badgeClass}`;
                badgeSpan.textContent = `${item.f} 番`;
                headerDiv.appendChild(titleSpan);
                headerDiv.appendChild(badgeSpan);
                const descDiv = document.createElement('div');
                descDiv.className = 'w-item-desc';
                descDiv.textContent = item.d;
                infoDiv.appendChild(headerDiv);
                infoDiv.appendChild(descDiv);

                const arrow = document.createElement('div');
                arrow.className = 'wiki-list-arrow ic';
                arrow.textContent = 'chevron_right';

                div.appendChild(iconBox);
                div.appendChild(infoDiv);
                div.appendChild(arrow);

                attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
                listContainer.appendChild(div);
            });
            area.appendChild(listContainer);
        };

        const renderLimitGrid = () => {
            const items = DICTIONARY.filter((item) => {
                const matchType = item.type === 'limit';
                const matchQuery = query === '' || item.name.toLowerCase().includes(query);
                return matchType && matchQuery;
            });
            if (items.length === 0) return;

            let titleHtml = document.createElement('div');
            titleHtml.className = 'wiki-section-header wiki-section-header--spaced';
            const fireIcon = document.createElement('i');
            fireIcon.className = 'ic';
            fireIcon.textContent = 'local_fire_department';
            titleHtml.appendChild(fireIcon);
            titleHtml.appendChild(document.createTextNode(' 爆棚 / 役滿'));
            area.appendChild(titleHtml);

            let gridContainer = document.createElement('div');
            gridContainer.className = 'wiki-limit-grid';

            items.forEach((item, index) => {
                let div = document.createElement('div');
                div.className = 'w-limit-card glass-card wiki-anim-item';
                div.style.animationDelay = `${index * 0.08}s`;

                const bg = document.createElement('div');
                bg.className = 'w-limit-bg';
                bg.style.backgroundImage = `url('${item.img}')`;

                const content = document.createElement('div');
                content.className = 'w-limit-content';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'w-limit-title';
                titleSpan.textContent = item.name;
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'w-limit-badge';
                badgeSpan.textContent = item.f >= 13 ? '13 番 (上限)' : `${item.f} 番`;
                content.appendChild(titleSpan);
                content.appendChild(badgeSpan);

                div.appendChild(bg);
                div.appendChild(content);

                attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
                gridContainer.appendChild(div);
            });
            area.appendChild(gridContainer);
        };

        if (filterType === 'all' || filterType === 'common') renderList('1 - 3 番', ['common']);
        if (filterType === 'all' || filterType === 'mid') renderList('4 - 9 番', ['mid']);
        if (filterType === 'all' || filterType === 'limit') renderLimitGrid();

        if (area.innerHTML === '') {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'wiki-anim-item wiki-empty-state';
            const escaped = escapeHTML(searchQuery);
            const msg = document.createElement('span');
            msg.textContent = `找不到符合「${escaped}」的番種`;
            const hint = document.createElement('span');
            hint.className = 'wiki-empty-hint';
            hint.textContent = '請嘗試輸入其他關鍵字（如：平糊、字一色）';
            emptyDiv.appendChild(msg);
            emptyDiv.appendChild(hint);
            area.appendChild(emptyDiv);
        }
    }

    // 篩選器綁定（只在 init 時執行一次，避免重複綁定）
    function setupWikiFilters() {
        document.querySelectorAll('.w-filter').forEach((btn) => {
            attachFastClick(
                btn,
                () => {
                    document.querySelectorAll('.w-filter').forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');
                    const currentQuery = document.getElementById('wikiSearch').value;
                    populateWiki(btn.getAttribute('data-filter'), currentQuery);
                    if (navigator.vibrate) navigator.vibrate([5]);
                },
                'is-tapped-chip',
            );
        });
    }

    function populateDailyFeatured() {
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        const item = DICTIONARY[seed % DICTIONARY.length];

        document.querySelector('.w-feat-badge').textContent = item.f >= 13 ? '13 番 (爆棚)' : `${item.f} 番`;
        document.querySelector('.w-feat-title').textContent = item.name;
        document.querySelector('.w-feat-desc').textContent = item.d;

        const tilesContainer = document.querySelector('.w-feat-tiles');
        tilesContainer.innerHTML = '';
        const tiles = item.preview || [];
        tiles.forEach((t, i) => {
            if (i > 0 && i % 3 === 0) {
                const spacer = document.createElement('div');
                spacer.style.width = '4px';
                tilesContainer.appendChild(spacer);
            }
            const tile = document.createElement('div');
            tile.className = 'w-tile';
            tile.style.backgroundImage = `url('tiles/${t}.svg')`;
            tilesContainer.appendChild(tile);
        });
    }

    function openWikiDetail(item) {
        if (wikiDetailTransitioning) return;
        wikiDetailTransitioning = true;
        setTimeout(() => { wikiDetailTransitioning = false; }, 500);
        if (navigator.vibrate) navigator.vibrate([10]);

        document.getElementById('wdTitle').innerText = item.name;
        document.getElementById('wdFaan').innerText = item.f >= 13 ? '13 番 (爆棚)' : `${item.f} 番`;

        const previewArea = document.getElementById('wdPreviewTiles');
        previewArea.innerHTML = '';
        const defaultTiles = ['w1', 'w2', 'w3', 't4', 't5', 't6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'z5', 'z5'];
        const tilesToRender = item.preview || defaultTiles;

        tilesToRender.forEach((t, i) => {
            const rotation = i % 3 === 0 ? 'rotate(2deg)' : i % 2 === 0 ? 'rotate(-1deg)' : 'rotate(0deg)';
            let margin = '';
            if (tilesToRender.length > 14) {
                margin = i === 3 || i === 7 || i === 11 || i === 15 ? '8px' : '-4px';
            } else {
                margin = i === 2 || i === 5 || i === 8 || i === 11 ? '6px' : '';
            }
            const tile = document.createElement('div');
            tile.className = 'w-tile';
            tile.style.backgroundImage = `url('tiles/${t}.svg')`;
            tile.style.transform = `${rotation} translateY(${i % 2 === 0 ? '-1px' : '1px'})`;
            if (margin) tile.style.marginRight = margin;
            previewArea.appendChild(tile);
        });

        const descEl = document.getElementById('wdDesc');
        descEl.innerHTML = '';
        const strong = document.createElement('strong');
        strong.className = 'wd-desc-highlight';
        strong.textContent = item.name;
        descEl.appendChild(strong);
        descEl.appendChild(document.createElement('br'));
        descEl.appendChild(document.createElement('br'));
        let bodyText;
        if (item.desc) {
            bodyText = item.desc.replace(/<strong[^>]*>.*?<\/strong>/i, '').replace(/^(\s*<br\s*\/?>)*/i, '').trim();
        } else {
            bodyText = item.d;
        }
        bodyText.split(/<br\s*\/?>/).forEach((seg, i, arr) => {
            descEl.appendChild(document.createTextNode(seg));
            if (i < arr.length - 1) descEl.appendChild(document.createElement('br'));
        });

        const tipsSec = document.getElementById('wdTipsSection');
        const tipsArea = document.getElementById('wdTips');
        if (item.tips && item.tips.length > 0) {
            tipsSec.style.display = 'flex';
            tipsArea.innerHTML = '';
            item.tips.forEach((tip) => {
                const tipItem = document.createElement('div');
                tipItem.className = 'wd-tip-item';
                const tipIcon = document.createElement('div');
                tipIcon.className = 'wd-tip-icon';
                const tipIconI = document.createElement('i');
                tipIconI.className = 'ic';
                tipIconI.textContent = tip.icon;
                tipIcon.appendChild(tipIconI);
                const tipContent = document.createElement('div');
                tipContent.className = 'wd-tip-content';
                const tipH4 = document.createElement('h4');
                tipH4.textContent = tip.title;
                const tipP = document.createElement('p');
                tipP.textContent = tip.text;
                tipContent.appendChild(tipH4);
                tipContent.appendChild(tipP);
                tipItem.appendChild(tipIcon);
                tipItem.appendChild(tipContent);
                tipsArea.appendChild(tipItem);
            });
        } else {
            tipsSec.style.display = 'none';
        }

        const varsSec = document.getElementById('wdVarsSection');
        const varsArea = document.getElementById('wdVars');
        if (item.vars && item.vars.length > 0) {
            varsSec.style.display = 'flex';
            varsArea.innerHTML = '';
            item.vars.forEach((v) => {
                const card = document.createElement('div');
                card.className = 'wd-var-card glass-card';
                const varHeader = document.createElement('div');
                varHeader.className = 'wd-var-header';
                const varTitle = document.createElement('span');
                varTitle.className = 'wd-var-title';
                varTitle.textContent = v.name;
                const varBadge = document.createElement('span');
                varBadge.className = 'wd-var-badge';
                varBadge.textContent = v.faan;
                varHeader.appendChild(varTitle);
                varHeader.appendChild(varBadge);
                const varImg = document.createElement('div');
                varImg.className = 'wd-var-img';
                const varIconI = document.createElement('i');
                varIconI.className = 'ic';
                varIconI.textContent = v.icon;
                varImg.appendChild(varIconI);
                const varDesc = document.createElement('div');
                varDesc.className = 'wd-var-desc';
                varDesc.textContent = v.desc;
                card.appendChild(varHeader);
                card.appendChild(varImg);
                card.appendChild(varDesc);
                varsArea.appendChild(card);
            });
        } else {
            varsSec.style.display = 'none';
        }

        // 記錄百科頁捲動位置，返回時恢復
        wikiScrollPos = window.scrollY;

        // 先切頁，讓 DOM 脫離 display:none 狀態
        document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
        document.getElementById('page-wiki-detail').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'instant' });

        // 等瀏覽器完成渲染後再觸發接力動畫，確保每個區塊都能正確播放
        const hero = document.querySelector('.w-detail-hero');
        const preview = document.querySelector('.w-detail-preview');
        const descSec = document.getElementById('wdDesc').parentElement;

        const sections = [hero, preview, descSec, tipsSec, varsSec];
        sections.forEach((el) => {
            if (el) {
                el.classList.remove('wd-anim-item');
                el.style.animationDelay = '';
            }
        });

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                let delay = 0;
                sections.forEach((el) => {
                    if (el && el.style.display !== 'none') {
                        el.style.animationDelay = `${delay}s`;
                        el.classList.add('wd-anim-item');
                        delay += 0.08;
                    }
                });
            });
        });
    }

    /* ------------------------------------------
       👤 個人檔案與勳章
       ------------------------------------------ */

    function updateProfileData() {
        let history = safeGetHistory();
        let totalGames = history.length;
        let maxFaan = 0;
        let winCount = 0;
        let hasFlowerWin = false;
        let hasLimitWin = false;

        history.forEach((record) => {
            if (record.isWin) {
                winCount++;
                if (record.faan > maxFaan) maxFaan = record.faan;
                if (record.isBaauPang) hasLimitWin = true;
                if (record.subPatterns && (record.subPatterns.includes('花') || record.subPatterns.includes('八仙'))) {
                    hasFlowerWin = true;
                }
            }
        });

        // 更新統計數字
        const profTotal = document.getElementById('profTotalGamesVal');
        const profMax = document.getElementById('profMaxFaanVal');
        if (profTotal) profTotal.innerText = totalGames;
        if (profMax) profMax.innerText = maxFaan >= 13 ? '13+' : maxFaan;

        // 計算等級
        const levelEl = document.getElementById('profLevelText');
        if (levelEl) {
            let level = 1;
            let title = '雀壇新星';
            if (totalGames >= 50) { level = 8; title = '雀神降臨'; }
            else if (totalGames >= 30) { level = 7; title = '雀壇宗師'; }
            else if (totalGames >= 20) { level = 6; title = '資深雀士'; }
            else if (totalGames >= 15) { level = 5; title = '高階牌手'; }
            else if (totalGames >= 10) { level = 4; title = '進階牌手'; }
            else if (totalGames >= 5) { level = 3; title = '初級牌手'; }
            else if (totalGames >= 1) { level = 2; title = '入門新手'; }
            levelEl.innerHTML = '<i class="ic ic-level">emoji_events</i> ' + title + ' LV.' + level;
        }

        // 勳章解鎖邏輯
        const medalWin = document.getElementById('medal-win');
        const medalFlower = document.getElementById('medal-flower');
        const medalLimit = document.getElementById('medal-limit');
        const medalLegend = document.getElementById('medal-legend');

        // 胡牌開張：首次糊牌
        if (medalWin && winCount >= 1) medalWin.classList.add('unlocked');
        // 花胡達人：花相關番種糊牌
        if (medalFlower && hasFlowerWin) medalFlower.classList.add('unlocked');
        // 爆棚大師：達成 13 番上限
        if (medalLimit && hasLimitWin) medalLimit.classList.add('unlocked');
        // 傳說降臨：累計 10 局以上
        if (medalLegend && totalGames >= 10) medalLegend.classList.add('unlocked');
    }

    init();
    animatePageBlocks(document.getElementById('page-input'));

})(); // IIFE 結束
