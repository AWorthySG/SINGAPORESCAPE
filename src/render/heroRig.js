// Painted hero rigs use separate limbs. Keep loading and animation
// here so the shared sprite library only needs one optional drawing hook.
export const HERO_RIG_PARTS = ['body', 'sword', 'back', 'left', 'right', 'strike'];
export const HERO_RIG_CLASSES = ['swordsman', 'rogue', 'samurai', 'corsair', 'paladin', 'knight', 'berserker', 'juggernaut', 'gladiator', 'lancer', 'brawler', 'halberdier', 'dancer'];
// Heavier weapons commit later; spears extend forward and whips sweep wider.
const ATTACKS = {
  corsair: { wind: 0.2, hit: 0.43, angle: 0.35, swing: 1.4, reach: 3 },
  paladin: { wind: 0.35, hit: 0.57, angle: 0.65, swing: 1.4, reach: 2 },
  knight: { wind: 0.3, hit: 0.53, angle: 0.4, swing: 0.8, reach: 7 },
  berserker: { wind: 0.42, hit: 0.65, angle: 0.9, swing: 1.7, reach: 3 },
  juggernaut: { wind: 0.45, hit: 0.68, angle: 1, swing: 1.9, reach: 2 },
  gladiator: { wind: 0.38, hit: 0.6, angle: 0.8, swing: 1.5, reach: 4 },
  lancer: { wind: 0.25, hit: 0.48, angle: 0.3, swing: 0.6, reach: 9 },
  halberdier: { wind: 0.4, hit: 0.64, angle: 0.75, swing: 1.4, reach: 6 },
  dancer: { wind: 0.28, hit: 0.52, angle: 0.55, swing: 1.8, reach: 6 },
};
const images = new Map();
export const heroRigSrc = (part, classId = 'swordsman') => `assets/creatures/hero/rig/${classId}-${part}.webp`;

export function swordsmanPose(gait = {}, time = 0, swing = -1) {
  const move = Math.max(0, Math.min(1, gait.move || 0));
  const step = Math.sin((gait.phase || 0) * Math.PI) * move;
  const attacking = swing >= 0 && swing <= 1;
  const k = Math.max(0, Math.min(1, swing));
  // Ease through wind-up, contact and recovery without snapping at the ends.
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const wind = attacking ? smooth(k / 0.3) : 0;
  const hit = attacking ? smooth((k - 0.3) / 0.22) : 0;
  const recover = attacking ? smooth((k - 0.55) / 0.45) : 0;
  return {
    step,
    breathe: Math.sin(time * 0.0032) * 0.35 * (1 - move),
    sword: -wind * 0.55 + hit * 1.8 - recover * 1.25 + step * 0.12,
    back: -step * 0.28 - (wind - recover) * 0.15,
    strike: hit * (1 - recover),
  };
}

// Rogue follows through with the off hand only when two daggers are equipped.
// These timings are visual; combat still owns damage and attack speed.
export function heroRigPose(classId, gait, time, swing = -1, dualWield = false) {
  const pose = swordsmanPose(gait, time, swing);
  if (classId === 'swordsman') return pose;
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const active = swing >= 0 && swing <= 1;
  const pulse = (a, b, c) => active ? smooth((swing - a) / (b - a)) * (1 - smooth((swing - b) / (c - b))) : 0;
  if (classId === 'rogue') {
    const slash = pulse(0, 0.28, 0.62);
    const offhand = dualWield ? pulse(0.32, 0.65, 1) : 0;
    pose.sword = slash * 1.2 + pose.step * 0.18;
    pose.back = -offhand * 2.35 - pose.step * 0.32;
    pose.strike = slash;
  } else if (classId === 'samurai') {
    const wind = pulse(0, 0.36, 0.6);
    const cut = pulse(0.32, 0.58, 1);
    pose.sword = -wind * 0.8 + cut * 1.5 + pose.step * 0.09;
    pose.back = -wind * 0.18 + cut * 0.45 - pose.step * 0.2;
    pose.strike = cut;
  } else if (classId === 'brawler') {
    const punch = pulse(0, 0.25, 0.55), cross = pulse(0.3, 0.65, 1);
    pose.sword = punch * 0.8 + pose.step * 0.2;
    pose.back = -cross * 1.3 - pose.step * 0.3;
    pose.strike = punch;
    pose.reach = punch * 5;
  } else if (ATTACKS[classId]) {
    const profile = ATTACKS[classId];
    const wind = pulse(0, profile.wind, profile.hit);
    const strike = pulse(profile.wind * 0.75, profile.hit, 1);
    pose.sword = -wind * profile.angle + strike * profile.swing + pose.step * 0.12;
    pose.back = -pose.step * 0.2 + strike * (classId === 'paladin' ? 0.1 : 0.35);
    pose.strike = strike;
    pose.reach = strike * profile.reach;
  }
  return pose;
}

export function drawHeroRig(ctx, opts = {}) {
  const classId = opts.jobClass;
  if (!HERO_RIG_CLASSES.includes(classId) || typeof Image === 'undefined') return false;
  const key = (part) => `${classId}-${part}`;
  for (const part of HERO_RIG_PARTS) {
    if (!images.has(key(part))) {
      const img = new Image();
      img.src = heroRigSrc(part, classId);
      images.set(key(part), img);
    }
  }
  // Never show a partially assembled character, including on a failed load.
  if (HERO_RIG_PARTS.some((part) => !images.get(key(part)).complete || !images.get(key(part)).naturalWidth)) return false;
  const pose = heroRigPose(classId, opts.gait, opts.time || 0, opts.swingK ?? -1, opts.dualWield);
  const draw = (part, x, y, w, h, angle = 0, px = 0, py = 0, opacity = 1) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.globalAlpha *= opacity;
    ctx.drawImage(images.get(key(part)), -px, -py, w, h);
    ctx.restore();
  };
  // Boots tuck behind the tunic; their planted edges stay on the ground.
  const rogue = classId === 'rogue', samurai = classId === 'samurai';
  const brawler = classId === 'brawler', dancer = classId === 'dancer';
  const shield = classId === 'paladin' || classId === 'knight';
  const polearm = classId === 'lancer' || classId === 'halberdier';
  const broad = classId === 'berserker' || classId === 'juggernaut' || classId === 'gladiator';
  const bootY = rogue ? -1 : 2, bootH = rogue ? 16 : 13;
  draw('left', -10 - pose.step * 1.5, bootY - Math.max(0, pose.step) * 3, 13, bootH);
  draw('right', 1 + pose.step * 1.5, bootY - Math.max(0, -pose.step) * 3, 13, bootH);
  // The Rogue's second dagger crosses in front of the tunic on its follow-up.
  const pilot = classId === 'swordsman';
  if (dancer) draw('back', -17, -9 + pose.breathe, 19, 25, pose.back, 16, 7);
  else if (!rogue && !brawler) draw('back', pilot ? -12 : -17, -9 + pose.breathe, shield ? 20 : pilot ? 12 : 15, shield ? 29 : pilot ? 14 : 18, pose.back, shield ? 17 : pilot || samurai ? 5 : 10, shield ? 8 : 3);
  draw('body', -21, -38 + pose.breathe, 42, 44);
  if (rogue) draw('back', -14, -9 + pose.breathe, 22, 18, pose.back, 18, 3);
  if (brawler) draw('back', -14, -9 + pose.breathe, 17, 26, -pose.back - 0.5, 14, 23);
  // Rotate around the shoulder, rather than rotating the whole portrait.
  // Short daggers sit outside the hood; the katana keeps its longer reach.
  if (rogue) {
    draw('sword', 15, -8 + pose.breathe, 17, 30, pose.sword + 0.7, 14, 27, 1 - pose.strike);
    draw('strike', 15, -8 + pose.breathe, 26, 10, (pose.sword - 1.2) * 0.3, 4, 4, pose.strike);
  } else if (brawler) {
    draw('sword', 14, -9 + pose.breathe, 17, 26, pose.sword + 0.5, 13, 23, 1 - pose.strike);
    draw('strike', 14 + pose.reach, -9 + pose.breathe, 27, 12, 0, 4, 4, pose.strike);
  } else {
    const w = broad ? 29 : polearm ? 24 : dancer ? 26 : 23;
    const h = polearm ? 57 : broad ? 46 : dancer ? 44 : 42;
    draw('sword', 11, -10 + pose.breathe, w, h, pose.sword + (samurai ? 0.25 : 0), pilot || samurai ? 19 : w * 0.83, pilot || samurai ? 37 : h * 0.88, 1 - pose.strike);
    const reach = pose.reach || 0;
    draw('strike', 11 + reach, -10 + pose.breathe, dancer ? 52 : polearm ? 55 : broad ? 44 : 37, dancer ? 19 : broad ? 16 : 13, polearm ? -0.08 : (pose.sword - 1.25) * 0.3, 4, 5, pose.strike);
  }
  return true;
}
