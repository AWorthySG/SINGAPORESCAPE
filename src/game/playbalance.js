// Play balance: Focus, Rested XP and the gravestone. Three gentle nudges that
// sit on top of the rest of the game, kept here so game.js only calls in.
//
// Focus: auto battle and auto gather spend it, hands-on play (clicking,
// steering, pressing keys) refills it, and it trickles back on its own while
// you are logged in and while you are away. While it lasts, automatic play
// earns full rewards; once it runs dry automatic play carries on, just at
// TIRED_MULT of the XP and loot. The numbers are generous: a full bar is
// FOCUS_MAX_MS of automatic play, and a minute of hands-on play buys
// FOCUS_ACTIVE_REFILL minutes of it, so it nudges rather than nags.
//
// Rested XP: time logged out builds a rested pool (RESTED_RATE of the time
// away, up to RESTED_CAP_MS, i.e. about 8 hours away; faster with a bed in
// your kampong home, home.js). While the pool lasts,
// every XP gain is worth RESTED_MULT as much (multiplying with golden hours
// and the rest), and each game tick in which you earn XP uses up a tick of it.
//
// Gravestone: dying leaves a gravestone where you fell holding a share of the
// coins in your pack and its most valuable stacks (never worn gear, tools or
// clue scrolls). Walk back to it within GRAVE_TICKS (15 minutes of play) to
// take everything back, or pay a small fee from the Grave button to have it
// brought to you. Only if you leave it until it crumbles is anything lost.

import { getItem } from '../data/items.js';
import { TICK_MS } from '../config.js';

const HOUR = 3600 * 1000, MIN = 60 * 1000;

export const FOCUS_MAX_MS = 6 * HOUR;       // a full bar: six hours of automatic play
export const FOCUS_SPEND = 1;               // automatic play uses Focus at real time...
export const FOCUS_ACTIVE_REFILL = 3;       // ...hands-on play refills it three times as fast...
export const FOCUS_ONLINE_REGEN = 0.25;     // ...and it trickles back at a quarter speed online...
export const FOCUS_OFFLINE_REGEN = 0.5;     // ...and half speed while you're away (12h away fills it)
export const HANDS_ON_TICKS = 10;           // a click or key counts as hands-on play for 6 seconds
export const TIRED_MULT = 0.7;              // automatic play with no Focus left: 70% XP and loot

export const RESTED_MULT = 1.5;             // +50% XP while rested
export const RESTED_RATE = 0.25;            // each hour away gives 15 minutes of rested play...
export const RESTED_CAP_MS = 2 * HOUR;      // ...up to 2 hours of it (8 hours away)
export const RESTED_MIN_AWAY_MS = 10 * MIN; // a quick reload doesn't count as time away

export const GRAVE_TICKS = Math.round(15 * MIN / TICK_MS);   // 15 minutes of play to walk back
export const GRAVE_COIN_SHARE = 0.2;        // a fifth of the coins in your pack...
export const GRAVE_STACKS = 2;              // ...and its two most valuable stacks
export const GRAVE_FEE_SHARE = 0.1;         // fetching it from afar costs a tenth of what it holds
export const GRAVE_FEE_MIN = 50;

/** A fresh state: a full Focus bar, no rested pool, no gravestone. */
export function initPlay(game) {
  game.play = { focus: FOCUS_MAX_MS, rested: 0, handsOnTick: -1e9, grave: null, xpTick: false, tired: false };
}

/** The player did something by hand (a click, a key, the joystick). */
export function handsOn(game) {
  if (game.play) game.play.handsOnTick = game.tickCount;
}

/** Is automatic play running this tick (auto battle on, or auto gather at work)? */
export function autoRunning(game) {
  if (!game.player?.alive) return false;
  return !!(game.autoBattle || (game.autoGather && (game.player.action || game._autoLife)));
}

/** Out of Focus while playing automatically: rewards are cut to TIRED_MULT. */
export function isTired(game) {
  return !!game.play && game.play.focus <= 0 && autoRunning(game);
}

/** Share of the Focus bar left, 0-1. */
export const focusShare = (game) => Math.max(0, Math.min(1, (game.play?.focus || 0) / FOCUS_MAX_MS));

/** "2h 05m" / "14m" / "40s" for the HUD. */
export function fmtMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

/** The XP multiplier from this module (rested and tired), applied to every XP
 *  gain through Skills.timeMult. Notes that XP was earned this tick, so the
 *  rested pool is used up by play that earns XP rather than by standing about. */
export function xpMult(game) {
  const pl = game.play;
  if (!pl) return 1;
  pl.xpTick = true;
  let m = pl.rested > 0 ? RESTED_MULT : 1;
  if (isTired(game)) m *= TIRED_MULT;
  return m;
}

/** Automatic play with no Focus left: a kill's loot is trimmed to about
 *  TIRED_MULT (stackables shrink, common single items may not drop). Rare and
 *  better drops are never touched. Changes `loot` in place. */
export function trimLoot(game, loot, rand = Math.random) {
  if (!isTired(game)) return;
  for (let i = loot.length - 1; i >= 0; i--) {
    const l = loot[i], rar = l[2] || 'common';
    if (rar !== 'common') continue;
    if (getItem(l[0]).stackable) l[1] = Math.max(1, Math.round(l[1] * TIRED_MULT));
    else if (rand() > TIRED_MULT) loot.splice(i, 1);
  }
}

/** Once per game tick: spend or refill Focus, use up rested time, and look
 *  after the gravestone. */
export function tickPlay(game) {
  const pl = game.play;
  if (!pl) return;
  const auto = autoRunning(game);
  const v = game.moveInput;
  if (v && Math.hypot(v.x, v.y) > 0.2) pl.handsOnTick = game.tickCount;   // steering counts as hands-on
  const hands = game.tickCount - pl.handsOnTick <= HANDS_ON_TICKS;
  const before = pl.focus;
  pl.focus += TICK_MS * (FOCUS_ONLINE_REGEN + (hands ? FOCUS_ACTIVE_REFILL : 0) - (auto ? FOCUS_SPEND : 0));
  pl.focus = Math.max(0, Math.min(FOCUS_MAX_MS, pl.focus));
  if (before > 0 && pl.focus <= 0 && auto) {
    game.msg(`Your Focus has run out: automatic play now earns ${Math.round(TIRED_MULT * 100)}% XP and loot. Play by hand for a while (or take a break) to refill it.`, 'system');
  }
  const tired = pl.focus <= 0 && auto;
  if (tired !== pl.tired) { pl.tired = tired; game.bus.emit('play'); }
  if (pl.xpTick && pl.rested > 0) {
    pl.rested = Math.max(0, pl.rested - TICK_MS);
    if (pl.rested <= 0) { game.msg('Your rested bonus is used up. Time away from the game builds it again.', 'system'); game.bus.emit('play'); }
  }
  pl.xpTick = false;
  tickGrave(game);
}

/** Time away (ms, from the save's timestamp): build the rested pool and refill
 *  Focus, and say welcome back. */
export function applyAway(game, awayMs) {
  const pl = game.play;
  if (!pl || !(awayMs >= RESTED_MIN_AWAY_MS)) return null;
  // A bed at home (a Construction build, home.js) builds it faster.
  const restedGain = Math.min(RESTED_CAP_MS - pl.rested, awayMs * RESTED_RATE * (1 + (game.home?.restedBonus?.() || 0)));
  pl.rested = Math.max(pl.rested, Math.min(RESTED_CAP_MS, pl.rested + Math.max(0, restedGain)));
  const f0 = pl.focus;
  pl.focus = Math.min(FOCUS_MAX_MS, pl.focus + awayMs * FOCUS_OFFLINE_REGEN);
  const focusGain = pl.focus - f0;
  const parts = [`You were away ${fmtMs(awayMs)}.`];
  if (pl.rested > 0) parts.push(`Rested: +${Math.round((RESTED_MULT - 1) * 100)}% XP for your next ${fmtMs(pl.rested)} of play.`);
  if (focusGain >= MIN) parts.push(`Focus refilled by ${fmtMs(focusGain)}.`);
  pl.welcome = parts.join(' ');
  return { rested: pl.rested, focusGain };
}

// ---------------- Saving ----------------
export function serializePlay(game) {
  const pl = game.play;
  if (!pl) return null;
  return { focus: Math.round(pl.focus), rested: Math.round(pl.rested), grave: pl.grave };
}

/** Load the saved state (every field optional: older saves start full and
 *  unrested) and credit the time since `savedAt`. */
export function loadPlay(game, data, savedAt, now = Date.now()) {
  initPlay(game);
  const pl = game.play;
  if (data && typeof data === 'object') {
    if (typeof data.focus === 'number' && data.focus >= 0) pl.focus = Math.min(FOCUS_MAX_MS, data.focus);
    if (typeof data.rested === 'number' && data.rested > 0) pl.rested = Math.min(RESTED_CAP_MS, data.rested);
    const g = data.grave;
    if (g && typeof g === 'object' && Number.isFinite(g.x) && Number.isFinite(g.y) && Number.isFinite(g.left) && g.left > 0) {
      const items = Array.isArray(g.items) ? g.items.filter((e) => e && typeof e.id === 'string' && e.qty > 0 && safeItem(e.id)) : [];
      pl.grave = { x: g.x, y: g.y, left: Math.floor(g.left), coins: Math.max(0, Math.floor(Number(g.coins) || 0)), items: items.map((e) => ({ id: e.id, qty: Math.floor(e.qty) })) };
    }
  }
  if (typeof savedAt === 'number' && savedAt > 0) applyAway(game, now - savedAt);
}

function safeItem(id) { try { return !!getItem(id); } catch { return false; } }

// ---------------- Gravestone ----------------
/** What the gravestone takes when you fall: GRAVE_COIN_SHARE of the pack's
 *  coins and its GRAVE_STACKS most valuable stacks. Never worn gear (it isn't
 *  in the pack), tools, clue scrolls or worthless things. */
export function graveTake(game) {
  const inv = game.inventory;
  const coins = Math.floor(inv.count('coins') * GRAVE_COIN_SHARE);
  const stacks = new Map();
  for (const s of inv.slots) {
    if (!s || s.id === 'coins') continue;
    const it = getItem(s.id);
    if (it.tool || !(it.value > 0) || s.id.startsWith('clue_scroll')) continue;
    stacks.set(s.id, (stacks.get(s.id) || 0) + s.qty);
  }
  const items = [...stacks].map(([id, qty]) => ({ id, qty, worth: getItem(id).value * qty }))
    .sort((a, b) => b.worth - a.worth).slice(0, GRAVE_STACKS).map(({ id, qty }) => ({ id, qty }));
  return { coins, items };
}

/** The player has died (outside the Endless Gate): raise or add to the gravestone. */
export function onDeath(game) {
  const pl = game.play;
  if (!pl || game.waves?.active) return null;
  const take = graveTake(game);
  if (!take.coins && !take.items.length) return null;
  if (take.coins) game.inventory.remove('coins', take.coins);
  for (const e of take.items) game.inventory.remove(e.id, e.qty);
  // Dying again before you got back: the old stone's goods move to the new one, nothing is lost.
  const old = pl.grave;
  const items = old ? [...old.items] : [];
  for (const e of take.items) {
    const have = items.find((x) => x.id === e.id);
    if (have) have.qty += e.qty; else items.push({ ...e });
  }
  const p = game.player;
  pl.grave = { x: p.x, y: p.y, left: GRAVE_TICKS, coins: (old?.coins || 0) + take.coins, items };
  game.msg(`A gravestone marks where you fell, holding ${graveSummary(pl.grave)}. Walk back to it within ${fmtMs(GRAVE_TICKS * TICK_MS)} to take it all back, or pay ${graveFee(game)} coins from the Grave button to have it brought to you. Worn gear is always safe.`, 'system');
  game.bus.emit('play');
  return pl.grave;
}

/** "1,200 coins and 2 x Iron bar" */
export function graveSummary(g) {
  const parts = [];
  if (g.coins) parts.push(`${g.coins.toLocaleString('en-GB')} coins`);
  for (const e of g.items) parts.push(`${e.qty > 1 ? e.qty + ' x ' : ''}${getItem(e.id).name}`);
  return parts.join(', ').replace(/, ([^,]*)$/, ' and $1') || 'nothing';
}

/** Coins it costs to have the gravestone's goods brought to you. */
export function graveFee(game) {
  const g = game.play?.grave;
  if (!g) return 0;
  const worth = g.coins + g.items.reduce((s, e) => s + (getItem(e.id).value || 0) * e.qty, 0);
  return Math.max(GRAVE_FEE_MIN, Math.round(worth * GRAVE_FEE_SHARE));
}

function giveBack(game, g) {
  if (g.coins) game.inventory.add('coins', g.coins);
  for (const e of g.items) game.inventory.add(e.id, e.qty);
  game.play.grave = null;
  game.bus.emit('play');
}

/** Standing at (or next to) your gravestone: take everything back. */
export function claimGrave(game) {
  const g = game.play?.grave;
  if (!g) return false;
  const what = graveSummary(g);
  giveBack(game, g);
  game.msg(`You gather up your belongings from the gravestone: ${what}.`, 'level');
  return true;
}

/** Pay the fee (from the gravestone's own coins first, then your pack, then
 *  the bank) to have its goods brought to you wherever you are. */
export function buyBackGrave(game) {
  const g = game.play?.grave;
  if (!g || !game.player.alive) return false;
  const total = graveFee(game);
  let fee = total;
  const have = g.coins + game.inventory.count('coins') + game.bank.count('coins');
  if (have < total) { game.msg(`You need ${total} coins to have your gravestone's goods brought to you.`, 'system'); return false; }
  const fromGrave = Math.min(g.coins, fee); g.coins -= fromGrave; fee -= fromGrave;
  const fromPack = Math.min(game.inventory.count('coins'), fee); if (fromPack) game.inventory.remove('coins', fromPack); fee -= fromPack;
  if (fee > 0) game.bank.withdraw('coins', fee);
  const what = graveSummary(g);
  giveBack(game, g);
  game.msg(`The gravedigger brings your belongings to you for ${total} coins: ${what}.`, 'level');
  return true;
}

function tickGrave(game) {
  const g = game.play.grave;
  if (!g) return;
  const p = game.player;
  if (p.alive && Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y)) <= 1) { claimGrave(game); return; }
  g.left--;
  if (g.left === Math.round(2 * MIN / TICK_MS)) game.msg('Your gravestone is starting to crumble: two minutes left to reach it.', 'system');
  if (g.left <= 0) {
    game.msg(`Your gravestone crumbles away, and with it ${graveSummary(g)}.`, 'system');
    game.play.grave = null;
    game.bus.emit('play');
  }
}
