import { islandPhotoArt, ISLAND_BY_ID, LANDINGS, LOOMS, PATTERNS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../data/islandlife.js';
import { getItem } from '../data/items.js';
import { atIslandSite, COVE_FIND, encoreNotes, exploreCove, finishIslandTune, finishVoyage, islandBook, islandClaimed, islandPayout, islandReady, islandSiteTile, learnIslandTune, makeIslandPattern, musicStage, textileWorkshop, voyageAvailable } from '../game/islandlife.js';
import { nextUnlock, skillTeleport, skillTeleportOf } from '../game/skillunlocks.js';
import { lifePerkNext, lifePerkText } from '../game/lifeperks.js';
import { skillIconSVG } from '../render/icons.js';

const SIDES = ['Port · left', 'Starboard · right'];
const NOTES = ['Low', 'Middle', 'High'];
const button = (label, key, disabled = false) => `<button type="button" class="wm-go" data-island="${key}"${disabled ? ' disabled' : ''}>${label}</button>`;
const row = (title, hint, actions = '') => `<section class="island-row"><div><b>${title}</b><small>${hint}</small></div><div class="island-actions">${actions}</div></section>`;
const swatch = (p, printed) => `<img class="island-swatch${printed ? ' just-printed' : ''}" src="assets/icons/scarf-${p.art || p.id}.webp" style="filter:hue-rotate(${p.hue || 0}deg)" alt="">`;

function voyageTrack(values, count) {
  const offset = (side) => side == null ? 0 : side ? 8 : -8;
  const leg = values.length;
  const position = (step) => (step + 0.5) / (count + 1) * 100;
  const buoys = Array.from({ length: count }, (_, i) => `<i style="left:${position(i + 1)}%"></i>`).join('');
  return `<div class="island-voyage" aria-hidden="true">${buoys}<div class="island-boat${leg ? ' steering' : ''}"
    style="--from:${position(Math.max(0, leg - 1))}%;--to:${position(leg)}%;--from-side:${offset(values[leg - 2])}px;--to-side:${offset(values[leg - 1])}px">
    <img alt="" src="assets/world/obj-sampan.webp"></div></div>`;
}

export function islandAlbumHTML(game) {
  const book = islandBook(game);
  return PHOTO_ASSIGNMENTS.filter((p) => book.photos.includes(p.id)).map((p) =>
    `<figure class="island-print"><img src="${islandPhotoArt(p)}" alt=""><figcaption>${p.name}</figcaption>${button(book.display === p.id ? 'On display' : 'Display', 'display:' + p.id, book.display === p.id)}</figure>`).join('');
}

export function displayIslandPrint(game, id) {
  const book = islandBook(game);
  if (!game.home?.owned || !book.photos.includes(id)) return false;
  book.display = id;
  game.saveSoon = true;
  return true;
}

export function openIslandSkill(ui, skill) {
  const game = ui.game, info = ISLAND_BY_ID[skill];
  if (!info) return false;
  const book = islandBook(game);
  let attempt = null, message = '', printed = null;
  const sites = new Map();
  const go = (site) => {
    const key = `go:${site.x},${site.y}`;
    sites.set(key, islandSiteTile(game.world, site));
    return button('Go', key);
  };
  const page = () => {
    const lvl = game.skills.level(skill), ready = islandReady(game);
    if (skill === 'sailing') {
      return VOYAGES.map((v) => {
        const known = book.voyages.includes(v.id), claimed = islandClaimed(game, 'freight:' + v.id);
        const prereq = VOYAGES.find((r) => r.id === (v.requires || (v.to === 'cove' ? 'ubin' : '')));
        const hint = known ? 'Charted' : prereq && !book.voyages.includes(prereq.id)
          ? 'Chart ' + LANDINGS[prereq.to].name + ' first' : 'Uncharted';
        const freight = v.freight && known ? ` · ${claimed ? 'Freight delivered today' : islandPayout(game, skill, v.freight) + ' coins for freight'}` : '';
        const disabled = !voyageAvailable(game, v);
        const actions = atIslandSite(game, LANDINGS[v.from])
          ? button('Set sail', 'voyage:' + v.id, disabled) + (v.freight && known ? button('Carry freight', 'freight:' + v.id, disabled || claimed) : '')
          : go(LANDINGS[v.from]);
        return row(LANDINGS[v.from].name + ' → ' + LANDINGS[v.to].name, `Level ${v.level} · ${hint}${freight}`, actions);
      }).join('')
        + (book.voyages.includes('cove') && atIslandSite(game, LANDINGS.cove) ? COVE_FIND.map((f) =>
          row(f.name, book.cove.includes(f.id) ? 'Recorded' : getItem(f.item).name, button('Explore', 'cove:' + f.id, !ready || book.cove.includes(f.id)))).join('') : '');
    }
    if (skill === 'photography') {
      return '<p>Collect a print on your first visit. Return on another day for a paid postcard commission.</p>' +
        PHOTO_ASSIGNMENTS.map((p) => {
          const collected = book.photos.includes(p.id), done = islandClaimed(game, 'photo:' + p.id);
          const hint = collected ? (done ? 'Print collected · Submitted today' : 'Print collected · ' + islandPayout(game, skill, Math.round(p.xp * 1.5)) + ' coins for a new postcard') : 'Level ' + p.level;
          return row(`<img class="island-assignment-art" src="${islandPhotoArt(p)}" alt="">` + p.name, hint + ' · ' + p.detail,
            done ? '' : atIslandSite(game, p, p.range)
              ? button('Open camera', 'camera:', lvl < p.level || !game.photoCamera) : go(p));
        }).join('');
    }
    if (skill === 'textile_arts') {
      const workshop = textileWorkshop(game);
      return LOOMS.map((site) => row(site.name, site.level === 1 ? 'Bring a farmed dye and 8 coins for cotton.' : 'Level 8 · Fill paid orders for patterns you know.',
        atIslandSite(game, site) ? '' : go(site))).join('') +
        PATTERNS.map((p) => {
          const known = book.patterns.includes(p.id), made = islandClaimed(game, 'order:' + p.id);
          const dye = game.inventory.count(p.dye), coins = game.inventory.count('coins');
          const actions = (workshop ? button('Print scarf', 'print:' + p.id, !ready || lvl < p.level || dye < 1 || coins < 8) : '')
            + (workshop?.level >= 8 && known ? button(made ? 'Order filled today' : 'Fill order', 'order:' + p.id, made || !ready || lvl < p.level || dye < 2 || coins < 16) : '')
            + (known ? button(book.scarf === p.id ? 'Remove' : 'Wear', 'wear:' + p.id) : '');
          const offer = known && !made ? ` · Order: 2 dye + 16 coins for ${islandPayout(game, skill, Math.round(p.xp * 1.5))} coins` : '';
          const reward = p.reward ? ` · Order reward: ${getItem(p.reward).name}` : '';
          return row(swatch(p, printed === p.id) + p.name, `Level ${p.level} · ${getItem(p.dye).name}${offer}${reward}`, actions);
        }).join('');
    }
    const stage = musicStage(game);
    return STAGES.map((s) => row(s.name, `Stage access at Music level ${s.level}`, atIslandSite(game, s) ? '' : go(s))).join('')
      + TUNES.map((t) => {
        const known = book.tunes.includes(t.id), done = islandClaimed(game, 'encore:' + t.id);
        const teacher = STAGES.find((s) => s.id === t.stage);
        const actions = known ? button('Perform', 'tune:' + t.id, !ready || !stage)
          + (stage?.level >= 3 && book.performed.includes(t.id)
            ? button(done ? 'Encore played today' : 'Play encore', 'encore:' + t.id, !ready || done) : '')
          : button('Learn', 'learn:' + t.id, !ready || !stage || lvl < t.level || (teacher && stage.id !== teacher.id));
        return row(t.name, `Level ${t.level} · ${t.notes.length} notes · ${islandPayout(game, skill, t.tip)} coins${teacher ? ' · Learn at ' + teacher.name : ''}`, actions);
      }).join('');
  };
  const challenge = () => {
    const { entry, values, start, music } = attempt;
    const names = music ? NOTES : SIDES, sequence = attempt.sequence;
    const preview = !music || start === null;
    return `<div class="island-challenge"><h3>${music ? entry.name + (attempt.encore ? ' · Encore' : '') : (attempt.freight ? 'Freight to ' : 'Chart to ') + LANDINGS[entry.to].name}</h3>
      <p>${music ? (preview ? 'Read the tune, then play it from memory. Leave a short beat between notes.' : 'Play the tune from memory.') : 'Pass each buoy on the side marked on your chart.'}</p>
      ${music ? '' : voyageTrack(values, sequence.length)}
      <div class="island-chart">${preview ? sequence.map((n, i) => `<span${i === values.length ? ' class="current"' : i < values.length ? ' class="passed"' : ''}>${names[n]}</span>`).join('')
        : `${values.length} / ${sequence.length} notes${attempt.note == null ? '' : `<span class="island-note" aria-hidden="true" style="--pitch:${(1 - attempt.note) * 4}px">♪</span>`}`}</div>
      <div class="island-actions">${music && preview ? button('Start playing', 'start:') : names.map((n, i) => button(n, 'answer:' + i)).join('')}${button('Back', 'back:')}</div></div>`;
  };
  const render = (body) => {
    const level = game.skills.level(skill), next = lifePerkNext(skill, level);
    const milestone = nextUnlock(skill, level);
    const unlocked = skillTeleportOf(game, skill);
    const progress = milestone || unlocked ? row('Skill milestones',
      milestone ? `Level ${milestone.level} · ${milestone.desc}` : 'All milestones earned',
      unlocked ? button('Skill teleport', 'teleport:', !islandReady(game)) : '') : '';
    body.innerHTML = `<div class="island-panel" style="--island-accent:${info.color}"><header>${skillIconSVG(skill, 32)}<div><b>${info.name} · Level ${game.skills.level(skill)}</b><small>${info.desc}</small><small>Combat · ${lifePerkText(skill, level)}${next ? ' · Level ' + next.level + ': ' + next.text : ''}</small></div></header>
      <div class="island-status" role="status">${message}</div>${attempt ? challenge() : progress + page()}</div>`;
    for (const b of body.querySelectorAll('[data-island]')) {
      b.addEventListener('click', () => {
        const key = b.dataset.island, [act, id] = key.split(':');
        message = '';
        printed = null;
        if (act === 'go') {
          if (game.travelToTile(sites.get(key))) ui.closeModal();
          else { message = 'There is no safe route from here.'; render(body); }
          return;
        }
        if (act === 'teleport') {
          if (!islandReady(game) || !skillTeleport(game, skill)) { message = 'Skill teleport is unavailable right now.'; render(body); }
          return;
        }
        if (act === 'camera') { ui.closeModal(); game.photoCamera?.open(); return; }
        if (act === 'voyage' || act === 'freight') {
          const entry = VOYAGES.find((v) => v.id === id);
          attempt = { entry, sequence: entry.course, values: [], music: false, freight: act === 'freight' };
        }
        if (act === 'tune' || act === 'encore') {
          const entry = TUNES.find((t) => t.id === id), encore = act === 'encore';
          attempt = { entry, sequence: encore ? encoreNotes(entry) : entry.notes, values: [], music: true, start: null, encore };
        }
        if (act === 'back') attempt = null;
        if (act === 'start') attempt.last = attempt.start = performance.now();
        if (act === 'print' || act === 'order') {
          const order = act === 'order';
          const made = makeIslandPattern(game, id, { order });
          if (made) printed = id;
          message = order ? (made ? 'Order filled and paid.' : 'This order is unavailable.')
            : (made ? 'Scarf printed and worn.' : 'Bring the materials to the weaver.');
        }
        if (act === 'wear' && book.patterns.includes(id)) { book.scarf = book.scarf === id ? null : id; game.saveSoon = true; }
        if (act === 'learn') message = learnIslandTune(game, id) ? 'The hawker musician teaches you the tune.' : 'This tune is unavailable here.';
        if (act === 'cove') message = exploreCove(game, id) ? 'Find added to your pack.' : 'Make space in your pack or try at the cove.';
        if (act === 'answer' && attempt) {
          const { music, entry, values, start, sequence, freight, encore } = attempt, value = Number(id);
          const now = performance.now();
          if (music && now - attempt.last < 180) {
            attempt.note = null;
            message = 'Leave a short beat between notes.';
            render(body);
            body.querySelector(`[data-island="answer:${value}"]`)?.focus();
            return;
          }
          if (music) {
            attempt.last = now;
            attempt.note = value;
            game.audio?.play?.('island-note-' + id);
          }
          if (sequence[values.length] !== value) {
            attempt = null;
            message = music ? 'Wrong note. Try the tune again.' : 'You missed the buoy. Try the chart again.';
          } else {
            values.push(value);
            if (values.length === sequence.length) {
              if (!music && finishVoyage(game, entry.id, values, { freight })) return;
              const ok = music && finishIslandTune(game, entry.id, values, performance.now() - start, { encore });
              message = ok ? 'Well played. The crowd tipped you.' : 'The attempt ended. Check your location or pace and try again.';
              attempt = null;
            }
          }
        }
        const top = body.scrollTop;
        render(body);
        body.scrollTop = top;
        if (attempt) {
          const focus = [...body.querySelectorAll('[data-island]')].find((el) => el.dataset.island === key);
          (focus || body.querySelector('[data-island]'))?.focus();
        }
      });
    }
  };
  ui.openModal(info.name, render);
  return true;
}
