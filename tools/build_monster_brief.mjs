// Builds MONSTER_DESIGN_BRIEF.md — a self-contained handoff doc so an external
// model (Grok) can produce drop-in improved monster art for SingaporeScape.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/render/sprites.js', 'utf8').split('\n');
const slice = (a, b) => src.slice(a - 1, b).join('\n'); // 1-indexed inclusive

const roster = JSON.parse(readFileSync('/tmp/roster.json', 'utf8'));
const OUTLINE_VAL = 'rgba(26,18,12,0.55)';

let rosterTable = '| Archetype | Creatures using it | Count | Level range | Example tints |\n|---|---|---|---|---|\n';
for (const sp of Object.keys(roster).sort()) {
  const r = roster[sp];
  rosterTable += `| \`${sp}\` | ${r.examples.join(', ')} | ${r.count} | ${r.levelMin}–${r.levelMax} | ${r.colors.join(' ')} |\n`;
}

const md = `# SingaporeScape — Monster Visual Design Brief (handoff for Grok)

## What I want from you (Grok)
SingaporeScape is a browser RPG. Every monster is drawn **procedurally on an HTML5 Canvas 2D context** by a small "archetype" function. There are **26 archetype functions** and ~330 monsters are rendered by tinting those archetypes with a per-monster colour. **Please redesign/improve the 26 archetype functions** so the creatures look better — more characterful, readable, and polished — while strictly obeying the rendering contract below so they remain drop-in replacements.

Return your answer as **JavaScript only**: improved versions of each \`function <name>(ctx, col) { ... }\`, keeping the exact same names and signatures. No SVG, no images, no external assets, no libraries.

---

## The rendering contract (must follow exactly)

1. **Signature.** Each archetype is \`function name(ctx, col)\`:
   - \`ctx\` — a standard Canvas 2D context.
   - \`col\` — the monster's tint as a \`#rrggbb\` string. The SAME archetype is reused for many monsters in different hues (see roster), so your design must read well across colours. **Use \`col\` for the main body** and derive shades with the provided \`shade(col, k)\` helper rather than hardcoding the base colour. Fixed accent colours (eyes, teeth, claws, metal) are fine.

2. **Local coordinate space.** You draw in a LOCAL space centred on the origin \`(0,0)\`. Keep the whole creature within roughly **x ∈ [-18, 18]**, **y ∈ [-20, 14]**, with the creature's "feet"/base near **y ≈ +13** (so it sits on the ground correctly). Bigger silhouettes are fine for bosses (the engine scales them up).

3. **Draw facing RIGHT.** The engine mirrors horizontally when the creature faces left, and adds a gentle vertical bob — so just draw a right-facing idle pose.

4. **Do NOT draw** a ground shadow, glow/aura, crown, or health bar — the engine adds those. After your function runs, the engine also overlays a subtle top sheen and (for bosses) a pulsing aura + crown. Just draw the creature body.

5. **Allowed \`ctx\` API only** (the project is unit-tested against a headless stub context — using anything else will break tests):
   - Methods: \`save, restore, translate, scale, rotate, beginPath, closePath, moveTo, lineTo, arc, ellipse, rect, roundRect, quadraticCurveTo, bezierCurveTo, fill, stroke, fillRect, strokeRect, clearRect, fillText, strokeText, createLinearGradient, createRadialGradient\` (+ \`gradient.addColorStop\`).
   - Properties: \`fillStyle, strokeStyle, lineWidth, globalAlpha, font, textAlign, textBaseline, lineCap, lineJoin, globalCompositeOperation\`.
   - **No** \`drawImage\`, no DOM, no \`document\`, no filters, no shadows-via-shadowBlur.

6. **Keep it cheap.** These render every frame for many on-screen creatures. Favour a handful of paths/arcs over hundreds of operations.

---

## Helpers you may call (already defined in the file)

\`\`\`js
const OUTLINE = ${JSON.stringify(OUTLINE_VAL)};

${slice(25, 35)}

// Lighten/darken a #rrggbb colour. k in [-1,1]; negative darkens, positive lightens.
${slice(93, 101)}

// A lively eye: white sclera + pupil + catchlight.
${slice(103, 107)}

// A short fang/claw triangle.
${slice(109, 111)}
\`\`\`

For reference, this is the wrapper the engine uses to place/scale/mirror your drawing (you do **not** write this — it shows the transform your local coordinates go through):

\`\`\`js
${slice(37, 46)}
\`\`\`

And the dispatcher that calls each archetype (shows the sheen/aura/crown added around your draw):

\`\`\`js
${slice(62, 91)}
\`\`\`

---

## The 26 archetypes & which creatures use them
Each archetype is tinted into many monsters. Redesign with this variety in mind (e.g. \`beast\` must look right as a boar, tiger, otter, deer, etc.).

${rosterTable}

---

## Current source to improve (keep names & the \`(ctx, col)\` signature)

\`\`\`js
${slice(135, 563)}
\`\`\`

---

## Acceptance criteria
- Each function keeps its **name and \`(ctx, col)\` signature**; still tinted by \`col\`; reads well across the hues listed in the roster.
- Stays within the coordinate bounds; feet near y≈+13; draws facing right.
- Uses **only** the allowed \`ctx\` API (so the headless render test passes).
- No shadow/aura/crown/health-bar (engine adds those); no images/SVG/DOM.
- Reasonably cheap (per-frame).

## How it will be validated
Dropped back into \`src/render/sprites.js\`, then \`npm test\` runs a headless render test that calls every creature in **both facings, moving and idle**, against a stub canvas context — so any disallowed API or runtime error fails the suite.

*(Generated from the live SingaporeScape source.)*
`;

writeFileSync('MONSTER_DESIGN_BRIEF.md', md);
console.log('wrote MONSTER_DESIGN_BRIEF.md', md.length, 'chars');
