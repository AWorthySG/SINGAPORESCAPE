// Every boss has its own signature move (used on its special-attack cadence)
// and its own mix of ground-attack patterns (the red markers you step out of).
//
// Signature move `fx` are applied in order:
//   strike  { mul, hits, sure, steal }  hit the player (mul x max hit; steal = lifesteal fraction)
//   dot     { kind, per, ticks }        poison / burn / bleed / chill: `per` x max hit each tick
//   stun    { ticks }                   the player can't act
//   root    { ticks }                   the player can't move
//   pull                                drag the player next to the boss
//   knock   { dist }                    throw the player away from the boss
//   blink                               the boss appears beside the player
//   heal    { frac }                    the boss heals a fraction of its max life
//   shield  { ticks }                   the boss takes half damage
//   reflect { ticks, frac }             a share of the player's damage bounces back
//   summon  { id, n }                   minions that join the fight
//   enrage                              the boss attacks faster for the rest of the fight
//   drain   { adrenaline, run }         sap the player's adrenaline / run energy
//
// Ground patterns: blast (3x3 on you), nova (5x5 round the boss), line (a lane from
// the boss through you), cross, ring (round the boss, safe beside it), meteors
// (scattered 3x3s), rain (many single tiles), chase (three blasts that follow you),
// twin (either side of you), quake (7x7 round the boss, slower).

export const DOT_KINDS = {
  poison: { name: 'poisoned', color: '#5fd04a' },
  burn: { name: 'burning', color: '#ff7a2a' },
  bleed: { name: 'bleeding', color: '#d02a3a' },
  chill: { name: 'chilled', color: '#8adcf0' },
};

export const BOSS_ABILITIES = {
  boar_king: { name: 'Tusk Charge', desc: 'Charges you down, gores you and sends you flying.', color: '#a8743a',
    fx: [{ t: 'blink' }, { t: 'strike', mul: 1.8 }, { t: 'knock', dist: 3 }, { t: 'stun', ticks: 1 }], hazards: ['line', 'blast'] },
  goblin_warchief: { name: 'Rally the Horde', desc: 'Calls three goblins to the fight.', color: '#4f9a3f',
    fx: [{ t: 'summon', id: 'goblin', n: 3 }, { t: 'strike', mul: 1.1 }], hazards: ['blast', 'meteors'] },
  macaque_alpha: { name: 'Snatch and Run', desc: 'Steals your adrenaline and gobbles a snack.', color: '#7a5a3a',
    fx: [{ t: 'strike', mul: 1.2 }, { t: 'drain', adrenaline: 40 }, { t: 'heal', frac: 0.08 }], hazards: ['twin', 'blast'] },
  reservoir_serpent: { name: 'Constrict', desc: 'Drags you in and crushes you in its coils.', color: '#2f7a8a',
    fx: [{ t: 'pull' }, { t: 'root', ticks: 3 }, { t: 'dot', kind: 'bleed', per: 0.35, ticks: 4 }], hazards: ['line', 'nova'] },
  chilli_crab: { name: 'Chilli Splash', desc: 'Sprays scalding chilli sauce that keeps burning.', color: '#d83b2e',
    fx: [{ t: 'strike', mul: 1.3 }, { t: 'dot', kind: 'burn', per: 0.4, ticks: 5 }], hazards: ['rain', 'nova'] },
  spider_queen: { name: 'Web of Venom', desc: 'Webs you in place, poisons you and births spiderlings.', color: '#5a3a6a',
    fx: [{ t: 'root', ticks: 3 }, { t: 'dot', kind: 'poison', per: 0.35, ticks: 6 }, { t: 'summon', id: 'jungle_spider', n: 2 }], hazards: ['meteors', 'ring'] },
  ancient_tembusu: { name: 'Deep Roots', desc: 'Roots bind your feet while bark hardens and the tree regrows.', color: '#3c8a3f',
    fx: [{ t: 'root', ticks: 2 }, { t: 'heal', frac: 0.12 }, { t: 'shield', ticks: 4 }], hazards: ['cross', 'nova'] },
  merlion: { name: 'Tidal Spout', desc: 'A blast of water that knocks you back and leaves you reeling.', color: '#5faee3',
    fx: [{ t: 'strike', mul: 1.5 }, { t: 'knock', dist: 4 }, { t: 'stun', ticks: 1 }], hazards: ['line', 'ring'] },
  timah_drake: { name: 'Granite Breath', desc: 'Breathes searing grit, then hides behind granite plates.', color: '#3f8a5a',
    fx: [{ t: 'strike', mul: 1.6 }, { t: 'dot', kind: 'burn', per: 0.3, ticks: 3 }, { t: 'shield', ticks: 3 }], hazards: ['line', 'quake'] },
  bandit_kingpin: { name: 'Twin Blades', desc: 'Three quick slashes that leave you bleeding.', color: '#7a5a3a',
    fx: [{ t: 'strike', mul: 0.9, hits: 3 }, { t: 'dot', kind: 'bleed', per: 0.3, ticks: 4 }], hazards: ['twin', 'chase'] },
  bone_colossus: { name: 'Bone Storm', desc: 'Hurls bones and raises skeletons from the ground.', color: '#e8e2d0',
    fx: [{ t: 'strike', mul: 1.3 }, { t: 'summon', id: 'skeleton', n: 2 }], hazards: ['rain', 'quake'] },
  molten_golem: { name: 'Magma Skin', desc: 'Its skin turns molten: hitting it burns you back.', color: '#ef7a23',
    fx: [{ t: 'reflect', ticks: 5, frac: 0.3 }, { t: 'dot', kind: 'burn', per: 0.3, ticks: 4 }], hazards: ['nova', 'meteors'] },
  sentosa_kraken: { name: 'Ink and Tentacles', desc: 'Grabs you with two tentacles and inks away your adrenaline.', color: '#4a6ad0',
    fx: [{ t: 'pull' }, { t: 'strike', mul: 1.2, hits: 2 }, { t: 'drain', adrenaline: 30 }], hazards: ['ring', 'cross'] },
  demon_lord: { name: 'Hellfire Pact', desc: 'Sets you ablaze and feeds on your pain.', color: '#c0432a',
    fx: [{ t: 'strike', mul: 1.4, steal: 1 }, { t: 'dot', kind: 'burn', per: 0.5, ticks: 5 }], hazards: ['meteors', 'quake'] },
  wilderness_warlord: { name: 'War Cry', desc: 'A deafening cry that stuns you and drives it into a rage.', color: '#9a948a',
    fx: [{ t: 'stun', ticks: 2 }, { t: 'strike', mul: 1.5 }, { t: 'enrage' }], hazards: ['chase', 'cross'] },
  sand_scorpion_king: { name: 'Royal Sting', desc: 'A paralysing sting full of venom.', color: '#caa05a',
    fx: [{ t: 'strike', mul: 1.2, sure: true }, { t: 'stun', ticks: 1 }, { t: 'dot', kind: 'poison', per: 0.55, ticks: 5 }], hazards: ['blast', 'twin'] },
  durian_behemoth: { name: 'Thorn Burst', desc: 'Its spikes bristle: they cut you and bite back when struck.', color: '#a0b83a',
    fx: [{ t: 'knock', dist: 2 }, { t: 'dot', kind: 'bleed', per: 0.35, ticks: 4 }, { t: 'reflect', ticks: 4, frac: 0.2 }], hazards: ['nova', 'rain'] },
  bedok_bandit_lord: { name: 'Smoke Bomb', desc: 'Vanishes in smoke and strikes from behind.', color: '#5a5a66',
    fx: [{ t: 'blink' }, { t: 'shield', ticks: 3 }, { t: 'strike', mul: 1.4 }], hazards: ['chase', 'blast'] },
  hungry_ghost_king: { name: 'Hungry Feast', desc: 'Devours your life force and calls a wraith.', color: '#b8a0c0',
    fx: [{ t: 'strike', mul: 1.3, steal: 1 }, { t: 'summon', id: 'wraith', n: 1 }], hazards: ['ring', 'rain'] },
  night_safari_tiger: { name: 'Pounce', desc: 'Leaps on you from the dark with two raking swipes.', color: '#e08a2a',
    fx: [{ t: 'blink' }, { t: 'strike', mul: 1.4, hits: 2 }, { t: 'dot', kind: 'bleed', per: 0.3, ticks: 3 }], hazards: ['chase', 'twin'] },
  mangrove_hydra: { name: 'Three Heads', desc: 'Three poisoned bites, and a fresh head grows back.', color: '#3a7a4a',
    fx: [{ t: 'strike', mul: 0.8, hits: 3 }, { t: 'dot', kind: 'poison', per: 0.3, ticks: 4 }, { t: 'heal', frac: 0.06 }], hazards: ['cross', 'line'] },
  tualang_treant: { name: 'Bee Swarm', desc: 'Shakes loose a swarm from its hives and tangles your feet.', color: '#f5b82e',
    fx: [{ t: 'summon', id: 'mosquito', n: 3 }, { t: 'root', ticks: 2 }], hazards: ['meteors', 'nova'] },
  coral_leviathan: { name: 'Coral Armour', desc: 'Grows a coral shell, then rams you away.', color: '#f07a6a',
    fx: [{ t: 'shield', ticks: 5 }, { t: 'strike', mul: 1.5 }, { t: 'knock', dist: 3 }], hazards: ['quake', 'ring'] },
  the_garuda: { name: 'Storm Wings', desc: 'A gale from its wings blows you over and leaves you breathless.', color: '#f5c24a',
    fx: [{ t: 'knock', dist: 4 }, { t: 'stun', ticks: 2 }, { t: 'drain', run: 50 }], hazards: ['rain', 'line'] },
  rune_golem: { name: 'Rune Barrier', desc: 'Glowing runes shield it, reflect blows and dampen your abilities.', color: '#5a8ae8',
    fx: [{ t: 'shield', ticks: 4 }, { t: 'reflect', ticks: 4, frac: 0.2 }, { t: 'drain', adrenaline: 20 }], hazards: ['cross', 'quake'] },
  sentosa_megalodon: { name: 'Frenzied Bite', desc: 'A massive bite that never misses and leaves you bleeding.', color: '#7fb6dd',
    fx: [{ t: 'strike', mul: 2.2, sure: true }, { t: 'dot', kind: 'bleed', per: 0.45, ticks: 4 }], hazards: ['line', 'chase'] },
  changi_phantom: { name: 'Phase Shift', desc: 'Slips through you, untouchable for a moment, chilling your spirit.', color: '#cfd8e8',
    fx: [{ t: 'blink' }, { t: 'shield', ticks: 3 }, { t: 'drain', adrenaline: 30 }, { t: 'dot', kind: 'chill', per: 0.25, ticks: 3 }], hazards: ['twin', 'ring'] },
  pulau_hantu_djinn: { name: 'Three Wishes', desc: 'Wishes for health, servants and your silence.', color: '#9a52ad',
    fx: [{ t: 'heal', frac: 0.1 }, { t: 'summon', id: 'imp', n: 2 }, { t: 'stun', ticks: 1 }], hazards: ['meteors', 'cross'] },
  bukit_brown_revenant: { name: 'Grave Chill', desc: 'A freezing grip roots you as the dead rise.', color: '#8adcf0',
    fx: [{ t: 'root', ticks: 3 }, { t: 'dot', kind: 'chill', per: 0.35, ticks: 4 }, { t: 'summon', id: 'pocong', n: 1 }], hazards: ['ring', 'rain'] },
  dragon_kiln_wyrm: { name: 'Kiln Breath', desc: 'Breath hot as a dragon kiln that glazes you in fire.', color: '#ff5a2a',
    fx: [{ t: 'strike', mul: 1.4 }, { t: 'dot', kind: 'burn', per: 0.6, ticks: 5 }], hazards: ['line', 'quake'] },
  orang_minyak: { name: 'Oil Slick', desc: 'Oozes under you, gluing your feet, then strikes.', color: '#3a3a44',
    fx: [{ t: 'blink' }, { t: 'root', ticks: 2 }, { t: 'drain', run: 50 }, { t: 'strike', mul: 1.3 }], hazards: ['chase', 'rain'] },
  lion_of_light: { name: 'Radiant Roar', desc: 'A blinding roar that stuns you and renews its light.', color: '#ffe24a',
    fx: [{ t: 'stun', ticks: 2 }, { t: 'knock', dist: 2 }, { t: 'heal', frac: 0.1 }], hazards: ['nova', 'cross'] },
  shadow_sovereign: { name: 'Eclipse', desc: 'Darkness feeds it, shields it and births wraiths.', color: '#6a4a8a',
    fx: [{ t: 'strike', mul: 1.5, steal: 1 }, { t: 'shield', ticks: 3 }, { t: 'summon', id: 'wraith', n: 2 }], hazards: ['ring', 'quake'] },
  supertree_guardian: { name: 'Photosynthesis', desc: 'Drinks in the light to heal while vines hold you fast.', color: '#2f9a6a',
    fx: [{ t: 'root', ticks: 3 }, { t: 'heal', frac: 0.15 }], hazards: ['cross', 'meteors'] },
  coney_behemoth: { name: 'Stampede', desc: 'Tramples over you and leaves you dazed.', color: '#8a5a3a',
    fx: [{ t: 'blink' }, { t: 'strike', mul: 1.6 }, { t: 'knock', dist: 4 }, { t: 'stun', ticks: 2 }], hazards: ['line', 'chase'] },
  kusu_tortoise: { name: 'Shell Fortress', desc: 'Withdraws into its shell: shielded, spiked and healing.', color: '#3a8a6a',
    fx: [{ t: 'shield', ticks: 6 }, { t: 'reflect', ticks: 6, frac: 0.25 }, { t: 'heal', frac: 0.05 }], hazards: ['quake', 'ring'] },
  rift_tyrant: { name: 'Rift Tear', desc: 'Tears reality open, dragging you in and spilling out imps.', color: '#5a1a6a',
    fx: [{ t: 'pull' }, { t: 'strike', mul: 1.8 }, { t: 'drain', adrenaline: 50 }, { t: 'summon', id: 'imp', n: 2 }], hazards: ['meteors', 'cross', 'quake'] },
  eternal_wyrm: { name: 'Endless Flame', desc: 'Two scorching strikes, undying fire and growing fury.', color: '#f5b82e',
    fx: [{ t: 'strike', mul: 2.0, hits: 2 }, { t: 'dot', kind: 'burn', per: 0.6, ticks: 6 }, { t: 'shield', ticks: 3 }, { t: 'enrage' }], hazards: ['line', 'ring', 'quake', 'rain'] },
};
