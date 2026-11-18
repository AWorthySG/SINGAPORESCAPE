// Region story quests: one short quest line for every region of the island,
// each with its own quest giver. The lines run outwards from Kampong Glam in
// order of the fight level they ask for, so the journal reads as a journey.
// The engine that runs them is src/game/regionquests.js; this file is only data.
//
// A line: { id, region, name, giver, level (fight level to start), desc,
//   intro (the giver's greeting), offer (the job), thanks (said once it's done),
//   steps, unlock }.
// Steps, done in order (the last is always a talk back to the giver):
//   { kind: 'kill', npc, qty, text }      defeat that many of a monster
//   { kind: 'give', item, qty, to?, via, text, say }  bring items to the giver (or `to`);
//       `via` says where they come from, first match wins:
//       { need: item, obj } go to that object while short of `need`,
//       { obj } gather or work at that object, { shop: npcId } buy them there
//   { kind: 'foe', npc, name, where?, text }  a named, tougher one of that monster
//       turns up beside its kind in the region (or `where`): defeat it
//   { kind: 'talk', to?, text, say, reply }  talk to the giver (or `to`)
// Unlocks, given when the line is handed in:
//   { type: 'teleport' }                  Teleport to the giver from the quest journal
//   { type: 'ferry', to: giverId, label } the giver takes you to another giver
//   { type: 'shop', shop }                the giver opens a shop (REGION_SHOPS)
//   { type: 'spot', objs: [...] }         gathering spots appear beside the giver
//   { type: 'perk', bonus: {...} }        a permanent bonus, counted like gear
// `text` (what the line says) shows in the journal and the unlock's `label` with it.

export const REGION_LINES = [
  {
    id: 'rq_kampong_glam', region: 'Kampong Glam', name: 'Feathers on Arab Street', giver: 'rq_zainab', level: 1,
    desc: "Help Mak Cik Zainab put her batik stall on Arab Street back in order.",
    intro: 'Selamat datang! Mind the cloth, ya. My batik stall is in such a state today.',
    offer: "Aiyo, look at my stall! The rats from the hill nibble my cloth, the frame is wobbly, and a big rooster keeps knocking everything down. Can help or not?",
    thanks: 'My stall has never looked so nice. Come by any time, ya!',
    steps: [
      { kind: 'kill', npc: 'rat', qty: 4, text: 'Chase off rats on the Bukit Timah slopes' },
      { kind: 'give', item: 'logs', qty: 5, via: [{ obj: 'tree' }], text: 'Bring Mak Cik Zainab 5 logs to mend her stall',
        say: 'Wah, solid wood! Now my stall won’t wobble.' },
      { kind: 'foe', npc: 'chicken', name: 'Ayam Jago', text: 'Catch Ayam Jago, the rowdy rooster' },
      { kind: 'talk', text: 'Tell Mak Cik Zainab the rooster is caught', reply: 'Ayam Jago won’t bother you again.',
        say: 'Haha, finally some peace! Take this charm. Rub it and it will always bring you home to me.' },
    ],
    unlock: { type: 'teleport', text: 'Teleport home to Kampong Glam from the quest journal' },
  },
  {
    id: 'rq_chinatown', region: 'Chinatown', name: 'Lanterns of Pagoda Street', giver: 'rq_madam_tan', level: 3,
    desc: 'Win back Madam Tan’s Mid-Autumn lanterns from the Bukit Timah goblins.',
    intro: 'Come in, come in. Tea? My medicine hall has a cure for nearly everything.',
    offer: 'Nearly everything except goblins! They ran down from Bukit Timah and took my Mid-Autumn lanterns. Without them Pagoda Street will be so dark, how?',
    thanks: 'The whole street is glowing again. My shelves are open to you, friend.',
    steps: [
      { kind: 'kill', npc: 'goblin', qty: 5, text: 'Defeat goblins on Bukit Timah' },
      { kind: 'give', item: 'copper_ore', qty: 4, via: [{ obj: 'copper_rock' }], text: 'Bring Madam Tan 4 copper ore for new lantern hooks',
        say: 'Good copper. My nephew will bend these into hooks tonight.' },
      { kind: 'foe', npc: 'goblin', name: 'Goblin Lantern-Snatcher', where: 'Bukit Timah', text: 'Defeat the Goblin Lantern-Snatcher on Bukit Timah' },
      { kind: 'talk', text: 'Bring the lanterns home to Madam Tan', reply: 'Here are your lanterns.',
        say: 'All of them, and not one torn! For this, you may buy from my own shelves.' },
    ],
    unlock: { type: 'shop', shop: 'rq_tan_medicine', text: 'Madam Tan sells potions from her medicine hall' },
  },
  {
    id: 'rq_macritchie', region: 'MacRitchie Reservoir', name: 'Monkey Business', giver: 'rq_ranger_siti', level: 7,
    desc: 'Stop the MacRitchie macaques snatching hikers’ snacks on the TreeTop Walk.',
    intro: 'Morning! Stay on the boardwalk and don’t feed the monkeys, okay?',
    offer: 'Too late for that, someone already did. Now the macaques grab every bag on the TreeTop Walk. Help me teach them some manners?',
    thanks: 'The trail is calm again. You have a ranger’s eye now, I can tell.',
    steps: [
      { kind: 'kill', npc: 'macaque', qty: 6, text: 'Shoo away macaques by the reservoir' },
      { kind: 'give', item: 'roti_prata', qty: 3, via: [{ shop: 'hawker' }], text: 'Buy 3 roti prata as decoy snacks for Ranger Siti',
        say: 'Perfect. We leave these far from the trail and the monkeys follow.' },
      { kind: 'foe', npc: 'macaque', name: 'Ah Kow the Bin Raider', text: 'Defeat Ah Kow, the macaque gang’s leader' },
      { kind: 'talk', text: 'Report back to Ranger Siti', reply: 'Ah Kow has gone quiet.',
        say: 'No more snatched bags. Here, keep your eyes as sharp as they are today.' },
    ],
    unlock: { type: 'perk', bonus: { crit: 1 }, text: 'Ranger’s eye: +1% crit chance' },
  },
  {
    id: 'rq_pulau_ubin', region: 'Pulau Ubin', name: 'The Last Kampong', giver: 'rq_uncle_seng', level: 10,
    desc: 'Help Uncle Ah Seng look after the old kampong houses on Pulau Ubin.',
    intro: 'Rent a bicycle? Five dollars, whole day, very cheap.',
    offer: 'No customers lah, the mosquitoes chase them all away. And the kampong houses need patching before the rain. You young, you help Uncle?',
    thanks: 'The kampong will stand another fifty years. Use my old quarry seam whenever you like.',
    steps: [
      { kind: 'kill', npc: 'mosquito', qty: 8, text: 'Swat mosquitoes by the quarry ponds' },
      { kind: 'give', item: 'clay', qty: 4, via: [{ obj: 'clay_rock' }], text: 'Bring Uncle Ah Seng 4 clay to patch the kampong walls',
        say: 'Nice and sticky. The walls will be good as new.' },
      { kind: 'foe', npc: 'civet', name: 'Musang King', text: 'Defeat the Musang King raiding the durian trees' },
      { kind: 'talk', text: 'Tell Uncle Ah Seng the durians are safe', reply: 'Your durians are safe now, Uncle.',
        say: 'Wah, then this season Uncle eats like a king! Come, I show you my old quarry.' },
    ],
    unlock: { type: 'spot', objs: ['iron_rock', 'iron_rock', 'coal_rock', 'coal_rock'], text: 'Uncle’s quarry seam: iron and coal rocks by his bicycle stand' },
  },
  {
    id: 'rq_bukit_timah', region: 'Bukit Timah', name: 'The Highest Hill', giver: 'rq_rajoo', level: 14,
    desc: 'Make the summit trail of Bukit Timah safe for Mr Rajoo’s morning walkers.',
    intro: 'Every morning I climb to the summit. One hundred and sixty-three metres, you know!',
    offer: 'But now there are cobras on the trail and a huge old boar charging the walkers. The railings are rusting too. Will you help an old hill keeper?',
    thanks: 'My walkers are back, and you climb this hill like it’s nothing.',
    steps: [
      { kind: 'kill', npc: 'king_cobra', qty: 6, text: 'Clear king cobras off the trail' },
      { kind: 'give', item: 'tin_ore', qty: 4, via: [{ obj: 'tin_rock' }], text: 'Bring Mr Rajoo 4 tin ore to mend the trail railings',
        say: 'Very good. Shiny railings for my walkers.' },
      { kind: 'foe', npc: 'wild_boar', name: 'Old Tusker', text: 'Defeat Old Tusker, the boar of the summit trail' },
      { kind: 'talk', text: 'Walk back to Mr Rajoo', reply: 'Old Tusker won’t charge anyone again.',
        say: 'You have good strong legs. Keep climbing hills and they will carry you far.' },
    ],
    unlock: { type: 'perk', bonus: { hp: 5 }, text: 'Hill walker’s stamina: +5 max life' },
  },
  {
    id: 'rq_sungei_buloh', region: 'Sungei Buloh Wetlands', name: 'Eggs in the Mangroves', giver: 'rq_mei_ling', level: 14,
    desc: 'Protect the nests of the migrating birds at Sungei Buloh.',
    intro: 'Shh! A whimbrel, just there. They fly all the way from Siberia, you know.',
    offer: 'The monitor lizards are raiding the nests, and the rescued herons are hungry. Can you lend a hand?',
    thanks: 'The chicks hatched this morning! I set some snares for you along the boardwalk.',
    steps: [
      { kind: 'kill', npc: 'monitor_lizard', qty: 6, text: 'Drive off monitor lizards from the nests' },
      { kind: 'give', item: 'raw_anchovy', qty: 5, via: [{ obj: 'fishing_spot' }], text: 'Catch 5 anchovies for Mei Ling’s rescued herons',
        say: 'Fresh fish! The herons will be so happy.' },
      { kind: 'foe', npc: 'monitor_lizard', name: 'Biawak Besar', text: 'Defeat Biawak Besar, the egg thief' },
      { kind: 'talk', text: 'Tell Mei Ling the nests are safe', reply: 'Biawak Besar has gone.',
        say: 'Every nest safe! Here, I’ve set bird snares by my hide for you.' },
    ],
    unlock: { type: 'spot', objs: ['bird_snare', 'bird_snare', 'bird_snare'], text: 'Bird snares by Mei Ling’s hide' },
  },
  {
    id: 'rq_sentosa', region: 'Sentosa Beach', name: 'Stingers at Siloso', giver: 'rq_darren', level: 17,
    desc: 'Help Lifeguard Darren reopen Siloso Beach.',
    intro: 'Swim between the flags, yeah? Sorry, beach is closed today.',
    offer: 'Box jellyfish all over the shallows, and a giant scorpion in the dunes. We’re meant to have a beach barbecue tonight. Help me save it?',
    thanks: 'Best barbecue Siloso has ever had. My surf shack is open to you any time.',
    steps: [
      { kind: 'kill', npc: 'box_jellyfish', qty: 6, text: 'Clear box jellyfish from the shallows' },
      { kind: 'give', item: 'anchovy', qty: 4, via: [{ need: 'raw_anchovy', obj: 'fishing_spot' }, { obj: 'range' }],
        text: 'Grill 4 anchovies for Darren’s beach barbecue', say: 'Smells amazing. The barbecue is on!' },
      { kind: 'foe', npc: 'sand_scorpion', name: 'Kala Jengking', text: 'Defeat Kala Jengking, the dune scorpion' },
      { kind: 'talk', text: 'Tell Darren the beach is safe', reply: 'The beach is clear.',
        say: 'Flags are up, beach is open! My surf shack has fishing gear and good grub for you.' },
    ],
    unlock: { type: 'shop', shop: 'rq_siloso_shack', text: 'Darren’s surf shack sells fishing gear and seafood' },
  },
  {
    id: 'rq_changi', region: 'Changi Coast', name: 'Nets of Changi Village', giver: 'rq_rosnah', level: 28,
    desc: 'Help Auntie Rosnah and the Changi fishermen keep their nets whole.',
    intro: 'Nasi lemak, three dollars! Extra sambal, no charge.',
    offer: 'But no fish, no nasi lemak. Giant crabs keep cutting the fishermen’s nets, and I’m out of chillies for my sambal!',
    thanks: 'My cousin’s bumboat goes out to Pulau Tekong. Tell him Auntie sent you, he won’t charge.',
    steps: [
      { kind: 'kill', npc: 'giant_crab', qty: 6, text: 'Defeat giant crabs along the shore' },
      { kind: 'give', item: 'chilli', qty: 3, via: [{ shop: 'hawker' }], text: 'Buy 3 chillies for Auntie Rosnah’s sambal',
        say: 'Now that is proper chilli! Smell, smell.' },
      { kind: 'foe', npc: 'giant_crab', name: 'Sepit Besi', text: 'Defeat Sepit Besi, the iron-clawed crab' },
      { kind: 'talk', text: 'Tell Auntie Rosnah the nets are safe', reply: 'Sepit Besi won’t cut any more nets.',
        say: 'You eat first, I insist! And any time you need a boat to Tekong, just ask.' },
    ],
    unlock: { type: 'ferry', to: 'rq_hafiz', label: 'Take the bumboat to Pulau Tekong', text: 'A free bumboat from Changi Village to Pulau Tekong' },
  },
  {
    id: 'rq_kranji', region: 'Kranji Farmlands', name: 'Crows over Kranji', giver: 'rq_kumar', level: 33,
    desc: 'Save Farmer Kumar’s vegetables from the crows.',
    intro: 'Kangkong, chye sim, long beans. All grown right here in Kranji!',
    offer: 'If the crows leave me any. And my old scarecrow walked off on its own last night. Walked! Can you help me?',
    thanks: 'Best harvest in years. I dug you a couple of traps at the edge of my fields.',
    steps: [
      { kind: 'kill', npc: 'house_crow', qty: 8, text: 'Chase house crows out of the fields' },
      { kind: 'give', item: 'feather', qty: 10, via: [{ shop: 'farmer' }], text: 'Bring Farmer Kumar 10 feathers to stuff a new scarecrow',
        say: 'Feathers! This one will look fierce.' },
      { kind: 'foe', npc: 'scarecrow', name: 'The Walking Scarecrow', text: 'Defeat Kumar’s runaway scarecrow' },
      { kind: 'talk', text: 'Tell Farmer Kumar his scarecrow is down', reply: 'Your old scarecrow won’t walk again.',
        say: 'Good. The new one stays put. Here, use the traps at the edge of my fields.' },
    ],
    unlock: { type: 'spot', objs: ['squirrel_trap', 'boar_pit', 'boar_pit'], text: 'Hunter traps at the edge of Kumar’s fields' },
  },
  {
    id: 'rq_jurong', region: 'Jurong Forest', name: 'Poachers of Jurong', giver: 'rq_keeper_hui', level: 50,
    desc: 'Stop the bandits trapping Jurong’s birds.',
    intro: 'I kept birds at the old Jurong Bird Park for thirty years. Now I keep watch here.',
    offer: 'Bandits are setting traps in the forest and selling the hornbills. The aviary perches are broken too. Will you help?',
    thanks: 'The hornbills sing again. You fight with a keeper’s heart.',
    steps: [
      { kind: 'kill', npc: 'bandit', qty: 6, text: 'Defeat bandits in Jurong Forest' },
      { kind: 'give', item: 'logs', qty: 8, via: [{ obj: 'tree' }], text: 'Bring Keeper Hui 8 logs for new aviary perches',
        say: 'Lovely straight wood. The birds will have somewhere to sit.' },
      { kind: 'foe', npc: 'outlaw', name: 'Kassim the Trapper', text: 'Defeat Kassim the Trapper' },
      { kind: 'talk', text: 'Report back to Keeper Hui', reply: 'Kassim won’t trap another bird.',
        say: 'Then the forest is free again. Fight on for the small things, friend.' },
    ],
    unlock: { type: 'perk', bonus: { atkPct: 2, magPct: 2 }, text: 'Keeper’s heart: +2% Physical and Magic damage bonus' },
  },
  {
    id: 'rq_marina_bay', region: 'Marina Bay', name: 'The Helix Haunting', giver: 'rq_wei_jie', level: 90,
    desc: 'Lay to rest the ghosts haunting the Helix Bridge.',
    intro: 'Good evening, welcome to Marina Bay. May I help with your bags?',
    offer: 'Between us, the guests are scared. Pontianak on the Helix Bridge every night, and something worse at midnight. Can you help discreetly?',
    thanks: 'The guests are strolling the bridge again. My friend at the jeweller will look after you.',
    steps: [
      { kind: 'kill', npc: 'pontianak', qty: 5, text: 'Lay pontianak to rest around the bay' },
      { kind: 'talk', to: 'rq_madam_tan', text: 'Ask Madam Tan in Chinatown about ghosts', reply: 'How do I keep ghosts away?',
        say: 'Ghosts? They cannot stand the smell of pandan. Tell the concierge to tie pandan leaves along the bridge.' },
      { kind: 'give', item: 'pandan_leaves', qty: 5, via: [{ shop: 'hawker' }], text: 'Bring Wei Jie 5 pandan leaves for the bridge',
        say: 'Pandan? Well, it does smell nice. I’ll have them tied up at once.' },
      { kind: 'foe', npc: 'wraith', name: 'The Helix Wraith', text: 'Defeat the Helix Wraith at midnight' },
      { kind: 'talk', text: 'Tell Wei Jie the bridge is clear', reply: 'The Helix Wraith is gone.',
        say: 'Splendid. The jeweller downstairs owes me a favour. Tell her you’re my guest.' },
    ],
    unlock: { type: 'shop', shop: 'rq_marina_jeweller', text: 'The Marina Bay jeweller sells rings and amulets' },
  },
  {
    id: 'rq_wilderness', region: 'The Wilderness', name: 'A Monk at the Edge', giver: 'rq_monk', level: 120,
    desc: 'Help the wandering monk calm the restless dead of the Wilderness.',
    intro: 'Peace be with you, traveller. Few walk this way on purpose.',
    offer: 'The dead here do not rest. Skeletons walk at night, and an old golem guards their bones. Will you help me bring them peace?',
    thanks: 'The Wilderness sleeps a little easier. I know a fisherman’s path to Pulau Hantu, if ever you need it.',
    steps: [
      { kind: 'kill', npc: 'skeleton', qty: 6, text: 'Lay skeletons in the Wilderness to rest' },
      { kind: 'give', item: 'vial', qty: 3, via: [{ shop: 'farmer' }], text: 'Bring the monk 3 vials for holy water',
        say: 'Thank you. Clean water, a quiet prayer, and they will sleep.' },
      { kind: 'foe', npc: 'stone_golem', name: 'Batu Belah, the Old Golem', text: 'Defeat Batu Belah, the Old Golem' },
      { kind: 'talk', text: 'Return to the wandering monk', reply: 'The golem has crumbled.',
        say: 'Then the bones can rest. Come, let me show you the hidden path to Pulau Hantu.' },
    ],
    unlock: { type: 'ferry', to: 'rq_diver_kai', label: 'Follow the hidden path to Pulau Hantu', text: 'The monk’s hidden path to Pulau Hantu' },
  },
  {
    id: 'rq_punggol', region: 'Punggol Waterway', name: 'Crocodile Point', giver: 'rq_osman', level: 140,
    desc: 'Help Old Fisherman Osman fish Punggol Point in peace.',
    intro: 'Sixty years I fish at Punggol Point. Back then, the whole jetty smelled of satay and chilli crab.',
    offer: 'Now the mudskippers steal my bait and an old crocodile watches my boat. Help me, and I will teach you how a fisherman stays strong.',
    thanks: 'My boat is safe again. Remember what Osman taught you.',
    steps: [
      { kind: 'kill', npc: 'mudskipper', qty: 8, text: 'Chase mudskippers off the jetty' },
      { kind: 'give', item: 'satay', qty: 4, via: [{ shop: 'hawker' }], text: 'Bring Osman 4 sticks of satay, like the old days',
        say: 'Ahh, satay by the water. Just like when I was young.' },
      { kind: 'foe', npc: 'saltwater_crocodile', name: 'Old Buaya of Punggol', text: 'Defeat the Old Buaya of Punggol' },
      { kind: 'talk', text: 'Return to Old Fisherman Osman', reply: 'The Old Buaya is gone.',
        say: 'Every fight takes a little from you. A good fisherman takes a little back. Like this.' },
    ],
    unlock: { type: 'perk', bonus: { lifesteal: 1 }, text: 'Fisherman’s grit: +1% lifesteal' },
  },
  {
    id: 'rq_gardens', region: 'Gardens by the Bay', name: 'Trouble in the Cloud Forest', giver: 'rq_priya', level: 240,
    desc: 'Help Gardener Priya save the flowers of Gardens by the Bay.',
    intro: 'Mind the orchids! Each one took me months.',
    offer: 'Ghosts are wilting the flower beds and something huge stomps round the Supertrees at night. Lemongrass keeps them off, but I’ve run out.',
    thanks: 'The Supertrees glow and nothing stomps. You move like the wind through my gardens.',
    steps: [
      { kind: 'kill', npc: 'jungle_wraith', qty: 6, text: 'Drive jungle wraiths out of the gardens' },
      { kind: 'give', item: 'lemongrass', qty: 5, via: [{ shop: 'hawker' }], text: 'Bring Priya 5 lemongrass for a ghost-proof border',
        say: 'Perfect. Ghosts hate lemongrass more than I hate weeds.' },
      { kind: 'foe', npc: 'hantu_raya', name: 'Hantu Raya of the Supertrees', text: 'Defeat the Hantu Raya of the Supertrees' },
      { kind: 'talk', text: 'Return to Gardener Priya', reply: 'The Supertrees are safe.',
        say: 'Thank you! Here, some of the garden’s quickness for you.' },
    ],
    unlock: { type: 'perk', bonus: { haste: 2 }, text: 'Garden breeze: +2% attack speed' },
  },
  {
    id: 'rq_tekong', region: 'Tekong Badlands', name: 'Outfield Exercise', giver: 'rq_hafiz', level: 285,
    desc: 'Survive Encik Hafiz’s outfield exercise on Pulau Tekong.',
    intro: 'Recruit! Stand up straight. You look like you’ve never done an outfield.',
    offer: 'Pirates raiding the shore, pocong in the training area. Today’s exercise: clear them, build the campfire, take out their captain. Understood?',
    thanks: 'Not bad, recruit. Not bad at all. You hit where it hurts now.',
    steps: [
      { kind: 'kill', npc: 'pocong', qty: 6, text: 'Clear pocong from the training area' },
      { kind: 'give', item: 'logs', qty: 10, via: [{ obj: 'tree' }], text: 'Bring Encik Hafiz 10 logs for the campfire',
        say: 'Good. Fire tonight, and nobody sleeps cold.' },
      { kind: 'foe', npc: 'cursed_pirate', name: 'Kapitan Lanun', text: 'Defeat Kapitan Lanun, the pirate captain' },
      { kind: 'talk', text: 'Report to Encik Hafiz', reply: 'Exercise complete, Encik!',
        say: 'Outstanding. You learnt to find the gaps in their armour. Carry on!' },
    ],
    unlock: { type: 'perk', bonus: { pierce: 3 }, text: 'Outfield training: +3% armour pierce' },
  },
  {
    id: 'rq_pulau_hantu', region: 'Pulau Hantu', name: 'Ghost Island Dive', giver: 'rq_diver_kai', level: 330,
    desc: 'Help Diver Kai dive the reefs of Pulau Hantu without being haunted.',
    intro: 'Best coral in Singapore, right here. Pity about the ghosts.',
    offer: 'Pocong on the beach, and the penanggal queen floats over the reef at night. Help me lay them to rest and I’ll get you out of here any time.',
    thanks: 'Clear water, no ghosts. Need a lift home? My boat’s always ready.',
    steps: [
      { kind: 'kill', npc: 'pocong', qty: 6, text: 'Lay pocong on Pulau Hantu to rest' },
      { kind: 'talk', to: 'rq_monk', text: 'Ask the wandering monk how to quiet the island', reply: 'How do I quiet Ghost Island?',
        say: 'Ghost Island is only lonely, not cruel. Lay the penanggal queen to rest and the others will follow.' },
      { kind: 'foe', npc: 'penanggal', name: 'Penanggal Queen', text: 'Defeat the Penanggal Queen over the reef' },
      { kind: 'talk', text: 'Return to Diver Kai', reply: 'The Penanggal Queen is at rest.',
        say: 'You did it! Any time you need a way out of here, my boat goes straight to Kampong Glam.' },
    ],
    unlock: { type: 'ferry', to: 'rq_zainab', label: 'Take Kai’s boat to Kampong Glam', text: 'Kai’s boat from Pulau Hantu back to Kampong Glam' },
  },
  {
    id: 'rq_coney', region: 'Coney Island', name: 'The Coney Island Cow', giver: 'rq_ranger_boon', level: 430,
    desc: 'Help Ranger Boon protect the famous lone cow of Coney Island.',
    intro: 'Have you seen a cow? Brown, friendly, lives here all by herself. Really!',
    offer: 'She’s hiding because of the tarantulas in the casuarinas, and a rustler is trying to steal her. The boardwalk needs fixing too. Can you help?',
    thanks: 'She came out to say hello! You’re a natural at bringing down the big ones.',
    steps: [
      { kind: 'kill', npc: 'dire_tarantula', qty: 6, text: 'Clear dire tarantulas from the casuarinas' },
      { kind: 'give', item: 'logs', qty: 8, via: [{ obj: 'tree' }], text: 'Bring Ranger Boon 8 logs for the boardwalk',
        say: 'Great, the boardwalk will be fixed by sunset.' },
      { kind: 'foe', npc: 'dire_outlaw', name: 'Rustler Ramli', text: 'Defeat Rustler Ramli before he takes the cow' },
      { kind: 'talk', text: 'Tell Ranger Boon the cow is safe', reply: 'Ramli won’t rustle anything again.',
        say: 'Moo! That’s her saying thank you. Keep hitting the big ones that hard.' },
    ],
    unlock: { type: 'perk', bonus: { bossDmg: 5 }, text: 'Rustler-buster: +5% boss and champion damage' },
  },
  {
    id: 'rq_mandai', region: 'Mandai Rainforest', name: 'Night Safari Nerves', giver: 'rq_aisha', level: 1060,
    desc: 'Help Zookeeper Aisha calm the Mandai rainforest.',
    intro: 'Welcome to Mandai. Keep your voice down, the animals are jumpy tonight.',
    offer: 'The bunian spirits are stirring everything up, the fences are down, and a shadow leopard is prowling the trails. Help me settle the forest?',
    thanks: 'The forest is calm. Funny, you strike like a leopard yourself now.',
    steps: [
      { kind: 'kill', npc: 'bunian', qty: 6, text: 'Calm the bunian spirits of the rainforest' },
      { kind: 'give', item: 'bamboo', qty: 6, via: [{ obj: 'bamboo' }], text: 'Bring Aisha 6 bamboo for new fences',
        say: 'Strong bamboo. The fences will hold now.' },
      { kind: 'foe', npc: 'clouded_leopard', name: 'Bayang the Shadow Leopard', text: 'Defeat Bayang, the shadow leopard' },
      { kind: 'talk', text: 'Return to Zookeeper Aisha', reply: 'Bayang won’t prowl here again.',
        say: 'Everyone can sleep tonight. Here, the forest gives you something back.' },
    ],
    unlock: { type: 'perk', bonus: { critDmg: 5 }, text: 'Leopard’s strike: +5% crit damage' },
  },
  {
    id: 'rq_southern_islands', region: 'Southern Islands', name: 'The Kusu Pilgrimage', giver: 'rq_ah_peng', level: 1120,
    desc: 'Keep the pilgrims to Kusu Island safe.',
    intro: 'Long ago a giant tortoise turned into this island to save two shipwrecked sailors. Now pilgrims come every year.',
    offer: 'This year, sea snakes in the lagoon and a ghost shark circling the jetty. The pilgrims need feeding too. Will you help an old temple keeper?',
    thanks: 'The pilgrims crossed safely. Our stall is open to you, friend.',
    steps: [
      { kind: 'kill', npc: 'mythic_sea_snake', qty: 6, text: 'Clear mythic sea snakes from the lagoon' },
      { kind: 'give', item: 'nasi_lemak', qty: 5, via: [{ shop: 'hawker' }], text: 'Bring Ah Peng 5 nasi lemak for the pilgrims',
        say: 'Still warm, and extra sambal! The pilgrims will be very grateful.' },
      { kind: 'foe', npc: 'mythic_reef_shark', name: 'Jerung Hantu', text: 'Defeat Jerung Hantu, the ghost shark' },
      { kind: 'talk', text: 'Return to Temple Keeper Ah Peng', reply: 'The jetty is safe.',
        say: 'The tortoise would be proud. Our pilgrims’ stall is yours to use.' },
    ],
    unlock: { type: 'shop', shop: 'rq_kusu_stall', text: 'The Kusu pilgrims’ stall sells strong potions' },
  },
  {
    id: 'rq_shadow_rift', region: 'The Shadow Rift', name: 'Light in the Rift', giver: 'rq_kamal', level: 1680,
    desc: 'Help Scout Kamal hold back the dark at the Rift Outpost.',
    intro: 'Keep close to the lanterns. Out there, the dark bites.',
    offer: 'Imps pour out of the Rift every night and something ancient leads them. My wards are failing. I need chaos runes and a strong arm.',
    thanks: 'The wards hold. Carry some of their light with you.',
    steps: [
      { kind: 'kill', npc: 'primordial_imp', qty: 8, text: 'Hold back primordial imps from the outpost' },
      { kind: 'give', item: 'chaos_rune', qty: 50, via: [{ shop: 'mage' }], text: 'Bring Kamal 50 chaos runes for the wards',
        say: 'That will power the wards for a month.' },
      { kind: 'foe', npc: 'primordial_wraith', name: 'Wraith of the First Dark', text: 'Defeat the Wraith of the First Dark' },
      { kind: 'talk', text: 'Return to Scout Kamal', reply: 'The First Dark is gone.',
        say: 'Then the outpost stands. Take this light with you; you’ll hit harder for it.' },
    ],
    unlock: { type: 'perk', bonus: { atkPct: 3, magPct: 3 }, text: 'Rift ward: +3% Physical and Magic damage bonus' },
  },
  {
    id: 'rq_tuas', region: 'Tuas Docklands', name: 'Smugglers of Tuas', giver: 'rq_goh', level: 1830,
    desc: 'Help Harbourmaster Goh break the Tuas smuggling ring.',
    intro: 'Busiest port in the world, this. Every container counted. Well, nearly every.',
    offer: 'Smugglers are hiding goods in my containers and the dock rats have chewed through the crates. I need someone tough.',
    thanks: 'Ring broken, goods seized. I can sell you some of them, all above board.',
    steps: [
      { kind: 'kill', npc: 'dock_rat', qty: 8, text: 'Clear dock rats from the container yard' },
      { kind: 'give', item: 'logs', qty: 8, via: [{ obj: 'tree' }], text: 'Bring Harbourmaster Goh 8 logs for new crates',
        say: 'Good timber. New crates, no holes.' },
      { kind: 'foe', npc: 'smuggler', name: 'Ah Kow the Container King', text: 'Defeat Ah Kow, the Container King' },
      { kind: 'talk', text: 'Report to Harbourmaster Goh', reply: 'The Container King is finished.',
        say: 'Excellent work. The seized goods go on sale. You get first pick.' },
    ],
    unlock: { type: 'shop', shop: 'rq_tuas_seized', text: 'Harbourmaster Goh sells seized runes and arrows' },
  },
  {
    id: 'rq_temasek', region: 'Temasek Ruins', name: 'Secrets of Old Temasek', giver: 'rq_nadia', level: 2730,
    desc: 'Help Dr Nadia uncover the secrets of the old Temasek kingdom.',
    intro: 'Careful where you step! This could be seven hundred years old.',
    offer: 'Wraiths drift through my dig site and a bronze sentinel guards the deepest chamber. I need protection, and a translation.',
    thanks: 'The inscription is finally read. You’ve a sharp eye for weak spots, like a true scholar.',
    steps: [
      { kind: 'kill', npc: 'ruin_wraith', qty: 6, text: 'Clear ruin wraiths from the dig site' },
      { kind: 'talk', to: 'rq_ah_peng', text: 'Ask Temple Keeper Ah Peng about the old inscription', reply: 'Can you read this old inscription?',
        say: 'Ah, the old script. It says: "Only the worthy may open the chamber." Tell the doctor to be careful.' },
      { kind: 'foe', npc: 'bronze_warrior', name: 'The Bronze Sentinel', text: 'Defeat the Bronze Sentinel of the deep chamber' },
      { kind: 'talk', text: 'Return to Dr Nadia', reply: 'The chamber is open.',
        say: 'The worthy, it said. That’s you. Here, the old kings knew where to strike.' },
    ],
    unlock: { type: 'perk', bonus: { crit: 2 }, text: 'Scholar’s eye: +2% crit chance' },
  },
  {
    id: 'rq_celestial_peaks', region: 'The Celestial Peaks', name: 'Under the Fallen Stars', giver: 'rq_lin', level: 3760,
    desc: 'Help Stargazer Lin find out why the stars are falling.',
    intro: 'Look up. See the gap there? Three stars fell last night.',
    offer: 'Divine imps chase the falling stars and a jinn eats them before they cool. I’ve watched so long I forgot to eat. Help me?',
    thanks: 'The sky is whole again. A little starlight stays with you, I think.',
    steps: [
      { kind: 'kill', npc: 'divine_imp', qty: 8, text: 'Chase divine imps away from the fallen stars' },
      { kind: 'give', item: 'laksa', qty: 3, via: [{ shop: 'hawker' }], text: 'Bring Stargazer Lin 3 bowls of laksa',
        say: 'Oh, I was starving. Thank you!' },
      { kind: 'foe', npc: 'jinn', name: 'The Star-Eating Jinn', text: 'Defeat the Star-Eating Jinn' },
      { kind: 'talk', text: 'Return to Stargazer Lin', reply: 'The jinn won’t eat any more stars.',
        say: 'The sky is safe. Hold out your hands; this one fell just for you.' },
    ],
    unlock: { type: 'perk', bonus: { atkPct: 4, magPct: 4, critDmg: 5 }, text: 'Starlight: +4% Physical and Magic damage bonus, +5% crit damage' },
  },
];

// The quest givers: new townsfolk, one per region. Each borrows an existing
// townsperson's painted picture, recoloured (`art`, `tint`, read by sprites.js),
// until they get their own. `at` is where they stand; the nearest free tile is used.
export const REGION_GIVERS = {
  rq_zainab: { name: 'Mak Cik Zainab', examine: 'She sells batik on Arab Street.', art: 'hawker', tint: 'hue-rotate(200deg) saturate(1.2)', at: [63, 56] },
  rq_madam_tan: { name: 'Madam Tan', examine: 'She runs the medicine hall on Pagoda Street.', art: 'mage', tint: 'hue-rotate(40deg)', at: [86, 58] },
  rq_ranger_siti: { name: 'Ranger Siti', examine: 'A park ranger with very muddy boots.', art: 'farmer', tint: 'hue-rotate(100deg)', at: [38, 55] },
  rq_uncle_seng: { name: 'Uncle Ah Seng', examine: 'He rents out bicycles by the Ubin jetty.', art: 'villager', tint: 'hue-rotate(60deg)', at: [196, 56] },
  rq_rajoo: { name: 'Mr Rajoo', examine: 'He has climbed Bukit Timah every morning for forty years.', art: 'guide', tint: 'hue-rotate(160deg)', at: [60, 22] },
  rq_mei_ling: { name: 'Birdwatcher Mei Ling', examine: 'Binoculars, notebook, endless patience.', art: 'skills_tutor', tint: 'hue-rotate(90deg)', at: [44, 152] },
  rq_darren: { name: 'Lifeguard Darren', examine: 'Sunburnt, whistle ready.', art: 'fletcher', tint: 'hue-rotate(180deg) saturate(1.3)', at: [62, 95] },
  rq_rosnah: { name: 'Auntie Rosnah', examine: 'Her nasi lemak is famous all along the coast.', art: 'hawker', tint: 'hue-rotate(320deg)', at: [262, 56] },
  rq_kumar: { name: 'Farmer Kumar', examine: 'He grows vegetables in Kranji.', art: 'farmer', tint: 'hue-rotate(250deg)', at: [455, 144] },
  rq_keeper_hui: { name: 'Keeper Hui', examine: 'An old bird keeper from the Jurong Bird Park.', art: 'slayer_master', tint: 'hue-rotate(120deg)', at: [114, 152] },
  rq_wei_jie: { name: 'Concierge Wei Jie', examine: 'Immaculate uniform. Slightly nervous.', art: 'banker', tint: 'hue-rotate(270deg)', at: [196, 153] },
  rq_monk: { name: 'Wandering Monk Ananda', examine: 'A calm monk at the edge of the Wilderness.', art: 'light_priestess', tint: 'hue-rotate(20deg) saturate(1.4)', at: [97, 60] },
  rq_osman: { name: 'Old Fisherman Osman', examine: 'Sixty years of fishing at Punggol Point.', art: 'villager', tint: 'hue-rotate(200deg)', at: [445, 52] },
  rq_priya: { name: 'Gardener Priya', examine: 'She looks after the orchids at the Gardens.', art: 'farmer', tint: 'hue-rotate(300deg)', at: [348, 54] },
  rq_hafiz: { name: 'Encik Hafiz', examine: 'A drill sergeant on Pulau Tekong.', art: 'slayer_master', tint: 'hue-rotate(60deg) saturate(0.8)', at: [238, 108] },
  rq_diver_kai: { name: 'Diver Kai', examine: 'A diver who knows every reef of Pulau Hantu.', art: 'fletcher', tint: 'hue-rotate(90deg)', at: [124, 40] },
  rq_ranger_boon: { name: 'Ranger Boon', examine: 'He looks after Coney Island, and its cow.', art: 'guide', tint: 'hue-rotate(90deg)', at: [348, 152] },
  rq_aisha: { name: 'Zookeeper Aisha', examine: 'A zookeeper from Mandai.', art: 'skills_tutor', tint: 'hue-rotate(200deg)', at: [478, 230] },
  rq_ah_peng: { name: 'Temple Keeper Ah Peng', examine: 'He keeps the Kusu Island temple.', art: 'shopkeeper', tint: 'hue-rotate(320deg)', at: [102, 242] },
  rq_kamal: { name: 'Scout Kamal', examine: 'A scout at the Rift Outpost.', art: 'shadow_broker', tint: 'hue-rotate(160deg) brightness(1.2)', at: [268, 226] },
  rq_goh: { name: 'Harbourmaster Goh', examine: 'He counts every container in Tuas.', art: 'banker', tint: 'hue-rotate(160deg)', at: [103, 324] },
  rq_nadia: { name: 'Dr Nadia', examine: 'An archaeologist digging up old Temasek.', art: 'mage', tint: 'hue-rotate(250deg)', at: [269, 322] },
  rq_lin: { name: 'Stargazer Lin', examine: 'She watches the sky from the Celestial Peaks.', art: 'light_priestess', tint: 'hue-rotate(220deg)', at: [478, 324] },
};

// Townsfolk defs for the givers (merged into NPCS by npcs.js).
export const REGION_GIVER_DEFS = Object.fromEntries(Object.entries(REGION_GIVERS).map(([id, g]) => [id,
  { name: g.name, level: 0, attackable: false, role: 'dialogue', wander: 0, examine: g.examine, dialogue: 'region' }]));

// The shops a finished line opens (merged into SHOPS by shops.js).
export const REGION_SHOPS = {
  rq_tan_medicine: {
    name: "Madam Tan's Medicine Hall", buyMul: 1.0, sellMul: 0.5, buysAnything: false,
    stock: [
      { id: 'attack_potion', qty: 50 }, { id: 'strength_potion', qty: 50 }, { id: 'defence_potion', qty: 30 },
      { id: 'ranging_potion', qty: 20 }, { id: 'magic_potion', qty: 20 }, { id: 'healing_potion', qty: 20 },
      { id: 'vial', qty: 200 }, { id: 'galangal', qty: 100 }, { id: 'turmeric', qty: 100 },
    ],
  },
  rq_siloso_shack: {
    name: 'Siloso Surf Shack', buyMul: 1.0, sellMul: 0.45, buysAnything: false,
    stock: [
      { id: 'small_net', qty: 10 }, { id: 'fishing_rod', qty: 10 }, { id: 'lobster_pot', qty: 10 }, { id: 'harpoon', qty: 10 },
      { id: 'fishing_bait', qty: 2000 }, { id: 'tuna', qty: 100 }, { id: 'lobster', qty: 100 }, { id: 'swordfish', qty: 60 }, { id: 'shark', qty: 30 },
    ],
  },
  rq_marina_jeweller: {
    name: 'Marina Bay Jeweller', buyMul: 1.0, sellMul: 0.6, buysAnything: false,
    stock: [
      { id: 'gold_ring', qty: 10 }, { id: 'pearl_ring', qty: 8 }, { id: 'sapphire_ring', qty: 6 }, { id: 'emerald_ring', qty: 4 },
      { id: 'ruby_ring', qty: 2 }, { id: 'pearl_amulet', qty: 6 }, { id: 'amulet_of_power', qty: 4 }, { id: 'amulet_of_strength', qty: 2 },
    ],
  },
  rq_kusu_stall: {
    name: "Kusu Pilgrims' Stall", buyMul: 1.0, sellMul: 0.5, buysAnything: false,
    stock: [
      { id: 'healing_potion', qty: 50 }, { id: 'super_might_potion', qty: 10 }, { id: 'super_haste_potion', qty: 5 },
      { id: 'elixir_of_temasek', qty: 5 }, { id: 'shark', qty: 100 }, { id: 'grouper', qty: 100 },
    ],
  },
  rq_tuas_seized: {
    name: 'Tuas Seized Goods', buyMul: 0.8, sellMul: 0.5, buysAnything: false,
    stock: [
      { id: 'chaos_rune', qty: 5000 }, { id: 'death_rune', qty: 3000 }, { id: 'blood_rune', qty: 2000 },
      { id: 'adamant_arrow', qty: 3000 }, { id: 'rune_arrow', qty: 2000 },
    ],
  },
};

// Journal entries for the lines (appended to QUESTS by quests.js).
export const REGION_QUEST_META = REGION_LINES.map((l) => ({
  id: l.id, name: l.name, qp: 1, region: l.region,
  desc: `${l.region}: ${l.desc} (Fight level ${l.level}+) Reward: ${l.unlock.text}.`,
  progress: (g) => {
    const q = g.quests[l.id];
    if (!q || q.state !== 'active') return '';
    const st = l.steps[q.step];
    if (!st) return '';
    return `Step ${q.step + 1}/${l.steps.length}${st.kind === 'kill' ? ` ${Math.min(q.n || 0, st.qty)}/${st.qty}` : ''}`;
  },
}));
