// Mastery ranks and quality tiers, side by side as two coloured ladders, so a
// player can see at a glance what each word means, what it adds and how to get
// it. Shown at the top of the Mastery window and from the "?" in the Gear view.
import { MASTERY_RANKS, BATTLE_CAP_RANK, rankProgress, KILL_XP, KILL_MULT } from '../game/mastery.js';
import { QUALITY, QUALITY_ORDER } from '../game/loot.js';
import { playIconHTML } from '../render/icons.js';

const fmt = (n) => Math.round(n).toLocaleString('en-GB');
// One colour per mastery rank, light to deep, so the ladder reads as a climb.
export const MASTERY_COLOURS = ['#9aa3ad', '#5fae7a', '#3d9a8f', '#3a7bd5', '#6a4fd8', '#b0398f', '#c2410c', '#a3122a', '#0f766e'];   // (Ascended: its own burnt orange, not Legendary quality's gold; the world-boss ranks a deep crimson and a deep teal)
/** What the world-boss ranks say about how they are earned. */
export const WORLD_BOSS_NOTE = 'Unlocked by defeating world bosses';

/** "rank 3 of 8, +45%" style facts for a mastery rank index. */
export function masteryFacts(rank) {
  const r = MASTERY_RANKS[rank] || MASTERY_RANKS[0];
  return { name: r.name, of: MASTERY_RANKS.length - 1, bonus: Math.round(r.gain * 100), xp: r.xp };
}

/** Progress in words: "12,000 / 20,000 XP to Expert", with a note when the next
 *  rank is a world-boss rank, or "Fully mastered" at the top. */
export function masteryProgressText(xp) {
  const p = rankProgress(xp);
  if (!p.next) return 'Fully mastered';
  return `${fmt(p.into)} / ${fmt(p.span)} XP to ${MASTERY_RANKS[p.next].name}${p.worldBoss ? ` (${WORLD_BOSS_NOTE.toLowerCase()})` : ''}`;
}

/** One line for a tooltip: "Sword mastery: Expert (rank 3 of 8, +45%) · 12,000 / 50,000 XP to Master". */
export function masteryLine(typeName, xp) {
  const p = rankProgress(xp);
  const f = masteryFacts(p.rank);
  return `${typeName} mastery: <b style="color:${MASTERY_COLOURS[p.rank]}">${f.name}</b> (rank ${p.rank} of ${f.of}${f.bonus ? `, +${f.bonus}%` : ''}) · ${p.next ? masteryProgressText(xp) : 'fully mastered'}`;
}

/** One line for a tooltip: "Epic quality (3rd of 5): +25% to this copy's stats". */
export function qualityLine(q) {
  const Q = QUALITY[q];
  if (!Q) return '';
  const i = QUALITY_ORDER.indexOf(q) + 1;
  const nth = ['', '1st', '2nd', '3rd', '4th', '5th'][i];
  return `<span class="q-word" style="color:${Q.color}">${Q.label}</span> quality (${nth} of ${QUALITY_ORDER.length}): +${Math.round(Q.gain * 100)}% to this copy's stats`;
}

/** The two ladders. `rank` (optional) marks a mastery rank you have reached. */
export function ranksCardHTML({ rank = -1 } = {}) {
  const m = MASTERY_RANKS.map((r, i) => `<li class="rk-step${i <= rank ? ' got' : ''}${r.worldBoss ? ' rk-boss' : ''}" style="--rk:${MASTERY_COLOURS[i]}"${r.worldBoss ? ` title="${WORLD_BOSS_NOTE}"` : ''}><b>${r.name}</b><span>${r.gain ? `+${Math.round(r.gain * 100)}%` : 'base'}</span><small>${r.xp ? `${fmt(r.xp)} XP${r.worldBoss ? ' · world bosses' : ''}` : 'start'}</small></li>`).join('');
  const q = [`<li class="rk-step" style="--rk:#9aa3ad"><b>Plain</b><span>+0%</span><small>most drops</small></li>`]
    .concat(QUALITY_ORDER.map((k) => `<li class="rk-step" style="--rk:${QUALITY[k].color}"><b>${playIconHTML(`quality-${k}`, 18)} ${QUALITY[k].label}</b><span>+${Math.round(QUALITY[k].gain * 100)}%</span><small>${['common', 'uncommon', 'rare', 'very rare', 'rarest'][QUALITY_ORDER.indexOf(k)]}</small></li>`)).join('');
  return `<div class="ranks-card">`
    + `<div class="rk-col"><div class="rk-head">${playIconHTML('ui-mastery', 20)} Mastery <small>per gear type · earned</small></div><ol class="rk-ladder">${m}</ol>`
    + `<p class="rk-how">Every sword shares Sword mastery, every plate body Plate body mastery, so it stays when you move up a tier. It gains XP with every kill while you wear that type (about ${KILL_XP} a monster, more for higher levels; x${KILL_MULT.champion} a champion, x${KILL_MULT.worldBoss} a world boss), and from feeding materials or sacrificing spare gear of the same type. `
    + `The last two ranks are <b>${WORLD_BOSS_NOTE.toLowerCase()}</b>: past ${MASTERY_RANKS[BATTLE_CAP_RANK].name}, only XP from bosses in the open world counts (not the Endless Gate's).</p></div>`
    + `<div class="rk-col"><div class="rk-head">Quality <small>per item copy · found</small></div><ol class="rk-ladder">${q}</ol>`
    + `<p class="rk-how">Each dropped piece rolls its own quality: champions and bosses roll higher. It shows as the colour of the item's name and a coloured edge on its icon, and stacks with mastery.</p></div>`
    + `</div>`;
}

/** The ladders on their own, in a window (the Gear view's "?"). */
export function openRanksGuide(ui, rank = -1) {
  ui.openModal('Mastery & quality', (body) => { body.innerHTML = ranksCardHTML({ rank }); });
}
