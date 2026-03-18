/* ==========================================
   🧮 計番引擎核心 (engine.js)
   ========================================== */

import { SUIT_SIZE, WIND_START, DRAGON_START, TOTAL_TILE_TYPES, WIND_IDS, DRAGON_IDS, ORPHAN_IDS, CONDITIONS } from './constants.js';
import { state } from './state.js';

export function getTileInfo(id) {
    if (id < SUIT_SIZE) return { type: 'w', num: id + 1, suit: '萬' };
    if (id < SUIT_SIZE * 2) return { type: 't', num: id - SUIT_SIZE + 1, suit: '筒' };
    if (id < WIND_START) return { type: 's', num: id - SUIT_SIZE * 2 + 1, suit: '索' };
    const zNames = ['東', '南', '西', '北', '中', '發', '白'];
    return { type: 'z', num: zNames[id - WIND_START], suit: '' };
}

export function findAllMelds(counts, index, currentMelds, allValidMelds) {
    if (currentMelds.length === 4) {
        let isValid = true;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
            if (counts[i] !== 0) {
                isValid = false;
                break;
            }
        }
        if (isValid) allValidMelds.push([...currentMelds]);
        return;
    }
    while (index < TOTAL_TILE_TYPES && counts[index] === 0) index++;
    if (index === TOTAL_TILE_TYPES) return;
    if (counts[index] >= 4) {
        counts[index] -= 4;
        currentMelds.push({ type: 'kong', val: index });
        findAllMelds(counts, index, currentMelds, allValidMelds);
        currentMelds.pop();
        counts[index] += 4;
    }
    if (counts[index] >= 3) {
        counts[index] -= 3;
        currentMelds.push({ type: 'pong', val: index });
        findAllMelds(counts, index, currentMelds, allValidMelds);
        currentMelds.pop();
        counts[index] += 3;
    }
    if (index < WIND_START && index % SUIT_SIZE <= 6) {
        if (counts[index] > 0 && counts[index + 1] > 0 && counts[index + 2] > 0) {
            counts[index]--;
            counts[index + 1]--;
            counts[index + 2]--;
            currentMelds.push({ type: 'chow', start: index });
            findAllMelds(counts, index, currentMelds, allValidMelds);
            counts[index]++;
            counts[index + 1]++;
            counts[index + 2]++;
            currentMelds.pop();
        }
    }
}

export function getCurrentMax() {
    let counts = new Array(TOTAL_TILE_TYPES).fill(0);
    state.hand.forEach((item) => counts[item.id]++);
    let kongs = 0;
    counts.forEach((c) => {
        if (c === 4) kongs++;
    });
    let max = 14 + kongs;
    if (state.hand.length >= 14) {
        let tempCounts = [...counts];
        if (checkWinCondition(tempCounts)) return state.hand.length;
    }
    return max;
}

function checkWinCondition(counts) {
    if (isThirteenOrphans(counts) || isNineGates(counts)) return true;
    if (state.activeConditions.has('heaven') || state.activeConditions.has('earth')) return true;
    for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
        if (counts[i] >= 2) {
            let tempCounts = [...counts];
            tempCounts[i] -= 2;
            let allValidMelds = [];
            findAllMelds(tempCounts, 0, [], allValidMelds);
            if (allValidMelds.length > 0) return true;
        }
    }
    return false;
}

export function validateTileId(id) {
    return Number.isInteger(id) && id >= 0 && id < TOTAL_TILE_TYPES;
}

export function validateHand() {
    const counts = new Array(TOTAL_TILE_TYPES).fill(0);
    for (const item of state.hand) {
        if (!validateTileId(item.id)) return false;
        counts[item.id]++;
        if (counts[item.id] > 4) return false;
    }
    const kongs = counts.filter((c) => c === 4).length;
    if (state.hand.length > 14 + kongs) return false;
    return true;
}

function getExtras(counts) {
    let faan = 0;
    let tags = [];
    let fCount = state.activeFlowers.size;
    if (fCount === 0) {
        faan += 1;
        tags.push({ text: '無花 (1番)' });
    } else if (fCount === 8) {
        faan += 8;
        tags.push({ text: '大花胡 (8番)' });
    } else if (fCount === 7) {
        faan += 3;
        tags.push({ text: '花胡 (3番)' });
    } else {
        let hasSeasonSet = ['s1', 's2', 's3', 's4'].every((id) => state.activeFlowers.has(id));
        let hasPlantSet = ['p1', 'p2', 'p3', 'p4'].every((id) => state.activeFlowers.has(id));
        if (hasSeasonSet) {
            faan += 2;
            tags.push({ text: '一台花 [四季] (2番)' });
        }
        if (hasPlantSet) {
            faan += 2;
            tags.push({ text: '一台花 [四君] (2番)' });
        }
        if (!hasSeasonSet && state.activeFlowers.has(`s${state.seatWind + 1}`)) {
            faan += 1;
            tags.push({ text: '正花 (1番)' });
        }
        if (!hasPlantSet && state.activeFlowers.has(`p${state.seatWind + 1}`)) {
            faan += 1;
            tags.push({ text: '正花 (1番)' });
        }
    }
    let condFaan = 0;
    CONDITIONS.forEach((cond) => {
        if (cond.id === 'heaven' || cond.id === 'earth') return;
        if (state.activeConditions.has(cond.id) && cond.faan) {
            if (
                cond.id === 'selfDrawn' &&
                (state.activeConditions.has('kongSelfDrawn') ||
                    state.activeConditions.has('doubleKongSelfDrawn'))
            )
                return;
            condFaan += cond.faan;
            tags.push({ text: cond.label });
        }
    });
    faan += condFaan;
    return { faan, tags };
}

export function isNineGates(counts) {
    let sum = 0;
    for (let i = 0; i < TOTAL_TILE_TYPES; i++) sum += counts[i];
    if (sum !== 14) return false;
    for (let s = 0; s < 3; s++) {
        let start = s * SUIT_SIZE;
        let suitSum = 0;
        for (let i = 0; i < SUIT_SIZE; i++) suitSum += counts[start + i];
        if (suitSum === 14) {
            let base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
            let isValid = true;
            for (let i = 0; i < SUIT_SIZE; i++) if (counts[start + i] < base[i]) isValid = false;
            if (isValid) return true;
        }
    }
    return false;
}

export function isThirteenOrphans(counts) {
    let sum = 0;
    for (let i = 0; i < TOTAL_TILE_TYPES; i++) sum += counts[i];
    if (sum !== 14) return false;
    let hasPair = false;
    for (let id of ORPHAN_IDS) {
        if (counts[id] === 0) return false;
        if (counts[id] === 2) hasPair = true;
    }
    return hasPair;
}

export function evaluateStandardPatterns(breakdown, counts) {
    let faan = 0;
    let tags = [];
    let isExceptional = false;
    let kongsCount = 0;
    for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
        if (counts[i] === 4) kongsCount++;
    }
    let suits = new Set();
    let hasZ = false;
    for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
        if (counts[i] > 0) {
            if (i < SUIT_SIZE) suits.add('w');
            else if (i < SUIT_SIZE * 2) suits.add('t');
            else if (i < WIND_START) suits.add('s');
            else hasZ = true;
        }
    }
    if (suits.size === 0 && hasZ) {
        faan += 10;
        tags.push({ text: '字一色 (10番)' });
        isExceptional = true;
    } else if (suits.size === 1) {
        if (kongsCount < 4) {
            if (!hasZ) {
                faan += 7;
                tags.push({ text: '清一色 (7番)' });
            } else {
                faan += 3;
                tags.push({ text: '混一色 (3番)' });
            }
        }
    }
    const isAllPongs = breakdown.melds.every((m) => m.type === 'pong' || m.type === 'kong');
    const isAllChows = breakdown.melds.every((m) => m.type === 'chow');
    if (isAllPongs) {
        let isAllTerminals = true;
        for (let i = 0; i < TOTAL_TILE_TYPES; i++) {
            if (counts[i] > 0 && i < WIND_START && i % SUIT_SIZE !== 0 && i % SUIT_SIZE !== 8) isAllTerminals = false;
        }
        if (isAllTerminals && !hasZ) {
            faan += 10;
            tags.push({ text: '清么九 (10番)' });
            isExceptional = true;
        } else if (isAllTerminals && hasZ) {
            if (kongsCount < 4) {
                faan += 4;
                tags.push({ text: '花么九 (4番)' });
            }
        } else if (state.activeConditions.has('concealed') && kongsCount < 4) {
            faan += 8;
            tags.push({ text: '坎坎糊 (8番)' });
            isExceptional = true;
        } else if (kongsCount < 4) {
            faan += 3;
            tags.push({ text: '對對糊 (3番)' });
        }
        if (kongsCount === 4) {
            faan += 13;
            tags.push({ text: '十八羅漢 (13番)' });
            isExceptional = true;
        }
    } else if (isAllChows) {
        faan += 1;
        tags.push({ text: '平糊 (1番)' });
    }
    let dPongs = 0,
        dEyes = 0;
    DRAGON_IDS.forEach((id) => {
        if (counts[id] >= 3) dPongs++;
        else if (counts[id] === 2) dEyes++;
    });
    if (dPongs === 3) {
        faan += 8;
        tags.push({ text: '大三元 (8番)' });
        isExceptional = true;
    } else if (dPongs === 2 && dEyes === 1) {
        faan += 5;
        tags.push({ text: '小三元 (5番)' });
    } else if (dPongs > 0) {
        if (counts[DRAGON_START] >= 3) {
            faan += 1;
            tags.push({ text: '紅中 (1番)' });
        }
        if (counts[DRAGON_START + 1] >= 3) {
            faan += 1;
            tags.push({ text: '發財 (1番)' });
        }
        if (counts[DRAGON_START + 2] >= 3) {
            faan += 1;
            tags.push({ text: '白板 (1番)' });
        }
    }
    let wPongs = 0,
        wEyes = 0;
    WIND_IDS.forEach((id) => {
        if (counts[id] >= 3) wPongs++;
        else if (counts[id] === 2) wEyes++;
    });
    if (wPongs === 4) {
        faan += 13;
        tags.push({ text: '大四喜 (13番)' });
        isExceptional = true;
    } else if (wPongs === 3 && wEyes === 1) {
        faan += 6;
        tags.push({ text: '小四喜 (6番)' });
        isExceptional = true;
    } else {
        if (!isExceptional) {
            let roundWindId = WIND_START + state.roundWind;
            let seatWindId = WIND_START + state.seatWind;
            let windNames = ['東', '南', '西', '北'];
            if (counts[roundWindId] >= 3) {
                faan += 1;
                tags.push({ text: `${windNames[state.roundWind]}圈 (1番)` });
            }
            if (counts[seatWindId] >= 3) {
                faan += 1;
                tags.push({ text: `${windNames[state.seatWind]}位 (1番)` });
            }
        }
    }
    if (!isExceptional) {
        let extras = getExtras(counts);
        faan += extras.faan;
        tags.push(...extras.tags);
    }
    if (faan === 0 && !isExceptional) tags.push({ text: '雞糊 (0番)' });
    return { faan, tags };
}
