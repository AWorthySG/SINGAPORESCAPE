import { SAVE_KEY } from '../config.js';
import { hasSave, importSaveCode } from './save.js';

// Moving house: the game used to run inside a-worthy.com (a-worthy.com/aworthyadventure/),
// where each browser kept its save. For safety it now runs only on its own address,
// and that old page hands any save it finds over in the link
// (…/SINGAPORESCAPE/#transfer=<save code>). This picks it up before the game loads.
// A save is only ever brought over once (its code's checksum is remembered), and a
// player who already has a game here is asked first; their current save is kept as
// the usual import backup either way.

const DONE_KEY = SAVE_KEY + ':transfers';

function doneList() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; }
}
function markDone(sum) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...doneList(), sum].slice(-20))); } catch { /* storage blocked: nothing to remember */ }
}

/** Returns true when a transferred save was imported and the page is reloading into it. */
export function receiveTransfer(loc = globalThis.location, ask = (m) => globalThis.confirm?.(m)) {
  const m = /^#transfer=(.+)$/.exec(loc?.hash || '');
  if (!m) return false;
  // Take the code out of the address bar straight away (it is long, and a bookmark
  // or shared link should not carry it).
  try { globalThis.history?.replaceState(null, '', loc.pathname + loc.search); } catch { /* ignore */ }
  let code;
  try { code = decodeURIComponent(m[1]); } catch { return false; }
  const sum = code.slice(code.lastIndexOf(':') + 1);
  if (!sum || doneList().includes(sum)) return false;   // already brought over once
  if (hasSave() && !ask('You have A-Worthy Adventure progress saved at a-worthy.com. Bring it over and play it here?\n\n'
    + 'Your current progress on this page is kept as a backup.')) {
    markDone(sum);
    return false;
  }
  const r = importSaveCode(code);
  markDone(sum);
  if (!r.ok) { console.warn('Save transfer failed:', r.error); return false; }
  try { loc.reload(); } catch { /* tests */ }
  return true;
}
