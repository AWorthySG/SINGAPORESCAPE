// The Endless Gate's screens (see game/waves.js): the gate's "enter?" panel,
// which shows your best wave, and a small HUD panel while a run is on: the
// wave, monsters left, the countdown to the next wave, your best and a Leave
// button. Kept out of ui.js, which only creates this and forwards to it.

import { GATE_NAME, BOSS_EVERY, CHAMPION_EVERY, waveLevel } from '../game/waves.js';

export class WaveHud {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    this._last = '';
    this.game.bus.on('tick', () => this.render());
    this.game.bus.on('waves', () => this.render());
  }

  /** The panel, made on first use and parked in the game root. */
  _panel() {
    if (this.el || typeof document === 'undefined') return this.el;
    const root = document.getElementById('game-root');
    if (!root) return null;
    const el = document.createElement('div');
    el.id = 'wave-hud';
    el.className = 'hidden';
    el.innerHTML = `<div class="wv-title">${GATE_NAME}</div><div class="wv-body"></div>`
      + '<button class="wv-leave" title="Leave the Endless Gate and go back to where you came in">Leave</button>';
    el.querySelector('.wv-leave').addEventListener('click', () => this.game.waves.leave());
    root.appendChild(el);
    this.el = el;
    return el;
  }

  render() {
    const w = this.game.waves, el = this._panel();
    if (!el) return;
    if (!w?.active) { el.classList.add('hidden'); this._last = ''; return; }
    el.classList.remove('hidden');
    const cd = w.countdown();
    const next = w.wave + 1;
    const rows = [
      `<div class="wv-wave">${w.wave ? `Wave <b>${w.wave}</b>` : 'Get ready'}${w.wave && w.wave % BOSS_EVERY === 0 ? ' <span class="wv-tag">boss</span>' : ''}</div>`,
      cd ? `<div class="wv-next">${next % BOSS_EVERY === 0 ? 'Boss wave' : `Wave ${next}`} in <b>${cd}s</b></div>`
        : `<div class="wv-left">Monsters left: <b>${w.left()}</b>${w.level ? ` <span class="wv-dim">(level ${w.level})</span>` : ''}</div>`,
      `<div class="wv-best">Best: wave <b>${w.best || 0}</b></div>`,
    ];
    const html = rows.join('');
    if (html !== this._last) { el.querySelector('.wv-body').innerHTML = html; this._last = html; }
  }

  /** The gate: what lies beyond, your best wave, and Enter. */
  openGate() {
    const g = this.game, w = g.waves;
    const lvl = g.fightLevel();
    this.ui.openModal(GATE_NAME, (body) => {
      body.innerHTML = `<div class="dialogue"><div class="speaker">${GATE_NAME}</div>`
        + 'Beyond the arch lies a sealed hall where monsters come in endless waves, each stronger than the last. '
        + `Every ${CHAMPION_EVERY}th wave brings a champion and every ${BOSS_EVERY}th a boss. Clearing a wave pays a bonus that grows the deeper you go. `
        + 'If you fall, you keep everything you earned and wake back here.</div>'
        + `<div class="modal-hint">Your best: <b>${w.best ? `wave ${w.best}` : 'not yet tried'}</b> &middot; Wave 1 for you: level ${waveLevel(1, lvl)} monsters</div>`;
      const opts = document.createElement('div');
      opts.className = 'dialogue-options';
      const go = document.createElement('div');
      go.className = 'dialogue-option';
      go.textContent = 'Enter the Endless Gate';
      go.addEventListener('click', () => { this.ui.closeModal(); w.enter(); });
      const no = document.createElement('div');
      no.className = 'dialogue-option';
      no.textContent = 'Not now';
      no.addEventListener('click', () => this.ui.closeModal());
      opts.append(go, no);
      body.appendChild(opts);
    });
    this.ui.modal.kind = 'waveGate';
  }
}
