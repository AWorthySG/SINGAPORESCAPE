// Curator Siti's museum (Archaeology): what each collection set holds, what
// you have given, what you carry that a set still wants, and one button that
// gives it all. A finished set pays coins and XP, earns its Collection log
// title and makes relics a little likelier (src/game/archaeology.js). Uses the
// skill guide's card styles, one card a set: two wide on a big screen, one on a phone.
import { getItem } from '../data/items.js';
import { itemIconSVG } from '../render/icons.js';
import { museumSets, donateAll, setsDone } from '../game/archaeology.js';
import { MUSEUM_SETS, RELIC_SET_BONUS } from '../data/archaeology.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One set's card: its three pieces (given, in your pack, or still to find). */
export function museumSetHTML(st) {
  const m = st.set;
  const piece = (id) => {
    const got = st.got.includes(id), have = st.have.includes(id);
    const tag = got ? '&#10003; on show' : have ? 'in your pack' : 'still to find';
    return `<span class="sgx-give${got ? '' : have ? '' : ' rare'}" title="${esc(getItem(id).name)}: ${tag}">`
      + `<span class="mu-ic${got ? ' got' : have ? ' have' : ' miss'}">${itemIconSVG(id, 26)}</span><i>${tag}</i></span>`;
  };
  return `<div class="sgx-spot mu-set${st.done ? ' done' : ''}">`
    + `<span class="sgx-spot-txt"><b>${esc(m.name)}${st.done ? ' &#10003;' : ''}</b>`
    + `<small>${st.got.length} of ${m.items.length} on show · Archaeology ${m.level} · title "${esc(m.title)}"</small>`
    + `<span class="sgx-gives">${m.items.map(piece).join('')}</span>`
    + `<small>${st.done ? 'Complete!' : `Finish it for ${m.coins.toLocaleString('en-GB')} coins and ${m.xp.toLocaleString('en-GB')} XP`}</small></span></div>`;
}

/** The whole window's body (no DOM: the tests read it). */
export function museumHTML(game) {
  const sets = museumSets(game);
  const giveable = sets.reduce((n, s) => n + s.have.length, 0), done = setsDone(game);
  return `<div class="dialogue"><div class="speaker">Curator Siti</div>`
    + `${giveable ? `Ooh, you've brought me something! ${giveable === 1 ? 'One piece' : `${giveable} pieces`} for the cases. Can I put ${giveable === 1 ? 'it' : 'them'} on show?`
      : 'Welcome to the little museum, lah! Dig at the heritage sites, clean what you find at the bench beside me, then bring me the restored pieces.'}</div>`
    + `<div class="modal-hint">${done} of ${MUSEUM_SETS.length} sets complete. Each finished set makes relics ${Math.round(RELIC_SET_BONUS * 100)}% likelier (of the chance) wherever you dig.</div>`
    + (giveable ? `<button type="button" class="wm-go mu-give" data-give="1">Give ${giveable === 1 ? 'it' : `all ${giveable}`}</button>` : '')
    + `<div class="sgx-spots mu-sets">${sets.map(museumSetHTML).join('')}</div>`;
}

export function openMuseum(ui, npc = null) {
  const g = ui.game;
  const render = (body) => {
    body.innerHTML = museumHTML(g);
    body.querySelector('[data-give]')?.addEventListener('click', () => { donateAll(g); render(body); });
    const opts = document.createElement('div');
    opts.className = 'dialogue-options';
    const bye = document.createElement('div');
    bye.className = 'dialogue-option'; bye.textContent = 'Goodbye';
    bye.addEventListener('click', () => ui.closeModal());
    opts.appendChild(bye);
    body.appendChild(opts);
  };
  ui.openModal(npc?.name ? `${npc.name}'s museum` : 'The museum', render);
  ui.modal.kind = 'museum';
}
