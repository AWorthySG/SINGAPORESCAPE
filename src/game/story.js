// The main story, "The Shadow Rift" (chapters in src/data/story.js), its lore
// pages (lore.js), the small story events in the world and the chapter scenes
// (cutscene.js). Lives on game.story; saved through serialize/load.
//
// Chapters: one is open at a time, in order. A chapter is done when all its
// quests are (region quest lines and story quests, however they were finished),
// checked once a tick. Opening a chapter plays its intro (the speaker's scene,
// or a messenger's letter when they are far away); finishing it pays its reward
// (coins, an item, a title and a badge), gives its lore page, puts up a
// fanfare banner and plays its outro.
//
// Story events, driven by the region quest lines' progress:
//   ransack    a line begins: the giver's stall has been turned over (tidy it up)
//   raid       a line reaches its named foe: the foe's gang raids the giver's patch
//   messenger  a chapter opens far from its speaker: a runner brings the letter
// One runs at a time, each for a few minutes at most. Everything an event puts
// into the world is listed on it and taken back out when it ends, when you
// fall, and on load (events are never saved).
//
// Scenes: never while auto battle or auto quest is on (their lines go to the
// chat instead, so automation never stalls on a scene), never mid-fight (a
// scene in progress ends if something attacks you), and never in headless runs
// (tests switch them on). Reduce motion keeps the camera still.
import { CHAPTERS, CHAPTER_BY_ID, EVENT_LINES, RAID_TICKS, RANSACK_TICKS, MESSENGER_TICKS, RAIDERS } from '../data/story.js';
import { LORE_BY_ID, STORY_SET_REWARD } from '../data/lore.js';
import { REGION_LINES, REGION_GIVERS } from '../data/regionQuests.js';
import { QUESTS } from '../data/quests.js';
import { getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { NPC } from './npc.js';
import { Cutscene } from './cutscene.js';
import * as Lore from './lore.js';
import { findPath } from '../engine/pathfinding.js';
import { chebyshev } from '../core/utils.js';
import { TILE } from '../config.js';

const QUEST_NAME = Object.fromEntries(QUESTS.map((q) => [q.id, q.name]));
const LINE_BY_ID = Object.fromEntries(REGION_LINES.map((l) => [l.id, l]));
const SPEAKER_NEAR = 18;    // tiles: a speaker this close is panned to; further away, a messenger brings a letter
const MESSENGER_FROM = 9;   // tiles away a messenger starts running from

/** Who someone is, for a scene's bubble. */
export const speakerName = (who) => REGION_GIVERS[who]?.name || getNpc(who)?.name || 'Someone';

export class Story {
  constructor(game) {
    this.game = game;
    // Scenes and events start by themselves in the browser; headless runs
    // (tests) switch them on by hand, so a long test never meets a surprise.
    const live = typeof document !== 'undefined';
    this.scenesOn = live;
    this.eventsOn = live;
    this.ch = 0;                 // index of the open chapter (CHAPTERS.length when the story is done)
    this.done = new Set();       // finished chapter ids (saved)
    this.seen = new Set();       // scenes already played, 'ch1:intro' (saved)
    this.pages = new Set();      // lore page ids held (saved)
    this.guard = {};             // region -> 'ready' | 'done': lore guardians (saved)
    this.storyPaid = false;      // the story set's bonus (saved)
    this.scene = null;           // the Cutscene playing, or null
    this.queue = [];             // scenes waiting for a calm moment
    this.event = null;           // the story event under way, or null
    this._steps = null;          // each region line's last seen state:step (not saved)
    this._spots = [];            // hidden lore notes in the world
    this._guardians = {};        // region -> the guardian NPC, while it's about
    this._seed = (live ? Date.now() : 20261119) >>> 0;
    this._ready = false;         // set by sync(), once the game has started
    game.bus.on('tick', () => this.tick());
  }

  // ---------------- Odds and ends ----------------
  /** The story's own random numbers (mulberry32), so the game's rolls are untouched. */
  roll() {
    let t = (this._seed = (this._seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Make an NPC without touching Math.random (an NPC rolls its idle timers when made). */
  quietly(make) {
    const r = Math.random;
    Math.random = () => 0.5;
    try { return make(); } finally { Math.random = r; }
  }

  get chapter() { return CHAPTERS[this.ch] || null; }
  chapterDone(c) { return c.quests.every((id) => this.game.quests[id]?.state === 'done'); }
  /** Titles earned: one per finished chapter, and the story set's. */
  titles() {
    const t = CHAPTERS.filter((c) => this.done.has(c.id)).map((c) => c.reward.title);
    if (this.storyPaid) t.push(STORY_SET_REWARD.title);
    return t;
  }

  /** A chapter's quests and where each stands. */
  progress(c) {
    const quests = c.quests.map((id) => ({ id, name: QUEST_NAME[id] || id, state: this.game.quests[id]?.state || 'notStarted', region: LINE_BY_ID[id]?.region || null }));
    return { quests, have: quests.filter((q) => q.state === 'done').length, need: quests.length };
  }

  /** What to do next for the open chapter: its first unfinished quest you can
   *  work on (active ones first), with the journal's guide for it. */
  nextStep() {
    const c = this.chapter;
    if (!c) return null;
    const left = this.progress(c).quests.filter((q) => q.state !== 'done');
    const pick = left.find((q) => q.state === 'active') || left.find((q) => this.game.questGuide(q.id).kind !== 'none') || left[0];
    if (!pick) return null;
    const guide = this.game.questGuide(pick.id);
    return { quest: pick.id, name: pick.name, text: guide.text || '', canGo: guide.kind !== 'none' };
  }

  // ---------------- Saving ----------------
  serialize() {
    return { done: [...this.done], seen: [...this.seen], pages: [...this.pages], guard: { ...this.guard }, storyPaid: this.storyPaid };
  }

  load(d) {
    const arr = (a, ok) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && ok(x)) : []);
    if (!d || typeof d !== 'object') return;
    this.done = new Set(arr(d.done, (id) => CHAPTER_BY_ID[id]));
    this.seen = new Set(arr(d.seen, () => true));
    this.pages = new Set(arr(d.pages, (id) => LORE_BY_ID[id]));
    this.guard = {};
    if (d.guard && typeof d.guard === 'object') for (const [r, v] of Object.entries(d.guard)) if (v === 'ready' || v === 'done') this.guard[r] = v;
    this.storyPaid = d.storyPaid === true;
  }

  /** After a new game or a load: clear any event, put out the hidden notes,
   *  catch the story up with quests finished before it existed (quietly), wake
   *  waiting guardians and start watching the quest lines. */
  sync() {
    this.endEvent('load');
    this.scene = null; this.queue = [];
    for (const n of Object.values(this._guardians)) this.game.npcs = this.game.npcs.filter((x) => x !== n);
    this._guardians = {};
    this.ch = CHAPTERS.findIndex((c) => !this.done.has(c.id));
    if (this.ch < 0) this.ch = CHAPTERS.length;
    const before = this.ch;
    this._checkChapters(true);
    if (this.ch > before) this.game.msg(`Story caught up: ${this.ch - before} chapter${this.ch - before > 1 ? 's' : ''} of ${CHAPTERS.length} already done, rewards added. See the Journal's Story tab.`, 'level');
    Lore.placeSpots(this);
    Lore.checkSets(this, true);
    for (const [r, v] of Object.entries(this.guard)) if (v === 'ready') Lore.spawnGuardian(this, r);
    this._steps = this._lineSnap();
    this._ready = true;
    this.game.bus.emit('story');
  }

  // ---------------- The tick ----------------
  tick() {
    const g = this.game;
    if (!this._ready || g.pendingStyleChoice || g.pendingClassChoice) return;   // not while the class picker is up
    this._watchLines();
    this._checkChapters(false);
    this._tickEvent();
    this._tickScene();
    if (this.eventsOn && g.tickCount % 3 === 0) this._glints();
  }

  /** Close every chapter whose quests are all done, in order, and open the next. */
  _checkChapters(silent) {
    let moved = false;
    while (this.ch < CHAPTERS.length) {
      const c = CHAPTERS[this.ch];
      if (!this.chapterDone(c)) {
        if (!silent && !this.seen.has(`${c.id}:intro`) && !this._introPending(c)) this._deliverIntro(c);
        break;
      }
      this._complete(c, silent);
      this.ch++;
      moved = true;
    }
    if (moved) { this.game.saveSoon = true; this.game.bus.emit('story'); }
  }

  _complete(c, silent) {
    const g = this.game, r = c.reward;
    this.done.add(c.id);
    if (r.coins) g.inventory.add('coins', r.coins);
    if (r.item) g.inventory.add(r.item[0], r.item[1]);
    const n = CHAPTERS.indexOf(c) + 1;
    const what = [r.coins ? `${r.coins.toLocaleString('en-GB')} coins` : '', r.item ? `${r.item[1]} ${getItem(r.item[0]).name}` : '', `the title “${r.title}”`, `the ${r.badge} badge`].filter(Boolean).join(', ');
    if (!silent) {
      g.msg(`Chapter ${n} complete — ${c.title}! Reward: ${what}.`, 'level');
      g.banner?.(`<span class="big">${r.badge} Chapter ${n} complete!</span>${c.title}`);
      g.bus.emit('sfx', 'achievement');
      const at = g.player?.renderCenter?.();
      if (at) g.spawnConfetti?.(at.x, at.y - 18, 30);
      this.queueScene(c, 'outro');
    }
    Lore.collect(this, `story_${c.id}`, 'chapter', silent);
  }

  // ---------------- Scenes ----------------
  _introPending(c) {
    const id = `${c.id}:intro`;
    return this.queue.some((s) => s.id === id) || this.scene?.id === id || (this.event?.kind === 'messenger' && this.event.ch === c.id);
  }

  /** A chapter opens: its speaker tells you in person if they're near, else a messenger runs up with a letter. */
  _deliverIntro(c) {
    const who = c.intro[0]?.who;
    if (this.eventsOn && this.scenesOn && !this.speakerNpc(who) && !this.autoOn() && this.startEvent('messenger', { ch: c.id, from: who })) return;
    this.queueScene(c, 'intro');
  }

  autoOn() { return !!(this.game.autoBattle || this.game.autoQuest); }

  /** The nearest NPC with this id within SPEAKER_NEAR tiles of you. */
  speakerNpc(who) {
    const p = this.game.player;
    let best = null, bd = Infinity;
    for (const n of this.game.npcs) {
      if (n.npcId !== who || !n.alive) continue;
      const d = chebyshev(n.x, n.y, p.x, p.y);
      if (d <= SPEAKER_NEAR && d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** Queue a chapter's intro or outro; told in the chat at once while
   *  automation runs or scenes are off. */
  queueScene(c, part, opts = {}) {
    const id = `${c.id}:${part}`;
    const lines = (c[part] || []).map((l) => ({ who: l.who, name: speakerName(l.who), text: l.text }));
    const item = { id, lines, title: `Chapter ${CHAPTERS.indexOf(c) + 1} · ${c.title}`, kind: part, letter: !!opts.letter };
    if (!this.scenesOn || this.autoOn()) { this._narrate(item); return null; }
    this.queue.push(item);
    return item;
  }

  _narrate(item) {
    const g = this.game;
    this.seen.add(item.id);
    if (item.letter) g.msg(`A letter from ${item.lines[0]?.name || 'a friend'}:`, 'system');
    for (const l of item.lines) g.msg(`${l.name}: ${l.text}`, 'system');
    g.bus.emit('story');
  }

  /** Something has its eye on you (or you on it): not the time for a scene. */
  _busy() {
    const g = this.game, p = g.player;
    if (!p.alive || g.waves?.active) return true;
    if (p.target?.alive) return true;
    return g.npcs.some((n) => n.alive && n.target === p);
  }

  _tickScene() {
    const g = this.game;
    if (this.scene) {
      if (this._busy()) { this.scene.skip(); g.bus.emit('storyscene'); }
      return;
    }
    if (!this.queue.length) return;
    if (this.autoOn() || !this.scenesOn) { while (this.queue.length) this._narrate(this.queue.shift()); return; }
    const modal = g.ui?.modal;
    if (this._busy() || (modal && typeof modal === 'object')) return;
    this.playScene(this.queue.shift());
  }

  /** Start a scene now (the Story tab's Replay buttons call this too). */
  playScene(item) {
    const g = this.game;
    this.scene = new Cutscene(item.lines, { reduce: !!g.reduceMotion, kind: item.kind, title: item.title, id: item.id });
    this.scene.letter = item.letter;
    this._focusNpc = null; this._focusFor = -1;
    this.seen.add(item.id);
    g.saveSoon = true;
    g.bus.emit('storyscene');
    return this.scene;
  }

  /** Replay a seen chapter scene from the Story tab. */
  replay(chId, part) {
    const c = CHAPTER_BY_ID[chId];
    if (!c || !this.seen.has(`${chId}:${part}`) || this.scene) return null;
    return this.playScene({ id: `${chId}:${part}`, lines: c[part].map((l) => ({ who: l.who, name: speakerName(l.who), text: l.text })),
      title: `Chapter ${CHAPTERS.indexOf(c) + 1} · ${c.title}`, kind: part });
  }

  sceneNext() { if (this.scene?.next()) this.game.bus.emit('storyscene'); }
  sceneSkip() { if (this.scene?.skip()) this.game.bus.emit('storyscene'); }

  /** Per frame (game.update): run the scene's clock and lean the camera toward
   *  the speaker, halfway, so you stay in shot. Returns the point to follow. */
  camera(base, dt) {
    const s = this.scene;
    if (!s) return base;
    if (s.update(dt)) this.game.bus.emit('storyscene');
    if (s.done) { this.scene = null; this.game.bus.emit('storyscene'); return base; }
    const pan = s.pan;
    if (pan <= 0) return base;
    const line = s.line || s.lines[Math.min(s.i, s.lines.length - 1)];
    if (this._focusFor !== s.i) { this._focusFor = s.i; this._focusNpc = s.letter ? null : this.speakerNpc(line?.who); }
    const n = this._focusNpc;
    if (!n) return base;
    const b = n.renderCenter();
    return { x: base.x + (b.x - base.x) * 0.5 * pan, y: base.y + (b.y - base.y) * 0.5 * pan };
  }

  // ---------------- Story events ----------------
  /** Each region line's 'state:step', to notice when one starts or reaches its foe. */
  _lineSnap() {
    return Object.fromEntries(REGION_LINES.map((l) => { const q = this.game.quests[l.id]; return [l.id, `${q?.state}:${q?.step}`]; }));
  }

  _watchLines() {
    const snap = this._steps || (this._steps = this._lineSnap());
    for (const l of REGION_LINES) {
      const q = this.game.quests[l.id];
      const key = `${q?.state}:${q?.step}`, prev = snap[l.id];
      if (prev === key) continue;
      snap[l.id] = key;
      if (!this.eventsOn || q?.state !== 'active') continue;
      if (l.steps[q.step]?.kind === 'foe') this.startEvent('raid', { line: l.id });
      else if (prev?.startsWith('notStarted')) this.startEvent('ransack', { line: l.id });
    }
  }

  /** A free tile r0..r1 tiles from (x, y) in `region` (if given), picked by the story's own dice. */
  _freeNear(x, y, r0, r1, region = null) {
    const w = this.game.world, p = this.game.player;
    for (let i = 0; i < 80; i++) {
      const r = r0 + Math.floor(this.roll() * (r1 - r0 + 1)), a = this.roll() * Math.PI * 2;
      const tx = Math.round(x + Math.cos(a) * r), ty = Math.round(y + Math.sin(a) * r);
      if (!w.inBounds(tx, ty) || w.isBlocked(tx, ty) || w.objectAt(tx, ty) || (tx === p.x && ty === p.y)) continue;
      if (region && w.zoneAt(tx, ty)?.name !== region) continue;
      if (this.game.npcs.some((n) => n.alive && n.x === tx && n.y === ty)) continue;
      return { x: tx, y: ty };
    }
    return null;
  }

  _giver(lineId) {
    const l = LINE_BY_ID[lineId];
    return l && (this.game._rqGivers?.[l.giver] || this.game.npcs.find((n) => n.npcId === l.giver)) || null;
  }

  /** Start a story event; null if one is already running or it couldn't be placed. */
  startEvent(kind, opts = {}) {
    const g = this.game;
    if (this.event || !g.player.alive || g.waves?.active) return null;
    const ev = { kind, mobs: [], objs: [], npc: null, endTick: g.tickCount, ...opts };
    const ok = kind === 'ransack' ? this._setupRansack(ev) : kind === 'raid' ? this._setupRaid(ev) : kind === 'messenger' ? this._setupMessenger(ev) : false;
    if (!ok) { this._cleanup(ev); return null; }
    this.event = ev;
    g.bus.emit('story');
    return ev;
  }

  _setupRansack(ev) {
    const g = this.game, giver = this._giver(ev.line), l = LINE_BY_ID[ev.line];
    if (!giver) return false;
    const t = this._freeNear(giver.x, giver.y, 1, 2, l.region);
    if (!t) return false;
    const base = g.world.objects.find((o) => o.objId === 'sign')?.def || {};
    const def = { ...base, name: 'Ransacked stall', type: 'storyobj', verb: 'Tidy up', blocking: false, art: 'obj-ransacked_stall',
      examine: `${speakerName(l.giver)}'s stall, turned over and trampled.` };
    ev.objs.push(g.world.addObject('sign', t.x, t.y, { def, storyKind: 'ransack' }));
    ev.endTick = g.tickCount + RANSACK_TICKS;
    giver.chatText = EVENT_LINES.ransack; giver.chatTimer = 5;
    g.msg(`${speakerName(l.giver)}: ${EVENT_LINES.ransack}`, 'system');
    return true;
  }

  _setupRaid(ev) {
    const g = this.game, giver = this._giver(ev.line), l = LINE_BY_ID[ev.line];
    const st = l?.steps.find((s) => s.kind === 'foe');
    if (!giver || !st) return false;
    const kind = getNpc(st.npc).name.toLowerCase();
    for (let i = 0; i < RAIDERS; i++) {
      const t = this._freeNear(giver.x, giver.y, 3, 6);
      if (!t) break;
      const n = this.quietly(() => new NPC(st.npc, t.x, t.y, 0, { aggressive: true, ignoreLevelGate: true }));
      n.def = { ...n.def, name: `Raiding ${kind}`, respawn: 1e9 };
      n.temporary = true;
      n.storyEvent = true;
      n.spawnX = giver.x; n.spawnY = giver.y; n.wander = 4;
      n.spawnT = 350;   // fades in
      g.npcs.push(n);
      g.hasTemps = true;
      ev.mobs.push(n);
      g.spawnPoof?.(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, '#b9473c');
    }
    if (!ev.mobs.length) return false;
    Object.assign(ev, { foe: st.name, region: l.region, endTick: g.tickCount + RAID_TICKS });
    giver.chatText = EVENT_LINES.raidCry; giver.chatTimer = 5;
    g.msg(EVENT_LINES.raidStart(st.name, l.region), 'combat');
    g.banner?.(`<span class="big">⚔️ Raid!</span>${EVENT_LINES.raidStart(st.name, l.region)}`, 'storyevent');
    return true;
  }

  _setupMessenger(ev) {
    const g = this.game, p = g.player;
    const t = this._freeNear(p.x, p.y, MESSENGER_FROM - 2, MESSENGER_FROM);
    if (!t) return false;
    const n = this.quietly(() => new NPC('villager', t.x, t.y, 0));
    n.def = { ...n.def, name: 'Messenger', dialogue: 'story', chatter: null, wander: 0, attackable: false,
      examine: `A runner with a letter for you, from ${speakerName(ev.from)}.` };
    n.wander = 0;
    n.temporary = true;
    n.storyEvent = true;
    n.stepMul = 0.9;   // runs
    n.spawnT = 350;
    n.chatText = EVENT_LINES.messenger(speakerName(ev.from)); n.chatTimer = 4;
    g.npcs.push(n);
    Object.assign(ev, { npc: n, endTick: g.tickCount + MESSENGER_TICKS, at: 0 });
    ev.mobs.push(n);
    return true;
  }

  _tickEvent() {
    const g = this.game, ev = this.event;
    if (!ev) return;
    if (ev.kind === 'raid') {
      if (ev.mobs.every((n) => !n.alive)) {
        const l = LINE_BY_ID[ev.line], coins = Math.round(40 + 8 * (l?.level || 1));
        g.inventory.add('coins', coins);
        const giver = this._giver(ev.line);
        if (giver) { giver.chatText = EVENT_LINES.raidWon; giver.chatTimer = 5; }
        g.msg(`${speakerName(l.giver)}: ${EVENT_LINES.raidWon} (+${coins.toLocaleString('en-GB')} coins)`, 'level');
        return this.endEvent('won');
      }
      if (g.tickCount >= ev.endTick) { g.msg(EVENT_LINES.raidGone, 'system'); return this.endEvent('time'); }
      return;
    }
    if (ev.kind === 'ransack') {
      const q = g.quests[ev.line];
      if (g.tickCount >= ev.endTick || q?.state !== 'active') return this.endEvent('time');   // someone else tidied it up
      return;
    }
    if (ev.kind === 'messenger') {
      const n = ev.npc, p = g.player;
      if (ev.leaving) { if (--ev.leaving <= 0) this.endEvent('done'); return; }
      if (!n || !g.npcs.includes(n)) return this.endEvent('gone');
      if (chebyshev(n.x, n.y, p.x, p.y) <= 1 || g.tickCount >= ev.endTick) { this.deliverLetter(); return; }
      if (!n.isMoving && g.tickCount % 2 === 0) {
        const path = findPath(g.pathCfg(), { x: n.x, y: n.y }, { x: p.x, y: p.y }, { reachAdjacent: true, maxNodes: 3000 });
        if (path.length) n.setPath(path.slice(0, 6));
      }
    }
  }

  /** The messenger reaches you (or you talk to them): the chapter's intro, as a letter. */
  deliverLetter() {
    const ev = this.event;
    if (ev?.kind !== 'messenger' || ev.leaving) return false;
    const c = CHAPTER_BY_ID[ev.ch];
    ev.leaving = 3;
    if (ev.npc) { ev.npc.stop?.(); ev.npc.chatText = 'Here you go! Bye!'; ev.npc.chatTimer = 3; }
    if (c && !this.seen.has(`${c.id}:intro`)) this.queueScene(c, 'intro', { letter: true });
    return true;
  }

  /** The UI's hook for an NPC whose dialogue is 'story' (the messenger). */
  talkTo(npc) {
    if (this.event?.npc === npc) return this.deliverLetter();
    return false;
  }

  /** A story object was used (Interact): a hidden lore note, or a ransacked stall. */
  useObject(obj) {
    const g = this.game;
    if (obj?.loreId) return Lore.readSpot(this, obj);
    if (obj?.storyKind === 'ransack' && this.event?.objs.includes(obj)) {
      const l = LINE_BY_ID[this.event.line], coins = Math.round(20 + 4 * (l?.level || 1));
      g.inventory.add('coins', coins);
      const giver = this._giver(this.event.line);
      if (giver) { giver.chatText = EVENT_LINES.tidied; giver.chatTimer = 4; }
      g.msg(`You set the stall back up. ${speakerName(l.giver)}: ${EVENT_LINES.tidied} (+${coins.toLocaleString('en-GB')} coins)`, 'level');
      g.spawnSparkle?.({ x: obj.x * TILE + TILE / 2, y: obj.y * TILE + TILE / 2 }, '#ffd36b', 12);
      this.endEvent('tidied');
      return true;
    }
    return false;
  }

  /** End the running event and take everything it placed back out. */
  endEvent(why = '') {
    const ev = this.event;
    if (!ev) return false;
    this.event = null;
    this._cleanup(ev);
    this.game.ui?.hideBanner?.('storyevent');
    // A messenger that never reached you: the letter arrives all the same.
    const c = ev.kind === 'messenger' && !ev.leaving && why !== 'load' && CHAPTER_BY_ID[ev.ch];
    if (c && !this.seen.has(`${c.id}:intro`)) this.queueScene(c, 'intro', { letter: true });
    this.game.bus.emit('story');
    return true;
  }

  _cleanup(ev) {
    const g = this.game, p = g.player;
    const gone = new Set(ev.mobs);
    if (ev.npc) gone.add(ev.npc);
    if (gone.size) {
      g.npcs = g.npcs.filter((n) => !gone.has(n));
      if (gone.has(p.target)) p.target = null;
      if (p.action?.npc && gone.has(p.action.npc)) p.clearAction();
    }
    for (const o of ev.objs) {
      g.world.removeObject(o);
      if (p.action?.obj === o) p.clearAction();
    }
    ev.mobs = []; ev.objs = []; ev.npc = null;
  }

  // ---------------- Hooks from the game ----------------
  /** A monster died to you. */
  onKill(npc) {
    if (npc.loreGuard) return Lore.onGuardianKill(this, npc);
    return Lore.onKill(this, npc);
  }

  /** You fell: a scene ends and a story event is packed away. */
  onDeath() {
    if (this.scene) { this.scene.skip(); this.game.bus.emit('storyscene'); }
    this.endEvent('death');
  }

  /** A hidden note glints now and then while you're near it (cosmetic). */
  _glints() {
    const p = this.game.player;
    for (const o of this._spots) {
      if (Math.abs(o.x - p.x) > 14 || Math.abs(o.y - p.y) > 12) continue;
      this.game.spawnSparkle?.({ x: o.x * TILE + TILE / 2, y: o.y * TILE + 6 }, '#ffe27a', 2);
    }
  }
}
