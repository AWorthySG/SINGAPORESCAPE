// Postcard mode: snap the world as a postcard to keep or share.
//
// A little camera button sits on the minimap (and the O key works too).
// Pressing it hides the HUD and shows a postcard-shaped viewfinder over the
// live world, so the player can walk into a nicer spot; the shutter then frames
// that view as a postcard (render/postcard.js: "Greetings from <region>", the
// stamp, the game's name and where to play it) and offers Save (a PNG
// download) and Share (the phone's own share sheet, with the picture where the
// browser can send files). Every shared postcard carries the website, so it
// doubles as an advert for the game.
//
// Browser only (main.js calls initPhotoMode); the pure helpers below are what
// the tests drive.
import { composePostcard, photoPostcardSize } from '../render/postcard.js';
import { fxImage, badgeKey } from '../render/fxart.js';
import { postcardLine, SITE_URL, TAGLINE } from '../data/postcards.js';

/** "a-worthy-postcard-kampong-glam.png" */
export const postcardFileName = (region) =>
  `a-worthy-postcard-${String(region || 'singapore').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

/** The words that go with a shared postcard. */
export const shareText = (region) => `Greetings from ${region || 'Singapore'}! ${TAGLINE} – play free at https://${SITE_URL}`;

/** A postcard date, the way a Singapore post office stamps it: "19 NOV 2026". */
export function postmarkDate(d = new Date()) {
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

/**
 * Paint the postcard for `game`'s current view onto a fresh canvas made by
 * `makeCanvas(w, h)`. Returns the canvas, or null when there is no 2D context.
 */
export function buildPostcard(game, photo, makeCanvas, { vw = 1600, vh = 1000, logo = null, date = postmarkDate() } = {}) {
  const { w, h } = photoPostcardSize(vw, vh);
  const cv = makeCanvas(w, h);
  const g = cv && cv.getContext && cv.getContext('2d');
  if (!g) return null;
  const region = game.currentZoneName || 'Singapore';
  composePostcard(g, w, h, {
    photo, region, line: postcardLine(region), badge: fxImage(badgeKey(region)), logo, date,
    name: game.player && game.player.name, url: SITE_URL, tagline: TAGLINE,
  });
  return cv;
}

const CAMERA_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.2-1.8h5.4L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="#fff" stroke="#22304A" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12.4" r="3.6" fill="#7FC4D8" stroke="#22304A" stroke-width="1.8"/><circle cx="17" cy="9" r="1" fill="#E0533D"/></svg>';

export class PhotoMode {
  constructor(game, canvas) {
    this.game = game; this.canvas = canvas;
    this.state = 'off';   // off | framing | preview
    this.blob = null; this.url = null;
    this.logo = null;
    if (typeof Image === 'function') { this.logo = new Image(); this.logo.src = 'assets/mascot-login.webp'; }
    this._build();
  }

  _build() {
    const btn = document.createElement('button');
    btn.id = 'photo-btn';
    btn.type = 'button';
    btn.title = 'Postcard mode: snap and share this view (O)';
    btn.setAttribute('aria-label', 'Postcard mode');
    btn.innerHTML = CAMERA_SVG;
    btn.addEventListener('click', () => this.open());
    (document.getElementById('minimap-panel') || document.getElementById('game-root') || document.body).appendChild(btn);
    this.btn = btn;

    const el = document.createElement('div');
    el.id = 'photo-mode';
    el.className = 'hidden';
    el.innerHTML = `
      <div class="pm-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="pm-flash" aria-hidden="true"></div>
      <div class="pm-bar pm-framing">
        <p class="pm-hint">Find a nice spot, then snap your postcard!</p>
        <div class="pm-row">
          <button type="button" class="pm-btn pm-close">Back to game</button>
          <button type="button" class="pm-btn pm-shutter" aria-label="Take postcard">${CAMERA_SVG} Snap!</button>
        </div>
      </div>
      <div class="pm-preview" role="dialog" aria-label="Your postcard">
        <img class="pm-img" alt="Your postcard" />
        <div class="pm-row">
          <button type="button" class="pm-btn pm-retake">Retake</button>
          <button type="button" class="pm-btn pm-save">Save postcard</button>
          <button type="button" class="pm-btn pm-share hidden">Share</button>
        </div>
        <button type="button" class="pm-x" aria-label="Close">&times;</button>
      </div>`;
    document.body.appendChild(el);
    this.el = el;
    const on = (sel, fn) => el.querySelector(sel).addEventListener('click', fn);
    on('.pm-close', () => this.close());
    on('.pm-x', () => this.close());
    on('.pm-shutter', () => this.snap());
    on('.pm-retake', () => this.frame());
    on('.pm-save', () => this.save());
    on('.pm-share', () => this.share());
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.body.classList.contains('title-on')) return;
      if (e.key === 'Escape' && this.state !== 'off') { e.stopPropagation(); this.close(); }
      else if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey) { if (this.state === 'off') this.open(); else if (this.state === 'framing') this.snap(); }
    }, true);
  }

  open() { this.frame(); }

  frame() {
    this.state = 'framing';
    document.body.classList.add('photo-on');
    this.el.classList.remove('hidden', 'previewing');
    this.el.classList.add('framing');
  }

  close() {
    this.state = 'off';
    document.body.classList.remove('photo-on');
    this.el.classList.add('hidden');
    this.el.classList.remove('framing', 'previewing');
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
    this.blob = null;
  }

  snap() {
    const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const cv = buildPostcard(this.game, this.canvas, make, { vw: window.innerWidth, vh: window.innerHeight, logo: this.logo && this.logo.complete && this.logo.naturalWidth ? this.logo : null });
    if (!cv) return;
    this.el.classList.remove('flashing'); void this.el.offsetWidth; this.el.classList.add('flashing');
    this.game.audio?.play?.('pickup');   // a little shutter click
    const done = (blob) => {
      if (!blob) return;
      this.blob = blob;
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = URL.createObjectURL(blob);
      this.el.querySelector('.pm-img').src = this.url;
      this.state = 'preview';
      this.el.classList.remove('framing');
      this.el.classList.add('previewing');
      const share = this.el.querySelector('.pm-share');
      share.classList.toggle('hidden', !this._canShare());
    };
    if (cv.toBlob) cv.toBlob(done, 'image/png'); else done(null);
  }

  _file() {
    try { return new File([this.blob], postcardFileName(this.game.currentZoneName), { type: 'image/png' }); } catch { return null; }
  }

  _canShare() {
    if (!navigator.share) return false;
    const f = this._file();
    try { return !!(f && navigator.canShare && navigator.canShare({ files: [f] })) || !navigator.canShare; } catch { return false; }
  }

  save() {
    if (!this.url) return;
    const a = document.createElement('a');
    a.href = this.url; a.download = postcardFileName(this.game.currentZoneName);
    document.body.appendChild(a); a.click(); a.remove();
    this.game.msg?.('Postcard saved! Share it with your kakis.');
  }

  async share() {
    const region = this.game.currentZoneName;
    const data = { title: 'A-Worthy Adventure', text: shareText(region), url: `https://${SITE_URL}` };
    const f = this._file();
    try {
      if (f && navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ ...data, files: [f] });
      else await navigator.share(data);
    } catch { /* the player closed the share sheet */ }
  }
}

/** Put the camera button on the HUD (browser only). */
export function initPhotoMode(game, canvas) {
  if (typeof document === 'undefined') return null;
  try { return new PhotoMode(game, canvas); } catch (e) { console.error(e); return null; }
}
