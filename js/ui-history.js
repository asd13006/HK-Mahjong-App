/* ==========================================
   📜 歷史紀錄管理 (ui-history.js)
   ========================================== */

import { safeGetHistory } from './utils.js';
import { STAGGER_DENSE } from './constants.js';

export function renderHistory() {
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
        item.style.animationDelay = `${index * STAGGER_DENSE}s`;

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
