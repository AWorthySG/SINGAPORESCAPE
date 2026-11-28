// Save a destination, not an in-flight action or a reference to a creature.
const WORK = new Set(['tree', 'rock', 'fishing', 'farm', 'dive', 'dig']);

export function captureResumeTask(game) {
  const p = game.player;
  if (!p.alive || game.waves?.active || game._respawnAt) return null;
  const obj = p.action?.obj;
  if (obj && WORK.has(obj.def?.type) && !obj.depleted) return { kind: 'work', x: obj.x, y: obj.y, id: obj.objId };
  const dest = p.path?.at(-1);
  if (dest && !p.action) return { kind: 'walk', x: dest.x, y: dest.y };
  if (game.autoQuestId && game.quests[game.autoQuestId]?.state === 'active') return { kind: 'quest', id: game.autoQuestId };
  return game.resumeTask || null;
}

export function readResumeTask(game, raw) {
  if (raw?.kind === 'quest') {
    return typeof raw.id === 'string' && Object.hasOwn(game.quests, raw.id) && game.quests[raw.id].state === 'active'
      ? { kind: 'quest', id: raw.id } : null;
  }
  if (!['work', 'walk'].includes(raw?.kind) || !Number.isInteger(raw.x) || !Number.isInteger(raw.y)
    || !game.world.inBounds(raw.x, raw.y)) return null;
  const world = game.world;
  if (raw.kind === 'work') {
    const here = world.objectAt(raw.x, raw.y);
    const obj = here?.objId === raw.id ? here : world.gatheringNodeAtOrigin?.(raw.x, raw.y);
    if (!WORK.has(obj?.def?.type) || obj.objId !== raw.id) return null;
    return { kind: raw.kind, x: obj.x, y: obj.y, id: raw.id };
  }
  if (world.isBlocked(raw.x, raw.y)) {
    const o = world.objectAt(raw.x, raw.y);
    if (!o?.miningOrigin && !o?.gatheringOrigin) return null;
    const beside = game._nearestFree(raw.x, raw.y);
    return beside ? { kind: 'walk', ...beside, id: raw.id } : null;
  }
  return { kind: raw.kind, x: raw.x, y: raw.y, id: raw.id };
}

export function resumeTaskText(game) {
  const task = game.resumeTask;
  if (!task) return '';
  if (task.kind === 'quest') return game.questGuide(task.id)?.text || 'Continue your active quest.';
  const region = game.world.zoneAt(task.x, task.y)?.name || 'the island';
  if (task.kind === 'work') return `Return to ${game.world.objectAt(task.x, task.y)?.def?.label || 'your work spot'} in ${region}.`;
  return `Continue your walk towards ${region}.`;
}

export function finishResumeTask(game, resume) {
  const task = readResumeTask(game, game.resumeTask);
  game.resumeTask = null;
  game.saveSoon = true;
  if (task?.kind === 'quest' && game.autoQuestId === task.id) game.autoQuestId = null;
  if (!resume || !task) { game.bus.emit('firstjourney'); return false; }
  let started;
  if (task.kind === 'quest') started = game.questTravel(task.id);
  else if (task.kind === 'work') {
    const obj = game.world.objectAt(task.x, task.y);
    started = !obj.depleted && game.goToObject(obj);
  } else started = game.travelToTile(task);
  if (!started) {
    game.resumeTask = task;
    game.msg('That activity is unavailable right now. You can try again or dismiss it.', 'system');
  }
  game.bus.emit('firstjourney');
  return !!started;
}
