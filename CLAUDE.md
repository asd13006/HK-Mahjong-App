# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

香港麻雀計番神器 — 純 vanilla JavaScript PWA，無框架、無建置工具。在瀏覽器中直接執行 `index.html` 即可。

## 開發執行

```bash
python -m http.server 8000      # 或 npx serve .
```

無 lint、無測試、無 build pipeline。手動在瀏覽器中測試（特別注意 mobile viewport max-width: 420px）。

## 架構總覽

**模組化 SPA** — `index.html` 是唯一切入點，以 `<script type="module">` 載入 `js/app.js`。`app.js` 是入口/初始化器，從各 UI 模組匯入函式並綁定事件。所有模組透過 `js/state.js` 共享一個可變的 `state` 物件。

### 檔案職責

| 檔案 | 職責 |
|------|------|
| `js/constants.js` | 版號、牌定義、條件清單、條件互斥規則、動畫節奏常數 |
| `js/state.js` | 單一共享可變 state 物件（`hand[]`, `activeConditions`, `activeFlowers`, `roundWind`, `seatWind` 等） |
| `js/engine.js` | 計番核心：牌型拆解（`findAllMelds` 遞迴）、特殊牌型判定、番數計算 |
| `js/utils.js` | 通用工具：`attachFastClick`（自訂觸控處理）、`escapeHTML`、`debounce`、localStorage 安全讀寫 |
| `js/animation.js` | 頁面切換、區塊交錯進場動畫、高度平滑過渡 |
| `js/ui-input.js` | 手牌選擇頁：鍵盤、手牌 grid、花牌、條件互斥、風位選擇 |
| `js/ui-result.js` | 結算結果頁：執行計番引擎、顯示結果、自動儲存歷史 |
| `js/ui-history.js` | 歷史戰績頁：渲染歷史列表、統計儀表板（勝率、最高番數） |
| `js/ui-wiki.js` | 番種百科：搜尋/篩選、列表/網格渲染、每日一役、詳情頁 |
| `js/ui-profile.js` | 個人檔案：等級系統、勳章解鎖、累計統計 |
| `data.js` | 靜態資料：`DICTIONARY` 陣列（所有番種的 name/faan/desc/tips/vars/preview） |
| `style.css` | 全域樣式：玻璃擬態設計系統、CSS 變數主題、動畫、RWD |
| `sw.js` | Service Worker：cache-first 策略 + Google Fonts stale-while-revalidate |

### 頁面結構（5 頁 SPA）

- `page-input` — 手牌選擇（鍵盤 + 手牌 grid + 動態島設定）
- `page-result` — 結算結果（hero card + 詳情列表 + 返回按鈕）
- `page-history` — 生涯戰績（統計 + 歷史列表）
- `page-wiki` — 番種百科（搜尋 + 篩選 + 列表/網格）
- `page-wiki-detail` — 番種詳情（浮動返回鍵）
- `page-profile` — 個人檔案（等級 + 勳章 + 設定）

切換透過 `switchPage()`（`animation.js`），以 CSS `.page.active` 控制可見性。

### 關鍵資料結構

- **牌 ID 系統**：`0-8` 萬、`9-17` 筒、`18-26` 索、`27-30` 風牌（東南西北）、`31-33` 三元牌（中發白）。共 34 種牌型，每種最多 4 張。
- **花牌**：`s1-s4`（春夏秋冬）、`p1-p4`（梅蘭菊竹），對應風位 0-3（東南西北）。
- **手牌**：`state.hand` 為 `[{ id: number, key: number }]`，key 是遞增的唯一識別碼用於 FLIP 動畫。
- **條件衝突**：定義在 `CONDITION_CONFLICTS` 和 `CONDITION_DEACTIVATE` 中，支援 `clearAll`、`require`、`remove` 規則。

### 計番引擎流程

1. `runEngine()` 先檢查特殊牌型（天糊/地糊/十三么/九子連環/花糊/八仙過海）
2. 否則對每種可能的眼（count ≥ 2）遞迴找出所有合法搭子組合（`findAllMelds`）
3. 對每個有效拆解呼叫 `evaluateStandardPatterns()` 計算番數
4. 取最高番數結果，不足 3 番則判定詐糊
5. 結果自動寫入 localStorage（最多 50 筆），含重複防護（5 秒內相同結果不重複儲存）

### 事件處理模式

不使用 `onclick`，所有互動透過 `attachFastClick(el, callback, tapClass)` 綁定。它實作自訂觸控處理（touchstart → touchend，搭配 10px 滑動閾值判斷非捲動操作），並以 `AbortController` 支援清理。點擊事件被 `preventDefault()` 阻擋，完全以自訂邏輯取代。

### PWA / Service Worker

`sw.js` 版號需與 `constants.js` 中的 `APP_VERSION` 同步。快取名稱含版號以實現自動更新。安裝時以 `?_bust=` 參數強制繞過 HTTP 快取。`index.html` 中的 inline script 處理 SW 註冊、更新偵測與自動重載。

### CSS 設計系統

玻璃擬態（glassmorphism）為主要視覺風格，以 CSS 自訂屬性定義（`--glass-bg`、`--glass-border` 等）。主容器 `max-width: 420px`，mobile-first。支援三種背景模式：`.success-mode`（綠色）、`.limit-mode`（金色爆棚）、`.failure-mode`（紅色詐糊）。
