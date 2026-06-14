// Shop stock definitions.
//   buyMul:  multiplier on item value for the price the PLAYER pays to buy.
//   sellMul: multiplier on item value for the price the player RECEIVES when selling.
export const SHOPS = {
  general: {
    name: 'Kampong General Store',
    buyMul: 1.0,
    sellMul: 0.4,
    buysAnything: true,
    stock: [
      { id: 'bronze_axe', qty: 10 },
      { id: 'bronze_pickaxe', qty: 10 },
      { id: 'small_net', qty: 10 },
      { id: 'tinderbox', qty: 10 },
      { id: 'hammer', qty: 10 },
      { id: 'bronze_dagger', qty: 5 },
      { id: 'wooden_shield', qty: 5 },
      { id: 'leather_body', qty: 5 },
      { id: 'feather', qty: 1000 },
    ],
  },
  hawker: {
    name: 'Hawker Centre',
    buyMul: 1.0,
    sellMul: 0.5,
    buysAnything: false,
    stock: [
      { id: 'kaya_toast', qty: 50 },
      { id: 'roti_prata', qty: 30 },
      { id: 'chicken_rice', qty: 20 },
    ],
  },
};

export function getShop(id) {
  const shop = SHOPS[id];
  if (!shop) throw new Error(`Unknown shop id: ${id}`);
  return shop;
}
