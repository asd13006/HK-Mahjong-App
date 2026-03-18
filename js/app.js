/* ==========================================
   🧠 香港麻雀計番神器 - 應用入口 (app.js)
   ========================================== */

import { APP_VERSION } from './constants.js';
import { state } from './state.js';
import { attachFastClick, debounce } from './utils.js';
import { animatePageBlocks, switchPage } from './animation.js';
import { renderConditions, renderFlowers, renderKeyboard, renderHand, clearHand, updateIslandSummary, setRoundWind, setSeatWind } from './ui-input.js';
import { runEngine, resetResultCard } from './ui-result.js';
import { renderHistory } from './ui-history.js';
import { populateWiki, setupWikiFilters, populateDailyFeatured } from './ui-wiki.js';
import { updateProfileData } from './ui-profile.js';

function init() {
    renderConditions();
    renderFlowers();
    renderKeyboard();
    renderHand();
    document.getElementById('appVersionProfile').innerText = APP_VERSION;
    populateDailyFeatured();

    // 動態島展開/收合
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

    // 風位選擇
    document
        .querySelectorAll('#roundWindSelector .wind-tab')
        .forEach((tab, i) => attachFastClick(tab, () => setRoundWind(i), 'is-tapped-chip'));
    document
        .querySelectorAll('#seatWindSelector .wind-tab')
        .forEach((tab, i) => attachFastClick(tab, () => setSeatWind(i), 'is-tapped-chip'));

    // 清空手牌
    attachFastClick(document.getElementById('clearBtnId'), clearHand, 'is-tapped-chip');

    // 開始結算
    attachFastClick(
        document.getElementById('calcBtn'),
        () => {
            if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
            switchPage('page-result');
            runEngine();
        },
        'is-tapped-chip',
    );

    // 返回修改
    attachFastClick(
        document.getElementById('backToInputBtn'),
        () => {
            if (navigator.vibrate) navigator.vibrate([10]);
            switchPage('page-input');
            resetResultCard();
        },
        'is-tapped-chip',
    );

    // 清空歷史
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

    // 隱私權政策
    attachFastClick(
        document.getElementById('btnPrivacy'),
        () => window.open('privacy.html', '_blank'),
        'is-tapped-chip',
    );

    // 檢查更新
    attachFastClick(
        document.getElementById('btnCheckUpdate'),
        () => {
            const statusEl = document.querySelector('#btnCheckUpdate .s-text');
            const originalText = statusEl.textContent;
            statusEl.textContent = '檢查中...';
            if (window.__swReg) {
                window.__swReg.update().then(() => {
                    // 如果有新版 SW 正在安裝，updatefound 事件會自動處理
                    const waiting = window.__swReg.waiting;
                    if (waiting) {
                        waiting.postMessage({ type: 'SKIP_WAITING' });
                    } else {
                        statusEl.textContent = '已是最新版本 ✅';
                        setTimeout(() => { statusEl.textContent = originalText; }, 2000);
                    }
                }).catch(() => {
                    statusEl.textContent = '檢查失敗，請確認網絡連線';
                    setTimeout(() => { statusEl.textContent = originalText; }, 2000);
                });
            } else {
                statusEl.textContent = '無法檢查 (Service Worker 未註冊)';
                setTimeout(() => { statusEl.textContent = originalText; }, 2000);
            }
        },
        'is-tapped-chip',
    );

    // 清除系統暫存
    attachFastClick(
        document.getElementById('btnSystemClear'),
        () => {
            if (confirm('⚠️ 確定要清除系統暫存嗎？這會重置介面，但不會刪除戰績。')) {
                window.location.reload(true);
            }
        },
        'is-tapped-chip',
    );

    // 百科詳情返回
    attachFastClick(
        document.getElementById('btnBackToWiki'),
        () => {
            if (navigator.vibrate) navigator.vibrate([10]);
            document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
            document.getElementById('page-wiki').classList.add('active');
            state.wikiDetailTransitioning = true;
            setTimeout(() => { state.wikiDetailTransitioning = false; }, 500);
            document.body.scrollTo({ top: state.wikiScrollPos, behavior: 'instant' });
        },
        'is-tapped-chip',
    );

    // 百科搜尋
    const searchInput = document.getElementById('wikiSearch');
    if (searchInput) {
        const debouncedSearch = debounce((value) => {
            const activeFilter = document.querySelector('.w-filter.active').getAttribute('data-filter');
            populateWiki(activeFilter, value);
        }, 200);
        searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
    }

    // 底部導覽
    document.querySelectorAll('.nav-item').forEach((item) => {
        attachFastClick(
            item,
            () => {
                if (item.classList.contains('active')) return;
                if (navigator.vibrate) navigator.vibrate([10]);
                const target = item.getAttribute('data-target');
                switchPage(target);
                if (target === 'page-profile') updateProfileData();
            },
            'is-tapped-chip',
        );
    });

    updateIslandSummary();
    setupWikiFilters();
    renderHistory();
    populateWiki();
}

init();
animatePageBlocks(document.getElementById('page-input'));

