/* ==========================================
   🎛️ 輸入介面 (ui-input.js)
   ========================================== */

import { TILE_DEFS, CONDITIONS, FLOWERS, TOTAL_TILE_TYPES, CONDITION_CONFLICTS, CONDITION_DEACTIVATE } from './constants.js';
import { state } from './state.js';
import { attachFastClick, detachFastClick } from './utils.js';
import { smoothHeightUpdate } from './animation.js';
import { getTileInfo, getCurrentMax, validateTileId } from './engine.js';
import { resetResultCard } from './ui-result.js';

/* ------------------------------------------
   🔀 條件互斥規則
   ------------------------------------------ */

function resolveConditionConflicts(condId) {
    if (state.activeConditions.has(condId)) {
        state.activeConditions.delete(condId);
        const deactivateList = CONDITION_DEACTIVATE[condId];
        if (deactivateList) deactivateList.forEach((id) => state.activeConditions.delete(id));
    } else {
        const rule = CONDITION_CONFLICTS[condId];
        if (rule && rule.clearAll) {
            state.activeConditions.clear();
            state.activeConditions.add(condId);
            return;
        }
        state.activeConditions.add(condId);
        state.activeConditions.delete('heaven');
        state.activeConditions.delete('earth');
        if (rule) {
            if (rule.require) rule.require.forEach((id) => state.activeConditions.add(id));
            if (rule.remove) rule.remove.forEach((id) => state.activeConditions.delete(id));
        }
    }
}

/* ------------------------------------------
   🎛️ 介面渲染：條件 / 花牌 / 鍵盤
   ------------------------------------------ */

export function renderConditions() {
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

export function updateIslandSummary() {
    let activeLabels = [];
    CONDITIONS.forEach((cond) => {
        const chip = document.getElementById(`cond-${cond.id}`);
        if (chip) {
            if (state.activeConditions.has(cond.id)) {
                chip.classList.add('active');
                activeLabels.push(cond.label.split(' ')[0]);
            } else {
                chip.classList.remove('active');
            }
        }
    });
    const windNames = ['東', '南', '西', '北'];
    activeLabels.push(`${windNames[state.roundWind]}圈${windNames[state.seatWind]}位`);
    if (state.activeFlowers.size > 0) activeLabels.push(`${state.activeFlowers.size}花`);
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

export function setRoundWind(index) {
    state.roundWind = index;
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

export function setSeatWind(index) {
    state.seatWind = index;
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

export function renderFlowers() {
    const grid = document.getElementById('flowerGrid');
    if (grid.children.length === 0) {
        FLOWERS.forEach((f, index) => {
            const btn = document.createElement('div');
            btn.className = 'flower-tile';
            btn.id = `flower-${f.id}`;
            if (state.activeFlowers.has(f.id)) btn.classList.add('active');
            btn.style.backgroundImage = `url('tiles/f${index + 1}.svg')`;
            attachFastClick(btn, () => {
                if (state.activeFlowers.has(f.id)) state.activeFlowers.delete(f.id);
                else state.activeFlowers.add(f.id);
                btn.classList.toggle('active');
                document.getElementById('flowerCount').innerText = `已選 ${state.activeFlowers.size} 隻`;
                updateIslandSummary();
                if (navigator.vibrate) navigator.vibrate([10]);
                checkAndRunEngine();
            });
            grid.appendChild(btn);
        });
    }
}

export function renderKeyboard() {
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
            btn.dataset.id = id;
            btn.style.backgroundImage = `url('tiles/${def.type}${i + 1}.svg')`;
            attachFastClick(btn, () => addTile(id), 'is-tapped-tile');
            row.appendChild(btn);
        }
        kb.appendChild(row);
    });
}

function updateKeyboardState() {
    let counts = new Array(TOTAL_TILE_TYPES).fill(0);
    state.hand.forEach((item) => counts[item.id]++);
    document.querySelectorAll('#keyboard .tile').forEach((btn) => {
        let id = parseInt(btn.dataset.id);
        if (counts[id] >= 4) btn.classList.add('disabled-tile');
        else btn.classList.remove('disabled-tile');
    });
}

/* ------------------------------------------
   🖐️ 手牌操作
   ------------------------------------------ */

function addTile(id) {
    if (!validateTileId(id)) return;
    let count = state.hand.filter((t) => t.id === id).length;
    if (count >= 4) return;
    state.hand.push({ id: id, key: state.tileKeyCounter++ });
    let projectedMax = getCurrentMax();
    if (state.hand.length > projectedMax) {
        state.hand.pop();
        state.tileKeyCounter--;
        return;
    }
    state.hand.sort((a, b) => a.id - b.id);
    if (navigator.vibrate) navigator.vibrate([8]);
    renderHand();
}

function removeTile(index) {
    state.hand.splice(index, 1);
    if (navigator.vibrate) navigator.vibrate([8]);
    renderHand();
}

export function renderHand() {
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
        state.hand.forEach((item) => {
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
                    const currentIdx = state.hand.findIndex((t) => t.key === item.key);
                    if (currentIdx > -1) removeTile(currentIdx);
                },
                'is-tapped-tile',
            );
            grid.appendChild(el);
        });
        existingTiles.forEach((el, key) => {
            if (!state.hand.find((t) => String(t.key) === key)) {
                detachFastClick(el);
                el.remove();
            }
        });
        for (let i = state.hand.length; i < currentMax; i++) {
            const empty = document.createElement('div');
            empty.className = 'tile empty';
            if (i >= state.lastMax && currentMax > state.lastMax) {
                empty.classList.add('empty-enter-anim');
            }
            grid.appendChild(empty);
        }
        document.getElementById('tileCount').innerText = `暗牌已選 ${state.hand.length} / ${currentMax}`;
        const tileCountEl = document.getElementById('tileCount');
        if (state.hand.length === currentMax) tileCountEl.classList.add('tile-count-full');
        else tileCountEl.classList.remove('tile-count-full');
    };
    if (state.lastMax !== currentMax) smoothHeightUpdate('handCard', updateGridDOM);
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
    setTimeout(() => {
        grid.querySelectorAll('.tile[data-key]').forEach((el, index) => {
            el.style.animationDelay = `${index * 0.15}s`;
            el.classList.add('breathing');
        });
    }, 300);
    state.lastMax = currentMax;
    checkAndRunEngine();
    updateKeyboardState();
}

export function clearHand() {
    if (state.isClearing) return;
    if (
        state.hand.length === 0 &&
        state.activeConditions.size === 0 &&
        state.activeFlowers.size === 0 &&
        state.roundWind === 0 &&
        state.seatWind === 0
    )
        return;
    state.isClearing = true;
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
    state.activeConditions.clear();
    state.activeFlowers.clear();
    state.roundWind = 0;
    state.seatWind = 0;
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
    state.hand = [];
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
            state.lastMax = oldMax;
            renderHand();
            state.isClearing = false;
        },
        400 + currentTiles.length * 25,
    );
}

function checkAndRunEngine() {
    let currentMax = getCurrentMax();
    const actionText = document.getElementById('actionText');
    const calcBtn = document.getElementById('calcBtn');
    if (state.activeFlowers.size >= 7 || state.hand.length === currentMax) {
        actionText.style.display = 'none';
        calcBtn.style.display = 'block';
    } else {
        actionText.style.display = 'block';
        calcBtn.style.display = 'none';
        actionText.innerText = `請選取 ${currentMax} 張牌`;
    }
}
