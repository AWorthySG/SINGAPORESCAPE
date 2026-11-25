// Which gathering tool the player works with: the best one they carry or
// wield that their level lets them use (tiers in src/data/tooltiers.js), and
// what it adds. Tools without a tier (hammer, chisel, net...) are always usable.
import { ITEMS } from '../data/items.js';
import { TOOL_TIERS, TOOL_KIND, TOOL_KINDS, toolId, toolBonusText } from '../data/tooltiers.js';
import { DIVE_TAG, DIVE_GEAR } from '../data/diving.js';

// A tool's tier: a gathering tool's, or a piece of dive gear's (diving.js: the
// same twelve tiers, kept apart so the tool tables and their stickers aren't touched).
const tierOf = (it) => it?.toolTier ?? it?.diveTier ?? 0;

/** Can the player use tool `id` at their level? */
export function canUseTool(game, id) {
  const it = ITEMS[id];
  if (!it?.toolSkill) return true;
  return (game?.skills?.level?.(it.toolSkill) ?? 1) >= it.toolLevel;
}

/** The ids of every tool of `tag` the player wields or carries. */
function carried(game, tag) {
  const out = [];
  const w = game?.equipment?.get?.('weapon');
  if (w && ITEMS[w]?.tool === tag) out.push(w);
  for (const s of game?.inventory?.slots || []) if (s && ITEMS[s.id]?.tool === tag) out.push(s.id);
  return out;
}

/** The best tool of `tag` the player can use right now, or null. */
export function bestTool(game, tag) {
  let best = null;
  for (const id of carried(game, tag)) {
    if (canUseTool(game, id) && (!best || tierOf(ITEMS[id]) > tierOf(ITEMS[best]))) best = id;
  }
  return best;
}

/** What the tool in use gives: its tier's { speed, yield, find } (zero without a tiered one). */
const NONE = { speed: 0, yield: 0, find: 0 };
export function toolBonus(game, tag) {
  if (!TOOL_KIND[tag] && tag !== DIVE_TAG) return NONE;
  const id = bestTool(game, tag);
  return id ? TOOL_TIERS[tierOf(ITEMS[id])] : NONE;
}

/** The tool tag a gathering action works with ('axe' for chopping...), or null. */
export function actionToolTag(a) {
  switch (a?.type) {
    case 'woodcut': return 'axe';
    case 'mine': return 'pickaxe';
    case 'fish': return a.obj?.def?.tool || 'net';
    case 'hunt': return 'snare';
    case 'dive': return DIVE_TAG;
    default: return null;
  }
}

/** Extra rolls a tick the action's tool adds, on top of GATHER_SPEED. */
export const toolSpeed = (game, a, gatherSpeed) => {
  const tag = actionToolTag(a);
  return tag ? gatherSpeed * toolBonus(game, tag).speed / 100 : 0;
};

/** When the player has tools of `tag` but none they can use yet, the line
 *  that says so ("You need Mining 15 to use your iron pickaxe."); else null. */
export function toolTooHighMsg(game, tag) {
  const ids = carried(game, tag);
  if (!ids.length || ids.some((id) => canUseTool(game, id))) return null;
  const id = ids.reduce((a, b) => (ITEMS[b].toolLevel < ITEMS[a].toolLevel ? b : a));
  const it = ITEMS[id];
  return `You need ${it.toolSkill[0].toUpperCase() + it.toolSkill.slice(1)} ${it.toolLevel} to use your ${it.name.toLowerCase()}.`;
}

/** A skill's tool ladder for its guide: one row per tier and kind, worst
 *  first: { id, tag, tier, level, bonus, usable (level high enough), inUse }. */
export function toolLadder(game, skill) {
  const rows = [];
  if (skill === 'diving') {
    // Dive gear: each piece also adds breath (diving.js).
    const using = bestTool(game, DIVE_TAG);
    for (const g of DIVE_GEAR) {
      const more = toolBonusText(TOOL_TIERS[g.tier]);
      rows.push({ id: g.id, tag: DIVE_TAG, tier: g.tier, level: g.level, bonus: `+${g.breath} breath${more ? `, ${more}` : ''}`,
        usable: canUseTool(game, g.id), inUse: g.id === using });
    }
    return rows;
  }
  for (const K of TOOL_KINDS) {
    if (K.skill !== skill) continue;
    const using = bestTool(game, K.tag);
    TOOL_TIERS.forEach((T, i) => {
      const id = toolId(K.tag, i);
      rows.push({ id, tag: K.tag, tier: i, level: T.level, bonus: toolBonusText(T) || 'the basic tool',
        usable: canUseTool(game, id), inUse: id === using });
    });
  }
  return rows.sort((a, b) => a.level - b.level || a.tag.localeCompare(b.tag));
}
