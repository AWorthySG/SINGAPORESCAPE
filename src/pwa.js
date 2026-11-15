// Installing the game as an app (a Progressive Web App): registers the service
// worker (sw.js) and keeps the browser's install offer so Settings can show an
// "Install as an app" button. Everything here is guarded: tests and older
// browsers without these APIs simply skip it.

let deferred = null;          // the browser's install offer, kept for later
const listeners = new Set();  // told when the offer appears or is used

export function initPwa() {
  if (typeof window === 'undefined') return;
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // After load, so it never competes with the game's own downloads.
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();   // we show our own button instead of the browser's mini bar
    deferred = e;
    for (const fn of listeners) fn();
  });
  window.addEventListener('appinstalled', () => { deferred = null; for (const fn of listeners) fn(); });
}

/** Running as an installed app already? */
export function isInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
}

/** Can we show the browser's install dialog right now? */
export const canInstall = () => !!deferred;

/** iPhone / iPad Safari: no install dialog, but "Add to Home Screen" works. */
export function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Show the browser's install dialog. Resolves true if the player installed. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred; deferred = null;
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  for (const fn of listeners) fn();
  return choice?.outcome === 'accepted';
}

export function onInstallChange(fn) { listeners.add(fn); }
