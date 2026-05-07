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
    document.body.className = '';

    const container = document.querySelector('.app-container');
    const currentPage = document.querySelector('.page.active');
    if (currentPage) {
        if (currentPage.id === 'page-input') state.inputScrollPos = container.scrollTop;
        if (currentPage.id === 'page-wiki') state.wikiScrollPos = container.scrollTop;
    }

    document.querySelectorAll('body > .tile').forEach((el) => el.remove());

    // Nav update
    document.querySelectorAll('.nav-item').forEach((nav) => {
        nav.classList.remove('active');
        nav.setAttribute('aria-selected', 'false');
    });
    // 子頁面 → parent nav 映射
    const parentNavMap = {
        'page-result': 'page-input',
        'page-wiki-detail': 'page-wiki',
        'page-basics-rules': 'page-wiki',
        'page-basics-scoring': 'page-wiki',
    };

    let navTargetId = targetId;
    if (!document.querySelector(`.nav-item[data-target="${targetId}"]`)) {
        navTargetId = parentNavMap[targetId] || 'page-home';
    }

    const targetNav = document.querySelector(`.nav-item[data-target="${navTargetId}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
        targetNav.setAttribute('aria-selected', 'true');
    }

    const pageEl = document.getElementById(targetId);
    const exitingPage = currentPage && currentPage.id !== targetId ? currentPage : null;

    if (exitingPage) {
        exitingPage.classList.add('page-exit');
        exitingPage.addEventListener('animationend', function handler() {
            exitingPage.removeEventListener('animationend', handler);
            exitingPage.classList.remove('active', 'page-exit');
            showEnter();
        }, { once: true });
    } else {
        // No page to exit from — remove all active and show immediately
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
        showEnter();
    }

    function showEnter() {
        document.querySelectorAll('.page').forEach((p) => {
            if (p !== pageEl) p.classList.remove('active');
        });
        pageEl.classList.add('page-enter', 'active');
        pageEl.addEventListener('animationend', function handler() {
            pageEl.removeEventListener('animationend', handler);
            pageEl.classList.remove('page-enter');
        }, { once: true });

        if (targetId === 'page-input') {
            container.scrollTo({ top: state.inputScrollPos, behavior: 'instant' });
        } else if (targetId === 'page-wiki' && state.wikiScrollPos > 0) {
            container.scrollTo({ top: state.wikiScrollPos, behavior: 'instant' });
        } else {
            container.scrollTo({ top: 0, behavior: 'instant' });
        }
        animatePageBlocks(pageEl);
    }

    if (!state.isPopState) {
        history.pushState({ page: targetId }, '');
    }
}
