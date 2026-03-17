/* ==========================================
   📊 結果顯示與引擎執行 (ui-result.js)
   ========================================== */

import { TOTAL_TILE_TYPES, STAGGER_LIST } from './constants.js';
import { state } from './state.js';
import { safeGetHistory, safeSaveHistory } from './utils.js';
import { getCurrentMax, validateHand, isThirteenOrphans, isNineGates, findAllMelds, evaluateStandardPatterns } from './engine.js';
import { renderHistory } from './ui-history.js';
import { updateProfileData } from './ui-profile.js';

export function resetResultCard() {
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
    state.currentResultSnapshot = null;
}

function displayResult(faan, tags, isWin) {
    const isZaWu = !isWin && state.hand.length === getCurrentMax();
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
    document.getElementById('resRoundWind').innerText = windNames[state.roundWind];
    document.getElementById('resSeatWind').innerText = windNames[state.seatWind];
    document.getElementById('resFlowers').innerText = state.activeFlowers.size === 0 ? '無花' : `${state.activeFlowers.size} 隻`;

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
    state.currentResultSnapshot = {
        faan: isZaWu ? 0 : faan,
        isWin: isWin,
        isBaauPang: isBaauPang,
        mainPattern: isZaWu ? '詐糊' : mainName,
        subPatterns: cleanSubPatterns,
        timestamp: new Date().getTime(),
    };

    // 自動儲存戰績
    if (state.currentResultSnapshot) {
        let history = safeGetHistory();
        history.unshift(state.currentResultSnapshot);
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
        item.style.animationDelay = `${index * STAGGER_LIST}s`;
        let icon = 'poker_chip';
        if (name.includes('花')) icon = 'local_florist';
        else if (name.includes('圈') || name.includes('位')) icon = 'air';

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

export function runEngine() {
    // 執行引擎前先驗證手牌合法性
    if (!validateHand()) {
        displayResult(0, [{ text: '手牌資料異常 (詐糊)' }], false);
        return;
    }
    let counts = new Array(TOTAL_TILE_TYPES).fill(0);
    state.hand.forEach((item) => counts[item.id]++);
    let fCount = state.activeFlowers.size;
    if (fCount === 8) return displayResult(8, [{ text: '八仙過海 (8番)' }], true);
    let currentMax = getCurrentMax();
    let specialFaan = 0;
    let specialTags = [];
    let isSpecial = false;
    if (state.hand.length === currentMax) {
        if (state.activeConditions.has('heaven')) {
            specialFaan = 13;
            specialTags.push({ text: '天糊 (13番)' });
            isSpecial = true;
        } else if (state.activeConditions.has('earth')) {
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
    if (state.hand.length === currentMax) {
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
        if (state.hand.length < currentMax) return;
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
