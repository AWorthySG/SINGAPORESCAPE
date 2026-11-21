// Click audit: how many taps (or key presses), how many typed letters and how
// far the pointer travels for about fifteen everyday jobs, on a desktop
// (mouse and keyboard) and a phone (390x844, touch). Each job lists the ways
// the interface offers to do it; a way whose first control isn't on screen
// (the quick bar or command search before they existed, a key on a phone) is
// skipped, and the cheapest way that works is reported. Re-run it after a UI
// change to see what got easier.
//
//   node tools/ux/clickaudit.mjs [--out audit.md] [--only bank,eat] [--port 8790]
//
// It starts its own copy of serve.mjs, drives the game with Playwright
// (Chromium), sets each job up through window.SS, and lets game time run
// quickly (whole ticks in a loop) while a trip walks, so a run takes a minute
// or two. Walking itself is never counted: only what the player presses.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const PORT = Number(args.port || 8790);
const ONLY = args.only ? new Set(args.only.split(',')) : null;

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return req(p); } catch { /* next */ } }
  throw new Error('Playwright is not installed (npm i -g playwright, then npx playwright install chromium).');
}

// ---------------------------------------------------------------- the jobs
// setup(): page code run before each way (window.SS is the game); ways: [{ name,
// needs?: 'keyboard', run(h) }]; done: page code that is true when the job is done.
const JOBS = [
  {
    id: 'bank', name: 'Bank a full load and come back',
    setup: `(() => { J.place(...J.openGround(J.nearest('bank_booth'), 24)); J.fill('logs'); window.__start = J.tile(); })()`,
    done: `!SS.game.inventory.count('logs') && J.dist(window.__start) <= 16`,   // most of the way back (a long walk on foot can stop short of the tile tapped)
    ways: [
      { name: 'Map, bank marker, Go, Deposit loot, map back', run: async (h) => {
        await h.tap('#map-btn'); await h.mapTap(`J.nearest('bank_booth')`); await h.mapGo(); await h.settle(`/Bank/.test(SS.ui.modal?.title || '')`);
        await h.tap('.bank-deposit-loot'); await h.tap('#modal-close'); await h.backHome();
      } },
      { name: 'Quick bar Bank, Deposit loot, map back', run: async (h) => {
        await h.tap('#quickbar [data-action="bank"]'); await h.settle(`/Bank/.test(SS.ui.modal?.title || '')`);
        await h.tap('.bank-deposit-loot'); await h.tap('#modal-close'); await h.backHome();
      } },
      { name: 'Search "bank", Deposit loot, map back', run: async (h) => {
        await h.search('bank'); await h.settle(`/Bank/.test(SS.ui.modal?.title || '')`);
        await h.tap('.bank-deposit-loot'); await h.tap('#modal-close'); await h.backHome();
      } },
    ],
  },
  {
    id: 'deposit', name: 'Deposit loot (standing at a bank)',
    setup: `(() => { J.next('bank_booth'); J.fill('logs', 10); })()`,
    done: `!SS.game.inventory.count('logs')`,
    ways: [
      { name: 'Interact, Deposit loot, close', run: async (h) => { await h.interact(`J.nearest('bank_booth')`); await h.settle(`/Bank/.test(SS.ui.modal?.title || '')`); await h.tap('.bank-deposit-loot'); await h.tap('#modal-close'); } },
      { name: 'Quick bar Bank, Deposit loot, close', run: async (h) => { await h.tap('#quickbar [data-action="bank"]'); await h.settle(`/Bank/.test(SS.ui.modal?.title || '')`); await h.tap('.bank-deposit-loot'); await h.tap('#modal-close'); } },
    ],
  },
  {
    id: 'smelt', name: 'Smelt bars (Smelt all)',
    setup: `(() => { J.next('furnace'); J.give('copper_ore', 5); J.give('tin_ore', 5); })()`,
    done: `!!SS.game.player.action || SS.game.inventory.count('bronze_bar') > 0`,
    ways: [
      { name: 'Interact, Smelt all', run: async (h) => { await h.interact(`J.nearest('furnace')`); await h.settle(`!!SS.ui.modal`); await h.tap('.do-all'); } },
      { name: 'Search "smlt", Go, Smelt all', run: async (h) => { await h.search('smlt', true); await h.settle(`!!SS.ui.modal`); await h.tap('.do-all'); } },
    ],
  },
  {
    id: 'shop', name: 'Buy food at a shop',
    setup: `(() => { const n = SS.game.npcs.find((x) => x.npcId === 'hawker'); n.wander = 0; J.place(n.x, n.y + 1); J.give('coins', 500); window.__food = SS.game.inventory.count('kaya_toast'); })()`,
    done: `SS.game.inventory.count('kaya_toast') > window.__food`,
    ways: [
      { name: 'Interact, tap the food', run: async (h) => { await h.interact(`SS.game.npcs.find((x) => x.npcId === 'hawker')`); await h.settle(`!!SS.ui.modal`); await h.tap('.item-grid.shop .item-cell'); } },
    ],
  },
  {
    id: 'quest', name: 'Start or continue the next quest step',
    setup: `(() => { J.town(); })()`,
    done: `SS.game.player.isMoving || !!SS.game.player.action || !!SS.ui.modal`,
    ways: [
      { name: 'Objectives Go', run: async (h) => { await h.tap('#quest-tracker .trk-go'); } },
      { name: 'Journal tab, quest row', run: async (h) => { await h.panel('quests'); await h.tap('.quest-row'); } },
      { name: 'Quick bar Next quest', run: async (h) => { await h.tap('#quickbar [data-action="quest"]'); } },
    ],
  },
  {
    id: 'enchant', name: 'Enchant an item',
    setup: `(() => { J.town(); J.give('upgrade_stone', 20); J.give('coins', 5000); })()`,
    done: `/Enchant/.test(SS.ui.modal?.title || '')`,
    ways: [
      { name: 'Bag, Gear, Gear mastery, Enchant', run: async (h) => { await h.panel('equipment'); await h.tapText('.bestiary-open', 'Gear mastery & enchanting'); await h.tapText('.mastery-row button', 'Enchant'); } },
      { name: 'Search "ench", Enchant', run: async (h) => { await h.search('ench'); await h.tapText('.mastery-row button', 'Enchant'); } },
    ],
  },
  {
    id: 'shrine', name: 'Offer gear at the shrine',
    setup: `(() => { J.town(); J.give('bronze_sword', 1); window.__pts = SS.game.shrine.points; })()`,
    done: `SS.game.shrine.points > window.__pts`,
    ways: [
      { name: 'Map, Travel, a step, Interact, offer', run: async (h) => {
        await h.tap('#map-btn'); await h.mapTap(`J.nearest('offering_shrine')`); await h.mapGo(); await h.settle(`J.still()`);
        await h.nudge(`J.nearest('offering_shrine')`); await h.interact(`J.nearest('offering_shrine')`); await h.settle(`!!SS.ui.modal`); await h.offer();
      } },
      { name: 'Search "shrine", offer', run: async (h) => { await h.search('shrine'); await h.settle(`!!SS.ui.modal`); await h.offer(); } },
    ],
  },
  {
    id: 'equip', name: 'Equip a better item',
    setup: `(() => { J.town(); J.give('steel_dagger', 1); })()`,
    done: `['weapon', 'offhand'].some((s) => SS.game.equipment.get(s) === 'steel_dagger')`,
    ways: [
      { name: 'Bag, tap the item', run: async (h) => { await h.panel('inventory'); await h.tap(`.inv-slot[data-id="steel_dagger"], .inv-slot:has(img[src*="steel_dagger"])`); } },
      { name: 'Search the item, Equip', run: async (h) => { await h.search('steel dag'); } },
    ],
  },
  {
    id: 'guide', name: 'Open the skill guide for a skill',
    setup: `(() => { J.town(); })()`,
    done: `/Mining/.test(SS.ui.modal?.title || '')`,
    ways: [
      { name: 'Skills tab, tap Mining', run: async (h) => { await h.panel('skills'); await h.tap('.skill-cell:has(.skill-name:text-is("Mining"))'); } },
      { name: 'Search "mini"', run: async (h) => { await h.search('mini'); } },
    ],
  },
  {
    id: 'battle', name: 'Toggle auto battle',
    setup: `(() => { J.town(); if (SS.game.autoBattle) SS.game.toggleAutoBattle(false); })()`,
    done: `!!SS.game.autoBattle`,
    ways: [
      { name: 'T key', needs: 'keyboard', run: async (h) => { await h.key('t'); } },
      { name: 'Auto, Battle', run: async (h) => { await h.tap('#auto-menu-btn'); await h.tap('#auto-battle-btn'); } },
      { name: 'Quick bar Auto battle', run: async (h) => { await h.tap('#quickbar [data-action="battle"]'); } },
    ],
  },
  {
    id: 'prayer', name: 'Change a blessing',
    setup: `(() => { J.town(); SS.game.activePrayers.clear(); SS.game.bus.emit('prayer'); })()`,
    done: `SS.game.activePrayers.size > 0`,
    ways: [
      { name: 'Combat tab, Prayer, tap a blessing', run: async (h) => { await h.panel('prayer'); await h.tap('.prayer-cell:not(.locked)'); } },
      { name: 'Search "bless", tap a blessing', run: async (h) => { await h.search('bless'); await h.tap('.prayer-cell:not(.locked)'); } },
    ],
  },
  {
    id: 'travel', name: 'Open the map and travel to a region',
    setup: `(() => { J.town(); window.__start = J.tile(); window.__zone = SS.game.world.zones.find((z) => z.name === 'Chinatown') || SS.game.world.zones[3]; })()`,
    done: `SS.game.player.isMoving || (SS.game.player.path || []).length > 0 || J.dist(window.__start) > 5`,
    ways: [
      { name: 'Map, tap the region, Travel here', run: async (h) => { await h.tap('#map-btn'); await h.mapTap(`({ x: Math.round((window.__zone.x0 + window.__zone.x1) / 2), y: Math.round((window.__zone.y0 + window.__zone.y1) / 2) })`); await h.mapGo(); } },
      { name: 'Search the region, Go', run: async (h) => { await h.search('chinat'); } },
    ],
  },
  {
    id: 'eat', name: 'Eat or drink to heal',
    setup: `(() => { J.town(); J.give('cooked_chicken', 3); SS.game.player.hp = Math.max(1, Math.floor(SS.game.maxHp() / 3)); window.__hp = SS.game.player.hp; })()`,
    done: `SS.game.player.hp > window.__hp`,
    ways: [
      { name: 'F key', needs: 'keyboard', run: async (h) => { await h.key('f'); } },
      { name: 'Quick-use button', run: async (h) => { await h.tap('#quick-slot'); } },
      { name: 'Bag, tap the food', run: async (h) => { await h.panel('inventory'); await h.tap('.inv-slot:has(img[src*="cooked_chicken"])'); } },
      { name: 'Quick bar Eat', run: async (h) => { await h.tap('#quickbar [data-action="eat"]'); } },
    ],
  },
  {
    id: 'potion', name: 'Drink a potion',
    setup: `(() => { J.town(); for (const k of Object.keys(SS.game.potions)) delete SS.game.potions[k]; J.give('strength_potion', 2); })()`,
    done: `Object.keys(SS.game.potions).length > 0`,
    ways: [
      { name: 'Bag, tap the potion', run: async (h) => { await h.panel('inventory'); await h.tap('.inv-slot:has(img[src*="strength_potion"])'); } },
      { name: 'Search "potion"', run: async (h) => { await h.search('potion'); } },
    ],
  },
  {
    id: 'codex', name: 'Check the Codex for a monster',
    setup: `(() => { J.town(); })()`,
    done: `!!SS.ui.modal && SS.ui._codex?.id === 'toman_tyrant'`,
    ways: [
      { name: 'Journal, Awards, Open Monster Codex, search, tap the Tyrant', run: async (h) => { await h.panel('achievements'); await h.tap('.bestiary-open:not(.compendium-open)'); await h.fill('#modal-body input[type="search"], #modal-body input.bank-search', 'toman'); await h.tap('#modal-body .cx-row[data-id="toman_tyrant"]'); } },
      { name: 'Search "toman"', run: async (h) => { await h.search('toman'); } },
    ],
  },
  {
    id: 'home', name: 'Teleport home',
    setup: `(() => { const b = J.nearest('bank_booth'); J.place(b.x + 10, b.y + 4); SS.game.teleports.townReady = 0; SS.game.teleports._hitTick = -1e9; window.__start = J.tile(); })()`,
    done: `!!SS.game.teleports.cast || J.dist(window.__start) > 10`,
    ways: [
      { name: 'K key', needs: 'keyboard', run: async (h) => { await h.key('k'); } },
      { name: 'Auto, Town', run: async (h) => { await h.tap('#auto-menu-btn'); await h.tap('#tp-town'); } },
      { name: 'Search "home"', run: async (h) => { await h.search('home'); } },
    ],
  },
];

// ---------------------------------------------------------------- page helpers
// Installed once per page as window.J (the jobs' setup code uses them).
const PAGE_HELPERS = `window.J = {
  tile() { const p = SS.game.player; return { x: p.x, y: p.y }; },
  dist(t) { const p = SS.game.player; return Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y)); },
  nearest(id) { const p = SS.game.player; let b = null, bd = Infinity; for (const o of SS.game.world.objects) { if (o.objId !== id) continue; const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (d < bd) { bd = d; b = o; } } return b; },
  place(x, y) { const g = SS.game, t = g._nearestFree?.(x, y) || { x, y }, p = g.player; p.stopNow?.(); p.clearAction?.(); p.x = p.tx = t.x; p.y = p.ty = t.y; p.progress = 0; p.moving = false; p.path = []; },
  next(id) { const o = J.nearest(id); for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1]]) { if (!SS.game.world.isBlocked(o.x + dx, o.y + dy)) { J.place(o.x + dx, o.y + dy); break; } } SS.game.player.facing = { dx: 0, dy: 0 }; return o; },
  // A free tile about r away from o with no map marker (bank, station, shop...) near it, so a tap on the map picks the ground.
  openGround(o, r) {
    const busy = SS.game.world.objects.filter((x) => ['bank', 'transport', 'offering', 'shrine'].includes(x.def.type));
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = o.x + dx * r, y = o.y + dy * r;
      if (!SS.game.world.isBlocked(x, y) && !busy.some((b) => Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) < 8)) return [x, y];
    }
    return [o.x + r, o.y];
  },
  town() { const g = SS.game; const b = J.nearest('bank_booth'); if (J.dist(b) > 12) J.place(b.x, b.y + 3); },
  give(id, n = 1) { SS.game.inventory.add(id, n); SS.game.bus.emit('inventory'); },
  fill(id, n) { const inv = SS.game.inventory; const free = inv.slots.filter((s) => !s).length; for (let i = 0; i < (n ?? free); i++) inv.add(id, 1); SS.game.bus.emit('inventory'); },
  still() { const p = SS.game.player; return !p.isMoving && !(p.path && p.path.length) && !p.action; },
  run(n) { for (let i = 0; i < n; i++) SS.game.update(600); },
};`;

// ---------------------------------------------------------------- the driver
class Skip extends Error {}

function makeH(page, mode, tally) {
  const touch = mode === 'phone';
  const vp = page.viewportSize();
  tally.at = { x: vp.width / 2, y: vp.height / 2 };   // the pointer (or thumb) starts mid-screen
  const press = async (x, y) => {
    tally.taps++;
    tally.travel += Math.hypot(x - tally.at.x, y - tally.at.y);
    tally.at = { x, y };
    if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await page.waitForTimeout(250);
  };
  const box = async (loc, what) => {
    const n = await loc.count();
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible())) continue;
      await el.scrollIntoViewIfNeeded().catch(() => {});   // a scroll is not counted as a tap
      const b = await el.boundingBox();
      if (b && b.width > 0) return b;
    }
    throw new Skip(`${what} is not on screen`);
  };
  const h = {
    async tap(sel) { const b = await box(page.locator(sel), sel); await press(b.x + b.width / 2, b.y + b.height / 2); },
    async tapText(sel, text) { const b = await box(page.locator(sel, { hasText: text }), `${sel} "${text}"`); await press(b.x + b.width / 2, b.y + b.height / 2); },
    async key(k) { if (touch) throw new Skip('no keyboard on a phone'); tally.taps++; await page.keyboard.press(k); await page.waitForTimeout(250); },
    async type(text) { tally.typed += text.length; await page.keyboard.type(text, { delay: 20 }); await page.waitForTimeout(200); },
    async fill(sel, text) { const b = await box(page.locator(sel), sel); await press(b.x + b.width / 2, b.y + b.height / 2); await h.type(text); },
    /** Use the thing beside you: E on a keyboard, else the Interact button
     *  (tapping the world itself does nothing in this game). */
    async interact(_target) {
      await page.waitForTimeout(300);
      // (A banker beside the booth is as good as the booth: the job's check says if it worked.)
      if (!(await page.evaluate(`!!SS.game._findInteract()`))) throw new Skip('nothing to interact with');
      if (touch) await h.tap('#interact-btn'); else await h.key('e');
    },
    /** The last few steps when a trip stops short: one joystick (or WASD)
     *  nudge, counted as one press, that ends beside the thing. */
    async nudge(expr) {
      if (await page.evaluate(`J.dist(${expr}) <= 1`)) return;
      tally.taps++;
      await page.evaluate(`J.next(${expr}.objId)`);
    },
    /** The world map's button for the picked spot: Go (a marker) or Travel here. */
    async mapGo() { await h.tapText('.wm-go', /^(Go|Travel here)$/); },
    /** Tap a tile on the open world map. */
    async mapTap(expr) {
      // (The map can be taller than the screen: scroll the spot into the middle first, as a player would.)
      const at = `(() => { const t = ${expr}; const cv = document.querySelector('.worldmap-canvas'); if (!cv) return null;
        const r = cv.getBoundingClientRect(), s = cv.width / SS.game.world.width, k = r.width / cv.width;
        return { x: r.left + (t.x * s + s / 2) * k, y: r.top + (t.y * s + s / 2) * k }; })()`;
      await page.waitForTimeout(400);   // a window comes back at its remembered scroll a frame or two after opening
      let pt = await page.evaluate(at);
      if (pt && (pt.y < 60 || pt.y > vp.height - 60)) {
        await page.evaluate(`document.getElementById('modal-body').scrollTop += ${Math.round(pt.y - vp.height / 2)}`);
        await page.waitForTimeout(200);
        pt = await page.evaluate(at);
      }
      if (!pt) throw new Skip('no world map');
      await press(pt.x, pt.y);
    },
    /** Let game time run (whole ticks) until a condition holds. */
    async settle(cond, max = 600) {
      const ok = await page.evaluate(`(() => { for (let i = 0; i < ${max}; i++) { if (${cond}) return true; SS.game.update(600); } return !!(${cond}); })()`);
      await page.waitForTimeout(300);
      if (!ok) throw new Skip(`never got to: ${cond}`);
    },
    /** Open a side-panel view the way a player does: its tab (and sub-tab). */
    async panel(view) {
      const tab = { inventory: 'inventory', equipment: 'inventory', skills: 'skills', combat: 'combat', prayer: 'combat', stats: 'combat', quests: 'quests', achievements: 'quests', story: 'quests', settings: 'settings' }[view];
      // A folded phone panel shows only its launcher (the active tab): tap it first.
      if (await page.evaluate(`document.getElementById('sidepanel').classList.contains('collapsed')`)) await h.tap('#panel-tabs .tab-btn.active');
      if (!(await page.evaluate(`document.querySelector('#panel-tabs .tab-btn[data-view="${tab}"]').classList.contains('active')`))) await h.tap(`#panel-tabs .tab-btn[data-view="${tab}"]`);
      // A tab remembers the sub-tab it last showed (Bag or Gear...): pick the one wanted.
      if (await page.locator(`.subtab-btn[data-view="${view}"]:not(.active)`).count()) await h.tap(`.subtab-btn[data-view="${view}"]`);
    },
    /** Command search: open it (/ on a keyboard, the magnifier on a phone),
     *  type, then Enter (or tap the first result; `alt`: its second button). */
    async search(text, alt = false) {
      if (!(await page.locator('#qb-search').count())) throw new Skip('no command search');
      if (touch) await h.tap('#qb-search'); else await h.key('/');
      await h.type(text);
      if (alt) await h.tap('#cmd-search .cs-row.sel .cs-alt');
      else if (touch) await h.tap('#cmd-search .cs-row.sel .cs-main');
      else await h.key('Enter');
    },
    /** In the shrine window: offer the spare gear (and confirm if it asks). */
    async offer() {
      await h.tap('#modal-body .salvage-row:has(img[src*="bronze_sword"]) .qty-btns button');
      await h.tap('#modal-body .salvage-go');
    },
    /** The trip back: map, the tile you started on, Travel here. */
    async backHome() { await h.tap('#map-btn'); await h.mapTap('window.__start'); await h.mapGo(); await h.settle('J.still()'); },
  };
  return h;
}

async function boot(browser, mode) {
  const ctx = await browser.newContext(mode === 'phone'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${mode}] page error:`, e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.click('#splash-enter', { timeout: 60000 });
  await page.click('text=Rogue');
  await page.waitForTimeout(1200);
  await page.click('text=Skip', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.evaluate(PAGE_HELPERS);
  await page.evaluate('window.__origin = J.tile()');   // every way starts from here
  await page.evaluate(`(() => { SS.game.tipsOn = false; document.querySelectorAll('.tip-close').forEach((b) => b.click()); })()`);
  return { ctx, page };
}

/** Back to a calm start between ways: no window, folded panel on a phone, Bag on a desktop. */
async function reset(page, mode) {
  await page.evaluate(`(() => { const ui = SS.ui, g = SS.game; ui.cmdSearch?.close?.(); ui.closeModal(); ui.hideContextMenu?.(); document.activeElement?.blur?.();
    // Objectives awake (they doze after a quiet spell, hiding their Go), as on a fresh look.
    if (ui.compactHud) ui.compactHud._trkWoke = performance.now(); document.getElementById('quest-tracker')?.classList.remove('dozing');
    if (g.autoBattle) g.toggleAutoBattle(false); if (g.autoGather) g.toggleAutoGather(false); if (g.autoQuest) g.toggleAutoQuest(false);
    J.place(window.__origin.x, window.__origin.y); g.teleports.cast = null; g.player.hp = g.maxHp(); g.player.stopNow?.(); g.player.clearAction?.(); g.player.path = [];
    document.getElementById('ability-bar')?.classList.remove('auto-open');
    ${mode === 'phone' ? "ui._collapseApply?.panel?.(true);" : "ui.showPanelView('inventory');"}
    const inv = g.inventory; inv.slots.forEach((s, i) => { if (s && !['coins', 'bronze_axe', 'bronze_pickaxe', 'small_net', 'fishing_rod', 'tinderbox', 'hammer', 'knife', 'iron_dagger', 'bronze_dagger'].includes(s.id) && !/axe|pickaxe|net|rod|knife|hammer|tinderbox|snare|chisel/.test(s.id)) inv.slots[i] = null; });
    g.bus.emit('inventory'); })()`);
  await page.waitForTimeout(400);
}

async function runMode(browser, mode) {
  const { ctx, page } = await boot(browser, mode);
  const rows = [];
  for (const job of JOBS) {
    if (ONLY && !ONLY.has(job.id)) continue;
    const results = [];
    for (const way of job.ways) {
      if (way.needs === 'keyboard' && mode === 'phone') { results.push({ way: way.name, skipped: 'no keyboard' }); continue; }
      await reset(page, mode);
      await page.evaluate(job.setup);
      await page.waitForTimeout(500);
      const tally = { taps: 0, typed: 0, travel: 0 };
      try {
        await way.run(makeH(page, mode, tally));
        await page.waitForTimeout(300);
        const ok = await page.evaluate(`(() => { try { return !!(${job.done}); } catch { return false; } })()`);
        const why = ok ? '' : await page.evaluate(`JSON.stringify({ logs: SS.game.inventory.count('logs'), at: J.tile(), start: window.__start, modal: SS.ui.modal?.title, cast: !!SS.game.teleports.cast })`);
        results.push(ok ? { way: way.name, ...tally } : { way: way.name, skipped: `did not finish the job ${args.debug ? why : ''}` });
      } catch (e) {
        if (args.shots) await page.screenshot({ path: join(args.shots, `${mode}-${job.id}-${job.ways.indexOf(way)}.png`) }).catch(() => {});
        results.push({ way: way.name, skipped: e instanceof Skip ? e.message : `error: ${e.message.split('\n')[0]}` });
      }
    }
    const done = results.filter((r) => !r.skipped).sort((a, b) => (a.taps + a.typed / 4) - (b.taps + b.typed / 4) || a.travel - b.travel);
    rows.push({ job, best: done[0] || null, results });
    const b = done[0];
    console.log(`[${mode}] ${job.name}: ${b ? `${b.taps} taps, ${b.typed} typed, ${Math.round(b.travel)}px via ${b.way}` : 'no way worked'}`);
    for (const r of results) if (r.skipped) console.log(`    (${r.way}: ${r.skipped})`);
  }
  await ctx.close();
  return rows;
}

function table(desk, phone) {
  const fmt = (r) => (r.best ? `${r.best.taps}${r.best.typed ? ` +${r.best.typed} typed` : ''} | ${Math.round(r.best.travel)} | ${r.best.way}` : '— | — | no way worked');
  let out = `# Click audit (${new Date().toISOString().slice(0, 10)})\n\n`
    + 'Taps or key presses, typed letters, and pointer travel in CSS pixels, for the cheapest way that worked. '
    + 'Walking is not counted. Desktop 1366x800 (mouse and keyboard); phone 390x844 (touch).\n\n'
    + '| Job | Desktop taps | Desktop travel | Desktop way | Phone taps | Phone travel | Phone way |\n|---|---|---|---|---|---|---|\n';
  const n = Math.max(desk.length, phone.length);
  for (let i = 0; i < n; i++) out += `| ${(desk[i] || phone[i]).job.name} | ${desk[i] ? fmt(desk[i]) : '— | — | —'} | ${phone[i] ? fmt(phone[i]) : '— | — | —'} |\n`;
  const sum = (rows) => rows.reduce((a, r) => ({ taps: a.taps + (r.best?.taps || 0), typed: a.typed + (r.best?.typed || 0), travel: a.travel + (r.best?.travel || 0) }), { taps: 0, typed: 0, travel: 0 });
  const d = sum(desk), p = sum(phone);
  out += `| **Total** | **${d.taps}** (+${d.typed} typed) | **${Math.round(d.travel)}** | | **${p.taps}** (+${p.typed} typed) | **${Math.round(p.travel)}** | |\n`;
  return out;
}

const server = spawn(process.execPath, [join(args.root || ROOT, 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
try {
  await new Promise((r) => setTimeout(r, 800));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    const desk = args.mode === 'phone' ? [] : await runMode(browser, 'desktop');
    const phone = args.mode === 'desktop' ? [] : await runMode(browser, 'phone');
    const md = table(desk, phone);
    if (args.out) { writeFileSync(args.out, md); console.log(`\nSaved ${args.out}`); } else console.log('\n' + md);
  } finally { await browser.close(); }
} finally { server.kill(); }
