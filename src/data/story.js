// The main story, "The Shadow Rift": one storyline told in twelve chapters that
// tie the region quest lines (regionQuests.js) and a few of the island's story
// quests (quests.js) into a journey from Kampong Glam out to The Celestial Peaks.
// The engine that runs it is src/game/story.js; this file is only data.
//
// Something is tearing the Shadow Rift open. Long ago the first king of Temasek
// shut the First Dark under the island with a seal of starlight; now the seal's
// stones have been broken and sold as "shadow glass", and the stars that keep
// it shut are being eaten. Every region's trouble is a clue.
//
// A chapter: { id, title, regions (where it happens), quests (all must be done),
//   summary (one line for the journal), intro / outro (2-4 lines, each
//   { who: npcId, text }: who speaks, from the townsfolk or quest givers),
//   reward: { coins, item: [id, qty], title, badge } }.
// Chapters are played in order: the next one opens when the one before is done.
// A quest finished early still counts, so a chapter can open already complete.

export const STORY_NAME = 'The Shadow Rift';

export const CHAPTERS = [
  {
    id: 'ch1', title: 'Lights over the Strait', regions: ['Kampong Glam', 'Chinatown'],
    quests: ['rq_kampong_glam', 'rq_chinatown', 'pillars'],
    summary: 'A purple light flickers over the sea at night, and the kampong creatures are restless.',
    intro: [
      { who: 'guide', text: 'Ah, you’re awake! Did you see it last night? A crack of purple light, right over the strait.' },
      { who: 'guide', text: 'Since then the rats, the roosters, even the goblins on the hill have gone a bit gila.' },
      { who: 'guide', text: 'Help the folk of Kampong Glam and Chinatown, and honour the island’s two pillars. Maybe the old stones know something.' },
    ],
    outro: [
      { who: 'rq_madam_tan', text: 'The goblins only took my lanterns because they were frightened of the dark. Goblins! Frightened!' },
      { who: 'rq_madam_tan', text: 'Something out east scares them more than any lantern. Go and ask the rangers, they see everything.' },
    ],
    reward: { coins: 400, item: ['healing_potion', 3], title: 'Kampong Friend', badge: '🏮' },
  },
  {
    id: 'ch2', title: 'Restless Wilds', regions: ['MacRitchie Reservoir', 'Pulau Ubin', 'Bukit Timah'],
    quests: ['rq_macritchie', 'rq_pulau_ubin', 'rq_bukit_timah'],
    summary: 'The wild animals are fleeing something. From the top of Bukit Timah you might see what.',
    intro: [
      { who: 'rq_ranger_siti', text: 'The macaques came running from the east three nights ago, all screaming. Monkeys don’t scare easily, you know.' },
      { who: 'rq_ranger_siti', text: 'Lend a hand round MacRitchie and Ubin, then climb Bukit Timah with Mr Rajoo. You can see the whole island from up there.' },
    ],
    outro: [
      { who: 'rq_rajoo', text: 'Forty years I have climbed this hill, and I have never seen that before.' },
      { who: 'rq_rajoo', text: 'Look south. A dark seam in the sky, like a tear in old cloth. The Shadow Rift is opening wider.' },
    ],
    reward: { coins: 1200, item: ['attack_potion', 5], title: 'Trail Walker', badge: '🌿' },
  },
  {
    id: 'ch3', title: 'Wrong Tides', regions: ['Sungei Buloh Wetlands', 'Sentosa Beach', 'Changi Coast'],
    quests: ['rq_sungei_buloh', 'rq_sentosa', 'rq_changi'],
    summary: 'The birds fly the wrong way and the nets come up full of black glass.',
    intro: [
      { who: 'rq_mei_ling', text: 'The migrating birds are flying north when they should be landing. Something is pushing them away from the coast.' },
      { who: 'rq_mei_ling', text: 'Help me in the mangroves, then follow the shore down to Sentosa and Changi. The sea always tells.' },
    ],
    outro: [
      { who: 'rq_rosnah', text: 'Look what came up in Pak Din’s nets this morning. Black glass, cold as ice, humming like a fridge.' },
      { who: 'rq_rosnah', text: 'The crows fly off with any pieces we leave out. Farmer Kumar in Kranji says they’re all over his fields.' },
    ],
    reward: { coins: 2500, item: ['lobster', 10], title: 'Tide Reader', badge: '🐚' },
  },
  {
    id: 'ch4', title: 'Shadow Glass', regions: ['Kranji Farmlands', 'Jurong Forest'],
    quests: ['rq_kranji', 'rq_jurong'],
    summary: 'Crows hoard the black glass, and poachers are selling it in Jurong.',
    intro: [
      { who: 'rq_kumar', text: 'The crows don’t eat my crops any more. They steal shiny black stones and pile them on my scarecrow.' },
      { who: 'rq_kumar', text: 'Keeper Hui says poachers in Jurong pay good money for those stones. Who buys cursed glass, ah?' },
    ],
    outro: [
      { who: 'rq_keeper_hui', text: 'Kassim the Trapper talked, once he’d stopped sulking. A rich buyer in Marina Bay takes every piece of “shadow glass”.' },
      { who: 'rq_keeper_hui', text: 'And every time a piece is sold, the birds say the Rift grows a little wider.' },
    ],
    reward: { coins: 4000, item: ['pearl_amulet', 1], title: 'Glass Finder', badge: '🔮' },
  },
  {
    id: 'ch5', title: 'The Monk’s Warning', regions: ['Marina Bay', 'The Wilderness'],
    quests: ['rq_marina_bay', 'rq_wilderness', 'island_defender'],
    summary: 'A haunting in Marina Bay, and an old monk who remembers the Night Seal.',
    intro: [
      { who: 'rq_wei_jie', text: 'A guest left a case of black glass in the hotel safe. Since then, a wraith walks the Helix every midnight.' },
      { who: 'rq_wei_jie', text: 'Please, help me, then find the monk at the edge of the Wilderness. He knows about these things.' },
    ],
    outro: [
      { who: 'rq_monk', text: 'Long ago, the first king of Temasek shut the First Dark beneath this island with a seal of starlight.' },
      { who: 'rq_monk', text: 'Your “shadow glass” is the seal itself, broken and sold piece by piece. Each piece sold opens the Rift a little more.' },
      { who: 'rq_monk', text: 'Two seal stones were hidden far away: one with the sea, one with the tortoise. Find them before the buyers do.' },
    ],
    reward: { coins: 8000, item: ['super_might_potion', 3], title: 'Seal Seeker', badge: '📿' },
  },
  {
    id: 'ch6', title: 'Northern Waters', regions: ['Punggol Waterway', 'Gardens by the Bay'],
    quests: ['rq_punggol', 'rq_gardens'],
    summary: 'An old crocodile guarded a sea gate, and the Supertrees are drinking the dark.',
    intro: [
      { who: 'rq_osman', text: 'My grandfather said the Old Buaya guards a gate under Punggol Point. Now it bites anything that comes near.' },
      { who: 'rq_osman', text: 'Calm the waters for me. Then go and see Gardener Priya; her Supertrees have gone strange.' },
    ],
    outro: [
      { who: 'rq_priya', text: 'The Supertrees were pulling the dark out of the air, like roots pull water. Clever trees.' },
      { who: 'rq_priya', text: 'They can’t hold much more. Whatever you do next, do it quickly, ya?' },
    ],
    reward: { coins: 15000, item: ['refine_scroll', 2], title: 'Gardener of Light', badge: '🌸' },
  },
  {
    id: 'ch7', title: 'Islands of the Lost', regions: ['Tekong Badlands', 'Pulau Hantu', 'Coney Island'],
    quests: ['rq_tekong', 'rq_pulau_hantu', 'rq_coney'],
    summary: 'Pirates, ghosts and rustlers all want a piece of the seal.',
    intro: [
      { who: 'rq_hafiz', text: 'Recruit! A pirate crew landed on my island digging for black glass. On my island!' },
      { who: 'rq_hafiz', text: 'Clear Tekong, then check the reefs of Pulau Hantu and the shore at Coney. The buyers are paying everyone now.' },
    ],
    outro: [
      { who: 'rq_ranger_boon', text: 'Ramli was hiding seal glass in the cow’s feed bucket. The cow did not approve.' },
      { who: 'rq_ranger_boon', text: 'He says the buyer sends a boat to Tuas every week. But first, the tortoise stone. Zookeeper Aisha knows the way.' },
    ],
    reward: { coins: 30000, item: ['upgrade_stone', 3], title: 'Island Hopper', badge: '🧭' },
  },
  {
    id: 'ch8', title: 'The Tortoise Stone', regions: ['Mandai Rainforest', 'Southern Islands'],
    quests: ['rq_mandai', 'rq_southern_islands'],
    summary: 'The night animals are afraid, and Kusu Island keeps a very old secret.',
    intro: [
      { who: 'rq_aisha', text: 'Even the leopards are hiding. The night belongs to something else now.' },
      { who: 'rq_aisha', text: 'Help me settle Mandai, then sail to Kusu. Temple Keeper Ah Peng will want to meet you.' },
    ],
    outro: [
      { who: 'rq_ah_peng', text: 'The story says a great tortoise turned itself into an island to save two shipwrecked sailors.' },
      { who: 'rq_ah_peng', text: 'It also carried a seal stone in its shell. It is still here, and it is warm. Take it into the Rift. It will light your way.' },
    ],
    reward: { coins: 60000, item: ['elixir_of_temasek', 2], title: 'Pilgrim', badge: '🐢' },
  },
  {
    id: 'ch9', title: 'Into the Rift', regions: ['The Shadow Rift'],
    quests: ['rq_shadow_rift'],
    summary: 'Carry the tortoise stone into the Shadow Rift itself.',
    intro: [
      { who: 'rq_kamal', text: 'You carry a light in there? Good. Nothing else works past the outpost.' },
      { who: 'rq_kamal', text: 'Something old is waking at the bottom of the Rift. Help me hold the line and we’ll see it with our own eyes.' },
    ],
    outro: [
      { who: 'rq_kamal', text: 'The Wraith of the First Dark is gone, but the tear is still open. The seal is still broken.' },
      { who: 'rq_kamal', text: 'The rest of the glass went out through Tuas. Get it back before it leaves the island.' },
    ],
    reward: { coins: 90000, item: ['super_haste_potion', 3], title: 'Riftwalker', badge: '🌑' },
  },
  {
    id: 'ch10', title: 'Smugglers’ Cargo', regions: ['Tuas Docklands'],
    quests: ['rq_tuas'],
    summary: 'The buyer’s boat waits at Tuas, loaded with seal glass.',
    intro: [
      { who: 'rq_goh', text: 'Every container on my list is accounted for, except the ones that hum.' },
      { who: 'rq_goh', text: 'The Container King runs the smuggling here. Stop him and the glass stays on the island.' },
    ],
    outro: [
      { who: 'rq_goh', text: 'Twelve crates of seal glass, all labelled “kitchen tiles”. Dr Nadia in the Temasek Ruins can put them back where they belong.' },
    ],
    reward: { coins: 120000, item: ['ruby_ring', 1], title: 'Harbour Hawk', badge: '⚓' },
  },
  {
    id: 'ch11', title: 'The Old Seal', regions: ['Temasek Ruins'],
    quests: ['rq_temasek'],
    summary: 'Under the ruins of old Temasek, the seal chamber waits.',
    intro: [
      { who: 'rq_nadia', text: 'The carvings match your glass exactly. This chamber held the Night Seal!' },
      { who: 'rq_nadia', text: 'A bronze sentinel still guards the deep chamber. Help me reach it and we can rebuild the seal, stone by stone.' },
    ],
    outro: [
      { who: 'rq_nadia', text: 'The seal is whole again, but it’s dark. It was lit by starlight, and the stars over the peaks are going out.' },
      { who: 'rq_nadia', text: 'Stargazer Lin has been counting them. Go to the Celestial Peaks. Quickly.' },
    ],
    reward: { coins: 160000, item: ['amulet_of_power', 1], title: 'Keeper of Temasek', badge: '🦁' },
  },
  {
    id: 'ch12', title: 'Under the Fallen Stars', regions: ['The Celestial Peaks'],
    quests: ['rq_celestial_peaks', 'champion'],
    summary: 'Bring a fallen star home, relight the Night Seal and be named the island’s Champion.',
    intro: [
      { who: 'rq_lin', text: 'Three stars gone this week. Something up here is eating them, one by one.' },
      { who: 'rq_lin', text: 'Stop it, and bring a fallen star to the seal. And earn the right to carry it: the island needs a Champion.' },
    ],
    outro: [
      { who: 'rq_lin', text: 'Look! The seal is drinking the starlight. The tear over the strait is closing.' },
      { who: 'guide', text: 'You did it, lah! The kampong will be telling this story for a hundred years.' },
      { who: 'guide', text: 'The Rift will never be fully shut, but now it has a keeper. Welcome home, Light of Singapura.' },
    ],
    reward: { coins: 250000, item: ['elixir_of_temasek', 5], title: 'Light of Singapura', badge: '⭐' },
  },
];

export const CHAPTER_BY_ID = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

// Short lines for the small story events (src/game/story.js): a line's foe
// sends a gang to raid the giver's patch, a giver's stall is ransacked when
// their line begins, and a messenger runs up with a chapter's letter.
export const EVENT_LINES = {
  raidStart: (foe, region) => `${foe}'s gang is raiding ${region}! Drive them off.`,
  raidCry: 'Help! They’re everywhere!',
  raidWon: 'Thank you! But the big one is still out there somewhere.',
  raidGone: 'The raiders slink back into the wild.',
  ransack: 'Aiyo! Look at my stall, all turned over!',
  tidied: 'Wah, so neat now. Thank you!',
  messenger: (from) => `A letter for you, from ${from}!`,
};

// How long story events last (ticks of 0.6s) before they pack themselves away.
export const RAID_TICKS = 260;          // about 2.5 minutes
export const RANSACK_TICKS = 500;       // about 5 minutes
export const MESSENGER_TICKS = 60;      // a messenger gives up after about 36s and the letter arrives anyway
export const RAIDERS = 3;
