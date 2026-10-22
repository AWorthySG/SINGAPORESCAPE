// MRT (Mass Rapid Transit) fast-travel network. Each station has a walkable
// arrival tile; travelling between them costs a small EZ-link fare. Deep-end
// zones (Wilderness, Pulau Hantu) are deliberately not on the network — they
// must be reached on foot.
export const STATIONS = [
  { id: 'kampong_glam', name: 'Kampong Glam', x: 68, y: 52 },
  { id: 'chinatown', name: 'Chinatown', x: 76, y: 52 },
  { id: 'bukit_timah', name: 'Bukit Timah', x: 64, y: 18 },
  { id: 'macritchie', name: 'MacRitchie', x: 42, y: 52 },
  { id: 'sentosa', name: 'Sentosa Beach', x: 58, y: 92 },
  // The open world
  { id: 'sungei_buloh', name: 'Sungei Buloh', x: 40, y: 148 },
  { id: 'jurong', name: 'Jurong Forest', x: 110, y: 148 },
  { id: 'marina_bay', name: 'Marina Bay', x: 192, y: 149 },
  { id: 'pulau_ubin', name: 'Pulau Ubin', x: 192, y: 52 },
  { id: 'changi', name: 'Changi Coast', x: 258, y: 52 },
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const MRT_FARE = 30;
