# AGENTS.md - Hong Kong Mahjong Scoring App

## Project Overview

This is a vanilla JavaScript PWA (Progressive Web App) for calculating Hong Kong Mahjong hand scores. The project has no build system, no tests, and uses pure browser-based JavaScript.

**Tech Stack:**
- Vanilla JavaScript (ES6+)
- HTML5 / CSS3
- No frameworks, no build tools
- PWA with Service Worker

---

## Commands

### Running the App

Since this is a vanilla JS project with no build system, simply open `index.html` in a browser. For local development with Service Worker support, use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then visit `http://localhost:8000`

### No Available Commands

- **No linting**: No ESLint or other linter configured
- **No tests**: No testing framework present
- **No build**: No npm/webpack/vite build pipeline

---

## Code Style Guidelines

### File Structure

| File | Purpose |
|------|---------|
| `app.js` | Core application logic (game engine, UI, state management) |
| `data.js` | Static data: DICTIONARY array containing all mahjong hand patterns |
| `index.html` | Main HTML structure with inline SVG |
| `style.css` | All styling (glassmorphism design system) |
| `sw.js` | Service Worker for PWA offline support |
| `manifest.json` | PWA manifest |
| `tiles/` | SVG tile images (w1-w9, t1-t9, s1-s9, z1-z7, f1-f8) |

### JavaScript Conventions

**Naming:**
- Use `camelCase` for variables and functions: `hand`, `addTile()`, `activeConditions`
- Use `PascalCase` for constructor-like patterns: not used in this project
- Constants in `UPPER_SNAKE_CASE`: `APP_VERSION`, `TILE_DEFS`

**Functions:**
- Single responsibility: Each function does one thing
- Helper functions at top: `attachFastClick()`, `smoothHeightUpdate()`, `switchPage()`
- Main functions grouped by feature at bottom: `init()`, `runEngine()`, `renderHand()`

**Variables:**
- Declare with `let` for mutable state: `let hand = []`
- Use `const` for references: `const TILE_DEFS = [...]`
- Avoid global pollution - all app state in single scope or as module globals

**Data Structures:**
```javascript
// Tiles: 0-8 = wan (萬), 9-17 = tong (筒), 18-26 = suo (索), 27-33 = zi (字)
let hand = []; // Array of { id: number, key: number }
let activeConditions = new Set(); // Condition IDs
let activeFlowers = new Set(); // Flower IDs like 's1', 'p2'
```

### HTML Conventions

- Use semantic HTML5: `<nav>`, `<header>`, `<section>`
- Inline SVG for tile images (referenced via CSS `background-image`)
- Single-page app with CSS-based page switching (`.page.active`)
- Data attributes for DOM binding: `data-target`, `data-key`, `data-filter`

### CSS Conventions

- CSS custom properties for theming: `--glass-bg`, `--glass-border`
- Glassmorphism design system throughout
- BEM-like class naming: `.glass-card`, `.history-card`, `.tile`
- Mobile-first responsive: max-width 420px container
- CSS animations for transitions (avoid JS-based animations when possible)

### Error Handling

- Minimal error handling in this legacy codebase
- Use `if (!el) return` guards for DOM operations
- No try/catch patterns currently in use

### Comments

- Use Chinese comments throughout (project language)
- Section headers with emoji markers:
```javascript
/* ==========================================
   🧠 香港麻雀計番神器 - 核心運作大腦 (app.js)
   ========================================== */
```

---

## Key Patterns

### Custom FastClick Handler

The app uses custom touch handling instead of onclick for better mobile response:

```javascript
function attachFastClick(el, action, tapClass = '') {
    // Custom implementation for instant touch feedback
}
```

### Page Switching

```javascript
function switchPage(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
}
```

### State Management

All state is global or local to `app.js`:
- `hand` - Array of selected tiles
- `activeConditions` - Set of special condition flags
- `activeFlowers` - Set of selected flower tiles
- `roundWind`, `seatWind` - Wind values (0-3)

---

## Common Tasks

### Adding a New Hand Pattern

1. Add entry to `DICTIONARY` array in `data.js`:
```javascript
{ 
    name: "新牌型", f: 3, type: 'common', icon: '🀄', 
    d: "描述", preview: ['w1','w2','w3'], 
    desc: "詳細說明", tips: [...] 
}
```

2. Add scoring logic in `evaluateStandardPatterns()` in `app.js`

### Adding a New Condition

1. Add to `CONDITIONS` array in `app.js`:
```javascript
{ id: 'conditionId', label: '顯示名稱 (番數)', faan: 1 }
```

2. Handle mutual exclusivity in `renderConditions()` click handler

### Modifying Styles

- All styles in `style.css`
- Follow existing glassmorphism patterns (backdrop-filter, rgba borders)
- Test on mobile viewport (max 420px width)

---

## Testing

**No test framework exists.** Manual testing required:
1. Open in browser
2. Select tiles and verify hand renders
3. Calculate and verify score matches expected
4. Test history saving/loading
5. Test PWA offline mode

---

## PWA / Service Worker

- `sw.js` handles caching for offline use
- Update detection with `isUpdateReady` flag
- Trigger update via Service Worker message

---

## References

- Mahjong tile IDs: 0-33 (see `TILE_DEFS` in app.js)
- Flower IDs: 's1'-'s4' (seasons), 'p1'-'p4' (plants)
- Condition IDs: see `CONDITIONS` array
