import { GEOGRAPHIC_PLACES, GEOGRAPHIC_PLACE_BY_ID } from '../data/geography.js';
import { STATION_BY_ID } from '../data/transport.js';

export const ATLAS_PLACES = GEOGRAPHIC_PLACES.filter((place) => place.kind !== 'fictional');
const fantasyPlaces = GEOGRAPHIC_PLACES.filter((place) => place.kind === 'fictional');
const accessOf = (place) => place.access || (place.stationId ? 'mrt' : 'walk');

// A closer look at a landmark in the game, drawn from the existing place and world art.
export const ATLAS_INSETS = {
  kampong_glam: { art: 'world/obj-golden_dome_hall.webp', caption: 'Golden-domed hall' },
  chinatown: { art: 'world/obj-chinese_temple.webp', caption: 'Chinatown temple' },
  marina_bay: { art: 'world/obj-observation_wheel.webp', caption: 'Observation wheel' },
  gardens: { art: 'world/obj-flower_dome.webp', caption: 'Flower Dome' },
  macritchie: { art: 'places/macritchie.webp', caption: 'Reservoir canopy', scene: true },
  sungei_buloh: { art: 'postcards/island-wetlands.webp', caption: 'Wetland boardwalk', scene: true },
  transit_road: { art: 'places/transit-road.webp', caption: 'Transit Road at dusk', scene: true },
  punggol: { art: 'world/obj-punggol_footbridge.webp', caption: 'Waterway footbridge' },
  pulau_ubin: { art: 'postcards/island-ubin.webp', caption: 'Pulau Ubin landing', scene: true },
};

// Matches the north-up, 1200 × 800 atlas image in assets/maps.
export function atlasPoint({ lon, lat }) {
  return { left: 100 * (lon - 103.57) / 0.56, top: 150 * (1.492 - lat) / 0.56 };
}

export function atlasDestination(place, world) {
  const access = accessOf(place);
  const station = world ? world.station(place.stationId) : STATION_BY_ID[place.stationId];
  const landing = place.landing && (world ? world.authoredTile(place.landing) : place.landing);
  const zone = world?.zones.find((z) => z.name === place.zone);
  // An inbound ferry link identifies both the destination pier and where to board.
  const ferry = access === 'ferry' && world?.ferryLinks?.find((link) => link.to.placeId === place.id);
  const tile = ferry?.to || landing || station || (zone && {
    x: Math.floor((zone.x0 + zone.x1) / 2), y: Math.floor((zone.y0 + zone.y1) / 2),
  });
  if (!tile) return null;
  const destination = { x: tile.x, y: tile.y, label: place.label };
  if (ferry) destination.ferry = ferry;
  if (access === 'mrt' && station) {
    destination.label = `${station.name} MRT`;
    destination.station = station;
  }
  return destination;
}

export function renderSingaporeAtlas(parent, currentZone, onTerrain, resolveDestination = atlasDestination) {
  const atlas = document.createElement('div');
  atlas.className = 'atlas';
  atlas.innerHTML = `
    <div class="atlas-map" role="group" aria-label="Geographic map of Singapore">
      <img src="assets/maps/singapore-atlas.webp" alt="Singapore's coastline, Pulau Ubin, Pulau Tekong and the Southern Islands" width="1200" height="800" />
      <img class="atlas-relief" src="assets/maps/singapore-atlas-relief.webp" alt="" width="1200" height="800" />
      <span class="atlas-north" aria-hidden="true">N</span>
      <span class="atlas-strait" aria-hidden="true">Singapore Strait</span>
      <figure class="atlas-inset" hidden>
        <img alt="" width="144" height="72" />
        <figcaption></figcaption>
      </figure>
    </div>
    <div class="atlas-destination">
      <label>Destination <select></select></label>
      <button class="wm-go" type="button">Show on terrain</button>
      <p class="atlas-access" aria-live="polite"></p>
    </div>
    <p class="atlas-credit">Coastline adapted from URA’s
      <a href="https://data.gov.sg/datasets/d_4765db0e87b9c86336792efe8a1f7a66/view" target="_blank" rel="noopener">Master Plan 2019 Planning Area Boundary (No Sea)</a>,
      accessed 28 November 2026 under the
      <a href="https://data.gov.sg/open-data-licence" target="_blank" rel="noopener">Singapore Open Data Licence</a>.
    </p>`;
  const map = atlas.querySelector('.atlas-map');
  const select = atlas.querySelector('select');
  const access = atlas.querySelector('.atlas-access');
  const showTerrain = atlas.querySelector('.wm-go');
  const inset = atlas.querySelector('.atlas-inset');
  const insetArt = inset.querySelector('img');
  const insetCaption = inset.querySelector('figcaption');
  const pins = new Map();
  let place = GEOGRAPHIC_PLACES.find((p) => p.zone === currentZone || p.label === currentZone || STATION_BY_ID[p.stationId]?.name === currentZone) || ATLAS_PLACES[0];
  let destination;
  for (const p of ATLAS_PLACES) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'atlas-pin';
    pin.dataset.side = p.side;
    pin.dataset.place = p.id;
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
  }
  for (const [label, places] of [['Singapore locations', ATLAS_PLACES], ['Fantasy locations', fantasyPlaces]]) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const p of [...places].sort((a, b) => a.label.localeCompare(b.label, 'en-SG'))) {
      group.appendChild(new Option(p.label, p.id));
    }
    select.appendChild(group);
  }
  function choose(next) {
    pins.get(place.id)?.setAttribute('aria-pressed', 'false');
    place = next;
    pins.get(place.id)?.setAttribute('aria-pressed', 'true');
    select.value = place.id;
    destination = resolveDestination(place);
    showTerrain.disabled = !destination;
    const origin = destination?.ferry?.from.name || GEOGRAPHIC_PLACE_BY_ID[place.ferryFrom]?.label;
    const route = accessOf(place) === 'ferry' ? (origin ? `In-game ferry from ${origin}` : 'In-game ferry crossing')
      : accessOf(place) === 'mrt' ? 'In-game MRT and walking' : 'Walking route';
    const setting = place.kind === 'fictional' ? 'Fantasy district' : place.realLabel ? `Inspired by ${place.realLabel}` : '';
    access.textContent = [setting, route].filter(Boolean).join(' · ');
    const detail = ATLAS_INSETS[place.id];
    inset.hidden = !detail;
    if (detail) {
      insetArt.src = `assets/${detail.art}`;
      insetCaption.textContent = detail.caption;
      inset.classList.toggle('atlas-inset--scene', Boolean(detail.scene));
    }
  }
  for (const pin of pins.values()) pin.setAttribute('aria-pressed', 'false');
  choose(place);
  select.addEventListener('change', () => choose(GEOGRAPHIC_PLACE_BY_ID[select.value]));
  showTerrain.addEventListener('click', () => onTerrain(destination));
  parent.appendChild(atlas);
}
