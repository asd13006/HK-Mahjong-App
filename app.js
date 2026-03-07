/* ==========================================
   🧠 香港麻雀計番神器 - 核心運作大腦 (app.js)
   ==========================================
   【目錄導覽】
   您可以利用搜尋功能 (Ctrl+F / Cmd+F) 加上「區塊名稱」，快速跳到指定位置：

   ▶ 區塊一：全局變數與狀態 (設定分數、選擇的牌等)
   ▶ 區塊二：手牌輸入系統 (點擊麻將牌、顯示在畫面上)
   ▶ 區塊三：番數計算引擎 (判斷平糊、對對糊等核心邏輯)
   ▶ 區塊四：結算與戰績系統 (顯示結果、儲存勝率)
   ▶ 區塊五：麻雀百科系統 (生成番種列表、詳情頁動畫)
   ▶ 區塊六：個人中心與設定 (清除暫存、顯示版本號)
   ========================================== */

const APP_VERSION = "v2.8.41";

let newWorker; window.isUpdateReady = false; let displaySeq = 0; let currentResultSnapshot = null;

function attachFastClick(el, action, tapClass = '') {
    if (el._hasFastClick) { el._action = action; return; }
    el._action = action; el._hasFastClick = true; let touchHandled = false; let isScrolling = false; let startX = 0; let startY = 0;
    el.addEventListener('touchstart', (e) => { touchHandled = true; isScrolling = false; startX = e.touches[0].clientX; startY = e.touches[0].clientY; if(tapClass) el.classList.add(tapClass); }, { passive: true });
    el.addEventListener('touchmove', (e) => { if(!touchHandled) return; let moveX = Math.abs(e.touches[0].clientX - startX); let moveY = Math.abs(e.touches[0].clientY - startY); if (moveX > 10 || moveY > 10) { isScrolling = true; if(tapClass) el.classList.remove(tapClass); } }, { passive: true });
    el.addEventListener('touchend', (e) => { if(tapClass) el.classList.remove(tapClass); if (touchHandled && !isScrolling) { if (el._action) el._action(e); } setTimeout(() => { touchHandled = false; }, 400); });
    el.addEventListener('mousedown', (e) => { if (e.button !== 0) return; if (!touchHandled) { if(tapClass) { el.classList.add(tapClass); setTimeout(() => el.classList.remove(tapClass), 100); } if (el._action) el._action(e); } });
    el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
}

function smoothHeightUpdate(elementId, updateDOM) {
    const el = document.getElementById(elementId); if (!el) { updateDOM(); return; }
    const oldHeight = el.offsetHeight; updateDOM(); el.style.height = 'auto'; const newHeight = el.offsetHeight;
    if (oldHeight !== newHeight && oldHeight > 0) { el.style.height = oldHeight + 'px'; const oldOverflow = el.style.overflow; el.style.overflow = 'hidden'; el.style.willChange = 'height'; el.offsetHeight; el.style.transition = 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'; el.style.height = newHeight + 'px'; setTimeout(() => { el.style.height = 'auto'; el.style.transition = ''; el.style.overflow = oldOverflow; el.style.willChange = 'auto'; }, 300); }
}

function switchPage(targetId) {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if (targetNav) targetNav.classList.add('active');
    document.getElementById(targetId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // ✨ 如果切換到個人中心，自動更新成就與數據
    if(targetId === 'page-profile') updateProfileData();
}

function setupNavigation() { document.querySelectorAll('.nav-item').forEach(item => { attachFastClick(item, () => { if (item.classList.contains('active')) return; if (navigator.vibrate) navigator.vibrate([10]); switchPage(item.getAttribute('data-target')); }, 'is-tapped-chip'); }); }

const TILE_DEFS = [ { type: 'w', label: '萬', count: 9, startId: 0 }, { type: 't', label: '筒', count: 9, startId: 9 }, { type: 's', label: '索', count: 9, startId: 18 }, { type: 'z', names: ['東','南','西','北','中','發','白'], startId: 27 } ];
const CONDITIONS = [ { id: 'selfDrawn', label: '自摸 (1番)', faan: 1 }, { id: 'concealed', label: '門前清 (1番)', faan: 1 }, { id: 'lastTile', label: '海底撈月 (1番)', faan: 1 }, { id: 'kongSelfDrawn', label: '槓上自摸 (2番)', faan: 2 }, { id: 'doubleKongSelfDrawn', label: '槓上槓自摸 (8番)', faan: 8 }, { id: 'robKong', label: '搶槓 (1番)', faan: 1 }, { id: 'heaven', label: '天糊 (13番)' }, { id: 'earth', label: '地糊 (13番)' } ];
const FLOWERS = [ { id: 's1', name: '春', group: 'season', wind: 0 }, { id: 's2', name: '夏', group: 'season', wind: 1 }, { id: 's3', name: '秋', group: 'season', wind: 2 }, { id: 's4', name: '冬', group: 'season', wind: 3 }, { id: 'p1', name: '梅', group: 'plant', wind: 0 }, { id: 'p2', name: '蘭', group: 'plant', wind: 1 }, { id: 'p3', name: '菊', group: 'plant', wind: 2 }, { id: 'p4', name: '竹', group: 'plant', wind: 3 } ];

let hand = []; let activeConditions = new Set(); let roundWind = 0; let seatWind = 0; let activeFlowers = new Set(); let tileKeyCounter = 0; let lastMax = 14; 

function init() { 
    renderConditions(); renderFlowers(); renderKeyboard(); renderHand(); 
    document.getElementById('appVersionProfile').innerText = APP_VERSION;
    
    attachFastClick(document.getElementById('islandHeaderBtn'), () => { document.getElementById('conditionsIsland').classList.toggle('expanded'); if (navigator.vibrate) navigator.vibrate([5]); }, 'is-tapped-island');
    document.querySelectorAll('#roundWindSelector .wind-tab').forEach((tab, i) => attachFastClick(tab, () => setRoundWind(i), 'is-tapped-chip'));
    document.querySelectorAll('#seatWindSelector .wind-tab').forEach((tab, i) => attachFastClick(tab, () => setSeatWind(i), 'is-tapped-chip'));
    attachFastClick(document.getElementById('clearBtnId'), clearHand, 'is-tapped-chip');
    attachFastClick(document.getElementById('calcBtn'), () => { if (navigator.vibrate) navigator.vibrate([20, 30, 20]); switchPage('page-result'); runEngine(); }, 'is-tapped-chip');
    attachFastClick(document.getElementById('backToInputBtn'), () => { if (navigator.vibrate) navigator.vibrate([10]); switchPage('page-input'); resetResultCard(); }, 'is-tapped-chip');
    attachFastClick(document.getElementById('saveHistoryBtn'), saveHistory, 'is-tapped-chip');
    attachFastClick(document.getElementById('clearHistoryBtn'), () => { if(confirm('⚠️ 確定要清空所有生涯戰績嗎？這個動作無法復原喔！')) { localStorage.removeItem('mahjongHistory'); renderHistory(); updateProfileData(); } }, 'is-tapped-chip');
    attachFastClick(document.getElementById('btnSystemClear'), () => { if(confirm('⚠️ 確定要清除系統暫存嗎？這會重置介面，但不會刪除戰績。')) { window.location.reload(true); } }, 'is-tapped-chip');
    
    // 百科詳情頁返回按鈕
    attachFastClick(document.getElementById('btnBackToWiki'), () => { 
        if (navigator.vibrate) navigator.vibrate([10]);
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById('page-wiki').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 'is-tapped-chip');

    // ✨ 新增：為百科搜尋框裝上即時監聽雷達
    const searchInput = document.getElementById('wikiSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            // 找出目前點擊的是哪個分類（全部 / 1-3番 / 等等）
            const activeFilter = document.querySelector('.w-filter.active').getAttribute('data-filter');
            // 把分類和輸入的字一起丟給造卡片機器
            populateWiki(activeFilter, e.target.value);
        });
    }

    updateIslandSummary(); setupNavigation(); renderHistory(); populateWiki();
}

function renderConditions() { const bar = document.getElementById('conditionsBar'); if (bar.children.length === 0) { CONDITIONS.forEach(cond => { const chip = document.createElement('div'); chip.className = 'condition-chip'; chip.id = `cond-${cond.id}`; chip.innerText = cond.label.split(' ')[0]; attachFastClick(chip, () => { if (activeConditions.has(cond.id)) { activeConditions.delete(cond.id); if (cond.id === 'selfDrawn') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); } } else { activeConditions.add(cond.id); if (cond.id === 'kongSelfDrawn' || cond.id === 'doubleKongSelfDrawn') activeConditions.add('selfDrawn'); if (cond.id === 'heaven' || cond.id === 'earth') { activeConditions.clear(); activeConditions.add(cond.id); } else { activeConditions.delete('heaven'); activeConditions.delete('earth'); } if (cond.id === 'selfDrawn') activeConditions.delete('robKong'); if (cond.id === 'robKong') activeConditions.delete('selfDrawn'); if (cond.id === 'robKong') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); activeConditions.delete('lastTile'); } if (cond.id === 'kongSelfDrawn' || cond.id === 'doubleKongSelfDrawn') { activeConditions.delete('robKong'); activeConditions.delete('lastTile'); } if (cond.id === 'lastTile') { activeConditions.delete('kongSelfDrawn'); activeConditions.delete('doubleKongSelfDrawn'); activeConditions.delete('robKong'); } if (cond.id === 'kongSelfDrawn') activeConditions.delete('doubleKongSelfDrawn'); if (cond.id === 'doubleKongSelfDrawn') activeConditions.delete('kongSelfDrawn'); } updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); }, 'is-tapped-chip'); bar.appendChild(chip); }); } }
function updateIslandSummary() { let activeLabels = []; CONDITIONS.forEach(cond => { const chip = document.getElementById(`cond-${cond.id}`); if (chip) { if (activeConditions.has(cond.id)) { chip.classList.add('active'); activeLabels.push(cond.label.split(' ')[0]); } else { chip.classList.remove('active'); } } }); const windNames = ['東', '南', '西', '北']; activeLabels.push(`${windNames[roundWind]}圈${windNames[seatWind]}位`); if (activeFlowers.size > 0) activeLabels.push(`${activeFlowers.size}花`); const title = document.getElementById('islandTitle'); const newText = activeLabels.length === 0 ? '✦ 牌局設定' : `✦ ${activeLabels.join(', ')}`; const newColor = activeLabels.length === 0 ? '#64748b' : '#3b82f6'; if (title.innerText !== newText && title.innerText !== '') { title.classList.add('slide-out'); setTimeout(() => { title.innerText = newText; title.style.color = newColor; title.classList.remove('slide-out'); title.classList.add('slide-in'); void title.offsetWidth; title.classList.remove('slide-in'); }, 200); } else { title.innerText = newText; title.style.color = newColor; } }
function setRoundWind(index) { roundWind = index; const container = document.getElementById('roundWindSelector'); container.querySelectorAll('.wind-tab').forEach((tab, i) => tab.className = `wind-tab ${i === index ? 'active' : ''}`); const glider = container.querySelector('.glass-glider'); if (glider) glider.style.transform = `translateX(${index * 100}%)`; updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); }
function setSeatWind(index) { seatWind = index; const container = document.getElementById('seatWindSelector'); container.querySelectorAll('.wind-tab').forEach((tab, i) => tab.className = `wind-tab ${i === index ? 'active' : ''}`); const glider = container.querySelector('.glass-glider'); if (glider) glider.style.transform = `translateX(${index * 100}%)`; updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); }
function renderFlowers() { const grid = document.getElementById('flowerGrid'); if (grid.children.length === 0) { FLOWERS.forEach((f, index) => { const btn = document.createElement('div'); btn.className = 'flower-tile'; btn.id = `flower-${f.id}`; if (activeFlowers.has(f.id)) btn.classList.add('active'); btn.style.backgroundImage = `url('tiles/f${index + 1}.svg')`; attachFastClick(btn, () => { if (activeFlowers.has(f.id)) activeFlowers.delete(f.id); else activeFlowers.add(f.id); btn.classList.toggle('active'); document.getElementById('flowerCount').innerText = `已選 ${activeFlowers.size} 隻`; updateIslandSummary(); if (navigator.vibrate) navigator.vibrate([10]); checkAndRunEngine(); }); grid.appendChild(btn); }); } }
function renderKeyboard() { const kb = document.getElementById('keyboard'); if (kb.children.length > 0) return; TILE_DEFS.forEach(def => { const row = document.createElement('div'); row.className = 'suit-row'; const limit = def.names ? def.names.length : def.count; for (let i = 0; i < limit; i++) { const id = def.startId + i; const btn = document.createElement('div'); btn.className = `tile ${def.type}`; btn.style.backgroundImage = `url('tiles/${def.type}${i + 1}.svg')`; attachFastClick(btn, () => addTile(id), 'is-tapped-tile'); row.appendChild(btn); } kb.appendChild(row); }); }
function getTileInfo(id) { if (id < 9) return { type: 'w', num: id + 1, suit: '萬' }; if (id < 18) return { type: 't', num: id - 8, suit: '筒' }; if (id < 27) return { type: 's', num: id - 17, suit: '索' }; const zNames = ['東','南','西','北','中','發','白']; return { type: 'z', num: zNames[id - 27], suit: '' }; }
function findAllMelds(counts, index, currentMelds, allValidMelds) { if (currentMelds.length === 4) { let isValid = true; for (let i = 0; i < 34; i++) { if (counts[i] !== 0) { isValid = false; break; } } if (isValid) allValidMelds.push([...currentMelds]); return; } while (index < 34 && counts[index] === 0) index++; if (index === 34) return; if (counts[index] >= 4) { counts[index] -= 4; currentMelds.push({ type: 'kong', val: index }); findAllMelds(counts, index, currentMelds, allValidMelds); currentMelds.pop(); counts[index] += 4; } if (counts[index] >= 3) { counts[index] -= 3; currentMelds.push({ type: 'pong', val: index }); findAllMelds(counts, index, currentMelds, allValidMelds); currentMelds.pop(); counts[index] += 3; } if (index < 27 && index % 9 <= 6) { if (counts[index] > 0 && counts[index+1] > 0 && counts[index+2] > 0) { counts[index]--; counts[index+1]--; counts[index+2]--; currentMelds.push({ type: 'chow', start: index }); findAllMelds(counts, index, currentMelds, allValidMelds); counts[index]++; counts[index+1]++; counts[index+2]++; currentMelds.pop(); } } }
function getCurrentMax() { let counts = new Array(34).fill(0); hand.forEach(item => counts[item.id]++); let kongs = 0; counts.forEach(c => { if (c === 4) kongs++; }); let max = 14 + kongs; if (hand.length >= 14) { let tempCounts = [...counts]; if (checkWinCondition(tempCounts)) return hand.length; } return max; }
function checkWinCondition(counts) { if (isThirteenOrphans(counts) || isNineGates(counts)) return true; if (activeConditions.has('heaven') || activeConditions.has('earth')) return true; for (let i = 0; i < 34; i++) { if (counts[i] >= 2) { let tempCounts = [...counts]; tempCounts[i] -= 2; let allValidMelds = []; findAllMelds(tempCounts, 0, [], allValidMelds); if (allValidMelds.length > 0) return true; } } return false; }
function resetResultCard() { document.getElementById('resultHeroCard').className = 'glass-card result-hero'; document.getElementById('resultBadge').className = 'result-badge'; document.getElementById('resultBadge').innerText = '等待中'; document.body.className = ''; document.getElementById('heroScoreValue').innerText = '--'; document.getElementById('heroScoreValue').classList.remove('baau-pang-text'); document.getElementById('heroScoreUnit').style.display = 'inline'; document.getElementById('heroMainPatternName').innerText = '--'; document.getElementById('heroMainPatternName').style.color = '#10b981'; document.getElementById('resRoundWind').innerText = '--'; document.getElementById('resSeatWind').innerText = '--'; document.getElementById('resFlowers').innerText = '--'; document.getElementById('detailList').innerHTML = '<div class="detail-empty">尚未結算</div>'; currentResultSnapshot = null; }
function checkAndRunEngine() { let currentMax = getCurrentMax(); const actionText = document.getElementById('actionText'); const calcBtn = document.getElementById('calcBtn'); if (activeFlowers.size >= 7 || hand.length === currentMax) { actionText.style.display = 'none'; calcBtn.style.display = 'block'; } else { actionText.style.display = 'block'; calcBtn.style.display = 'none'; actionText.innerText = `請選取 ${currentMax} 張牌`; } }
function addTile(id) { let count = hand.filter(t => t.id === id).length; if (count >= 4) return; hand.push({ id: id, key: tileKeyCounter++ }); let projectedMax = getCurrentMax(); if (hand.length > projectedMax) { hand.pop(); tileKeyCounter--; return; } hand.sort((a, b) => a.id - b.id); if (navigator.vibrate) navigator.vibrate([8]); renderHand(); }
function removeTile(index) { hand.splice(index, 1); if (navigator.vibrate) navigator.vibrate([8]); renderHand(); }
function renderHand() { const grid = document.getElementById('handGrid'); let currentMax = getCurrentMax(); const oldPos = {}; grid.querySelectorAll('.tile[data-key]').forEach(el => { oldPos[el.dataset.key] = el.getBoundingClientRect(); el.classList.remove('breathing'); }); const updateGridDOM = () => { const existingTiles = new Map(); grid.querySelectorAll('.tile[data-key]').forEach(el => { existingTiles.set(el.dataset.key, el); }); grid.querySelectorAll('.tile.empty').forEach(el => el.remove()); hand.forEach((item) => { let el = existingTiles.get(String(item.key)); if (!el) { const info = getTileInfo(item.id); el = document.createElement('div'); el.className = `tile ${info.type} enter-anim`; el.dataset.key = item.key; let imgNum = info.num; if (info.type === 'z') { const zNames = ['東','南','西','北','中','發','白']; imgNum = zNames.indexOf(info.num) + 1; } el.style.backgroundImage = `url('tiles/${info.type}${imgNum}.svg')`; } attachFastClick(el, () => { const currentIdx = hand.findIndex(t => t.key === item.key); if (currentIdx > -1) removeTile(currentIdx); }, 'is-tapped-tile'); grid.appendChild(el); }); existingTiles.forEach((el, key) => { if (!hand.find(t => String(t.key) === key)) el.remove(); }); for (let i = hand.length; i < currentMax; i++) { const empty = document.createElement('div'); empty.className = 'tile empty'; if (i >= lastMax && currentMax > lastMax) { empty.classList.add('empty-enter-anim'); } grid.appendChild(empty); } document.getElementById('tileCount').innerText = `暗牌已選 ${hand.length} / ${currentMax}`; }; if (lastMax !== currentMax) smoothHeightUpdate('handCard', updateGridDOM); else updateGridDOM(); grid.querySelectorAll('.tile[data-key]').forEach(el => { const key = el.dataset.key; if (oldPos[key]) { el.classList.remove('enter-anim'); const newRect = el.getBoundingClientRect(); const oldRect = oldPos[key]; const dx = oldRect.left - newRect.left; const dy = oldRect.top - newRect.top; if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { el.style.transition = 'none'; el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; el.offsetHeight; el.style.transition = 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'; el.style.transform = 'translate3d(0,0,0)'; setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 250); } else { el.style.transition = ''; el.style.transform = ''; } } }); setTimeout(() => { grid.querySelectorAll('.tile[data-key]').forEach((el, index) => { el.style.animationDelay = `${index * 0.15}s`; el.classList.add('breathing'); }); }, 300); lastMax = currentMax; checkAndRunEngine(); }
function clearHand() { if (window.isClearing) return; if (hand.length === 0 && activeConditions.size === 0 && activeFlowers.size === 0 && roundWind === 0 && seatWind === 0) return; window.isClearing = true; if (navigator.vibrate) navigator.vibrate([15]); const currentTiles = document.querySelectorAll('#handGrid .tile:not(.empty)'); const oldMax = getCurrentMax(); currentTiles.forEach((el, index) => { const rect = el.getBoundingClientRect(); const clone = el.cloneNode(true); clone.classList.remove('enter-anim'); clone.classList.remove('breathing'); clone.style.position = 'fixed'; clone.style.left = `${rect.left}px`; clone.style.top = `${rect.top}px`; clone.style.width = `${rect.width}px`; clone.style.height = `${rect.height}px`; clone.style.margin = '0'; clone.style.zIndex = '999'; clone.style.transition = 'none'; clone.style.animation = `popOut 0.35s cubic-bezier(0.36, 0, 0.66, -0.56) forwards`; clone.style.animationDelay = `${index * 0.025}s`; clone.style.willChange = 'transform, opacity'; document.body.appendChild(clone); setTimeout(() => clone.remove(), 400 + index * 25); }); activeConditions.clear(); activeFlowers.clear(); roundWind = 0; seatWind = 0; updateIslandSummary(); document.querySelectorAll('.flower-tile.active').forEach(el => el.classList.remove('active')); document.querySelectorAll('#roundWindSelector .wind-tab, #seatWindSelector .wind-tab').forEach(el => el.classList.remove('active')); document.querySelectorAll('#roundWindSelector .wind-tab')[0].classList.add('active'); document.querySelectorAll('#seatWindSelector .wind-tab')[0].classList.add('active'); const roundGlider = document.querySelector('#roundWindSelector .glass-glider'); if (roundGlider) roundGlider.style.transform = `translateX(0%)`; const seatGlider = document.querySelector('#seatWindSelector .glass-glider'); if (seatGlider) seatGlider.style.transform = `translateX(0%)`; hand = []; resetResultCard(); document.getElementById('flowerCount').innerText = `已選 0 隻`; const grid = document.getElementById('handGrid'); grid.innerHTML = ''; for (let i = 0; i < oldMax; i++) { const empty = document.createElement('div'); empty.className = 'tile empty'; grid.appendChild(empty); } document.getElementById('tileCount').innerText = `暗牌已選 0 / 14`; setTimeout(() => { lastMax = oldMax; renderHand(); window.isClearing = false; }, 400 + (currentTiles.length * 25)); }
function getExtras(counts) { let faan = 0; let tags = []; let fCount = activeFlowers.size; if (fCount === 0) { faan += 1; tags.push({ text: "無花 (1番)" }); } else if (fCount === 8) { faan += 8; tags.push({ text: "大花胡 (8番)" }); } else if (fCount === 7) { faan += 3; tags.push({ text: "花胡 (3番)" }); } else { let hasSeasonSet = ['s1','s2','s3','s4'].every(id => activeFlowers.has(id)); let hasPlantSet = ['p1','p2','p3','p4'].every(id => activeFlowers.has(id)); if (hasSeasonSet) { faan += 2; tags.push({ text: "一台花 [四季] (2番)" }); } if (hasPlantSet) { faan += 2; tags.push({ text: "一台花 [四君] (2番)" }); } if (!hasSeasonSet && activeFlowers.has(`s${seatWind + 1}`)) { faan += 1; tags.push({ text: "正花 (1番)" }); } if (!hasPlantSet && activeFlowers.has(`p${seatWind + 1}`)) { faan += 1; tags.push({ text: "正花 (1番)" }); } } let condFaan = 0; CONDITIONS.forEach(cond => { if (cond.id === 'heaven' || cond.id === 'earth') return; if (activeConditions.has(cond.id) && cond.faan) { if (cond.id === 'selfDrawn' && (activeConditions.has('kongSelfDrawn') || activeConditions.has('doubleKongSelfDrawn') || activeConditions.has('lastTile'))) return; condFaan += cond.faan; tags.push({ text: cond.label }); } }); faan += condFaan; return { faan, tags }; }
function isNineGates(counts) { let sum = 0; for(let i=0; i<34; i++) sum += counts[i]; if (sum !== 14) return false; for (let s = 0; s < 3; s++) { let start = s * 9; let suitSum = 0; for (let i=0; i<9; i++) suitSum += counts[start+i]; if (suitSum === 14) { let base = [3,1,1,1,1,1,1,1,3]; let isValid = true; for(let i=0; i<9; i++) if (counts[start+i] < base[i]) isValid = false; if (isValid) return true; } } return false; }
function isThirteenOrphans(counts) { let sum = 0; for(let i=0; i<34; i++) sum += counts[i]; if (sum !== 14) return false; const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]; let hasPair = false; for (let id of orphans) { if (counts[id] === 0) return false; if (counts[id] === 2) hasPair = true; } return hasPair; }
function runEngine() { let counts = new Array(34).fill(0); hand.forEach(item => counts[item.id]++); let fCount = activeFlowers.size; if (fCount === 8) return displayResult(8, [{ text: "八仙過海 (8番)" }], true); let currentMax = getCurrentMax(); let specialFaan = 0; let specialTags = []; let isSpecial = false; if (hand.length === currentMax) { if (activeConditions.has('heaven')) { specialFaan = 13; specialTags.push({ text: "天糊 (13番)" }); isSpecial = true; } else if (activeConditions.has('earth')) { specialFaan = 13; specialTags.push({ text: "地糊 (13番)" }); isSpecial = true; } else if (isThirteenOrphans(counts)) { specialFaan = 13; specialTags.push({ text: "十三么 (13番)" }); isSpecial = true; } else if (isNineGates(counts)) { specialFaan = 13; specialTags.push({ text: "九子連環 (13番)" }); isSpecial = true; } } if (isSpecial) return displayResult(specialFaan, specialTags, true); let validBreakdowns = []; if (hand.length === currentMax) { for (let i = 0; i < 34; i++) { if (counts[i] >= 2) { let tempCounts = [...counts]; tempCounts[i] -= 2; let allValidMelds = []; findAllMelds(tempCounts, 0, [], allValidMelds); for (let melds of allValidMelds) { validBreakdowns.push({ eye: i, melds: melds }); } } } } if (validBreakdowns.length === 0) { if (fCount === 7) return displayResult(3, [{ text: "花糊 (3番)" }], true); if (hand.length < currentMax) return; return displayResult(0, [{ text: "未成糊牌結構 (詐糊)" }], false); } let bestResult = { faan: -1, tags: [] }; for (let breakdown of validBreakdowns) { let res = evaluateStandardPatterns(breakdown, counts); if (res.faan > bestResult.faan) bestResult = res; } if (bestResult.faan < 3) { let zaWuTags = [...bestResult.tags, { text: "不足三番起糊 (詐糊)" }]; return displayResult(bestResult.faan, zaWuTags, false); } displayResult(bestResult.faan, bestResult.tags, true); }
function evaluateStandardPatterns(breakdown, counts) { let faan = 0; let tags = []; let isExceptional = false; let kongsCount = 0; for (let i = 0; i < 34; i++) { if (counts[i] === 4) kongsCount++; } let suits = new Set(); let hasZ = false; for (let i = 0; i < 34; i++) { if (counts[i] > 0) { if (i < 9) suits.add('w'); else if (i < 18) suits.add('t'); else if (i < 27) suits.add('s'); else hasZ = true; } } if (suits.size === 0 && hasZ) { faan += 10; tags.push({ text: "字一色 (10番)" }); isExceptional = true; } else if (suits.size === 1) { if (kongsCount < 4) { if (!hasZ) { faan += 7; tags.push({ text: "清一色 (7番)" }); } else { faan += 3; tags.push({ text: "混一色 (3番)" }); } } } const isAllPongs = breakdown.melds.every(m => m.type === 'pong' || m.type === 'kong'); const isAllChows = breakdown.melds.every(m => m.type === 'chow'); if (isAllPongs) { let isAllTerminals = true; for (let i = 0; i < 34; i++) { if (counts[i] > 0 && i < 27 && (i % 9 !== 0 && i % 9 !== 8)) isAllTerminals = false; } if (isAllTerminals && !hasZ) { faan += 10; tags.push({ text: "清么九 (10番)" }); isExceptional = true; } else if (isAllTerminals && hasZ) { if (kongsCount < 4) { faan += 4; tags.push({ text: "花么九 (4番)" }); } } else if (activeConditions.has('concealed') && kongsCount < 4) { faan += 8; tags.push({ text: "坎坎糊 (8番)" }); isExceptional = true; } else if (kongsCount < 4) { faan += 3; tags.push({ text: "對對糊 (3番)" }); } if (kongsCount === 4) { faan += 13; tags.push({ text: "十八羅漢 (13番)" }); isExceptional = true; } } else if (isAllChows) { faan += 1; tags.push({ text: "平糊 (1番)" }); } let dPongs = 0, dEyes = 0; [31, 32, 33].forEach(id => { if (counts[id] >= 3) dPongs++; else if (counts[id] === 2) dEyes++; }); if (dPongs === 3) { faan += 8; tags.push({ text: "大三元 (8番)" }); isExceptional = true; } else if (dPongs === 2 && dEyes === 1) { faan += 5; tags.push({ text: "小三元 (5番)" }); } else if (dPongs > 0) { if (counts[31] >= 3) { faan += 1; tags.push({ text: "紅中 (1番)" }); } if (counts[32] >= 3) { faan += 1; tags.push({ text: "發財 (1番)" }); } if (counts[33] >= 3) { faan += 1; tags.push({ text: "白板 (1番)" }); } } let wPongs = 0, wEyes = 0; [27, 28, 29, 30].forEach(id => { if (counts[id] >= 3) wPongs++; else if (counts[id] === 2) wEyes++; }); if (wPongs === 4) { faan += 13; tags.push({ text: "大四喜 (13番)" }); isExceptional = true; } else if (wPongs === 3 && wEyes === 1) { faan += 6; tags.push({ text: "小四喜 (6番)" }); isExceptional = true; } else { if (!isExceptional) { let roundWindId = 27 + roundWind; let seatWindId = 27 + seatWind; let windNames = ['東', '南', '西', '北']; if (counts[roundWindId] >= 3) { faan += 1; tags.push({ text: `${windNames[roundWind]}圈 (1番)` }); } if (counts[seatWindId] >= 3) { faan += 1; tags.push({ text: `${windNames[seatWind]}位 (1番)` }); } } } if (!isExceptional) { let extras = getExtras(counts); faan += extras.faan; tags.push(...extras.tags); } if (faan === 0 && !isExceptional) tags.push({ text: "雞糊 (0番)" }); return { faan, tags }; }

function displayResult(faan, tags, isWin) {
    const isZaWu = !isWin && hand.length === getCurrentMax(); const isBaauPang = isWin && faan >= 13;
    const heroCard = document.getElementById('resultHeroCard'); const badge = document.getElementById('resultBadge'); const scoreVal = document.getElementById('heroScoreValue'); const scoreUnit = document.getElementById('heroScoreUnit'); const mainPattern = document.getElementById('heroMainPatternName');

    heroCard.className = 'glass-card result-hero'; badge.className = 'result-badge'; document.body.className = ''; 
    if (isZaWu) document.body.classList.add('failure-mode'); else if (isBaauPang) document.body.classList.add('limit-mode'); else if (isWin) document.body.classList.add('success-mode'); 
    const windNames = ['東', '南', '西', '北']; document.getElementById('resRoundWind').innerText = windNames[roundWind]; document.getElementById('resSeatWind').innerText = windNames[seatWind]; document.getElementById('resFlowers').innerText = activeFlowers.size === 0 ? '無花' : `${activeFlowers.size} 隻`;

    let mainName = '平糊';
    if (isZaWu) { 
        heroCard.classList.add('glow-fail'); badge.innerText = '🚨 判定失敗'; badge.classList.add('fail'); scoreVal.innerText = '--'; scoreUnit.style.display = 'none'; mainPattern.innerText = '詐糊'; mainPattern.style.color = '#ef4444'; if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } else { 
        heroCard.classList.add('glow-normal'); scoreVal.innerText = faan; scoreUnit.style.display = 'inline';
        if (isBaauPang) { scoreVal.innerText = '爆棚'; scoreUnit.style.display = 'none'; scoreVal.classList.add('baau-pang-text'); badge.innerText = '✨ 極限爆棚'; badge.classList.add('legendary'); } else if (faan >= 7) { badge.innerText = '🔮 史詩大牌'; badge.classList.add('epic'); } else { badge.innerText = '✅ 結算成功'; badge.classList.add('epic'); }
        let maxFaan = -1; tags.forEach(t => { let text = typeof t === 'string' ? t : t.text; const match = text.match(/(.*?)\s*\((\d+)番\)/); if (match) { let f = parseInt(match[2]); if (f > maxFaan) { maxFaan = f; mainName = match[1].trim(); } } });
        mainPattern.innerText = mainName; mainPattern.style.color = '#10b981';
        if (navigator.vibrate) { if (isBaauPang) navigator.vibrate([30, 50, 30, 50, 30]); else navigator.vibrate([30, 50, 30]); }
    }

    const detailList = document.getElementById('detailList'); detailList.innerHTML = '';
    let cleanSubPatterns = tags.map(t => (typeof t === 'string' ? t : t.text).split(' ')[0]).join(', ');
    currentResultSnapshot = { faan: isZaWu ? 0 : faan, isWin: isWin, isBaauPang: isBaauPang, mainPattern: isZaWu ? '詐糊' : mainName, subPatterns: cleanSubPatterns, timestamp: new Date().getTime() };

    tags.forEach((t, index) => { let text = typeof t === 'string' ? t : t.text; const match = text.match(/(.*?)\s*\((.*?)\)/); let name = text; let scoreText = ''; if (match) { name = match[1].trim(); scoreText = match[2].trim(); } const item = document.createElement('div'); item.className = 'detail-item'; item.style.animationDelay = `${index * 0.1}s`; let icon = '✦'; if (name.includes('花')) icon = '🌸'; else if (name.includes('圈') || name.includes('位')) icon = '💨'; item.innerHTML = `<div class="detail-item-name"><div class="detail-item-icon">${icon}</div>${name}</div><div class="detail-item-score" style="${isZaWu ? 'color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2);' : ''}">${scoreText}</div>`; detailList.appendChild(item); });
}

function saveHistory() {
    if (!currentResultSnapshot) return;
    let history = JSON.parse(localStorage.getItem('mahjongHistory') || '[]');
    history.unshift(currentResultSnapshot);
    if (history.length > 50) history.pop();
    localStorage.setItem('mahjongHistory', JSON.stringify(history));
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    renderHistory(); switchPage('page-history');
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('mahjongHistory') || '[]');
    const listContainer = document.getElementById('historyList');
    
    // 取得儀表板元素
    const statMax = document.getElementById('statMaxFaan'); 
    const statTotal = document.getElementById('statTotalGames'); 
    const statWinRate = document.getElementById('statWinRate');
    const statWinRateBar = document.getElementById('statWinRateBar');

    if (history.length === 0) {
        listContainer.innerHTML = '<div class="history-empty">暫無戰績紀錄，快去胡一把大牌吧！</div>';
        statMax.innerText = '0'; statTotal.innerText = '0'; 
        statWinRate.innerText = '0%'; statWinRateBar.style.width = '0%';
        return;
    }

    let maxFaan = 0; let totalFaan = 0; let winCount = 0;
    listContainer.innerHTML = '';

    history.forEach((record, index) => {
        if (record.isWin) { 
            if (record.faan > maxFaan) maxFaan = record.faan; 
            totalFaan += record.faan; 
            winCount++; 
        }

        const date = new Date(record.timestamp); 
        const timeStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let badgeClass = 'bg-fail'; let badgeVal = '--';
        let typeBadgeHtml = '';

        if (record.isWin) { 
            badgeVal = record.isBaauPang ? '爆' : record.faan; 
            if (record.faan >= 10) badgeClass = 'bg-legendary'; 
            else if (record.faan >= 7) badgeClass = 'bg-epic'; 
            else badgeClass = 'bg-rare'; 

            // ✨ 自動分析並給予「自摸」或「食糊」的標籤
            if (record.subPatterns.includes('自摸')) {
                typeBadgeHtml = `<span class="history-card-type-badge type-self">自摸</span>`;
            } else {
                typeBadgeHtml = `<span class="history-card-type-badge">食糊</span>`;
            }
        } else {
            typeBadgeHtml = `<span class="history-card-type-badge type-fail">詐糊</span>`;
        }

        const item = document.createElement('div'); 
        item.className = 'history-card'; 
        item.style.animationDelay = `${index * 0.05}s`;
        
        item.innerHTML = `
            <div class="history-card-badge ${badgeClass}">
                <div class="b-val">${badgeVal}</div>
                <div class="b-unit">番</div>
            </div>
            <div class="history-card-info">
                <div class="history-card-header">
                    <div class="history-card-title">${record.isWin ? record.mainPattern : '判定失敗'}</div>
                    ${typeBadgeHtml}
                </div>
                <div class="history-card-sub">${record.subPatterns || '無附加番種'}</div>
                <div class="history-card-time">📅 ${timeStr}</div>
            </div>
        `;
        listContainer.appendChild(item);
    });

    statTotal.innerText = history.length; 
    statMax.innerText = maxFaan >= 13 ? '13+' : maxFaan; 
    
    // ✨ 計算並畫出勝率進度條
    let winRate = Math.round((winCount / history.length) * 100);
    statWinRate.innerText = winRate + '%';
    
    // 給進度條一點延遲，創造滑順填滿的動畫效果
    setTimeout(() => {
        statWinRateBar.style.width = winRate + '%';
    }, 100);
}

function populateWiki(filterType = 'all', searchQuery = '') {
    const area = document.getElementById('wikiContentArea');
    area.innerHTML = ''; 

    const query = searchQuery.toLowerCase().trim();

    const renderList = (title, types) => {
        const items = DICTIONARY.filter(item => {
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
        // ✨ 升級 1：移除外層的 glass-card，並設定卡片之間的空隙 (gap: 12px)
        listContainer.className = 'wiki-list-container';
        listContainer.style = 'display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px;';

        items.forEach((item, index) => {
            const badgeClass = item.type === 'common' ? 'badge-common' : 'badge-mid';
            
            let div = document.createElement('div');
            // ✨ 升級 2：把 glass-card 魔法直接加到每一個番種項目上！
            div.className = 'w-list-item glass-card wiki-anim-item';
            // ✨ 升級 3：拔除舊的底部分隔線，並加上一點內邊距讓卡片更好看
            div.style = `animation-delay: ${index * 0.05}s; padding: 16px; border: 1px solid rgba(255,255,255,0.1);`;
            
            div.innerHTML = `
                <div class="w-item-icon-box">${item.icon}</div>
                <div class="w-item-info">
                    <div class="w-item-header">
                        <span class="w-item-title">${item.name}</span>
                        <span class="w-item-badge ${badgeClass}">${item.f} 番</span>
                    </div>
                    <div class="w-item-desc">${item.d}</div>
                </div>
                <div style="color: #94a3b8; font-size: 18px;">›</div>
            `;
            attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
            listContainer.appendChild(div);
        });
        area.appendChild(listContainer);
    };

    const renderLimitGrid = () => {
        const items = DICTIONARY.filter(item => {
            const matchType = item.type === 'limit';
            const matchQuery = query === '' || item.name.toLowerCase().includes(query);
            return matchType && matchQuery;
        });
        if (items.length === 0) return;

        let titleHtml = document.createElement('div');
        titleHtml.className = 'wiki-section-header';
        titleHtml.style.marginTop = '5px';
        titleHtml.innerText = '🔥 爆棚 / 役滿';
        area.appendChild(titleHtml);

        let gridContainer = document.createElement('div');
        gridContainer.className = 'wiki-limit-grid';

        items.forEach((item, index) => {
            let div = document.createElement('div');
            div.className = 'w-limit-card glass-card wiki-anim-item';
            div.style = `animation-delay: ${index * 0.08}s;`;
            
            div.innerHTML = `
                <div class="w-limit-bg" style="background-image: url('${item.img}');"></div>
                <div class="w-limit-content">
                    <span class="w-limit-title">${item.name}</span>
                    <span class="w-limit-badge">${item.f >= 13 ? '13 番 (上限)' : item.f + ' 番'}</span>
                </div>
            `;
            attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
            gridContainer.appendChild(div);
        });
        area.appendChild(gridContainer);
    };

    if (filterType === 'all' || filterType === 'common') renderList('1 - 3 番', ['common']);
    if (filterType === 'all' || filterType === 'mid') renderList('4 - 9 番', ['mid']);
    if (filterType === 'all' || filterType === 'limit') renderLimitGrid();

    if (area.innerHTML === '') {
        area.innerHTML = `<div class="wiki-anim-item" style="text-align:center; padding: 40px 20px; color:#94a3b8; font-size:14px; background:rgba(255,255,255,0.05); border-radius:16px; margin-top:20px; border: 1px dashed rgba(255,255,255,0.2);">找不到符合「${searchQuery}」的番種 🥲<br><br><span style="font-size:12px;">請嘗試輸入其他關鍵字（如：平糊、字一色）</span></div>`;
    }

    document.querySelectorAll('.w-filter').forEach(btn => {
        attachFastClick(btn, () => {
            document.querySelectorAll('.w-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const currentQuery = document.getElementById('wikiSearch').value;
            populateWiki(btn.getAttribute('data-filter'), currentQuery);
            if (navigator.vibrate) navigator.vibrate([5]);
        }, 'is-tapped-chip');
    });
}

// ==== ✨ 第五階段：渲染百科詳情頁 (含區塊接力微動畫) ====
function openWikiDetail(item) {
    if (navigator.vibrate) navigator.vibrate([10]);
    
    // 1. 填入大標題
    document.getElementById('wdTitle').innerText = item.name;
    document.getElementById('wdFaan').innerText = item.f >= 13 ? '13 番 (爆棚)' : `${item.f} 番`;
    
    // 2. 填入 3D 預覽牌
    const previewArea = document.getElementById('wdPreviewTiles');
    previewArea.innerHTML = '';
    const defaultTiles = ['w1','w2','w3', 't4','t5','t6', 's7','s8','s9', 'z1','z1','z1', 'z5','z5'];
    const tilesToRender = item.preview || defaultTiles;
    
    tilesToRender.forEach((t, i) => {
        const rotation = (i % 3 === 0) ? 'rotate(2deg)' : (i % 2 === 0 ? 'rotate(-1deg)' : 'rotate(0deg)');
        let margin = '';
        if (tilesToRender.length > 14) {
            margin = (i === 3 || i === 7 || i === 11 || i === 15) ? 'margin-right: 8px;' : 'margin-right: -4px;';
        } else {
            margin = (i === 2 || i === 5 || i === 8 || i === 11) ? 'margin-right: 6px;' : '';
        }
        previewArea.innerHTML += `<div class="w-tile shadow-lg" style="background-image: url('tiles/${t}.svg'); transform: ${rotation} translateY(${i%2===0?'-1px':'1px'}); ${margin}"></div>`;
    });

    // 3. 填入說明
    document.getElementById('wdDesc').innerHTML = item.desc || `<strong style='color:#10b981; font-size:16px;'>${item.name}</strong><br><br>${item.d}`;

    // 4. 填入實戰技巧
    const tipsSec = document.getElementById('wdTipsSection');
    const tipsArea = document.getElementById('wdTips');
    if (item.tips && item.tips.length > 0) {
        tipsSec.style.display = 'flex';
        tipsArea.innerHTML = '';
        item.tips.forEach(tip => {
            tipsArea.innerHTML += `
                <div class="wd-tip-item">
                    <div class="wd-tip-icon">${tip.icon}</div>
                    <div class="wd-tip-content">
                        <h4>${tip.title}</h4>
                        <p>${tip.text}</p>
                    </div>
                </div>`;
        });
    } else {
        tipsSec.style.display = 'none';
    }

    // 5. 填入牌型變化
    const varsSec = document.getElementById('wdVarsSection');
    const varsArea = document.getElementById('wdVars');
    if (item.vars && item.vars.length > 0) {
        varsSec.style.display = 'flex';
        varsArea.innerHTML = '';
        item.vars.forEach(v => {
            varsArea.innerHTML += `
                <div class="wd-var-card glass-card">
                    <div class="wd-var-header">
                        <span class="wd-var-title">${v.name}</span>
                        <span class="wd-var-badge">${v.faan}</span>
                    </div>
                    <div class="wd-var-img">${v.icon}</div>
                    <div class="wd-var-desc">${v.desc}</div>
                </div>`;
        });
    } else {
        varsSec.style.display = 'none';
    }

    // ✨ 6. 賦予區塊接力滑入動畫
    const hero = document.querySelector('.w-detail-hero');
    const preview = document.querySelector('.w-detail-preview');
    const descSec = document.getElementById('wdDesc').parentElement;
    
    let delay = 0;
    [hero, preview, descSec, tipsSec, varsSec].forEach(el => {
        if (el && el.style.display !== 'none') {
            // 移除舊的 class 並觸發重繪，確保每次點進來都會播放動畫
            el.classList.remove('wd-anim-item');
            void el.offsetWidth; 
            
            el.classList.add('wd-anim-item');
            el.style.animationDelay = `${delay}s`;
            delay += 0.08; // 每個區塊晚 0.08 秒出現
        }
    });

    // 7. 切換頁面 (隱藏其他，顯示詳情)
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById('page-wiki-detail').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🌟 確保在 init() 函數中綁定 btnBackToWiki（這段很重要，要在 init() 裡加上）：
// 請在 app.js 第 115 行附近，找到 `attachFastClick(document.getElementById('btnSystemClear')...` 的下方，補上：
// attachFastClick(document.getElementById('btnBackToWiki'), () => { switchPage('page-wiki'); }, 'is-tapped-chip');
init();
// ==== ✨ v2.8.41 深色模式切換與記憶邏輯 ====
function initThemeToggle() {
    const btnTheme = document.getElementById('btnToggleTheme');
    const statusText = document.getElementById('themeStatusText');
    if (!btnTheme) return;

    // 1. App 啟動時：讀取用戶的記憶設定
    const isDarkMode = localStorage.getItem('mahjongTheme') === 'dark';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        statusText.innerText = '深色';
        statusText.style.color = '#13ec5b'; // 使用您的螢光綠
    }

    // 2. 當用戶點擊「外觀切換」按鈕時
    attachFastClick(btnTheme, () => {
        const isDarkNow = document.body.classList.contains('dark-mode');
        
        if (isDarkNow) {
            // 關閉深色模式 (回到淺色)
            document.body.classList.remove('dark-mode');
            localStorage.setItem('mahjongTheme', 'light');
            statusText.innerText = '淺色';
            statusText.style.color = '#94a3b8';
        } else {
            // 開啟深色模式
            document.body.classList.add('dark-mode');
            localStorage.setItem('mahjongTheme', 'dark');
            statusText.innerText = '深色';
            statusText.style.color = '#13ec5b'; // 螢光綠
        }
        
        // 增加點擊震動回饋
        if (navigator.vibrate) navigator.vibrate([15]);
    }, 'is-tapped-chip');
}

// 啟動深色模式的監聽器
initThemeToggle();