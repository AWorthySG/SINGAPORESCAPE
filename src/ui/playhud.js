// The Focus bar, the Rested tag and the Grave button (see game/playbalance.js),
// tucked into the card of auto switches (Battle / Gather / Quest). Kept out of
// ui.js, which only creates this. Tapping Focus or Rested explains it in the
// chat (phones have no hover tooltips); the Grave button offers to fetch your
// gravestone's goods for a fee.

import * as Play from '../game/playbalance.js';
import { TICK_MS } from '../config.js';
import { uiIconHTML, playIconHTML } from '../render/icons.js';

export class PlayHud {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this._sig = '';
    this.game.bus.on('tick', () => this.render());
    this.game.bus.on('play', () => this.render());
  }

  _panel() {
    if (this.el || typeof document === 'undefined') return this.el;
    const row = document.getElementById('auto-row');
    if (!row) return null;
    const el = document.createElement('div');
    el.id = 'play-hud';
    el.innerHTML = `<button class="ph-focus" type="button">${playIconHTML('ui-focus', 16)}<span class="ph-label">Focus</span><span class="ph-bar"><i></i></span></button>`
      + `<button class="ph-rested hidden" type="button">${playIconHTML('ui-rested', 16)}Rested</button>`
      + `<button class="ph-grave hidden" type="button">${playIconHTML('ui-grave', 16)}<span class="ph-grave-t"></span></button>`;
    el.querySelector('.ph-focus').addEventListener('click', () => this.game.msg(this.focusTip(), 'system'));
    el.querySelector('.ph-rested').addEventListener('click', () => this.game.msg(this.restedTip(), 'system'));
    el.querySelector('.ph-grave').addEventListener('click', () => this.openGrave());
    const cfg = document.getElementById('auto-battle-cfg');
    if (cfg) row.insertBefore(el, cfg); else row.appendChild(el);
    this.el = el;
    return el;
  }

  focusTip() {
    const pl = this.game.play;
    return `Focus: ${Play.fmtMs(pl.focus)} of automatic play left at full rewards. Auto battle and auto gather use it up; `
      + `playing by hand (clicking, steering, the action keys) refills it ${Play.FOCUS_ACTIVE_REFILL} times as fast, and it slowly comes back by itself, even while you're away. `
      + `With no Focus left, automatic play keeps going but earns ${Math.round(Play.TIRED_MULT * 100)}% XP and loot.`;
  }

  restedTip() {
    const pl = this.game.play;
    return `Rested: +${Math.round((Play.RESTED_MULT - 1) * 100)}% XP on everything for your next ${Play.fmtMs(pl.rested)} of play `
      + '(it stacks with golden hours). Time away from the game builds it, up to 8 hours away.';
  }

  render() {
    const pl = this.game.play, el = this._panel();
    if (!el || !pl) return;
    const share = Play.focusShare(this.game);
    const g = pl.grave;
    const graveText = g ? `Grave ${Play.fmtMs(g.left * TICK_MS)}` : '';
    const sig = `${Math.round(share * 200)}|${pl.tired}|${pl.rested > 0}|${graveText}|${Math.floor(pl.focus / 60000)}|${Math.floor(pl.rested / 60000)}`;
    if (sig === this._sig) return;
    this._sig = sig;
    const f = el.querySelector('.ph-focus');
    f.querySelector('i').style.width = `${(share * 100).toFixed(1)}%`;
    f.classList.toggle('low', share < 0.15);
    f.classList.toggle('tired', !!pl.tired);
    f.title = this.focusTip();
    f.setAttribute('aria-label', `Focus ${Math.round(share * 100)}%`);
    const r = el.querySelector('.ph-rested');
    r.classList.toggle('hidden', !(pl.rested > 0));
    r.title = pl.rested > 0 ? this.restedTip() : '';
    const gb = el.querySelector('.ph-grave');
    gb.classList.toggle('hidden', !g);
    gb.querySelector('.ph-grave-t').textContent = graveText;
    gb.title = g ? `Your gravestone holds ${Play.graveSummary(g)}. Walk back to it, or tap to have it brought to you for ${Play.graveFee(this.game)} coins.` : '';
  }

  openGrave() {
    const g = this.game.play?.grave;
    if (!g) return;
    const fee = Play.graveFee(this.game);
    this.ui.openModal('Gravestone', (body) => {
      body.innerHTML = '<div class="dialogue"><div class="speaker">Gravedigger</div>'
        + `Your gravestone holds ${Play.graveSummary(g)}. Walk back to it within ${Play.fmtMs(g.left * TICK_MS)} to take it all back for free, `
        + `or I can fetch it for you now for <b>${fee}</b> coins (taken from the gravestone's coins first, then your pack, then your bank). Or teleport straight to it from the Grave button.</div>`;
      const opts = document.createElement('div');
      opts.className = 'dialogue-options';
      const go = document.createElement('div');
      go.className = 'dialogue-option';
      go.textContent = `Pay ${fee} coins`;
      go.addEventListener('click', () => { this.ui.closeModal(); Play.buyBackGrave(this.game); });
      // Or teleport back to it for free (teleports.js, R).
      const tp = document.createElement('div');
      tp.className = 'dialogue-option';
      tp.innerHTML = `${uiIconHTML('teleport-grave', 20, 'dlg-ic')}Teleport to it (R)`;
      tp.addEventListener('click', () => { this.ui.closeModal(); this.game.teleports?.start('grave'); });
      const no = document.createElement('div');
      no.className = 'dialogue-option';
      no.textContent = 'I\'ll walk back';
      no.addEventListener('click', () => this.ui.closeModal());
      opts.append(go, tp, no);
      body.appendChild(opts);
    });
  }
}
