// The bits of UI for world events and weekly region challenges
// (src/game/worldevents.js): a card in the quest journal (the running event
// with a Go button, and the week's three tasks), a row in the objectives
// tracker, and the marker on the minimap. ui.js only calls in here; the
// HTML builders return plain strings so the tests can render them headlessly.
import { EVENT_KINDS } from '../data/worldevents.js';
import { playIconHTML, EVENT_ICON } from '../render/icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pctOf = (a, b) => (b ? Math.max(0, Math.min(100, Math.floor((a / b) * 100))) : 0);
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The quest journal's world event and weekly challenge cards (a string). */
export function eventsPanelHTML(game) {
  const we = game.worldEvents;
  if (!we) return '';
  we.ensureWeek();
  let html = '';
  const ev = we.active;
  if (ev) {
    const k = EVENT_KINDS[ev.kind];
    html += `<div class="quest-head">World event &middot; ${clock(we.secondsLeft())} left</div>`
      + `<div class="quest-row we-row can-go" style="--we-col:${k.colour}"><div class="q-top"><b>${playIconHTML(EVENT_ICON[ev.kind], 20)} ${esc(ev.name)}</b>`
      + `<span class="q-chip active">${esc(we.progressText())}</span></div>`
      + `<span class="q-desc">${esc(k.blurb(ev))}</span>`
      + `<div class="q-foot"><span class="q-next">&#10148; ${esc(ev.place)}</span><button class="q-go we-go" title="Travel to the event">Go</button></div></div>`;
  }
  const tasks = we.weeklyTasks();
  if (tasks.length) {
    const w = we.weekly;
    html += `<div class="quest-head">${playIconHTML('event-weekly_crate', 18)} Weekly challenge &middot; ${esc(w.region)}${w.claimed ? ' &middot; complete' : ''}</div>`;
    for (const t of tasks) {
      html += `<div class="quest-row bounty-row we-task${t.done ? ' done' : ''}"><div class="q-top"><b>${esc(t.text)}</b>`
        + `<span class="q-chip ${t.done ? 'done' : t.have > 0 ? 'active' : 'todo'}">${t.done ? 'Done' : `${t.have}/${t.need}`}</span></div>`
        + `<div class="bounty-bar"><i style="width:${pctOf(t.have, t.need)}%"></i></div></div>`;
    }
    html += `<div class="modal-hint">A new region every week. Finish all three tasks for a reward crate.${we.done ? ` World events finished: ${we.done}.` : ''}</div>`;
  }
  return html;
}

/** Hook up the journal card's Go button (after the panel's HTML is in). */
export function wireEventsPanel(ui, root) {
  const go = root?.querySelector?.('.we-row');
  if (!go) return;
  go.addEventListener('click', (e) => { e.stopPropagation(); ui.game.worldEvents.travel(); ui.renderQuestPanel(); });
}

/** Tracker rows: the running event, its progress and time left, and a pointer to it. */
export function eventTrackerRows(ui) {
  const g = ui.game, we = g.worldEvents, rows = [];
  const ev = we?.active;
  if (ev) {
    const k = EVENT_KINDS[ev.kind], p = g.player;
    const d = Math.hypot(ev.x - p.x, ev.y - p.y);
    const deg = Math.round(Math.atan2(ev.y - p.y, ev.x - p.x) * 180 / Math.PI);
    const ptr = d <= 6 ? '<span class="trk-dist here">here</span>'
      : `<span class="trk-arrow" style="transform:rotate(${deg}deg)">&#10148;</span><span class="trk-dist">${Math.round(d)}m</span>`;
    rows.push(`<div class="trk-row trk-event"><span class="trk-ic" style="color:${k.colour}">${playIconHTML(EVENT_ICON[ev.kind], 16)}</span>${esc(ev.name)} `
      + `<span class="trk-prog">${esc(we.progressText())} &middot; ${clock(we.secondsLeft())}</span>${ptr}</div>`);
  }
  return rows;
}

/** The event's marker on the minimap: a pulsing ring where it is, or a small
 *  arrow on the rim pointing the way when it's off the edge. */
export function drawEventMarker(ctx, game, W, H, px, py, radius, scale) {
  const ev = game.worldEvents?.active;
  if (!ev) return;
  const col = EVENT_KINDS[ev.kind].colour;
  const dx = ev.x - px, dy = ev.y - py;
  const pulse = game.reduceMotion ? 0.5 : (Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 220) + 1) / 2;
  ctx.save();
  if (Math.abs(dx) <= radius - 2 && Math.abs(dy) <= radius - 2) {
    const x = W / 2 + dx * scale, y = H / 2 + dy * scale;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 5 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = col; ctx.strokeStyle = '#22304a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    const a = Math.atan2(dy, dx), r = W / 2 - 7;
    ctx.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    ctx.rotate(a);
    ctx.fillStyle = col; ctx.strokeStyle = '#22304a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
