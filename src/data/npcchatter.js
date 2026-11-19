// The living world's words and timetables: daily routines for townsfolk and
// the region quest givers, the small talk they make with each other, what they
// say about you as you pass, and what bosses growl when a fight starts. Plain
// data; src/game/npclife.js and src/game/memory.js do the work.
//
// Lines may use {name} (your name), {class} (your job class), {level} (your
// fight level), {region} (where they stand) and a few deed fields that
// memory.js fills in. Warm and local: a little Singlish, never a caricature.

// ---------------- Daily routines ----------------
// A routine is a list of slots, each { from, to, at } in game hours (a slot
// may wrap past midnight). `at` is where they should be:
//   'post'    their usual spot (where the world placed them)
//   'home'    a spot a few tiles away they walk back to at night
//   'a', 'b'  two errands nearby
//   'stroll'  an evening walk
//   'chat'    a meeting spot shared with a neighbour, to talk (kopi time)
//   'wander'  potter about near home as they always have (villagers)
// Every routine has them at their post (or pottering about) at 7am, the hour
// a session opens on, so the town looks the same as ever when you arrive.
export const ROUTINES = {
  // A stall keeper: minds the stall all day, a walk after closing, home to sleep.
  stall: [
    { from: 6, to: 16, at: 'post' }, { from: 16, to: 18, at: 'chat' }, { from: 18, to: 20, at: 'post' },
    { from: 20, to: 22, at: 'stroll' }, { from: 22, to: 6, at: 'home' },
  ],
  // Out and about: errands between two or three spots through the day.
  rover: [
    { from: 6, to: 10, at: 'post' }, { from: 10, to: 12, at: 'a' }, { from: 12, to: 14, at: 'b' },
    { from: 14, to: 16, at: 'post' }, { from: 16, to: 18, at: 'chat' }, { from: 18, to: 21, at: 'post' },
    { from: 21, to: 6, at: 'home' },
  ],
  // Up before the sun (the morning climber, the old fisherman).
  early: [
    { from: 4, to: 6, at: 'a' }, { from: 6, to: 16, at: 'post' }, { from: 16, to: 18, at: 'chat' },
    { from: 18, to: 20, at: 'post' }, { from: 20, to: 4, at: 'home' },
  ],
  // A night owl (the stargazer): out at the lookout after dark.
  night: [
    { from: 6, to: 16, at: 'post' }, { from: 16, to: 18, at: 'chat' }, { from: 18, to: 2, at: 'a' }, { from: 2, to: 6, at: 'home' },
  ],
  // Villagers potter about as before, meet a neighbour twice a day, and go home at night.
  villager: [
    { from: 6, to: 9, at: 'wander' }, { from: 9, to: 11, at: 'chat' }, { from: 11, to: 16, at: 'wander' },
    { from: 16, to: 18, at: 'chat' }, { from: 18, to: 21, at: 'wander' }, { from: 21, to: 6, at: 'home' },
  ],
};

// Which routine each region quest giver keeps (anyone not listed is a stall keeper).
export const GIVER_ROUTINE = {
  rq_ranger_siti: 'rover', rq_mei_ling: 'rover', rq_darren: 'rover', rq_keeper_hui: 'rover', rq_diver_kai: 'rover',
  rq_ranger_boon: 'rover', rq_aisha: 'rover', rq_kamal: 'rover', rq_nadia: 'rover', rq_monk: 'rover', rq_hafiz: 'rover',
  rq_rajoo: 'early', rq_osman: 'early', rq_kumar: 'early',
  rq_lin: 'night',
};

// ---------------- Small talk ----------------
// Two neighbours at their meeting spot take turns: A, B, A, B.
export const CHAT_EXCHANGES = [
  ['Eh, makan already?', 'Not yet leh. Later go kopitiam?', 'Can, can. Uncle there got new kaya.', 'Wah, then must try.'],
  ['So hot today, I melting already.', 'Later sure rain one.', 'Rain also good, cool a bit.', 'Then my laundry how?'],
  ['Your grandson start school already?', 'Primary One this year! So fast.', 'Aiyo, time really flies.', 'Last time he so small only.'],
  ['You heard? Someone saw a champion near the hill.', 'Wah, scary. I stay in town today.', 'Got adventurers around, don’t worry.', 'True, true.'],
  ['The durians this season very good.', 'Mao Shan Wang or D24?', 'Whatever got discount lah.', 'Haha, practical.'],
  ['Morning walk again?', 'Doctor say must walk ten thousand steps.', 'Then why you sitting down?', 'Rest first. Later continue.'],
  ['Your stall busy today?', 'Lunch time crowd, siao one.', 'Good business is good problem.', 'Ya lor, can’t complain.'],
  ['Tonight got pasar malam?', 'Got! Near the community centre.', 'Want to go together?', 'Okay, I bring my auntie.'],
  ['The monkeys at MacRitchie took my bread again.', 'You never learn ah.', 'They very fast, okay!', 'Next time hold tight.'],
  ['My son wants to be an adventurer.', 'Wah, brave boy.', 'I want him to be a doctor.', 'Doctor also can fight germs mah.'],
  ['You see the lanterns at Chinatown?', 'So pretty this year.', 'Must go see before they take down.', 'This weekend lah.'],
  ['Hello neighbour!', 'Hello! Long time no see.', 'Busy lah, you know how.', 'Same same. Take care ah.'],
];

// One person on their own, muttering as you pass (any time of day).
export const AMBIENT_LINES = [
  'Where did I put my keys...', 'Must buy kopi-o later.', 'This road always got construction.', 'Aiyo, forgot my umbrella.',
  'Should I take the MRT or walk?', 'Nice breeze today.', 'Hmm, chicken rice or nasi lemak...', 'My knees getting old already.',
];
export const MORNING_LINES = ['Morning! Had breakfast already?', 'Early bird catch the worm, ya.', 'Kopi first, then can talk.'];
export const EVENING_LINES = ['Evening already. Time to go home.', 'Sky so pretty this evening.', 'Dinner time soon, shiok.'];
export const NIGHT_LINES = ['So late still walking around?', 'Zzz... huh? Oh, it’s you.', 'Go home and rest, ya.'];
export const RAIN_LINES = ['Wah, the rain! Got umbrella or not?', 'This rain sure flood the drains.', 'Stay dry, ya!'];
// Said now and then by someone at home after dark (they're sleeping).
export const SLEEP_LINE = 'Zzz...';

// ---------------- What townsfolk remember about you ----------------
// memory.js picks these when the matching deed or fact is fresh.
export const MEMORY_LINES = {
  name: ['Eh, {name}! How are you?', 'Hello {name}! Good to see you.', '{name}! You look strong today.'],
  class: ['A {class}! My nephew wants to be one too.', 'Wah, a real {class}. So steady.'],
  level: ['Fight level {level} already? You train hard, ah.', 'Level {level}! Last time you so blur, now so strong.'],
  boss: ['Heard you beat {boss}! Shiok!', 'Everyone talking about {boss}. You ah, power!', '{boss}? Really? Wah, respect.'],
  champion: ['That {champion}? You beat it? Garang!', 'People say you took down {champion}. Steady lah.'],
  quest: ['Heard you finished {quest}. Thank you, ah.', '{quest}, done already? You very helpful one.'],
  event: ['Thank you for helping at {event}!', 'You were at {event}, right? Brave, brave.'],
  pet: ['Your {pet} so cute leh!', 'Can I pat your {pet}?', 'Where you find that {pet}? So adorable.'],
  rank: ['Everyone in {region} knows you now.', 'You are one of us here in {region}, ya.', 'The {region} hero! Welcome back.'],
  distrust: ['Hmph. I heard what you did around here.', 'We don’t forget so fast in {region}.'],
};

// ---------------- Region news (a Friend's extra dialogue) ----------------
// What a quest giver tells a Friend of the region. Anywhere not listed uses the fallback.
export const REGION_NEWS = {
  'Kampong Glam': 'The batik stalls are busier than ever. Someone even ordered a sarong for a wedding in Johor!',
  Chinatown: 'The medicine halls say business is good. Even the goblins stay away from Pagoda Street now.',
  'MacRitchie Reservoir': 'The macaques have learnt some manners. Mostly. Hold your snacks tight anyway.',
  'Pulau Ubin': 'More families come back on weekends now. The bumboat uncle is very happy.',
  'Bukit Timah': 'The trail is busy every morning. Watch out for wild boar after dark.',
  'Sentosa Beach': 'The tourists keep losing things in the sand. A metal detector would make you rich.',
  'Marina Bay': 'The new hawkers by the bay are doing well. Their laksa queue is very long.',
  'Kranji Farmlands': 'The farms need rain. Pray for a wet week, ya.',
  'Changi Coast': 'Coast guard boats out every night now. Something about smugglers.',
};
export const NEWS_FALLBACK = 'Quiet lah, nothing much. People here just glad you’re around.';

// ---------------- Boss taunts ----------------
// Shouted once when a boss turns on you. By boss id first, then by race.
export const BOSS_TAUNTS_BY_ID = {
  boar_king: 'GRRUNT! Off my hill, little {class}!',
  goblin_warchief: 'Another shiny one! I keep your helmet, yes?',
  macaque_alpha: 'Ook! Your snacks belong to the troop now!',
  chilli_crab: 'CLACK CLACK! I eat {class}s with chilli sauce!',
  nian_beast: 'No firecrackers, no lanterns... and no escape!',
  buaya_putih: 'The river remembers every fool who crossed it.',
  hantu_tinggi: 'Look up, {name}... higher... higher...',
  ubin_stone_frog: 'Ribbit. Stone does not fear you.',
  spider_queen: 'Such a lovely web you walked into.',
  reservoir_serpent: 'Hssss... the reservoir is mine.',
};
export const BOSS_TAUNTS_BY_RACE = {
  beast: ['RRRAAARGH!', 'Fresh meat walks in by itself.'],
  reptile: ['Hsss... warm blood, how nice.', 'Cold scales, colder heart.'],
  dragon: ['Kneel, little {class}, and burn quickly.', 'I have outlived kingdoms. I will outlive you.'],
  aquatic: ['The tide takes everyone in the end.', 'CLACK! Too slow!'],
  bug: ['Skitter skitter... you look tasty.', 'The swarm hungers.'],
  avian: ['SCREEE! From above, you are nothing!', 'My talons are sharper than your blade.'],
  undead: ['Join us, {name}... it is quiet here.', 'Your bones will rattle with mine.'],
  spirit: ['Why do you disturb my rest?', 'Turn back, or never leave.'],
  construct: ['INTRUDER. LEVEL {level}. INSUFFICIENT.', 'Stone does not tire.'],
  humanoid: ['You picked the wrong fight, {class}.', 'Level {level}? Cute.'],
  demon: ['Your soul will make a fine trinket.', 'The Rift sends its regards.'],
  flora: ['Roots everywhere, {name}. Everywhere.', 'Grow... and consume.'],
};
export const BOSS_TAUNT_FALLBACK = ['You dare challenge me?', 'Come then, {name}!'];
