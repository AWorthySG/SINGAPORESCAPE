// Real place coordinates for the Singapore atlas. Each place points to the
// corresponding in-game MRT station when the player switches to tile travel.
import { STATION_BY_ID } from '../data/transport.js';

export const ATLAS_PLACES = [
  { id: 'kampong_glam', lon: 103.859, lat: 1.302, label: 'Kampong Glam', side: 'top' },
  { id: 'chinatown', lon: 103.844, lat: 1.282, label: 'Chinatown', side: 'left' },
  { id: 'marina_bay', lon: 103.861, lat: 1.283, label: 'Marina Bay', side: 'right' },
  { id: 'sentosa', lon: 103.826, lat: 1.249, label: 'Sentosa', side: 'left' },
  { id: 'southern_islands', lon: 103.848, lat: 1.219, label: "St John's Island", side: 'bottom' },
  { id: 'bukit_timah', lon: 103.777, lat: 1.354, label: 'Bukit Timah', side: 'left' },
  { id: 'macritchie', lon: 103.819, lat: 1.344, label: 'MacRitchie', side: 'right' },
  { id: 'sungei_buloh', lon: 103.731, lat: 1.446, label: 'Sungei Buloh', side: 'top' },
  { id: 'mandai', lon: 103.787, lat: 1.405, label: 'Mandai', side: 'right' },
  { id: 'transit_road', lon: 103.815, lat: 1.411, label: 'Transit Road', side: 'top' },
  { id: 'punggol', lon: 103.911, lat: 1.420, label: 'Punggol', side: 'left' },
  { id: 'pulau_ubin', lon: 103.961, lat: 1.409, label: 'Pulau Ubin', side: 'top' },
  { id: 'changi', lon: 104.005, lat: 1.368, label: 'Changi Coast', side: 'bottom' },
  { id: 'tuas', lon: 103.635, lat: 1.324, label: 'Tuas', side: 'bottom' },
];

// Matches the north-up, 1200 × 800 atlas image in assets/maps.
export function atlasPoint({ lon, lat }) {
  return { left: 100 * (lon - 103.57) / 0.56, top: 150 * (1.492 - lat) / 0.56 };
}

export function atlasDestination(place) {
  const station = STATION_BY_ID[place.id];
  return { x: station.x, y: station.y, label: `${station.name} MRT`, station };
}

export function renderSingaporeAtlas(parent, currentZone, onTerrain) {
  const atlas = document.createElement('div');
  atlas.className = 'atlas';
  atlas.innerHTML = `
    <div class="atlas-map" role="group" aria-label="Geographic map of Singapore">
      <img src="assets/maps/singapore-atlas.webp" alt="Singapore's coastline, Pulau Ubin, Pulau Tekong and the Southern Islands" width="1200" height="800" />
      <span class="atlas-north" aria-hidden="true">N</span>
      <span class="atlas-tekong" aria-hidden="true">Pulau Tekong</span>
      <span class="atlas-strait" aria-hidden="true">Singapore Strait</span>
    </div>
    <div class="atlas-destination">
      <label>Destination <select></select></label>
      <button class="wm-go" type="button">Show on terrain</button>
    </div>
    <p class="atlas-credit">Coastline adapted from URA’s
      <a href="https://data.gov.sg/datasets/d_4765db0e87b9c86336792efe8a1f7a66/view" target="_blank" rel="noopener">Master Plan 2019 Planning Area Boundary (No Sea)</a>,
      accessed 28 November 2026 under the
      <a href="https://data.gov.sg/open-data-licence" target="_blank" rel="noopener">Singapore Open Data Licence</a>.
    </p>`;
  const map = atlas.querySelector('.atlas-map');
  const select = atlas.querySelector('select');
  const pins = new Map();
  let place = ATLAS_PLACES.find((p) => p.label === currentZone || STATION_BY_ID[p.id].name === currentZone) || ATLAS_PLACES[0];
  for (const p of ATLAS_PLACES) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'atlas-pin';
    pin.dataset.side = p.side;
    pin.setAttribute('aria-label', p.label);
    const { left, top } = atlasPoint(p);
    pin.style.left = `${left}%`;
    pin.style.top = `${top}%`;
    const label = document.createElement('span');
    label.textContent = p.label;
    pin.appendChild(label);
    pin.addEventListener('click', () => choose(p));
    map.appendChild(pin);
    pins.set(p.id, pin);
    select.add(new Option(p.label, p.id));
  }
  function choose(next) {
    pins.get(place.id).setAttribute('aria-pressed', 'false');
    place = next;
    pins.get(place.id).setAttribute('aria-pressed', 'true');
    select.value = place.id;
  }
  for (const pin of pins.values()) pin.setAttribute('aria-pressed', 'false');
  choose(place);
  select.addEventListener('change', () => choose(ATLAS_PLACES.find((p) => p.id === select.value)));
  atlas.querySelector('.wm-go').addEventListener('click', () => onTerrain(atlasDestination(place)));
  parent.appendChild(atlas);
}
