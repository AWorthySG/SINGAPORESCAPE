// The compact battle bar at the top of the screen (index.html #boss-bar):
// a small portrait inset at its left end, name and level, life as short
// numbers ("999.9M · 99.9%"), the boss mechanic under way as a badge on the
// bar (a coloured shield, healers, the safe circle, a cast with its own thin
// bar), and a frame coloured by how dangerous the foe is for you.
//
// bossBarModel() is pure (tested headlessly); renderBossBar() writes it into
// the DOM and is called by ui.js updateBossBar once a tick while a foe is up.
import { MECH_STYLES } from '../data/bossMechanics.js';
import { mechLabel } from '../game/bossmech.js';
import { hudNumber } from '../core/utils.js';
import { TICK_MS } from '../config.js';
import { portraitFor } from '../render/sprites.js';
import { foeDetails } from '../render/worldlabels.js';

/** Life read-out: "999.9M · 99.9%" (short numbers; percent to one decimal,
 *  never "0.0%" while it is still alive, nor "100.0%" once it is hurt). */
export function lifeText(hp, max) {
  const h = Math.max(0, Math.ceil(hp));
  let pct = max > 0 ? (h / max) * 100 : 0;
  let s;
  if (h >= max) s = '100';
  else if (h <= 0) s = '0';
  else s = Math.min(99.9, Math.max(0.1, Math.floor(pct * 10) / 10)).toFixed(1);
  return `${hudNumber(h)} · ${s}%`;
}

/** How dangerous `n` is for you: 'easy' (green), 'even' (gold) or 'danger'
 *  (red). Bosses use auto battle's can-beat check (which learns from your
 *  wins and losses); everything else goes by level against your fight level. */
export function foeThreat(game, n) {
  const cl = game.fightLevel?.() || 1;
  const lvl = n.def?.level || 1;
  if (n.def?.boss && typeof game._autoCanBeat === 'function') {
    if (!game._autoCanBeat(n)) return 'danger';
    return lvl <= cl - 10 ? 'easy' : 'even';
  }
  if (typeof game._farAbove === 'function' ? game._farAbove(n) : lvl > cl + 10) return 'danger';
  if (n.champion) return lvl <= cl - 10 ? 'even' : 'danger';   // thirty times the life: never "easy"
  return lvl <= cl - 5 ? 'easy' : 'even';
}

/** The mechanic badge for the bar, or null when none is under way.
 *  { kind, icon, text, color, title, cast?: { start, dur } } */
export function mechBadge(game, boss) {
  const m = boss?.mech;
  if (!m) {
    if (game.hazards?.some((h) => h.npc === boss)) return { kind: 'hazard', icon: '⚠', text: 'Move!', color: null, title: 'Get out of the red!' };
    return null;
  }
  const left = Math.max(0, Math.ceil((m.until - game.tickCount) * TICK_MS / 1000));
  const title = mechLabel(game, boss);
  switch (m.type) {
    case 'shield': {
      const st = MECH_STYLES[m.style] || MECH_STYLES.melee;
      return { kind: 'shield', style: m.style, icon: '🛡', text: `${st.label} ${Math.max(0, Math.ceil(m.hp / m.max * 100))}%`, color: st.color, title };
    }
    case 'circle': return { kind: 'circle', icon: '◎', text: 'Safe spot!', color: null, title };
    case 'adds': {
      const k = (m.adds || []).filter((a) => a.alive && a.hp > 0).length;
      return { kind: 'adds', icon: '✚', text: `Healers ×${k}`, color: null, title };
    }
    case 'cast': return { kind: 'cast', icon: '⏳', text: `Interrupt! ${left}s`, color: null, title, cast: { start: m.start, dur: m.dur || m.until - m.since } };
    default: return null;
  }
}

/** Everything the bar shows for `boss`, as plain data. */
export function bossBarModel(game, boss) {
  const def = boss.def || {};
  return {
    kind: boss.champion ? 'champion' : def.boss ? 'boss' : 'normal',
    name: `${boss.champion ? '★ ' : ''}${boss.name}`,
    level: `Lv ${def.level || 1}`,
    life: lifeText(boss.hp, boss.maxHp),
    pct: Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)),
    threat: foeThreat(game, boss),
    mech: mechBadge(game, boss),
    enraged: !!boss.enraged,
  };
}

// ---- DOM ----

const THREATS = ['easy', 'even', 'danger'];
const KINDS = ['shield', 'circle', 'adds', 'cast', 'hazard'];

/** Build the bar's inner parts once (index.html holds the shell). */
function parts(ui) {
  if (ui._bb) return ui._bb;
  const bar = ui.el.bossBar;
  const q = (s) => bar.querySelector(s);
  const nameEl = ui.el.bossBarName;
  nameEl.innerHTML = '<b class="bb-name"></b><span class="bb-lvl"></span>';
  ui._bb = {
    portrait: q('#boss-bar-portrait'),
    name: nameEl.querySelector('.bb-name'),
    lvl: nameEl.querySelector('.bb-lvl'),
    mech: q('#boss-bar-mech'),
    life: q('#boss-bar-life'),
    cast: q('#boss-bar-cast'),
    info: q('#boss-bar-info'),
    threat: null, threatAt: -99, castFor: null, sig: '',
  };
  return ui._bb;
}

/** Draw `boss` into the bar. Cheap: text and classes change only when they
 *  do, the threat check runs every few ticks, the cast bar animates in CSS. */
export function renderBossBar(ui, boss) {
  const g = ui.game, bar = ui.el.bossBar;
  if (!bar || typeof document === 'undefined') return;
  const b = parts(ui);
  // Auto battle's can-beat check estimates the whole fight: every 5 ticks is plenty.
  if (b.threatFor !== boss || g.tickCount - b.threatAt >= 5) {
    b.threatFor = boss; b.threatAt = g.tickCount;
    b.threat = foeThreat(g, boss);
  }
  const m = bossBarModel(g, boss);
  m.threat = b.threat;
  bar.classList.toggle('champion', m.kind === 'champion');
  bar.classList.toggle('normal', m.kind === 'normal');
  for (const t of THREATS) bar.classList.toggle(`threat-${t}`, m.threat === t);
  bar.classList.toggle('enraged', m.enraged);
  bar.classList.toggle('warn', !!m.mech);
  if (b.name.textContent !== m.name) b.name.textContent = m.name;
  if (b.lvl.textContent !== m.level) b.lvl.textContent = m.level;
  if (b.life && b.life.textContent !== m.life) b.life.textContent = m.life;
  ui.el.bossBarFill.style.width = `${m.pct}%`;
  // Race, weakness, armour and wounds: a slim line (hidden on phones).
  if (b.info) {
    const info = boss.attackable ? foeDetails(g, boss) : '';
    if (b.info.textContent !== info) b.info.textContent = info;
  }
  // The mechanic badge.
  const mc = m.mech;
  if (b.mech) {
    b.mech.classList.toggle('hidden', !mc);
    for (const k of KINDS) b.mech.classList.toggle(`mk-${k}`, mc?.kind === k);
    if (mc) {
      const html = `<i>${mc.icon}</i>${mc.text}`;
      if (b.mech.innerHTML !== html) b.mech.innerHTML = html;
      b.mech.style.background = mc.color || '';
      if (b.mech.title !== mc.title) b.mech.title = mc.title;
    }
  }
  // A thin cast bar under the life bar while an interruptible cast winds up.
  if (b.cast) {
    const cast = mc?.kind === 'cast' ? boss.mech : null;
    b.cast.classList.toggle('on', !!cast);
    const fill = b.cast.firstElementChild;
    if (cast && fill) {
      const dur = mc.cast.dur || 3600;
      const done = Math.max(0, Math.min(1, (performance.now() - (mc.cast.start || performance.now())) / dur));
      if (b.castFor !== cast) {
        // One CSS animation for the whole cast (no per-frame work); reduce
        // motion just steps it once a tick.
        b.castFor = cast;
        if (g.reduceMotion) fill.style.animation = 'none';
        else {
          fill.style.setProperty('--bb-from', `${done * 100}%`);
          fill.style.animation = `bbCast ${Math.round(dur * (1 - done))}ms linear forwards`;
        }
      }
      if (g.reduceMotion) fill.style.width = `${done * 100}%`;
      else if (fill.style.width) fill.style.width = '';
    } else if (b.castFor) { b.castFor = null; if (fill) { fill.style.animation = 'none'; fill.style.width = '0'; } }
  }
  // The portrait: set once per foe (it only changes when the foe does).
  const pe = b.portrait;
  if (ui._bossPortraitFor !== boss) {
    ui._bossPortraitFor = boss;
    const pr = portraitFor(boss.npcId, boss.def);
    if (pe) {
      pe.classList.toggle('none', !pr);
      const img = pe.querySelector('.bp-img');
      img.style.backgroundImage = pr ? `url("${pr.src}")` : '';
      img.style.backgroundPosition = pr ? pr.pos : '';
      pe.querySelector('.bp-badge').textContent = boss.champion ? '★' : boss.def.boss ? '♛' : '';
    }
  }
  // A flash on the portrait when the foe takes a hit.
  if (pe && !g.reduceMotion && ui._bossPortraitHp !== undefined && boss.hp < ui._bossPortraitHp) {
    pe.classList.remove('hit'); void pe.offsetWidth; pe.classList.add('hit');
  }
  ui._bossPortraitHp = boss.hp;
}
