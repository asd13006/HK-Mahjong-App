/* ==========================================
   🎬 動畫與頁面切換 (animation.js)
   ========================================== */

import { STAGGER_BLOCK } from './constants.js';
import { state } from './state.js';

let _smoothHeightTimer = null;

export function smoothHeightUpdate(elementId, updateDOM) {
    const el = document.getElementById(elementId);
    if (!el) {
        updateDOM();
        return;
    }
    if (_smoothHeightTimer) {
        clearTimeout(_smoothHeightTimer);
        _smoothHeightTimer = null;
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
        _smoothHeightTimer = setTimeout(() => {
            _smoothHeightTimer = null;
            el.style.height = 'auto';
            el.style.transition = '';
            el.style.overflow = oldOverflow;
            el.style.willChange = 'auto';
        }, 300);
    }
}

export function animatePageBlocks(pageEl) {
    const children = pageEl.children;
    for (let i = 0; i < children.length; i++) {
        children[i].classList.remove('page-block-enter');
        children[i].style.animationDelay = '';
    }
    void pageEl.offsetHeight;
    for (let i = 0; i < children.length; i++) {
        children[i].style.animationDelay = `${i * STAGGER_BLOCK}s`;
        children[i].classList.add('page-block-enter');
    }
}

export function switchPage(targetId) {
    // Bug #1: 離開結果頁時重置背景色
    document.body.className = '';

    // Bug #4: 離開手牌頁時記住捲動位置
    const container = document.querySelector('.app-container');
    const currentPage = document.querySelector('.page.active');
    if (currentPage && currentPage.id === 'page-input') {
        state.inputScrollPos = container.scrollTop;
    }

    // Bug #6: 清除殘留的清空動畫 clone
    document.querySelectorAll('body > .tile').forEach((el) => el.remove());

    document.querySelectorAll('.nav-item').forEach((nav) => {
        nav.classList.remove('active');
        nav.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
        targetNav.setAttribute('aria-selected', 'true');
    } else {
        // Bug #3: 結果頁等無對應 nav 的頁面，保留手牌 tab 高亮
        const inputNav = document.querySelector('.nav-item[data-target="page-input"]');
        if (inputNav) {
            inputNav.classList.add('active');
            inputNav.setAttribute('aria-selected', 'true');
        }
    }
    const pageEl = document.getElementById(targetId);
    pageEl.classList.add('active');
    // Bug #4: 回到手牌頁時恢復捲動位置
    if (targetId === 'page-input') {
        container.scrollTo({ top: state.inputScrollPos, behavior: 'instant' });
    } else {
        container.scrollTo({ top: 0, behavior: 'instant' });
    }
    animatePageBlocks(pageEl);

    // Bug #5: 推入瀏覽器歷史，讓 Android 返回鍵能回到上一頁
    history.pushState({ page: targetId }, '');
}
