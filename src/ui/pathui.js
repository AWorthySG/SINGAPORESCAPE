// Your path between good and evil, in the Quest Journal (numbers from
// src/game/questchoices.js): the "Your path" card at the top (a meter from
// Villain to Paragon, your title, what it gives you in a fight now, how far the
// next tier is, choices waiting, and the Redemption / Corruption arcs), the
// Crossroads list of the island's moral encounters with a Go for each one not
// yet met, and the sun / moon marks on every quest and chapter that holds a
// choice. ui.js calls installPathUI and puts pathJournalHTML at the top of the
// journal; the builders return plain strings so the tests can render them.
import { questChoice } from '../data/questChoices.js';
import { MORAL_EVENTS } from '../data/moralEvents.js';
import * as QC from '../game/questchoices.js';
import { speakerName } from '../game/story.js';

const { SUN, MOON, SCALES } = QC;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
const iconFor = (cls) => (cls === 'good' ? SUN : cls === 'evil' ? MOON : SCALES);

/** A small mark beside a quest or chapter that holds a choice: sun and moon
 *  until you choose, then the one you picked. */
export function choiceBadgeHTML(game, key) {
  const c = questChoice(key);
  if (!c) return '';
  const pick = QC.choicePick(game, key);
  const tip = pick ? `You chose ${pick === 'good' ? 'Good' : 'Evil'}: ${c[pick].done}` : 'Holds a Good or Evil choice';
  return ` <span class="qc-badge${pick ? ` ${pick}` : ''}" title="${esc(tip)}" aria-label="${esc(tip)}">${pick === 'good' ? SUN : pick === 'evil' ? MOON : SUN + MOON}</span>`;
}

/** Under a quest or chapter: which way you went, or the choice waiting with a Choose button. */
export function choiceLineHTML(game, key) {
  const c = questChoice(key);
  if (!c) return '';
  const pick = QC.choicePick(game, key);
  if (pick) return `<div class="qc-line ${pick}">${pick === 'good' ? SUN : MOON} ${esc(c[pick].done)}</div>`;
  if (QC.choicePending(game, key)) {
    return `<div class="qc-line wait"><span>${SCALES} A choice waits: ${esc(c.title)}</span>`
      + `<button class="path-go qc-choose" type="button" data-qc="${key}" title="Make the choice">Choose</button></div>`;
  }
  return '';
}

/** The "Your path" card. */
export function pathCardHTML(game) {
  const p = QC.pathInfo(game);
  const segs = QC.METER_TIERS.map((id) => `<i class="pathm-${id}${id === p.tier ? ' on' : ''}"></i>`).join('');
  const next = [];
  if (p.cls !== 'evil') next.push(p.nextGood ? `${SUN} ${p.nextGood.need} more Good to become <b>${esc(p.nextGood.title)}</b>` : `${SUN} Paragon is the highest Good tier`);
  if (p.cls !== 'good') next.push(p.nextEvil ? `${MOON} ${p.nextEvil.need} more Evil to become <b>${esc(p.nextEvil.title)}</b>` : `${MOON} Villain is the lowest Evil tier`);
  const met = QC.crossroads(game).filter((x) => x.side).length;
  const made = QC.CHOICE_KEYS.filter((k) => QC.choicePick(game, k)).length;
  let html = `<div class="path-card path-${p.cls}" data-tier="${p.tier}">`
    + `<div class="path-head"><span class="path-icon" aria-hidden="true">${iconFor(p.cls)}</span><b>Your path: <span class="path-title">${esc(p.title)}</span></b>`
    + `<span class="path-net" title="Good minus Evil">${signed(p.a)}</span></div>`
    + `<div class="path-meter" role="img" aria-label="${esc(`${p.title}, ${signed(p.a)}, on a scale from Villain to Paragon`)}">`
    + `<div class="pathm-bar">${segs}</div><span class="pathm-pin" style="left:${p.pin}%"></span></div>`
    + `<div class="pathm-ends"><span>${MOON} Villain</span><span>Paragon ${SUN}</span></div>`
    + `<div class="path-fight">${esc(p.fight)}</div>`
    + `<div class="path-next">${next.join('<br>')}</div>`
    + `<div class="path-tally">Good ${p.good} · Evil ${p.evil} · Crossroads ${met}/${MORAL_EVENTS.length} · Quest choices ${made}/${QC.CHOICE_KEYS.length}</div>`;
  const waiting = QC.pendingChoices(game);
  for (const k of waiting) {
    const c = questChoice(k);
    html += `<div class="qc-line wait"><span>${SCALES} ${esc(QC.choicePlace(k))}: ${esc(c.title)}</span>`
      + `<button class="path-go qc-choose" type="button" data-qc="${k}" title="Make the choice">Choose</button></div>`;
  }
  html += '<div class="path-arcs">';
  for (const arc of QC.arcs(game)) {
    html += `<div class="arc-row ${arc.state}${arc.open ? '' : ' shut'}"><span class="arc-text"><b>${arc.id === 'redemption' ? SUN : MOON} ${esc(arc.name)}</b>`
      + `<small>${esc(arc.text)}</small></span>`
      + (arc.go ? `<button class="path-go" type="button" data-arc="${arc.id}" title="Walk there">Go</button>` : '') + '</div>';
  }
  return `${html}</div></div>`;
}

/** The Crossroads: every moral encounter, what you chose, or where to find it. */
export function crossroadsHTML(game, open = false) {
  const list = QC.crossroads(game);
  const met = list.filter((x) => x.side).length;
  let html = `<details class="quest-row cross-card"${open ? ' open' : ''}><summary class="q-top"><b>${SCALES} Crossroads</b>`
    + `<span class="q-chip ${met === list.length ? 'done' : met ? 'active' : 'todo'}">${met}/${list.length}</span></summary>`
    + '<span class="q-desc">People around the island who need a hand, or could be taken advantage of. Each asks once.</span>';
  for (const x of list) {
    html += `<div class="cross-row ${x.side || 'todo'}" data-cross="${x.id}"><span class="cr-ic" aria-hidden="true">${x.side === 'good' ? SUN : x.side === 'evil' ? MOON : '○'}</span>`
      + `<span class="cr-text"><b>${esc(x.name)}</b><small>${esc(x.zone)}${x.side ? ` · ${esc(x.chose)}` : ''}</small></span>`
      + (x.side ? '' : `<button class="path-go" type="button" data-moral="${x.id}" title="Walk there">Go</button>`) + '</div>';
  }
  return `${html}</details>`;
}

/** The top of the journal: the path card, then the Crossroads (kept open if you opened it). */
export const pathJournalHTML = (ui) => pathCardHTML(ui.game) + crossroadsHTML(ui.game, !!ui._crossOpen);

/** Wire the buttons, the quest choice dialogue and the redraws. */
export function installPathUI(ui) {
  const game = ui.game;
  // A quest choice in the usual dialogue box, asked by whoever it belongs to.
  ui.openQuestChoice = (key) => {
    const c = questChoice(key), tree = QC.choiceTree(game, key);
    if (!c || !tree || typeof document === 'undefined') return false;
    if (ui.modal) ui.closeModal?.();
    ui.openDialogue({ name: speakerName(c.who), npcId: c.who, def: {} }, tree);
    return true;
  };
  if (typeof document === 'undefined') return;
  // Caught on the way down, before a quest card's own "tap to travel".
  const click = (e) => {
    const t = e.target.closest?.('[data-qc],[data-moral],[data-arc]');
    if (!t) return;
    e.stopPropagation();
    e.preventDefault();
    if (t.dataset.qc) ui.openQuestChoice(t.dataset.qc);
    else if (t.dataset.moral) QC.goToMoral(game, t.dataset.moral);
    else if (t.dataset.arc) game.questTravel(t.dataset.arc);
  };
  for (const id of ['quest-panel', 'story-panel']) document.getElementById(id)?.addEventListener('click', click, true);
  document.getElementById('quest-panel')?.addEventListener('toggle', (e) => {
    if (e.target.classList?.contains('cross-card')) ui._crossOpen = e.target.open;
  }, true);
  const soon = () => (ui._soon ? ui._soon('path', () => ui.renderQuestPanel(), 300) : ui.renderQuestPanel());
  for (const ev of ['karma', 'story']) game.bus.on(ev, soon);
}
