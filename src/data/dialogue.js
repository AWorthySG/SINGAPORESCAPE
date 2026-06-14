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
        { label: 'Goodbye.', next: 'end' },
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
