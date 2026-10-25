# SingaporeScape: guide for coding agents

This file is the shared brief for every AI coding agent working on this repo
(OpenAI Codex reads `AGENTS.md`; Claude Code reads it through `CLAUDE.md`).
**Two agents work on this game, sometimes at the same time: Claude and Codex.**
Read the "Working alongside another agent" section before you change anything.

- **Live game:** https://aworthysg.github.io/SINGAPORESCAPE/
- **Repo:** `aworthysg/singaporescape`, default branch `main`
- **Owner:** the human who requests work, reviews PRs and says when to merge.

## What the game is

A cosy, original RuneScape-style RPG set on a stylised Singapore, drawn in the
"A-Worthy" die-cut sticker style (cute chibi mascots, navy ink outlines, white
sticker borders, pastel colours). It runs entirely in the browser:

- Vanilla JavaScript ES modules, HTML5 canvas 2D, plain CSS. **No dependencies,
  no bundler, no build step.** Don't add any.
- One 400×280-tile world of regions (Kampong Glam is the starting town), 0.6s
  game ticks, OSRS-style XP curve, 17 job classes, life skills, quests, bosses
  with telegraphed signature moves, auto battle, banking, shops, a minimap.
- Saves to `localStorage`. Deployed as a static site on GitHub Pages.

## Run, test, deploy

```bash
npm start            # node serve.mjs -> http://localhost:8080 (ES modules need a server)
npm test             # node --test tests/*.test.mjs  (Node 22; all tests must pass)
```

- Every push to `main` runs the tests and, if they pass, **deploys straight to
  the live site** (`.github/workflows/deploy.yml`). There is no staging.
- So nothing reaches `main` except through a reviewed PR the owner has
  approved. Never push to `main` directly.
- The tests boot the whole `Game` headlessly (no DOM, no `Image`): rendering
  code must fall back gracefully when `document` / `Image` are missing.
- To check a change visually, run `npm start` and drive the page with Playwright
  (Chromium). The splash button is `#splash-enter`, then a class must be picked
  (e.g. click `text=Rogue`). `window.game` is not exposed.

## Code map

| Path | What lives there |
|---|---|
| `src/main.js` | Boot: creates `Game`, `UI`, `Renderer`, input, audio; the frame loop |
| `src/config.js` | Constants: `TILE` 32px, `TICK_MS` 600, `COMBAT_BEAT_MS` 300, save key, XP rate |
| `src/game/game.js` | **The core (~3.5k lines).** World state, the tick (`doTick`), combat, skilling, quests (`questGuide`, `questTravel`), auto battle (`_autoBattleTick`, `_autoPickTarget`), bosses and hazards, movement input (`_driveMovement`) |
| `src/game/character.js` | Shared movement for player and NPCs: time-based steps, paths, `stepTile()`, animation state (`walkPhase`, `animMove`, `turnT`) |
| `src/game/player.js`, `npc.js` | Player and NPC classes (NPC AI, champions, respawn) |
| `src/game/save.js` | Save/load. See "Save compatibility" |
| `src/game/combat.js`, `skilling.js`, `equipment.js`, `inventory.js`, `bank.js`, `loot.js`, `bounty.js` | Rules modules |
| `src/engine/pathfinding.js` | A* `findPath(cfg, from, to, { reachAdjacent, maxNodes })` |
| `src/data/*.js` | **Data-driven content**: `items.js`, `npcs.js` (monsters, bosses, townsfolk), `objects.js`, `world.js` (map generation, seeded), `quests.js`, `classes.js`, `lifeskills.js`, `trades.js` (Hunter etc.), `bossAbilities.js`, `abilities.js`, `prayers.js`, `magic.js`, `shops.js`, `dialogue.js` |
| `src/render/renderer.js` | Canvas renderer: chunk-baked terrain with painted ground textures, animated water, depth-sorted drawables, effects, overheads |
| `src/render/sprites.js` | Sprites (~2.5k lines): creatures and their art registries, hero drawing and puppet animation, boss rigs, world-object art |
| `src/render/icons.js` | Item, skill, prayer, spell, ability and tab icons (art registries + SVG fallbacks) |
| `src/ui/ui.js` | All DOM UI (~2.1k lines): HUD, panels, dialogue, shops, bank, quest journal; listens on `game.bus` |
| `styles/main.css` | All styling |
| `assets/` | `creatures/{species,bosses,hero,townsfolk}`, `icons/`, `items/` (older PNGs), `world/` |
| `tests/` | `smoke`, `combat`, `movement`, `integration` (headless game scenarios), `render` (art lock-step checks) |
| `tools/unify_creatures.py` | Standardises new monster art (one border, common size, feet on the ground, gentle colour grade) |

The game core talks to the UI through an event bus (`game.bus.emit('hp')` etc.);
game code calls `this.ui?.method()` defensively because tests run without a UI.

## Conventions

- **Match the surrounding code**: plain-English comments explaining *why*, at
  the same density as nearby code; same naming and idioms. British spelling in
  player-facing text and comments ("colour", "armour").
- **Keep diffs small and local.** Don't reformat, re-indent, reorder or rename
  things you weren't asked to touch. The big files (`game.js`, `sprites.js`,
  `ui.js`, `renderer.js`, `items.js`, `npcs.js`) are shared hot spots; churn in
  them causes merge conflicts for the other agent.
- **Add data by appending** new entries near related ones rather than
  restructuring tables.
- **Tests:** add or update a test for every behaviour change. Integration tests
  build a real `Game` (see the helpers at the top of
  `tests/integration.test.mjs`); stub the UI with a `Proxy` that returns no-op
  functions. Make tests deterministic: the game uses `Math.random` in places,
  so give targets enough HP / loop enough ticks that a run can't flake (two past
  CI failures were exactly this).
- **Performance:** only NPCs within 48 tiles of the player update; terrain is
  baked in 32-tile chunks; static object sprites are cached as bitmaps. Keep new
  per-frame work cheap, and phones in mind (there is a "low graphics" mode).

## Save compatibility

Players have real progress in `localStorage`. `save.js` checks
`version === VERSION` and **discards the save on a mismatch**, so:

- Never bump `VERSION` without writing a migration.
- New saved fields must be optional on load (`typeof x === 'number' ? x : default`),
  as every existing field is.
- Don't rename item, NPC, object or quest ids that saves reference.

## Art pipeline

All art is in the A-Worthy sticker style. New art arrives from the owner as
images or zips (sheets on white backgrounds); it is cut out, sized, saved as
`.webp` and registered:

| Kind | Files | Registered in | Size |
|---|---|---|---|
| Monster species | `assets/creatures/species/<family>.webp` | `SPECIES_ART` (sprites.js) | 256px, run through `tools/unify_creatures.py` |
| Bosses | `assets/creatures/bosses/<npcId>.webp` | `BOSS_ART` | 320px, unify too |
| Boss rigs | `assets/creatures/bosses/rig/<id>_<part>.webp` | `RIGS` | only the Eternal Wyrm so far |
| Class heroes | `assets/creatures/hero/<classId>.webp` | `CLASS_HERO_ART` | 256px tall |
| Townsfolk | `assets/creatures/townsfolk/<npcId>.webp` | `TOWN_ART` | 256px tall |
| Item icons | `assets/icons/item-<id>.webp` | `ITEM_ART` (icons.js) | 160px |
| Skill / ability / prayer / spell icons | `assets/icons/skill-*.webp` etc. | `SKILL_ART`, `ABILITY_SVG` fallbacks | 160 / 128px |
| World objects | `assets/world/{tree,stump,rock,obj}-<id>.webp` | `WORLD_ART` (sprites.js) | ≤200px |
| Ground textures | `assets/world/ground-<terrain>.webp` | `GROUND_TEX` (renderer.js) | 128px seamless |

`tests/render.test.mjs` keeps each registry **in lock-step with the files on
disk** (and checks names are real NPCs/objects): add the file *and* the registry
entry together. Every item now has sticker art; every monster, boss and
townsperson has painted art.

## Working alongside another agent

Claude and Codex may be working on this repo **at the same time**, each in its
own branch and sandbox, neither able to see the other's uncommitted work. These
rules keep that safe:

1. **One task, one branch, one PR.** Branch from the latest `origin/main`.
   Name branches by agent: `codex/<short-topic>` for Codex, `claude/<short-topic>`
   for Claude. **Never push to, rebase, or force-push the other agent's
   branches**, and never push to `main`.
2. **Look before you start.** Check the open PRs (titles start `[Codex]` or
   `[Claude]`). If one already covers your task or edits the same area, tell the
   owner instead of duplicating or racing it.
3. **Claim early.** Open your PR as a **draft as soon as you start**, titled
   `[Codex] …` or `[Claude] …`, and list in its description the files and
   systems you expect to touch. That draft PR is the claim the other agent sees.
4. **Stay in your lane.** Keep changes to the files your task needs. If you
   must change a hot-spot file (`game.js`, `sprites.js`, `ui.js`, `renderer.js`,
   big data tables), make the smallest focused edit and mention it in the PR so
   the owner can sequence merges.
5. **Sync before you finish.** Before marking the PR ready:
   `git fetch origin main`, rebase your branch onto it (your own branch only),
   resolve conflicts by keeping **both** sides' intent, and run `npm test`.
   If `main` moved under you after review, rebase and re-test again.
6. **Shared files need care.** `AGENTS.md` and `CLAUDE.md` are shared:
   change them only when asked, in a PR of their own.
7. **Leave a handoff.** End every PR description with a short "Notes for the
   next agent": what changed, what's unfinished, anything surprising. That is
   how the other agent (and the owner) picks up your context.
8. **The owner merges.** Merges are squash merges done by the owner (or by an
   agent only when the owner says so), one PR at a time, each landing on the
   live site. After a merge, check the "Test & Deploy" Action went green.

## Current state and open threads (Oct 2026)

- All painted art is in except **hero animation parts**. Heroes currently walk
  with a puppet animation cut from their single picture (feet step in turn,
  bounce, lean, turn-around, idle breathing; `heroPuppet` in sprites.js). The
  owner has a prompt page asking a design agent for a six-part sheet per class
  (body, front arm + weapon, back arm, two feet, strike arm), Swordsman first as
  a pilot. When it arrives: cut the parts, add a hero rig (like `RIGS`), and
  animate arms and weapon swings.
- Boss rigs exist only for the Eternal Wyrm; layered-part prompts for the other
  bosses were handed to the owner.
- Fires and farm patches are still drawn procedurally (they animate or show
  growth stages); everything else in the world uses painted art.
- Auto battle and quest auto-travel ("Go" in the quest journal) were reworked
  recently; there are integration tests for both.
