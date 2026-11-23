// The gear run windows (rules in src/game/smartgear.js): the "Keep refining
// until…" card in the Refine window, "Keep enchanting until…" in the Enchant
// window, and the "Improve worn gear" window. ui.js only mounts the two cards
// (openRefine, openEnchant) and opens the window (the Gear bar's ✦ Improve,
// Gear Mastery's top row, the quick bar and search).
//
// The rule for every button here: the first tap never spends anything. It
// shows, in the window, what the run could spend at most, and a second tap
// (Refine / Enchant / Improve) does it; Cancel, the ✕, a swipe down or Esc
// spend nothing (salvageui.js confirmBox, which windowease.js also respects:
// an outside tap leaves a window with a confirm on show alone). Afterwards a
// green box says what happened, and one line goes to the chat.
// Choices made here (targets, limits, aims, ticks) last until the game is
// closed; none of it is saved.
import { getItem } from '../data/items.js';
import { itemIconSVG } from '../render/icons.js';
import { MAX_REFINE, SCROLL, refineCost, refineTag } from '../game/refine.js';
import { MAX_ENCHANTS, STONE, WARD, ENCHANT_LABELS, enchantPool, enchantValue, enchantCost, enchantLabel } from '../game/mastery.js';
import { FEED_CAP } from '../game/materials.js';
import { qualityNameHTML } from '../game/loot.js';
import { worthState, stateKeyFor, gainOf, fmtWorth } from '../game/statworth.js';
import * as SG from '../game/smartgear.js';
import { stopText } from '../game/smartgear.js';
import { confirmBox, button, redraw, openDismantle } from './salvageui.js';

export { stopText };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => Math.round(n).toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const star = (lv) => refineTag(lv) || '★0';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listText = SG.listText;
/** "once", "8 times" (in 10). */
const times = (n) => (n === 1 ? 'once' : `${n} times`);

/** The windows' remembered choices (this session only). */
function smart(ui) {
  return ui._smart || (ui._smart = { open: { refine: true, enchant: true }, refine: {}, enchant: {}, improve: { refine: true, fill: true, feed: true, refineTo: SG.SAFE_REFINE, maxScrolls: null } });
}
/** The open window's confirm / result (a fresh window starts with neither). */
function confirmState(ui) {
  if (!ui.modal) return (ui._smartLoose ||= { pending: null, result: null });
  return (ui.modal._smartSt ||= { pending: null, result: null });
}

// Forecasts and plans, kept by what they were worked out from (cleared after any run).
const memo = new Map();
function remember(key, make) {
  if (memo.has(key)) return memo.get(key);
  if (memo.size > 60) memo.clear();
  const v = make();
  memo.set(key, v);
  return v;
}

function el(tag, cls = '', html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
/** Put `node` right after the window's intro (or at the end, when there is none). */
function afterIntro(body, node) {
  const intro = body.querySelector?.('.gear-intro');
  if (intro && intro.parentNode === body && typeof intro.after === 'function') intro.after(node);
  else body.appendChild(node);
}

/** A step size that grows with the number: ±1 under 20, ±5 under 100, ±10 under 500, ±50 above. */
export const stepOf = (v) => (v < 20 ? 1 : v < 100 ? 5 : v < 500 ? 10 : 50);

/** [−] value [+] with a small label above and a note under it. */
// `inline`: the note goes on the label's line (a shorter stepper, for the Improve window's step card).
function stepper(label, value, min, max, set, { fmt = num, under = '', inline = false } = {}) {
  const box = el('div', 'smart-stepper');
  box.appendChild(el('div', 'smart-lbl', `${esc(label)}${inline && under ? ` · ${under}` : ''}`));
  const row = el('div', 'smart-pmrow');
  const pm = (sym, name, to, off) => {
    const b = el('button', 'smart-pm', sym);
    b.type = 'button';
    b.setAttribute?.('aria-label', `${name} ${label}`);
    b.disabled = off;
    b.addEventListener('click', () => set(clamp(to, min, max)));
    return b;
  };
  row.appendChild(pm('&minus;', 'Less', value - stepOf(Math.max(0, value - 1)), value <= min));
  const shown = String(fmt(value));
  row.appendChild(el('span', `smart-val${shown.length > 3 ? ' long' : ''}`, esc(shown)));   // (a long number in a smaller size, so it fits between the buttons)
  row.appendChild(pm('+', 'More', value + stepOf(value), value >= max));
  box.appendChild(row);
  if (under && !inline) box.appendChild(el('div', 'smart-under', under));
  return box;
}

/** A run card: a fold that stays as you left it this session. */
function runCard(ui, kind, title, pill) {
  const d = el('details', 'smart-run');
  if (smart(ui).open[kind] !== false) d.open = true;
  d.addEventListener('toggle', () => { smart(ui).open[kind] = !!d.open; });
  d.appendChild(el('summary', 'smart-summary', `<span class="smart-title">${title}</span><span class="smart-sum">${esc(pill)}</span>`));
  return d;
}

/** "Short of X": where more comes from, with a way there. `go: false` leaves
 *  the button out where the window already has one (Improve's footer): two or
 *  three of the same button pushed Improve down out of a phone's window. */
function getMore(ui, item, { go = true } = {}) {
  const box = el('div', 'smart-more');
  const bank = ui.game.bank?.count?.(item) || 0;
  box.appendChild(el('span', '', `Dismantling spare gear gives stones and scrolls; champions and bosses drop wards.${bank ? ` (+${num(bank)} in your bank: take them out at a bank)` : ''}`));
  if (go) box.appendChild(button('Dismantle spare gear…', () => openDismantle(ui), 'small smart-more-go'));
  return box;
}

/** A primary button with a second, smaller line. */
function goButton(text, sub, fn, disabled) {
  const b = button(`${esc(text)}${sub ? `<span class="smart-go-sub">${esc(sub)}</span>` : ''}`, fn, 'active smart-go');
  b.disabled = !!disabled;
  return b;
}

// ---------------- Keep refining until… ----------------

/** The forecast's two lines (HTML). `o`: the run's settings plus `level`. */
export function refineForecastText(f, o) {
  const sure = SG.refineSure(o.level, o.target);
  let line1;
  if (sure) line1 = `Reaches ${star(o.target)} every time: ★1–★5 never fail.`;
  else if (f.reach >= 0.95) line1 = `Almost surely reaches ${star(o.target)}.`;
  else if (f.reach <= 0.05) line1 = `It rarely reaches ${star(o.target)} with these limits.`;
  else {
    const short = Object.entries(f.ends).filter(([lv]) => Number(lv) < o.target).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0])).slice(0, 2)
      .map(([lv]) => Number(lv)).sort((a, b) => b - a).map(star);
    line1 = `Reaches ${star(o.target)} about ${times(Math.round(f.reach * 10))} in 10${short.length ? `; otherwise it stops at ${short.join(' or ')}` : ''}.`;
  }
  const wards = o.target >= 10 && o.maxWards > 0;
  const top = Math.min(o.maxScrolls, sure ? f.scrolls.max : o.maxScrolls);
  const line2 = wards
    ? `Likely uses about ${num(f.scrolls.avg)} scrolls and ${num(f.wards.avg)} ward${Math.round(f.wards.avg) === 1 ? '' : 's'}; never more than ${num(top)} and ${num(o.maxWards)}.`
    : `Likely uses about ${num(f.scrolls.avg)} scrolls; never more than ${num(top)}.`;
  return `${line1}<br>${line2}`;
}

/** The refine run's confirm (HTML). */
export function refineConfirmHTML(game, id, copy, o, f) {
  const lv = game.equipment.refineLevel(id, copy);
  const name = `${copy === 'off' ? 'off-hand ' : ''}${esc(getItem(id).name)}`;
  const wards = o.target >= 10 && o.maxWards > 0;
  const spend = wards ? `at most ${plural(o.maxScrolls, 'refine scroll')} and ${plural(o.maxWards, 'upgrade ward')}` : `at most ${plural(o.maxScrolls, 'refine scroll')}`;
  const likely = wards ? `likely about ${num(f.scrolls.avg)} and ${num(f.wards.avg)}` : `likely about ${num(f.scrolls.avg)}`;
  const risky = o.allowDowngrade && !wards && o.target >= 10;
  return `Refine your <b>${name}</b> from ${star(lv)} towards <b>${star(o.target)}</b>? It tries one level at a time at the usual cost and odds, using <b>${spend}</b> (${likely}). `
    + `It stops when it gets there, at ${wards ? 'either limit' : 'that limit'}, or before any try that could ${risky ? 'break it without a ward; with no ward, a bad roll at ★10–★12 costs a level.' : 'cost a level or break it without a ward.'} `
    + 'Refining can\'t be undone.';
}

/** What a refine run did (HTML), for the green box. */
export function refineResultHTML(r) {
  const used = `${plural(r.scrolls, 'scroll')}${r.wards ? ` and ${plural(r.wards, 'ward')}` : ''}`;
  const bits = [];
  if (r.outcomes.warded) bits.push(`${num(r.outcomes.warded)} bad roll${r.outcomes.warded > 1 ? 's' : ''} taken by wards`);
  if (r.outcomes.downgrade) bits.push(`${num(r.outcomes.downgrade)} cost a level`);
  if (r.outcomes.fail) bits.push(`${num(r.outcomes.fail)} failed`);
  if (r.stop === 'target') return `<b>${star(r.from)} → ${star(r.to)}</b> in ${plural(r.tries, 'try', 'tries')}: ${used} used${bits.length ? ` (${bits.join(', ')})` : ''}.`;
  return `Stopped at <b>${star(r.to)}</b> after ${plural(r.tries, 'try', 'tries')} (${plural(r.scrolls, 'scroll')}${r.wards ? `, ${plural(r.wards, 'ward')}` : ''}): ${esc(stopText(r.stop))}.`;
}

/** Why a refine run can't start, or null. */
function refineCant(game, id, copy, o, f) {
  const lv = game.equipment.refineLevel(id, copy), have = game.inventory.count(SCROLL), cost = refineCost(id, lv + 1).scrolls;
  if (have < cost) return `The next ★ costs ${plural(cost, 'refine scroll')}; you carry ${num(have)}.`;
  return f.startStop ? stopText(f.startStop, { start: true }) : null;
}

/** "Keep refining until…": the Refine window's card (and its confirm or
 *  result box), put in right after the window's intro. */
export function mountRefineRun(ui, body, id, copy, rerender) {
  const g = ui.game, st = confirmState(ui);
  const wrap = el('div', 'smart-wrap');
  confirmBox(wrap, st, rerender);
  const lv = g.equipment.refineLevel(id, copy);
  if (lv < MAX_REFINE) wrap.appendChild(refineCard(ui, id, copy, lv, rerender, st));
  afterIntro(body, wrap);
  return wrap;
}

function refineCard(ui, id, copy, lv, rerender, st) {
  const g = ui.game, sm = smart(ui), key = `${id}#${copy}`;
  const scrolls = g.inventory.count(SCROLL), wards = g.inventory.count(WARD);
  const nextCost = refineCost(id, lv + 1).scrolls;
  const o = sm.refine[key] || (sm.refine[key] = SG.refineDefaults(g, id, copy));
  // Kept within what is possible now (the ★ moves, the pack changes).
  o.target = clamp(o.target, lv + 1, MAX_REFINE);
  o.maxScrolls = clamp(o.maxScrolls, Math.min(nextCost, scrolls), scrolls);
  o.maxWards = clamp(o.maxWards, 0, wards);
  const f = remember(`r|${lv}|${o.target}|${o.maxScrolls}|${o.maxWards}|${o.allowDowngrade}|${scrolls}|${wards}`,
    () => SG.refineForecast(lv, { ...o, packScrolls: scrolls, packWards: wards }));
  const cant = refineCant(g, id, copy, o, f);
  const sure = SG.refineSure(lv, o.target);
  const pill = cant ? 'can\'t start' : `${star(o.target)} · ${sure ? 'every time' : f.reach >= 0.95 ? 'almost sure' : f.reach <= 0.05 ? 'rarely' : `${Math.round(f.reach * 10)} in 10`}`;
  const card = runCard(ui, 'refine', 'Keep refining until…', pill);
  // A change puts away a confirm made with the old settings (it must say what it will do).
  const set = (k) => (v) => { o[k] = v; st.pending = null; rerender(); };
  const grid = el('div', 'smart-grid');
  grid.appendChild(stepper('Stop at', o.target, lv + 1, MAX_REFINE, set('target'), { fmt: star }));
  grid.appendChild(stepper('Scrolls, at most', o.maxScrolls, Math.min(nextCost, scrolls), scrolls, set('maxScrolls'), { under: `of ${num(scrolls)}` }));
  if (o.target >= 10 && wards > 0) grid.appendChild(stepper('Wards, at most', o.maxWards, 0, wards, set('maxWards'), { under: `of ${num(wards)}` }));
  card.appendChild(grid);
  if (o.target >= 10 && wards === 0) {
    const lab = el('label', 'smart-check');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = !!o.allowDowngrade;
    box.addEventListener('change', (e) => {
      o.allowDowngrade = !!e.target.checked;
      st.pending = null;
      // Room for the climb now that it may go on past ★10.
      const d = SG.refineDefaults(g, id, copy, { allowDowngrade: o.allowDowngrade });
      if (d) o.maxScrolls = Math.max(o.maxScrolls, d.maxScrolls);
      rerender();
    });
    lab.appendChild(box);
    lab.appendChild(el('span', '', 'Keep going at ★10–★12 with no ward (a bad roll there costs a level)'));
    card.appendChild(lab);
  }
  const fc = el('div', `smart-forecast${cant ? ' smart-why' : ''}`, cant ? esc(cant) : refineForecastText(f, { ...o, level: lv }));
  fc.setAttribute?.('aria-live', 'polite');
  card.appendChild(fc);
  // Short of scrolls (or of wards past ★9): where more come from.
  if (scrolls < nextCost || (!cant && f.reach < 0.95 && o.maxScrolls >= scrolls)) card.appendChild(getMore(ui, SCROLL));
  else if (cant && (f.startStop === 'downgrade' || f.startStop === 'break')) card.appendChild(getMore(ui, WARD));
  card.appendChild(el('div', 'smart-note', 'One try at a time, at the usual cost and odds. It stops at your limits, and before any try that could break the piece without a ward.'));
  const wardsOn = o.target >= 10 && o.maxWards > 0;
  card.appendChild(goButton(`Refine up to ${star(o.target)}`, `at most ${plural(o.maxScrolls, 'scroll')}${wardsOn ? ` · ${plural(o.maxWards, 'ward')}` : ''}`, () => {
    const snap = { ...o }, risky = snap.allowDowngrade && !wardsOn && snap.target >= 10;
    st.result = null;
    st.pending = {
      html: refineConfirmHTML(g, id, copy, snap, f), warn: risky ? 'a bad roll can cost a level' : '', label: 'Refine',
      go: () => {
        const r = SG.runRefine(g, id, snap, { copy });
        delete sm.refine[key];   // the next run starts from fresh suggestions
        memo.clear();
        return refineResultHTML(r);
      },
    };
    rerender();
  }, !!cant));
  return card;
}

// ---------------- Keep enchanting until… ----------------

/** One aim option's words: "Physical damage bonus +7% · ≈ +3.1% dmg". */
function aimOption(game, id, stat) {
  const v = enchantValue(id, stat), s = worthState(game), k = stateKeyFor(s, stat);
  const name = `${cap1(ENCHANT_LABELS[stat] || stat)} +${v}%`;
  if (stat === 'lifesteal') return `${name} · heals you, no damage`;
  if (!k || !game.equipment.styleFits(id)) return `${name} · not for your damage`;
  const w = gainOf(s, k, v) * 100;
  if (stat === 'bossDmg') return `${name} · ≈ ${fmtWorth(w)} vs bosses only`;
  return `${name} · ≈ ${fmtWorth(w)} dmg${stat === 'pierce' ? ' vs a boss your level' : ''}`;
}

/** "The next try costs 10 stones, then 25, then 50 each, and 2,200 coins a try."
 *  or "Each try costs 50 stones and 26,200 coins." */
export function enchantCostText(id, lineCount) {
  const c = enchantCost(id, lineCount), last = enchantCost(id, MAX_ENCHANTS).stones;
  if (c.stones >= last) return `Each try costs ${num(c.stones)} stones and ${num(c.coins)} coins.`;
  const steps = [];
  for (let n = lineCount; n < MAX_ENCHANTS && enchantCost(id, n).stones < last; n++) steps.push(enchantCost(id, n).stones);
  return `The next try costs ${num(steps[0])} stones${steps.slice(1).map((x) => `, then ${num(x)}`).join('')}, then ${num(last)} each, and ${num(c.coins)} coins a try.`;
}

/** The enchant forecast's lines (HTML). */
export function enchantForecastText(f, o, id, lineCount) {
  const likely = f.done >= 0.95
    ? `Likely done in about ${plural(Math.max(1, Math.round(f.picks.avg)), 'try', 'tries')}; 9 in 10 finish within ${num(f.picks.p90)}.`
    : f.done < 0.05 ? `It rarely gets there within ${plural(o.maxPicks, 'try', 'tries')}${!o.maxWards && (f.stops['no-safe-pick'] || 0) > 0.5 ? ': allow a ward or two to reroll the offers' : ''}.`
      : `Done about ${times(Math.round(f.done * 10))} in 10 within ${plural(o.maxPicks, 'try', 'tries')}.`;
  return `${enchantCostText(id, lineCount)} ${likely}<br><span class="smart-sub">It keeps every line you aim for and never makes a line weaker.</span>`;
}

/** The enchant card's pill, in the forecast's own terms: "likely 5 tries" only
 *  when 95 runs in 100 get there, otherwise how often ("7 in 10", "rarely"),
 *  as the refine card's pill says it. ("likely 2 tries" beside "Done about 7
 *  times in 10 within 3 tries" read as a promise.) */
export function enchantPill(f) {
  if (f.done >= 0.95) return `likely ${plural(Math.max(1, Math.round(f.picks.avg)), 'try', 'tries')}`;
  return f.done < 0.05 ? 'rarely' : `${Math.round(f.done * 10)} in 10`;
}

/** The enchant run's confirm (HTML). */
export function enchantConfirmHTML(game, id, copy, o) {
  const lines = game.equipment.enchantLines(id, copy);
  const m = SG.enchantMaxSpend(id, lines.length, o.maxPicks);
  const name = `${copy === 'off' ? 'off-hand ' : ''}${esc(getItem(id).name)}`;
  const cost = enchantCostText(id, lines.length).replace(/\.$/, '');
  return `Enchant your <b>${name}</b> until it has <b>${esc(SG.aimText(id, o.aim))}</b>? ${cost}: <b>at most ${plural(o.maxPicks, 'try', 'tries')} (${num(m.stones)} stones, ${num(m.coins)} coins)</b>, `
    + (o.maxWards > 0 ? `and at most ${plural(o.maxWards, 'upgrade ward')} to reroll the offer (the same wards save ★10+ refines). ` : 'and no wards. ')
    + 'When nothing on offer fits, a try takes the same line again (nothing changes, but you see new offers). Lines it replaces are gone for good.';
}

/** What an enchant run did (HTML). */
export function enchantResultHTML(r, aim) {
  const used = `${num(r.stones)} stones and ${num(r.coins)} coins${r.wards ? ` and ${plural(r.wards, 'ward')}` : ''}`;
  if (r.stop === 'done') {
    return `Done in ${plural(r.picks, 'try', 'tries')}: ${esc(r.to.map(enchantLabel).join(', '))}. Used ${used}${r.same ? ` (${plural(r.same, 'try', 'tries')} only brought new offers)` : ''}.`;
  }
  if (r.stop === 'no-safe-pick') return `Stopped${r.picks ? ` after ${plural(r.picks, 'try', 'tries')}` : ''}: nothing on offer fitted without weakening a line. Allow a ward to reroll the offer, or pick by hand below.`;
  const want = aim.filter(Boolean).length, got = want - missingCount(r.to, aim);
  return `Stopped after ${plural(r.picks, 'try', 'tries')} with ${got} of the ${want} line${want === 1 ? '' : 's'} you aimed for: ${esc(stopText(r.stop))}.`;
}
/** How many aimed lines a piece's lines still lack. */
function missingCount(lines, aim) {
  const left = aim.filter(Boolean);
  for (const l of lines) { const i = left.indexOf(l.stat); if (i >= 0) left.splice(i, 1); }
  return left.length;
}

/** "Keep enchanting until…": the Enchant window's card, after its intro. */
export function mountEnchantRun(ui, body, id, copy, rerender) {
  const g = ui.game, st = confirmState(ui);
  const wrap = el('div', 'smart-wrap');
  confirmBox(wrap, st, rerender);
  if (getItem(id).equip?.bonuses) wrap.appendChild(enchantCard(ui, id, copy, rerender, st));
  afterIntro(body, wrap);
  return wrap;
}

function enchantCard(ui, id, copy, rerender, st) {
  const g = ui.game, sm = smart(ui), key = `${id}#${copy}`;
  const lines = g.equipment.enchantLines(id, copy), offers = g.enchantOffers(id, copy);
  const pool = enchantPool(id), best = SG.bestAim(g, id, copy);
  const afford = SG.affordablePicks(g, id, copy), wards = g.inventory.count(WARD);
  const worth = SG.lineWorth(g, id);
  const sig = (aim, mp, mw) => `e|${id}|${copy}|${lines.map((l) => l.stat + l.value).join('+')}|${offers.map((l) => l.stat + l.value).join('+')}|${aim.join(',')}|${mp}|${mw}|${wards}`;
  const forecast = (aim, mp, mw) => remember(sig(aim, mp, mw), () => SG.enchantForecast(id, lines, offers, aim, worth, { maxPicks: mp, maxWards: mw, packWards: wards }));
  let o = sm.enchant[key];
  if (!o) {
    const aim = [best[0] || null, best[1] || null, best[2] || null];
    // Room for nine runs in ten to get there, within what you can pay for.
    const f0 = afford ? forecast(aim, afford, 0) : null;
    o = sm.enchant[key] = { aim, maxPicks: clamp(f0?.done ? f0.picks.p90 : Math.min(afford, 10), Math.min(1, afford), afford), maxWards: 0 };
  }
  o.aim = o.aim.map((s) => (pool.includes(s) ? s : null));
  o.maxPicks = clamp(o.maxPicks, Math.min(1, afford), afford);
  o.maxWards = clamp(o.maxWards, 0, wards);
  const aimed = o.aim.filter(Boolean);
  const met = aimed.length > 0 && SG.enchantStep(lines, [], o.aim, worth, false).done;
  const c = enchantCost(id, lines.length);
  const stones = g.inventory.count(STONE), coins = g.inventory.count('coins');
  const cant = !aimed.length ? 'Choose at least one line to aim for.' : met ? 'It already has these lines.'
    : !afford ? `One try costs ${num(c.stones)} stones and ${num(c.coins)} coins; you carry ${stones < c.stones ? `${num(stones)} stones` : `${num(coins)} coins`}.` : null;
  const f = cant ? null : forecast(o.aim, o.maxPicks, o.maxWards);
  const pill = met ? 'done' : cant ? 'can\'t start' : enchantPill(f);
  const card = runCard(ui, 'enchant', 'Keep enchanting until…', pill);
  // What to aim for: three choices, "Anything" or a line, each with its worth to you.
  const aimBox = el('div', 'smart-aim');
  // "Best for me" (while the choices differ from the best) rides on the label's
  // line: on a row of its own it pushed Enchant until done out of a phone's window.
  const head = el('div', 'smart-lbl smart-aim-head', '<span>Aim for</span>');
  const same = (a, b) => a.filter(Boolean).sort().join() === b.filter(Boolean).sort().join();
  if (best.length && !same(o.aim, best)) head.appendChild(button('Best for me', () => { o.aim = [best[0] || null, best[1] || null, best[2] || null]; st.pending = null; rerender(); }, 'small smart-chip'));
  aimBox.appendChild(head);
  const opts = `<option value="">Anything</option>${pool.map((stat) => `<option value="${stat}">${esc(aimOption(g, id, stat))}</option>`).join('')}`;
  o.aim.forEach((cur, i) => {
    const sel = el('select', 'smart-select');
    sel.innerHTML = opts;
    sel.value = cur || '';
    sel.setAttribute?.('aria-label', `Aim for, line ${i + 1}`);
    sel.addEventListener('change', (e) => { o.aim[i] = e.target.value || null; st.pending = null; rerender(); });
    aimBox.appendChild(sel);
  });
  card.appendChild(aimBox);
  card.appendChild(el('div', 'smart-best', best.length ? `Best for your damage: ${esc(SG.aimText(id, best))}` : 'Best for your damage: nothing (this piece doesn\'t suit your fighting style)'));
  const grid = el('div', 'smart-grid two');
  const m = SG.enchantMaxSpend(id, lines.length, o.maxPicks);
  grid.appendChild(stepper('Tries, at most', o.maxPicks, Math.min(1, afford), afford, (v) => { o.maxPicks = v; st.pending = null; rerender(); }, { under: `${num(m.stones)} stones · ${num(m.coins)} coins` }));
  grid.appendChild(stepper('Wards, at most', o.maxWards, 0, wards, (v) => { o.maxWards = v; st.pending = null; rerender(); }, { under: `of ${num(wards)} · they also save refines` }));
  card.appendChild(grid);
  const fc = el('div', `smart-forecast${cant ? ' smart-why' : ''}`, cant ? esc(cant) : enchantForecastText(f, o, id, lines.length));
  fc.setAttribute?.('aria-live', 'polite');
  card.appendChild(fc);
  if (!afford && aimed.length && !met) card.appendChild(getMore(ui, stones < c.stones ? STONE : 'coins'));
  card.appendChild(goButton('Enchant until done', `at most ${plural(o.maxPicks, 'try', 'tries')} · ${num(m.stones)} stones · ${num(m.coins)} coins${o.maxWards ? ` · ${plural(o.maxWards, 'ward')}` : ''}`, () => {
    const snap = { aim: o.aim.slice(), maxPicks: o.maxPicks, maxWards: o.maxWards };
    st.result = null;
    st.pending = {
      html: enchantConfirmHTML(g, id, copy, snap), warn: snap.maxWards > 0 ? 'it can use upgrade wards' : '', label: 'Enchant',
      go: () => {
        const aim = snap.aim;
        const r = SG.runEnchant(g, id, snap, { copy });
        delete sm.enchant[key];
        memo.clear();
        return enchantResultHTML(r, aim);
      },
    };
    rerender();
  }, !!cant));
  return card;
}

// ---------------- Improve worn gear ----------------

/** A piece's name for the Improve list: "Off-hand rune dagger" for a twin's second copy. */
function pieceHTML(p) {
  return p.copy === 'off' ? `Off-hand ${esc(getItem(p.id).name.toLowerCase())}` : qualityNameHTML(p.id, p.q, esc);
}
/** "80 Runite bar, 40 Diamond, 60 Ruby +2 more" */
function materialsText(mats, max = 3) {
  const s = mats.slice(0, max).map(([id, n]) => `${num(n)} ${esc(getItem(id).name)}`).join(', ');
  return mats.length > max ? `${s} +${mats.length - max} more` : s;
}

/** The Improve confirm (HTML), naming only the ticked steps. */
export function improveConfirmHTML(plan, game) {
  const parts = [];
  if (plan.steps.refine && plan.refine.max > 0 && plan.pieces.some((p) => p.refine.likely > p.refine.from)) parts.push(`<b>at most ${plural(plan.refine.max, 'refine scroll')}</b> (likely about ${num(plan.refine.likely)})`);
  if (plan.steps.fill && plan.fill.lines) parts.push(`<b>${num(plan.fill.stones)} upgrade stones and ${num(plan.fill.coins)} coins</b>`);
  if (plan.steps.feed && plan.materials.length) parts.push(`<b>${materialsText(plan.materials, Infinity)}</b>`);
  // ("a, b, and c": the amounts themselves hold an "and".)
  const list = parts.length > 2 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : parts.join(' and ');
  return `Improve your worn gear? It uses ${list || 'nothing'}. No wards are used. This can't be undone.`;
}

/** "mithril bars", "rubies" */
const many = (name) => (/s$/.test(name) ? name : /[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`);
/** A warning when feeding would take half or more of a material you carry. */
function improveWarn(plan, game) {
  if (!plan.steps.feed) return '';
  for (const [id, n] of plan.materials) if (n * 2 >= game.inventory.count(id)) return `this uses most of your ${many(getItem(id).name.toLowerCase())}`;
  return '';
}

/** What Improve did (HTML). */
export function improveResultHTML(r) {
  const rows = r.pieces.map((p) => `${p.copy === 'off' ? 'Off-hand ' : ''}${esc(p.copy === 'off' ? getItem(p.id).name.toLowerCase() : getItem(p.id).name)}: ${esc(SG.improveBits(p).join(', '))}`);
  const u = r.used, spent = [u.scrolls ? plural(u.scrolls, 'refine scroll') : '', u.stones ? `${num(u.stones)} stones` : '', u.coins ? `${num(u.coins)} coins` : '', u.materials ? plural(u.materials, 'material') : ''].filter(Boolean);
  return (rows.length ? rows.join('<br>') : 'Nothing could be improved this time.') + (spent.length ? `<br>Used ${listText(spent)}.` : '');
}

/** The state an Improve plan is worked out from (so it's worked out again only when that changes). */
function improveSig(g) {
  const eqp = g.equipment;
  let s = SG.wornPieces(g).map((p) => `${p.id}:${p.copy}:${eqp.refineLevel(p.id, p.copy)}:${eqp.enchantLines(p.id, p.copy).length}:${eqp.masteryXp(p.id)}`).join(',');
  s += `|${g.inventory.count(SCROLL)}|${g.inventory.count(STONE)}|${g.inventory.count('coins')}|${g.inventory.count(WARD)}|`;
  for (const x of g.inventory.slots) if (x && !getItem(x.id).equip) s += `${x.id}:${x.qty},`;
  return s;
}

/** The "Improve worn gear" window: every risk-free upgrade on everything
 *  worn (refine to ★9, fill empty lines, feed to Master), after one confirm. */
export function openImprove(ui) {
  const g = ui.game, sm = smart(ui);
  const render = (body) => {
    const opts = sm.improve, st = confirmState(ui);
    const sig = improveSig(g);
    const plan = remember(`i|${JSON.stringify(opts)}|${sig}`, () => SG.improvePlan(g, opts));
    const all = remember(`i*|${opts.refineTo}|${opts.maxScrolls}|${sig}`, () => SG.improvePlan(g, { ...opts, refine: true, fill: true, feed: true }));
    const scrolls = g.inventory.count(SCROLL), stones = g.inventory.count(STONE), wards = g.inventory.count(WARD), coins = g.inventory.count('coins');
    body.innerHTML = `<div class="gear-intro smart-intro"><p>Every safe upgrade for the gear you wear, in one go: nothing here can cost a level or break a piece. You carry ${plural(scrolls, 'refine scroll')}, ${plural(stones, 'upgrade stone')}, ${plural(wards, 'upgrade ward')} and ${num(coins)} coins.</p></div>`;
    const rerender = () => redraw(body, render);
    confirmBox(body, st, rerender);
    const footer = () => {
      const f = el('div', 'gear-view smart-foot');
      f.appendChild(button('Gear mastery: piece by piece…', () => ui.openMastery(), 'smart-foot-go'));
      f.appendChild(button('Dismantle spare gear…', () => openDismantle(ui), 'salvage-open smart-foot-go'));
      body.appendChild(f);
    };
    if (!all.count) {
      body.appendChild(el('div', 'modal-hint smart-empty', 'Every safe upgrade is done: your worn gear is ★9 or more, has no empty lines, and is at Master (or your pack holds nothing it takes). '
        + 'Go further piece by piece with Keep refining until… and Keep enchanting until… in Gear mastery.'));
      footer();
      return;
    }
    const tick = (k) => (e) => { opts[k] = !!e.target.checked; st.pending = null; rerender(); };
    const step = (k, title, cost, sub, dead) => {
      const box = el('div', `smart-step${opts[k] ? '' : ' off'}${dead ? ' dead' : ''}`);
      const head = el('div', 'smart-step-head');
      const lab = el('label', 'smart-step-tick');
      const cb = el('input');
      cb.type = 'checkbox';
      cb.checked = !!opts[k] && !dead;
      cb.disabled = !!dead;
      cb.addEventListener('change', tick(k));
      lab.appendChild(cb);
      lab.appendChild(el('b', '', title));
      head.appendChild(lab);
      head.appendChild(el('span', 'smart-cost', dead ? '' : opts[k] ? cost : 'skipped'));
      box.appendChild(head);
      box.appendChild(el('div', 'smart-sub', sub));
      body.appendChild(box);
      return box;
    };
    // 1. Refine to ★9 (or lower).
    const to = plan.refineTo, below = plan.pieces.filter((p) => p.refine.from < to);
    const rDead = !below.length ? `Every piece is ${star(to)} or more` : scrolls < 1 ? 'You carry no refine scrolls' : '';
    const r = step('refine', `Refine to ${star(to)}`, `about ${plural(Math.round(plan.refine.likely), 'scroll')}`,
      rDead || `${plural(below.length, 'piece')} below ${star(to)} · cheapest stars first, so a short supply still lifts every piece`, rDead);
    if (!rDead) {
      const grid = el('div', 'smart-grid two');
      grid.appendChild(stepper('Up to', to, 1, SG.SAFE_REFINE, (v) => { opts.refineTo = v; opts.maxScrolls = null; st.pending = null; rerender(); }, { fmt: star, inline: true }));
      grid.appendChild(stepper('Scrolls, at most', plan.refine.max, Math.min(1, scrolls), scrolls, (v) => { opts.maxScrolls = v; st.pending = null; rerender(); }, { under: `of ${num(scrolls)}`, inline: true }));
      r.appendChild(grid);
    }
    // Short of scrolls (none at all, or not enough to lift every piece): where more come from.
    // (Words only here: the footer's Dismantle spare gear… is the way there.)
    if (below.length && (scrolls < 1 || (opts.refine && !plan.refine.reachAll && plan.refine.max >= scrolls))) r.appendChild(getMore(ui, SCROLL, { go: false }));
    // 2. Fill empty enchant lines.
    const empty = plan.pieces.filter((p) => g.equipment.enchantLines(p.id, p.copy).length < MAX_ENCHANTS);
    let fDead = '';
    if (!empty.length) fDead = 'No empty lines';
    else if (!plan.fill.lines) { const p = empty[0], c = enchantCost(p.id, g.equipment.enchantLines(p.id, p.copy).length); fDead = `Can't pay for the next line (${num(c.stones)} stones, ${num(c.coins)} coins)`; }
    const fs = step('fill', 'Fill empty enchant lines', `${num(plan.fill.stones)} stones · ${num(plan.fill.coins)} coins`,
      fDead || `${plural(plan.fill.lines, 'line')} on ${plural(plan.fill.pieces, 'piece')} · each takes the best of its three offers for your damage`, fDead);
    if (fDead && empty.length) fs.appendChild(getMore(ui, STONE, { go: false }));
    // 3. Feed materials up to Master.
    const fed = plan.pieces.filter((p) => p.feedXp > 0);
    const capped = plan.pieces.filter((p) => p.copy === 'main').every((p) => g.equipment.masteryXp(p.id) >= FEED_CAP);
    const mDead = fed.length ? '' : capped ? 'Every piece is at Master' : 'Your pack holds no materials your worn gear takes';
    step('feed', 'Feed materials up to Master', materialsText(plan.materials),
      mDead || `${plural(fed.length, 'piece')} · finest materials first, the same plan as Feed materials to worn gear`, mDead);
    // What each piece gets.
    const changed = plan.pieces.filter((p) => (opts.refine && p.refine.likely > p.refine.from + 1e-9) || (opts.fill && p.fill.lines) || (opts.feed && p.feedXp));
    if (changed.length) {
      const fold = el('details', 'smart-pieces');
      fold.appendChild(el('summary', '', `What each piece gets (${changed.length})`));
      for (const p of changed) {
        const bits = [];
        if (opts.refine && p.refine.likely > p.refine.from + 1e-9) bits.push(p.refine.likely >= p.refine.to - 0.05 ? `${star(p.refine.from)} → ${star(p.refine.to)}` : `${star(p.refine.from)} → about ${star(Math.round(p.refine.likely))}`);
        if (opts.fill && p.fill.lines) bits.push(`+${plural(p.fill.lines, 'line')}`);
        if (opts.feed && p.feedXp) bits.push(g.equipment.masteryXp(p.id) + p.feedXp >= FEED_CAP ? 'to Master' : `+${num(p.feedXp)} mastery XP`);
        fold.appendChild(el('div', 'smart-piece', `<span class="smart-piece-ic">${itemIconSVG(p.id, 24)}</span><span class="smart-piece-name">${pieceHTML(p)}</span><span class="smart-piece-what">${esc(bits.join(' · '))}</span>`));
      }
      body.appendChild(fold);
    }
    const ticked = opts.refine || opts.fill || opts.feed;
    const n = plan.count;
    body.appendChild(goButton(!ticked ? 'Tick a step to improve' : n ? `Improve ${plural(n, 'piece')}` : 'Nothing to improve', '', () => {
      st.result = null;
      st.pending = {
        html: improveConfirmHTML(plan, g), warn: improveWarn(plan, g), label: 'Improve',
        go: () => { const res = SG.runImprove(g, plan); sm.improve.maxScrolls = null; memo.clear(); return improveResultHTML(res); },
      };
      rerender();
    }, !ticked || !n));
    footer();
  };
  ui.openModal('Improve worn gear', render);
  if (ui.modal) ui.modal.kind = 'improve';
}
