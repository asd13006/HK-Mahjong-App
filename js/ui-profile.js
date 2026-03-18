/* ==========================================
   👤 個人檔案與勳章 (ui-profile.js)
   ========================================== */

import { safeGetHistory } from './utils.js';

export function updateProfileData() {
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

    if (medalWin && winCount >= 1) medalWin.classList.add('unlocked');
    if (medalFlower && hasFlowerWin) medalFlower.classList.add('unlocked');
    if (medalLimit && hasLimitWin) medalLimit.classList.add('unlocked');
    if (medalLegend && totalGames >= 10) medalLegend.classList.add('unlocked');
}


