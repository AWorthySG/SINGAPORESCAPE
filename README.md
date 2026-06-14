# SingaporeScape 🇸🇬⚔️

A self-contained, browser-based **RuneScape-style RPG** with a light Singapore
theme. Tile world, click-to-move pathfinding, the authentic Old School RuneScape
XP curve, gatherable skills, turn-based combat on a 0.6s game tick, a 28-slot
inventory, worn equipment, banking, shops, NPC dialogue, and a classic tabbed
HUD with a live minimap — all in **vanilla JavaScript with zero dependencies**.

> This is an **original game inspired by** RuneScape's mechanics. It contains no
> Jagex code, assets, or content, runs entirely offline, and requires no servers
> or accounts. (See [Why not just clone RuneScape?](#why-original-code))

---

## Play it

You need any local web server (ES modules don't load over `file://`). The repo
ships a tiny zero-dependency server:

```bash
npm start          # or: node serve.mjs
# then open http://localhost:8080
```

Any static server works just as well, e.g.:

```bash
python3 -m http.server 8080
npx serve .
```

Your character **auto-saves to the browser** (localStorage) every ~30 seconds
and on key actions, so you can close the tab and pick up where you left off.

---

## Controls

| Action | How |
|---|---|
| Walk / interact | **Left-click** the world |
| More options | **Right-click** anything |
| Chop / mine / fish | Left-click a tree / rock / fishing spot |
| Fight | Left-click a monster |
| Talk / trade / bank | Left-click an NPC or the bank booth |
| Eat / wield / light | Left-click the item in your inventory |
| Switch tabs | Click the bottom-right tabs, or press **1–5** |
| Toggle run | Click the **RUN** orb, or press **R** |
| Close menus | **Esc** |

---

## What you can do

- **Combat** — Attack/Strength/Defence/Hitpoints with OSRS-style accuracy and
  max-hit formulas, three attack styles (Accurate/Aggressive/Defensive), auto
  retaliate, hitsplats, overhead health bars, aggressive monsters, loot drops,
  death & respawn.
- **Woodcutting** — chop trees, oaks and willows for logs.
- **Mining** — mine copper, tin, iron and coal (rocks deplete and respawn).
- **Fishing** — net anchovies, sardines and trout from fishing spots.
- **Firemaking** — light logs with a tinderbox; walk west to lay a line of fires.
- **Cooking** — cook raw fish on a fire or range (burn chance drops with level).
- **Smithing** — smelt ore into bars at the furnace, then hammer bars into
  weapons and armour at the anvil.
- **Banking, shops & dialogue** — store loot at the Bank of Singapore, buy/sell
  at the general store and the hawker centre, and chat with townsfolk.

All skills use the **real OSRS experience table** (level 99 = 13,034,431 xp) and
the in-game level-up interface fires when you advance.

---

## Project layout

```
index.html            # canvas + HUD shell
serve.mjs             # zero-dependency static server
styles/main.css       # RuneScape-flavoured UI styling
src/
  config.js           # tuning constants (tile size, tick length, etc.)
  core/               # utils + event bus
  data/               # pure content: items, npcs, objects, shops, dialogue,
                      #   smithing recipes, the world map, skills & the xp curve
  engine/             # camera, input, A* pathfinding
  game/               # systems: world, skills, inventory, equipment, bank,
                      #   player, npc, combat math, skilling, save, Game loop
  render/renderer.js  # draws the world, entities and combat effects
  ui/ui.js            # panels, chat, minimap, tooltips, context menus, modals
tests/                # Node test suites
```

### Architecture in one paragraph

`Game` owns all state and runs two clocks: smooth, time-based **movement** every
animation frame, and discrete **game logic** on a fixed 600 ms tick (combat,
gathering, respawns). Content lives in pure `data/` modules with no DOM access,
so it's trivially testable. Systems talk to the UI through a small `EventBus`
(`xp`, `levelup`, `inventory`, `hp`, `chat`, …), keeping rendering and game
logic decoupled.

---

## Tests

The combat math, XP curve, pathfinding, inventory/bank logic, and a full
headless boot-and-play integration (walk to a tree → chop logs, fight, save &
load) are covered by Node's built-in test runner:

```bash
npm test
```

---

## Why original code?

People often ask "why not just clone `runelite/runelite` or `runejs/server`?"
Those are each **one half** of RuneScape bolted onto Jagex's servers/content:

- **RuneLite** is a *client* — it renders the official game and needs Jagex's
  live servers + game cache; on its own it plays nothing.
- **RuneJS** is a *server emulator* — it still needs a compatible client **and**
  Jagex's proprietary game cache (all the art/maps/items) to show anything.

Both depend on Jagex's copyrighted cache, so neither yields a runnable game you
can own. SingaporeScape instead reimplements the *mechanics* with original code
and art, so it actually runs standalone and is yours to modify.

---

## License

MIT (see `package.json`). Original work; not affiliated with or endorsed by
Jagex Ltd. "RuneScape" is a trademark of Jagex Ltd, used here only to describe
the genre this game is inspired by.
