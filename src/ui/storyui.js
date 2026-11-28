// The story's UI (src/game/story.js): the Journal tab's Story view (chapters,
// progress, what to do next with a Go button, lore pages and sets) and the
// overlay that draws a chapter scene (letterbox bars, the speaker's portrait
// and line in a speech bubble, Skip). ui.js only calls installStoryUI; the
// panel's HTML builder returns a plain string so tests can render it headlessly.
import { CHAPTERS, STORY_NAME } from '../data/story.js';
import { LORE_SETS, STORY_SET, STORY_SET_REWARD } from '../data/lore.js';
import { getNpc } from '../data/npcs.js';
import { getItem } from '../data/items.js';
import { pageCount, spotTile, guardianKind } from '../game/lore.js';
import { townPortrait, portraitFor } from '../render/sprites.js';
import { choiceBadgeHTML, choiceLineHTML } from './pathui.js';   // each chapter's Good / Evil choice

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (state, text) => `<span class="q-chip ${state === 'done' ? 'done' : state === 'active' ? 'active' : 'todo'}">${esc(text)}</span>`;
const HOW = { drop: 'a rare drop from monsters here', spot: 'a glinting note hidden near the region’s quest giver', chapter: 'finishing its story chapter' };

/** A speaker's picture: their own townsfolk art, the one they borrow (recoloured), or a boss's or creature's portrait. */
export function speakerArt(who) {
  const town = townPortrait(who);
  if (town) return town;
  const def = getNpc(who);
  const p = def && portraitFor(who, def);
  return p ? { src: p.src, filter: '', pos: p.pos } : null;
}

const rewardText = (r) => [r.coins ? `${r.coins.toLocaleString('en-GB')} coins` : '', r.item ? `${r.item[1]} ${getItem(r.item[0]).name}` : '', `title “${r.title}”`].filter(Boolean).join(' · ');

/** The Story view's HTML. */
export function storyPanelHTML(game) {
  const s = game.story;
  if (!s) return '';
  const done = s.done.size, total = CHAPTERS.length;
  const pc = pageCount(s);
  let html = `<div class="story-head"><b>${esc(STORY_NAME)}</b><span>Chapter ${Math.min(s.ch + 1, total)} of ${total} · ${done} done · ${pc.have}/${pc.total} lore pages</span></div>`;
  const badges = CHAPTERS.map((c) => `<span class="story-badge${s.done.has(c.id) ? ' got' : ''}" title="${esc(c.reward.title)}">${s.done.has(c.id) ? c.reward.badge : '·'}</span>`).join('');
  html += `<div class="story-badges" aria-label="Chapter badges">${badges}</div>`;
  const titles = s.titles();
  if (titles.length) html += `<div class="story-titles">Titles earned: ${titles.map((t) => `<i>${esc(t)}</i>`).join(', ')}</div>`;
  if (game.autoBattle || game.autoQuest) html += '<div class="modal-hint story-hint">Scenes are told in the chat while auto battle or auto quest is on.</div>';

  // The chapters: the open one in full, the rest as one line each.
  CHAPTERS.forEach((c, i) => {
    const isDone = s.done.has(c.id), open = i === s.ch;
    const pr = s.progress(c);
    const replay = ['intro', 'outro'].filter((p) => s.seen.has(`${c.id}:${p}`))
      .map((p) => `<button class="story-replay" type="button" data-replay="${c.id}:${p}" title="Replay the ${p}">${p === 'intro' ? '▶ Intro' : '▶ Ending'}</button>`).join('');
    if (open) {
      const next = s.nextStep();
      html += `<div class="quest-row story-ch open"><div class="q-top"><b><span class="story-num">${i + 1}</span> ${esc(c.title)}${choiceBadgeHTML(game, c.id)}</b>${chip('active', `${pr.have}/${pr.need}`)}</div>`
        + `<span class="q-desc">${esc(c.summary)}</span>${choiceLineHTML(game, c.id)}`
        + `<ul class="story-quests">${pr.quests.map((q) => `<li class="${q.state}">${q.state === 'done' ? '✔' : q.state === 'active' ? '➤' : '○'} ${esc(q.name)}${q.region ? ` <small>${esc(q.region)}</small>` : ''}</li>`).join('')}</ul>`
        + (next ? `<div class="q-foot"><span class="q-next">${next.canGo ? '&#10148; ' : ''}${esc(next.text || next.name)}</span>`
          + (next.canGo ? `<button class="q-go" type="button" data-quest="${next.quest}" title="Walk there and start on it">Go</button>` : '') + '</div>' : '')
        + `<span class="q-desc story-reward">Reward: ${esc(rewardText(c.reward))} · ${c.reward.badge} badge</span>`
        + (replay ? `<div class="story-replays">${replay}</div>` : '') + '</div>';
    } else if (isDone) {
      html += `<div class="quest-row story-ch done"><div class="q-top"><b><span class="story-num">${c.reward.badge}</span> ${esc(c.title)}${choiceBadgeHTML(game, c.id)}</b>${chip('done', 'Done')}</div>`
        + `<span class="q-desc">${esc(c.summary)}</span>${choiceLineHTML(game, c.id)}${replay ? `<div class="story-replays">${replay}</div>` : ''}</div>`;
    } else {
      html += `<div class="quest-row story-ch locked"><div class="q-top"><b><span class="story-num">${i + 1}</span> ${esc(c.title)}${choiceBadgeHTML(game, c.id)}</b>${chip('todo', 'Later')}</div>`
        + `<span class="q-desc">${esc(c.regions.join(', '))}</span></div>`;
    }
  });

  // Lore pages, set by set.
  html += `<div class="story-head story-lore-head"><b>Lore pages</b><span>${pc.have}/${pc.total} found · drops, hidden notes and chapters</span></div>`;
  for (const set of LORE_SETS) {
    const n = pageCount(s, set.region), full = n.have === n.total;
    const guard = s.guard[set.region];
    let foot = '';
    if (set.region === STORY_SET) {
      if (s.storyPaid) foot = `<span class="q-desc">Set complete: title “${esc(STORY_SET_REWARD.title)}”.</span>`;
    } else if (guard === 'ready') {
      const t = spotTile(game, set.region), kind = guardianKind(set.region);
      foot = `<div class="q-foot"><span class="q-next">&#10148; The Guardian of ${esc(set.region)} (a champion ${esc(getNpc(kind)?.name?.toLowerCase() || 'foe')}) waits by the hidden spot</span>`
        + (t ? `<button class="q-go" type="button" data-tile="${t.x},${t.y}" title="Walk to the guardian">Go</button>` : '') + '</div>';
    } else if (guard === 'done') foot = '<span class="q-desc">Set complete: its guardian is laid to rest.</span>';
    html += `<details class="quest-row story-set${full ? ' full' : ''}"><summary class="q-top"><b>${esc(set.region)}</b>${chip(full ? 'done' : n.have ? 'active' : 'todo', `${n.have}/${n.total}`)}</summary>`;
    for (const p of set.pages) {
      html += s.pages.has(p.id)
        ? `<details class="lore-page"><summary>📜 ${esc(p.title)}</summary><p>${esc(p.text)}</p></details>`
        : `<div class="lore-page missing">??? <small>Found by ${esc(HOW[p.from])}.</small></div>`;
    }
    html += `${foot}</details>`;
  }
  return html;
}

/** Wire the Story view and the scene overlay into the UI. */
export function installStoryUI(ui) {
  const game = ui.game;
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('story-panel');
  const visible = () => panel && !panel.closest('.panel-view')?.classList.contains('hidden');
  const openSets = new Set();
  ui.renderStoryPanel = () => {
    if (!visible()) return;
    // Keep open sets (and pages) open across redraws.
    panel.querySelectorAll('details.story-set[open] > summary b').forEach((b) => openSets.add(b.textContent));
    panel.querySelectorAll('details.story-set:not([open]) > summary b').forEach((b) => openSets.delete(b.textContent));
    const html = storyPanelHTML(game);
    if (html === ui._storyHTML && panel.innerHTML) return;
    ui._storyHTML = html;
    panel.innerHTML = html;
    panel.querySelectorAll('details.story-set').forEach((d) => { if (openSets.has(d.querySelector('summary b')?.textContent)) d.open = true; });
  };
  panel?.addEventListener('click', (e) => {
    const go = e.target.closest?.('.q-go');
    if (go?.dataset.quest) { game.questTravel(go.dataset.quest); ui.renderStoryPanel(); return; }
    if (go?.dataset.tile) {
      const [x, y] = go.dataset.tile.split(',').map(Number);
      if (game.travelToTile({ x, y })) game.msg('You set off to find the guardian.', 'system');
      return;
    }
    const rp = e.target.closest?.('.story-replay');
    if (rp) { const [ch, part] = rp.dataset.replay.split(':'); game.story.replay(ch, part); }
  });
  const soon = () => ui._soon ? ui._soon('story', () => ui.renderStoryPanel(), 250) : ui.renderStoryPanel();
  for (const ev of ['story', 'quest', 'autoquest', 'autobattle']) game.bus.on(ev, soon);

  // ---- The scene overlay ----
  const root = document.getElementById('game-root') || document.body;
  const el = document.createElement('div');
  el.id = 'story-scene';
  el.className = 'story-scene hidden';
  el.innerHTML = '<div class="ss-bar ss-top"><span class="ss-title"></span></div><div class="ss-bar ss-bottom"></div>'
    + '<div class="ss-bubble" role="dialog" aria-live="polite"><span class="ss-portrait" aria-hidden="true"><img alt=""></span>'
    + '<div class="ss-text"><b class="ss-name"></b><p class="ss-line"></p><span class="ss-hint">Tap to continue</span></div></div>'
    + '<button class="ss-skip" type="button" title="Skip (Esc)">Skip ▸▸</button>';
  root.appendChild(el);
  const $ = (sel) => el.querySelector(sel);
  let hideTimer = 0, shownLine = null;
  const update = () => {
    const s = game.story?.scene;
    if (!s || s.done) {
      el.classList.remove('on');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!game.story?.scene) el.classList.add('hidden'); }, 400);
      shownLine = null;
      return;
    }
    clearTimeout(hideTimer);
    const still = !!game.reduceMotion;
    el.classList.toggle('still', still);
    if (el.classList.contains('hidden')) { el.classList.remove('hidden'); void el.offsetWidth; }
    el.classList.toggle('on', s.phase !== 'out');
    el.classList.toggle('letter', !!s.letter);
    $('.ss-title').textContent = s.letter ? `A letter · ${s.title}` : s.title;
    const line = s.line;
    $('.ss-bubble').classList.toggle('shown', !!line);
    if (line && line !== shownLine) {
      shownLine = line;
      $('.ss-name').textContent = line.name;
      $('.ss-line').textContent = line.text;
      $('.ss-hint').textContent = s.i < s.lines.length - 1 ? 'Tap to continue' : 'Tap to close';
      const art = speakerArt(line.who), img = $('.ss-portrait img');
      $('.ss-portrait').classList.toggle('none', !art);
      if (art) { img.src = art.src; img.style.filter = art.filter || ''; img.style.objectPosition = art.pos || '50% 20%'; }
      if (!still) { const b = $('.ss-bubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    }
  };
  game.bus.on('storyscene', update);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target.closest('.ss-skip')) game.story.sceneSkip();
    else game.story.sceneNext();
  });
  document.addEventListener('keydown', (e) => {
    if (!game.story?.scene) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); game.story.sceneSkip(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); game.story.sceneNext(); }
  }, true);
}
