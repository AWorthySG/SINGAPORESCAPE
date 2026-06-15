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
    <rect x="4.6" y="13" width="15" height="1.6" rx="1" fill="${b}" opacity=".7"/>
    <path d="M6 16.4 L18 16.4" stroke="${OL}" stroke-width="0.6" opacity=".3"/>
    <ellipse cx="20.2" cy="15.2" rx="1.2" ry="3" fill="${a}" stroke="${OL}" stroke-width="0.8"/>`;
  I.logs = logIcon(C.wood, C.woodHi);
  I.oak_logs = logIcon('#8a5e33', '#a87a45');
  I.willow_logs = logIcon('#6e6a3a', '#928c4f');

  // ---- Ore & bars ----
  const oreIcon = (fleck) => `
    <path d="M4 16 L6 8 L11 5 L17 7 L20 13 L16 19 L8 19 Z" fill="${C.stone}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M6 8 L11 5 L13 9 L8 10 Z" fill="${C.stoneHi}" opacity=".8"/>
    <path d="M8 19 L16 19 L18 16 L10 16 Z" fill="${C.stoneDk}" opacity=".45"/>
    <circle cx="9" cy="13" r="1.6" fill="${fleck}"/><circle cx="14" cy="11" r="1.5" fill="${fleck}"/>
    <circle cx="13" cy="16" r="1.3" fill="${fleck}"/>
    <circle cx="8.5" cy="12.5" r="0.5" fill="#fff" opacity=".85"/><circle cx="13.5" cy="10.5" r="0.45" fill="#fff" opacity=".8"/>`;
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
    <path d="M5 12.4 C9 14.6 15 14.6 18 12.6 C15 13.6 9 13.6 5 12.4 Z" fill="${hi}" opacity=".55"/>
    <path d="M8 8.6 L10 11 L12 8.4 L14 11 L16 9" stroke="${hi}" stroke-width="0.7" fill="none" opacity=".6"/>
    <path d="M9.5 9 C9 11 9 13 9.5 14.6" stroke="${OL}" stroke-width="0.7" fill="none" opacity=".4"/>
    <circle cx="7" cy="11" r="1.1" fill="#f8f6ee"/><circle cx="7.1" cy="11.1" r="0.55" fill="${OL}"/>
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
    <circle cx="12" cy="19.4" r="1.4" fill="${C.gold}" stroke="${OL}" stroke-width="0.7"/>
    <rect x="8" y="12.4" width="8" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/>
    <rect x="8.4" y="12.5" width="7.2" height="0.7" fill="${C.goldHi}" opacity=".85"/>
    <path d="M12 3 L14 12 L10 12 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M12 4 L12.8 11.4 L12 11.4 Z" fill="${hi}"/>
    <path d="M12 4 L12 11.4" stroke="rgba(255,255,255,0.85)" stroke-width="0.6"/>`;
  I.bronze_dagger = blade(C.bronze, C.bronzeHi);
  I.bronze_sword = blade(C.bronze, C.bronzeHi);
  const scim = (col, hi) => `
    <rect x="9.5" y="14" width="2.4" height="5" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1" transform="rotate(8 10 16)"/>
    <circle cx="10.6" cy="18.8" r="1.3" fill="${C.gold}" stroke="${OL}" stroke-width="0.7"/>
    <rect x="7.5" y="13" width="7" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/>
    <path d="M10 13 C10 7 14 3 19 3 C16 6 17 11 13.5 13 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M11.5 12 C11.5 8 14 5 17.5 4.4" stroke="${hi}" stroke-width="1.3" fill="none"/>
    <path d="M12.6 11 C12.6 8 14.6 5.6 17 5" stroke="rgba(255,255,255,0.7)" stroke-width="0.6" fill="none"/>`;
  I.bronze_scimitar = scim(C.bronze, C.bronzeHi);
  I.iron_scimitar = scim(C.iron, C.ironHi);
  I.steel_scimitar = scim(C.steel, C.steelHi);

  // ---- Armour ----
  const shield = (col, hi) => `
    <path d="M12 3 L19 6 C19 14 15 19 12 21 C9 19 5 14 5 6 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 5 L17 7 C17 13 14.5 17 12 18.6 Z" fill="${hi}" opacity=".45"/>
    <path d="M12 3 L19 6 C18 8 14 9 12 9 C10 9 6 8 5 6 Z" fill="${hi}" opacity=".35"/>
    <path d="M12 3 L12 21 M5.5 9 L18.5 9" stroke="${OL}" stroke-width=".8" opacity=".35"/>
    <circle cx="12" cy="11" r="2.1" fill="${C.goldDk}" stroke="${OL}" stroke-width="0.8"/>
    <circle cx="11.4" cy="10.4" r="0.7" fill="${C.goldHi}"/>`;
  I.wooden_shield = `
    <path d="M12 3 L19 6 C19 14 15 19 12 21 C9 19 5 14 5 6 Z" fill="${C.wood}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 3 L12 21 M7 7 L17 7 M6 12 L18 12" stroke="${C.woodDk}" stroke-width="1" opacity=".6"/>`;
  I.bronze_kiteshield = shield(C.bronze, C.bronzeHi);
  const helm = (col, hi) => `
    <path d="M5 12 C5 6 8 4 12 4 C16 4 19 6 19 12 L19 14 L15 14 L15 11 C15 9 13.5 8 12 8 C10.5 8 9 9 9 11 L9 14 L5 14 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M11 9 L13 9 L13 17 L11 17 Z" fill="${col}" stroke="${OL}" stroke-width="1"/>
    <path d="M6.5 11 C6.5 7.5 9 6 12 6" stroke="${hi}" stroke-width="1.3" fill="none"/>
    <path d="M12 2.4 L13 4.6 L11 4.6 Z" fill="${C.gold}" stroke="${OL}" stroke-width="0.6"/>
    <circle cx="6.6" cy="13" r="0.7" fill="${hi}"/><circle cx="17.4" cy="13" r="0.7" fill="${hi}"/>`;
  I.bronze_helm = helm(C.bronze, C.bronzeHi);
  I.iron_full_helm = helm(C.iron, C.ironHi);
  const plate = (col, hi) => `
    <path d="M8 5 L16 5 L20 8 L18 11 L17 11 L17 19 L7 19 L7 11 L6 11 L4 8 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 5 C12 8 10 9 8 9 M12 5 C12 8 14 9 16 9" stroke="${OL}" stroke-width="1" fill="none" opacity=".5"/>
    <path d="M8 5 L16 5 L18 7 C15 8.4 9 8.4 6 7 Z" fill="${hi}" opacity=".4"/>
    <circle cx="5.2" cy="8" r="0.8" fill="${hi}"/><circle cx="18.8" cy="8" r="0.8" fill="${hi}"/>
    <path d="M12 11 L13.6 13 L12 15 L10.4 13 Z" fill="${hi}" opacity=".6"/>
    <rect x="8.5" y="16.5" width="7" height="1.6" rx="0.8" fill="${hi}" opacity=".4"/>`;
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
  S.prayer = `<circle cx="12" cy="12" r="5.5" fill="${C.gold}" stroke="${OL}" stroke-width="1.1"/>
    <path d="M12 2.5 L12 5 M12 19 L12 21.5 M2.5 12 L5 12 M19 12 L21.5 12 M5 5 L6.6 6.6 M17.4 17.4 L19 19 M5 19 L6.6 17.4 M17.4 6.6 L19 5" stroke="${C.goldHi}" stroke-width="1.5" stroke-linecap="round"/>`;
  S.thieving = `<path d="M7 9 C7 5 17 5 17 9 L19 18 C19 20 5 20 5 18 Z" fill="${C.wood}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M8 9 C8 6 16 6 16 9" fill="none" stroke="${OL}" stroke-width="1.1"/><circle cx="12" cy="14" r="3" fill="${C.gold}" stroke="${OL}" stroke-width=".8"/>`;
  S.agility = `<path d="M8 4 L12 4 L12 13 L18 13 C19 13 19 18 18 18 L8 18 Z" fill="${C.jade}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M2 8 L6 8 M2 12 L5 12 M2 16 L4 16" stroke="${C.jadeHi}" stroke-width="1.4" stroke-linecap="round"/>`;

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

  // ---- Expanded content (higher tiers, food, boss uniques) ----
  const mith = '#5b6bd6', mithHi = '#8a96e8';
  const adam = '#3fa06a', adamHi = '#6fd49a';
  const rune = '#46b3c4', runeHi = '#7fe0ee';
  I.maple_logs = logIcon('#6e8a3a', '#92b05a');
  I.mithril_ore = oreIcon(mith);
  I.adamantite_ore = oreIcon(adam);
  I.runite_ore = oreIcon(rune);
  I.steel_bar = barIcon(C.steel, C.steelHi);
  I.mithril_bar = barIcon(mith, mithHi);
  I.adamant_bar = barIcon(adam, adamHi);
  I.rune_bar = barIcon(rune, runeHi);
  I.raw_lobster = rawFish('#d8693a', '#f0a07a');
  I.lobster = cookedFish('#e05a2a');
  I.raw_swordfish = rawFish('#6a8ab0', '#a8c6e0');
  I.swordfish = cookedFish('#8a9ab0');
  I.yew_logs = logIcon('#3f5a2a', '#5a7a3a');
  I.magic_logs = logIcon('#4a6ad0', '#7a96e8');
  I.gold_ore = oreIcon('#e8c84a');
  I.raw_salmon = rawFish('#e0896a', '#f0b89a'); I.salmon = cookedFish('#e8956a');
  I.raw_tuna = rawFish('#5a7a8a', '#8aa6b6'); I.tuna = cookedFish('#9aa6b0');
  I.raw_shark = rawFish('#6a7a8a', '#9aaab6'); I.shark = cookedFish('#8a9aa6');
  I.laksa = `<path d="M3.5 11 C3.5 17 20.5 17 20.5 11 Z" fill="#d8552e" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <ellipse cx="12" cy="11" rx="8.5" ry="2.6" fill="#e8804a" stroke="${OL}" stroke-width="1"/>
    <path d="M7 10 C10 9 14 9 17 10" stroke="#f4d9a0" stroke-width="1.4" fill="none"/><circle cx="14" cy="10.4" r="1" fill="#a01f1f"/>`;
  I.satay = `<rect x="3" y="14" width="17" height="1.6" rx="1" fill="${C.wood}" transform="rotate(-18 12 14)"/>
    <g fill="${C.meat}" stroke="${OL}" stroke-width="1"><rect x="8" y="5.5" width="4.2" height="3.4" rx="1.4"/><rect x="9.6" y="9" width="4.2" height="3.4" rx="1.4"/><rect x="11.2" y="12.5" width="4.2" height="3.4" rx="1.4"/></g>`;
  I.nasi_lemak = `<path d="M3 13 C3 17 21 17 21 13 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M8 6 C6 11 18 11 16 6 C15 9 9 9 8 6Z" fill="#f7f4ea" stroke="${OL}" stroke-width="1"/>
    <circle cx="8" cy="12" r="1.3" fill="#c0392b"/><circle cx="16.5" cy="12" r="1.3" fill="${C.leaf}"/><rect x="10.6" y="10.6" width="3" height="2.4" rx="1" fill="${C.meat}"/>`;
  I.mithril_scimitar = scim(mith, mithHi);
  I.adamant_scimitar = scim(adam, adamHi);
  I.rune_scimitar = scim(rune, runeHi);
  I.steel_full_helm = helm(C.steel, C.steelHi);
  I.steel_platebody = plate(C.steel, C.steelHi);
  I.steel_kiteshield = shield(C.steel, C.steelHi);
  I.mithril_full_helm = helm(mith, mithHi);
  I.mithril_platebody = plate(mith, mithHi);
  I.rune_full_helm = helm(rune, runeHi);
  I.rune_platebody = plate(rune, runeHi);
  I.rune_kiteshield = shield(rune, runeHi);
  I.merlion_blade = scim('#e6f3f7', '#ffffff');
  I.merlion_amulet = `<path d="M7 5 C7 9 17 9 17 5" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
    <circle cx="12" cy="15" r="5" fill="${rune}" stroke="${OL}" stroke-width="1.1"/><circle cx="10.4" cy="13.4" r="1.6" fill="${runeHi}"/>`;
  I.warlord_cape = `<path d="M8 4 L16 4 L19 20 L12 17 L5 20 Z" fill="#6a1f1f" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M8 4 C10 7 14 7 16 4" fill="none" stroke="${C.goldDk}" stroke-width="1.4"/><path d="M12 6 L12 16" stroke="#8a2a2a" stroke-width="1"/>`;
  I.boar_tusk = `<path d="M7 5 C7 9 17 9 17 5" fill="none" stroke="${C.gold}" stroke-width="1.6"/>
    <path d="M12 10 C9 12 9 18 12 20 C12 16 13 13 14 11 C13.5 10 12.5 10 12 10 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/>`;

  // ---- builders for generated equipment tiers ----
  const legs = (col, hi) => `<path d="M7 4 L17 4 L17 8 L13 20 L11 20 L12 10 L11 20 L9 20 L7 8 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><rect x="7" y="4" width="10" height="2.4" rx="1" fill="${hi}" opacity=".7"/><rect x="6.6" y="6.4" width="10.8" height="1.6" rx="0.8" fill="${C.goldDk}" stroke="${OL}" stroke-width="0.5"/><circle cx="9.4" cy="12" r="0.9" fill="${hi}"/><circle cx="14.6" cy="12" r="0.9" fill="${hi}"/>`;
  const mace = (col, hi) => `<rect x="10.8" y="9" width="2.4" height="12" rx="1.1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><circle cx="12" cy="19.6" r="1.4" fill="${C.gold}" stroke="${OL}" stroke-width="0.7"/><circle cx="12" cy="6" r="4.6" fill="${col}" stroke="${OL}" stroke-width="1.1"/><g fill="${col}" stroke="${OL}" stroke-width=".8"><rect x="11" y="0.4" width="2" height="3"/><rect x="11" y="8.6" width="2" height="3"/><rect x="6.4" y="5" width="3" height="2"/><rect x="14.6" y="5" width="3" height="2"/></g><circle cx="10.4" cy="4.4" r="1.4" fill="${hi}"/>`;
  const longsword = (col, hi) => `<rect x="10.8" y="14" width="2.4" height="6" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><circle cx="12" cy="20.4" r="1.4" fill="${C.gold}" stroke="${OL}" stroke-width="0.7"/><rect x="7.5" y="13" width="9" height="2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/><path d="M12 2 L14 13 L10 13 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 3 L12.7 12 L12 12 Z" fill="${hi}"/><path d="M12 3.4 L12 12" stroke="rgba(255,255,255,0.8)" stroke-width="0.6"/>`;
  const battleaxe = (col, hi) => `<rect x="11" y="4" width="2.4" height="17" rx="1.1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><path d="M11 5 C5 5 4 9 5 13 C8 11 11 11 11 11 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M13.4 5 C19 5 20 9 19 13 C16 11 13.4 11 13.4 11 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M6 7 C8 6 10 6 11 7 M18 7 C16 6 14 6 13.4 7" stroke="${hi}" stroke-width="1" fill="none"/><circle cx="12.2" cy="11.5" r="1.1" fill="${C.gold}" stroke="${OL}" stroke-width="0.6"/>`;
  const warhammer = (col, hi) => `<rect x="10.8" y="7" width="2.4" height="14" rx="1.1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><rect x="6" y="3" width="12" height="6.5" rx="1.6" fill="${col}" stroke="${OL}" stroke-width="1.1"/><rect x="7" y="4" width="10" height="1.8" rx="1" fill="${hi}"/><circle cx="7.6" cy="7.4" r="0.7" fill="${hi}"/><circle cx="16.4" cy="7.4" r="0.7" fill="${hi}"/>`;
  const twohander = (col, hi) => `<rect x="10.6" y="15" width="2.8" height="6" rx="1.2" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><circle cx="12" cy="21" r="1.5" fill="${C.gold}" stroke="${OL}" stroke-width="0.7"/><rect x="6" y="13.6" width="12" height="2.2" rx="1" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/><path d="M12 1 L15 13 L9 13 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 2.5 L13 12 L12 12 Z" fill="${hi}"/><path d="M12 2.6 L12 12" stroke="rgba(255,255,255,0.8)" stroke-width="0.7"/>`;
  const gloves = (col, hi) => `<path d="M7 8 L7 4 L9 4 L9 7 L10 7 L10 3 L12 3 L12 7 L13 7 L13 4 L15 4 L15 9 C15 13 13 15 11 15 C9 15 7 13 7 10 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><g fill="${hi}"><circle cx="8.5" cy="6" r="0.7"/><circle cx="11" cy="5.5" r="0.7"/><circle cx="13.5" cy="6" r="0.7"/></g><rect x="7" y="14" width="8" height="4" rx="1.4" fill="${hi}" stroke="${OL}" stroke-width="1"/>`;
  const boots = (col, hi) => `<path d="M8 4 L12 4 L12 13 L18 13 C19 13 19 18 18 18 L8 18 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><rect x="8" y="16" width="11" height="2.6" rx="1" fill="${hi}" opacity=".6"/><rect x="8.4" y="5" width="3.2" height="1.4" rx="0.6" fill="${C.goldDk}" stroke="${OL}" stroke-width="0.5"/>`;
  const ringIcon = (col, hi) => `<circle cx="12" cy="14" r="6" fill="none" stroke="${col}" stroke-width="2.6"/><path d="M12 8 L15 4 L9 4 Z" fill="${hi}" stroke="${OL}" stroke-width="1"/>`;
  const capeIcon = (col, hi) => `<path d="M8 4 L16 4 L19 20 L12 17 L5 20 Z" fill="${col}" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><path d="M8 4 C10 7 14 7 16 4" fill="none" stroke="${hi}" stroke-width="1.4"/>`;

  const dragon = '#c0392b', dragonHi = '#e8543f';
  const METAL_PAL = { bronze: [C.bronze, C.bronzeHi], iron: [C.iron, C.ironHi], steel: [C.steel, C.steelHi], mithril: [mith, mithHi], adamant: [adam, adamHi], rune: [rune, runeHi], dragon: [dragon, dragonHi] };
  const WBUILD = { dagger: blade, sword: blade, scimitar: scim, mace, longsword, battleaxe, warhammer, '2h_sword': twohander };
  const ABUILD = { med_helm: helm, full_helm: helm, chainbody: plate, platebody: plate, platelegs: legs, sq_shield: shield, kiteshield: shield, gauntlets: gloves, boots };
  for (const m of Object.keys(METAL_PAL)) {
    const [c, hi] = METAL_PAL[m];
    for (const t of Object.keys(WBUILD)) { const id = `${m}_${t}`; if (!I[id]) I[id] = WBUILD[t](c, hi); }
    for (const t of Object.keys(ABUILD)) { const id = `${m}_${t}`; if (!I[id]) I[id] = ABUILD[t](c, hi); }
  }
  // accessories & new boss uniques
  I.amulet_of_strength = I.amulet_of_power;
  I.amulet_of_glory = I.amulet_of_power;
  I.ring_of_kampong = ringIcon(C.gold, C.goldHi);
  I.ring_of_might = ringIcon('#c0432a', '#e08a5a');
  I.fire_cape = capeIcon('#d8552e', '#f5a623');
  I.garuda_wings = capeIcon('#caa15a', '#f0d99a');
  I.tiger_fang = scim('#e8a23a', '#ffd773');
  I.leviathan_trident = `<rect x="11" y="10" width="2" height="11" rx="1" fill="${C.wood}" stroke="${OL}" stroke-width="1"/><path d="M6 3 L6 9 M12 2 L12 9 M18 3 L18 9" stroke="${rune}" stroke-width="2.2" stroke-linecap="round"/><path d="M5 9 L19 9 L18 11 L6 11 Z" fill="${rune}" stroke="${OL}" stroke-width="1"/>`;
  I.hydra_leather = plate('#3f7a4a', '#5fa06a');
  I.treant_shield = shield('#5a7a3a', '#7aa04a');
  I.megalodon_jaw = `<path d="M4 14 Q12 2 20 14 Q12 10 4 14 Z" fill="#dfe7ec" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M6 13 L7.5 17 L9 13 L10.5 17 L12 13 L13.5 17 L15 13 L16.5 17 L18 13" fill="#fff" stroke="${OL}" stroke-width="0.9" stroke-linejoin="round"/>`;
  I.phantom_robe = plate('#4a5a7a', '#7a8ab0');
  I.djinn_lamp = `<path d="M4 16 Q4 12 11 12 L20 12 Q21 12 20.5 13.5 L18 16 Z" fill="${C.gold}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><ellipse cx="11" cy="12" rx="6" ry="2.6" fill="${C.goldHi}" stroke="${OL}" stroke-width="1"/><path d="M16 11 Q19 7 16 4" fill="none" stroke="#8a96e8" stroke-width="2" stroke-linecap="round" opacity=".8"/><circle cx="15.5" cy="3.5" r="1.4" fill="#bcd0ff"/>`;
  I.revenant_cape = capeIcon('#5a4a6a', '#8a7aa0');
  I.trades_cape = capeIcon('#2f9e6e', '#5fd0a0');     // jade — Master of Trades
  I.champions_cape = capeIcon('#e6b34a', '#ffd773');  // gold — Champion of Singapore
  // quest & special rewards
  I.tiger_kris = scim('#d8a23a', '#ffd773');
  I.cursed_cutlass = scim('#3a5a4a', '#6a9a7a');
  I.kampong_gauntlets = gloves('#2f7a6a', '#4fb0a0');
  I.champions_helm = helm('#caa15a', C.goldHi);
  I.island_aegis = shield('#2f6e8a', '#5aa0c4');
  I.merdeka_medallion = `<path d="M9 4 Q12 1.5 15 4" fill="none" stroke="${C.gold}" stroke-width="1.4"/><circle cx="12" cy="14" r="7.4" fill="#c0392b" stroke="${OL}" stroke-width="1.2"/><path d="M14.6 10.5 A4 4 0 1 0 14.6 17.5 A3.1 3.1 0 1 1 14.6 10.5 Z" fill="#fff"/><g fill="#fff"><circle cx="14.1" cy="11.7" r="0.6"/><circle cx="15.4" cy="13" r="0.6"/><circle cx="15.4" cy="15" r="0.6"/><circle cx="14.1" cy="16.3" r="0.6"/><circle cx="13.3" cy="14" r="0.6"/></g>`;
  I.slayer_helmet = `<path d="M5 14 C5 7 19 7 19 14 L18 18 L6 18 Z" fill="#3a3a40" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 16 C7 12 17 12 17 16 L17 19 L14 19 L14 17 L13 19 L11 19 L10 17 L10 19 L7 19 Z" fill="#e8e2d0" stroke="${OL}" stroke-width="0.9" stroke-linejoin="round"/><circle cx="10" cy="15" r="1.4" fill="#c0392b"/><circle cx="14" cy="15" r="1.4" fill="#c0392b"/>`;
  I.slayer_ring = ringIcon('#3a3a40', '#c0392b');
  const gemIcon = (col, hi) => `<path d="M6 9 L9 5 L15 5 L18 9 L12 20 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M9 5 L12 9 L15 5 M6 9 L18 9 M12 9 L12 20" stroke="${OL}" stroke-width=".7" opacity=".4" fill="none"/><path d="M9 5 L12 9 L6 9 Z" fill="${hi}" opacity=".7"/><path d="M13.4 10 L14.2 11.4 L15.6 12.2 L14.2 13 L13.4 14.4 L12.6 13 L11.2 12.2 L12.6 11.4 Z" fill="#fff" opacity=".85"/>`;
  I.sapphire = gemIcon('#3a6ad8', '#8aa6f0');
  I.emerald = gemIcon('#2fa05a', '#7fe0a0');
  I.ruby = gemIcon('#c83b4a', '#f08a96');
  I.diamond = gemIcon('#bfe6ee', '#ffffff');

  // ---- Ranged & Magic gear ----
  const bowIcon = (col) => `<path d="M7 3 C16 6 16 18 7 21" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/><path d="M7 3 L7 21" stroke="#e8e0c8" stroke-width="1"/><path d="M8 12 L19 12" stroke="${C.cream}" stroke-width="1.1"/><path d="M16 9 L20 12 L16 15" fill="none" stroke="${C.iron}" stroke-width="1.3" stroke-linejoin="round"/>`;
  const arrowIcon = (col) => `<path d="M4 20 L18 6" stroke="${C.wood}" stroke-width="1.8"/><path d="M16 3 L20 4 L19 8 L15 7 Z" fill="${col}" stroke="${OL}" stroke-width="1"/><path d="M3 21 L7 17 M3 21 L7 20 M3 21 L4 17" stroke="${C.cream}" stroke-width="1.1"/>`;
  const staffIcon = (rod, orb) => `<rect x="11" y="4" width="2.4" height="17" rx="1.1" fill="${rod}" stroke="${OL}" stroke-width="1" transform="rotate(8 12 12)"/><circle cx="14" cy="5" r="4.4" fill="${orb}" stroke="${OL}" stroke-width="1"/><circle cx="14" cy="5" r="4.4" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.7"/><circle cx="12.6" cy="3.8" r="1.4" fill="#fff" opacity=".8"/><circle cx="15.6" cy="6.4" r="0.8" fill="rgba(255,255,255,0.5)"/>`;
  const runeIcon = (col) => `<path d="M6 8 L12 4 L18 8 L18 16 L12 20 L6 16 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 7 L12 17 M9 10 L15 14 M15 10 L9 14" stroke="#fff" stroke-width="1" opacity=".7"/>`;
  const hatIcon = (col) => `<path d="M12 2 L17 17 L7 17 Z" fill="${col}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><rect x="5" y="16.4" width="14" height="3.4" rx="1.4" fill="${col}" stroke="${OL}" stroke-width="1"/><circle cx="12" cy="6" r="1.2" fill="#ffe24a"/>`;
  I.shortbow = bowIcon('#7a5530'); I.oak_shortbow = bowIcon('#8a5e33'); I.willow_shortbow = bowIcon('#6e6a3a'); I.maple_shortbow = bowIcon('#6e8a3a'); I.yew_shortbow = bowIcon('#3f5a2a'); I.magic_shortbow = bowIcon('#4a6ad0');
  I.bronze_arrow = arrowIcon(C.bronze); I.iron_arrow = arrowIcon(C.iron); I.steel_arrow = arrowIcon(C.steel); I.mithril_arrow = arrowIcon(mith); I.adamant_arrow = arrowIcon(adam); I.rune_arrow = arrowIcon(rune);
  I.staff = staffIcon(C.wood, '#cfd6dd'); I.magic_staff = staffIcon('#3a3a55', '#8a96e8'); I.mystic_staff = staffIcon('#2a2a44', mith); I.ancient_staff = staffIcon('#2a1a3a', '#c06ad0');
  I.dragonhide_coif = helm('#3f7a4a', '#5fa06a'); I.dragonhide_body = plate('#3f7a4a', '#5fa06a'); I.dragonhide_chaps = legs('#3f7a4a', '#5fa06a');
  I.air_rune = runeIcon('#bfe8d0'); I.water_rune = runeIcon('#6fb6e0'); I.earth_rune = runeIcon('#8a6a3a'); I.fire_rune = runeIcon('#ef7a23'); I.mind_rune = runeIcon('#caa15a'); I.chaos_rune = runeIcon('#7a3a8a'); I.death_rune = runeIcon('#3a3a44'); I.blood_rune = runeIcon('#a01a2a');
  I.occult_necklace = `<path d="M9 4 Q12 1.5 15 4" fill="none" stroke="${C.gold}" stroke-width="1.4"/><path d="M12 9 L17 13 L12 21 L7 13 Z" fill="#5b2a8a" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 11 L14.6 13.4 L12 18 L9.4 13.4 Z" fill="#8a5ad0"/><circle cx="12" cy="13.4" r="1" fill="#e0c8ff"/>`;
  I.coif = helm('#7a5530', '#9a734a'); I.leather_chaps = legs('#7a5530', '#9a734a'); I.studded_body = plate('#6a4a2a', '#8a6a3a');
  I.wizard_hat = hatIcon('#2f3a8a'); I.wizard_robe_top = plate('#2f3a8a', '#4a5ad0'); I.wizard_robe_bottom = legs('#2f3a8a', '#4a5ad0');
  I.mystic_hat = hatIcon('#2a2a5a'); I.mystic_top = plate('#3a3a7a', '#6a6ad0'); I.mystic_bottom = legs('#3a3a7a', '#6a6ad0');
  // A-Worthy Sigil — a blue medallion bearing the A Worthy arch + plus mark.
  I.worthy_sigil = `<path d="M9 4 Q12 1.5 15 4" fill="none" stroke="${C.gold}" stroke-width="1.4"/><circle cx="12" cy="14" r="7.6" fill="#2b5c91" stroke="${OL}" stroke-width="1.2"/><circle cx="12" cy="14" r="6" fill="none" stroke="${C.goldHi}" stroke-width="0.9" opacity="0.8"/><path d="M8.7 18 L8.7 13.4 A3.3 3.3 0 0 1 15.3 13.4 L15.3 18 L13.7 18 L13.7 13.4 A1.7 1.7 0 0 0 10.3 13.4 L10.3 18 Z" fill="#e8eef7"/><rect x="10.7" y="10.4" width="2.6" height="1.1" rx="0.5" fill="#e8eef7"/><rect x="11.45" y="9.3" width="1.1" height="3.3" rx="0.5" fill="#e8eef7"/>`;
  S.ranged = bowIcon('#5a8a3a');
  S.magic = `<path d="M12 2 L14 9 L21 11 L14 13 L12 20 L10 13 L3 11 L10 9 Z" fill="#8a96e8" stroke="${OL}" stroke-width="1" stroke-linejoin="round"/>`;
  S.slayer = `<path d="M5 11 C5 5 19 5 19 11 C19 14 17 15 16 16 L16 19 L8 19 L8 16 C7 15 5 14 5 11 Z" fill="#e8e2d0" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.8" fill="#2a2a30"/><circle cx="14.5" cy="11" r="1.8" fill="#2a2a30"/><path d="M11 13 L12 15 L13 13 Z" fill="#2a2a30"/><path d="M9 19 L9 17 M11 19 L11 17 M13 19 L13 17 M15 19 L15 17" stroke="${OL}" stroke-width="0.8"/>`;
  T.prayer = S.prayer;
  T.quests = `<path d="M6 3 L18 3 L18 21 L6 21 Z" fill="${C.cream}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M8 7 L16 7 M8 10 L16 10 M8 13 L14 13" stroke="${C.stoneDk}" stroke-width="1"/><circle cx="17" cy="18" r="3" fill="${C.gold}" stroke="${OL}" stroke-width="1"/>`;
  T.achievements = `<path d="M7 4 L17 4 L17 8 C17 12 14 13 12 13 C10 13 7 12 7 8 Z" fill="${C.gold}" stroke="${OL}" stroke-width="1.1" stroke-linejoin="round"/><path d="M7 5 C4 5 4 9 7 9 M17 5 C20 5 20 9 17 9" fill="none" stroke="${OL}" stroke-width="1.1"/><rect x="10.6" y="13" width="2.8" height="4" fill="${C.goldDk}" stroke="${OL}" stroke-width="1"/><rect x="8" y="17" width="8" height="3" rx="1" fill="${C.stone}" stroke="${OL}" stroke-width="1.1"/>`;

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
