// Hawkering: your own stall at the Marina Bay hawker centre (src/game/hawkerstall.js
// runs it; src/ui/hawkerui.js is its window).
//
// Rent the stall once, stand at it and open up: townsfolk queue at your
// counters, each with an order and a patience meter. Serve them dishes you
// carry (or keep in the bank: a runner fetches them) for coins, tips and
// Hawkering XP; serve a run without anyone walking off for bigger tips, and
// the stall's reputation grows. Auto-serve (the auto gather switch) keeps
// serving from what you carry. Levels bring more counters, faster service, VIP
// regulars with special orders, and signature dishes you cook at the stall's
// own wok from ingredients the Hawker Auntie sells.
//
// Kept free of items.js: items.js reads hawkerItems() from here.

/** What renting the stall costs, once. */
export const STALL_RENT = 5000;

// What customers order: every dish the stall can serve, the Hawkering level it
// needs and its listed XP a serve (times HAWKER_XP_MULT at your level, in
// hawkerstall.js, fitted so an hour of auto-serve pays what the making skills
// do). Customers only order what you have (pack and bank); most order the best
// dish you can serve. Hawker classics first, then the Cooking dishes, then the
// endgame dishes (Cooking 100-300) from level 100.
export const ORDERS = [
  { id: 'kaya_toast', level: 1, xp: 8 },
  { id: 'teh_tarik', level: 4, xp: 10 },
  { id: 'roti_prata', level: 8, xp: 12 },
  { id: 'chicken_rice', level: 12, xp: 15 },
  { id: 'satay', level: 18, xp: 18 },
  { id: 'laksa', level: 24, xp: 21 },
  { id: 'char_kway_teow', level: 30, xp: 24 },
  { id: 'nasi_lemak', level: 36, xp: 27 },
  { id: 'seafood_stew', level: 45, xp: 31 },
  { id: 'boar_rendang', level: 52, xp: 34 },
  { id: 'seafood_platter', level: 62, xp: 38 },
  { id: 'fish_head_curry', level: 75, xp: 43 },
  // Endgame orders (Hawkering 100-300): the endgame dishes.
  { id: 'grilled_dorado', level: 100, xp: 52 },
  { id: 'tuna_sashimi', level: 130, xp: 62 },
  { id: 'sambal_sailfish', level: 160, xp: 73 },
  { id: 'moonfish_curry', level: 200, xp: 86 },
  { id: 'rift_eel_claypot', level: 250, xp: 100 },
  { id: 'arowana_feast', level: 300, xp: 116 },
];
export const ORDER_BY_ID = Object.fromEntries(ORDERS.map((o) => [o.id, o]));

// Signature dishes, cooked at the stall's wok from ingredients (the Hawker
// Auntie sells the dry goods; eggs, herbs, chicken and fish from the other
// skills). One make is instant, like every station (autoprocess.js), and pays
// a little Hawkering XP as listed: the skill is trained by serving.
export const SIGNATURE = [
  { result: 'kaya_toast', qty: 2, inputs: [['bread', 1], ['egg', 1], ['pandan_leaves', 1]], level: 1, xp: 6 },
  { result: 'teh_tarik', qty: 2, inputs: [['tea_leaves', 1], ['condensed_milk', 1]], level: 4, xp: 7 },
  { result: 'roti_prata', qty: 2, inputs: [['flour', 1], ['egg', 1]], level: 8, xp: 8 },
  { result: 'chicken_rice', qty: 1, inputs: [['rice', 1], ['cooked_chicken', 1], ['pandan_leaves', 1]], level: 12, xp: 10 },
  { result: 'satay', qty: 1, inputs: [['cooked_chicken', 1], ['lemongrass', 1]], level: 18, xp: 12 },
  { result: 'laksa', qty: 1, inputs: [['kway_teow', 1], ['mackerel', 1], ['chilli', 1]], level: 24, xp: 14 },
  { result: 'char_kway_teow', qty: 1, inputs: [['kway_teow', 1], ['egg', 1], ['chilli', 1], ['anchovy', 1]], level: 30, xp: 16 },
  { result: 'nasi_lemak', qty: 1, inputs: [['rice', 1], ['anchovy', 1], ['egg', 1], ['chilli', 1]], level: 36, xp: 18 },
];
export const SIGNATURE_IDS = new Set(SIGNATURE.map((r) => r.result));

// The stall grows with your level: more counters (customers who can wait at
// once), and faster service (game ticks between serves). Each row holds from
// its level up.
export const SERVICE = [
  { level: 1, counters: 2, ticks: 4 },
  { level: 15, counters: 3, ticks: 4 },
  { level: 30, counters: 3, ticks: 3, faster: true },
  { level: 45, counters: 4, ticks: 3 },
  { level: 60, counters: 5, ticks: 2, faster: true },
  { level: 90, counters: 6, ticks: 2 },
];
/** The stall's service at a Hawkering level: { counters, ticks }. */
export function serviceAt(level) {
  let s = SERVICE[0];
  for (const r of SERVICE) if (level >= r.level) s = r;
  return s;
}

// Customers. Patience is in game ticks; each tick a customer waits it runs
// down, and at nothing they walk off (the streak ends and the stall's
// reputation dips). Regulars are townsfolk with painted portraits.
export const PATIENCE = 30;
export const CUSTOMERS = ['villager', 'life_ah_huat', 'life_auntie_kim', 'life_faridah', 'life_hiker', 'rq_ah_peng', 'rq_aisha', 'rq_darren',
  'rq_goh', 'rq_hafiz', 'rq_kamal', 'rq_kumar', 'rq_lin', 'rq_mei_ling', 'rq_nadia', 'rq_osman', 'rq_priya', 'rq_wei_jie', 'rq_zainab'];
// VIP regulars (Hawkering 40): now and then one of them comes by with a
// special order, a signature dish or a combo of two, more patient and with a
// much bigger tip. Their lines are in Singlish, cosy and kind.
export const VIP_LEVEL = 40;
export const VIP_CHANCE = 0.08;
export const VIPS = [
  { id: 'rq_uncle_seng', line: 'Uncle want the usual, ah. Take your time, no rush.' },
  { id: 'rq_madam_tan', line: 'My grandson say your stall is the best. Prove him right, OK?' },
  { id: 'rq_rosnah', line: 'Two plates please, one for my neighbour. She just came back from hospital.' },
  { id: 'life_auntie_kim', line: 'Wah, so long queue! Never mind, I wait for you.' },
  { id: 'rq_keeper_hui', line: 'Packet, ah. Extra chilli, if can.' },
];

// Coins. A customer pays a hawker's fair price, about what a shop would give
// for the dish (PRICE_SHARE of its value), plus up to REP_PRICE more from the
// stall's reputation, and a tip: TIP_BASE, more for a short wait (TIP_FAST at
// once), more again on a long streak (STREAK_TIP at STREAK_TOP serves), and
// VIP_TIP times for a VIP. So a dish fetches about 1.3 times a shop's price
// (see the PR's economy note): never a coin machine beside selling the catch.
export const PRICE_SHARE = 0.5;
export const REP_MAX = 100;
export const REP_PRICE = 0.2;
export const TIP_BASE = 0.05;
export const TIP_FAST = 0.2;
export const STREAK_TOP = 100;
export const STREAK_TIP = 0.5;
export const VIP_TIP = 3;
// Reputation: a serve on time adds REP_SERVE, a walk-off takes REP_LOST.
export const REP_SERVE = 0.05;
export const REP_LOST = 2;

/** The ingredients and dishes Hawkering adds, as items.js wants them. Until
 *  their own stickers arrive each borrows one, recoloured (`artFrom`, icons.js). */
export function hawkerItems() {
  const dry = (name, icon, value, examine, artFrom) => ({ name, icon, value, stackable: true, tags: ['ingredient'], artFrom, examine: `${examine} The Hawker Auntie sells it.` });
  return {
    bread: dry('Bread', '🍞', 3, 'A soft white loaf, for kaya toast.', ['kaya_toast', 'saturate(0.4) brightness(1.15)']),
    tea_leaves: dry('Tea leaves', '🍃', 3, 'Strong black tea, for teh tarik.', ['pandan_leaves', 'sepia(0.8) hue-rotate(-20deg) brightness(0.8)']),
    condensed_milk: dry('Condensed milk', '🥫', 4, 'A tin of sweet condensed milk.', ['jug', 'sepia(0.3) brightness(1.05)']),
    flour: dry('Flour', '🌾', 3, 'Plain flour, for roti prata.', ['clay', 'grayscale(1) brightness(1.7)']),
    rice: dry('Rice', '🍚', 4, 'A bag of fragrant rice.', ['bowl', 'saturate(0.3) brightness(1.2)']),
    kway_teow: dry('Kway teow', '🍜', 5, 'Flat rice noodles, for laksa and char kway teow.', ['laksa', 'grayscale(0.7) brightness(1.2)']),
    teh_tarik: { name: 'Teh tarik', icon: '🧋', value: 12, heal: 4, examine: 'Pulled milk tea, frothy and sweet. Shiok!', artFrom: ['jug', 'sepia(0.9) saturate(1.4) brightness(0.9)'] },
    char_kway_teow: { name: 'Char kway teow', icon: '🍝', value: 70, heal: 13, examine: 'Smoky fried flat noodles with egg and chilli. Got wok hei!',
      artFrom: ['laksa', 'sepia(0.6) saturate(1.5) hue-rotate(-15deg) brightness(0.85)'] },
  };
}
