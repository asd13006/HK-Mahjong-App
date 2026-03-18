/* ==========================================
   🀄 常數定義 (constants.js)
   ========================================== */

export const APP_VERSION = 'v2.10.5';

export const TILE_DEFS = [
    { type: 'w', label: '萬', count: 9, startId: 0 },
    { type: 't', label: '筒', count: 9, startId: 9 },
    { type: 's', label: '索', count: 9, startId: 18 },
    { type: 'z', names: ['東', '南', '西', '北', '中', '發', '白'], startId: 27 },
];

export const CONDITIONS = [
    { id: 'selfDrawn', label: '自摸 (1番)', faan: 1 },
    { id: 'concealed', label: '門前清 (1番)', faan: 1 },
    { id: 'lastTile', label: '海底撈月 (1番)', faan: 1 },
    { id: 'kongSelfDrawn', label: '槓上自摸 (2番)', faan: 2 },
    { id: 'doubleKongSelfDrawn', label: '槓上槓自摸 (8番)', faan: 8 },
    { id: 'robKong', label: '搶槓 (1番)', faan: 1 },
    { id: 'heaven', label: '天糊 (13番)' },
    { id: 'earth', label: '地糊 (13番)' },
];

export const FLOWERS = [
    { id: 's1', name: '春', group: 'season', wind: 0 },
    { id: 's2', name: '夏', group: 'season', wind: 1 },
    { id: 's3', name: '秋', group: 'season', wind: 2 },
    { id: 's4', name: '冬', group: 'season', wind: 3 },
    { id: 'p1', name: '梅', group: 'plant', wind: 0 },
    { id: 'p2', name: '蘭', group: 'plant', wind: 1 },
    { id: 'p3', name: '菊', group: 'plant', wind: 2 },
    { id: 'p4', name: '竹', group: 'plant', wind: 3 },
];

// 牌 ID 常數（避免魔術數字）
export const SUIT_SIZE = 9;
export const WIND_START = 27;
export const DRAGON_START = 31;
export const TOTAL_TILE_TYPES = 34;
export const WIND_IDS = [27, 28, 29, 30];
export const DRAGON_IDS = [31, 32, 33];
export const ORPHAN_IDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

// 條件衝突對應表
export const CONDITION_CONFLICTS = {
    heaven: { clearAll: true },
    earth: { clearAll: true },
    selfDrawn: { remove: ['robKong'] },
    robKong: { remove: ['selfDrawn', 'kongSelfDrawn', 'doubleKongSelfDrawn', 'lastTile'] },
    kongSelfDrawn: { require: ['selfDrawn'], remove: ['robKong', 'lastTile', 'doubleKongSelfDrawn'] },
    doubleKongSelfDrawn: { require: ['selfDrawn'], remove: ['robKong', 'lastTile', 'kongSelfDrawn'] },
    lastTile: { remove: ['kongSelfDrawn', 'doubleKongSelfDrawn', 'robKong'] },
};

// 取消條件時的連帶清除規則
export const CONDITION_DEACTIVATE = {
    selfDrawn: ['kongSelfDrawn', 'doubleKongSelfDrawn'],
};

// 列表交錯動畫節奏（秒）
export const STAGGER_BLOCK = 0.10; // 頁面大區塊
export const STAGGER_LIST = 0.08; // 一般列表項
export const STAGGER_DENSE = 0.05; // 密集列表項
