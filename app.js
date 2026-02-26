const APP_VERSION = "v2.8.20";

let newWorker;
window.isUpdateReady = false;
let displaySeq = 0; 

function attachFastClick(el, action, tapClass = '') {
    if (el._hasFastClick) { el._action = action; return; }
    el._action = action; el._hasFastClick = true; let touchHandled = false; let isScrolling = false; let startX = 0; let startY = 0;
    
    el.addEventListener('touchstart', (e) => { 
        touchHandled = true; isScrolling = false; startX = e.touches[0].clientX; startY = e.touches[0].clientY; 
        if(tapClass) el.classList.add(tapClass); 
    }, { passive: true });
    
    el.addEventListener('touchmove', (e) => { 
        if(!touchHandled) return; let moveX = Math.abs(e.touches[0].clientX - startX); let moveY = Math.abs(e.touches[0].clientY - startY); 
        if (moveX > 10 || moveY > 10) { isScrolling = true; if(tapClass) el.classList.remove(tapClass); } 
    }, { passive: true });
    
    el.addEventListener('touchend', (e) => { 
        if(tapClass) el.classList.remove(tapClass); 
        if (touchHandled && !isScrolling) { if (el._action) el._action(e); } 
        setTimeout(() => { touchHandled = false; }, 400); 
    });
    
    el.addEventListener('mousedown', (e) => { 
        if (e.button !== 0) return; 
        if (!touchHandled) { 
            if(tapClass) { el.classList.add(tapClass); setTimeout(() => el.classList.remove(tapClass), 100); } 
            if (el._action) el._action(e); 
        } 
    });
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
}

function smoothHeightUpdate(elementId, updateDOM) {
    const el = document.getElementById(elementId); if (!el) { updateDOM(); return; }
    const oldHeight = el.offsetHeight; updateDOM(); el.style.height = 'auto'; const newHeight = el.offsetHeight;
    if (oldHeight !== newHeight && oldHeight > 0) {
        el.style.height = oldHeight + 'px'; const oldOverflow = el.style.overflow; el.style.overflow = 'hidden'; 
        el.style.willChange = 'height'; el.offsetHeight; el.style.transition = 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'; el.style.height = newHeight + 'px';
        setTimeout(() => { el.style.height = 'auto'; el.style.transition = ''; el.style.overflow = oldOverflow; el.style.willChange = 'auto'; }, 300);
    }
}

// ✨ v2.8.4 iOS 終極防禦版：強制繞過快取與全面狀態攔截
if ('serviceWorker' in navigator) { 
    window.addEventListener('load', () => { 
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
            if (reg.waiting) { newWorker = reg.waiting; showUpdateOnIsland(); }
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) { showUpdateOnIsland(); }
                });
            });

            const checkUpdateSafely = () => {
                if (navigator.onLine) { setTimeout(() => { reg.update().catch(err => console.log('SW Update Check Error:', err)); }, 2000); }
            };

            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdateSafely(); });
            window.addEventListener('focus', checkUpdateSafely);
            window.addEventListener('online', checkUpdateSafely);
            setInterval(checkUpdateSafely, 30 * 60 * 1000);
        }).catch(err => console.log('SW Error:', err)); 
    }); 

    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

function showUpdateOnIsland() {
    window.isUpdateReady = true;
    const island = document.getElementById('conditionsIsland');
    const title = document.getElementById('islandTitle');
    
    island.classList.add('update-ready');
    title.classList.add('slide-out');
    setTimeout(() => {
        title.innerText = '✨ 發現新版本 (點擊更新)';
        title.style.color = '#ca8a04'; 
        title.classList.remove('slide-out');
        title.classList.add('slide-in');
        void title.offsetWidth; 
        title.classList.remove('slide-in');
        
        if (island.classList.contains('expanded')) { island.classList.remove('expanded'); }
    }, 200);
}

let deferredPrompt; const installBtn = document.getElementById('installBtn');
const isIOS = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isStandalone) installBtn.style.display = 'none';
else {
    if (isIOS) { installBtn.style.display = 'block'; attachFastClick(installBtn, () => alert('🍎 iOS 安裝提示：\n\n請點擊 Safari 底部的「分享」圖示 📤，然後往下滑選擇「加入主畫面 ＋」，就能將 App 永久安裝到桌面囉！'), 'is-tapped-chip'); } 
    else { window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.style.display = 'block'; }); attachFastClick(installBtn, async () => { if (deferredPrompt) { installBtn.style.display = 'none'; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; if (outcome !== 'accepted') installBtn.style.display = 'block'; deferredPrompt = null; } }, 'is-tapped-chip'); }
}
window.addEventListener('appinstalled', () => { installBtn.style.display = 'none'; });

const TILE_DEFS = [
    { type: 'w', label: '萬', count: 9, startId: 0 }, { type: 't', label: '筒', count: 9, startId: 9 },
    { type: 's', label: '索', count: 9, startId: 18 }, { type: 'z', names: ['東','南','西','北','中','發','白'], startId: 27 }
];

const CONDITIONS = [
    { id: 'selfDrawn', label: '自摸 (1番)', faan: 1 }, { id: 'concealed', label: '門前清 (1番)', faan: 1 }, { id: 'lastTile', label: '海底撈月 (1番)', faan: 1 },
    { id: 'kongSelfDrawn', label: '槓上自摸 (2番)', faan: 2 }, { id: 'doubleKongSelfDrawn', label: '槓上槓自摸 (8番)', faan: 8 }, { id: 'robKong', label: '搶槓 (1番)', faan: 1 },
    { id: 'heaven', label: '天糊 (13番)' }, { id: 'earth', label: '地糊 (13番)' }
];

const FLOWERS = [
    { id: 's1', name: '春', group: 'season', wind: 0 }, { id: 's2', name: '夏', group: 'season', wind: 1 }, { id: 's3', name: '秋', group: 'season', wind: 2 }, { id: 's4', name: '冬', group: 'season', wind: 3 },
    { id: 'p1', name: '梅', group: 'plant', wind: 0 }, { id: 'p2', name: '蘭', group: 'plant', wind: 1 }, { id: 'p3', name: '菊', group: 'plant', wind: 2 }, { id: 'p4', name: '竹', group: 'plant', wind: 3 }
];

let hand = []; let activeConditions = new Set(); let roundWind = 0; let seatWind = 0; let activeFlowers = new Set();
let tileKeyCounter = 0; let lastMax = 14; let lastTagsHtml = ''; 

function init() { 
    renderConditions(); renderFlowers(); renderKeyboard(); renderHand(); 
    document.getElementById('appVersion').innerText = APP_VERSION;

    attachFastClick(document.getElementById('islandHeaderBtn'), () => {
        if (window.isUpdateReady && newWorker) {
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
            newWorker.postMessage({ type: 'SKIP_WAITING' }); 
            return; 
        }

        const island = document.getElementById('conditionsIsland');
        const isExpanding = !island.classList.contains('expanded'); 
        
        island.classList.toggle('expanded');
        if (navigator.vibrate) navigator.vibrate([5]);

        const handCard = document.getElementById('handCard');
        const keyboard = document.getElementById('keyboard');
        
        handCard.classList.remove('jelly-squish', 'jelly-stretch');
        keyboard.classList.remove('jelly-squish', 'jelly-stretch');
        
        void handCard.offsetWidth;
        
        if (isExpanding) {
            handCard.classList.add('jelly-squish');
            keyboard.classList.add('jelly-squish');
        } else {
            handCard.classList.add('jelly-stretch');
            keyboard.classList.add('jelly-stretch');
        }
    }, 'is-tapped-island');

    document.querySelectorAll('#roundWindSelector .wind-btn').forEach((btn, i) => attachFastClick(btn, () => setRoundWind(i), 'is-tapped-chip'));
    document.querySelectorAll('#seatWindSelector .wind-btn').forEach((btn, i) => attachFastClick(btn, () => setSeatWind(i), 'is-tapped-chip'));
    attachFastClick(document.getElementById('clearBtnId'), clearHand, 'is-tapped-chip');
    
    updateIslandSummary(); 
}

// 🌟 修改：將互斥防呆邏輯完美融入你原本的 Set 架構中
function renderConditions() {
    const bar = document.getElementById('conditionsBar'); 
    if (bar.children.length === 0) {
        CONDITIONS.forEach(cond => {
            const chip = document.createElement('div'); chip.className = 'condition-chip'; chip.id = `cond-${cond.id}`; chip.innerText = cond.label;
            attachFastClick(chip, () => {
                if (activeConditions.has(cond.id)) { 
                    activeConditions.delete(cond.id); 
                    // 取消自摸時，連帶取消槓上自摸
                    if (cond.id === 'selfDrawn') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); } 
                } 
                else { 
                    activeConditions.add(cond.id); 
                    
                    // 🛡️ 防呆：槓上自摸必含自摸
                    if (cond.id === 'kongSelfDrawn' || cond.id === 'doubleKongSelfDrawn') { activeConditions.add('selfDrawn'); }
                    
                    // 🛡️ 防呆邏輯 1：【天地不容 與 門前清】
                    if (cond.id === 'heaven') { activeConditions.delete('earth'); activeConditions.delete('concealed'); }
                    if (cond.id === 'earth') { activeConditions.delete('heaven'); activeConditions.delete('concealed'); }
                    if (cond.id === 'concealed') { activeConditions.delete('heaven'); activeConditions.delete('earth'); }

                    // 🛡️ 防呆邏輯 2：【槓與搶的矛盾】 + 【海底撈月】
                    if (cond.id === 'robKong') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); }
                    if (cond.id === 'kongSelfDrawn' || cond.id === 'doubleKongSelfDrawn') { activeConditions.delete('robKong'); activeConditions.delete('lastTile'); }
                    if (cond.id === 'lastTile') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); }
                    
                    // 🛡️ 防呆：單槓雙槓不共存
                    if (cond.id === 'kongSelfDrawn') activeConditions.delete('doubleKongSelfDrawn');
                    if (cond.id === 'doubleKongSelfDrawn') activeConditions.delete('kongSelfDrawn');
                }
                updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine();
            }, 'is-tapped-chip');
            bar.appendChild(chip);
        });
    }
    updateIslandSummary();
}

function updateIslandSummary() {
    if (window.isUpdateReady) return; 

    let activeLabels = [];
    CONDITIONS.forEach(cond => {
        const chip = document.getElementById(`cond-${cond.id}`);
        if (chip) { 
            if (activeConditions.has(cond.id)) { 
                chip.classList.add('active'); 
                activeLabels.push(cond.label.split(' ')[0]); 
            } 
            else { chip.classList.remove('active'); } 
        }
    });

    const windNames = ['東', '南', '西', '北'];
    if (roundWind !== 0 || seatWind !== 0) activeLabels.push(`${windNames[roundWind]}圈${windNames[seatWind]}位`);
    if (activeFlowers.size > 0) activeLabels.push(`${activeFlowers.size}花`);

    const title = document.getElementById('islandTitle');
    const newText = activeLabels.length === 0 ? '✦ 牌局設定' : `✦ ${activeLabels.join(', ')}`;
    const newColor = activeLabels.length === 0 ? '#64748b' : '#3b82f6';
    
    if (title.innerText !== newText && title.innerText !== '') {
        title.classList.add('slide-out');
        setTimeout(() => {
            title.innerText = newText;
            title.style.color = newColor;
            title.classList.remove('slide-out');
            title.classList.add('slide-in');
            void title.offsetWidth; 
            title.classList.remove('slide-in');
        }, 200);
    } else {
        title.innerText = newText; 
        title.style.color = newColor; 
    }
}

function setRoundWind(index) { 
    roundWind = index; 
    document.getElementById('roundWindSelector').querySelectorAll('.wind-btn').forEach((btn, i) => btn.className = `wind-btn ${i === index ? 'active' : ''}`); 
    updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); 
}

function setSeatWind(index) { 
    seatWind = index; 
    document.getElementById('seatWindSelector').querySelectorAll('.wind-btn').forEach((btn, i) => btn.className = `wind-btn ${i === index ? 'active' : ''}`); 
    updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); 
}

function renderFlowers() {
    const grid = document.getElementById('flowerGrid'); 
    if (grid.children.length === 0) {
        FLOWERS.forEach((f, index) => {
            const btn = document.createElement('div'); btn.className = 'flower-tile'; btn.id = `flower-${f.id}`; if (activeFlowers.has(f.id)) btn.classList.add('active'); btn.style.backgroundImage = `url('tiles/f${index + 1}.svg')`;
            attachFastClick(btn, () => {
                if (activeFlowers.has(f.id)) activeFlowers.delete(f.id); else activeFlowers.add(f.id);
                btn.classList.toggle('active'); 
                document.getElementById('flowerCount').innerText = `已選 ${activeFlowers.size} 隻`;
                updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine();
            });
            grid.appendChild(btn);
        });
    }
}

function renderKeyboard() {
    const kb = document.getElementById('keyboard'); 
    if (kb.children.length > 0) return;
    TILE_DEFS.forEach(def => {
        const row = document.createElement('div'); row.className = 'suit-row'; const limit = def.names ? def.names.length : def.count;
        for (let i = 0; i < limit; i++) {
            const id = def.startId + i; const btn = document.createElement('div'); btn.className = `tile ${def.type}`; btn.style.backgroundImage = `url('tiles/${def.type}${i + 1}.svg')`;
            attachFastClick(btn, () => addTile(id), 'is-tapped-tile'); row.appendChild(btn);
        }
        kb.appendChild(row);
    });
}

function getTileInfo(id) {
    if (id < 9) return { type: 'w', num: id + 1, suit: '萬' }; if (id < 18) return { type: 't', num: id - 8, suit: '筒' }; if (id < 27) return { type: 's', num: id - 17, suit: '索' };
    const zNames = ['東','南','西','北','中','發','白']; return { type: 'z', num: zNames[id - 27], suit: '' };
}

function findAllMelds(counts, index, currentMelds, allValidMelds) {
    if (currentMelds.length === 4) {
        let isValid = true; for (let i = 0; i < 34; i++) { if (counts[i] !== 0) { isValid = false; break; } }
        if (isValid) allValidMelds.push([...currentMelds]); return;
    }
    while (index < 34 && counts[index] === 0) index++; if (index === 34) return;
    if (counts[index] >= 4) { counts[index] -= 4; currentMelds.push({ type: 'kong', val: index }); findAllMelds(counts, index, currentMelds, allValidMelds); currentMelds.pop(); counts[index] += 4; }
    if (counts[index] >= 3) { counts[index] -= 3; currentMelds.push({ type: 'pong', val: index }); findAllMelds(counts, index, currentMelds, allValidMelds); currentMelds.pop(); counts[index] += 3; }
    if (index < 27 && index % 9 <= 6) {
        if (counts[index] > 0 && counts[index+1] > 0 && counts[index+2] > 0) {
            counts[index]--; counts[index+1]--; counts[index+2]--; currentMelds.push({ type: 'chow', start: index });
            findAllMelds(counts, index, currentMelds, allValidMelds); counts[index]++; counts[index+1]++; counts[index+2]++; currentMelds.pop();
        }
    }
}

function getCurrentMax() {
    let counts = new Array(34).fill(0); hand.forEach(item => counts[item.id]++);
    let kongs = 0; counts.forEach(c => { if (c === 4) kongs++; }); let max = 14 + kongs;
    if (hand.length >= 14) { let tempCounts = [...counts]; if (checkWinCondition(tempCounts)) return hand.length; }
    return max;
}

function checkWinCondition(counts) {
    if (isThirteenOrphans(counts) || isNineGates(counts)) return true;
    if (activeConditions.has('heaven') || activeConditions.has('earth')) return true; 
    for (let i = 0; i < 34; i++) {
        if (counts[i] >= 2) { let tempCounts = [...counts]; tempCounts[i] -= 2; let allValidMelds = []; findAllMelds(tempCounts, 0, [], allValidMelds); if (allValidMelds.length > 0) return true; }
    }
    return false;
}

// ==== 狀態切換引擎 (全域高度鎖定版) ====
function transitionToWaitState(defaultHtml) {
    displaySeq++; 
    const wasInResultMode = document.body.className.includes('mode');
    
    const updateWaitDOM = () => {
        const statusCard = document.getElementById('statusCard');
        statusCard.classList.remove('glow-epic', 'glow-fail');
        statusCard.classList.add('glow-normal');

        document.getElementById('statusTitle').innerText = '等待輸入手牌'; 
        document.getElementById('statusTitle').style.color = '#64748b';
        document.body.className = ''; 
        
        const scoreElement = document.getElementById('scoreValue');
        scoreElement.innerText = '--';
        scoreElement.style.fontSize = '64px';
        
        // 🌟 核心防護：清空時強制重置特效，並鎖定行高為 64px 避免塌陷
        scoreElement.classList.remove('heartbeat-pop', 'baau-pang-text');
        scoreElement.style.fontWeight = '300';
        scoreElement.style.lineHeight = '64px'; 
        
        const faanUnit = scoreElement.nextElementSibling;
        if (faanUnit) faanUnit.style.display = 'inline';

        document.getElementById('patternDisplay').innerHTML = defaultHtml;
        document.getElementById('statusCard').classList.remove('content-fade-out');
        lastTagsHtml = defaultHtml;
    };

    if (wasInResultMode) {
        document.getElementById('statusCard').classList.add('content-fade-out');
        setTimeout(() => { smoothHeightUpdate('statusCard', updateWaitDOM); }, 250); 
    } else {
        if (lastTagsHtml !== defaultHtml) { smoothHeightUpdate('statusCard', updateWaitDOM); } 
        else { updateWaitDOM(); }
    }
}

function checkAndRunEngine() {
    let currentMax = getCurrentMax();
    if (activeFlowers.size >= 7 || hand.length === currentMax) runEngine();
    else {
        let defaultHtml = `<span class="pattern-tag" style="opacity: 1; transform: none; animation: none;">請選取 ${currentMax} 張牌</span>`;
        transitionToWaitState(defaultHtml);
    }
}

function addTile(id) {
    let count = hand.filter(t => t.id === id).length; if (count >= 4) return; 
    hand.push({ id: id, key: tileKeyCounter++ }); let projectedMax = getCurrentMax(); if (hand.length > projectedMax) { hand.pop(); tileKeyCounter--; return; }
    hand.sort((a, b) => a.id - b.id); if (navigator.vibrate) navigator.vibrate([8]); renderHand();
}

function removeTile(index) { hand.splice(index, 1); if (navigator.vibrate) navigator.vibrate([8]); renderHand(); }

function renderHand() {
    const grid = document.getElementById('handGrid'); let currentMax = getCurrentMax(); const oldPos = {};
    grid.querySelectorAll('.tile[data-key]').forEach(el => { 
        oldPos[el.dataset.key] = el.getBoundingClientRect(); 
        el.classList.remove('breathing'); 
    });

    const updateGridDOM = () => {
        const existingTiles = new Map(); grid.querySelectorAll('.tile[data-key]').forEach(el => { existingTiles.set(el.dataset.key, el); });
        grid.querySelectorAll('.tile.empty').forEach(el => el.remove());

        hand.forEach((item) => {
            let el = existingTiles.get(String(item.key));
            if (!el) {
                const info = getTileInfo(item.id); el = document.createElement('div'); el.className = `tile ${info.type} enter-anim`; el.dataset.key = item.key;
                let imgNum = info.num; if (info.type === 'z') { const zNames = ['東','南','西','北','中','發','白']; imgNum = zNames.indexOf(info.num) + 1; }
                el.style.backgroundImage = `url('tiles/${info.type}${imgNum}.svg')`;
            }
            attachFastClick(el, () => { const currentIdx = hand.findIndex(t => t.key === item.key); if (currentIdx > -1) removeTile(currentIdx); }, 'is-tapped-tile');
            grid.appendChild(el); 
        });
        
        existingTiles.forEach((el, key) => { if (!hand.find(t => String(t.key) === key)) el.remove(); });
        for (let i = hand.length; i < currentMax; i++) {
            const empty = document.createElement('div'); empty.className = 'tile empty';
            if (i >= lastMax && currentMax > lastMax) { empty.classList.add('empty-enter-anim'); } grid.appendChild(empty);
        }
        document.getElementById('tileCount').innerText = `暗牌已選 ${hand.length} / ${currentMax}`;
    };

    if (lastMax !== currentMax) smoothHeightUpdate('handCard', updateGridDOM); else updateGridDOM();

    grid.querySelectorAll('.tile[data-key]').forEach(el => {
        const key = el.dataset.key;
        if (oldPos[key]) {
            el.classList.remove('enter-anim'); 
            const newRect = el.getBoundingClientRect(); const oldRect = oldPos[key];
            const dx = oldRect.left - newRect.left; const dy = oldRect.top - newRect.top;
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                el.style.transition = 'none'; el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; el.offsetHeight; 
                el.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'; el.style.transform = 'translate3d(0,0,0)'; 
                setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 250); 
            } else { el.style.transition = ''; el.style.transform = ''; }
        }
    });
    
    setTimeout(() => {
        grid.querySelectorAll('.tile[data-key]').forEach((el, index) => {
            el.style.animationDelay = `${index * 0.15}s`;
            el.classList.add('breathing');
        });
    }, 300);

    lastMax = currentMax; checkAndRunEngine();
}

function clearHand() {
    if (window.isClearing) return; 
    if (hand.length === 0 && activeConditions.size === 0 && activeFlowers.size === 0 && roundWind === 0 && seatWind === 0) return;
    window.isClearing = true; if (navigator.vibrate) navigator.vibrate([15]);

    const currentTiles = document.querySelectorAll('#handGrid .tile:not(.empty)'); const oldMax = getCurrentMax(); 

    currentTiles.forEach((el, index) => {
        const rect = el.getBoundingClientRect(); const clone = el.cloneNode(true); clone.classList.remove('enter-anim'); clone.classList.remove('breathing');
        clone.style.position = 'fixed'; clone.style.left = `${rect.left}px`; clone.style.top = `${rect.top}px`; clone.style.width = `${rect.width}px`; clone.style.height = `${rect.height}px`; clone.style.margin = '0'; clone.style.zIndex = '999'; clone.style.transition = 'none'; 
        
        clone.style.animation = `popOut 0.35s cubic-bezier(0.36, 0, 0.66, -0.56) forwards`; 
        clone.style.animationDelay = `${index * 0.025}s`;
        clone.style.willChange = 'transform, opacity';

        document.body.appendChild(clone); 
        setTimeout(() => clone.remove(), 400 + index * 25);
    });

    activeConditions.clear(); activeFlowers.clear(); roundWind = 0; seatWind = 0; 
    updateIslandSummary(); 
    
    document.querySelectorAll('.flower-tile.active').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#roundWindSelector .wind-btn, #seatWindSelector .wind-btn').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#roundWindSelector .wind-btn')[0].classList.add('active'); document.querySelectorAll('#seatWindSelector .wind-btn')[0].classList.add('active');

    hand = []; lastTagsHtml = '';
    
    transitionToWaitState('<span class="pattern-tag" style="opacity: 1; transform: none; animation: none;">請選取 14 張牌</span>');
    document.getElementById('flowerCount').innerText = `已選 0 隻`;

    const grid = document.getElementById('handGrid'); grid.innerHTML = '';
    for (let i = 0; i < oldMax; i++) { const empty = document.createElement('div'); empty.className = 'tile empty'; grid.appendChild(empty); }
    document.getElementById('tileCount').innerText = `暗牌已選 0 / 14`;

    setTimeout(() => { lastMax = oldMax; renderHand(); window.isClearing = false; }, 400 + (currentTiles.length * 25));
}

function getExtras(counts) {
    let faan = 0; let tags = []; let fCount = activeFlowers.size;
    if (fCount === 0) { faan += 1; tags.push({ text: "無花 (1番)", isFlower: true }); } 
    else if (fCount === 8) { faan += 8; tags.push({ text: "大花胡/八仙過海 (8番)", isHigh: true, isFlower: true }); } 
    else if (fCount === 7) { faan += 3; tags.push({ text: "花胡 (3番)", isFlower: true }); } 
    else {
        let hasSeasonSet = ['s1','s2','s3','s4'].every(id => activeFlowers.has(id)); let hasPlantSet = ['p1','p2','p3','p4'].every(id => activeFlowers.has(id));
        if (hasSeasonSet) { faan += 2; tags.push({ text: "一台花 [春夏秋冬] (2番)", isFlower: true }); } if (hasPlantSet) { faan += 2; tags.push({ text: "一台花 [梅蘭菊竹] (2番)", isFlower: true }); }
        if (!hasSeasonSet && activeFlowers.has(`s${seatWind + 1}`)) { faan += 1; tags.push({ text: "正花 (1番)", isFlower: true }); } if (!hasPlantSet && activeFlowers.has(`p${seatWind + 1}`)) { faan += 1; tags.push({ text: "正花 (1番)", isFlower: true }); }
    }
    let condFaan = 0;
    CONDITIONS.forEach(cond => {
        if (cond.id === 'heaven' || cond.id === 'earth') return;
        if (activeConditions.has(cond.id) && cond.faan) {
            if (cond.id === 'selfDrawn' && (activeConditions.has('kongSelfDrawn') || activeConditions.has('doubleKongSelfDrawn') || activeConditions.has('lastTile'))) return;
            condFaan += cond.faan; tags.push({ text: cond.label, isHigh: cond.faan >= 5 });
        }
    });
    faan += condFaan; return { faan, tags };
}

function isNineGates(counts) {
    let sum = 0; for(let i=0; i<34; i++) sum += counts[i]; if (sum !== 14) return false;
    for (let s = 0; s < 3; s++) {
        let start = s * 9; let suitSum = 0; for (let i=0; i<9; i++) suitSum += counts[start+i];
        if (suitSum === 14) { let base = [3,1,1,1,1,1,1,1,3]; let isValid = true; for(let i=0; i<9; i++) if (counts[start+i] < base[i]) isValid = false; if (isValid) return true; }
    }
    return false;
}

function isThirteenOrphans(counts) {
    let sum = 0; for(let i=0; i<34; i++) sum += counts[i]; if (sum !== 14) return false;
    const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; let hasPair = false;
    for (let id of orphans) { if (counts[id] === 0) return false; if (counts[id] === 2) hasPair = true; }
    return hasPair;
}

function runEngine() {
    let counts = new Array(34).fill(0); hand.forEach(item => counts[item.id]++); let fCount = activeFlowers.size;
    
    if (fCount === 8) return displayResult(8, [{ text: "大花胡/八仙過海 (8番)", isHigh: true, isFlower: true }], true);
    
    let currentMax = getCurrentMax(); let specialFaan = 0; let specialTags = []; let isSpecial = false;

    if (hand.length === currentMax) {
        if (activeConditions.has('heaven')) { specialFaan = 13; specialTags.push({ text: "天糊 (13番)", isHigh: true }); isSpecial = true; }
        else if (activeConditions.has('earth')) { specialFaan = 13; specialTags.push({ text: "地糊 (13番)", isHigh: true }); isSpecial = true; }
        else if (isThirteenOrphans(counts)) { specialFaan = 13; specialTags.push({ text: "十三么 (13番)", isHigh: true }); isSpecial = true; }
        else if (isNineGates(counts)) { specialFaan = 13; specialTags.push({ text: "九子連環 (13番)", isHigh: true }); isSpecial = true; }
    }
    if (isSpecial) return displayResult(specialFaan, specialTags, true);

    let validBreakdowns = [];
    if (hand.length === currentMax) {
        for (let i = 0; i < 34; i++) {
            if (counts[i] >= 2) {
                let tempCounts = [...counts]; tempCounts[i] -= 2; let allValidMelds = []; findAllMelds(tempCounts, 0, [], allValidMelds);
                for (let melds of allValidMelds) { validBreakdowns.push({ eye: i, melds: melds }); }
            }
        }
    }
    
    if (validBreakdowns.length === 0) {
        if (fCount === 7) return displayResult(3, [{ text: "花糊 (3番)", isFlower: true }], true);
        if (hand.length < currentMax) return; 
        return displayResult(0, [{ text: "未成糊牌結構 (詐糊)", isHigh: false }], false);
    }

    let bestResult = { faan: -1, tags: [] };
    for (let breakdown of validBreakdowns) { 
        let res = evaluateStandardPatterns(breakdown, counts); 
        if (res.faan > bestResult.faan) bestResult = res; 
    }
    
    if (bestResult.faan < 3) {
        let zaWuTags = [...bestResult.tags, { text: "不足三番起糊 (詐糊)", isHigh: false }];
        return displayResult(bestResult.faan, zaWuTags, false);
    }

    displayResult(bestResult.faan, bestResult.tags, true);
}

function evaluateStandardPatterns(breakdown, counts) {
    let faan = 0; let tags = []; let isExceptional = false; let kongsCount = 0; for (let i = 0; i < 34; i++) { if (counts[i] === 4) kongsCount++; }
    let suits = new Set(); let hasZ = false; for (let i = 0; i < 34; i++) { if (counts[i] > 0) { if (i < 9) suits.add('w'); else if (i < 18) suits.add('t'); else if (i < 27) suits.add('s'); else hasZ = true; } }

    if (suits.size === 0 && hasZ) { faan += 10; tags.push({ text: "字一色 (10番)", isHigh: true }); isExceptional = true; } 
    else if (suits.size === 1) { if (kongsCount < 4) { if (!hasZ) { faan += 7; tags.push({ text: "清一色 (7番)", isHigh: true }); } else { faan += 3; tags.push({ text: "混一色 (3番)", isHigh: false }); } } }

    const isAllPongs = breakdown.melds.every(m => m.type === 'pong' || m.type === 'kong'); const isAllChows = breakdown.melds.every(m => m.type === 'chow');

    if (isAllPongs) {
        let isAllTerminals = true; for (let i = 0; i < 34; i++) { if (counts[i] > 0 && i < 27 && (i % 9 !== 0 && i % 9 !== 8)) isAllTerminals = false; }
        if (isAllTerminals && !hasZ) { faan += 10; tags.push({ text: "清么九 (10番)", isHigh: true }); isExceptional = true; } 
        else if (isAllTerminals && hasZ) { if (kongsCount < 4) { faan += 4; tags.push({ text: "花么九 (4番)", isHigh: false }); } } 
        else if (activeConditions.has('concealed') && kongsCount < 4) { faan += 8; tags.push({ text: "坎坎糊 (8番)", isHigh: true }); isExceptional = true; } 
        else if (kongsCount < 4) { faan += 3; tags.push({ text: "對對糊 (3番)", isHigh: false }); }
        if (kongsCount === 4) { faan += 13; tags.push({ text: "十八羅漢 (13番)", isHigh: true }); isExceptional = true; }
    } else if (isAllChows) { faan += 1; tags.push({ text: "平糊 (1番)", isHigh: false }); }

    let dPongs = 0, dEyes = 0; [31, 32, 33].forEach(id => { if (counts[id] >= 3) dPongs++; else if (counts[id] === 2) dEyes++; });
    if (dPongs === 3) { faan += 8; tags.push({ text: "大三元 (8番)", isHigh: true }); isExceptional = true; } else if (dPongs === 2 && dEyes === 1) { faan += 5; tags.push({ text: "小三元 (5番)", isHigh: false }); } else if (dPongs > 0) { if (counts[31] >= 3) { faan += 1; tags.push({ text: "紅中 (1番)", isHigh: false }); } if (counts[32] >= 3) { faan += 1; tags.push({ text: "發財 (1番)", isHigh: false }); } if (counts[33] >= 3) { faan += 1; tags.push({ text: "白板 (1番)", isHigh: false }); } } 

    let wPongs = 0, wEyes = 0; [27, 28, 29, 30].forEach(id => { if (counts[id] >= 3) wPongs++; else if (counts[id] === 2) wEyes++; });
    if (wPongs === 4) { faan += 13; tags.push({ text: "大四喜 (13番)", isHigh: true }); isExceptional = true; } else if (wPongs === 3 && wEyes === 1) { faan += 6; tags.push({ text: "小四喜 (6番)", isHigh: true }); isExceptional = true; } else {
        if (!isExceptional) { let roundWindId = 27 + roundWind; let seatWindId = 27 + seatWind; let windNames = ['東', '南', '西', '北']; if (counts[roundWindId] >= 3) { faan += 1; tags.push({ text: `${windNames[roundWind]}圈 (1番)`, isWind: true }); } if (counts[seatWindId] >= 3) { faan += 1; tags.push({ text: `${windNames[seatWind]}位 (1番)`, isWind: true }); } }
    }

    if (!isExceptional) { let extras = getExtras(counts); faan += extras.faan; tags.push(...extras.tags); }
    if (faan === 0 && !isExceptional) tags.push({ text: "雞糊 (0番)", isHigh: false });
    return { faan, tags }; 
}

// ==== ✨ v2.8.20 顯示引擎 (全域外框高度鎖定 + 稀有度標籤版) ====
function displayResult(faan, tags, isWin) {
    displaySeq++;
    const seq = displaySeq; 

    const isZaWu = !isWin && hand.length === getCurrentMax(); 
    const isBaauPang = isWin && faan >= 13;
    const isEpic = isBaauPang || tags.some(t => typeof t === 'object' && t.isHigh);

    const updateStatusDOM = () => {
        const statusCard = document.getElementById('statusCard');
        const titleElement = document.getElementById('statusTitle');
        
        statusCard.classList.remove('glow-normal', 'glow-epic', 'glow-fail');
        if (isZaWu) {
            statusCard.classList.add('glow-fail');
            titleElement.innerText = '🚨 判定失敗 🚨';
            titleElement.style.color = '#ef4444';
        } else if (isEpic) {
            statusCard.classList.add('glow-epic');
            titleElement.innerText = '✨ 極限爆棚 ✨';
            titleElement.style.color = '#eab308';
        } else if (isWin) {
            statusCard.classList.add('glow-normal');
            titleElement.innerText = '計算完成';
            titleElement.style.color = '#475569';
        }

        document.body.className = ''; 
        if (isZaWu) document.body.classList.add('failure-mode'); 
        else if (isBaauPang) document.body.classList.add('limit-mode'); 
        else if (isWin) document.body.classList.add('success-mode'); 

        const scoreElement = document.getElementById('scoreValue');
        const faanUnit = scoreElement.nextElementSibling;
        
        // 🌟 核心防護：每次重新計算時，鎖定行高為 64px
        scoreElement.classList.remove('heartbeat-pop', 'baau-pang-text');
        scoreElement.style.fontWeight = '300';
        scoreElement.style.lineHeight = '64px'; 
        
        if (isZaWu) { scoreElement.innerText = '--'; scoreElement.style.fontSize = '50px'; } 
        else { scoreElement.innerText = '0'; scoreElement.style.fontSize = '64px'; }
        
        if (faanUnit) faanUnit.style.display = 'inline';

        const patternDisplay = document.getElementById('patternDisplay');
        patternDisplay.innerHTML = '';
        
        tags.forEach(t => {
            let text = typeof t === 'string' ? t : t.text;
            let isHigh = typeof t === 'object' && t.isHigh;
            let epicClass = isHigh ? 'epic-tag' : ''; 
            let fl = t.isFlower ? 'flower' : ''; 
            let wd = t.isWind ? 'wind' : ''; 
            
            const span = document.createElement('span');
            
            // 🌟 提取番數數值
            const match = text.match(/\((\d+)番\)/);
            const faanValue = match ? parseInt(match[1]) : 0;
            span.dataset.stepFaan = faanValue;
            
            // 🌟 根據番數自動賦予稀有度階級 (Tier)
            let tierClass = 'tier-common'; 
            if (faanValue >= 10) {
                tierClass = 'tier-legendary';
            } else if (faanValue >= 7) {
                tierClass = 'tier-epic';
            } else if (faanValue >= 3) {
                tierClass = 'tier-rare';
            }
            
            span.className = `pattern-tag hide-tag ${epicClass} ${fl} ${wd} ${tierClass}`;
            span.innerText = text;
            
            patternDisplay.appendChild(span);
        });
        statusCard.classList.remove('content-fade-out');
    };

    const tempHtml = tags.map(t => typeof t === 'string' ? t : t.text).join('');
    if (tempHtml !== lastTagsHtml) { smoothHeightUpdate('statusCard', updateStatusDOM); lastTagsHtml = tempHtml; } 
    else { updateStatusDOM(); }

    setTimeout(async () => {
        if (seq !== displaySeq) return;
        
        const scoreElement = document.getElementById('scoreValue');
        const faanUnit = scoreElement.nextElementSibling;
        const spans = document.getElementById('patternDisplay').querySelectorAll('.pattern-tag');
        let currentScore = 0;

        for (let i = 0; i < spans.length; i++) {
            if (seq !== displaySeq) return; 
            
            const span = spans[i];
            span.classList.remove('hide-tag');
            span.classList.add('pop-in-tag'); 

            if (isWin) {
                currentScore += parseInt(span.dataset.stepFaan || 0);
                if (i === spans.length - 1) currentScore = faan; 

                if (isBaauPang && i === spans.length - 1) {
                    scoreElement.innerText = '爆棚';
                    scoreElement.style.fontSize = '56px'; 
                    scoreElement.style.fontWeight = '600'; 
                    scoreElement.style.lineHeight = '64px'; // 爆棚鎖定
                    if (faanUnit) faanUnit.style.display = 'none';
                } else {
                    scoreElement.innerText = currentScore;
                }
                
                if (navigator.vibrate) navigator.vibrate([10]); 
            }
            await new Promise(r => setTimeout(r, 150)); 
        }

        if (seq !== displaySeq) return;
        
        if (isZaWu) {
            scoreElement.innerText = '詐糊';
            scoreElement.style.fontSize = '50px';
            scoreElement.style.fontWeight = '600'; 
            scoreElement.style.lineHeight = '64px'; // 詐糊鎖定
            if (faanUnit) faanUnit.style.display = 'none'; // 隱藏番字
            
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        } else {
            if (isBaauPang) {
                scoreElement.classList.add('baau-pang-text');
                if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);
            } else {
                scoreElement.classList.add('heartbeat-pop');
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            }
        }
    }, 300); 
}

// 🔥 v2.8.0 輕量級邊緣光暈引擎
const topGlow = document.getElementById('topGlow');
const bottomGlow = document.getElementById('bottomGlow');
let edgeStartY = 0;

document.addEventListener('touchstart', function(e) {
    edgeStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - edgeStartY;
    const currentScroll = window.scrollY;
    
    const isAtTop = currentScroll <= 0 && deltaY > 0;
    const isAtBottom = (window.innerHeight + currentScroll) >= document.body.offsetHeight - 2 && deltaY < 0;

    if (isAtTop) {
        if (e.cancelable) e.preventDefault();
        topGlow.classList.add('is-pulling');
    } else if (isAtBottom) {
        if (e.cancelable) e.preventDefault();
        bottomGlow.classList.add('is-pulling');
    } else {
        topGlow.classList.remove('is-pulling');
        bottomGlow.classList.remove('is-pulling');
    }
}, { passive: false });

document.addEventListener('touchend', function() {
    topGlow.classList.remove('is-pulling');
    bottomGlow.classList.remove('is-pulling');
});

document.addEventListener('gesturestart', function(event) { event.preventDefault(); });
document.addEventListener('gesturechange', function(event) { event.preventDefault(); });
document.addEventListener('gestureend', function(event) { event.preventDefault(); });
let lastTouchEnd = 0; document.addEventListener('touchend', function(event) { const now = (new Date()).getTime(); if (now - lastTouchEnd <= 300) { event.preventDefault(); } lastTouchEnd = now; }, { passive: false });

init();