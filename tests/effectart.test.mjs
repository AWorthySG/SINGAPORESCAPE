// Painted effect stickers and the ammo and menu icons (art packs AM-1 and
// FX-1): the gun rounds wear their own stickers rather than a tinted bar, the
// Codex's Places and Search and the Daily revision and Report card buttons
// show their badges, and every combat effect draws its painted picture once it
// has loaded but falls back to its canvas drawing while it loads, when it
// fails, and in the tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ITEMS } from '../src/data/items.js';
import { itemIconSVG, itemArtSrc, PLAY_ICONS } from '../src/render/icons.js';
import { codexSwitchHTML, CODEX_VIEW_ICON } from '../src/ui/compendiumui.js';
import { EFFECT_ART, fxArt } from '../src/render/fxart.js';
import { CombatFx, FX_KIND } from '../src/render/combatfx.js';
import { spawnElement, ELEMENT_FX } from '../src/render/elementfx.js';
import { drawCritBurst, drawMissPuff, drawLootGlow } from '../src/render/juice.js';

const read = (f) => readFileSync(fileURLToPath(new URL(`../${f}`, import.meta.url)), 'utf8');

// A canvas that does nothing but note which pictures it was asked to draw.
function recCtx() {
  const drawn = [];
  const ctx = new Proxy({}, {
    get: (o, k) => (k === 'drawn' ? drawn : k === 'drawImage' ? (img) => drawn.push(img.src)
      : k === 'measureText' ? () => ({ width: 60 }) : k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  return ctx;
}
// Pictures that report themselves loaded (or failed: no size) on demand.
const made = [];
globalThis.Image = class { constructor() { made.push(this); this.complete = true; this.naturalWidth = 0; this.naturalHeight = 0; } };
const setLoaded = (ok) => { for (const im of made) { im.naturalWidth = ok ? 160 : 0; im.naturalHeight = ok ? 140 : 0; } };

test('every gun round wears its own untinted sticker, no longer borrowing a bar', () => {
  const rounds = Object.keys(ITEMS).filter((id) => id.endsWith('_rounds'));
  assert.equal(rounds.length, 15);
  for (const id of rounds) {
    assert.equal(ITEMS[id].artFrom, undefined, `${id} borrows nothing`);
    const html = itemIconSVG(id, 24);
    assert.ok(html.includes(`assets/icons/item-${id}.webp`) && !html.includes('filter:'), `${id} has its own sticker`);
    assert.equal(itemArtSrc(id), `assets/icons/item-${id}.webp`);
    assert.ok(existsSync(fileURLToPath(new URL(`../assets/icons/item-${id}.webp`, import.meta.url))), `${id} file`);
  }
});

test('the Codex switch, Daily revision and Report card show their painted badges, not emoji', () => {
  const html = codexSwitchHTML('places');
  for (const [id, icon] of Object.entries(CODEX_VIEW_ICON)) {
    assert.ok(PLAY_ICONS.includes(icon), `${icon} is a gameplay icon`);
    const at = html.indexOf(`data-view="${id}"`), btn = html.slice(at, html.indexOf('</button>', at));
    assert.ok(btn.includes(`assets/icons/${icon}.webp`), `${id} has its badge`);
    assert.doesNotMatch(btn, /[\u{1F300}-\u{1FAFF}]/u, `${id} lost its emoji`);
  }
  const ui = read('src/ui/ui.js');
  assert.match(ui, /playIconHTML\('ui-daily', 18\)\} Daily revision/);
  assert.match(ui, /playIconHTML\('ui-report', 18\)\} Report card/);
  assert.doesNotMatch(ui, /✨ Daily revision|📋 Report card/);
});

test('every painted effect is declared for the lock-step check and used by the effect code', () => {
  const src = ['src/render/juice.js', 'src/render/combatfx.js', 'src/render/elementfx.js'].map(read).join('\n');
  for (const k of EFFECT_ART) {
    assert.ok(fxArt().has(`fx-${k}`), `fx-${k} is declared`);
    assert.ok(src.includes(`'fx-${k}'`), `fx-${k} is used`);
  }
  for (const el of ['ice', 'lightning', 'nature', 'poison', 'holy', 'shadow']) assert.equal(ELEMENT_FX[el].art, `fx-hit-${el}`);
});

test('effects draw on the canvas while their pictures load or fail, and the painted ones once loaded', () => {
  for (const loaded of [false, true]) {
    setLoaded(loaded);
    const want = (key, ctx) => (loaded ? assert.ok(ctx.drawn.includes(`assets/fx/${key}.webp`), `${key} drawn`)
      : assert.deepEqual(ctx.drawn, [], `${key}: canvas fallback`));
    // Crit star-burst, miss puff and a legendary drop's beam.
    let ctx = recCtx(); drawCritBurst(ctx, 18, 0.2, false); want('fx-crit-burst', ctx);
    ctx = recCtx(); drawMissPuff(ctx, 100); want('fx-miss-puff', ctx);
    ctx = recCtx(); drawLootGlow(ctx, 'legendary', 50, 50, 2000, 1000, true); want('fx-loot-beam', ctx);
    // An ice hit: the painted shards with half the drawn ones, or all the drawn ones.
    let fx = new CombatFx();
    spawnElement(fx, 'ice', 100, 100);
    const kinds = fx.slots.slice(0, fx.live).map((s) => s.k);
    assert.equal(kinds.filter((k) => k === FX_KIND.STICKER).length, loaded ? 1 : 0);
    assert.equal(kinds.filter((k) => k === FX_KIND.CHIP).length, loaded ? 4 : 7);
    fx.update(120); ctx = recCtx(); fx.draw(ctx, 0, 0); want('fx-hit-ice', ctx);
    // A level-up: the painted confetti and the ribbon under the label.
    fx = new CombatFx();
    fx.levelPop(100, 100, 'Attack 42!');
    assert.equal(fx.slots.slice(0, fx.live).some((s) => s.k === FX_KIND.STICKER && s.txt === 'fx-confetti'), loaded);
    fx.update(120); ctx = recCtx(); fx.draw(ctx, 0, 0);
    if (loaded) {
      assert.ok(ctx.drawn.includes('assets/fx/fx-confetti.webp'));
      assert.equal(ctx.drawn.filter((s) => s === 'assets/fx/fx-levelup-ribbon.webp').length, 3, 'two ends and the stretched middle');
    } else assert.deepEqual(ctx.drawn, []);
    // A sticker whose picture fails after it was spawned simply draws nothing.
    assert.equal(!!new CombatFx().sticker('fx-ultimate-burst', 0, 0, 40, 300), loaded);
  }
  setLoaded(true);
  const fx = new CombatFx(); fx.sticker('fx-hit-holy', 0, 0, 30, 300);
  setLoaded(false);
  const ctx = recCtx(); fx.update(50); fx.draw(ctx, 0, 0);
  assert.deepEqual(ctx.drawn, []);
});
