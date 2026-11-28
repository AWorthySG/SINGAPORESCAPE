import { islandPhotoArt, ISLAND_BY_ID, LANDINGS, LOOMS, PATTERNS, PHOTO_ASSIGNMENTS, VOYAGES } from '../data/islandlife.js';
import { PHOTO_WALKS } from '../data/photowalks.js';
import { activePhotoWalk, cancelPhotoWalk, photographyBook, photoThumbnail, startPhotoWalk } from '../game/photowalk.js';
import { getItem } from '../data/items.js';
import { SAILING_PRACTICE } from '../data/sailing.js';
import { sailingSides } from '../game/sailing.js';
import { TEXTILE_METHODS, TEXTILE_PROJECTS, TEXTILE_SWATCHES } from '../data/textiles.js';
import {
  atIslandSite, beginSailingPassage, COVE_FIND, directPassageUnlocked, displayHomeTextile, exploreCove, finishTextileProject,
  islandBook, islandClaimed, islandPayout, islandPractised, islandReady, islandSiteTile, makeIslandPattern, navigateSailingPassage,
  sailingPracticeRequirementsMet, takeChartedPassage, textileProjectAvailable, textileWorkshop, voyageRequirementsMet,
} from '../game/islandlife.js';
import { nextUnlock, skillTeleport, skillTeleportOf } from '../game/skillunlocks.js';
import { lifePerkNext, lifePerkText } from '../game/lifeperks.js';
import { bindIslandMarket, islandMarketHTML, islandProgressHTML } from './islandprogressui.js';
import { skillIconSVG } from '../render/icons.js';
import { openIslandMusic } from './islandmusicui.js';

const button = (label, key, disabled = false) => `<button type="button" class="wm-go" data-island="${key}"${disabled ? ' disabled' : ''}>${label}</button>`;
const row = (title, hint, actions = '') => `<section class="island-row"><div><b>${title}</b><small>${hint}</small></div><div class="island-actions">${actions}</div></section>`;
const swatch = (p, printed) => `<img class="island-swatch${printed ? ' just-printed' : ''}" src="assets/icons/scarf-${p.art || p.id}.webp" style="filter:hue-rotate(${p.hue || 0}deg)" alt="">`;

function voyageTrack(values, count, marker, advanced) {
  const offset = (side) => side == null ? 0 : side ? 8 : -8;
  const leg = values.length;
  const position = (step) => (step + 0.5) / (count + 1) * 100;
  const buoys = Array.from({ length: count }, (_, i) => {
    const style = i === leg && marker ? `;top:calc(50% + ${offset(marker.side)}px);background:${marker.colour}` : '';
    return `<i${i === leg ? ' class="island-next-buoy"' : ''} style="left:${position(i + 1)}%${style}"></i>`;
  }).join('');
  return `<div class="island-voyage" aria-hidden="true">${buoys}<div class="island-boat${advanced ? ' steering' : ''}"
    style="--from:${position(Math.max(0, leg - 1))}%;--to:${position(leg)}%;--from-side:${offset(values[leg - 2])}px;--to-side:${offset(values[leg - 1])}px">
    <img alt="" src="assets/world/obj-sampan.webp"></div></div>`;
}

function sailingLesson({ title, passage, advanced }) {
  const { legs, values, tide, corrections } = passage;
  const leg = legs[values.length];
  return `<div class="island-challenge"><h3>${title}</h3>
    ${voyageTrack(values, legs.length, leg.marker, advanced)}
    <div class="island-chart"><span class="current">Marker ${values.length + 1} of ${legs.length}</span><span>${tide} tide</span>${corrections ? `<span>${corrections} course ${corrections === 1 ? 'correction' : 'corrections'}</span>` : ''}</div>
    <p><strong>${leg.label}</strong><br>${leg.reading}</p>
    <p>${leg.guide}</p>
    <div class="island-actions">${sailingSides.map((side, i) => button('Steer ' + side, 'helm:' + i)).join('')}${button('Back', 'sailing-back:')}</div></div>`;
}

export function islandAlbumHTML(game) {
  const book = islandBook(game);
  const prints = PHOTO_ASSIGNMENTS.filter((p) => book.photos.includes(p.id)).map((p) =>
    `<figure class="island-print"><img src="${photoThumbnail(game, p.id) || islandPhotoArt(p)}" alt=""><figcaption>${p.name}</figcaption>${button(book.display === p.id ? 'On display' : 'Display', 'display:' + p.id, book.display === p.id)}</figure>`);
  const { completed } = photographyBook(game);
  const portfolio = PHOTO_WALKS.filter((walk) => completed[walk.id]).map((walk) =>
    `<figure class="island-print"><img src="${photoThumbnail(game, walk.id) || islandPhotoArt(walk.stops.at(-1))}" alt=""><figcaption>${walk.name} · Portfolio</figcaption></figure>`);
  return [...prints, ...portfolio].join('');
}

export function displayIslandPrint(game, id) {
  const book = islandBook(game);
  if (!game.home?.owned || !book.photos.includes(id)) return false;
  book.display = id;
  game.saveSoon = true;
  return true;
}

export function openIslandSkill(ui, skill) {
  if (skill === 'music') return openIslandMusic(ui, (next) => openIslandSkill(ui, next));
  const game = ui.game, info = ISLAND_BY_ID[skill];
  if (!info) return false;
  const book = islandBook(game);
  let message = '', printed = null;
  let textileAttempt = null, textileReturn = null;
  let sailingAttempt = null, sailingReturn = null;
  const sites = new Map();
  const go = (site) => {
    const key = `go:${site.x},${site.y}`;
    sites.set(key, islandSiteTile(game.world, site));
    return button('Go', key);
  };
  const page = () => {
    const lvl = game.skills.level(skill), ready = islandReady(game);
    if (skill === 'sailing') {
      const here = Object.entries(LANDINGS).find(([, place]) => atIslandSite(game, place));
      const voyages = [...VOYAGES].sort((a, b) => Number(b.from === here?.[0]) - Number(a.from === here?.[0]));
      return `<h3>${here ? LANDINGS[here[0]].name : 'Sailing landings'}</h3>` + voyages.map((v) => {
        const known = book.voyages.includes(v.id), claimed = islandClaimed(game, 'freight:' + v.id);
        const prereq = VOYAGES.find((r) => r.id === (v.requires || (v.to === 'cove' ? 'ubin' : '')));
        const hint = known ? 'Charted' : prereq && !book.voyages.includes(prereq.id)
          ? 'Chart ' + LANDINGS[prereq.to].name + ' first' : 'Uncharted';
        const freight = v.freight && known ? ` · ${claimed ? 'Freight delivered today' : islandPayout(game, skill, v.freight) + ' coins for freight'}` : '';
        const disabled = !voyageRequirementsMet(game, v);
        const actions = atIslandSite(game, LANDINGS[v.from])
          ? button('Set sail', 'voyage:' + v.id, disabled) + (v.freight && known ? button('Carry freight', 'freight:' + v.id, disabled || claimed) : '')
            + (directPassageUnlocked(game, v) ? button('Direct passage', 'direct-passage:' + v.id, disabled) : '')
          : go(LANDINGS[v.from]);
        return row(LANDINGS[v.from].name + ' → ' + LANDINGS[v.to].name, `Level ${v.level} · ${hint}${freight}`, actions);
      }).join('')
        + '<h3>Pilotage</h3><p>Read the water and practise from the landing to earn Sailing XP. First clears and clean passages earn extra XP.</p>'
        + SAILING_PRACTICE.map((entry) => {
          const dock = LANDINGS[entry.from], prerequisite = VOYAGES.find((v) => v.id === entry.requires);
          const charter = prerequisite && !book.voyages.includes(prerequisite.id) ? ` · Chart ${LANDINGS[prerequisite.to].name} first` : '';
          const certificate = islandPractised(game, 'sailing', entry.id) ? ' · Certificate earned' : '';
          const action = atIslandSite(game, dock) ? button('Practise pilotage', 'pilot:' + entry.id, !sailingPracticeRequirementsMet(game, entry)) : go(dock);
          return row(entry.name, `Level ${entry.level} · ${dock.name}${certificate}${charter} · ${entry.detail}`, action);
        }).join('')
        + (book.voyages.includes('cove') && atIslandSite(game, LANDINGS.cove) ? '<h3>Cove finds</h3>' + COVE_FIND.map((f) =>
          row(f.name, book.cove.includes(f.id) ? 'Recorded' : getItem(f.item).name, button('Explore', 'cove:' + f.id, !ready || book.cove.includes(f.id)))).join('') : '');
    }
    if (skill === 'photography') {
      const active = activePhotoWalk(game), { completed } = photographyBook(game);
      const next = active && (atIslandSite(game, active.stop, active.stop.range)
        ? button('Open viewfinder', 'photo-walk-camera:', !ready || !game.photoCamera) : go(active.stop));
      const current = active ? row(active.walk.name, `Stop ${active.progress.step + 1}/${active.walk.stops.length} · ${active.stop.name}`,
        next + button('Cancel walk', 'photo-walk-cancel:')) : '';
      const walks = PHOTO_WALKS.map((walk) => {
        const count = completed[walk.id];
        return row(walk.name, `Level ${walk.level} · ${walk.stops.length} stops${count ? ` · Completed ${count}×` : ''}`,
          button('Start walk', 'photo-walk-start:' + walk.id, !!active || !ready || lvl < walk.level));
      }).join('');
      return '<h3>Photo walks</h3><p>Visit each stop to earn repeatable Photography XP and build your portfolio. Framing and dusk can improve a shot.</p>' + current + walks
        + '<h3>Album and commissions</h3><p>Collect a print on your first visit. Return on another day for a paid postcard commission.</p>' +
        PHOTO_ASSIGNMENTS.map((p) => {
          const collected = book.photos.includes(p.id), done = islandClaimed(game, 'photo:' + p.id);
          const hint = collected ? (done ? 'Print collected · Submitted today' : 'Print collected · ' + islandPayout(game, skill, Math.round(p.xp * 1.5)) + ' coins for a new postcard') : 'Level ' + p.level;
          return row(`<img class="island-assignment-art" src="${photoThumbnail(game, p.id) || islandPhotoArt(p)}" alt="">` + p.name, hint + ' · ' + p.detail,
            done ? '' : atIslandSite(game, p, p.range)
              ? button('Open camera', 'camera:', lvl < p.level || !game.photoCamera) : go(p));
        }).join('');
    }
    if (skill === 'textile_arts') {
      const workshop = textileWorkshop(game);
      const projects = TEXTILE_PROJECTS.map((p) => {
        const completed = book.textiles.projects.includes(p.id), hung = book.textiles.display === p.id;
        const station = LOOMS[p.free ? 0 : 1];
        const supplies = p.free ? 'One free sampler' : [...p.dyes.map(([dye, amount]) => `${amount} × ${getItem(dye).name}`), `${p.coins} coins`].join(' · ');
        const work = p.free && completed ? '' : atIslandSite(game, station)
          ? button(p.free ? 'Try sampler' : completed ? 'Make again' : 'Start project', 'textile-project:' + p.id, !textileProjectAvailable(game, p))
          : go(station);
        const display = completed ? button(hung ? 'Take down' : 'Hang at home', 'textile-display:' + p.id, !game.home?.owned) : '';
        const home = hung ? ' · On display in Kranji' : completed && !game.home?.owned ? ' · Buy your plot in Kranji to hang it' : '';
        return row(swatch(p, printed === p.id) + p.name, `Level ${p.level} · ${supplies}${completed ? ' · Finished' : ''}${home}`, work + display);
      });
      return LOOMS.map((site) => row(site.name, site.level === 1 ? 'Try a free sampler or bring a farmed dye and 8 coins for cotton.' : 'Level 8 · Paid scarf orders and larger cloth projects.',
        atIslandSite(game, site) ? '' : go(site))).join('') + projects[0] + '<h3>Scarf patterns</h3>'
        + '<p>Practise any pattern you can make. Chinatown orders pay once per pattern each day.</p>' + PATTERNS.map((p) => {
          const known = book.patterns.includes(p.id), made = islandClaimed(game, 'order:' + p.id);
          const dye = game.inventory.count(p.dye), coins = game.inventory.count('coins');
          const actions = (workshop ? button('Print scarf', 'print:' + p.id, !ready || lvl < p.level || dye < 1 || coins < 8) : '')
            + (workshop?.level >= 8 && known ? button(made ? 'Order filled today' : 'Fill order', 'order:' + p.id, made || !ready || lvl < p.level || dye < 2 || coins < 16) : '')
            + (known ? button(book.scarf === p.id ? 'Remove' : 'Wear', 'wear:' + p.id) : '');
          const offer = known && !made ? ` · Order: 2 dye + 16 coins for ${islandPayout(game, skill, Math.round(p.xp * 1.5))} coins` : '';
          const reward = p.reward ? ` · Order reward: ${getItem(p.reward).name}` : '';
          return row(swatch(p, printed === p.id) + p.name, `Level ${p.level} · ${getItem(p.dye).name}${offer}${reward}`, actions);
        }).join('') + '<h3>Wall hangings</h3><p>Make larger cloths in Chinatown. Practise again whenever you have the materials.</p>'
        + projects.slice(1).join('');
    }
    return '';
  };
  const textileLesson = () => {
    const { entry, steps, values } = textileAttempt;
    return `<div class="island-challenge"><h3>${swatch(entry, false)}${entry.name}</h3>
      <div class="island-chart"><span class="current">Step ${values.length + 1} of ${steps.length}</span></div>
      <p>${steps[values.length].clue} Which technique fits?</p>
      <div class="island-actions">${TEXTILE_METHODS.map((method) => button(method.name, 'textile-step:' + method.id)).join('')}${button('Back', 'textile-back:')}</div>
      <details><summary>Technique guide</summary><ul>${TEXTILE_METHODS.map((method) => `<li><b>${method.name}</b> · ${method.use}</li>`).join('')}</ul></details></div>`;
  };
  const render = (body) => {
    const level = game.skills.level(skill), next = lifePerkNext(skill, level);
    const milestone = nextUnlock(skill, level);
    const unlocked = skillTeleportOf(game, skill);
    const progress = milestone || unlocked ? row('Skill milestones',
      milestone ? `Level ${milestone.level} · ${milestone.desc}` : 'All milestones earned',
      unlocked ? button('Skill teleport', 'teleport:', !islandReady(game)) : '') : '';
    body.innerHTML = `<div class="island-panel" style="--island-accent:${info.color}"><header>${skillIconSVG(skill, 32)}<div><b>${info.name} · Level ${game.skills.level(skill)}</b><small>${info.desc}</small><small>Combat · ${lifePerkText(skill, level)}${next ? ' · Level ' + next.level + ': ' + next.text : ''}</small></div></header>
      <div class="island-status" role="status">${message}</div>${sailingAttempt ? sailingLesson(sailingAttempt) : textileAttempt ? textileLesson() : islandProgressHTML(game, skill) + progress + islandMarketHTML(game, skill) + page()}</div>`;
    bindIslandMarket(body, (nextSkill) => openIslandSkill(ui, nextSkill));
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
        if (act === 'camera' || act === 'photo-walk-camera') { ui.closeModal(); game.photoCamera?.open({ walk: act !== 'camera' }); return; }
        if (act === 'photo-walk-start') message = startPhotoWalk(game, id) ? 'Walk started. Go to the first stop or open the viewfinder.' : 'This walk is unavailable.';
        if (act === 'photo-walk-cancel') { cancelPhotoWalk(game); message = 'Walk cancelled.'; }
        if (act === 'voyage' || act === 'freight' || act === 'pilot') {
          const options = { freight: act === 'freight', practice: act === 'pilot' };
          const passage = beginSailingPassage(game, id, options);
          if (passage) {
            const entry = (options.practice ? SAILING_PRACTICE : VOYAGES).find((row) => row.id === id);
            const title = options.practice ? entry.name : (options.freight ? 'Freight to ' : 'Passage to ') + LANDINGS[entry.to].name;
            sailingAttempt = { passage, title };
            sailingReturn = key;
          } else message = islandReady(game) ? 'Check your dock, route chart and Sailing level.' : 'Wait until you are safe at the dock before boarding.';
        }
        if (act === 'direct-passage') {
          if (takeChartedPassage(game, id)) return;
          message = islandReady(game) ? 'This passage is unavailable from your current dock.' : 'Wait until you are safe at the dock before boarding.';
        }
        if (act === 'sailing-back') sailingAttempt = null;
        if (act === 'helm' && sailingAttempt) {
          const { passage } = sailingAttempt;
          const { outcome, xp, first } = navigateSailingPassage(game, passage, Number(id));
          sailingAttempt.advanced = outcome === 'ahead';
          if (outcome === 'landed') return;
          if (outcome === 'recover') message = 'The boat drifts off line. Correct your heading and try this marker again.';
          if (outcome === 'trained' || outcome === 'closed') {
            sailingAttempt = null;
            if (outcome === 'trained') {
              const experience = xp > 0 ? ` · ${Math.round(xp).toLocaleString('en-SG')} Sailing XP` : '';
              message = (first ? 'Pilot certificate earned' : 'Pilotage logged') + experience + '.';
            } else message = 'The passage ended. Return to the dock when you are ready to sail.';
          }
        }
        if (act === 'print' || act === 'order' || act === 'textile-project') {
          const project = act === 'textile-project', entry = (project ? TEXTILE_PROJECTS : PATTERNS).find((row) => row.id === id);
          if (entry) textileAttempt = { entry, project, order: act === 'order', steps: project ? entry.steps : [TEXTILE_SWATCHES[id]], values: [] };
          textileReturn = key;
        }
        if (act === 'textile-back') textileAttempt = null;
        if (act === 'textile-step' && textileAttempt) {
          const { entry, project, order, steps, values } = textileAttempt;
          if (steps[values.length].method !== id) {
            const method = TEXTILE_METHODS.find((row) => row.id === id);
            message = method ? `${method.use} Try another technique.` : 'Choose a technique.';
          } else {
            values.push(id);
            if (values.length === steps.length) {
              const made = project ? finishTextileProject(game, entry.id, values) : makeIslandPattern(game, entry.id, { order, technique: id });
              if (made) printed = entry.id;
              message = !made ? 'Check your materials, location and access to this work.'
                : project ? 'Project finished. Your piece is ready to hang.' : order ? 'Order filled and paid.' : 'Scarf printed and worn.';
              textileAttempt = null;
            }
          }
        }
        if (act === 'textile-display' && !displayHomeTextile(game, book.textiles.display === id ? null : id)) message = 'You need a finished piece and a home plot.';
        if (act === 'wear' && book.patterns.includes(id)) { book.scarf = book.scarf === id ? null : id; game.saveSoon = true; }
        if (act === 'cove') message = exploreCove(game, id) ? 'Find added to your pack.' : 'Make space in your pack or try at the cove.';
        const top = body.scrollTop;
        render(body);
        body.scrollTop = top;
        if (sailingAttempt || act === 'helm' || act === 'sailing-back') {
          const target = sailingAttempt ? (act === 'helm' ? key : 'helm:0') : sailingReturn;
          body.querySelector(`[data-island="${target}"]:enabled`)?.focus();
        } else if (textileAttempt || act === 'textile-step' || act === 'textile-back') {
          const target = textileAttempt ? key : act === 'textile-step' || act === 'textile-back' ? textileReturn : key;
          const focus = [...body.querySelectorAll('[data-island]:enabled')].find((el) => el.dataset.island === target);
          (focus || body.querySelector('[data-island]'))?.focus();
        }
      });
    }
  };
  ui.openModal(info.name, render);
  return true;
}
