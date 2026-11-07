/**
 * Slavic Dark Fantasy Character Portraits Module
 * Inspired by Fab: "Slavic Mythology Portraits - Dark Fantasy Character 2D Pack"
 * and OpenGameArt Dark Fantasy UI/Frames.
 *
 * Generates high-fidelity, atmospheric Slavic character portraits
 * with embossed antique brass filigree frames, dramatic lighting, and authentic folkloric details.
 */

export interface SlavicPortraitDef {
  id: string;
  name: string;
  title: string;
  svgDataUrl: string;
}

const portraitCache = new Map<string, string>();

function buildPortraitSvg(
  bgColor1: string,
  bgColor2: string,
  elementsSvg: string,
  accentColor = '#e5bd68'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200">
    <defs>
      <radialGradient id="bgGrad" cx="50%" cy="38%" r="65%">
        <stop offset="0%" stop-color="${bgColor1}" />
        <stop offset="100%" stop-color="${bgColor2}" />
      </radialGradient>
      <linearGradient id="frameGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f6df92" />
        <stop offset="45%" stop-color="#b88a38" />
        <stop offset="85%" stop-color="#dfb658" />
        <stop offset="100%" stop-color="#5a4214" />
      </linearGradient>
      <linearGradient id="ironBevel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#3c434f" />
        <stop offset="100%" stop-color="#12161f" />
      </linearGradient>
      <filter id="portraitShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000" flood-opacity="0.8" />
      </filter>
      <filter id="innerGlow">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff" />
        <feFlood flood-color="#000" flood-opacity="0.6" />
        <feComposite in2="shadowDiff" operator="in" />
        <feComposite in2="SourceGraphic" operator="over" />
      </filter>
    </defs>

    <!-- Outer Iron & Brass Beveled Border -->
    <rect x="2" y="2" width="156" height="196" rx="6" fill="url(#ironBevel)" stroke="url(#frameGold)" stroke-width="2" />
    <rect x="6" y="6" width="148" height="188" rx="4" fill="none" stroke="#221808" stroke-width="1.5" />

    <!-- Corner Filigree Ornaments -->
    <circle cx="8" cy="8" r="2.5" fill="url(#frameGold)" />
    <circle cx="152" cy="8" r="2.5" fill="url(#frameGold)" />
    <circle cx="8" cy="192" r="2.5" fill="url(#frameGold)" />
    <circle cx="152" cy="192" r="2.5" fill="url(#frameGold)" />

    <!-- Arch Vignette Canvas -->
    <g clip-path="url(#portraitClip)">
      <clipPath id="portraitClip">
        <rect x="8" y="8" width="144" height="184" rx="3" />
      </clipPath>
      <rect x="8" y="8" width="144" height="184" fill="url(#bgGrad)" />

      <!-- Portrait Artwork Layers -->
      ${elementsSvg}

      <!-- Atmospheric Dark Fantasy Vignette Overlay -->
      <radialGradient id="vignette" cx="50%" cy="40%" r="60%">
        <stop offset="60%" stop-color="transparent" />
        <stop offset="100%" stop-color="#06080d" stop-opacity="0.85" />
      </radialGradient>
      <rect x="8" y="8" width="144" height="184" fill="url(#vignette)" pointer-events="none" />
    </g>

    <!-- Inner Filigree Brass Rim with Arch Header -->
    <rect x="8" y="8" width="144" height="184" rx="3" fill="none" stroke="url(#frameGold)" stroke-width="1.2" opacity="0.85" />
    <path d="M 8 16 Q 80 4 152 16" fill="none" stroke="${accentColor}" stroke-width="0.8" opacity="0.6" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a dark fantasy Slavic character portrait Data URL for a given NPC or Player ID.
 */
export function getSlavicPortrait(actorId: string): string {
  if (portraitCache.has(actorId)) {
    return portraitCache.get(actorId)!;
  }

  let dataUrl = '';

  switch (actorId) {
    case 'npc_gniewko':
      // Król Gniewomir: grim scarred Slavic king, gold-iron crown band, ermine fur collar, piercing gaze
      dataUrl = buildPortraitSvg(
        '#3a1d1d',
        '#0f0707',
        `
        <!-- Embers & War Glow -->
        <circle cx="35" cy="50" r="1.5" fill="#ff7a38" opacity="0.8" />
        <circle cx="125" cy="40" r="1.2" fill="#ffa844" opacity="0.7" />
        <circle cx="45" cy="110" r="2" fill="#ff5522" opacity="0.6" />
        <!-- Ermine Fur Collar & Mantle -->
        <path d="M 20 200 C 25 150 45 130 80 130 C 115 130 135 150 140 200 Z" fill="#2b231f" />
        <path d="M 28 175 C 36 140 60 134 80 134 C 100 134 124 140 132 175 C 115 168 95 166 80 166 C 65 166 45 168 28 175 Z" fill="#e8dfd1" />
        <circle cx="50" cy="155" r="2.5" fill="#181412" />
        <circle cx="80" cy="158" r="2.5" fill="#181412" />
        <circle cx="110" cy="155" r="2.5" fill="#181412" />
        <!-- Neck & Chin -->
        <path d="M 68 120 L 92 120 L 96 145 L 64 145 Z" fill="#9e7456" />
        <path d="M 52 70 C 50 115 62 136 80 136 C 98 136 110 115 108 70 Z" fill="#b88968" />
        <!-- Dark grizzled stubble & scar -->
        <path d="M 56 100 C 60 132 72 136 80 136 C 88 136 100 132 104 100 C 95 116 65 116 56 100 Z" fill="#382820" opacity="0.7" />
        <!-- Jagged Battle Scar across right eye -->
        <path d="M 64 68 L 72 102" stroke="#681818" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />
        <path d="M 64 68 L 72 102" stroke="#e89898" stroke-width="1.0" stroke-linecap="round" opacity="0.6" />
        <!-- Piercing Cold Eyes -->
        <ellipse cx="68" cy="85" rx="5" ry="2.5" fill="#181210" />
        <ellipse cx="92" cy="85" rx="5" ry="2.5" fill="#181210" />
        <circle cx="68" cy="85" r="2" fill="#88b5c4" />
        <circle cx="92" cy="85" r="2" fill="#88b5c4" />
        <circle cx="67" cy="84" r="0.8" fill="#fff" />
        <circle cx="91" cy="84" r="0.8" fill="#fff" />
        <!-- Furrowed Fierce Eyebrows -->
        <path d="M 60 78 Q 70 82 76 80" stroke="#221812" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M 100 78 Q 90 82 84 80" stroke="#221812" stroke-width="3" stroke-linecap="round" fill="none" />
        <!-- Aquiline Slavic Nose & Grim Mouth -->
        <path d="M 80 80 L 77 104 L 84 104" stroke="#785038" stroke-width="2.2" stroke-linejoin="round" fill="none" />
        <line x1="72" y1="116" x2="88" y2="116" stroke="#48241e" stroke-width="2.5" stroke-linecap="round" />
        <!-- Grizzled Hair & Iron-Gold Kniaz Crown -->
        <path d="M 46 75 C 44 42 60 32 80 32 C 100 32 116 42 114 75 C 106 50 54 50 46 75 Z" fill="#3a2f2a" />
        <path d="M 46 54 Q 80 46 114 54 L 112 44 Q 80 38 48 44 Z" fill="url(#frameGold)" />
        <polygon points="80,33 76,42 84,42" fill="url(#frameGold)" />
        <polygon points="62,38 59,45 66,45" fill="url(#frameGold)" />
        <polygon points="98,38 94,45 101,45" fill="url(#frameGold)" />
        <circle cx="80" cy="48" r="2.5" fill="#a41818" />
        `,
        '#d83838'
      );
      break;

    case 'npc_radogost':
      // Żerca Radogost: ancient pagan priest, long flowing snow-white beard, deep mystical eyes, oak leaves, rune amulet
      dataUrl = buildPortraitSvg(
        '#182e24',
        '#08120c',
        `
        <!-- Sacred Grove Twilight & Perun Runes -->
        <path d="M 25 35 L 35 25 M 30 25 L 30 42" stroke="#5ee2ff" stroke-width="1.2" opacity="0.4" />
        <path d="M 130 50 L 140 40 M 135 40 L 135 55" stroke="#5ee2ff" stroke-width="1.2" opacity="0.4" />
        <!-- Linen Robes & Crimson Collar -->
        <path d="M 15 200 C 25 140 50 135 80 135 C 110 135 135 140 145 200 Z" fill="#ddd5c4" />
        <path d="M 50 140 L 80 170 L 110 140 Z" fill="#9e2828" />
        <!-- Wooden Slavic Światowid Idol Talisman -->
        <polygon points="80,165 74,185 86,185" fill="#7a4e28" stroke="#f6df92" stroke-width="1" />
        <circle cx="80" cy="172" r="2" fill="#ffd454" />
        <!-- Weathered Face of Elder -->
        <ellipse cx="80" cy="82" rx="27" ry="32" fill="#c49a7a" />
        <!-- Deep Mystical Eyes -->
        <ellipse cx="67" cy="78" rx="5" ry="3" fill="#141a18" />
        <ellipse cx="93" cy="78" rx="5" ry="3" fill="#141a18" />
        <circle cx="67" cy="78" r="2.2" fill="#4eaec4" />
        <circle cx="93" cy="78" r="2.2" fill="#4eaec4" />
        <circle cx="66" cy="77" r="1.0" fill="#ffffff" />
        <circle cx="92" cy="77" r="1.0" fill="#ffffff" />
        <!-- Wise bushy white eyebrows -->
        <path d="M 58 72 Q 68 70 75 74" stroke="#ebeef4" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <path d="M 102 72 Q 92 70 85 74" stroke="#ebeef4" stroke-width="3.5" stroke-linecap="round" fill="none" />
        <!-- Grand Cascading Snow-White Patriarch Beard -->
        <path d="M 52 86 C 46 130 54 185 80 200 C 106 185 114 130 108 86 C 96 100 64 100 52 86 Z" fill="#edf0f5" filter="url(#portraitShadow)" />
        <path d="M 64 96 Q 80 115 96 96 Q 80 110 64 96 Z" fill="#d2d8e4" />
        <path d="M 72 108 L 76 175 M 88 108 L 84 175 M 80 115 L 80 190" stroke="#c0c8d6" stroke-width="1.5" stroke-linecap="round" />
        <!-- Long Silver White Hair & Oak Leaf Wreath -->
        <path d="M 50 68 C 42 40 58 24 80 24 C 102 24 118 40 110 68 C 118 105 110 135 110 135 C 100 80 60 80 50 135 Z" fill="#edf0f5" />
        <!-- Oak leaf garland -->
        <path d="M 52 46 Q 80 34 108 46" stroke="#487834" stroke-width="4" stroke-linecap="round" fill="none" />
        <circle cx="62" cy="42" r="3" fill="#669e46" />
        <circle cx="78" cy="38" r="3.2" fill="#588c3a" />
        <circle cx="96" cy="41" r="3" fill="#669e46" />
        `,
        '#6ee492'
      );
      break;

    case 'npc_wislawa':
      // Zielarka Wisława: Slavic maiden herbalist, flower & herb wreath, blonde braids, amber necklace
      dataUrl = buildPortraitSvg(
        '#2b2b1a',
        '#0e1208',
        `
        <!-- Meadow Sunbeams & Herbal Dust -->
        <circle cx="30" cy="45" r="1.5" fill="#f8e878" opacity="0.6" />
        <circle cx="120" cy="65" r="1.8" fill="#f8e878" opacity="0.7" />
        <circle cx="45" cy="115" r="2.2" fill="#9de668" opacity="0.5" />
        <!-- Linen Blouse with Red Embroidered Krajka Collar -->
        <path d="M 20 200 C 25 155 48 140 80 140 C 112 140 135 155 140 200 Z" fill="#f2ede4" />
        <path d="M 55 144 L 80 178 L 105 144 Z" fill="#b82e2e" />
        <path d="M 64 146 L 80 168 L 96 146 Z" fill="#f2ede4" />
        <!-- Amber Bead Necklace -->
        <path d="M 60 132 Q 80 148 100 132" stroke="#d97c28" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 5" fill="none" />
        <!-- Graceful Feminine Neck & Face -->
        <path d="M 70 115 L 90 115 L 92 136 L 68 136 Z" fill="#d8a682" />
        <ellipse cx="80" cy="86" rx="24" ry="28" fill="#e6b896" />
        <!-- Warm Hazel-Green Eyes -->
        <ellipse cx="69" cy="82" rx="4.8" ry="3.0" fill="#1e1812" />
        <ellipse cx="91" cy="82" rx="4.8" ry="3.0" fill="#1e1812" />
        <circle cx="69" cy="82" r="2.2" fill="#588c4a" />
        <circle cx="91" cy="82" r="2.2" fill="#588c4a" />
        <circle cx="68" cy="81" r="0.9" fill="#ffffff" />
        <circle cx="90" cy="81" r="0.9" fill="#ffffff" />
        <!-- Delicate Arched Brows & Gentle Lips -->
        <path d="M 63 76 Q 70 74 76 77" stroke="#7a5228" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M 97 76 Q 90 74 84 77" stroke="#7a5228" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M 80 83 L 78 98 L 83 98" stroke="#ba825e" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M 74 106 Q 80 111 86 106" stroke="#b84646" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <!-- Honey-Blonde Hair & Twin Draped Braids -->
        <path d="M 54 75 C 50 42 62 30 80 30 C 98 30 110 42 106 75 C 114 110 112 165 110 200 L 98 200 C 100 160 96 110 94 95 C 66 95 64 160 62 200 L 50 200 C 48 165 46 110 54 75 Z" fill="#d8ad5e" />
        <!-- Intricate Flower & Herb Wreath (Wianek) -->
        <path d="M 48 55 Q 80 40 112 55" stroke="#3e6e2e" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <!-- Red Poppies -->
        <circle cx="58" cy="50" r="4.2" fill="#d82828" />
        <circle cx="58" cy="50" r="1.5" fill="#201414" />
        <circle cx="96" cy="48" r="4.0" fill="#d82828" />
        <circle cx="96" cy="48" r="1.5" fill="#201414" />
        <!-- Blue Cornflowers -->
        <circle cx="70" cy="44" r="3.6" fill="#387cd8" />
        <circle cx="70" cy="44" r="1.2" fill="#fff" />
        <circle cx="106" cy="53" r="3.5" fill="#387cd8" />
        <!-- Yellow St. John's Wort -->
        <circle cx="82" cy="42" r="3.8" fill="#f4cc34" />
        <circle cx="82" cy="42" r="1.2" fill="#9e7418" />
        <circle cx="48" cy="54" r="3.2" fill="#f4cc34" />
        `,
        '#f4cc34'
      );
      break;

    case 'npc_dobromir':
      // Kupiec Dobromir: shrewd merchant elder, fur-trimmed wool cap, amber necklace, knowing smirk
      dataUrl = buildPortraitSvg(
        '#32251a',
        '#120c08',
        `
        <!-- Marketplace Warmth & Spices -->
        <circle cx="30" cy="60" r="2" fill="#ffb444" opacity="0.6" />
        <circle cx="130" cy="40" r="1.5" fill="#ff9834" opacity="0.6" />
        <!-- Rich Wool Kaftan with Fur Trim -->
        <path d="M 18 200 C 24 150 46 134 80 134 C 114 134 136 150 142 200 Z" fill="#583424" />
        <path d="M 30 178 C 45 142 65 138 80 138 C 95 138 115 142 130 178 Z" fill="#9e7856" />
        <!-- Massive Baltic Amber Torque / Pendant -->
        <ellipse cx="80" cy="154" rx="8" ry="10" fill="#d9741e" stroke="#f6df92" stroke-width="1.5" />
        <ellipse cx="78" cy="152" rx="3" ry="4" fill="#ffbe54" />
        <!-- Weathered Shrewd Slavic Face -->
        <path d="M 52 75 C 50 115 62 135 80 135 C 98 135 110 115 108 75 Z" fill="#b88664" />
        <!-- Trimming Beard & Mustache -->
        <path d="M 58 102 C 64 128 72 135 80 135 C 88 135 96 128 102 102 C 94 112 66 112 58 102 Z" fill="#5c4434" />
        <path d="M 70 108 Q 80 116 92 106" stroke="#423024" stroke-width="3" stroke-linecap="round" fill="none" />
        <!-- Shrewd Smirking Eyes -->
        <ellipse cx="68" cy="85" rx="5" ry="2.2" fill="#18120c" />
        <ellipse cx="92" cy="84" rx="5" ry="2.6" fill="#18120c" />
        <circle cx="68" cy="85" r="2" fill="#66462c" />
        <circle cx="92" cy="84" r="2" fill="#66462c" />
        <circle cx="69" cy="84" r="0.8" fill="#fff" />
        <circle cx="93" cy="83" r="0.8" fill="#fff" />
        <!-- Knowing Smirk -->
        <path d="M 73 114 Q 81 118 89 113" stroke="#54241e" stroke-width="2.6" stroke-linecap="round" fill="none" />
        <!-- Fur-Trimmed Woolen Merchant Hat (Kołpak) -->
        <path d="M 44 65 C 44 32 60 22 80 22 C 100 22 116 32 116 65 Z" fill="#884228" />
        <ellipse cx="80" cy="62" rx="38" ry="10" fill="#2b201a" />
        <ellipse cx="80" cy="60" rx="36" ry="8" fill="#46362c" />
        <circle cx="80" cy="42" r="3.5" fill="#f6df92" />
        <circle cx="80" cy="42" r="2" fill="#d9741e" />
        `,
        '#d9741e'
      );
      break;

    case 'npc_bogusz':
      // Wędrowny Kramarz Bogusz: wandering forest merchant, green ranger hood, silver hacksilver pouch
      dataUrl = buildPortraitSvg(
        '#1a2a1a',
        '#081208',
        `
        <!-- Forest Fireflies & Spores -->
        <circle cx="35" cy="50" r="2" fill="#88d868" opacity="0.65" />
        <circle cx="125" cy="70" r="1.6" fill="#d4e878" opacity="0.6" />
        <!-- Rugged Forester Coat & Leather Straps -->
        <path d="M 18 200 C 24 148 46 132 80 132 C 114 132 136 148 142 200 Z" fill="#2a3e28" />
        <path d="M 36 170 L 124 170 L 118 200 L 42 200 Z" fill="#443222" />
        <!-- Hacksilver / Siekańce Pouch with Silver Ring -->
        <ellipse cx="80" cy="158" rx="10" ry="12" fill="#5a422e" stroke="#c4d2dc" stroke-width="1.8" />
        <circle cx="80" cy="156" r="3" fill="#e8f0f8" />
        <!-- Weathered Face -->
        <path d="M 52 75 C 50 115 62 135 80 135 C 98 135 110 115 108 75 Z" fill="#c09472" />
        <!-- Friendly Slavic Mustache & Stubble -->
        <path d="M 62 108 Q 80 118 98 108 Q 80 102 62 108 Z" fill="#584230" />
        <!-- Warm Amber Eyes -->
        <ellipse cx="68" cy="85" rx="5" ry="2.6" fill="#18120c" />
        <ellipse cx="92" cy="85" rx="5" ry="2.6" fill="#18120c" />
        <circle cx="68" cy="85" r="2.2" fill="#885c34" />
        <circle cx="92" cy="85" r="2.2" fill="#885c34" />
        <circle cx="69" cy="84" r="0.8" fill="#fff" />
        <circle cx="93" cy="84" r="0.8" fill="#fff" />
        <!-- Traveler Cowl / Hood -->
        <path d="M 40 68 C 40 28 60 18 80 18 C 100 18 120 28 120 68 C 108 58 52 58 40 68 Z" fill="#345034" />
        <path d="M 40 68 C 34 85 46 112 52 118 C 50 85 45 72 40 68 Z" fill="#283e28" />
        <path d="M 120 68 C 126 85 114 112 108 118 C 110 85 115 72 120 68 Z" fill="#283e28" />
        `,
        '#68b448'
      );
      break;

    case 'npc_gniewosz':
      // Paser Gniewosz: shady fence in catacombs, dark cowl, sharp eyes, silver hacksilver dirhams
      dataUrl = buildPortraitSvg(
        '#221820',
        '#0e0a10',
        `
        <!-- Motes of Dungeon Dust & Torch Glow -->
        <circle cx="28" cy="45" r="2" fill="#ff7834" opacity="0.6" />
        <circle cx="132" cy="65" r="1.8" fill="#ff9c50" opacity="0.5" />
        <!-- Dark Smuggler Brigandine & Iron Buckles -->
        <path d="M 18 200 C 24 146 44 132 80 132 C 116 132 136 146 142 200 Z" fill="#24222a" />
        <path d="M 44 145 L 80 168 L 116 145 Z" fill="#3e3848" />
        <!-- Bag of Hacksilver / Siekańce with Clinking Coins -->
        <ellipse cx="80" cy="162" rx="11" ry="13" fill="#322822" stroke="#d4af37" stroke-width="1.6" />
        <circle cx="76" cy="160" r="3.2" fill="#dce6f0" />
        <circle cx="83" cy="161" r="2.8" fill="#b0c0d0" />
        <!-- Sharp Catacombs Inhabitant Face -->
        <path d="M 52 74 C 50 114 62 134 80 134 C 98 134 110 114 108 74 Z" fill="#a48c7c" />
        <!-- Goatee & Slanted Smirk -->
        <path d="M 74 118 L 80 132 L 86 118 Z" fill="#221a20" />
        <path d="M 72 112 Q 80 114 88 110" stroke="#382024" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <!-- Calculating Torch-Lit Eyes -->
        <ellipse cx="68" cy="85" rx="5" ry="2.2" fill="#120c12" />
        <ellipse cx="92" cy="85" rx="5" ry="2.2" fill="#120c12" />
        <circle cx="68" cy="85" r="2" fill="#ff7834" />
        <circle cx="92" cy="85" r="2" fill="#ff7834" />
        <circle cx="69" cy="84" r="0.8" fill="#fff" />
        <circle cx="93" cy="84" r="0.8" fill="#fff" />
        <!-- Shadowy Assassin / Thief Hood -->
        <path d="M 38 72 C 38 25 58 14 80 14 C 102 14 122 25 122 72 C 108 56 52 56 38 72 Z" fill="#1c1822" />
        <path d="M 38 72 C 32 92 46 122 52 124 C 48 88 44 76 38 72 Z" fill="#141018" />
        <path d="M 122 72 C 128 92 114 122 108 124 C 112 88 116 76 122 72 Z" fill="#141018" />
        `,
        '#9d5bd8'
      );
      break;

    case 'npc_bozydar':
      // Płatnerz Bożydar: burly Slavic blacksmith, forge sparks, walrus mustache, leather apron
      dataUrl = buildPortraitSvg(
        '#381c12',
        '#120804',
        `
        <!-- Fiery Forge Glow & Sparks -->
        <circle cx="25" cy="40" r="1.8" fill="#ff9030" opacity="0.8" />
        <circle cx="135" cy="55" r="2.2" fill="#ff5010" opacity="0.8" />
        <circle cx="40" cy="85" r="1.4" fill="#ffc040" opacity="0.7" />
        <!-- Heavy Leather Smith Apron & Broad Shoulders -->
        <path d="M 15 200 C 22 145 44 130 80 130 C 116 130 138 145 145 200 Z" fill="#422c1e" />
        <path d="M 45 132 L 80 160 L 115 132 Z" fill="#2a1a12" />
        <line x1="55" y1="135" x2="55" y2="200" stroke="#18100a" stroke-width="3" />
        <line x1="105" y1="135" x2="105" y2="200" stroke="#18100a" stroke-width="3" />
        <!-- Muscular Neck & Square Jaw -->
        <path d="M 66 115 L 94 115 L 98 138 L 62 138 Z" fill="#aa7654" />
        <path d="M 50 68 C 48 115 60 136 80 136 C 100 136 112 115 110 68 Z" fill="#c28c68" />
        <!-- Soot mark on cheek -->
        <ellipse cx="64" cy="98" rx="8" ry="5" fill="#1f1814" opacity="0.35" />
        <!-- Fierce Blacksmith Eyes -->
        <ellipse cx="68" cy="80" rx="4.8" ry="2.8" fill="#140e0a" />
        <ellipse cx="92" cy="80" rx="4.8" ry="2.8" fill="#140e0a" />
        <circle cx="68" cy="80" r="2.0" fill="#443224" />
        <circle cx="92" cy="80" r="2.0" fill="#443224" />
        <circle cx="67" cy="79" r="0.8" fill="#ffb468" />
        <circle cx="91" cy="79" r="0.8" fill="#ffb468" />
        <!-- Broad Walrus Mustache -->
        <path d="M 60 106 Q 80 114 100 106 Q 80 122 60 106 Z" fill="#221812" />
        <!-- Wild Dark Hair -->
        <path d="M 46 68 C 42 34 58 24 80 24 C 102 24 118 34 114 68 C 108 45 52 45 46 68 Z" fill="#221812" />
        <path d="M 48 55 L 42 90 M 112 55 L 118 90" stroke="#221812" stroke-width="4" stroke-linecap="round" />
        `,
        '#ff7824'
      );
      break;

    case 'npc_sambor':
      // Kmieć Sambor: honest peasant farmer, grey felt kłobuk, parted straw hair, unbleached linen
      dataUrl = buildPortraitSvg(
        '#282c1e',
        '#0f120a',
        `
        <!-- Golden Wheat Field Atmosphere -->
        <circle cx="28" cy="65" r="1.6" fill="#e8c858" opacity="0.5" />
        <circle cx="132" cy="50" r="2.0" fill="#e8c858" opacity="0.6" />
        <!-- Unbleached Linen Tunic with Red Border -->
        <path d="M 18 200 C 24 150 46 136 80 136 C 114 136 136 150 142 200 Z" fill="#dfd7c8" />
        <path d="M 60 138 L 80 165 L 100 138 Z" fill="#a83232" />
        <path d="M 68 140 L 80 156 L 92 140 Z" fill="#dfd7c8" />
        <!-- Sun-Tanned Honest Face -->
        <path d="M 54 75 C 52 115 62 134 80 134 C 98 134 108 115 106 75 Z" fill="#c4926e" />
        <!-- Kind Blue Eyes -->
        <ellipse cx="68" cy="84" rx="4.5" ry="2.6" fill="#141418" />
        <ellipse cx="92" cy="84" rx="4.5" ry="2.6" fill="#141418" />
        <circle cx="68" cy="84" r="1.9" fill="#5892b4" />
        <circle cx="92" cy="84" r="1.9" fill="#5892b4" />
        <circle cx="67" cy="83" r="0.8" fill="#ffffff" />
        <circle cx="91" cy="83" r="0.8" fill="#ffffff" />
        <!-- Light Straw-Blonde Fringe with Center Parting -->
        <path d="M 52 74 C 48 50 62 42 80 42 C 98 42 112 50 108 74 C 98 62 82 62 80 68 C 78 62 62 62 52 74 Z" fill="#d2b068" />
        <!-- Slavic Felt Conical Kłobuk with Rolled Brim -->
        <path d="M 52 56 C 54 24 70 16 80 16 C 90 16 106 24 108 56 Z" fill="#88827c" />
        <ellipse cx="80" cy="54" rx="34" ry="7.5" fill="#5c5650" />
        <ellipse cx="80" cy="52" rx="32" ry="6" fill="#78726c" />
        `,
        '#d2b068'
      );
      break;

    case 'npc_milosz_patrol':
      // Drużynnik Miłosz: Slavic warrior guardsman, conical szyszak helmet with nasal bar, chainmail coif
      dataUrl = buildPortraitSvg(
        '#1e242e',
        '#0a0e14',
        `
        <!-- Watchtower Palisades & Stormy Twilight -->
        <path d="M 20 200 C 25 145 48 130 80 130 C 112 130 135 145 140 200 Z" fill="#36404c" />
        <!-- Steel Shoulders & Scale Armor -->
        <ellipse cx="40" cy="170" rx="18" ry="12" fill="#727e8e" stroke="#222830" stroke-width="1.5" />
        <ellipse cx="120" cy="170" rx="18" ry="12" fill="#727e8e" stroke="#222830" stroke-width="1.5" />
        <!-- Chainmail Coif covering neck and cheeks -->
        <path d="M 50 75 C 46 115 58 140 80 140 C 102 140 114 115 110 75 Z" fill="#444c58" />
        <!-- Face cutout -->
        <ellipse cx="80" cy="88" rx="18" ry="22" fill="#b88664" />
        <!-- Vigilant Guard Eyes -->
        <ellipse cx="71" cy="85" rx="4.2" ry="2.4" fill="#121418" />
        <ellipse cx="89" cy="85" rx="4.2" ry="2.4" fill="#121418" />
        <circle cx="71" cy="85" r="1.8" fill="#5a7a6c" />
        <circle cx="89" cy="85" r="1.8" fill="#5a7a6c" />
        <!-- Conical Slavic Szyszak Helmet -->
        <path d="M 46 64 C 48 30 74 12 80 8 C 86 12 112 30 114 64 Z" fill="#828e9e" stroke="#36404c" stroke-width="1.5" />
        <polygon points="80,4 78,12 82,12" fill="url(#frameGold)" />
        <ellipse cx="80" cy="62" rx="35" ry="6" fill="#545e6c" />
        <ellipse cx="80" cy="60" rx="34" ry="4" fill="url(#frameGold)" />
        <!-- Riveted Nasal Bar extending down over face -->
        <path d="M 77 56 L 83 56 L 82 92 L 78 92 Z" fill="#404a56" stroke="url(#frameGold)" stroke-width="1" />
        `,
        '#828e9e'
      );
      break;

    case 'npc_vaelen':
      // Kapitan Vaelen: ranger scout captain, deep hunter cowl, keen amber eyes
      dataUrl = buildPortraitSvg(
        '#18261e',
        '#08100a',
        `
        <!-- Deep Pine Forest & Moonlight -->
        <path d="M 18 200 C 24 145 46 130 80 130 C 114 130 136 145 142 200 Z" fill="#26382a" />
        <!-- Dark Leather Collar & Silver Wolf Clasp -->
        <ellipse cx="80" cy="142" rx="6" ry="6" fill="#a4b0c0" stroke="#f6df92" stroke-width="1" />
        <!-- Weathered Ranger Jaw & Stubble -->
        <path d="M 54 80 C 52 118 64 135 80 135 C 96 135 108 118 106 80 Z" fill="#ae7e5c" />
        <ellipse cx="80" cy="116" rx="20" ry="14" fill="#38281c" opacity="0.45" />
        <!-- Keen Amber Hunter Eyes -->
        <ellipse cx="69" cy="85" rx="4.8" ry="2.6" fill="#14100c" />
        <ellipse cx="91" cy="85" rx="4.8" ry="2.6" fill="#14100c" />
        <circle cx="69" cy="85" r="2.0" fill="#c48a28" />
        <circle cx="91" cy="85" r="2.0" fill="#c48a28" />
        <circle cx="68" cy="84" r="0.8" fill="#ffffff" />
        <circle cx="90" cy="84" r="0.8" fill="#ffffff" />
        <!-- Deep Scout Hood (Cowl) Casting Dramatic Shadows -->
        <path d="M 42 78 C 40 30 60 18 80 18 C 100 18 120 30 118 78 C 106 52 54 52 42 78 Z" fill="#1b281e" />
        <path d="M 40 76 Q 80 44 120 76 Q 80 62 40 76 Z" fill="#121c14" />
        `,
        '#68b44a'
      );
      break;

    case 'npc_lyra':
      // Uczona Lyra: arcane druidic scholar, glowing circlet, sapphire eyes, mystic tattoo
      dataUrl = buildPortraitSvg(
        '#181e36',
        '#080a14',
        `
        <!-- Arcane Runes & Ethereal Mists -->
        <circle cx="35" cy="45" r="1.8" fill="#5ae2ff" opacity="0.8" />
        <circle cx="125" cy="55" r="2.2" fill="#789aff" opacity="0.8" />
        <!-- Sapphire Velvet Cowl & Silver Embroidery -->
        <path d="M 18 200 C 24 145 46 132 80 132 C 114 132 136 145 142 200 Z" fill="#243054" />
        <path d="M 52 140 L 80 172 L 108 140 Z" fill="#12182c" stroke="#5ae2ff" stroke-width="1.2" />
        <!-- Pale Arcane Scholar Face -->
        <path d="M 56 75 C 54 112 64 130 80 130 C 96 130 106 112 104 75 Z" fill="#d8c4b2" />
        <!-- Runic Azure Tattoo on Cheekbone -->
        <path d="M 64 92 L 67 98 L 63 104" stroke="#5ae2ff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.85" />
        <!-- Ethereal Glowing Sapphire Eyes -->
        <ellipse cx="70" cy="82" rx="4.5" ry="2.8" fill="#081024" />
        <ellipse cx="90" cy="82" rx="4.5" ry="2.8" fill="#081024" />
        <circle cx="70" cy="82" r="2.2" fill="#5ae2ff" />
        <circle cx="90" cy="82" r="2.2" fill="#5ae2ff" />
        <circle cx="69" cy="81" r="1.0" fill="#ffffff" />
        <circle cx="89" cy="81" r="1.0" fill="#ffffff" />
        <!-- Silver-Ash Hair & Star Circlet -->
        <path d="M 52 70 C 48 38 62 26 80 26 C 98 26 112 38 108 70 C 114 120 104 150 102 180 L 92 180 C 94 130 66 130 68 180 L 58 180 C 56 150 46 120 52 70 Z" fill="#b0b8c8" />
        <!-- Glowing Arcane Circlet -->
        <path d="M 52 52 Q 80 44 108 52" stroke="#d4e4f8" stroke-width="3" stroke-linecap="round" fill="none" />
        <circle cx="80" cy="46" r="4" fill="#5ae2ff" filter="url(#portraitShadow)" />
        <circle cx="80" cy="46" r="2" fill="#ffffff" />
        `,
        '#5ae2ff'
      );
      break;

    default:
      // Hero / Woj Protagonist: heroic Slavic warrior with torque, leather brigandine, and steel studs
      dataUrl = buildPortraitSvg(
        '#2a221a',
        '#0e0b08',
        `
        <path d="M 18 200 C 24 145 46 130 80 130 C 114 130 136 145 142 200 Z" fill="#463428" />
        <ellipse cx="80" cy="144" rx="8" ry="8" fill="#e5bd68" stroke="#5a4214" stroke-width="1.5" />
        <path d="M 52 72 C 50 115 62 134 80 134 C 98 134 110 115 108 72 Z" fill="#c49472" />
        <ellipse cx="68" cy="82" rx="4.5" ry="2.5" fill="#14100c" />
        <ellipse cx="92" cy="82" rx="4.5" ry="2.5" fill="#14100c" />
        <circle cx="68" cy="82" r="1.9" fill="#5284a6" />
        <circle cx="92" cy="82" r="1.9" fill="#5284a6" />
        <circle cx="67" cy="81" r="0.8" fill="#ffffff" />
        <circle cx="91" cy="81" r="0.8" fill="#ffffff" />
        <path d="M 48 68 C 44 34 60 22 80 22 C 100 22 116 34 112 68 C 104 46 56 46 48 68 Z" fill="#3c2c22" />
        `,
        '#e5bd68'
      );
      break;
  }

  portraitCache.set(actorId, dataUrl);
  return dataUrl;
}
