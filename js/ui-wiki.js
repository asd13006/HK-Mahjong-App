/* ==========================================
   📖 百科系統 (ui-wiki.js)
   ========================================== */

import { DICTIONARY } from '../data.js';
import { state } from './state.js';
import { escapeHTML, attachFastClick } from './utils.js';
import { STAGGER_DENSE, STAGGER_LIST } from './constants.js';

export function populateWiki(filterType = 'all', searchQuery = '') {
    const area = document.getElementById('wikiContentArea');
    area.innerHTML = '';

    const query = searchQuery.toLowerCase().trim();

    const renderList = (title, types) => {
        const items = DICTIONARY.filter((item) => {
            const matchType = types.includes(item.type);
            const matchQuery = query === '' || item.name.toLowerCase().includes(query);
            return matchType && matchQuery;
        });
        if (items.length === 0) return;

        let titleHtml = document.createElement('div');
        titleHtml.className = 'wiki-section-header';
        titleHtml.innerText = title;
        area.appendChild(titleHtml);

        let listContainer = document.createElement('div');
        listContainer.className = 'wiki-list-container';

        items.forEach((item, index) => {
            const badgeClass = item.type === 'common' ? 'badge-common' : 'badge-mid';

            let div = document.createElement('div');
            div.className = 'w-list-item glass-card wiki-anim-item';
            div.style.animationDelay = `${index * STAGGER_DENSE}s`;

            const iconBox = document.createElement('div');
            iconBox.className = 'w-item-icon-box';
            const iconEl = document.createElement('i');
            iconEl.className = 'ic';
            iconEl.textContent = item.icon;
            iconBox.appendChild(iconEl);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'w-item-info';
            const headerDiv = document.createElement('div');
            headerDiv.className = 'w-item-header';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'w-item-title';
            titleSpan.textContent = item.name;
            const badgeSpan = document.createElement('span');
            badgeSpan.className = `w-item-badge ${badgeClass}`;
            badgeSpan.textContent = `${item.f} 番`;
            headerDiv.appendChild(titleSpan);
            headerDiv.appendChild(badgeSpan);
            const descDiv = document.createElement('div');
            descDiv.className = 'w-item-desc';
            descDiv.textContent = item.d;
            infoDiv.appendChild(headerDiv);
            infoDiv.appendChild(descDiv);

            const arrow = document.createElement('div');
            arrow.className = 'wiki-list-arrow ic';
            arrow.textContent = 'chevron_right';

            div.appendChild(iconBox);
            div.appendChild(infoDiv);
            div.appendChild(arrow);

            attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
            listContainer.appendChild(div);
        });
        area.appendChild(listContainer);
    };

    const renderLimitGrid = () => {
        const items = DICTIONARY.filter((item) => {
            const matchType = item.type === 'limit';
            const matchQuery = query === '' || item.name.toLowerCase().includes(query);
            return matchType && matchQuery;
        });
        if (items.length === 0) return;

        let titleHtml = document.createElement('div');
        titleHtml.className = 'wiki-section-header wiki-section-header--spaced';
        const fireIcon = document.createElement('i');
        fireIcon.className = 'ic';
        fireIcon.textContent = 'local_fire_department';
        titleHtml.appendChild(fireIcon);
        titleHtml.appendChild(document.createTextNode(' 爆棚 / 役滿'));
        area.appendChild(titleHtml);

        let gridContainer = document.createElement('div');
        gridContainer.className = 'wiki-limit-grid';

        items.forEach((item, index) => {
            let div = document.createElement('div');
            div.className = 'w-limit-card glass-card wiki-anim-item';
            div.style.animationDelay = `${index * STAGGER_LIST}s`;

            const bg = document.createElement('div');
            bg.className = 'w-limit-bg';
            bg.style.backgroundImage = `url('${item.img}')`;

            const content = document.createElement('div');
            content.className = 'w-limit-content';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'w-limit-title';
            titleSpan.textContent = item.name;
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'w-limit-badge';
            badgeSpan.textContent = item.f >= 13 ? '13 番 (上限)' : `${item.f} 番`;
            content.appendChild(titleSpan);
            content.appendChild(badgeSpan);

            div.appendChild(bg);
            div.appendChild(content);

            attachFastClick(div, () => openWikiDetail(item), 'is-tapped-chip');
            gridContainer.appendChild(div);
        });
        area.appendChild(gridContainer);
    };

    if (filterType === 'all' || filterType === 'common') renderList('1 - 3 番', ['common']);
    if (filterType === 'all' || filterType === 'mid') renderList('4 - 9 番', ['mid']);
    if (filterType === 'all' || filterType === 'limit') renderLimitGrid();

    if (!area.hasChildNodes()) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'wiki-anim-item wiki-empty-state';
        const escaped = escapeHTML(searchQuery);
        const msg = document.createElement('span');
        msg.textContent = `找不到符合「${escaped}」的番種`;
        const hint = document.createElement('span');
        hint.className = 'wiki-empty-hint';
        hint.textContent = '請嘗試輸入其他關鍵字（如：平糊、字一色）';
        emptyDiv.appendChild(msg);
        emptyDiv.appendChild(hint);
        area.appendChild(emptyDiv);
    }
}

export function setupWikiFilters() {
    document.querySelectorAll('.w-filter').forEach((btn) => {
        attachFastClick(
            btn,
            () => {
                document.querySelectorAll('.w-filter').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const currentQuery = document.getElementById('wikiSearch').value;
                populateWiki(btn.getAttribute('data-filter'), currentQuery);
                if (navigator.vibrate) navigator.vibrate([5]);
            },
            'is-tapped-chip',
        );
    });
}

export function populateDailyFeatured() {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const item = DICTIONARY[seed % DICTIONARY.length];

    document.querySelector('.w-feat-badge').textContent = item.f >= 13 ? '13 番 (爆棚)' : `${item.f} 番`;
    document.querySelector('.w-feat-title').textContent = item.name;
    document.querySelector('.w-feat-desc').textContent = item.d;

    const tilesContainer = document.querySelector('.w-feat-tiles');
    tilesContainer.innerHTML = '';
    const tiles = item.preview || [];
    tiles.forEach((t, i) => {
        if (i > 0 && i % 3 === 0) {
            const spacer = document.createElement('div');
            spacer.style.width = '4px';
            tilesContainer.appendChild(spacer);
        }
        const tile = document.createElement('div');
        tile.className = 'w-tile';
        tile.style.backgroundImage = `url('tiles/${t}.svg')`;
        tilesContainer.appendChild(tile);
    });
}

function openWikiDetail(item) {
    if (state.wikiDetailTransitioning) return;
    state.wikiDetailTransitioning = true;
    setTimeout(() => { state.wikiDetailTransitioning = false; }, 500);
    if (navigator.vibrate) navigator.vibrate([10]);

    document.getElementById('wdTitle').innerText = item.name;
    document.getElementById('wdFaan').innerText = item.f >= 13 ? '13 番 (爆棚)' : `${item.f} 番`;

    const previewArea = document.getElementById('wdPreviewTiles');
    previewArea.innerHTML = '';
    const defaultTiles = ['w1', 'w2', 'w3', 't4', 't5', 't6', 's7', 's8', 's9', 'z1', 'z1', 'z1', 'z5', 'z5'];
    const tilesToRender = item.preview || defaultTiles;

    tilesToRender.forEach((t, i) => {
        const rotation = i % 3 === 0 ? 'rotate(2deg)' : i % 2 === 0 ? 'rotate(-1deg)' : 'rotate(0deg)';
        let margin = '';
        if (tilesToRender.length > 14) {
            margin = i === 3 || i === 7 || i === 11 || i === 15 ? '8px' : '-4px';
        } else {
            margin = i === 2 || i === 5 || i === 8 || i === 11 ? '6px' : '';
        }
        const tile = document.createElement('div');
        tile.className = 'w-tile';
        tile.style.backgroundImage = `url('tiles/${t}.svg')`;
        tile.style.transform = `${rotation} translateY(${i % 2 === 0 ? '-1px' : '1px'})`;
        if (margin) tile.style.marginRight = margin;
        previewArea.appendChild(tile);
    });

    const descEl = document.getElementById('wdDesc');
    descEl.innerHTML = '';
    const strong = document.createElement('strong');
    strong.className = 'wd-desc-highlight';
    strong.textContent = item.name;
    descEl.appendChild(strong);
    descEl.appendChild(document.createElement('br'));
    descEl.appendChild(document.createElement('br'));
    let bodyText;
    if (item.desc) {
        bodyText = item.desc.replace(/<strong[^>]*>.*?<\/strong>/i, '').replace(/^(\s*<br\s*\/?>)*/i, '').trim();
    } else {
        bodyText = item.d;
    }
    bodyText.split(/<br\s*\/?>/).forEach((seg, i, arr) => {
        descEl.appendChild(document.createTextNode(seg));
        if (i < arr.length - 1) descEl.appendChild(document.createElement('br'));
    });

    const tipsSec = document.getElementById('wdTipsSection');
    const tipsArea = document.getElementById('wdTips');
    if (item.tips && item.tips.length > 0) {
        tipsSec.style.display = 'flex';
        tipsArea.innerHTML = '';
        item.tips.forEach((tip) => {
            const tipItem = document.createElement('div');
            tipItem.className = 'wd-tip-item';
            const tipIcon = document.createElement('div');
            tipIcon.className = 'wd-tip-icon';
            const tipIconI = document.createElement('i');
            tipIconI.className = 'ic';
            tipIconI.textContent = tip.icon;
            tipIcon.appendChild(tipIconI);
            const tipContent = document.createElement('div');
            tipContent.className = 'wd-tip-content';
            const tipH4 = document.createElement('h4');
            tipH4.textContent = tip.title;
            const tipP = document.createElement('p');
            tipP.textContent = tip.text;
            tipContent.appendChild(tipH4);
            tipContent.appendChild(tipP);
            tipItem.appendChild(tipIcon);
            tipItem.appendChild(tipContent);
            tipsArea.appendChild(tipItem);
        });
    } else {
        tipsSec.style.display = 'none';
    }

    const varsSec = document.getElementById('wdVarsSection');
    const varsArea = document.getElementById('wdVars');
    if (item.vars && item.vars.length > 0) {
        varsSec.style.display = 'flex';
        varsArea.innerHTML = '';
        item.vars.forEach((v) => {
            const card = document.createElement('div');
            card.className = 'wd-var-card glass-card';
            const varHeader = document.createElement('div');
            varHeader.className = 'wd-var-header';
            const varTitle = document.createElement('span');
            varTitle.className = 'wd-var-title';
            varTitle.textContent = v.name;
            const varBadge = document.createElement('span');
            varBadge.className = 'wd-var-badge';
            varBadge.textContent = v.faan;
            varHeader.appendChild(varTitle);
            varHeader.appendChild(varBadge);
            const varImg = document.createElement('div');
            varImg.className = 'wd-var-img';
            const varIconI = document.createElement('i');
            varIconI.className = 'ic';
            varIconI.textContent = v.icon;
            varImg.appendChild(varIconI);
            const varDesc = document.createElement('div');
            varDesc.className = 'wd-var-desc';
            varDesc.textContent = v.desc;
            card.appendChild(varHeader);
            card.appendChild(varImg);
            card.appendChild(varDesc);
            varsArea.appendChild(card);
        });
    } else {
        varsSec.style.display = 'none';
    }

    state.wikiScrollPos = document.body.scrollTop;

    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    document.getElementById('page-wiki-detail').classList.add('active');
    document.body.scrollTo({ top: 0, behavior: 'instant' });

    const hero = document.querySelector('.w-detail-hero');
    const preview = document.querySelector('.w-detail-preview');
    const descSec = document.getElementById('wdDesc').parentElement;

    const sections = [hero, preview, descSec, tipsSec, varsSec];
    sections.forEach((el) => {
        if (el) {
            el.classList.remove('wd-anim-item');
            el.style.animationDelay = '';
        }
    });

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            let delay = 0;
            sections.forEach((el) => {
                if (el && el.style.display !== 'none') {
                    el.style.animationDelay = `${delay}s`;
                    el.classList.add('wd-anim-item');
                    delay += STAGGER_LIST;
                }
            });
        });
    });
}
