// An optional opening quest, independent of the main story.
export const FIRST_JOURNEY_TITLE = 'A First Day in Kampong Glam';
export const FIRST_JOURNEY_PLACES = ['Bukit Timah', 'MacRitchie Reservoir', 'Chinatown'];
const ROUTES = new Set(['combat', 'gather']);

export function loadFirstJourney(game, raw) {
  if (!raw || typeof raw !== 'object') return;
  const route = ROUTES.has(raw.route) ? raw.route : null;
  const phase = ['field', 'bank', 'explore', 'done', 'skipped'].includes(raw.phase) ? raw.phase : 'offer';
  game.firstJourney = {
    phase: route || phase === 'skipped' ? phase : 'offer', route,
    baseline: Number.isFinite(raw.baseline) ? Math.max(0, raw.baseline) : 0,
    destination: FIRST_JOURNEY_PLACES.includes(raw.destination) ? raw.destination : null,
  };
}

const progress = (game, route) => route === 'combat' ? game.kills.rat || 0 : game.skills.xp.woodcutting || 0;

function change(game) {
  game.saveSoon = true;
  game.bus.emit('firstjourney');
}

export function chooseFirstJourney(game, route) {
  if (!game.jobClass || !ROUTES.has(route) || (game.firstJourney && game.firstJourney.phase !== 'offer')) return false;
  game.firstJourney = { phase: 'field', route, baseline: progress(game, route) };
  change(game);
  return true;
}

export function skipFirstJourney(game) {
  if (game.firstJourney?.phase === 'done') return;
  game.firstJourney = { phase: 'skipped' };
  change(game);
}

export function updateFirstJourney(game, banked = false) {
  const j = game.firstJourney;
  if (!j || !game.player.alive) return;
  if (j.phase === 'field' && progress(game, j.route) > j.baseline) {
    j.phase = 'bank';
    change(game);
  }
  if (j.phase === 'bank' && banked) {
    j.phase = 'explore';
    change(game);
  }
  if (j.phase === 'explore' && j.destination && game.currentZoneName === j.destination) {
    j.phase = 'done';
    const qty = 250;
    const carried = game.inventory.add('coins', qty);
    if (carried < qty) game.bank.deposit('coins', qty - carried);
    game.msg(`${FIRST_JOURNEY_TITLE} complete! You earned your first travel purse: ${qty} coins.`, 'level');
    change(game);
  }
}

export function chooseFirstDestination(game, name) {
  const j = game.firstJourney;
  if (j?.phase !== 'explore' || !FIRST_JOURNEY_PLACES.includes(name)) return false;
  j.destination = name;
  change(game);
  updateFirstJourney(game);
  if (j.phase === 'done') return true;
  // Use the same safe travel step as the world map for these districts.
  const zone = game.world.zones.find((z) => z.name === name);
  const tile = zone && game._nearestFree(Math.floor((zone.x0 + zone.x1) / 2), Math.floor((zone.y0 + zone.y1) / 2));
  return !!tile && game.travelToTile(tile);
}

export function firstJourneyGoal(game) {
  const j = game.firstJourney;
  if (!game.jobClass || !j || j.phase === 'done' || j.phase === 'skipped') return null;
  const detail = {
    offer: ['Choose combat or gathering to help out in Kampong Glam.', 'Choose'],
    field: j.route === 'combat' ? ['Defeat a rat and pick up your loot.', 'Find a rat'] : ['Chop a tree to gather your first logs.', 'Find a tree'],
    bank: ['Deposit an item or some coins at the bank.', 'Bank'],
    explore: [j.destination ? `Travel to ${j.destination}.` : 'Choose a district to visit and earn 250 coins.', 'Explore'],
  }[j.phase];
  return { key: `journey:${j.phase}:${j.destination || ''}`, kind: 'journey', icon: '✦', title: FIRST_JOURNEY_TITLE, text: detail[0], go: detail[1] };
}
