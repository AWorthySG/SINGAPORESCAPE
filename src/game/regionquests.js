// Region story quests (data in src/data/regionQuests.js): one short quest line
// per region, each run by its own quest giver. A line's state lives in
// game.quests[id] like every other quest ({ state, step, n }: the step it is on
// and the kills counted towards it), so saves carry it with no extra code.
//
// game.js calls in here from a handful of one-line hooks: the givers are placed
// when the world is built (placeRegionGivers), the journal asks regionGuide for
// each line's next step (questGuide, so "Go" and auto quest work as for any
// quest), dialogue options and auto quest send 'rq:...' actions (regionAction),
// kills report to onRegionKill, and finished lines' perks join outsideBonuses
// through regionPerks. The UI asks regionDialogue for a giver's conversation.
import { REGION_LINES, REGION_GIVERS } from '../data/regionQuests.js';
import { getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { NPC } from './npc.js';

export const LINE_BY_ID = Object.fromEntries(REGION_LINES.map((l) => [l.id, l]));
export const isRegionQuest = (id) => !!LINE_BY_ID[id];
const LINE_BY_GIVER = Object.fromEntries(REGION_LINES.map((l) => [l.giver, l]));

// A line's named foe is one of its kind made into a small boss: this much more
// life, harder hits and a bigger body. It never turns champion and never respawns.
export const FOE_HP_MULT = 6;
const FOE_HIT_MULT = 1.25, FOE_SCALE = 1.3;

/** Coins for finishing a line: grows with the fight level it asks for. */
export const lineCoins = (l) => Math.round(100 + 30 * l.level);

/** Fresh quest state for every line (spread into game.quests). */
export function regionQuestState() {
  return Object.fromEntries(REGION_LINES.map((l) => [l.id, { state: 'notStarted', step: 0, n: 0 }]));
}

/** Auto quest's start and hand-in actions: one action does whichever is due. */
export const REGION_AUTO_ACTIONS = Object.fromEntries(REGION_LINES.map((l) => [l.id, [`rq:auto:${l.id}`, `rq:auto:${l.id}`]]));

// ---------------- Placing the givers ----------------
/** Stand each giver on the free tile nearest its spot, inside its region. */
export function placeRegionGivers(game) {
  const w = game.world;
  const taken = new Set(game.npcs.map((n) => n.x * 4096 + n.y));
  game._rqGivers = {};
  for (const [id, g] of Object.entries(REGION_GIVERS)) {
    const region = LINE_BY_GIVER[id]?.region;
    let spot = null;
    for (let r = 0; r <= 10 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = g.at[0] + dx, y = g.at[1] + dy;
        if (!w.inBounds(x, y) || w.isBlocked(x, y) || w.objectAt(x, y) || taken.has(x * 4096 + y)) continue;
        if (region && w.zoneAt(x, y)?.name !== region) continue;
        spot = { x, y };
      }
    }
    if (!spot) continue;
    taken.add(spot.x * 4096 + spot.y);
    game._rqGivers[id] = game.spawnNpc(id, spot.x, spot.y, { wander: 0 });
  }
}

const giverNpc = (game, id) => game._rqGivers?.[id] || game.npcs.find((n) => n.npcId === id) || null;

/** After a new game or a load: put back the gathering spots of finished lines. */
export function syncRegionQuests(game) {
  for (const l of REGION_LINES) if (game.quests[l.id]?.state === 'done' && l.unlock.type === 'spot') addSpots(game, l);
}

// Gathering spots beside the giver: free tiles with nothing blocked or built
// around them, so a new rock or tree never walls off a path.
function addSpots(game, l) {
  const done = (game._rqSpots ||= new Set());
  if (done.has(l.id)) return;
  const giver = giverNpc(game, l.giver);
  if (!giver) return;
  done.add(l.id);
  const w = game.world, p = game.player;
  const cx = giver.spawnX ?? giver.x, cy = giver.spawnY ?? giver.y;
  const clear = (x, y) => w.inBounds(x, y) && !w.isBlocked(x, y) && !w.objectAt(x, y);
  const objs = [...l.unlock.objs];
  for (let r = 2; r <= 12 && objs.length; r++) {
    for (let dy = -r; dy <= r && objs.length; dy++) for (let dx = -r; dx <= r && objs.length; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (w.zoneAt(x, y)?.name !== l.region || (p && p.x === x && p.y === y)) continue;
      let ok = true;
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) ok = clear(x + i, y + j);
      if (ok) w.addObject(objs.shift(), x, y);
    }
  }
}

// ---------------- The named foe ----------------
/** The line's foe, spawned beside the nearest of its kind in the region if it isn't about. */
function ensureFoe(game, l, st) {
  const foes = (game._rqFoes ||= {});
  const f = foes[l.id];
  if (f && f.alive && game.npcs.includes(f)) return f;
  const giver = giverNpc(game, l.giver);
  const gx = giver ? giver.x : game.player.x, gy = giver ? giver.y : game.player.y;
  let base = null, bd = Infinity;
  for (const n of game.npcs) {
    if (n.npcId !== st.npc || n.rqFoe || n.temporary || game.world.zoneAt(n.spawnX, n.spawnY)?.name !== (st.where || l.region)) continue;
    const d = (n.spawnX - gx) ** 2 + (n.spawnY - gy) ** 2;
    if (d < bd) { bd = d; base = n; }
  }
  const at = base ? { x: base.spawnX, y: base.spawnY } : { x: gx + 2, y: gy };
  const tile = game._nearestFree(at.x + 1, at.y) || at;
  const n = new NPC(st.npc, tile.x, tile.y, 3, {});   // (spawn options keep it from rolling champion)
  const d = n.def;
  n.def = { ...d, name: st.name, maxHp: Math.round((d.maxHp || 1) * FOE_HP_MULT), maxHit: Math.max(2, Math.round((d.maxHit || 1) * FOE_HIT_MULT)),
    scale: (d.scale || 1) * FOE_SCALE, respawn: 1e9 };
  n.maxHp = n.hp = n.def.maxHp;
  n.rqFoe = l.id;
  game.npcs.push(n);
  foes[l.id] = n;
  return n;
}

// ---------------- Guide ("Go" and auto quest) ----------------
/** What a line needs next, in questGuide's shape. */
export function regionGuide(game, id) {
  const l = LINE_BY_ID[id], q = game.quests[id];
  if (!l || !q) return { text: '', kind: 'none' };
  const talk = (npcId, text) => ({ kind: 'npc', npcId, text });
  if (q.state === 'done') return { text: 'Complete', kind: 'none' };
  if (q.state !== 'active') {
    if (game.fightLevel() < l.level) return { text: `Reach fight level ${l.level} to start`, kind: 'none' };
    return talk(l.giver, `Start it with ${getNpc(l.giver).name}`);
  }
  const st = l.steps[q.step];
  if (!st) return talk(l.giver, `Talk to ${getNpc(l.giver).name}`);
  const inv = (item) => game.inventory.count(item);
  switch (st.kind) {
    case 'kill': return { kind: 'hunt', target: st.npc, text: `${st.text} (${Math.min(q.n || 0, st.qty)}/${st.qty})` };
    case 'foe': return { kind: 'hunt', target: st.npc, npc: ensureFoe(game, l, st), text: st.text };
    case 'talk': return talk(st.to || l.giver, st.text);
    case 'give': {
      const have = inv(st.item), left = st.qty - have;
      if (left <= 0) return talk(st.to || l.giver, `${st.text} (${st.qty}/${st.qty})`);
      for (const v of st.via) {
        if (v.need) {
          if (inv(v.need) < left) return { kind: 'obj', objId: v.obj, text: `${st.text}: get ${getItem(v.need).name.toLowerCase()} (${inv(v.need)}/${left})` };
          continue;
        }
        if (v.shop) return { kind: 'npc', npcId: v.shop, buy: { item: st.item, qty: st.qty }, text: `${st.text} (${have}/${st.qty})` };
        return { kind: 'obj', objId: v.obj, text: `${st.text} (${have}/${st.qty})` };
      }
      return talk(st.to || l.giver, st.text);
    }
  }
  return talk(l.giver, st.text);
}

// ---------------- Progress ----------------
function startLine(game, l) {
  const q = game.quests[l.id];
  if (q.state !== 'notStarted') return false;
  if (game.fightLevel() < l.level) { game.msg(`${getNpc(l.giver).name}: Come back when you're a little stronger (fight level ${l.level}).`, 'system'); return false; }
  Object.assign(q, { state: 'active', step: 0, n: 0 });
  game.msg(`Quest started — ${l.name}: ${l.steps[0].text}.`, 'level');
  game.banner?.(`<span class="big">Quest started!</span>${l.name}`);
  return true;
}

function advance(game, l) {
  const q = game.quests[l.id];
  q.step++;
  q.n = 0;
  const st = l.steps[q.step];
  if (!st) { completeLine(game, l); return; }
  game.msg(`${l.name}: ${st.text}.`, 'system');
  if (st.kind === 'foe') ensureFoe(game, l, st);
}

/** Do the talk or hand-in the line is waiting on. True if it moved on. */
function stepAtNpc(game, l) {
  const q = game.quests[l.id];
  const st = q.state === 'active' && l.steps[q.step];
  if (!st || (st.kind !== 'talk' && st.kind !== 'give')) return false;
  if (st.kind === 'give') {
    if (game.inventory.count(st.item) < st.qty) {
      game.msg(`${getNpc(st.to || l.giver).name}: I still need ${st.qty} ${getItem(st.item).name.toLowerCase()}.`, 'system');
      return false;
    }
    game.inventory.remove(st.item, st.qty);
  }
  game._rqSaid = st.say || '';
  if (st.say) game.msg(`${getNpc(st.to || l.giver).name}: ${st.say}`, 'system');
  advance(game, l);
  return true;
}

function completeLine(game, l) {
  const q = game.quests[l.id];
  q.state = 'done';
  const coins = lineCoins(l);
  game.inventory.add('coins', coins);
  if (l.unlock.type === 'spot') addSpots(game, l);
  game.msg(`Quest complete — ${l.name}! ${coins.toLocaleString()} coins. Unlocked: ${l.unlock.text}.`, 'level');
  game.banner?.(`<span class="big">Quest complete!</span>${l.name}`);
  if (game.player) game.spawnSparkle?.(game.player, '#ffd36b', 16);
  game.bus.emit('equipment');   // a perk shows in the gear totals
  game.checkAchievements?.();
}

/** A monster died to you: count it for any line hunting its kind, or its foe. */
export function onRegionKill(game, npc) {
  let changed = false;
  if (npc.rqFoe) {
    npc.temporary = true;          // gone for good (removed next tick), not respawned
    game.hasTemps = true;
    const l = LINE_BY_ID[npc.rqFoe], q = game.quests[npc.rqFoe];
    if (q?.state === 'active' && l.steps[q.step]?.kind === 'foe') {
      game.msg(`You have defeated ${npc.def.name}!`, 'level');
      advance(game, l);
      changed = true;
    }
  }
  for (const l of REGION_LINES) {
    const q = game.quests[l.id];
    if (q?.state !== 'active') continue;
    const st = l.steps[q.step];
    if (st?.kind !== 'kill' || npc.npcId !== st.npc) continue;
    q.n = (q.n || 0) + 1;
    changed = true;
    if (q.n >= st.qty) advance(game, l);
    else game.msg(`${l.name}: ${q.n}/${st.qty} ${npc.def.name.toLowerCase()} defeated.`, 'system');
  }
  if (changed) game.bus.emit('quest');
}

// ---------------- Unlocks ----------------
/** Finished lines' permanent bonuses, merged; the same object until one finishes. */
export function regionPerks(game) {
  let mask = 0;
  REGION_LINES.forEach((l, i) => { if (l.unlock.type === 'perk' && game.quests?.[l.id]?.state === 'done') mask += 2 ** i; });
  const c = game._rqPerks;
  if (c && c.mask === mask) return c.totals;
  const totals = {};
  REGION_LINES.forEach((l, i) => {
    if (!(Math.floor(mask / 2 ** i) % 2)) return;
    for (const [k, v] of Object.entries(l.unlock.bonus)) totals[k] = (totals[k] || 0) + v;
  });
  game._rqPerks = { mask, totals };
  return totals;
}

// Move the player beside a giver (teleports and ferries).
function hopTo(game, giverId, what) {
  const g = giverNpc(game, giverId);
  const p = game.player;
  if (!g || !p.alive) return false;
  if (game.npcs.some((n) => n.alive && n.target === p)) { game.msg(`You can't ${what} while something is attacking you.`, 'system'); return false; }
  const tile = game._nearestFree(g.x + 1, g.y);
  if (!tile) return false;
  p.stopNow(); p.clearAction();
  p.x = p.tx = tile.x; p.y = p.ty = tile.y; p.progress = 0; p.moving = false; p.path = [];
  game.spawnSparkle?.(p, '#ffd36b', 14);
  game.bus.emit('sfx', 'travel');
  game.updateRegion?.();
  game.ui?.closeModal?.();
  return true;
}

/** A finished line whose reward is a journal teleport. */
export const canRegionTeleport = (game, id) => LINE_BY_ID[id]?.unlock.type === 'teleport' && game.quests[id]?.state === 'done';

export function regionTeleport(game, id) {
  if (!canRegionTeleport(game, id)) return false;
  const l = LINE_BY_ID[id];
  const ok = hopTo(game, l.giver, 'teleport');
  if (ok) game.msg(`You teleport to ${getNpc(l.giver).name} in ${l.region}.`, 'system');
  return ok;
}

/** The dialogue options' and auto quest's actions: 'rq:<verb>:<line id>'. */
export function regionAction(game, action) {
  const [, verb, id] = action.split(':');
  const l = LINE_BY_ID[id];
  if (!l) return false;
  const q = game.quests[id];
  switch (verb) {
    case 'start': return startLine(game, l);
    case 'talk': return stepAtNpc(game, l);
    case 'auto': return q.state === 'notStarted' ? startLine(game, l) : stepAtNpc(game, l);
    case 'tp': return regionTeleport(game, id);
    case 'shop':
      if (q.state !== 'done' || l.unlock.type !== 'shop') return false;
      // After the dialogue box has closed (the option closes it as it runs).
      setTimeout(() => game.ui?.openShop?.(l.unlock.shop), 0);
      return true;
    case 'ferry': {
      if (q.state !== 'done' || l.unlock.type !== 'ferry') return false;
      const ok = hopTo(game, l.unlock.to, 'travel');
      if (ok) game.msg(`${getNpc(l.giver).name} takes you to ${LINE_BY_GIVER[l.unlock.to]?.region || 'your stop'}.`, 'system');
      return ok;
    }
  }
  return false;
}

// ---------------- Dialogue ----------------
/** A giver's conversation for the dialogue box: nodes are worked out each time
 *  they're shown, so they follow the quest as it moves on. */
export function regionDialogue(game, npc) {
  const id = npc.npcId, speaker = npc.name;
  const node = (text, options = []) => ({ speaker, text, options: [...options, { label: 'Goodbye.', next: 'end' }] });
  const build = () => {
    // A step from any line that is waiting on this person comes first.
    for (const l of REGION_LINES) {
      const q = game.quests[l.id];
      const st = q?.state === 'active' && l.steps[q.step];
      if (!st || (st.kind !== 'talk' && st.kind !== 'give') || (st.to || l.giver) !== id) continue;
      if (st.kind === 'talk') {
        const opening = l.giver === id ? 'Well? How did it go?' : (LINE_BY_GIVER[id]?.intro || 'Yes?');
        return node(opening, [{ label: st.reply, action: `rq:talk:${l.id}`, next: 'said' }]);
      }
      const what = getItem(st.item).name.toLowerCase();
      if (game.inventory.count(st.item) >= st.qty) return node('Did you bring them?', [{ label: `Here are ${st.qty} ${what}.`, action: `rq:talk:${l.id}`, next: 'said' }]);
      return node(`I still need ${st.qty} ${what}. ${regionGuide(game, l.id).text}.`);
    }
    const l = LINE_BY_GIVER[id];
    if (!l) return node('Hello there.');
    const q = game.quests[l.id];
    if (q.state === 'done') {
      const opts = [];
      if (l.unlock.type === 'shop') opts.push({ label: 'Let me see what you sell.', action: `rq:shop:${l.id}`, next: 'end' });
      if (l.unlock.type === 'ferry') opts.push({ label: `${l.unlock.label}.`, action: `rq:ferry:${l.id}`, next: 'end' });
      return node(l.thanks, opts);
    }
    if (q.state === 'active') return node(`How is it going? Next: ${regionGuide(game, l.id).text}.`);
    if (game.fightLevel() < l.level) return node(`${l.intro} Hmm, come back when you're a bit stronger (fight level ${l.level}).`);
    return node(l.intro, [{ label: 'Need a hand with anything?', next: 'offer' }]);
  };
  return {
    get start() { return build(); },
    get offer() {
      const l = LINE_BY_GIVER[id];
      return { speaker, text: l?.offer || '', options: [{ label: "I'll help.", action: `rq:start:${l?.id}`, next: 'start' }, { label: 'Maybe later.', next: 'end' }] };
    },
    get said() { return { speaker, text: game._rqSaid || 'Thank you.', options: [{ label: 'Okay.', next: 'start' }] }; },
  };
}
