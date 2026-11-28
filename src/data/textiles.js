export const TEXTILE_METHODS = [
  { id: 'stamp', name: 'Stamp wax', use: 'A carved block repeats one motif.' },
  { id: 'canting', name: 'Draw with a canting', use: 'A fine wax pen traces narrow outlines.' },
  { id: 'brush', name: 'Brush on wax', use: 'A brush protects broad areas of cloth.' },
  { id: 'dip', name: 'Dip in dye', use: 'A dye bath colours the cloth that the wax leaves bare.' },
];

const stamp = { method: 'stamp', clue: 'Repeat the same motif at even intervals.' };
const canting = { method: 'canting', clue: 'Keep the slim outline clear of dye.' };
const brush = { method: 'brush', clue: 'Keep a broad patch of cloth clear of dye.' };
const dip = { method: 'dip', clue: 'Give the exposed cloth its next colour.' };

export const TEXTILE_SWATCHES = {
  chilli: { ...stamp, clue: 'Repeat an identical wax flower across the cloth.' },
  pandan: { ...canting, clue: 'Keep each fine leaf vein clear of dye.' },
  sireh: { ...stamp, clue: 'Repeat the same wax star between the leaves.' },
  butterfly: { ...dip, clue: 'Colour the bare cotton between the waxed petals.' },
  ginger: { ...brush, clue: 'Keep the wide flower petals clear of the darker dye.' },
  mangosteen: { ...canting, clue: 'Preserve a fine outline around the fruit.' },
};

// The market supplies one practice cloth. Chinatown has room for larger pieces and several dye baths.
export const TEXTILE_PROJECTS = [
  { id: 'market_sampler', name: 'Market wax-resist sampler', level: 1, xp: 4, free: true, coins: 0, dyes: [],
    art: 'chilli', hue: 0, colours: ['#934b49', '#f8e2a4', '#cd7158'], motif: 'flower', steps: [stamp, dip] },
  { id: 'kampong_panel', name: 'Kampong floral panel', level: 25, xp: 190, coins: 24, dyes: [['chilli', 1], ['pandan_leaves', 2]],
    art: 'chilli', hue: -15, colours: ['#b3484c', '#f5dd9f', '#385f4e'], motif: 'flower', steps: [stamp, canting, dip] },
  { id: 'peranakan_tiles', name: 'Peranakan tile hanging', level: 50, xp: 490, coins: 24, dyes: [['sireh_leaf', 2], ['pandan_leaves', 1]],
    art: 'sireh', hue: -17, colours: ['#3a6767', '#ebdba7', '#c07963'], motif: 'tile', steps: [canting, dip, stamp, dip] },
  { id: 'straits_evening', name: 'Straits evening batik', level: 75, xp: 1230, coins: 32, dyes: [['butterfly_pea', 2], ['sireh_leaf', 2]],
    art: 'pandan', hue: 102, colours: ['#414d88', '#e6d7ed', '#78a396'], motif: 'wave', steps: [brush, dip, canting, stamp, dip] },
  { id: 'heritage_hanging', name: 'Heritage gallery hanging', level: 99, xp: 2080, coins: 40, dyes: [['mangosteen', 2], ['torch_ginger', 3]],
    art: 'sireh', hue: 55, colours: ['#5b4267', '#f2dfa2', '#cb7781'], motif: 'star', steps: [canting, dip, brush, stamp, dip, canting, dip] },
];
