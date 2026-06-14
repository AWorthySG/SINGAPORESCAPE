// Global tuning constants.
export const TILE = 32;            // pixel size of one world tile
export const TICK_MS = 600;        // RuneScape game tick (0.6s)
export const WALK_TICKS_PER_TILE = 1;  // tiles per tick walking
export const RUN_TICKS_PER_TILE = 2;   // tiles per tick running (2x)

export const PLAYER_DEFAULT_HP = 10;
export const RESPAWN_TICKS = 5;        // ticks dead before respawn
export const FIRE_LIFETIME_TICKS = 100; // ~60s for a player-lit fire
export const GROUND_ITEM_LIFETIME_TICKS = 300; // ~3 minutes

export const ATTACK_RANGE = 1;     // melee adjacency
export const AGGRO_FORGET_TILES = 12;

export const SAVE_KEY = 'singaporescape:save:v1';
export const AUTOSAVE_TICKS = 50;  // autosave every ~30s

export const XP_RATE = 3;          // global experience multiplier for snappier progression
