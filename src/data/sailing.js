export const SAILING_PRACTICE = [
  {
    id: 'changi_basics', name: 'Changi practice circuit', from: 'changi', level: 1, xp: 24,
    legs: ['channel', 'wind', 'current'], detail: 'Read the channel and try steering into a gentle crosswind.',
  },
  {
    id: 'ubin_creeks', name: 'Ubin mangrove pilot', from: 'ubin', level: 25, requires: 'ubin', xp: 190,
    legs: ['channel', 'current', 'leading', 'wash', 'channel'],
    detail: 'Pilot the creek bends. Earn a certificate for direct passages on routes you have charted.',
  },
  {
    id: 'cove_bar', name: 'Shell cove soundings', from: 'cove', level: 50, requires: 'cove', xp: 490,
    legs: ['reef', 'wind', 'current', 'set', 'channel', 'leading'],
    detail: 'Read the colours over the sandbar and work out where the wind and current carry the boat.',
  },
  {
    id: 'marina_approach', name: 'Marina harbour pilot', from: 'marina', level: 75, requires: 'marina', xp: 1230,
    legs: ['traffic', 'leading', 'wash', 'set', 'traffic', 'current', 'leading'],
    detail: 'Thread the harbour traffic, read the leading marks, and leave room for a passing vessel’s wake.',
  },
  {
    id: 'sentosa_reef', name: 'Sentosa offshore pilot', from: 'sentosa', level: 99, requires: 'sentosa', xp: 2100,
    legs: ['reef', 'set', 'leading', 'wash', 'reef', 'current', 'set', 'leading'],
    detail: 'Sound the reef approaches and correct for competing wind and tide before making landfall.',
  },
];

export const DIRECT_PASSAGE_CERTIFICATE = 'ubin_creeks';
