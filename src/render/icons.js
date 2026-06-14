/* ============================================================================
   SingaporeScape — hand-drawn vector icon library (replaces all emoji).
   Style matches the world sprites in src/render/sprites.js:
   solid fills, soft dark outline, a single highlight. 24x24 viewBox.
   Each entry returns the INNER markup of an <svg viewBox="0 0 24 24">.
   Exported as an ES module for the live game (ground items raster to <img>).
   ============================================================================ */
  const OL = '#1c130b';                 // shared outline (matches world OUTLINE)
  // palettes
  const C = {
    bronze: '#c07b3a', bronzeHi: '#e0a05c', bronzeDk: '#8a5424',
    iron: '#b9c2cc', ironHi: '#e2e8ee', ironDk: '#7f8a95',
    steel: '#aeb7c2', steelHi: '#d8dee6',
    wood: '#7a5530', woodHi: '#9a734a', woodDk: '#553a20',
    gold: '#e6b34a', goldHi: '#ffd773', goldDk: '#b07f24',
    jade: '#2f9e6e', jadeHi: '#5fd0a0', jadeDk: '#1c6e4d',
    leaf: '#3c8a3f', leafDk: '#2a6e30', leafHi: '#5fb05a',
    fish: '#7fb6dd', fishDk: '#4f86b0', fishHi: '#bfe2f5',
    flame: '#ef7a23', flameHi: '#ffd24a', flameMid: '#f5a623',
    stone: '#8b8f98', stoneDk: '#5f636b', stoneHi: '#b6bac2',
    coral: '#d8566f', cream: '#f0e7d4', meat: '#c9603a',
  };

  // helper builders -----------------------------------------------------------
  const I = {};   // id -> svg inner string

  // ---- Currency / misc ----
  I.coins = `
    <ellipse cx="9" cy="15" rx="6.5" ry="5" fill="${C.goldDk}"/>
    <ellipse cx="9" cy="13.6" rx="6.5" ry="5" fill="${C.gold}" stroke="${OL}" stroke-width="1"/>
    <ellipse cx="9" cy="13.6" rx="3.4" ry="2.4" fill="${C.goldHi}" opacity=".6"/>
    <ellipse cx="15" cy="10" rx="6" ry="4.6" fill="${C.goldDk}"/>
    <ellipse cx="15" cy="8.7" rx="6" ry="4.6" fill="${C.gold}" stroke="${OL}" stroke-width="1"/>
    <ellipse cx="13.6" cy="7.6" rx="2.4" ry="1.5" fill="${C.goldHi}"/>`;

  // ---- Tools ----
  I.axe = `
    <rect x="11" y="6" width="2.4" height="15" rx="1.1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(14 12 13)"/>
    <path d="M9 4 C15 3 19 6 19 10 C16 9 12 9 9 11 Z" fill="${C.bronze}" stroke="${OL}" stroke-width="1.1"/>
    <path d="M10 5.4 C13.5 5 16 6.4 17 8.6" fill="none" stroke="${C.bronzeHi}" stroke-width="1.2" stroke-linecap="round"/>`;
  I.bronze_axe = I.axe;
  I.pickaxe = `
    <rect x="11" y="6" width="2.3" height="15" rx="1.1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/>
    <path d="M3 7 C9 4 15 4 21 7 C15 6 9 6 3 7 Z" fill="${C.bronze}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M4 6.6 C9 4.6 15 4.6 20 6.6" fill="none" stroke="${C.bronzeHi}" stroke-width="1" stroke-linecap="round"/>`;
  I.bronze_pickaxe = I.pickaxe;
  I.hammer = `
    <rect x="10.6" y="9" width="2.6" height="13" rx="1.2" fill="${C.wood}" stroke="${OL}" stroke-width="1"/>
    <rect x="5" y="4" width="13" height="6.4" rx="1.8" fill="${C.iron}" stroke="${OL}" stroke-width="1.1"/>
    <rect x="6" y="5" width="11" height="1.8" rx="1" fill="${C.ironHi}"/>`;
  I.small_net = `
    <circle cx="12" cy="12" r="8.4" fill="none" stroke="${C.wood}" stroke-width="2"/>
    <path d="M6 8 L18 16 M18 8 L6 16 M12 4 L12 20 M4 12 L20 12" stroke="${C.cream}" stroke-width="1" opacity=".85"/>
    <circle cx="12" cy="12" r="8.4" fill="none" stroke="${OL}" stroke-width="1" opacity=".5"/>`;
  I.tinderbox = `
    <rect x="3.5" y="9" width="17" height="10" rx="2" fill="${C.wood}" stroke="${OL}" stroke-width="1.1"/>
    <rect x="3.5" y="9" width="17" height="3.4" rx="2" fill="${C.woodHi}"/>
    <path d="M14 4 C16 6 17 7.5 16 9 C18.5 8.5 17.5 5 14 4Z" fill="${C.flame}"/>
    <path d="M14.6 5.6 C15.6 6.8 16 7.6 15.4 8.6" fill="${C.flameHi}"/>`;

  // ---- Logs ----
  const logIcon = (a, b) => `
    <ellipse cx="7" cy="9" rx="3.2" ry="3.2" fill="${a}" stroke="${OL}" stroke-width="1"/>
    <ellipse cx="7" cy="9" rx="1.5" ry="1.5" fill="${b}"/>
    <ellipse cx="13" cy="8" rx="3.2" ry="3.2" fill="${a}" stroke="${OL}" stroke-width="1"/>
    <ellipse cx="13" cy="8" rx="1.5" ry="1.5" fill="${b}"/>
    <rect x="3.6" y="12" width="17" height="6.4" rx="2.4" fill="${a}" stroke="${OL}" stroke-width="1"/>
    <rect x="4.6" y="13" width="15" height="1.6" rx="1" fill="${b}" opacity=".7"/>`;
  I.logs = logIcon(C.wood, C.woodHi);
  I.oak_logs = logIcon('#8a5e33', '#a87a45');
  I.willow_logs = logIcon('#6e6a3a', '#928c4f');

  // ---- Ore & bars ----
  const oreIcon = (fleck) => `
    <path d="M4 16 L6 8 L11 5 L17 7 L20 13 L16 19 L8 19 Z" fill="${C.stone}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M6 8 L11 5 L13 9 L8 10 Z" fill="${C.stoneHi}" opacity=".7"/>
    <circle cx="9" cy="13" r="1.5" fill="${fleck}"/><circle cx="14" cy="11" r="1.4" fill="${fleck}"/>
    <circle cx="13" cy="16" r="1.3" fill="${fleck}"/>`;
  I.copper_ore = oreIcon('#c8743a');
  I.tin_ore = oreIcon('#d8dde2');
  I.iron_ore = oreIcon('#9a6a5a');
  I.coal = `
    <path d="M4 16 L6 8 L11 5 L17 7 L20 13 L16 19 L8 19 Z" fill="#33373c" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M7 9 L11 6 L13 10 L9 11 Z" fill="#4a4f55"/>
    <circle cx="14" cy="13" r="1.3" fill="#5a6066"/>`;
  const barIcon = (a, b) => `
    <path d="M4 16 L8 11 L20 11 L16 16 Z" fill="${a}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M8 11 L20 11 L18.5 12.8 L7 12.8 Z" fill="${b}"/>
    <path d="M6.5 14.4 L17 14.4" stroke="${OL}" stroke-width=".8" opacity=".4"/>`;
  I.bronze_bar = barIcon(C.bronze, C.bronzeHi);
  I.iron_bar = barIcon(C.iron, C.ironHi);

  // ---- Fish (raw & cooked) ----
  const rawFish = (col, hi) => `
    <path d="M3 12 C7 6 15 6 19 10 C20 8 21 8 21.5 8.5 C21 10 21 11 21.5 12 C21 13 20 13 19 12 C15 16 7 16 3 12 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <circle cx="7" cy="11" r="1" fill="${OL}"/>
    <path d="M9 9.5 C12 9 15 9.5 17 11" stroke="${hi}" stroke-width="1" fill="none" opacity=".8"/>`;
  I.raw_anchovy = rawFish(C.fish, C.fishHi);
  I.raw_sardine = rawFish('#9aa6b0', '#cdd6dd');
  I.raw_trout = rawFish('#8fb0c8', '#c4ddec');
  const cookedFish = (col) => `
    <path d="M3 13 C7 8 15 8 18 11 C19 9.5 20.5 9.5 21 10 C20.6 11.4 20.6 12.4 21 13.6 C20.4 14 19 14 18 13 C15 16 7 16 3 13 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M6 11 L8 13 M10 10.4 L12 12.4 M14 10.6 L16 12.6" stroke="${C.bronzeDk}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>
    <circle cx="7" cy="11.6" r=".9" fill="${OL}"/>`;
  I.anchovy = cookedFish('#e0a35a');
  I.sardine = cookedFish('#d59048');
  I.trout = cookedFish('#e8b366');
  I.cooked_chicken = `
    <path d="M8 4 C13 3 17 6 16 11 L13 10 L12 13 L9 12 C6 10 5 6 8 4 Z" fill="${C.meat}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="11" y="11" width="2.2" height="8" rx="1.1" fill="${C.cream}" stroke="${OL}" stroke-width="1" transform="rotate(20 12 15)"/>
    <path d="M9 6 C11 5 13 5.5 14 7" stroke="#e08a5a" stroke-width="1.1" fill="none"/>`;
  I.raw_chicken = `
    <path d="M8 4 C13 3 17 6 16 11 L13 10 L12 13 L9 12 C6 10 5 6 8 4 Z" fill="#e7a9a0" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="11" y="11" width="2.2" height="8" rx="1.1" fill="${C.cream}" stroke="${OL}" stroke-width="1" transform="rotate(20 12 15)"/>`;
  I.burnt_fish = `
    <path d="M3 13 C7 8 15 8 18 11 C19 9.5 20.5 9.5 21 10 C20.6 11.4 20.6 12.4 21 13.6 C20.4 14 19 14 18 13 C15 16 7 16 3 13 Z" fill="#2e2a26" stroke="${OL}" stroke-width="1.1"/>
    <circle cx="7" cy="11.6" r=".9" fill="#5a544c"/>`;

  // ---- Hawker food ----
  I.kaya_toast = `
    <path d="M4 13 C4 7 20 7 20 13 L20 17 C20 19 4 19 4 17 Z" fill="#e6c98a" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="6.5" y="12.5" width="11" height="3" rx="1" fill="#7a4a24"/>
    <path d="M6 10 C10 8 14 8 18 10" stroke="#caa460" stroke-width="1" fill="none"/>`;
  I.chicken_rice = `
    <path d="M3.5 12 C3.5 17 20.5 17 20.5 12 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <ellipse cx="12" cy="12" rx="8.5" ry="2.4" fill="#fff7e8" stroke="${OL}" stroke-width="1"/>
    <ellipse cx="10" cy="11.4" rx="2.4" ry="1.3" fill="${C.meat}"/>
    <circle cx="14" cy="11.6" r="1" fill="#3c8a3f"/>`;
  I.roti_prata = `
    <ellipse cx="12" cy="13" rx="9" ry="6" fill="#e3bd80" stroke="${OL}" stroke-width="1.1"/>
    <ellipse cx="12" cy="13" rx="9" ry="6" fill="none" stroke="#b8893f" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>
    <ellipse cx="10" cy="11" rx="2" ry="1.2" fill="#f0d9a8"/>`;

  // ---- Weapons ----
  const blade = (col, hi) => `
    <rect x="10.8" y="13" width="2.4" height="6" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/>
    <rect x="8" y="12.4" width="8" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/>
    <path d="M12 3 L14 12 L10 12 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 4 L12.8 11.4 L12 11.4 Z" fill="${hi}"/>`;
  I.bronze_dagger = blade(C.bronze, C.bronzeHi);
  I.bronze_sword = blade(C.bronze, C.bronzeHi);
  const scim = (col, hi) => `
    <rect x="9.5" y="14" width="2.4" height="5" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(8 10 16)"/>
    <rect x="7.5" y="13" width="7" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/>
    <path d="M10 13 C10 7 14 3 19 3 C16 6 17 11 13.5 13 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M11.5 12 C11.5 8 14 5 17.5 4.4" stroke="${hi}" stroke-width="1.1" fill="none"/>`;
  I.bronze_scimitar = scim(C.bronze, C.bronzeHi);
  I.iron_scimitar = scim(C.iron, C.ironHi);
  I.steel_scimitar = scim(C.steel, C.steelHi);

  // ---- Armour ----
  const shield = (col, hi) => `
    <path d="M12 3 L19 6 C19 14 15 19 12 21 C9 19 5 14 5 6 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 5 L17 7 C17 13 14.5 17 12 18.6 Z" fill="${hi}" opacity=".45"/>
    <path d="M12 3 L12 21 M5.5 9 L18.5 9" stroke="${OL}" stroke-width=".8" opacity=".35"/>`;
  I.wooden_shield = `
    <path d="M12 3 L19 6 C19 14 15 19 12 21 C9 19 5 14 5 6 Z" fill="${C.wood}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 3 L12 21 M7 7 L17 7 M6 12 L18 12" stroke="${C.woodDk}" stroke-width="1" opacity=".6"/>`;
  I.bronze_kiteshield = shield(C.bronze, C.bronzeHi);
  const helm = (col, hi) => `
    <path d="M5 12 C5 6 8 4 12 4 C16 4 19 6 19 12 L19 14 L15 14 L15 11 C15 9 13.5 8 12 8 C10.5 8 9 9 9 11 L9 14 L5 14 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M11 9 L13 9 L13 17 L11 17 Z" fill="${col}" stroke="${OL}" stroke-width="1"/>
    <path d="M6.5 11 C6.5 7.5 9 6 12 6" stroke="${hi}" stroke-width="1.1" fill="none"/>`;
  I.bronze_helm = helm(C.bronze, C.bronzeHi);
  I.iron_full_helm = helm(C.iron, C.ironHi);
  const plate = (col, hi) => `
    <path d="M8 5 L16 5 L20 8 L18 11 L17 11 L17 19 L7 19 L7 11 L6 11 L4 8 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 5 C12 8 10 9 8 9 M12 5 C12 8 14 9 16 9" stroke="${OL}" stroke-width="1" fill="none" opacity=".5"/>
    <rect x="8.5" y="12" width="7" height="1.8" rx="1" fill="${hi}" opacity=".5"/>`;
  I.bronze_platebody = plate(C.bronze, C.bronzeHi);
  I.iron_platebody = plate(C.iron, C.ironHi);
  I.leather_body = plate('#8a5a34', '#a8743f');
  I.bronze_platelegs = `
    <path d="M7 4 L17 4 L17 8 L13 20 L11 20 L12 10 L11 20 L9 20 L7 8 Z" fill="${C.bronze}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="7" y="4" width="10" height="2.4" rx="1" fill="${C.bronzeHi}" opacity=".6"/>`;
  I.amulet_of_power = `
    <path d="M7 5 C7 9 17 9 17 5" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
    <path d="M12 11 L15.5 14 L12 20 L8.5 14 Z" fill="${C.jade}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 12.6 L14 14.4 L12 15.6 Z" fill="${C.jadeHi}"/>`;

  // ---- Misc ----
  I.bones = `
    <path d="M6 16 C4 16 4 13 6 13.6 C5.6 12 8 12 8 14 L15 8 C13 6 15 4 16.4 5.6 C18 4 19 7 17 7.4 C19 8 17 11 16 9 L9 15 C11 17 8 19 7 17 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>`;
  I.feather = `
    <path d="M17 5 C10 6 6 11 5 18 C8 18 9 17 9 17 C9 17 6 18 5 18 L8 15 C7 16 6 16 6 16 C12 13 15 10 17 5 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M16 6 C12 8 9 11 7 16" stroke="${C.stoneDk}" stroke-width=".8" fill="none" opacity=".5"/>`;
  I.egg = `
    <ellipse cx="12" cy="13" rx="6" ry="8" fill="#f4ead6" stroke="${OL}" stroke-width="1.1"/>
    <ellipse cx="10" cy="10" rx="2" ry="3" fill="#fff" opacity=".6"/>`;

  // ============================ SKILL ICONS ============================
  const S = {};
  S.attack = `<rect x="10.8" y="12" width="2.4" height="7" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/>
    <rect x="8" y="11.4" width="8" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/>
    <path d="M12 2 L14 11 L10 11 Z" fill="${C.iron}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 3.5 L12.7 10.4 L12 10.4 Z" fill="${C.ironHi}"/>`;
  S.strength = `<path d="M4 10 L8 10 L8 8 C8 6 12 6 12 9 L16 9 L16 7 C16 5 20 5 20 9 L20 15 C20 19 16 19 16 15 L16 13 L8 13 L8 15 C8 19 4 19 4 15 Z" fill="${C.iron}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="9" y="10.6" width="6" height="1.6" fill="${C.ironHi}"/>`;
  S.defence = shield(C.iron, C.ironHi);
  S.hitpoints = `<path d="M12 20 C5 15 3 10 6 7 C8.5 4.8 11 6 12 8 C13 6 15.5 4.8 18 7 C21 10 19 15 12 20 Z" fill="${C.coral}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M8 7.5 C6.5 8.5 6.5 10.5 8 12.5" stroke="#f0a0b0" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  S.woodcutting = `<path d="M11 9 C13 5 11 3 8 3 C10 5 9 7 7 8 L4 20 L6 21 L9 10 Z" fill="${C.leafDk}" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>
    <path d="M11 6 C16 5 20 8 20 12 C17 11 13 11 11 13 Z" fill="${C.bronze}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="11" y="6" width="2.2" height="14" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(18 12 13)"/>`;
  S.mining = `${oreIcon('#c8743a')}
    <rect x="13" y="3" width="2" height="12" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(35 14 9)"/>`;
  S.fishing = rawFish(C.fish, C.fishHi);
  S.firemaking = `<path d="M12 3 C10 7 6 8 7 13 C7.5 17 10 19 12 19 C14 19 17 17 17 13 C17 10 14 9 14 6 C13 8 11 8 12 3 Z" fill="${C.flame}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 9 C11 11 10 12 11 14.5 C11.4 16.4 12.4 17 13 16 C14 14 12 13 12 9Z" fill="${C.flameHi}"/>`;
  S.cooking = `<ellipse cx="12" cy="11" rx="8" ry="4" fill="${C.stoneDk}" stroke="${OL}" stroke-width="1.1"/>
    <path d="M4 11 C4 17 20 17 20 11 Z" fill="${C.stone}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <rect x="2.5" y="9.5" width="3" height="2" rx="1" fill="${C.stoneDk}"/><rect x="18.5" y="9.5" width="3" height="2" rx="1" fill="${C.stoneDk}"/>
    <path d="M9 6 C8 8 10 8 9 4 M13 6 C12 8 14 8 13 4" stroke="${C.cream}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  S.smithing = `<rect x="6" y="6" width="3" height="9" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(-30 7 10)"/>
    <rect x="3" y="3.5" width="8" height="4" rx="1.2" fill="${C.iron}" stroke="${OL}" stroke-width="1" transform="rotate(-30 7 5)"/>
    <path d="M5 15 L19 15 L18 18 L6 18 Z M9 13 L15 13 L15 15 L9 15 Z" fill="${C.stoneDk}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>`;

  // ============================ TAB ICONS =============================
  const T = {};
  T.inventory = `<path d="M7 7 C7 4 17 4 17 7 L18 8 C19 8 19 9 19 9 L19 19 C19 20 18 20 18 20 L6 20 C5 20 5 19 5 19 L5 9 C5 9 5 8 6 8 Z" fill="${C.wood}" stroke="${OL}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M9 8 C9 5.5 15 5.5 15 8" fill="none" stroke="${OL}" stroke-width="1.2"/>
    <rect x="5" y="12" width="14" height="2.4" fill="${C.woodDk}" opacity=".5"/>
    <rect x="10.6" y="11" width="2.8" height="4" rx="1" fill="${C.gold}" stroke="${OL}" stroke-width="1"/>`;
  T.equipment = helm(C.iron, C.ironHi);
  T.skills = `<rect x="4" y="13" width="3.6" height="7" rx="1" fill="${C.jade}" stroke="${OL}" stroke-width="1"/>
    <rect x="10.2" y="9" width="3.6" height="11" rx="1" fill="${C.gold}" stroke="${OL}" stroke-width="1"/>
    <rect x="16.4" y="5" width="3.6" height="15" rx="1" fill="${C.coral}" stroke="${OL}" stroke-width="1"/>`;
  T.combat = `<g stroke="${OL}" stroke-width="1.1" stroke-linejoin="round">
    <path d="M4 4 L8 5 L18 16 L17 19 L14 18 L4 8 Z" fill="${C.iron}"/>
    <path d="M20 4 L16 5 L6 16 L7 19 L10 18 L20 8 Z" fill="${C.steel}"/></g>
    <circle cx="11.5" cy="11.5" r="1.4" fill="${C.goldDk}"/>`;
  T.settings = `<path d="M12 3 L13.6 3 L14.2 5.6 L16 6.4 L18.2 5 L19.4 6.2 L18 8.4 L18.8 10.2 L21.4 10.8 L21.4 13.2 L18.8 13.8 L18 15.6 L19.4 17.8 L18.2 19 L16 17.6 L14.2 18.4 L13.6 21 L11.4 21 L10.8 18.4 L9 17.6 L6.8 19 L5.6 17.8 L7 15.6 L6.2 13.8 L3.6 13.2 L3.6 10.8 L6.2 10.2 L7 8.4 L5.6 6.2 L6.8 5 L9 6.4 L10.8 5.6 Z" fill="${C.stone}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <circle cx="12" cy="12" r="3.2" fill="${C.stoneDk}" stroke="${OL}" stroke-width="1"/>`;

  function svg(inner, size, cls) {
    return `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block">${inner}</svg>`;
  }

  function svgString(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">' + inner + '</svg>';
  }

  // SVG markup helpers (DOM use: inventory, equipment, skills, shops, tabs).
  export const itemIconSVG = (id, size = 28, cls) => svg(I[id] || I.coins, size, cls);
  export const skillIconSVG = (id, size = 20, cls) => svg(S[id] || S.attack, size, cls);
  export const tabIconSVG = (id, size = 24, cls) => svg(T[id] || T.inventory, size, cls);
  export const hasIcon = (id) => !!I[id];

  // Rasterised <img> cache for drawing item icons onto the world canvas
  // (ground item drops). Returns an HTMLImageElement that may still be loading.
  const _imgCache = {};
  export function itemIconImage(id) {
    if (_imgCache[id] !== undefined) return _imgCache[id];
    const inner = I[id];
    if (!inner || typeof Image === 'undefined') { _imgCache[id] = null; return null; }
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString(inner));
    _imgCache[id] = img;
    return img;
  }
