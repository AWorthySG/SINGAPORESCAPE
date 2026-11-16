// Moral choice encounters: one-off moments around the island where you pick a
// good or an evil answer, so your alignment is something you decide rather than
// a side effect of fighting. Each is a person (or a hurt dog) standing at a
// fixed spot; talking to them opens the usual dialogue box with two choices.
//
// Rewards are lopsided on purpose: evil pays coins (and loot) right now, good
// pays in XP, Offering Shrine points and the Blessed buff (+15% combat XP for
// a while). Coins scale with your fight level (moralCoins) and XP with the
// skill's level (a share of the XP to its next level), so an encounter is
// still worth thinking about whenever you find it.
//
// Fields:
//   art      an existing NPC id whose painted art the encounter wears (no new art)
//   x, y     where they stand (the game nudges them to the nearest free tile)
//   name     the name shown over them; `text` sets the scene
//   good / evil: { label, outcome, karma, skill?, xp? (share of a level),
//     shrine? (shrine points), bless? (Blessed buff), cost? (coins you give,
//     scaled like coins), coins? (coins you get, scaled), items? [[id, qty]] }
//   after    what they say if you talk to them again, by the side you chose
//
// Each one can be done once per save (game.moral.choices).

export const BLESS_MS = 10 * 60 * 1000;   // the Blessed buff lasts ten minutes
export const BLESS_XP = 1.15;             // ...and gives +15% combat XP

/** Coins an encounter pays (or asks for), scaled up with your fight level. */
export const moralCoins = (base, fightLevel) => Math.round(base * (1 + Math.max(1, fightLevel || 1) / 5));

export const MORAL_EVENTS = [
  {
    id: 'lost_child', art: 'villager', name: 'Crying kid', zone: 'Kampong Glam', x: 66, y: 57,
    text: 'A little boy is sobbing by the kopitiam, clutching a fat purse. "Mummy put it down to buy teh tarik and now she\'s gone!"',
    good: { label: 'Help him find his mum (Good)', karma: 10, skill: 'agility', xp: 0.3, shrine: 60,
      outcome: 'You walk him round every stall until a frantic auntie scoops him up. She presses your hand: "Thank you, thank you!"' },
    evil: { label: 'Take the purse off his hands (Evil)', karma: 10, coins: 60,
      outcome: '"I\'ll look after that for you." You walk off with the purse while he cries even louder.' },
    after: { good: 'Uncle! Mummy says you are a hero!', evil: 'You took Mummy\'s purse! Go away!' },
  },
  {
    id: 'hawker_change', art: 'hawker', name: 'Flustered hawker', zone: 'Chinatown', x: 86, y: 61,
    text: 'The lunch rush is chaos. The hawker auntie hands you change for your char kway teow... a whole $50 too much. She hasn\'t noticed.',
    good: { label: 'Give back the extra change (Good)', karma: 8, skill: 'cooking', xp: 0.3, bless: true,
      outcome: '"Aiyoh, so honest!" She teaches you the secret to her wok hei as thanks.' },
    evil: { label: 'Pocket it and walk away (Evil)', karma: 8, coins: 50,
      outcome: 'You fold the notes into your pocket. Her till will be short tonight.' },
    after: { good: 'Eh, my honest customer! Extra cockles for you.', evil: 'My till was short that day, you know...' },
  },
  {
    id: 'beaten_bandit', art: 'mercenary_sellsword', name: 'Beaten bandit', zone: 'Bukit Timah', x: 62, y: 38,
    text: 'A bandit lies bruised in the undergrowth, left behind by his gang. "Please... I only robbed one durian stall. Spare me?"',
    good: { label: 'Bandage him and let him go (Good)', karma: 12, skill: 'herblore', xp: 0.3, shrine: 80,
      outcome: 'You bind his wounds with jungle leaves. He swears to go straight and tells you which herbs heal best.' },
    evil: { label: 'Rob him and leave him in the mud (Evil)', karma: 12, coins: 90, skill: 'thieving', xp: 0.15,
      outcome: 'You empty his pockets and leave him groaning in the mud. His pouch was heavier than a durian thief\'s should be.' },
    after: { good: 'Selling kaya toast now. Honest work, lah!', evil: 'Ugh... not you again...' },
  },
  {
    id: 'stray_dog', art: 'stray_dog', name: 'Injured stray dog', zone: 'MacRitchie Reservoir', x: 40, y: 58,
    text: 'A skinny stray limps towards you, one paw bloody from a fishing hook. It has an expensive-looking old collar.',
    good: { label: 'Pull out the hook and feed it (Good)', karma: 10, skill: 'hunter', xp: 0.3, bless: true,
      outcome: 'You ease the hook out and share your food. It licks your hand and trots off, tail wagging.' },
    evil: { label: 'Take the collar and shoo it off (Evil)', karma: 10, coins: 70,
      outcome: 'The collar\'s silver tag fetches a good price. The dog whimpers into the bushes.' },
    after: { good: 'Woof! (It wags its tail at you.)', evil: 'Grrr... (It backs away from you.)' },
  },
  {
    id: 'lost_wallet', art: 'villager', name: 'Sunburnt tourist', zone: 'Sentosa Beach', x: 58, y: 89,
    text: 'A sunburnt tourist hurries for the MRT. A wallet stuffed with dollars slips out of his beach bag onto the sand behind him.',
    good: { label: 'Run after him with it (Good)', karma: 8, skill: 'agility', xp: 0.3, shrine: 60,
      outcome: 'You sprint down the beach and catch him at the gate. "Singapore is so friendly!" he beams.' },
    evil: { label: 'Keep the wallet (Evil)', karma: 8, coins: 80,
      outcome: 'You scoop it up and stroll the other way. He\'ll have a long walk to his hotel.' },
    after: { good: 'You saved my holiday, my friend!', evil: 'Have you seen my wallet? No...?' },
  },
  {
    id: 'temple_box', art: 'villager', name: 'Dozing caretaker', zone: 'Pulau Ubin', x: 190, y: 50,
    text: 'The caretaker of Ubin\'s little temple is snoring in the shade. The donation box beside him rattles with coins, unlocked.',
    good: { label: 'Add a few coins to the box (Good)', karma: 12, cost: 15, skill: 'prayer', xp: 0.35, bless: true, shrine: 100,
      outcome: 'Your coins clink in. The joss smoke curls round you and you feel strangely light.' },
    evil: { label: 'Empty the donation box (Evil)', karma: 15, coins: 120,
      outcome: 'You scoop out every coin. The caretaker murmurs in his sleep and doesn\'t wake.' },
    after: { good: 'The gods smile on you, friend.', evil: 'Someone robbed the temple box... you wouldn\'t know who, ah?' },
  },
  {
    id: 'smuggler', art: 'mercenary_duellist', name: 'Shifty smuggler', zone: 'Changi Coast', x: 268, y: 50,
    text: '"Psst. Help me carry these crates past the coast guard. No questions. Very good pay." The crates clink suspiciously.',
    good: { label: 'Refuse and tip off the coast guard (Good)', karma: 12, skill: 'slayer', xp: 0.3, shrine: 80,
      outcome: 'The coast guard nab him at the jetty. The officer shakes your hand and tells you where the real monsters lurk.' },
    evil: { label: 'Carry the crates (Evil)', karma: 12, coins: 140, skill: 'thieving', xp: 0.2,
      outcome: 'You lug the crates past the patrol, cool as you like. He pays in crisp notes.' },
    after: { good: 'You! The snitch! Wait till I get out...', evil: 'Same time next week, partner?' },
  },
  {
    id: 'rival_stall', art: 'shopkeeper', name: 'Jealous stallholder', zone: 'Marina Bay', x: 194, y: 140,
    text: '"That new stall next door is stealing all my customers. Pour this whole bag of salt into her laksa pot and I\'ll pay you well."',
    good: { label: 'Refuse, and warn the other hawker (Good)', karma: 10, skill: 'cooking', xp: 0.3, shrine: 60,
      outcome: 'The new hawker thanks you with a bowl of her laksa and a tip on balancing spice.' },
    evil: { label: 'Salt the laksa (Evil)', karma: 10, coins: 100,
      outcome: 'Customers spit out their laksa. The stallholder grins and counts out your fee.' },
    after: { good: 'Hmph. Nobody helps a poor stallholder...', evil: 'Business is booming, thanks to you!' },
  },
  {
    id: 'lost_aworthling', art: 'aworthling', name: 'Lost A-Worthling', zone: 'Gardens by the Bay', x: 340, y: 52,
    text: 'A little A-Worthling shimmers among the Supertrees, lost and fading. Collectors would pay a fortune for a bottled one.',
    good: { label: 'Guide it back to the light (Good)', karma: 12, skill: 'magic', xp: 0.3, bless: true, shrine: 80,
      outcome: 'You lead it to a beam of sunlight. It glows brighter, bows, and drifts home.' },
    evil: { label: 'Bottle it and sell it (Evil)', karma: 15, coins: 150, items: [['chaos_rune', 40]],
      outcome: 'It flickers in the jar. The collector pays in coins and runes, and doesn\'t ask questions.' },
    after: { good: '(It glimmers happily.)', evil: '(Its friends flicker away from you.)' },
  },
  {
    id: 'farmer_drought', art: 'farmer', name: 'Worried farmer', zone: 'Kranji Farmlands', x: 448, y: 126,
    text: 'The dry spell is killing his kangkong. "I need water hauled from the canal... or someone to buy my land before I lose everything."',
    good: { label: 'Haul water for his fields (Good)', karma: 10, skill: 'farming', xp: 0.3, shrine: 60, items: [['nasi_lemak', 3]],
      outcome: 'Bucket after bucket, the fields drink. He packs you a lunch and shows you his best planting tricks.' },
    evil: { label: 'Sell him fake fertiliser (Evil)', karma: 10, coins: 110,
      outcome: 'You sell him a sack of sand at a premium. His crops won\'t notice the difference... until they do.' },
    after: { good: 'The kangkong is growing again, thanks to you!', evil: 'That "fertiliser" was sand!' },
  },
  {
    id: 'old_fisherman', art: 'villager', name: 'Old fisherman', zone: 'Punggol Waterway', x: 444, y: 45,
    text: 'An old fisherman struggles with a hopelessly tangled net. His bucket of fresh catch sits unattended behind him.',
    good: { label: 'Help untangle his net (Good)', karma: 8, skill: 'fishing', xp: 0.3, bless: true,
      outcome: 'Knot by knot, you free the net. He shares the river\'s secrets: where the big ones bite.' },
    evil: { label: 'Swipe his catch (Evil)', karma: 8, coins: 60, items: [['salmon', 4]],
      outcome: 'You grab the bucket while he\'s busy. Fresh salmon, free.' },
    after: { good: 'The fish are biting today, friend.', evil: 'Where did my catch go...?' },
  },
  {
    id: 'wounded_scout', art: 'mercenary_bruiser', name: 'Wounded scout', zone: 'The Shadow Rift', x: 262, y: 217,
    text: 'A scout staggers back from the Rift, bleeding. "Food... please. And my rune pouch... keep it safe for me."',
    good: { label: 'Share your food and guard his pouch (Good)', karma: 15, skill: 'hitpoints', xp: 0.3, bless: true, shrine: 120,
      outcome: 'You patch him up and hand back his pouch untouched. He salutes you: "The Rift needs more like you."' },
    evil: { label: 'Rob him of his runes (Evil)', karma: 15, coins: 160, items: [['death_rune', 60]],
      outcome: 'You take the pouch and leave him to the shadows.' },
    after: { good: 'Back on my feet, thanks to you.', evil: 'Thief... the Rift take you...' },
  },
];

export const MORAL_BY_ID = Object.fromEntries(MORAL_EVENTS.map((e) => [e.id, e]));

/** The dialogue tree (dialogue.js format) for an encounter: the scene and its
 *  two choices, or just their parting line once you have chosen. `opts`:
 *  { chosen: 'good'|'evil'|undefined, canAfford: bool (for a good choice that
 *  costs coins), cost: the scaled coin price to show }. */
export function moralDialogue(id, { chosen, canAfford = true, cost = 0 } = {}) {
  const ev = MORAL_BY_ID[id];
  if (!ev) return null;
  if (chosen) {
    return { start: { speaker: ev.name, text: ev.after[chosen] || '...', options: [{ label: 'Goodbye.', next: 'end' }] } };
  }
  const good = ev.good.cost
    ? (canAfford ? { label: `${ev.good.label.replace(' (Good)', '')} [${cost} coins] (Good)`, next: 'good', action: `moral:${id}:good` }
      : { label: `${ev.good.label.replace(' (Good)', '')} [need ${cost} coins]`, next: 'start' })
    : { label: ev.good.label, next: 'good', action: `moral:${id}:good` };
  return {
    start: { speaker: ev.name, text: ev.text, options: [good, { label: ev.evil.label, next: 'evil', action: `moral:${id}:evil` }, { label: 'Walk away.', next: 'end' }] },
    good: { speaker: ev.name, text: ev.good.outcome, options: [{ label: 'Farewell.', next: 'end' }] },
    evil: { speaker: ev.name, text: ev.evil.outcome, options: [{ label: 'Leave.', next: 'end' }] },
  };
}
