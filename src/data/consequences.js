// Choices that change the world: what your moral choices (moralEvents.js) and
// finished region quest lines (regionQuests.js) leave behind. Each entry is a
// visible change that holds for the rest of the save. Nothing new is saved for
// them: they follow from the choices and quests the save already keeps, so a
// reload puts the same world back. src/game/consequences.js applies them.
//
// Fields:
//   id, region   the change and the region it shows in (the Regions journal lists it there)
//   when         { moral: id, side: 'good'|'evil' } or { quest: id } (that quest done)
//   text         one line for the Regions journal: what is different now
//   announce     said in the chat when it first happens
//   mood         +1 the region's light is a touch warmer and brighter, -1 a touch gloomier
//   price        { shop, buy } your buying price at that shop is multiplied by `buy`
//   npc          a resident who turns up (see RESIDENTS) — by id
//   leaves       a resident who packs up and goes — by id
//
// Residents are people only the living world places: they take an existing
// NPC's body (`art`) but are drawn by their own townsfolk picture
// (assets/creatures/townsfolk/<id>.webp; the borrowed one until it arrives), and keep a routine
// (npcchatter.js ROUTINES) like the townsfolk. `always` residents are there
// from the start (until a consequence sends them away); the rest arrive with one.
import { SHOPS } from './shops.js';

export const RESIDENTS = {
  life_faridah: {
    name: 'Mak Cik Faridah', art: 'villager', region: 'Kampong Glam', at: [66, 58], routine: 'stall',
    examine: 'The mother of the little boy you walked home. She keeps an eye out for you now.',
    lines: ['{name}! My boy talks about you every day.', 'Come, come, have some kueh.', 'You are always welcome at our table.'],
  },
  life_ah_huat: {
    name: 'Ah Huat', art: 'mercenary_sellsword', region: 'Bukit Timah', at: [60, 36], routine: 'stall',
    role: 'shop', shop: 'life_kaya_stall',
    examine: 'Once a bandit, now he sells kaya toast. His bandages are gone.',
    lines: ['Kaya toast! Half-boiled eggs! Honest price!', 'You bandaged me, I feed you. Fair, right?', 'Honest work feels good, lah.'],
  },
  life_auntie_kim: {
    name: 'Auntie Kim', art: 'hawker', region: 'Marina Bay', at: [197, 141], routine: 'stall',
    role: 'shop', shop: 'life_laksa_stall', always: true,
    examine: 'The new laksa hawker by the bay. Her rival next door glares at her.',
    lines: ['Laksa! Thick gravy, plenty of cockles!', 'New stall, same old family recipe.', 'Queue a bit, worth it one.'],
  },
  life_ubin_mum: {
    name: 'Kampong mother', art: 'villager', region: 'Pulau Ubin', at: [193, 59], routine: 'villager',
    examine: 'Her family moved back into the patched-up kampong house.',
    lines: ['The roof doesn’t leak any more!', 'The kids love it here, so much space.'],
  },
  life_ubin_dad: {
    name: 'Kampong father', art: 'villager', region: 'Pulau Ubin', at: [199, 59], routine: 'villager',
    examine: 'He fixes bicycles for Uncle Ah Seng on weekends.',
    lines: ['Back in the kampong, back to basics.', 'Uncle Seng says you did the repairs. Thank you, ah.'],
  },
  life_hiker: {
    name: 'Weekend hiker', art: 'villager', region: 'MacRitchie Reservoir', at: [42, 57], routine: 'villager',
    examine: 'Back on the TreeTop Walk now the macaques behave.',
    lines: ['The trail is so peaceful now.', 'Ten kilometres today! Shiok.', 'I still hold my bag tight, just in case.'],
  },
  life_lucky: {
    name: 'Lucky', art: 'stray_dog', region: 'MacRitchie Reservoir', at: [37, 57], routine: 'stall',
    examine: 'The stray you helped. Ranger Siti feeds him now, and his paw has healed.',
    lines: ['Woof!', '(Lucky wags his whole body at you.)', 'Arf arf!'],
  },
};

// The two new stalls (merged into SHOPS below).
export const LIFE_SHOPS = {
  life_kaya_stall: {
    name: "Ah Huat's Kaya Toast", buyMul: 0.9, sellMul: 0.4, buysAnything: false,
    stock: [{ id: 'kaya_toast', qty: 100 }, { id: 'roti_prata', qty: 60 }, { id: 'chicken_rice', qty: 40 }],
  },
  life_laksa_stall: {
    name: "Auntie Kim's Laksa", buyMul: 1.0, sellMul: 0.4, buysAnything: false,
    stock: [{ id: 'laksa', qty: 80 }, { id: 'satay', qty: 80 }, { id: 'nasi_lemak', qty: 60 }],
  },
};
for (const [id, s] of Object.entries(LIFE_SHOPS)) if (!SHOPS[id]) SHOPS[id] = s;

export const CONSEQUENCES = [
  { id: 'faridah_stays', region: 'Kampong Glam', when: { moral: 'lost_child', side: 'good' }, npc: 'life_faridah',
    text: 'Mak Cik Faridah, the lost boy’s mother, now keeps a stall by the kopitiam and greets you warmly.',
    announce: 'Word of your kindness spreads: Mak Cik Faridah has set up by the Kampong Glam kopitiam.' },
  { id: 'kampong_wary', region: 'Kampong Glam', when: { moral: 'lost_child', side: 'evil' }, price: { shop: 'general', buy: 1.1 },
    text: 'Kampong Glam remembers the stolen purse: the General Store charges you 10% more.',
    announce: 'Word gets round Kampong Glam: the General Store will charge you 10% more.' },
  { id: 'hawker_cockles', region: 'Chinatown', when: { moral: 'hawker_change', side: 'good' }, price: { shop: 'hawker', buy: 0.9 },
    text: 'The hawker auntie never forgets an honest customer: 10% off her food.',
    announce: 'The hawker auntie will give you 10% off from now on. Extra cockles!' },
  { id: 'hawker_grudge', region: 'Chinatown', when: { moral: 'hawker_change', side: 'evil' }, price: { shop: 'hawker', buy: 1.1 },
    text: 'The hawker auntie counts your change twice now, and charges 10% more.',
    announce: 'The hawker auntie has noticed her till was short. Her food costs you 10% more now.' },
  { id: 'kaya_stall', region: 'Bukit Timah', when: { moral: 'beaten_bandit', side: 'good' }, npc: 'life_ah_huat',
    text: 'Ah Huat, the bandit you spared, has gone straight: he sells kaya toast on the Bukit Timah trail.',
    announce: 'The bandit you spared has gone straight: Ah Huat now sells kaya toast on Bukit Timah.' },
  { id: 'ubin_blessed', region: 'Pulau Ubin', when: { moral: 'temple_box', side: 'good' }, mood: 1,
    text: 'The little temple’s joss smoke curls gold: Pulau Ubin feels a touch brighter.',
    announce: 'The temple on Pulau Ubin glows a little warmer since your gift.' },
  { id: 'ubin_shadowed', region: 'Pulau Ubin', when: { moral: 'temple_box', side: 'evil' }, mood: -1,
    text: 'The empty donation box weighs on the island: Pulau Ubin feels a touch gloomier.',
    announce: 'Pulau Ubin feels a little gloomier since the temple box was emptied.' },
  { id: 'laksa_thanks', region: 'Marina Bay', when: { moral: 'rival_stall', side: 'good' }, price: { shop: 'life_laksa_stall', buy: 0.85 },
    text: 'Auntie Kim kept her laksa stall thanks to your warning: 15% off for you.',
    announce: 'Auntie Kim will give you 15% off her laksa from now on.' },
  { id: 'laksa_gone', region: 'Marina Bay', when: { moral: 'rival_stall', side: 'evil' }, leaves: 'life_auntie_kim',
    text: 'Auntie Kim’s laksa was ruined: she packed up her stall and left Marina Bay.',
    announce: 'Auntie Kim has packed up her laksa stall and left Marina Bay for good.' },
  { id: 'kranji_green', region: 'Kranji Farmlands', when: { moral: 'farmer_drought', side: 'good' }, mood: 1,
    text: 'The kangkong is thriving: Kranji’s fields look greener and brighter.',
    announce: 'Kranji’s fields are green again: the farmlands look brighter.' },
  { id: 'kranji_withered', region: 'Kranji Farmlands', when: { moral: 'farmer_drought', side: 'evil' }, mood: -1,
    text: 'Fake fertiliser and a dry spell: Kranji’s fields look grey and tired.',
    announce: 'Kranji’s crops are failing: the farmlands look gloomier.' },
  { id: 'lucky_stays', region: 'MacRitchie Reservoir', when: { moral: 'stray_dog', side: 'good' }, npc: 'life_lucky',
    text: 'Lucky, the stray you helped, lives by the ranger station now.',
    announce: 'The stray you helped has a name now, Lucky, and a home by the MacRitchie ranger station.' },
  { id: 'chinatown_lanterns', region: 'Chinatown', when: { quest: 'rq_chinatown' }, mood: 1,
    text: 'Madam Tan’s lanterns are back: Pagoda Street glows a little warmer.',
    announce: 'Pagoda Street’s lanterns are lit again: Chinatown glows a little warmer.' },
  { id: 'ubin_family', region: 'Pulau Ubin', when: { quest: 'rq_pulau_ubin' }, npc: ['life_ubin_mum', 'life_ubin_dad'],
    text: 'A family has moved back into the kampong houses you patched.',
    announce: 'A family has moved back into the kampong on Pulau Ubin.' },
  { id: 'macritchie_hikers', region: 'MacRitchie Reservoir', when: { quest: 'rq_macritchie' }, npc: 'life_hiker',
    text: 'With the macaques calmed, hikers are back on the TreeTop Walk.',
    announce: 'Hikers are back on the MacRitchie trails now the macaques behave.' },
];
export const CONSEQUENCE_BY_ID = Object.fromEntries(CONSEQUENCES.map((c) => [c.id, c]));
