/* ==========================================
   💾 共享應用狀態 (state.js)
   ========================================== */

export const state = {
    hand: [],
    activeConditions: new Set(),
    roundWind: 0,
    seatWind: 0,
    activeFlowers: new Set(),
    tileKeyCounter: 0,
    lastMax: 14,
    wikiScrollPos: 0,
    wikiDetailTransitioning: false,
    currentResultSnapshot: null,
    isClearing: false,
};
