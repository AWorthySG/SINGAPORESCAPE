import { ISLAND_BY_ID, LANDINGS, LOOM, PATTERNS, PHOTO_ASSIGNMENTS, STAGES, TUNES, VOYAGES } from '../data/islandlife.js';
import { getItem } from '../data/items.js';
import { COVE_FIND, exploreCove, finishIslandTune, finishVoyage, islandBook, islandReady, learnIslandTune, makeIslandPattern, musicStage, nearIslandSite, voyageAvailable } from '../game/islandlife.js';
import { skillIconSVG } from '../render/icons.js';

const SIDES = ['Port · left', 'Starboard · right'];
const NOTES = ['Low', 'Middle', 'High'];
const button = (label, key, disabled = false) => `<button type="button" class="wm-go" data-island="${key}"${disabled ? ' disabled' : ''}>${label}</button>`;
const row = (title, hint, actions = '') => `<section class="island-row"><div><b>${title}</b><small>${hint}</small></div><div class="island-actions">${actions}</div></section>`;
const swatch = (p) => `<span aria-hidden="true" class="island-swatch" style="--cloth:${p.colours[0]};--print:${p.colours[1]}"></span>`;

export function islandAlbumHTML(game) {
  const book = islandBook(game);
  return PHOTO_ASSIGNMENTS.filter((p) => book.photos.includes(p.id)).map((p) =>
    `<figure class="island-print"><img src="assets/world/${p.art}.webp" alt=""><figcaption>${p.name}</figcaption>${button(book.display === p.id ? 'On display' : 'Display', 'display:' + p.id, book.display === p.id)}</figure>`).join('');
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
  let attempt = null, message = '';
  const sites = new Map();
  const go = (site) => {
    const key = `go:${site.x},${site.y}`;
    sites.set(key, site);
    return button('Go', key);
  };
  const page = () => {
    const lvl = game.skills.level(skill), ready = islandReady(game);
    if (skill === 'sailing') {
      return VOYAGES.map((v) => row(LANDINGS[v.from].name + ' → ' + LANDINGS[v.to].name,
        `Level ${v.level} · ${book.voyages.includes(v.id) ? 'Charted' : v.to === 'cove' ? 'Chart Ubin first' : 'Uncharted'}`,
        nearIslandSite(game.player, LANDINGS[v.from]) ? button('Set sail', 'voyage:' + v.id, !voyageAvailable(game, v)) : go(LANDINGS[v.from]))).join('')
        + (book.voyages.includes('cove') && nearIslandSite(game.player, LANDINGS.cove) ? COVE_FIND.map((f) =>
          row(f.name, book.cove.includes(f.id) ? 'Recorded' : getItem(f.item).name, button('Explore', 'cove:' + f.id, !ready || book.cove.includes(f.id)))).join('') : '');
    }
    if (skill === 'photography') {
      return '<p>Use the camera to take assignment postcards. Finished subjects appear in your home album.</p>' +
        PHOTO_ASSIGNMENTS.map((p) => row(p.name, book.photos.includes(p.id) ? 'Print collected' : `Level ${p.level} · ${p.detail}`,
          book.photos.includes(p.id) ? '' : nearIslandSite(game.player, p, p.range)
            ? button('Open camera', 'camera:', lvl < p.level || !game.photoCamera) : go(p))).join('');
    }
    if (skill === 'textile_arts') {
      const here = nearIslandSite(game.player, LOOM);
      return row(LOOM.name, 'Bring a farmed dye ingredient. The weaver supplies cotton for 8 coins.', here ? '' : go(LOOM)) +
        PATTERNS.map((p) => row(swatch(p) + p.name, `Level ${p.level} · 1 ${getItem(p.dye).name} + 8 coins`,
          (here ? button('Print scarf', 'print:' + p.id, !ready || lvl < p.level || game.inventory.count(p.dye) < 1 || game.inventory.count('coins') < 8) : '')
          + (book.patterns.includes(p.id) ? button(book.scarf === p.id ? 'Remove' : 'Wear', 'wear:' + p.id) : ''))).join('');
    }
    const stage = musicStage(game);
    return STAGES.map((s) => row(s.name, `Stage access at Music level ${s.level}`, nearIslandSite(game.player, s) ? '' : go(s))).join('')
      + TUNES.map((t) => row(t.name, `Level ${t.level} · ${t.notes.length} notes · ${t.tip} coins per performance`,
        book.tunes.includes(t.id) ? button('Perform', 'tune:' + t.id, !ready || !stage) : button('Learn', 'learn:' + t.id, !ready || !stage || lvl < t.level))).join('');
  };
  const challenge = () => {
    const { entry, values, start, music } = attempt;
    const names = music ? NOTES : SIDES, sequence = music ? entry.notes : entry.course;
    const preview = !music || start === null;
    return `<div class="island-challenge"><h3>${music ? entry.name : 'Chart to ' + LANDINGS[entry.to].name}</h3>
      <p>${music ? (preview ? 'Read the tune, then play it from memory. Leave a short beat between notes.' : 'Play the tune from memory.') : 'Pass each buoy on the side marked on your chart.'}</p>
      <div class="island-chart">${preview ? sequence.map((n, i) => `<span${i === values.length ? ' class="current"' : ''}>${names[n]}</span>`).join('') : `${values.length} / ${sequence.length} notes`}</div>
      <div class="island-actions">${music && preview ? button('Start playing', 'start:') : names.map((n, i) => button(n, 'answer:' + i)).join('')}${button('Back', 'back:')}</div></div>`;
  };
  const render = (body) => {
    body.innerHTML = `<div class="island-panel" style="--island-accent:${info.color}"><header>${skillIconSVG(skill, 32)}<div><b>${info.name} · Level ${game.skills.level(skill)}</b><small>${info.desc}</small></div></header>
      <div class="island-status" role="status">${message}</div>${attempt ? challenge() : page()}</div>`;
    for (const b of body.querySelectorAll('[data-island]')) {
      b.addEventListener('click', () => {
        const key = b.dataset.island, [act, id] = key.split(':');
        message = '';
        if (act === 'go') {
          if (game.travelToTile(sites.get(key))) ui.closeModal();
          else { message = 'There is no safe route from here.'; render(body); }
          return;
        }
        if (act === 'camera') { ui.closeModal(); game.photoCamera?.open(); return; }
        if (act === 'voyage') attempt = { entry: VOYAGES.find((v) => v.id === id), values: [], music: false };
        if (act === 'tune') attempt = { entry: TUNES.find((t) => t.id === id), values: [], music: true, start: null };
        if (act === 'back') attempt = null;
        if (act === 'start') attempt.last = attempt.start = performance.now();
        if (act === 'print') message = makeIslandPattern(game, id) ? 'Scarf printed and worn.' : 'Bring the materials to the weaver.';
        if (act === 'wear' && book.patterns.includes(id)) { book.scarf = book.scarf === id ? null : id; game.saveSoon = true; }
        if (act === 'learn') message = learnIslandTune(game, id) ? 'The hawker musician teaches you the tune.' : 'This tune is unavailable here.';
        if (act === 'cove') message = exploreCove(game, id) ? 'Find added to your pack.' : 'Make space in your pack or try at the cove.';
        if (act === 'answer' && attempt) {
          const { music, entry, values, start } = attempt, value = Number(id);
          const sequence = music ? entry.notes : entry.course;
          const now = performance.now();
          if (music && now - attempt.last < 180) {
            message = 'Leave a short beat between notes.';
            render(body);
            body.querySelector(`[data-island="answer:${value}"]`)?.focus();
            return;
          }
          if (music) {
            attempt.last = now;
            game.audio?.play?.('island-note-' + id);
          }
          if (sequence[values.length] !== value) {
            attempt = null;
            message = music ? 'Wrong note. Try the tune again.' : 'You missed the buoy. Try the chart again.';
          } else {
            values.push(value);
            if (values.length === sequence.length) {
              if (!music && finishVoyage(game, entry.id, values)) return;
              const ok = music && finishIslandTune(game, entry.id, values, performance.now() - start);
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
