// Branching NPC dialogue. Each tree is a map of nodes.
// A node: { speaker, text, options: [{ label, next?, action? }] }.
// `next` jumps to another node id; omitting it (or 'end') closes the dialogue.
// `action` strings are handled by the game (e.g. 'giveStarter').

export const DIALOGUES = {
  guide: {
    start: {
      speaker: 'Kampong Guide',
      text: 'Eh, welcome to SingaporeScape, lah! New around here? I can help you get started.',
      options: [
        { label: 'Where am I?', next: 'where' },
        { label: 'Can you give me some starter gear?', next: 'gear' },
        { label: 'How do I play?', next: 'help' },
        { label: 'Do you have any work for me?', next: 'quest' },
        { label: "I've collected the bones.", next: 'start', action: 'questTurnIn' },
        { label: 'Any pest control work?', next: 'pest' },
        { label: "Tell me about the island's pillars.", next: 'pillars' },
        { label: 'I have honoured both pillars.', next: 'start', action: 'pillarsTurnIn' },
        { label: 'Any smithing work?', next: 'smith' },
        { label: 'I have forged the steel bars.', next: 'start', action: 'smithTurnIn' },
        { label: 'How can I defend the island?', next: 'defender' },
        { label: 'I have defeated the bosses.', next: 'start', action: 'defenderTurnIn' },
        { label: 'Is there any hunting work?', next: 'biggame' },
        { label: 'I have slain enough creatures.', next: 'start', action: 'bigGameTurnIn' },
        { label: "Tell me of the mystic's trial.", next: 'mystic' },
        { label: 'I have gathered the death runes.', next: 'start', action: 'mysticTurnIn' },
        { label: 'Need any provisions?', next: 'provisions' },
        { label: 'I have the cooked salmon.', next: 'start', action: 'provisionsTurnIn' },
        { label: "Can I become the island's Champion?", next: 'champion' },
        { label: 'I have completed the final trial.', next: 'start', action: 'championTurnIn' },
        { label: 'Goodbye.', next: 'end' },
      ],
    },
    champion: {
      speaker: 'Kampong Guide',
      text: 'Wah, you want to be Champion of Singapore? That is the highest honour, lah! Prove yourself across many quests, then defeat one more boss as your final trial. Do it and the Champion\'s cape is yours!',
      options: [
        { label: 'I accept the challenge.', next: 'start', action: 'championStart' },
        { label: 'Maybe later.', next: 'start' },
      ],
    },
    provisions: {
      speaker: 'Kampong Guide',
      text: 'The kampung is hungry, lah! Catch and cook 10 salmon and bring them to me — I\'ll pay well and your skills will grow.',
      options: [
        { label: "I'll bring the salmon.", next: 'start', action: 'provisionsStart' },
        { label: 'Maybe later.', next: 'start' },
      ],
    },
    mystic: {
      speaker: 'Kampong Guide',
      text: 'The Mystic Merchant seeks proof of devotion. Gather 25 death runes and bring them to me — do this and the ancient staff is yours.',
      options: [
        { label: 'I accept the trial.', next: 'start', action: 'mysticStart' },
        { label: 'Another time.', next: 'start' },
      ],
    },
    biggame: {
      speaker: 'Kampong Guide',
      text: 'The wilds are overrun, lah. Cull 50 creatures of any kind and I\'ll set you up with a fine magic shortbow and a quiver of rune arrows.',
      options: [
        { label: 'The hunt begins.', next: 'start', action: 'bigGameStart' },
        { label: 'Not today.', next: 'start' },
      ],
    },
    smith: {
      speaker: 'Kampong Guide',
      text: 'Our blacksmith needs good steel, lah. Smelt iron and coal into 8 steel bars and bring them to me. I\'ll reward you with some sturdy gauntlets.',
      options: [
        { label: "I'll forge the bars.", next: 'start', action: 'smithStart' },
        { label: 'Maybe later.', next: 'start' },
      ],
    },
    defender: {
      speaker: 'Kampong Guide',
      text: 'Wah, the bosses out there are getting bold! Prove yourself a true Island Defender — slay 3 of them and I\'ll grant you the island aegis and a champion\'s helm.',
      options: [
        { label: "I'll defend the island.", next: 'start', action: 'defenderStart' },
        { label: 'Sounds dangerous. Later.', next: 'start' },
      ],
    },
    pillars: {
      speaker: 'Kampong Guide',
      text: 'Our island stands on two pillars, lah. Pray at the A-Worthy Monument in town, then rest at the Hyco Education obelisk. Honour both and I\'ll give you a sigil that carries their blessing.',
      options: [
        { label: "I'll honour both pillars.", next: 'start', action: 'pillarsStart' },
        { label: 'Sounds spiritual. Maybe later.', next: 'start' },
      ],
    },
    quest: {
      speaker: 'Kampong Guide',
      text: 'Aiyah, the graveyard spirits are restless. Bring me 10 bones from the monsters out there and I\'ll reward you well, can?',
      options: [
        { label: "I'll get the bones.", next: 'start', action: 'questStart' },
        { label: 'Maybe later.', next: 'start' },
      ],
    },
    pest: {
      speaker: 'Kampong Guide',
      text: 'The giant rats are everywhere! Slay 8 of them for me and there\'s coin in it for you.',
      options: [
        { label: "I'll handle the rats.", next: 'start', action: 'pestStart' },
        { label: 'Not now.', next: 'start' },
      ],
    },
    where: {
      speaker: 'Kampong Guide',
      text: 'This is Kampong Glam, our cosy little town. Trees and rocks to the north, fishing by the water to the west, and monsters out east if you fancy a fight.',
      options: [{ label: 'Thanks!', next: 'start' }],
    },
    gear: {
      speaker: 'Kampong Guide',
      text: 'Of course! Here, take a bronze axe, a pickaxe, a fishing net, a tinderbox, and a dagger to defend yourself. Now you can train every skill!',
      options: [{ label: 'Terima kasih!', next: 'start', action: 'giveStarter' }],
    },
    help: {
      speaker: 'Kampong Guide',
      text: 'Left-click to walk and to do the main action. Right-click for more options. Click a tree to chop, a rock to mine, the water to fish, and monsters to fight. Bank your loot at the bank booth!',
      options: [{ label: 'Got it.', next: 'start' }],
    },
  },

  tutor: {
    start: {
      speaker: 'Cikgu Surya',
      text: 'Ah, a new face! I am Cikgu Surya, master of the island\'s trades. Combat is not everything, lah — a true adventurer must know the LIFE SKILLS: woodcutting, firemaking, mining, smithing, fishing and cooking. Shall I teach you, one lesson at a time?',
      options: [
        { label: 'What are life skills?', next: 'explain' },
        { label: 'Teach me the life skills.', next: 'begin', action: 'lifeStart' },
        { label: 'I have done what you asked.', next: 'start', action: 'lifeTurnIn' },
        { label: 'What should I be doing now?', next: 'start', action: 'lifeRemind' },
        { label: 'Tell me about the advanced course.', next: 'adv' },
        { label: 'Goodbye.', next: 'end' },
      ],
    },
    adv: {
      speaker: 'Cikgu Surya',
      text: 'The Master of Trades course, lah! Once you have finished the basics, I set harder lessons — oak logs, iron ore, steel bars, trout and more. Finish them all and I will reward you with the Trades cape.',
      options: [
        { label: 'Begin the advanced course.', next: 'begin', action: 'lifeAdvStart' },
        { label: 'I have done the advanced task.', next: 'start', action: 'lifeAdvTurnIn' },
        { label: "What's my advanced lesson?", next: 'start', action: 'lifeAdvRemind' },
        { label: 'Back.', next: 'start' },
      ],
    },
    explain: {
      speaker: 'Cikgu Surya',
      text: 'Life skills let you live off the land! You chop trees for logs, light them for fires, mine rocks for ore, smith ore into bars and gear, fish the waters, and cook your catch to heal in battle. Master these and you will never go hungry or unarmed, lah.',
      options: [
        { label: 'I want to learn them.', next: 'begin', action: 'lifeStart' },
        { label: 'Interesting. Goodbye.', next: 'end' },
      ],
    },
    begin: {
      speaker: 'Cikgu Surya',
      text: 'Good, good! Listen for each lesson and bring me what I ask. Master a trade and I will reward you, then teach the next. Check your Quest Journal anytime to see your current lesson.',
      options: [
        { label: 'I will begin.', next: 'start' },
      ],
    },
  },

  priestess: {
    start: {
      speaker: 'Sister Mei',
      text: 'Peace be with you, adventurer. If darkness has crept into your heart, know that the path of redemption is always open. Atone through good works, and your sins can be washed away.',
      options: [
        { label: 'I wish to atone for my sins.', next: 'start', action: 'redemptionStart' },
        { label: 'I have done my penance.', next: 'start', action: 'redemptionTurnIn' },
        { label: 'What must I do?', next: 'start', action: 'redemptionRemind' },
        { label: 'Farewell.', next: 'end' },
      ],
    },
  },

  tempter: {
    start: {
      speaker: 'The Tempter',
      text: 'Heh heh... the righteous are so very weak. Embrace your darker nature, and I shall grant you power beyond their reckoning. All you must do is... let go.',
      options: [
        { label: 'Show me the path of corruption.', next: 'start', action: 'corruptionStart' },
        { label: 'My corruption is complete.', next: 'start', action: 'corruptionTurnIn' },
        { label: 'What must I do?', next: 'start', action: 'corruptionRemind' },
        { label: 'I refuse your offer.', next: 'end' },
      ],
    },
  },

  villager: {
    start: {
      speaker: 'Villager',
      text: 'Wah, the weather damn hot today. Good day for training Firemaking, right? Haha.',
      options: [{ label: 'Haha, see you.', next: 'end' }],
    },
  },
};

export function getDialogue(id) {
  return DIALOGUES[id] || null;
}
