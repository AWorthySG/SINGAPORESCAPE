// Good and evil inside the quest lines (data in src/data/questChoices.js), and
// the bits of your path the journal and the world show you.
//
// A choice opens when its chapter or region line is finished live (old saves'
// finished chapters simply have none). It is offered in the dialogue box: a
// chapter's right before its ending scene (story.js), a line's by its giver
// straight after the hand-in (regionquests.js). Shut the box and it waits, in
// the journal and with the giver, until you choose. Auto quest and auto
// battle never choose for you. Both answers complete the same way.
//
// State lives on game.story (saved with it): `picks` { key: 'good'|'evil' }
// and `open`, the keys still waiting.
//
// Also here: the payout shared with the moral encounters (payMoral), the
// karma feedback (a floating "☀️ +10 Good" over you, a card for a big change
// and a notice when your tier changes) and the numbers for the journal's
// "Your path" card, Crossroads list and the Redemption / Corruption arcs.
import { CHAPTER_CHOICES, LINE_CHOICES, TIER_LINES, questChoice } from '../data/questChoices.js';
import { CHAPTERS } from '../data/story.js';
import { REGION_LINES } from '../data/regionQuests.js';
import { MORAL_EVENTS, MORAL_BY_ID, moralCoins, BLESS_MS, BLESS_XP } from '../data/moralEvents.js';
import { ALIGN_TIERS, alignmentTier } from '../data/alignment.js';
import { QUESTS } from '../data/quests.js';
import { xpForLevel } from '../data/xp.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { getItem } from '../data/items.js';
import { getNpc } from '../data/npcs.js';
import { xpText } from './skillset.js';
import { XP_RATE } from '../config.js';

export const SUN = '☀️', MOON = '🌙', SCALES = '⚖️';
// Every choice, in journal order: the chapters, then the region lines.
export const CHOICE_KEYS = [...CHAPTERS.map((c) => c.id).filter((id) => CHAPTER_CHOICES[id]), ...REGION_LINES.map((l) => l.id).filter((id) => LINE_CHOICES[id])];
// The arcs' doors, as game.js opens them (startRedemption / startCorruption).
export const REDEMPTION_OPENS_EVIL = 10, CORRUPTION_OPENS_AT = -10;
// A change this big (one choice's worth) also puts up a card; smaller ones
// (a boss kill's +5, a pack's +1) only float over you.
const CARD_AT = 6;

const who = (id) => getNpc(id)?.name || 'Someone';

/** A choice's button text: the sun or moon, the words, and "(Good)" / "(Evil)". */
export const choiceLabel = (c, side) => (side === 'good' ? `${SUN} ${c.good.label} (Good)` : `${MOON} ${c.evil.label} (Evil)`);

// ---------------- Paying out ----------------
/** Pay one side of a moral moment (an encounter or a quest choice): its karma,
 *  then the lopsided rewards. Returns what was gained, for the chat. */
export function payMoral(game, c, side) {
  if (side === 'good') game.addGood(c.karma); else game.addEvil(c.karma);
  const gains = [`${c.karma} ${side} karma`], fl = game.fightLevel();
  if (c.skill && c.xp) {
    // A share of the XP to the skill's next level, so it matters at any level.
    const lvl = game.skills.level(c.skill), need = xpForLevel(lvl + 1) - xpForLevel(lvl);
    const xp = Math.max(1, Math.round(need * c.xp / XP_RATE / game.skills.lifeXpMult(c.skill)));
    gains.push(`${xpText(game.skills.addXp(c.skill, xp))} ${SKILL_BY_ID[c.skill]?.name || c.skill} XP`);
  }
  if (c.coins) { const n = moralCoins(c.coins, fl); game.inventory.add('coins', n); gains.push(`${n} coins`); }
  for (const [item, q] of c.items || []) { game.inventory.add(item, q); gains.push(`${q} ${getItem(item).name}`); }
  if (c.shrine) { game.shrine.points += c.shrine; game.bus.emit('shrine'); gains.push(`${c.shrine} shrine points`); }
  if (c.bless) { game.blessedMs = BLESS_MS; game.bus.emit('xpbonus'); gains.push(`Blessed (+${Math.round((BLESS_XP - 1) * 100)}% combat XP for ${BLESS_MS / 60000} minutes)`); }
  return gains;
}

// ---------------- Quest choices ----------------
export const choicePick = (game, key) => game.story?.picks?.[key] || null;
export const choicePending = (game, key) => !!(game.story?.open?.has(key) && !choicePick(game, key));
/** Keys still waiting for you, in journal order. */
export const pendingChoices = (game) => CHOICE_KEYS.filter((k) => choicePending(game, k));
const isChapter = (key) => !!CHAPTER_CHOICES[key];
/** Where a choice sits, for the journal: "Chapter 3" or the line's region. */
export function choicePlace(key) {
  if (isChapter(key)) return `Chapter ${CHAPTERS.findIndex((c) => c.id === key) + 1}`;
  return REGION_LINES.find((l) => l.id === key)?.region || '';
}

/** A chapter or line is finished: its choice (if it has one) now waits for you. */
export function offerChoice(game, key) {
  const c = questChoice(key), s = game.story;
  if (!c || !s || choicePick(game, key) || s.open.has(key)) return false;
  s.open.add(key);
  game.msg(`${SCALES} A choice waits: ${c.title}. ${isChapter(key) ? 'Open the Journal to decide' : `Talk to ${who(c.who)}, or open the Journal`}.`, 'system');
  game.saveSoon = true;
  game.bus.emit('story');
  return true;
}

/** Make a waiting choice. Only the dialogue box calls this (a 'qc:<key>:<side>'
 *  action): automation never chooses for you. True if it was made. */
export function chooseQuest(game, key, side) {
  const c = questChoice(key), s = game.story;
  if (!c || !s || (side !== 'good' && side !== 'evil') || !choicePending(game, key)) return false;
  s.picks[key] = side;
  s.open.delete(key);
  const gains = payMoral(game, c[side], side);
  game.msg(`${c.title}: ${side === 'good' ? 'a good deed' : 'an evil deed'}. +${gains.join(', +')}.`, 'level');
  game.spawnSparkle?.(game.player, side === 'good' ? '#ffd24a' : '#9a5ad8', 14);
  game.bus.emit('sfx', side === 'good' ? 'level' : 'hurt');
  game.saveSoon = true;
  game.bus.emit('story');
  return true;
}

export const CHOICE_NODES = ['qcgood', 'qcgoodr', 'qcevil', 'qcevilr'];

/** A choice as a dialogue tree (dialogue.js format): the scene with its two
 *  answers (and "Let me think about it."), then what happens and what the
 *  asker says back. A chapter whose ending scene is still to play leaves the
 *  reply to that scene (it opens with it), so it isn't said twice. */
export function choiceTree(game, key) {
  const c = questChoice(key);
  if (!c) return null;
  const speaker = who(c.who);
  const replyHere = !isChapter(key) || !!game.story?.seen?.has(`${key}:outro`);
  const pick = choicePick(game, key);
  const side = (s) => ({
    [`qc${s}`]: { speaker, text: c[s].outcome, options: [{ label: replyHere ? 'Continue.' : 'Farewell.', next: replyHere ? `qc${s}r` : 'end' }] },
    [`qc${s}r`]: { speaker, text: c[s].react, options: [{ label: 'Farewell.', next: 'end' }] },
  });
  const start = pick
    ? { speaker, text: c[pick].after || c[pick].react, options: [{ label: 'Goodbye.', next: 'end' }] }
    : { speaker, text: c.text, options: [
      { label: choiceLabel(c, 'good'), next: 'qcgood', action: `qc:${key}:good` },
      { label: choiceLabel(c, 'evil'), next: 'qcevil', action: `qc:${key}:evil` },
      { label: 'Let me think about it.', next: 'end' },
    ] };
  return { start, ...side('good'), ...side('evil') };
}

/** The reply that opens a chapter's ending scene once you have chosen. */
export function choiceReply(game, key) {
  const c = questChoice(key), pick = choicePick(game, key);
  return c && pick ? { who: c.who, text: c[pick].react } : null;
}

/** What a region line's giver says once its choice is made (else null: their thanks). */
export function choiceAfter(game, key) {
  const c = LINE_CHOICES[key], pick = choicePick(game, key);
  return c && pick ? c[pick].after || null : null;
}

/** A Paragon's or a Villain's extra line from this person, or null. */
export function tierLine(game, npcId) {
  const t = alignmentTier(game.alignment()).id;
  return TIER_LINES[npcId]?.[t] || null;
}

// ---------------- Karma feedback ----------------
/** Remember where karma stands now, quietly (a new game or a load). */
export function baselineKarma(game) {
  const k = game.karma || { good: 0, evil: 0 };
  game._karmaSeen = { good: k.good, evil: k.evil, tier: alignmentTier(game.alignment()).id };
}

/** Karma changed: float the gain over you, put up a card for a big one, and
 *  say so when it moves you to a new tier. */
export function karmaFeedback(game) {
  const k = game.karma, last = game._karmaSeen;
  if (!k) return;
  baselineKarma(game);
  if (!last) return;
  const dg = k.good - last.good, de = k.evil - last.evil, p = game.player;
  if (p?.alive) {
    if (dg > 0) game.addHitsplat?.(p, 0, { text: `${SUN} +${dg} Good` });
    if (de > 0) game.addHitsplat?.(p, 0, { text: `${MOON} +${de} Evil` });
  }
  const t = alignmentTier(game.alignment()), a = game.alignment();
  const where = `Your path: ${t.title} (${a > 0 ? '+' : ''}${a})`;
  if (dg >= CARD_AT) game.banner?.(`<span class="big">${SUN} +${dg} Good</span>${where}`);
  if (de >= CARD_AT) game.banner?.(`<span class="big">${MOON} +${de} Evil</span>${where}`);
  if (t.id !== last.tier) {
    const icon = t.cls === 'good' ? SUN : t.cls === 'evil' ? MOON : SCALES;
    const head = t.id === 'neutral' ? 'You are Neutral again' : `You are now ${t.title}`;
    const fight = combatText(game.karmaCombat());
    game.msg(`${icon} ${head}. ${fight}`, 'level');
    game.banner?.(`<span class="big">${icon} ${head}</span>${fight}`);
    game.bus.emit('karmatier', t.id);
  }
}

// ---------------- The journal's numbers ----------------
/** One line on what your alignment does in a fight (game.karmaCombat()). */
export function combatText(kc) {
  const stars = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
  if (kc.side === 'holy') return `Holy path ${stars(kc.tier)}: +${Math.round(kc.holyDmg * 100)}% damage to Undead, Spirits and Demons, and each kill heals ${Math.round(kc.killHeal * 100)}% of your life.`;
  if (kc.side === 'dark') return `Dark path ${stars(kc.tier)}: +${kc.critDmg}% crit damage and +${kc.lifesteal}% lifesteal against everything.`;
  return 'No fight bonus yet: lean Good for the Holy path, or Evil for the Dark path.';
}

// The meter runs Villain to Paragon in seven equal steps, one per tier, so the
// narrow Neutral middle is as easy to read as the wide ends.
const METER = [['villain', -100, -60], ['wicked', -60, -25], ['mischievous', -25, -8], ['neutral', -8, 8], ['kind', 8, 25], ['virtuous', 25, 60], ['paragon', 60, 100]];
export const METER_TIERS = METER.map(([id]) => id);

/** Where you stand: tier, the meter's pin (0-100), the fight bonus and what the
 *  next tier along each side needs. */
export function pathInfo(game) {
  const a = game.alignment(), t = alignmentTier(a);
  const i = METER.findIndex(([id]) => id === t.id), [, lo, hi] = METER[i];
  const pin = Math.round(((i + Math.max(0, Math.min(1, (a - lo) / (hi - lo)))) / METER.length) * 1000) / 10;
  const up = ALIGN_TIERS.filter((x) => x.min != null && x.min > a).sort((x, y) => x.min - y.min)[0];
  const down = ALIGN_TIERS.filter((x) => x.max != null && x.max < a).sort((x, y) => y.max - x.max)[0];
  return {
    a, tier: t.id, title: t.title, cls: t.cls, color: t.color, pin,
    good: game.karma?.good || 0, evil: game.karma?.evil || 0,
    fight: combatText(game.karmaCombat()),
    nextGood: up ? { title: up.title, need: up.min - a } : null,
    nextEvil: down ? { title: down.title, need: a - down.max } : null,
  };
}

/** The 12 moral encounters: where, and what you chose (if you have). */
export function crossroads(game) {
  return MORAL_EVENTS.map((ev) => {
    const side = game.moral?.choices?.[ev.id] || null;
    return { id: ev.id, name: ev.name, zone: ev.zone, side, chose: side ? ev[side].label.replace(/ \((Good|Evil)\)$/, '') : '' };
  });
}

/** Walk to an encounter's person and talk to them (the journal's Go). */
export function goToMoral(game, id) {
  const ev = MORAL_BY_ID[id], n = game.npcs.find((x) => x.def.moral === id);
  if (!ev || !n || !game.player.alive || game.moral.choices[id]) return false;
  const ok = game.goToNpc(n);
  game.msg(ok ? `You set off for the ${ev.name.toLowerCase()} in ${ev.zone}.` : `I can't find the way to the ${ev.name.toLowerCase()}.`, 'system');
  return ok;
}

/** The Path of Redemption and the Path of Corruption: open yet, how to start, progress. */
export function arcs(game) {
  const k = game.karma || { good: 0, evil: 0 }, a = game.alignment();
  const prog = (id) => { const d = QUESTS.find((q) => q.id === id); try { return d?.progress?.(game) || ''; } catch { return ''; } };
  const one = (id, name, giver, opens, openText, shutText) => {
    const state = game.quests[id]?.state || 'notStarted';
    let text, go = false;
    if (state === 'done') text = id === 'redemption' ? 'Complete: your evil was washed away.' : 'Complete: you were reborn in darkness.';
    else if (state === 'active') { text = `${prog(id)}. Then return to ${who(giver)}.`; go = true; }
    else if (opens) { text = `Open now: ${openText}`; go = true; }
    else text = shutText;
    return { id, name, state, open: opens || state !== 'notStarted', text, go };
  };
  return [
    one('redemption', 'The Path of Redemption', 'light_priestess', k.evil >= REDEMPTION_OPENS_EVIL,
      `talk to ${who('light_priestess')} by the Monument to atone.`,
      `Opens once you carry ${REDEMPTION_OPENS_EVIL} Evil (you have ${k.evil}).`),
    one('corruption', 'The Path of Corruption', 'shadow_broker', a <= CORRUPTION_OPENS_AT,
      `find ${who('shadow_broker')} lurking near the bank.`,
      `Opens at alignment ${CORRUPTION_OPENS_AT} or lower (you are at ${a > 0 ? '+' : ''}${a}).`),
  ];
}
