// Collectible lore: journal pages, old letters and kampong legends about the
// island, its regions, its bosses and the story of the Shadow Rift. The engine
// is src/game/lore.js; this file is only data.
//
// Every region has two pages: one a rare drop from the monsters there
// (`from: 'drop'`), one found at a glinting note hidden somewhere in the region
// (`from: 'spot'`). Every story chapter gives one more when it is done
// (`from: 'chapter'`, region STORY_SET). A region's two pages make a set:
// finishing it wakes that region's lore guardian (a champion of the region's
// quest foe) beside the hidden spot, and the story's own set pays a bonus.
// Ids are saved: never rename one.

export const STORY_SET = 'The Shadow Rift';

// Region prefix -> region name (prefixes match the region quest line ids).
const R = {
  kampong_glam: 'Kampong Glam', chinatown: 'Chinatown', macritchie: 'MacRitchie Reservoir', pulau_ubin: 'Pulau Ubin',
  bukit_timah: 'Bukit Timah', sungei_buloh: 'Sungei Buloh Wetlands', sentosa: 'Sentosa Beach', changi: 'Changi Coast',
  kranji: 'Kranji Farmlands', jurong: 'Jurong Forest', marina_bay: 'Marina Bay', wilderness: 'The Wilderness',
  punggol: 'Punggol Waterway', gardens: 'Gardens by the Bay', tekong: 'Tekong Badlands', pulau_hantu: 'Pulau Hantu',
  coney: 'Coney Island', mandai: 'Mandai Rainforest', southern_islands: 'Southern Islands', shadow_rift: 'The Shadow Rift',
  tuas: 'Tuas Docklands', temasek: 'Temasek Ruins', celestial_peaks: 'The Celestial Peaks',
};

// [prefix, drop page [title, text], spot page [title, text]]
const REGION_PAGES = [
  ['kampong_glam',
    ['The Rooster Who Woke the Sultan', 'They say Ayam Jago’s great-great-grandfather crowed so loudly one dawn that the Sultan sat up in bed and spilled his tea. Every rooster on Arab Street has been insufferable ever since.'],
    ['A Note under the Signpost', 'Whoever finds this: the night the sky cracked, every lamp on Bussorah Street flickered purple at once. My cat hid under the rice sack until morning. — A worried neighbour']],
  ['chinatown',
    ['Goblin Lantern Song', 'Bring a lantern, bring a light, goblins never sleep at night. Not because we like the dark: because the dark has teeth. (Scrawled in charcoal on a torn goblin banner.)'],
    ['Madam Tan’s Recipe Card', 'For bad dreams: one slice of ginger, two red dates, and a lantern left burning by the door. Grandmother swore by the lantern more than the tea. I am beginning to understand why.']],
  ['macritchie',
    ['Ranger’s Logbook, Page 12', 'Macaque troop moved east to west overnight. All of them, even the old ones. Bags snatched: 14. Reason: unknown. Note to self: buy more padlocks.'],
    ['Carved on the Boardwalk', 'Someone cut a little lion into the railing of the TreeTop Walk, facing south. Under it, very small: “It is watching the sea.”']],
  ['pulau_ubin',
    ['The Last Kampong’s Ledger', 'Bicycles rented: 0. Mosquitoes swatted: 300. Strange humming from the quarry pond: every night this week. Uncle has stopped going near it after dark.'],
    ['Letter from a Granite Miner', 'Dear Mak, the new seam in the quarry is very black and very cold. The foreman says leave it alone. I think he is right, Mak. I will be home for Hari Raya.']],
  ['bukit_timah',
    ['Old Tusker’s Tale', 'Old Tusker was the boar who chased a tiger off the summit in 1930, or so Mr Rajoo insists. Nobody alive can prove him wrong, and he knows it.'],
    ['Summit Survey Marker', 'The brass plate on the summit has a line scratched across it, pointing south, and the words “the seam is getting longer”. The scratches are fresh.']],
  ['sungei_buloh',
    ['Birdwatcher’s Tally', 'Whimbrels: going north. Sandpipers: going north. Herons: refusing to move, staring south. Mei Ling has underlined “staring” three times.'],
    ['The Biawak’s Treasure', 'In the mud by the boardwalk, a monitor lizard’s nest of stolen things: two eggs, a spoon, a hairclip and a sliver of glass so black it seems to drink the light.']],
  ['sentosa',
    ['Lifeguard Darren’s Report', 'Jellyfish: many. Scorpions: too many. Strange black pebbles washing up on Siloso: very many. Recommend closing beach. Recommend holiday. Recommend both.'],
    ['Message in a Bottle', 'If you find this, tell my wife the fishing is fine and the sea is singing at night. It is a low, sad song. I don’t think it is whales.']],
  ['changi',
    ['Pak Din’s Fishing Diary', 'Monday: tamban. Tuesday: tamban. Wednesday: a piece of black glass that hummed in the bucket all night. Thursday: I gave it to Rosnah. Friday: tamban, thank goodness.'],
    ['The Iron Claw', 'Sepit Besi was a crab the size of a sampan, the old fishermen said, who pinched the anchor chain of a Dutch ship and would not let go for three days.']],
  ['kranji',
    ['The Scarecrow’s Diary', 'Day 1: stood in field. Day 40: stood in field. Day 41: crows brought me shiny stones. Day 42: I feel strange. Day 43: walked. (Written in very wobbly letters.)'],
    ['Farmer Kumar’s Almanac', 'Plant chilli after rain. Plant kangkung by the ditch. Do NOT plant anything near the black stones the crows bring. Nothing grows there. Nothing.']],
  ['jurong',
    ['Kassim’s Price List', 'Hornbill feather: 5. Pangolin scale: 10. Shadow glass, any size: 500, paid by the gentleman in Marina Bay, no questions asked. Underneath, in another hand: “don’t ask”.'],
    ['Keeper Hui’s Bird Notes', 'The mynahs have learnt a new word from the poachers. They say it over and over, softly, at dusk: “Rift. Rift. Rift.”']],
  ['marina_bay',
    ['Hotel Safe Receipt', 'Deposited: one case, sealed, contents “ceramics”. Guest name: illegible. Guest left by the window on the 54th floor. Concierge Wei Jie has requested a transfer.'],
    ['The Helix at Midnight', 'If you walk the Helix Bridge at midnight and count the lights, there is always one more than there should be. The extra one is cold, and it walks.']],
  ['wilderness',
    ['Ananda’s Prayer Beads', 'One bead for every soul he guided out of the Wilderness. There are one hundred and seven. The string has room for one hundred and eight.'],
    ['Batu Belah', 'Batu Belah, the splitting stone, once swallowed a mother who wept too much, the old tale says. The golem that took its name only swallows the unwary. Small mercies.']],
  ['punggol',
    ['The Sea Gate', 'My grandfather said there is a gate under Punggol Point, and the Old Buaya sleeps across it like a bolt. If the crocodile ever wakes angry, the gate is open. — Osman'],
    ['Kelong Keeper’s Logbook', 'Tide in. Tide out. Tide in, then out again, then in, all in one hour. I have kept this kelong for thirty years. The sea is confused.']],
  ['gardens',
    ['Orchid Tag No. 4417', 'Hybrid, unnamed. Blooms only at night. Petals black, edges silver. Gardener Priya’s note: “It grew where the Supertrees drip. Keep away from visitors.”'],
    ['The Hantu Raya', 'A hantu raya serves whoever feeds it, and takes the shape of its master. The one in the Cloud Forest had no master. It had found the dark, and the dark was enough.']],
  ['tekong',
    ['Encik Hafiz’s Duty Roster', 'Sentry: 2200-0200. Report anything unusual. Report EVERYTHING unusual. Report pirates especially. Who reports pirates in this day and age? Report them anyway.'],
    ['Kapitan Lanun’s Map', 'An old map, inked on sailcloth, with an X on Tekong and the words “glass that buys a kingdom”. Somebody has crossed out “kingdom” and written “boat”.']],
  ['pulau_hantu',
    ['Diver Kai’s Dive Log', 'Depth 12m. Visibility poor. Reef is fine. A woman’s face looked at me from the coral, smiled, and was gone. Air: fine. Me: not fine.'],
    ['The Two Warriors', 'Pulau Hantu, the legend says, is where the spirits of two warriors fell after a duel the gods would not stop. They guard the reef still, and they do not like visitors digging in it.']],
  ['coney',
    ['The Cow’s Ear Tag', 'COW #1. NAME: Cow. TEMPERAMENT: Opinionated. NOTES: Has kicked three rustlers into the sea. Do not stand behind.'],
    ['Ranger Boon’s Sign', 'PLEASE DO NOT FEED THE COW. THE COW IS ON A DIET. THE COW KNOWS WHAT IT DID. (Under it, a hoofprint.)']],
  ['mandai',
    ['Night Safari Keeper’s Notes', 'All the night animals came to the front of their enclosures tonight and stood very still, looking towards the Rift. Then they went to bed early. I want to go to bed early too.'],
    ['Bayang’s Pawprints', 'The shadow leopard leaves no tracks in daylight. At night its prints glow faintly, then fade, like the leopard itself was never quite there.']],
  ['southern_islands',
    ['The Kusu Tortoise', 'Two sailors were shipwrecked in a storm, and a great tortoise rose from the sea and turned itself into an island so they would not drown. Pilgrims still climb its hill every year to give thanks.'],
    ['Pilgrim’s Ribbon', 'Tied to a tree on the Kusu hill, a red ribbon with three wishes stitched on it: for a good harvest, for a son’s exams, and “for the sky to stop cracking”.']],
  ['shadow_rift',
    ['Scout Kamal’s Last Report', 'Day 9 at the outpost. The dark has a heartbeat now. Slow. Like something very large, very old, asleep and dreaming of being awake.'],
    ['Written in Frost', 'Words in frost on a stone at the edge of the Rift, melting as you read them: “I was here first. I will be here last.”']],
  ['tuas',
    ['Container Manifest', 'Container SG-0001: kitchen tiles. SG-0002: kitchen tiles. SG-0003: kitchen tiles (humming). SG-0004: kitchen tiles (very cold). Harbourmaster Goh’s note: “Nobody needs this many kitchen tiles.”'],
    ['The Container King’s Crown', 'Ah Kow wore a crown made from a hard hat and a shipping seal. He said a king needed a crown. Goh said a king needed a permit.']],
  ['temasek',
    ['Dr Nadia’s Field Notes', 'The inscription reads: “Here the Lion Prince bound the First Dark with seven stones of starlight. Keep them whole. Keep them lit.” Five stones are missing. Two are on the island somewhere.'],
    ['The Bronze Sentinel', 'Made in the days of the old kings to guard the seal chamber, the Bronze Sentinel has no master left to obey. It guards anyway. Some promises outlive the people who made them.']],
  ['celestial_peaks',
    ['Stargazer Lin’s Star Chart', 'Count tonight: 4,212 stars over the Peaks. Last month: 4,301. Something is eating them, and it is getting hungrier.'],
    ['A Fallen Star’s Song', 'Hold a fallen star to your ear and it hums the tune every kampong grandmother sings at bedtime. Nobody knows who taught it to whom.']],
];

// One page for each chapter of the story, given when the chapter is done.
const CHAPTER_PAGES = [
  ['ch1', 'The Guide’s Notebook', 'Night of the crack: purple light over the strait, ten minutes, then gone. The roosters crowed at midnight. Madam Tan says it is an omen. Madam Tan says everything is an omen.'],
  ['ch2', 'Seen from the Summit', 'From the top of Bukit Timah the tear in the sky looks like a stitch come loose. Mr Rajoo says if you pull a loose stitch, the whole cloth comes apart.'],
  ['ch3', 'What the Nets Brought Up', 'Black glass, smooth on one side and carved on the other: half of a lion’s eye. Whoever made this was a master. Whoever broke it was not.'],
  ['ch4', 'The Buyer’s Calling Card', 'A white card, gold edges, no name. Only a drawing of a door with a crack in it, and the words “Every piece opens it wider.”'],
  ['ch5', 'The Night Seal', 'The Lion Prince did not kill the First Dark. He could not. So he put it to sleep under the island and sang it a lullaby of starlight, and set seven stones to keep the song going.'],
  ['ch6', 'Supertree Sap', 'Gardener Priya bottled a drop of the dark the Supertrees drank. It sits on her shelf, quite still, until someone says something unkind. Then it ripples.'],
  ['ch7', 'Pirates’ Pay', 'Kapitan Lanun was paid in gold coins stamped with a cracked door. They were cold to the touch, and by morning they had turned to sand.'],
  ['ch8', 'The Warm Stone', 'The tortoise stone is warm as a cup of teh tarik and glows when the dark is near. Temple Keeper Ah Peng wrapped it in his own scarf for the journey.'],
  ['ch9', 'At the Bottom of the Rift', 'Down where the light gives up, there is a door. It is not open. It is not shut. Something on the other side is leaning on it.'],
  ['ch10', 'The Buyer Unmasked', 'The buyer was never a person. Each payment was left by a shadow that walked out of the Rift and back in. The First Dark was buying its own freedom, one piece at a time.'],
  ['ch11', 'The Seal Rebuilt', 'Seven stones, back in their places, carved lion eyes all facing inward. The seal is whole, but it is dark. A lullaby needs a singer.'],
  ['ch12', 'The Lullaby of Starlight', 'With a fallen star in its heart, the seal began to hum the old bedtime tune. Far below, the First Dark sighed, turned over, and went back to sleep. Sleep well, old thing.'],
];

export const LORE = [
  ...REGION_PAGES.flatMap(([pre, drop, spot]) => [
    { id: `${pre}_drop`, region: R[pre], from: 'drop', title: drop[0], text: drop[1] },
    { id: `${pre}_spot`, region: R[pre], from: 'spot', title: spot[0], text: spot[1] },
  ]),
  ...CHAPTER_PAGES.map(([ch, title, text]) => ({ id: `story_${ch}`, region: STORY_SET, from: 'chapter', chapter: ch, title, text })),
];

export const LORE_BY_ID = Object.fromEntries(LORE.map((p) => [p.id, p]));
/** Every set (region name, and the story's own) in journey order, with its pages. */
export const LORE_SETS = [...new Set(LORE.map((p) => p.region))].map((region) => ({ region, pages: LORE.filter((p) => p.region === region) }));

// Drop chances, out of 1000 kills in the page's region (only while it is missing).
export const LORE_DROP_PER_MIL = 20;         // about 1 in 50 for an ordinary monster
export const LORE_DROP_PER_MIL_BIG = 200;    // 1 in 5 for a boss or champion
// A finished region set's guardian: a champion of the region's quest foe, and its reward.
export const GUARDIAN_COINS = (level) => Math.round(500 + 60 * level);
export const GUARDIAN_ITEM = ['upgrade_stone', 1];
// The story's own set (every chapter page): a last bonus.
export const STORY_SET_REWARD = { coins: 50000, title: 'Keeper of Tales' };
