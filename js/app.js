/* ==========================================
   🧠 香港麻雀計番神器 - 應用入口 (app.js)
   ========================================== */

import { APP_VERSION } from './constants.js';
import { DICTIONARY } from '../data.js';
import { state } from './state.js';
import { attachFastClick, debounce, showConfirmModal, safeGetHistory, animateCount } from './utils.js';
import { animatePageBlocks, switchPage } from './animation.js';
import { renderConditions, renderFlowers, renderKeyboard, renderHand, clearHand, updateIslandSummary, setRoundWind, setSeatWind } from './ui-input.js';
import { runEngine, resetResultCard } from './ui-result.js';
import { renderHistory } from './ui-history.js';
import { populateWiki, setupWikiFilters, populateDailyFeatured } from './ui-wiki.js';
import { updateProfileData } from './ui-profile.js';

function getDailyItem() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return DICTIONARY[seed % DICTIONARY.length];
}

function updateHomePage() {
    const history = safeGetHistory();
    const total = history.length;
    let wins = 0, max = 0;
    history.forEach((r) => {
        if (r.isWin) { wins++; if (r.faan > max) max = r.faan; }
    });
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    animateCount(document.getElementById('homeStatGames'), total, 500);
    document.getElementById('homeStatWinRate').textContent = winRate + '%';
    document.getElementById('homeStatMax').textContent = max >= 13 ? '13+' : max;

    const item = getDailyItem();
    document.getElementById('homeDailyName').textContent = item.name;
    document.getElementById('homeDailyFaan').textContent = item.f >= 13 ? '13 番 (爆棚)' : item.f + ' 番';
    document.getElementById('homeDailyDesc').textContent = item.d;
    const tilesContainer = document.getElementById('homeDailyTiles');
    tilesContainer.innerHTML = '';
    (item.preview || []).forEach((t) => {
        const tile = document.createElement('div');
        tile.className = 'w-tile';
        tile.style.backgroundImage = `url('tiles/${t}.svg')`;
        tilesContainer.appendChild(tile);
    });
}

function init() {
    renderConditions();
    renderFlowers();
    renderKeyboard();
    renderHand();
    document.getElementById('appVersionProfile').innerText = APP_VERSION;
    populateDailyFeatured();
    updateHomePage();

    // 首頁 CTA
    attachFastClick(
        document.getElementById('homeStartBtn'),
        () => { if (navigator.vibrate) navigator.vibrate([10]); switchPage('page-input'); },
        'is-tapped-chip',
    );

    // 首頁快速入口
    attachFastClick(
        document.getElementById('homeQuickWiki'),
        () => { if (navigator.vibrate) navigator.vibrate([10]); switchPage('page-wiki'); },
        'is-tapped-chip',
    );
    attachFastClick(
        document.getElementById('homeQuickHistory'),
        () => { if (navigator.vibrate) navigator.vibrate([10]); switchPage('page-history'); },
        'is-tapped-chip',
    );

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
            // 等 page enter 動畫完成先 run engine（避免 DOM 未 ready）
            setTimeout(() => runEngine(), 300);
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
            showConfirmModal('確定要清空所有生涯戰績嗎？這個動作無法復原喔！').then((ok) => {
                if (ok) {
                    try { localStorage.removeItem('mahjongHistory'); } catch { }
                    renderHistory();
                    updateProfileData();
                }
            });
        },
        'is-tapped-chip',
    );

    // 隱私權政策
    attachFastClick(
        document.getElementById('btnPrivacy'),
        () => {
            document.getElementById('privacySheet').style.display = 'flex';
        },
        'is-tapped-chip',
    );

    // 隱私權政策關閉
    attachFastClick(
        document.getElementById('privacyClose'),
        () => {
            document.getElementById('privacySheet').style.display = 'none';
        },
        'is-tapped-chip',
    );
    // 點擊 overlay 背景也可關閉
    document.getElementById('privacySheet').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });

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
            showConfirmModal('確定要清除系統暫存嗎？這會重置介面，但不會刪除戰績。').then((ok) => {
                if (ok) window.location.reload(true);
            });
        },
        'is-tapped-chip',
    );

    // 百科詳情返回
    attachFastClick(
        document.getElementById('btnBackToWiki'),
        () => {
            backToWiki();
            state.wikiDetailTransitioning = true;
            setTimeout(() => { state.wikiDetailTransitioning = false; }, 500);
        },
        'is-tapped-chip',
    );

    // 百科子頁面返回 wiki 共用函式
    function backToWiki() {
        if (navigator.vibrate) navigator.vibrate([10]);
        switchPage('page-wiki');
        document.querySelector('.app-container').scrollTo({ top: state.wikiScrollPos, behavior: 'instant' });
    }

    // 基本規則頁 (index 0 = 基本規則, index 1 = 計分原理)
    document.querySelectorAll('.wiki-basic-card').forEach((card, i) => {
        attachFastClick(card, () => {
            if (navigator.vibrate) navigator.vibrate([10]);
            switchPage(i === 0 ? 'page-basics-rules' : 'page-basics-scoring');
        }, 'is-tapped-chip');
    });

    // 基本規則 / 計分原理 返回按鈕
    document.querySelectorAll('.basics-back-btn').forEach((btn) => {
        attachFastClick(btn, backToWiki, 'is-tapped-chip');
    });

    // 百科搜尋
    const searchInput = document.getElementById('wikiSearch');
    const searchClear = document.getElementById('wikiSearchClear');
    if (searchInput) {
        const debouncedSearch = debounce((value) => {
            const activeFilter = document.querySelector('.w-filter.active').getAttribute('data-filter');
            populateWiki(activeFilter, value);
        }, 200);
        searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
            if (searchClear) searchClear.style.display = e.target.value ? 'flex' : 'none';
        });
    }
    if (searchClear) {
        attachFastClick(searchClear, () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            const activeFilter = document.querySelector('.w-filter.active').getAttribute('data-filter');
            populateWiki(activeFilter, '');
            searchInput.focus();
        }, 'is-tapped-chip');
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
                if (target === 'page-home') updateHomePage();
                if (target === 'page-profile') updateProfileData();
            },
            'is-tapped-chip',
        );
    });

    updateIslandSummary();
    setupWikiFilters();
    renderHistory();
    populateWiki();

    // Bug #5: Android 返回鍵支援
    history.replaceState({ page: 'page-home' }, '');
    window.addEventListener('popstate', (e) => {
        const targetId = e.state && e.state.page ? e.state.page : 'page-home';
        // 離開結果頁時重置
        const currentPage = document.querySelector('.page.active');
        if (currentPage && currentPage.id === 'page-result') {
            resetResultCard();
        }
        state.isPopState = true;
        switchPage(targetId);
        state.isPopState = false;
        if (targetId === 'page-home') updateHomePage();
        if (targetId === 'page-profile') updateProfileData();
    });
}

init();
animatePageBlocks(document.getElementById('page-home'));

