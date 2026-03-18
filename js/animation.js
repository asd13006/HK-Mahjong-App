/* ==========================================
   🎬 動畫與頁面切換 (animation.js)
   ========================================== */

import { STAGGER_BLOCK } from './constants.js';

export function smoothHeightUpdate(elementId, updateDOM) {
    const el = document.getElementById(elementId);
    if (!el) {
        updateDOM();
        return;
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
        setTimeout(() => {
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
    document.querySelectorAll('.nav-item').forEach((nav) => {
        nav.classList.remove('active');
        nav.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-item[data-target="${targetId}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
        targetNav.setAttribute('aria-selected', 'true');
    }
    const pageEl = document.getElementById(targetId);
    pageEl.classList.add('active');
    document.querySelector('.app-container').scrollTo({ top: 0, behavior: 'instant' });
    animatePageBlocks(pageEl);
}
