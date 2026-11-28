// The "What next?" card at the top of the Quest Journal, its first goal as a
// tappable row in the Objectives tracker, and a "Wear it" note when loot beats
// what you wear. The goals come from src/game/whatnext.js; ui.js only calls in
// here. The HTML builders return plain strings so the tests can render them
// headlessly.
import { finishResumeTask } from '../game/resumetask.js';
import { whatNext, runGoal, packUpgrades, firstPackUpgrade } from '../game/whatnext.js';
import { qualityName } from '../game/loot.js';
import { getItem } from '../data/items.js';
import { compareGear, isUpgrade } from '../game/gear.js';
import { planCarry } from '../game/carry.js';
import { refineTag } from '../game/refine.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// A timer that never keeps Node (the headless tests) waiting; straight away without timers.
const later = (fn, ms) => { if (typeof setTimeout !== 'function') return fn(); setTimeout(fn, ms)?.unref?.(); };
// The tracker redraws every tick: work the goals out again at most this often.
const TRACKER_EVERY_TICKS = 5;

/** The journal card (a string; '' when there is nothing to suggest). */
export function whatNextHTML(game, goals = whatNext(game)) {
  if (!goals.length) return '';
  let html = '<div class="quest-head wn-head">What next?</div><div class="wn-card">';
  goals.forEach((g, i) => {
    html += `<div class="quest-row can-go wn-row wn-${g.kind}" data-wn="${i}"><div class="q-foot">`
      + `<span class="wn-ic" aria-hidden="true">${g.icon}</span>`
      + `<span class="wn-text"><b>${esc(g.title)}</b><span class="q-desc">${esc(g.text)}</span></span>`
      + `<button class="q-go wn-go" data-wn="${i}">${esc(g.go)}</button>`
      + (g.kind === 'resume' ? '<button class="q-go" data-wn-dismiss>Dismiss</button>' : '')
      + (g.kind === 'journey' ? '<button class="q-go" data-wn-journey>Options</button>' : '') + '</div></div>';
  });
  return html + '</div>';
}

/** Hook up the card's rows (after the journal's HTML is in). */
export function wireWhatNext(ui, root, goals) {
  for (const row of root?.querySelectorAll?.('.wn-row') || []) {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest?.('[data-wn-dismiss]')) finishResumeTask(ui.game, false);
      else if (e.target.closest?.('[data-wn-journey]')) ui.openFirstJourney?.();
      else runGoal(ui.game, goals[Number(row.dataset.wn)]);
      ui.renderQuestPanel();
    });
  }
}

/** The tracker row: the first goal, with a Go chip. Tapping it starts on it. */
export function whatNextTrackerRows(ui) {
  const g = ui.game;
  const c = ui._wnTrack;
  if (!c || g.tickCount - c.at >= TRACKER_EVERY_TICKS || g.tickCount < c.at) {
    ui._wnTrack = { at: g.tickCount, goal: whatNext(g)[0] || null };
  }
  const goal = ui._wnTrack.goal;
  const el = ui.el?.tracker;
  if (el && !el._wnWired && el.addEventListener) {
    el._wnWired = true;
    el.addEventListener('click', (e) => {
      if (!e.target.closest?.('.trk-next')) return;
      const goalNow = ui._wnTrack?.goal;
      ui._wnTrack = null;   // work the goals out afresh after this one starts
      runGoal(ui.game, goalNow);
    });
  }
  if (!goal) return [];
  return [`<button type="button" class="trk-row trk-next" title="${esc(goal.title)}: ${esc(goal.text)}">`
    + `<span class="trk-ic">&#10148;</span><span class="trk-next-text">${esc(goal.kind === 'quest' ? `${goal.title}: ${goal.text}` : goal.title)}</span>`
    + `<span class="trk-go">${esc(goal.go)}</span></button>`];
}

/** Keep the journal's card current: when the goals change (new loot, a level,
 *  a quest step done), redraw the journal, at most once a second. Only then,
 *  so a phone tap never lands on a card that was just replaced for nothing. */
export function watchGoals(ui) {
  const sig = (goals) => (goals || []).map((g) => g.key).join('|');
  const check = () => ui._soon?.('whatNext', () => {
    // Out of sight the journal works its goals out afresh when it next shows,
    // so there is nothing to compare yet (and working them out is not cheap).
    if (ui._panelHidden?.(ui.el?.questPanel)) { ui._questStale = true; return; }
    if (sig(whatNext(ui.game)) !== sig(ui._wnGoals)) ui.renderQuestPanel();
  }, 1000);
  for (const ev of ['inventory', 'equipment', 'levelup', 'quest', 'firstjourney']) ui.game.bus.on(ev, check);
}

// ---------------- "Wear it" when loot beats your gear ----------------
/** What Equip best just did, for the notice lane (it says so in the chat too,
 *  but the chat is folded away on a phone): the pieces that went on (up to
 *  three, the weapon first) and whether their ★ and lines came across.
 *  `changes`: bestpick.js wornChanges; `game` (optional) adds each piece's ★. */
export function equipBestNoteHTML(changes, game = null) {
  const on = (changes || []).filter((c) => c.to).sort((a, b) => (b.slot === 'weapon') - (a.slot === 'weapon'));
  if (!on.length) return '&#10003; You already wear your best gear.';
  // Three things at most: three pieces, or two and "N more".
  const named = on.slice(0, on.length > 3 ? 2 : 3).map((c) => {
    const eq = game?.equipment, lv = c.slot !== 'ammo' && eq ? eq.refineLevel(c.to, eq.copyIn(c.slot)) : 0;
    return `${esc(qualityName(c.to, c.q || null))}${lv ? ` ${refineTag(lv)}` : ''}`;
  });
  const list = on.length > 3 ? `${named.join(', ')} and ${on.length - 2} more`
    : named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0];
  return `<b>&#10003; Best in slot:</b> ${list}${on.some((c) => c.carried) ? ' · your ★ and lines carried over' : ''}`;
}

/** Watch the pack: when a piece turns up that beats what you wear, say so once
 *  (per item and quality, this session) with a button that puts it on. */
export function watchUpgrades(ui, { settleMs = 3000, debounceMs = 400 } = {}) {
  const game = ui.game;
  const told = new Set();
  let pending = false;
  const check = () => {
    pending = false;
    // (Pieces already mentioned aren't weighed again: a late-game pack holds hundreds.)
    const s = firstPackUpgrade(game, (x) => !told.has(`${x.id}:${x.q || ''}`));
    if (!s) return;
    const key = `${s.id}:${s.q || ''}`;
    told.add(key);
    // The starter kit and whatever you carried in a loaded save don't count:
    // only pieces that arrive while you play.
    if (!ui._wnUpReady) return;
    // A piece that wins only once the worn one's ★ and lines move across says so.
    // (A Monk's gloves go on the other hand, Game.goesOffhand: weighed, and carried to, there.)
    const slot = game.goesOffhand?.(s.id) ? 'shield' : getItem(s.id).equip?.slot;
    const viaCarry = !!slot && !isUpgrade(compareGear(s.id, game.equipment, slot === 'shield' ? 'shield' : null, s.q || null, game.combatMode?.()))
      && !!planCarry(game.equipment, s.id, slot, s.q || null);
    ui.lane?.push({ kind: 'note', key: `wear:${key}`, tag: 'wear', ttl: 9000, priority: 1,
      html: `<b>&#9650; Upgrade:</b> ${esc(qualityName(s.id, s.q || null))} beats what you wear${viaCarry ? ' once your ★ and lines carry over' : ''}. <button type="button" class="nl-act" data-act="wearbest">Wear it</button>` });
  };
  // Equip best, from anywhere (the Gear bar, the quick bar, the tracker, a
  // note's Wear it): notes about pieces now worn are stale, the tracker's gear
  // row is worked out afresh, and a note says what went on.
  game.bus.on('equipBest', (changes) => {
    ui.lane?.dismissTag?.('wear');
    ui.lane?.dismissTag?.('equipbest');
    ui._wnTrack = null;
    ui.lane?.push({ kind: 'note', key: 'equipbest', tag: 'equipbest', ttl: 6000, priority: 1, html: equipBestNoteHTML(changes, game) });
  });
  game.bus.on('inventory', () => {
    if (pending) return;
    pending = true;
    later(check, debounceMs);
  });
  // A few seconds in, start telling: anything in the pack by then is known.
  const ready = () => { for (const s of packUpgrades(game)) told.add(`${s.id}:${s.q || ''}`); ui._wnUpReady = true; };
  later(ready, settleMs);
  // The note's button (noticelane.js passes data-act on to ui.noticeAct).
  const prev = ui.noticeAct;
  ui.noticeAct = (act) => {
    if (act === 'wearbest') {
      const n = game.equipBest();
      if (!n) game.msg('Nothing in your pack beats what you wear right now.', 'system');
      return;
    }
    prev?.call(ui, act);
  };
}
