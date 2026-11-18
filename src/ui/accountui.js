// The Account window: sign up, log in, log out, recover a password, and choose
// between two saves when the cloud's and this device's have both moved on.
// Opened from the title screen (an "Account" button under Enter) and from
// Settings. Guest play never needs it: without an account the game saves on
// this device as it always has.
//
// It is its own overlay above the title screen (z-index in styles/accounts.css),
// and it keeps every key press to itself so typing a password never moves the
// hero or enters the game. Browser only: main.js and ui.js load it, tests don't.
import { cloud, STATUS_TEXT } from '../game/cloud.js';
import { CLASS_BY_ID } from '../data/classes.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** "3 h 20 min", "45 min", or "not counted yet" for saves from before play time was kept. */
export function playTimeText(ms) {
  if (!ms) return 'not counted yet';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function agoText(ms, now = Date.now()) {
  if (!ms) return 'unknown';
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d} day${d > 1 ? 's' : ''} ago` : new Date(ms).toLocaleDateString();
}

const GUEST_COPY = 'You can play as a guest without an account: your progress saves on this device only. '
  + 'An account keeps a copy in the cloud, so you can carry on from another phone or computer.';

let overlay = null;

function sync() { return cloud(); }

/** Open the window (on the right page for the current state). */
export function openAccount(view) {
  if (typeof document === 'undefined') return;
  const c = sync();
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'acct-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'acct-title');
    overlay.innerHTML = '<div class="acct-card"><button class="acct-x" aria-label="Close" type="button">&#10005;</button><div class="acct-body"></div></div>';
    // Keys typed here belong here: the title screen and the game listen on window.
    overlay.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && !c.choice) closeAccount(); });
    overlay.addEventListener('keyup', (e) => e.stopPropagation());
    overlay.addEventListener('click', (e) => { if (e.target === overlay && !c.choice) closeAccount(); });
    overlay.querySelector('.acct-x').addEventListener('click', () => closeAccount());
    document.body.appendChild(overlay);
  }
  overlay.hidden = false;
  render(view || (c.choice ? 'choose' : c.signedIn ? 'account' : 'home'));
  // Find out (once) whether accounts work here at all, then redraw.
  if (c.available === null && !c.signedIn) c.probe().then(() => { if (!overlay.hidden && overlay.dataset.view === 'home') render('home'); });
}

export function closeAccount() { if (overlay) overlay.hidden = true; }

function render(view, data = {}) {
  const c = sync();
  overlay.dataset.view = view;
  overlay.querySelector('.acct-x').hidden = view === 'choose' || view === 'code';
  const body = overlay.querySelector('.acct-body');
  body.innerHTML = VIEWS[view](c, data);
  wire(body, view, c, data);
  (body.querySelector('[autofocus]') || body.querySelector('input, button'))?.focus();
}

const field = (name, label, type = 'text', extra = '') =>
  `<label class="acct-field"><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`;
const unavailable = (c) => (c.available === false
  ? `<p class="acct-warn">${esc(c.unavailableReason || STATUS_TEXT.unavailable)} Your game still saves on this device.</p>` : '');

function summaryCard(title, s, extra = '') {
  if (!s) return `<div class="acct-save"><h3>${title}</h3><p>No save.</p></div>`;
  const cls = CLASS_BY_ID[s.jobClass]?.name || 'No class yet';
  return `<div class="acct-save"><h3>${title}</h3>
    <p class="acct-save-name">${esc(s.name || 'Unnamed hero')} <small>${esc(cls)}</small></p>
    <dl><dt>Total level</dt><dd>${s.totalLevel || 0}</dd>
    <dt>Quests done</dt><dd>${s.quests || 0}</dd>
    <dt>Time played</dt><dd>${playTimeText(s.playMs)}</dd>
    <dt>Saved</dt><dd>${agoText(s.savedAt)}</dd></dl>${extra}</div>`;
}

const VIEWS = {
  home: (c) => `<h2 id="acct-title">Account</h2>
    <p class="acct-lead">${GUEST_COPY}</p>${unavailable(c)}
    <div class="acct-actions"><button class="acct-primary" data-go="login" ${c.available === false ? 'disabled' : ''}>Log in</button>
    <button data-go="signup" ${c.available === false ? 'disabled' : ''}>Create an account</button></div>
    ${c.available === false ? '' : '<p class="acct-small"><a href="#" data-go="recover">Forgot your password?</a></p>'}
    <p class="acct-small">${c.status === 'signedOut' ? esc(STATUS_TEXT.signedOut) : ''}</p>`,

  login: () => `<h2 id="acct-title">Log in</h2>
    <form class="acct-form" novalidate>
      ${field('username', 'Username', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus')}
      ${field('password', 'Password', 'password', 'autocomplete="current-password" required')}
      <p class="acct-error" role="alert"></p>
      <div class="acct-actions"><button class="acct-primary" type="submit">Log in</button><button type="button" data-go="home">Back</button></div>
    </form>
    <p class="acct-small"><a href="#" data-go="recover">Forgot your password?</a> &middot; <a href="#" data-go="signup">Create an account</a></p>`,

  signup: () => `<h2 id="acct-title">Create an account</h2>
    <p class="acct-lead">Your progress so far comes with you. Guest play stays available: you can log out at any time and keep playing on this device.</p>
    <form class="acct-form" novalidate>
      ${field('username', 'Username <small>(3–20 letters, numbers or _)</small>', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" required autofocus')}
      ${field('password', 'Password <small>(at least 8 characters)</small>', 'password', 'autocomplete="new-password" minlength="8" required')}
      ${field('email', 'Email <small>(optional, only shown to you)</small>', 'email', 'autocomplete="email"')}
      <p class="acct-error" role="alert"></p>
      <div class="acct-actions"><button class="acct-primary" type="submit">Create account</button><button type="button" data-go="home">Back</button></div>
    </form>`,

  recover: () => `<h2 id="acct-title">Reset your password</h2>
    <p class="acct-lead">Enter your username and the recovery code you were given when you signed up, then choose a new password.</p>
    <form class="acct-form" novalidate>
      ${field('username', 'Username', 'text', 'autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus')}
      ${field('code', 'Recovery code', 'text', 'autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required')}
      ${field('password', 'New password <small>(at least 8 characters)</small>', 'password', 'autocomplete="new-password" minlength="8" required')}
      <p class="acct-error" role="alert"></p>
      <div class="acct-actions"><button class="acct-primary" type="submit">Reset password</button><button type="button" data-go="home">Back</button></div>
    </form>`,

  code: (c, d) => `<h2 id="acct-title">Your recovery code</h2>
    <p class="acct-lead">${d.fresh ? 'Your account is ready.' : 'Your password is changed.'} This code is the only way back in if you forget your password. It is shown <b>once</b>: copy it somewhere safe now.</p>
    <div class="acct-code" aria-label="Recovery code">${esc(d.code)}</div>
    <div class="acct-actions"><button data-copy>Copy code</button></div>
    <label class="acct-check"><input type="checkbox" data-kept> I have saved my recovery code</label>
    <div class="acct-actions"><button class="acct-primary" data-done disabled>Continue</button></div>`,

  account: (c) => `<h2 id="acct-title">Account</h2>
    <p class="acct-lead">Signed in as <b>${esc(c.account.username)}</b>${c.account.email ? ` <small>(${esc(c.account.email)})</small>` : ''}.</p>
    <p class="acct-status" data-s="${c.status}">${esc(c.statusText())}</p>
    ${c.last ? `<p class="acct-small">Last cloud save: ${agoText(c.last.savedAt)}</p>` : ''}
    <div class="acct-actions"><button class="acct-primary" data-sync>Save to cloud now</button>
    <button data-logout>Log out</button></div>
    <p class="acct-small">Logging out keeps this device's save, and you carry on as a guest.</p>`,

  choose: (c) => `<h2 id="acct-title">Which save do you want to keep?</h2>
    <p class="acct-lead">This device and your cloud save have both moved on since they last matched. Pick the one to carry on with; the other is replaced.</p>
    <div class="acct-saves">${summaryCard('On this device', c.choice?.local, '<button class="acct-primary" data-keep="device">Keep this device\'s</button>')}
    ${summaryCard('In the cloud', c.choice?.cloud?.summary, '<button class="acct-primary" data-keep="cloud">Keep the cloud\'s</button>')}</div>
    <p class="acct-small">Choosing the cloud's reloads the game; this device's save is kept as a backup in this browser.</p>
    <p class="acct-error" role="alert"></p>`,
};

function wire(body, view, c, data) {
  body.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); render(el.dataset.go); }));
  const form = body.querySelector('form');
  const err = body.querySelector('.acct-error');
  const busy = (on) => body.querySelectorAll('button, input').forEach((el) => { el.disabled = on; });
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (n) => form.elements[n]?.value ?? '';
      // Quick checks here (the server checks again), so mistakes show at once.
      const u = v('username').trim();
      if (view !== 'login' && !/^[a-zA-Z0-9_]{3,20}$/.test(u)) { err.textContent = 'Usernames are 3 to 20 letters, numbers or underscores.'; return; }
      if (view !== 'login' && v('password').length < 8) { err.textContent = 'Passwords need at least 8 characters.'; return; }
      err.textContent = '';
      busy(true);
      const r = view === 'login' ? await c.login(u, v('password'))
        : view === 'signup' ? await c.signup(u, v('password'), v('email').trim())
          : await c.recover(u, v('code'), v('password'));
      busy(false);
      if (!r.ok) { err.textContent = r.error || 'That did not work. Please try again.'; return; }
      if (r.data.recoveryCode) render('code', { code: r.data.recoveryCode, fresh: view === 'signup' });
      else render(c.choice ? 'choose' : 'account');
    });
  }
  if (view === 'code') {
    const done = body.querySelector('[data-done]');
    body.querySelector('[data-kept]').addEventListener('change', (e) => { done.disabled = !e.target.checked; });
    body.querySelector('[data-copy]').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(data.code); e.target.textContent = 'Copied ✓'; } catch {
        // No clipboard access: select the code so it can be copied by hand.
        const sel = getSelection(); const r = document.createRange(); r.selectNodeContents(body.querySelector('.acct-code')); sel.removeAllRanges(); sel.addRange(r);
        e.target.textContent = 'Select and copy it';
      }
    });
    done.addEventListener('click', () => render(c.choice ? 'choose' : 'account'));
  }
  if (view === 'account') {
    body.querySelector('[data-sync]').addEventListener('click', async () => { busy(true); await c.uploadNow(); render(c.choice ? 'choose' : 'account'); });
    body.querySelector('[data-logout]').addEventListener('click', () => { c.logout(); render('home'); });
  }
  if (view === 'choose') {
    body.querySelectorAll('[data-keep]').forEach((b) => b.addEventListener('click', async () => {
      busy(true);
      const ok = b.dataset.keep === 'cloud' ? await c.takeCloud() : await c.keepDevice();
      busy(false);
      if (c.choice) return;   // still to choose (a fresh conflict): the listener redraws
      if (!ok && err) { err.textContent = c.statusText(); return; }
      render('account');
    }));
  }
}

// ---------------- Entry points ----------------
/** The title screen's "Account" button and status line, under Enter. */
export function mountTitleAccount(splash) {
  const enter = splash?.querySelector('#splash-enter');
  if (!enter || splash.querySelector('#splash-account')) return;
  const box = document.createElement('div');
  box.className = 'splash-account';
  box.innerHTML = '<button id="splash-account" type="button">Account</button><span class="sa-status" aria-live="polite"></span>';
  enter.insertAdjacentElement('afterend', box);
  const btn = box.querySelector('button'), st = box.querySelector('.sa-status');
  btn.addEventListener('click', (e) => { e.stopPropagation(); openAccount(); });
  const show = (c) => {
    btn.textContent = c.signedIn ? `Account: ${c.account.username}` : 'Account / cloud save';
    st.textContent = c.signedIn ? c.statusText() : 'Playing as a guest: saved on this device';
    st.dataset.s = c.status;
  };
  sync().onChange(show);
  show(sync());
}

/** The Account section in Settings (ui.js hands over an empty element). */
export function accountSettings(el) {
  if (!el) return;
  el.className = 'set-account';
  el.innerHTML = '<div class="set-section">Account</div><button type="button" class="acct-open"></button><p class="hint acct-hint"></p>';
  const btn = el.querySelector('button'), hint = el.querySelector('.acct-hint');
  btn.addEventListener('click', () => openAccount());
  const show = (c) => {
    if (!el.isConnected && el.dataset.drawn) { off(); return; }
    el.dataset.drawn = '1';
    btn.textContent = c.signedIn ? `Account: ${c.account.username}` : 'Log in / create account';
    hint.textContent = c.signedIn ? c.statusText() : 'Guest play: your progress saves on this device only.';
  };
  const off = sync().onChange(show);
  show(sync());
}

/** A small note that fades in when cloud saving changes state while playing. */
export function mountCloudToast() {
  const t = document.createElement('div');
  t.id = 'cloud-toast';
  t.setAttribute('aria-live', 'polite');
  document.body.appendChild(t);
  let hide = 0, prev = sync().status;
  sync().onChange((c) => {
    // The window is open: it shows the state itself. A conflict opens it.
    if (c.status === 'conflict' && c.choice) { openAccount('choose'); return; }
    if (overlay && !overlay.hidden) { if (overlay.dataset.view === 'account') render('account'); return; }
    const was = prev; prev = c.status;
    // Only the changes worth a glance: first save, going offline, coming back, signed out.
    const worth = (c.status === 'synced' && was !== 'synced') || c.status === 'offline' || c.status === 'signedOut' || c.status === 'error';
    if (!worth || was === c.status) return;
    t.textContent = c.statusText();
    t.dataset.s = c.status;
    t.classList.add('show');
    clearTimeout(hide);
    hide = setTimeout(() => t.classList.remove('show'), 3200);
  });
}

/** Everything at once, from main.js once the UI is up. */
export function initAccountUi(splash) {
  mountTitleAccount(splash);
  mountCloudToast();
  // A choice waiting from boot (both saves changed): ask now.
  if (sync().choice) openAccount('choose');
}
