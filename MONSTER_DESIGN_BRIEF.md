# SingaporeScape — Monster Visual Design Brief (handoff for Grok)

## What I want from you (Grok)
SingaporeScape is a browser RPG. Every monster is drawn **procedurally on an HTML5 Canvas 2D context** by a small "archetype" function. There are **26 archetype functions** and ~330 monsters are rendered by tinting those archetypes with a per-monster colour. **Please redesign/improve the 26 archetype functions** so the creatures look better — more characterful, readable, and polished — while strictly obeying the rendering contract below so they remain drop-in replacements.

Return your answer as **JavaScript only**: improved versions of each `function <name>(ctx, col) { ... }`, keeping the exact same names and signatures. No SVG, no images, no external assets, no libraries.

---

## The rendering contract (must follow exactly)

1. **Signature.** Each archetype is `function name(ctx, col)`:
   - `ctx` — a standard Canvas 2D context.
   - `col` — the monster's tint as a `#rrggbb` string. The SAME archetype is reused for many monsters in different hues (see roster), so your design must read well across colours. **Use `col` for the main body** and derive shades with the provided `shade(col, k)` helper rather than hardcoding the base colour. Fixed accent colours (eyes, teeth, claws, metal) are fine.

2. **Local coordinate space.** You draw in a LOCAL space centred on the origin `(0,0)`. Keep the whole creature within roughly **x ∈ [-18, 18]**, **y ∈ [-20, 14]**, with the creature's "feet"/base near **y ≈ +13** (so it sits on the ground correctly). Bigger silhouettes are fine for bosses (the engine scales them up).

3. **Draw facing RIGHT.** The engine mirrors horizontally when the creature faces left, and adds a gentle vertical bob — so just draw a right-facing idle pose.

4. **Do NOT draw** a ground shadow, glow/aura, crown, or health bar — the engine adds those. After your function runs, the engine also overlays a subtle top sheen and (for bosses) a pulsing aura + crown. Just draw the creature body.

5. **Allowed `ctx` API only** (the project is unit-tested against a headless stub context — using anything else will break tests):
   - Methods: `save, restore, translate, scale, rotate, beginPath, closePath, moveTo, lineTo, arc, ellipse, rect, roundRect, quadraticCurveTo, bezierCurveTo, fill, stroke, fillRect, strokeRect, clearRect, fillText, strokeText, createLinearGradient, createRadialGradient` (+ `gradient.addColorStop`).
   - Properties: `fillStyle, strokeStyle, lineWidth, globalAlpha, font, textAlign, textBaseline, lineCap, lineJoin, globalCompositeOperation`.
   - **No** `drawImage`, no DOM, no `document`, no filters, no shadows-via-shadowBlur.

6. **Keep it cheap.** These render every frame for many on-screen creatures. Favour a handful of paths/arcs over hundreds of operations.

---

## Helpers you may call (already defined in the file)

```js
const OUTLINE = "rgba(26,18,12,0.55)";

function path(ctx, fn) { ctx.beginPath(); fn(); }
function fill(ctx, color) { ctx.fillStyle = color; ctx.fill(); }
function line(ctx, color = OUTLINE, w = 2) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}


// Lighten/darken a #rrggbb colour. k in [-1,1]; negative darkens, positive lightens.
function shade(hex, k) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { const f = 1 + k; r *= f; g *= f; b *= f; }
  else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}


// A lively eye: white sclera + pupil + catchlight.
function eyeW(ctx, x, y, r = 1.6, pupil = '#15110b') {
  ctx.fillStyle = '#f8f6ee'; circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = pupil; circle(ctx, x + 0.25, y + 0.1, r * 0.56); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; circle(ctx, x - r * 0.32, y - r * 0.34, r * 0.26); ctx.fill();
}

// A short fang/claw triangle.
function fang(ctx, x, y, w, h, color = '#f4efe0') {
  ctx.fillStyle = color; path(ctx, () => { ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x, y + h); }); ctx.fill();
}
```

For reference, this is the wrapper the engine uses to place/scale/mirror your drawing (you do **not** write this — it shows the transform your local coordinates go through):

```js
function staged(ctx, cx, cy, opts, draw) {
  const bob = opts.moving ? Math.sin((opts.time || 0) * 0.018 + cx) * 1.6 : Math.sin((opts.time || 0) * 0.004 + cx) * 0.6;
  const s = opts.scale || 1;
  const fx = (opts.facing && opts.facing.dx < 0) ? -1 : 1;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(fx * s, s);
  draw(ctx);
  ctx.restore();
}
```

And the dispatcher that calls each archetype (shows the sheen/aura/crown added around your draw):

```js
export function drawCreature(ctx, npcId, cx, cy, opts = {}) {
  const arch = opts.sprite && ARCH[opts.sprite];
  if (arch) {
    return staged(ctx, cx, cy, opts, (c) => {
      if (opts.boss) bossAura(c, opts.time || 0);
      arch(c, opts.color || '#8a8a8a');
      // Soft upper sheen for volume (fades out, so it only lifts the body).
      const sg = c.createRadialGradient(-3, -5, 0, -3, -5, 10);
      sg.addColorStop(0, 'rgba(255,255,255,0.13)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = sg; circle(c, -3, -5, 10); c.fill();
      c.globalCompositeOperation = 'source-over';
      if (opts.boss) crown(c);
    });
  }
  const TOWN = {
    banker: { top: '#2f4b8a', skin: '#e8b98a', hair: '#3a2a18', apron: '#d8c089' },
    shopkeeper: { top: '#7a3b1d', skin: '#e0aa78', hair: '#272015', apron: '#cdbfa0' },
    hawker: { top: '#b23b2e', skin: '#e8b98a', hair: '#2a2018', hat: '#f0ead8', apron: '#f0ead8' },
    guide: { top: '#3d6b3a', skin: '#e6b886', hair: '#cfc4b0', hat: '#6b4a2a' },
    mage: { top: '#3a2f7a', skin: '#e6c0a0', hair: '#cfcfdf', hat: '#2a2060' },
    fletcher: { top: '#3f5a2a', skin: '#e0aa78', hair: '#3a2a18', hat: '#5a4020' },
    slayer_master: { top: '#3a2a2a', skin: '#caa078', hair: '#161616', apron: '#5a2a2a' },
    villager: { top: '#6a5aa0', skin: '#e8b98a', hair: '#4a3320' },
  };
  const p = TOWN[npcId] || TOWN.villager;
  return staged(ctx, cx, cy, opts, (c) => human(c, p));
}

```

---

## The 26 archetypes & which creatures use them
Each archetype is tinted into many monsters. Redesign with this variety in mind (e.g. `beast` must look right as a boar, tiger, otter, deer, etc.).

| Archetype | Creatures using it | Count | Level range | Example tints |
|---|---|---|---|---|
| `bat` | Fruit bat, Vampire bat, Flying fox | 18 | 5–69 | #5a4a3a #5a2a3a #3a2620 |
| `beast` | boar, Pangolin, Civet, Smooth otter, Sambar deer, Wild boar | 31 | 6–92 | #7a5a3a #8a7a4a #6a5a3a #6a5038 #8a6a4a #6b4a2a |
| `crab` | Giant crab, Mud crab, Horseshoe crab, Chilli Crab Colossus | 19 | 7–70 | #d8566f #7a6a4a #6a5a4a #d83b2e |
| `demon` | Imp, Demon Lord of Pulau, Pulau Hantu Djinn | 8 | 7–132 | #c0432a #a02a2a #7a3a8a |
| `drake` | Forest drake, Bukit Timah Drake, The Garuda, Dragon Kiln Wyrm | 9 | 28–150 | #3f8a5a #caa15a #c0392b |
| `fowl` | Chicken, Hornbill, Kingfisher | 18 | 1–39 | #f3f0e6 #2a2a2a #1f8aa0 |
| `ghost` | Wraith, Pontianak, Jungle wraith, Hantu raya, Penanggal, Hungry Ghost King | 29 | 21–128 | #9fb0d8 #d8c0c8 #b8a0c0 #c06a7a #aeb8d8 |
| `golem` | Stone golem, Molten Golem, Rune Golem | 8 | 25–140 | #9a948a #b3552a #46b3c4 |
| `greenman` | Goblin, Toyol, Goblin Warchief | 13 | 3–42 | #4f9a3f #8a9a5a #3f7a2f |
| `hound` | Stray dog, dog, Wild dog | 12 | 4–75 | #8a6a4a #7a5a3a |
| `humanoid` | Bandit, Outlaw, Bandit Kingpin, Wilderness Warlord, Bedok Bandit Lord, Orang Minyak | 16 | 15–158 | #7a5a3a #3a3a44 #6a4a2a #3a3340 #5a4a2a #1f1f1f |
| `insect` | Mosquito | 6 | 3–18 | #6a7a4a |
| `jellyfish` | Box jellyfish | 6 | 9–51 | #c8a0e0 |
| `mantis` | Praying mantis | 6 | 10–57 | #6aa03a |
| `plant` | Carnivorous plant, Tembusu, Durian Behemoth, Tualang Treant | 9 | 12–105 | #3c8a3f #caa83a #5a7a3a |
| `primate` | Macaque, Macaque Alpha | 7 | 4–45 | #7a5a3a #6a4a2a |
| `reptile` | Monitor lizard, Komodo dragon, Saltwater crocodile | 18 | 8–124 | #6b8a42 #8a7a4a #46583a |
| `rodent` | Rat | 6 | 2–9 | #8f8f93 |
| `scorpion` | Sand scorpion, Sand Scorpion King | 7 | 11–65 | #caa05a |
| `seacreature` | Reef shark, Pink dolphin, The Merlion, Sentosa Kraken, Coral Leviathan, Sentosa Megalodon | 16 | 16–145 | #7fb6dd #e6a6c0 #cfe4ee #3a6a8a #2f7a9a #5a7a8a |
| `serpent` | King cobra, Sea snake, Reticulated python, Reservoir Serpent, Mangrove Hydra | 20 | 9–124 | #3c8a3f #3a7a8a #6a5a3a #2f7a8a |
| `slime` | Swamp slime | 6 | 6–30 | #5fa05a |
| `spider` | Jungle spider, Tarantula, Jungle Spider Queen | 13 | 13–90 | #5a4a6a #6a4a3a #5a3a6a |
| `turtle` | Sea turtle | 6 | 9–48 | #3a7a5a |
| `undead` | Skeleton, Pocong, Cursed pirate, Bone Colossus, Bukit Brown Revenant | 18 | 20–138 | #e8e2d0 #7a6a4a #cdbfae |
| `wisp` | Will-o-wisp | 6 | 4–21 | #9ad0ff |


---

## Current source to improve (keep names & the `(ctx, col)` signature)

```js
// ---- archetypes (ctx, col) ----
function beast(ctx, col) {
  // legs (front pair lighter for depth)
  ctx.fillStyle = shade(col, -0.32); rr(ctx, -8, 7, 3.6, 6, 1); ctx.fill(); rr(ctx, 4, 7, 3.6, 6, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.12); rr(ctx, -5, 8, 3.4, 5, 1); ctx.fill(); rr(ctx, 6.5, 8, 3.4, 5, 1); ctx.fill();
  // tail
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-17, -2, -14, -7); ctx.stroke(); ctx.lineCap = 'butt';
  // body with belly shade + back highlight
  ellipse(ctx, -1, 2, 12, 8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.18); ellipse(ctx, -1, 6, 10, 3.5); ctx.fill();
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, -2, -2, 9, 2.6); ctx.fill();
  // shaggy mane / spine tufts
  ctx.fillStyle = shade(col, -0.35);
  path(ctx, () => { ctx.moveTo(-9, -5); ctx.lineTo(-7, -10); ctx.lineTo(-4, -5); ctx.lineTo(-1, -10); ctx.lineTo(2, -5); }); ctx.fill();
  // head + ear + snout + tusk
  circle(ctx, 10, 0, 6); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.3); path(ctx, () => { ctx.moveTo(7, -5); ctx.lineTo(6, -10); ctx.lineTo(11, -6); }); ctx.fill(); // ear
  ctx.fillStyle = shade(col, 0.22); ellipse(ctx, 15, 1, 3.2, 2.6); ctx.fill(); // snout
  ctx.fillStyle = '#1a140d'; circle(ctx, 16.5, 0.4, 0.7); ctx.fill();          // nostril
  fang(ctx, 14.5, 3.2, 1.3, 2.4);                                              // tusk
  eyeW(ctx, 11, -2, 1.2);
}
function rodent(ctx, col) {
  // long curling tail
  ctx.strokeStyle = shade(col, 0.28); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 4); ctx.quadraticCurveTo(-19, 3, -14, -7); ctx.stroke(); ctx.lineCap = 'butt';
  // feet
  ctx.fillStyle = shade(col, 0.32); circle(ctx, -3, 9, 1.6); ctx.fill(); circle(ctx, 4, 9, 1.6); ctx.fill();
  // body
  ellipse(ctx, 0, 3, 10, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, 1, 1, 7, 3); ctx.fill();
  // head + big ear
  circle(ctx, 9, 0, 5); fill(ctx, col); line(ctx);
  circle(ctx, 8, -5, 3); fill(ctx, shade(col, 0.32)); line(ctx, OUTLINE, 1.1);
  ctx.fillStyle = shade(col, 0.45); circle(ctx, 8, -5, 1.5); ctx.fill(); // inner ear
  // snout + buck tooth + whiskers
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(16.5, 1); ctx.lineTo(13, 3); }); fill(ctx, shade(col, 0.3));
  ctx.fillStyle = '#1a140d'; circle(ctx, 16.2, 1, 0.7); ctx.fill();
  ctx.fillStyle = '#fff'; rr(ctx, 13.4, 2.4, 1.4, 2, 0.4); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(13, 1); ctx.lineTo(18, 0); ctx.moveTo(13, 2); ctx.lineTo(18, 3); ctx.stroke();
  eyeW(ctx, 11, -1, 1.1, '#a01818');
}
function primate(ctx, col) {
  // curling tail
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-7, 6); ctx.quadraticCurveTo(-19, 4, -15, -9); ctx.stroke(); ctx.lineCap = 'butt';
  // legs
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  // long arms reaching down
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-11, 4, -8, 9); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -2); ctx.quadraticCurveTo(11, 4, 8, 9); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 1, 8.5, 9); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.16); ellipse(ctx, 0, 2, 4.5, 6); ctx.fill();
  // head with face patch + ears
  circle(ctx, 1, -10, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.25); circle(ctx, -5, -10, 2); ctx.fill(); circle(ctx, 7, -10, 2); ctx.fill();
  ellipse(ctx, 1, -9, 4.4, 5); fill(ctx, shade(col, 0.42));
  ctx.fillStyle = shade(col, -0.3); rr(ctx, -2.5, -13.5, 7, 1.6, 0.8); ctx.fill(); // brow
  eyeW(ctx, -1, -10, 1.1); eyeW(ctx, 3, -10, 1.1);
}
function reptile(ctx, col) {
  // long tapering tail
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-25, 7, -21, -4); ctx.stroke(); ctx.lineCap = 'butt';
  // sprawled legs
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -6, 6, 5, 5, 2); ctx.fill(); rr(ctx, 3, 6, 5, 5, 2); ctx.fill();
  // body
  ellipse(ctx, 0, 2, 13, 7); fill(ctx, col); line(ctx);
  // dorsal ridge
  ctx.fillStyle = shade(col, -0.35); for (const x of [-7, -3, 1, 5]) { path(ctx, () => { ctx.moveTo(x, -4); ctx.lineTo(x + 1.4, -7.5); ctx.lineTo(x + 2.8, -4); }); ctx.fill(); }
  // mottled scales
  ctx.fillStyle = 'rgba(20,30,10,0.35)'; circle(ctx, -4, 1, 1.6); ctx.fill(); circle(ctx, 2, 3, 1.6); ctx.fill(); circle(ctx, -1, -1, 1.2); ctx.fill();
  // head + jaw + eye + flicking tongue
  ellipse(ctx, 13, 0, 7, 5); fill(ctx, col); line(ctx);
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(15, 2); ctx.lineTo(20, 1.6); ctx.stroke();
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20, 1.8); ctx.lineTo(23, 1.4); ctx.stroke();
  eyeW(ctx, 14, -2, 1.1, '#15110b');
}
function serpent(ctx, col) {
  // coiled body, lighter belly stripe over it
  ctx.strokeStyle = col; ctx.lineWidth = 6.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-11, 11); ctx.quadraticCurveTo(9, 8, -4, 0); ctx.quadraticCurveTo(-14, -6, 4, -8); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = shade(col, 0.28); ctx.beginPath(); ctx.moveTo(-11, 11); ctx.quadraticCurveTo(9, 8, -4, 0); ctx.stroke();
  // scale ticks
  ctx.lineWidth = 1; ctx.strokeStyle = shade(col, -0.3);
  ctx.beginPath(); for (let i = 0; i < 5; i++) { const t = i / 5; ctx.moveTo(-9 + t * 14, 9 - t * 9); ctx.lineTo(-7 + t * 14, 11 - t * 9); } ctx.stroke();
  ctx.lineCap = 'butt';
  // hooded head
  path(ctx, () => { ctx.moveTo(5, -9); ctx.quadraticCurveTo(0, -7, 2, -3); ctx.quadraticCurveTo(5, -2, 8, -3); ctx.quadraticCurveTo(10, -7, 5, -9); }); fill(ctx, col); line(ctx, OUTLINE, 1.1);
  circle(ctx, 5, -8, 3.4); fill(ctx, col); line(ctx, OUTLINE, 1.1);
  // slit eye + forked tongue
  ctx.fillStyle = '#ffe24a'; ellipse(ctx, 6, -9, 1.4, 1); ctx.fill();
  ctx.fillStyle = '#1a140d'; rr(ctx, 5.7, -9.8, 0.7, 1.6, 0.3); ctx.fill();
  ctx.strokeStyle = '#d8324a'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(12, -8.6); ctx.moveTo(12, -8.6); ctx.lineTo(13, -9.6); ctx.moveTo(12, -8.6); ctx.lineTo(13, -7.6); ctx.stroke(); ctx.lineCap = 'butt';
}
function crab(ctx, col) {
  // walking legs (jointed)
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(s * 6, 4); ctx.lineTo(s * (10 + i * 2), 6 + i); ctx.lineTo(s * (12 + i * 2), 11); ctx.stroke(); }
  ctx.lineCap = 'butt';
  // domed shell with rim
  ellipse(ctx, 0, 2, 12, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.25); ellipse(ctx, -2, -1, 8, 3.5); ctx.fill();
  ctx.fillStyle = shade(col, -0.18); ellipse(ctx, 0, 5, 10, 2.5); ctx.fill();
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(-4, 4); ctx.moveTo(0, 1); ctx.lineTo(0, 4); ctx.moveTo(6, 1); ctx.lineTo(4, 4); ctx.stroke();
  // big pincer claws
  for (const s of [-1, 1]) {
    ctx.fillStyle = col; ellipse(ctx, s * 12, -1, 4, 3.4); ctx.fill(); line(ctx, OUTLINE, 1.1);
    ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(s * 14, -3); ctx.lineTo(s * 17, -1); ctx.lineTo(s * 13, -1); }); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s * 10, -1); ctx.lineTo(s * 15, -1); ctx.stroke();
  }
  // eyestalks
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.lineTo(-3, -10); ctx.moveTo(3, -6); ctx.lineTo(3, -10); ctx.stroke();
  eyeW(ctx, -3, -10, 1.4); eyeW(ctx, 3, -10, 1.4);
}
function fowl(ctx, col) {
  ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(-4.5, 13); ctx.lineTo(-1.5, 13);
  ctx.moveTo(3, 8); ctx.lineTo(3, 13); ctx.moveTo(1.5, 13); ctx.lineTo(4.5, 13); ctx.stroke(); ctx.lineCap = 'butt';
  // body
  ellipse(ctx, 0, 2, 9, 8); fill(ctx, col); line(ctx);
  // layered tail feathers
  path(ctx, () => { ctx.moveTo(-7, -2); ctx.lineTo(-15, -9); ctx.lineTo(-7, 4); }); fill(ctx, shade(col, -0.18)); line(ctx);
  path(ctx, () => { ctx.moveTo(-7, 0); ctx.lineTo(-13, -4); ctx.lineTo(-7, 4); }); fill(ctx, shade(col, 0.12));
  // folded wing
  ctx.fillStyle = shade(col, -0.12); ellipse(ctx, -1, 2, 5.5, 5); ctx.fill();
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(2, 4); ctx.stroke();
  // head + comb + wattle + beak
  circle(ctx, 7, -7, 5); fill(ctx, shade(col, 0.12)); line(ctx);
  ctx.fillStyle = '#d23b2e'; circle(ctx, 6, -12, 1.6); ctx.fill(); circle(ctx, 8.5, -12, 1.6); ctx.fill();
  ctx.fillStyle = '#c2302a'; ellipse(ctx, 7, -3.5, 1.4, 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(11, -7); ctx.lineTo(16, -6); ctx.lineTo(11, -4); }); fill(ctx, '#f0a93b');
  eyeW(ctx, 8.4, -8, 1.1);
}
function greenman(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  rr(ctx, -7, -4, 14, 13, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.14); ellipse(ctx, -2, 0, 4, 6); ctx.fill();      // chest light
  ctx.fillStyle = '#7a5a2a'; rr(ctx, -7, 6, 14, 5, 2); ctx.fill();               // loincloth
  ctx.fillStyle = '#5a4220'; rr(ctx, -7, 6, 14, 1.4, 1); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  // head + pointy ears
  circle(ctx, 0, -10, 7); fill(ctx, shade(col, 0.1)); line(ctx);
  path(ctx, () => { ctx.moveTo(-6, -11); ctx.lineTo(-12, -14); ctx.lineTo(-6, -7); }); fill(ctx, shade(col, 0.1)); line(ctx, OUTLINE, 1.1);
  path(ctx, () => { ctx.moveTo(6, -11); ctx.lineTo(12, -14); ctx.lineTo(6, -7); }); fill(ctx, shade(col, 0.1)); line(ctx, OUTLINE, 1.1);
  // brow, big nose, snaggle teeth
  ctx.fillStyle = shade(col, -0.3); rr(ctx, -5, -13, 10, 1.6, 0.8); ctx.fill();
  ctx.fillStyle = shade(col, -0.15); ellipse(ctx, 0.5, -8.5, 1.6, 2.4); ctx.fill();
  ctx.fillStyle = '#f4efe0'; path(ctx, () => { ctx.moveTo(-2.5, -6); ctx.lineTo(-1.5, -4); ctx.lineTo(-0.5, -6); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(1.5, -6); ctx.lineTo(2.5, -4); ctx.lineTo(3.5, -6); }); ctx.fill();
  eyeW(ctx, -2.6, -10.5, 1.3, '#7a1010'); eyeW(ctx, 3, -10.5, 1.3, '#7a1010');
}
function spider(ctx, col) {
  // 8 jointed legs
  ctx.strokeStyle = shade(col, -0.12); ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2, 3]) {
    const ky = -3 + i * 3.4;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(s * (7 + i * 2.4), ky); ctx.lineTo(s * (11 + i * 2.6), ky + 5); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // abdomen with marking
  ellipse(ctx, 0, 4, 8, 7); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.3); path(ctx, () => { ctx.moveTo(0, -1); ctx.lineTo(2.6, 5); ctx.lineTo(0, 9); ctx.lineTo(-2.6, 5); }); ctx.fill();
  // cephalothorax + fangs
  circle(ctx, 0, -4, 4.6); fill(ctx, shade(col, -0.15)); line(ctx);
  fang(ctx, -1.6, -0.5, 1, 2.2, shade(col, -0.4)); fang(ctx, 1.6, -0.5, 1, 2.2, shade(col, -0.4));
  // cluster of eyes
  ctx.fillStyle = '#ff3b3b'; for (const [ex, ey] of [[-2.2, -5], [2.2, -5], [-1, -6.4], [1, -6.4]]) { circle(ctx, ex, ey, 0.9); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; circle(ctx, -2.5, -5.3, 0.3); ctx.fill(); circle(ctx, 1.9, -5.3, 0.3); ctx.fill();
}
function slime(ctx, col) {
  // wobbly translucent blob with a couple of drips
  ctx.globalAlpha = 0.92;
  path(ctx, () => { ctx.moveTo(-10, 10); ctx.quadraticCurveTo(-12, -6, 0, -7); ctx.quadraticCurveTo(12, -6, 10, 10); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col; circle(ctx, -5, 10, 2); ctx.fill(); circle(ctx, 5, 10, 1.6); ctx.fill();
  // glossy highlight + inner bubbles
  ctx.fillStyle = shade(col, 0.4); ellipse(ctx, -3, -2, 3, 4.4); ctx.fill();
  ctx.fillStyle = shade(col, 0.2); circle(ctx, 4, 4, 1.6); ctx.fill(); circle(ctx, -5, 5, 1.1); ctx.fill();
  // face
  eyeW(ctx, -3, 1, 1.5); eyeW(ctx, 3.5, 1, 1.5);
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0.3, 4, 2, 0.2, Math.PI - 0.2); ctx.stroke();
}
function ghost(ctx, col) {
  // faint outer aura
  const g = ctx.createRadialGradient(0, -4, 2, 0, -4, 16); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; circle(ctx, 0, -4, 16); ctx.fill();
  ctx.globalAlpha = 0.82;
  path(ctx, () => { ctx.moveTo(-8, 10); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(-8, -14, 0, -14); ctx.quadraticCurveTo(8, -14, 8, -6); ctx.lineTo(8, 10); ctx.lineTo(5, 7); ctx.lineTo(2, 10); ctx.lineTo(-1, 7); ctx.lineTo(-4, 10); ctx.lineTo(-8, 7); }); fill(ctx, col); line(ctx);
  // body sheen
  ctx.fillStyle = shade(col, 0.3); ellipse(ctx, -3, -6, 2.4, 4); ctx.fill();
  ctx.globalAlpha = 1;
  // hollow glowing eyes + wailing mouth
  ctx.fillStyle = '#1a1824'; ellipse(ctx, -3, -7, 1.5, 2.1); ctx.fill(); ellipse(ctx, 3, -7, 1.5, 2.1); ctx.fill();
  ctx.fillStyle = 'rgba(180,210,255,0.9)'; circle(ctx, -3, -7.4, 0.6); ctx.fill(); circle(ctx, 3, -7.4, 0.6); ctx.fill();
  ctx.fillStyle = '#1a1824'; ellipse(ctx, 0, -2, 1.5, 2.2); ctx.fill();
}
function demon(ctx, col) {
  // bat-like wings behind
  ctx.fillStyle = shade(col, -0.4);
  path(ctx, () => { ctx.moveTo(-6, -3); ctx.lineTo(-16, -9); ctx.lineTo(-13, -3); ctx.lineTo(-16, 1); ctx.lineTo(-7, 3); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(6, -3); ctx.lineTo(16, -9); ctx.lineTo(13, -3); ctx.lineTo(16, 1); ctx.lineTo(7, 3); }); ctx.fill();
  // hooved legs
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120e'; rr(ctx, -5, 12.5, 4, 2.4, 1); ctx.fill(); rr(ctx, 1, 12.5, 4, 2.4, 1); ctx.fill();
  // muscular torso
  rr(ctx, -7, -4, 14, 12, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.18); ellipse(ctx, 0, 4, 5, 4); ctx.fill();
  ctx.fillStyle = shade(col, 0.14); ellipse(ctx, -2.5, -1, 2.6, 3.5); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -11, -3, 4, 9, 2); ctx.fill(); rr(ctx, 7, -3, 4, 9, 2); ctx.fill();
  // head + horns + fanged grin
  circle(ctx, 0, -10, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.3); path(ctx, () => { ctx.moveTo(-6, -13); ctx.lineTo(-9, -20); ctx.lineTo(-3, -14); }); ctx.fill(); path(ctx, () => { ctx.moveTo(6, -13); ctx.lineTo(9, -20); ctx.lineTo(3, -14); }); ctx.fill();
  ctx.fillStyle = '#f4efe0'; for (const x of [-3, -1, 1, 3]) { path(ctx, () => { ctx.moveTo(x - 0.7, -6.5); ctx.lineTo(x + 0.7, -6.5); ctx.lineTo(x, -4.8); }); ctx.fill(); }
  // glowing eyes
  ctx.fillStyle = '#ffd24a'; for (const x of [-2.3, 2.3]) { circle(ctx, x, -10, 1.4); ctx.fill(); }
  ctx.fillStyle = '#fff7d0'; circle(ctx, -2.3, -10, 0.5); ctx.fill(); circle(ctx, 2.3, -10, 0.5); ctx.fill();
}
function golem(ctx, col) {
  // chunky legs/arms
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -6, 6, 4.5, 8, 1); ctx.fill(); rr(ctx, 1.5, 6, 4.5, 8, 1); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -13, -4, 5, 11, 2); ctx.fill(); rr(ctx, 8, -4, 5, 11, 2); ctx.fill();
  ctx.fillStyle = shade(col, -0.3); rr(ctx, -13.5, 5, 5.5, 3, 1); ctx.fill(); rr(ctx, 8, 5, 5.5, 3, 1); ctx.fill(); // fists
  // boulder torso with facets + cracks
  rr(ctx, -9, -6, 18, 14, 3); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.16); path(ctx, () => { ctx.moveTo(-9, -6); ctx.lineTo(2, -6); ctx.lineTo(-4, 1); ctx.lineTo(-9, 1); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(9, 8); ctx.lineTo(2, 8); ctx.lineTo(7, 1); ctx.lineTo(9, 1); }); ctx.fill();
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, 1); ctx.lineTo(3, -3); ctx.moveTo(3, 8); ctx.lineTo(5, 2); ctx.stroke();
  // head with glowing rune eyes
  rr(ctx, -5, -15, 10, 9, 2); fill(ctx, shade(col, 0.08)); line(ctx);
  ctx.fillStyle = '#ffce4a'; rr(ctx, -3.4, -12, 2.6, 2.6, 1); ctx.fill(); rr(ctx, 0.8, -12, 2.6, 2.6, 1); ctx.fill();
  ctx.fillStyle = '#fff3c0'; rr(ctx, -3.4, -12, 2.6, 1, 0.5); ctx.fill(); rr(ctx, 0.8, -12, 2.6, 1, 0.5); ctx.fill();
}
function undead(ctx, col) {
  // bony legs + arms
  ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, 13); ctx.moveTo(3, 8); ctx.lineTo(3, 13);
  ctx.moveTo(-5, -1); ctx.lineTo(-9, 5); ctx.moveTo(5, -1); ctx.lineTo(9, 5); ctx.stroke(); ctx.lineCap = 'butt';
  // ribcage
  rr(ctx, -5, -3, 10, 11, 2); fill(ctx, shade(col, -0.05)); line(ctx);
  ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 8); ctx.stroke();
  for (const yy of [-1, 2, 5]) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.quadraticCurveTo(0, yy + 1.6, 4, yy); ctx.stroke(); }
  // skull: cranium, sockets, nose, jaw + teeth
  circle(ctx, 0, -10, 6); fill(ctx, col); line(ctx);
  ctx.fillStyle = '#15110b'; ellipse(ctx, -2.4, -10.5, 1.7, 2); ctx.fill(); ellipse(ctx, 2.4, -10.5, 1.7, 2); ctx.fill();
  ctx.fillStyle = '#7a1414'; circle(ctx, -2.4, -10.5, 0.8); ctx.fill(); circle(ctx, 2.4, -10.5, 0.8); ctx.fill(); // eye glow
  ctx.fillStyle = '#15110b'; path(ctx, () => { ctx.moveTo(0, -8.5); ctx.lineTo(-1, -6.6); ctx.lineTo(1, -6.6); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.1); rr(ctx, -3, -6, 6, 2.4, 0.6); ctx.fill();
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-1.5, -6); ctx.lineTo(-1.5, -3.8); ctx.moveTo(0, -6); ctx.lineTo(0, -3.8); ctx.moveTo(1.5, -6); ctx.lineTo(1.5, -3.8); ctx.stroke();
}
function insect(ctx, col) {
  // blurred beating wings
  ctx.globalAlpha = 0.55; ctx.fillStyle = '#dffaff'; ellipse(ctx, -6, -3, 7, 3.4); ctx.fill(); ellipse(ctx, 6, -3, 7, 3.4); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(180,220,235,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-2, -2); ctx.moveTo(10, -3); ctx.lineTo(2, -2); ctx.stroke();
  // legs
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) { ctx.beginPath(); ctx.moveTo(s * 2, 3 + i); ctx.lineTo(s * 6, 8 + i * 1.5); ctx.stroke(); }
  ctx.lineCap = 'butt';
  // segmented abdomen + thorax
  ellipse(ctx, 0, 4, 5, 7); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-4, 3); ctx.lineTo(4, 3); ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.stroke();
  circle(ctx, 0, -5, 3.4); fill(ctx, shade(col, -0.18)); line(ctx);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-4, -12); ctx.moveTo(2, -8); ctx.lineTo(4, -12); ctx.stroke();
  ctx.fillStyle = '#9b1e1e'; circle(ctx, -1.5, -5, 1.2); ctx.fill(); circle(ctx, 1.5, -5, 1.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(ctx, -1.8, -5.4, 0.4); ctx.fill(); circle(ctx, 1.2, -5.4, 0.4); ctx.fill();
}
function scorpion(ctx, col) {
  // legs
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (const i of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(i * 3, 7); ctx.lineTo(i * 3 - 4, 11); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 3, 7); ctx.lineTo(i * 3 + 4, 11); ctx.stroke(); }
  // segmented tail curling over the back to a stinger
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 6); ctx.quadraticCurveTo(18, 4, 14, -8); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = shade(col, -0.25); ctx.beginPath(); ctx.moveTo(9, 5); ctx.quadraticCurveTo(17, 3, 14, -7); ctx.stroke(); ctx.lineCap = 'butt';
  fang(ctx, 14, -10, 1.4, 3, shade(col, -0.35)); // stinger
  // segmented body
  ellipse(ctx, 0, 4, 9, 5); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, 8); ctx.moveTo(2, 0); ctx.lineTo(2, 8); ctx.stroke();
  // grasping pincers
  for (const [px, py] of [[-10, 1], [-12, 4.5]]) { ctx.fillStyle = col; ellipse(ctx, px, py, 3, 2.2); ctx.fill(); line(ctx, OUTLINE, 1); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(px + 2, py); ctx.stroke(); }
  eyeW(ctx, 3, 2.5, 0.9, '#15110b');
}
function bat(ctx, col) {
  // scalloped wings with finger ribs
  ctx.fillStyle = col;
  path(ctx, () => { ctx.moveTo(-3, 0); ctx.lineTo(-15, -7); ctx.lineTo(-12, -1); ctx.lineTo(-15, 1); ctx.lineTo(-11, 3); ctx.lineTo(-14, 5); ctx.lineTo(-4, 4); }); ctx.fill(); line(ctx, OUTLINE, 1);
  path(ctx, () => { ctx.moveTo(3, 0); ctx.lineTo(15, -7); ctx.lineTo(12, -1); ctx.lineTo(15, 1); ctx.lineTo(11, 3); ctx.lineTo(14, 5); ctx.lineTo(4, 4); }); ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(-13, -5); ctx.moveTo(4, 1); ctx.lineTo(13, -5); ctx.stroke();
  // fuzzy body + ears
  circle(ctx, 0, 0, 5); fill(ctx, shade(col, 0.12)); line(ctx);
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(-3, -4); ctx.lineTo(-4, -8); ctx.lineTo(-1, -5); }); ctx.fill(); path(ctx, () => { ctx.moveTo(3, -4); ctx.lineTo(4, -8); ctx.lineTo(1, -5); }); ctx.fill();
  // eyes + tiny fangs
  ctx.fillStyle = '#ffe24a'; circle(ctx, -1.7, -0.6, 1); ctx.fill(); circle(ctx, 1.7, -0.6, 1); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, -1.7, -0.6, 0.4); ctx.fill(); circle(ctx, 1.7, -0.6, 0.4); ctx.fill();
  fang(ctx, -1, 2.4, 0.7, 1.4); fang(ctx, 1, 2.4, 0.7, 1.4);
}
function seacreature(ctx, col) {
  // body
  path(ctx, () => { ctx.moveTo(-12, 2); ctx.quadraticCurveTo(0, -9, 14, 1); ctx.quadraticCurveTo(0, 11, -12, 2); }); fill(ctx, col); line(ctx);
  // pale underbelly
  ctx.fillStyle = shade(col, 0.3); path(ctx, () => { ctx.moveTo(-10, 3); ctx.quadraticCurveTo(2, 9, 12, 1.5); ctx.quadraticCurveTo(0, 7, -10, 3); }); ctx.fill();
  // tail fluke
  path(ctx, () => { ctx.moveTo(-12, 2); ctx.lineTo(-18, -4); ctx.lineTo(-15, 2); ctx.lineTo(-18, 8); }); fill(ctx, shade(col, -0.15)); line(ctx, OUTLINE, 1);
  // dorsal + pectoral fins
  ctx.fillStyle = shade(col, -0.18); path(ctx, () => { ctx.moveTo(1, -6); ctx.lineTo(5, -14); ctx.lineTo(8, -5); }); ctx.fill();
  path(ctx, () => { ctx.moveTo(-1, 4); ctx.lineTo(-4, 10); ctx.lineTo(3, 5); }); ctx.fill();
  // gills + jaw line
  ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(5, 3); ctx.moveTo(8, -3); ctx.lineTo(7, 3); ctx.stroke();
  ctx.strokeStyle = '#1a140d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(11, 2); ctx.lineTo(15, 1.5); ctx.stroke();
  eyeW(ctx, 9, -1, 1.2);
}
function plant(ctx, col) {
  // stem
  ctx.strokeStyle = shade(col, -0.2); ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2); ctx.stroke(); ctx.lineCap = 'butt';
  // leaves with veins
  for (const s of [-1, 1]) {
    ctx.fillStyle = shade(col, -0.05);
    path(ctx, () => { ctx.moveTo(0, 5); ctx.quadraticCurveTo(s * 12, 4, s * 9, -3); ctx.quadraticCurveTo(s * 4, 1, 0, 5); }); ctx.fill(); line(ctx, OUTLINE, 0.8);
    ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(s * 8, -2); ctx.stroke();
  }
  // gaping flytrap maw (upper + lower jaw) with teeth
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-7, -5); ctx.quadraticCurveTo(0, -17, 7, -5); ctx.quadraticCurveTo(0, -9, -7, -5); }); ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.fillStyle = '#7a1020'; ellipse(ctx, 0, -6.5, 4, 2.6); ctx.fill();
  ctx.fillStyle = '#fff';
  for (const x of [-4, -2, 0, 2, 4]) { path(ctx, () => { ctx.moveTo(x, -8.5); ctx.lineTo(x + 0.9, -6.4); ctx.lineTo(x - 0.9, -6.4); }); ctx.fill(); } // upper teeth
  for (const x of [-3, -1, 1, 3]) { path(ctx, () => { ctx.moveTo(x, -4.6); ctx.lineTo(x + 0.9, -6.6); ctx.lineTo(x - 0.9, -6.6); }); ctx.fill(); } // lower teeth
  ctx.fillStyle = shade(col, 0.3); circle(ctx, -3, -9, 1.1); ctx.fill(); // lure highlight
}
function drake(ctx, col) {
  // membrane wing with ribs
  ctx.fillStyle = shade(col, -0.22);
  path(ctx, () => { ctx.moveTo(-2, -2); ctx.lineTo(-17, -11); ctx.lineTo(-13, -3); ctx.lineTo(-17, 0); ctx.lineTo(-12, 1); ctx.lineTo(-15, 4); ctx.lineTo(-4, 2); }); ctx.fill(); line(ctx, OUTLINE, 1);
  ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-15, -9); ctx.moveTo(-3, -1); ctx.lineTo(-14, -1); ctx.stroke();
  // spiked tail
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(-17, 9, -13, 0); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = col; path(ctx, () => { ctx.moveTo(-13, 1); ctx.lineTo(-16, -3); ctx.lineTo(-11, -1); }); ctx.fill();
  // legs + body
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -6, 5, 4, 8, 2); ctx.fill(); rr(ctx, 2, 5, 4, 8, 2); ctx.fill();
  ellipse(ctx, 0, 1, 9, 8); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.18); ellipse(ctx, 0, 5, 6, 3); ctx.fill();
  // dorsal spines
  ctx.fillStyle = shade(col, -0.3); for (const x of [-4, -1, 2]) { path(ctx, () => { ctx.moveTo(x, -6); ctx.lineTo(x + 1.4, -10); ctx.lineTo(x + 2.8, -6); }); ctx.fill(); }
  // head + horn + snout
  circle(ctx, 9, -3, 5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, -0.3); path(ctx, () => { ctx.moveTo(7, -7); ctx.lineTo(6, -13); ctx.lineTo(10, -8); }); ctx.fill();
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, 13, -2, 3, 2); ctx.fill();
  ctx.fillStyle = '#1a140d'; circle(ctx, 14.5, -2.4, 0.6); ctx.fill();
  fang(ctx, 12.5, 0, 1, 2, '#f4efe0');
  eyeW(ctx, 10.5, -4, 1.2, '#7a1010');
}
function wisp(ctx, col) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; circle(ctx, 0, 0, 12); ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, 0, 0, 3); ctx.fill();
}
function humanoid(ctx, col) {
  // legs + boots
  ctx.fillStyle = shade(col, -0.4); rr(ctx, -5, 6, 4, 8, 2); ctx.fill(); rr(ctx, 1, 6, 4, 8, 2); ctx.fill();
  ctx.fillStyle = '#1a120c'; rr(ctx, -5.4, 12, 5, 2.4, 1); ctx.fill(); rr(ctx, 0.6, 12, 5, 2.4, 1); ctx.fill();
  // hooded cloak torso with shading
  rr(ctx, -7, -5, 14, 13, 4); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.14); rr(ctx, -7, -5, 3.4, 13, 4); ctx.fill();
  ctx.fillStyle = shade(col, -0.25); rr(ctx, 4.5, -5, 2.5, 13, 3); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -10, -3, 4, 9, 2); ctx.fill(); rr(ctx, 6, -3, 4, 9, 2); ctx.fill();
  ctx.fillStyle = '#d8a578'; circle(ctx, -8, 6, 2); ctx.fill(); circle(ctx, 8, 6, 2); ctx.fill();
  // hood with shadowed face + glinting eyes
  circle(ctx, 0, -11, 6.5); fill(ctx, shade(col, -0.45)); line(ctx);
  ctx.fillStyle = col; path(ctx, () => { ctx.arc(0, -12, 6.8, Math.PI, Math.PI * 2); ctx.lineTo(6.8, -9); ctx.quadraticCurveTo(0, -13, -6.8, -9); }); ctx.fill();
  ctx.fillStyle = shade(col, -0.2); path(ctx, () => { ctx.moveTo(0, -18); ctx.lineTo(5, -10); ctx.lineTo(-5, -10); }); ctx.fill(); // hood peak
  ctx.fillStyle = '#ffe24a'; circle(ctx, -2.2, -10.5, 0.9); ctx.fill(); circle(ctx, 2.2, -10.5, 0.9); ctx.fill();
  // drawn dagger
  ctx.strokeStyle = '#e9edf2'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(10, 9); ctx.lineTo(13, -5); ctx.stroke();
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(8.5, 8); ctx.lineTo(11.5, 6); ctx.stroke();
}

function hound(ctx, col) {
  // bushy tail
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-16, -2, -12, -8); ctx.stroke(); ctx.lineCap = 'butt';
  // legs (two tones for depth)
  ctx.fillStyle = shade(col, -0.22); rr(ctx, -7, 6, 3.5, 7, 1); ctx.fill(); rr(ctx, 3, 6, 3.5, 7, 1); ctx.fill();
  ctx.fillStyle = shade(col, -0.05); rr(ctx, -4, 7, 3.3, 6, 1); ctx.fill(); rr(ctx, 5.5, 7, 3.3, 6, 1); ctx.fill();
  // body
  ellipse(ctx, -1, 2, 11, 6.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.14); ellipse(ctx, -2, -1, 7, 2); ctx.fill();
  // head, ear, snout, fang
  circle(ctx, 9, -2, 5.5); fill(ctx, col); line(ctx);
  path(ctx, () => { ctx.moveTo(6, -6); ctx.lineTo(5, -12); ctx.lineTo(9, -7); }); fill(ctx, shade(col, -0.25)); // ear
  path(ctx, () => { ctx.moveTo(13, -1); ctx.lineTo(17, 1); ctx.lineTo(13, 3.4); }); fill(ctx, shade(col, 0.2)); // snout
  ctx.fillStyle = '#1a140d'; circle(ctx, 16.4, 1, 0.7); ctx.fill();
  fang(ctx, 13.5, 3.2, 1, 1.8);
  eyeW(ctx, 10.5, -3, 1.1, '#3a1010');
}
function jellyfish(ctx, col) {
  ctx.globalAlpha = 0.85;
  path(ctx, () => { ctx.moveTo(-9, 2); ctx.quadraticCurveTo(-9, -10, 0, -10); ctx.quadraticCurveTo(9, -10, 9, 2); ctx.quadraticCurveTo(4, 5, 0, 2); ctx.quadraticCurveTo(-4, 5, -9, 2); }); fill(ctx, col); line(ctx);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(col, 0.3); ellipse(ctx, -3, -5, 2.5, 3.5); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const x of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.quadraticCurveTo(x + 2, 8, x - 1, 13); ctx.stroke(); }
  ctx.lineCap = 'butt';
}
function mantis(ctx, col) {
  ctx.fillStyle = shade(col, -0.2); rr(ctx, -4, 6, 3, 7, 1); ctx.fill(); rr(ctx, 1, 6, 3, 7, 1); ctx.fill();
  ellipse(ctx, -2, 1, 6, 8); fill(ctx, col); line(ctx);
  ctx.strokeStyle = shade(col, -0.1); ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(3, -2); ctx.lineTo(9, -6); ctx.lineTo(7, -10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3, 1); ctx.lineTo(10, -2); ctx.lineTo(9, -6); ctx.stroke(); ctx.lineCap = 'butt';
  circle(ctx, 2, -9, 3.6); fill(ctx, col); line(ctx);
  circle(ctx, 0.6, -10, 1); fill(ctx, '#1a140d'); circle(ctx, 3.4, -10, 1); fill(ctx, '#1a140d');
}
function turtle(ctx, col) {
  // flippers + tail
  ctx.fillStyle = shade(col, -0.25); rr(ctx, -10, 6, 4, 4, 2); ctx.fill(); rr(ctx, 6, 6, 4, 4, 2); ctx.fill();
  path(ctx, () => { ctx.moveTo(-11, 1); ctx.lineTo(-15, 2); ctx.lineTo(-11, 4); }); ctx.fill();
  // head
  circle(ctx, 11, 1, 4); fill(ctx, shade(col, 0.22)); line(ctx);
  eyeW(ctx, 12.4, 0, 1, '#15110b');
  // domed shell with hexagon scutes
  ellipse(ctx, 0, 1, 12, 8.5); fill(ctx, col); line(ctx);
  ctx.fillStyle = shade(col, 0.18); ellipse(ctx, 0, -1.5, 5, 3.5); ctx.fill();
  ctx.strokeStyle = shade(col, -0.32); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.moveTo(-7, 2); ctx.lineTo(7, 2); ctx.moveTo(-5, 6); ctx.lineTo(5, 6);
  ctx.moveTo(-5, -3); ctx.lineTo(-7, 2); ctx.lineTo(-5, 6); ctx.moveTo(0, -3); ctx.lineTo(0, 6); ctx.moveTo(5, -3); ctx.lineTo(7, 2); ctx.lineTo(5, 6);
  ctx.stroke();
}
```

---

## Acceptance criteria
- Each function keeps its **name and `(ctx, col)` signature**; still tinted by `col`; reads well across the hues listed in the roster.
- Stays within the coordinate bounds; feet near y≈+13; draws facing right.
- Uses **only** the allowed `ctx` API (so the headless render test passes).
- No shadow/aura/crown/health-bar (engine adds those); no images/SVG/DOM.
- Reasonably cheap (per-frame).

## How it will be validated
Dropped back into `src/render/sprites.js`, then `npm test` runs a headless render test that calls every creature in **both facings, moving and idle**, against a stub canvas context — so any disallowed API or runtime error fails the suite.

*(Generated from the live SingaporeScape source.)*
