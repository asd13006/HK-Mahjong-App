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

    // 勳章進度提示
    const mpWin = document.getElementById('medal-win-prog');
    const mpFlower = document.getElementById('medal-flower-prog');
    const mpLimit = document.getElementById('medal-limit-prog');
    const mpLegend = document.getElementById('medal-legend-prog');

    const setProg = (el, unlocked, text) => { if (el) el.textContent = unlocked ? '' : text; };
    setProg(mpWin, winCount >= 1, '計番 1 次即可解鎖');
    setProg(mpFlower, hasFlowerWin, '食出花糊即可解鎖');
    setProg(mpLimit, hasLimitWin, '食出爆棚即可解鎖');
    setProg(mpLegend, totalGames >= 10, `再計 ${10 - totalGames} 局解鎖`);
}


