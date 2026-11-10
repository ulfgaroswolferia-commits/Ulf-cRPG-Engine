export type ActionCursorType =
  | 'default'
  | 'move'
  | 'blocked'
  | 'talk'
  | 'attack'
  | 'loot'
  | 'interact';

export interface CursorContextInput {
  hasActiveEdgePan: boolean;
  edgePanCursor?: string | null;
  hoveredWorldTile: { x: number; y: number; z: number } | null;
  isTileWalkable: boolean;
  hoveredNpc?: {
    id: string;
    isAlive: boolean;
    isHostile: boolean;
    isLooted?: boolean;
    hasDialogue?: boolean;
  } | null;
  hoveredProp?: {
    id: string;
    kind: string;
    interactive: boolean;
    isOpen?: boolean;
    lootItems?: string[];
  } | null;
  activeTool: string;
}

/**
 * Creates an optimized and valid SVG Data-URI string for CSS cursor property.
 */
function createSvgCursor(svgContent: string, hotX: number, hotY: number, fallback: string): string {
  const encoded = encodeURIComponent(
    svgContent
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim()
  );
  return `url("data:image/svg+xml,${encoded}") ${hotX} ${hotY}, ${fallback}`;
}

const SVG_CURSORS: Record<ActionCursorType, string> = {
  // 1. Default brass adventurer pointer
  default: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1.5" dy="2" stdDeviation="1" flood-color="#000000" flood-opacity="0.85"/>
        </filter>
      </defs>
      <path d="M3 2 L3 24 L8 19 L13 29 L16 27 L11 17 L19 17 Z"
        fill="#f6cf65" stroke="#10141a" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)"/>
      <path d="M5 6 L5 19 L8 16 L13 25 L14.5 24 L9.5 15 L15 15 Z" fill="#fff5d0"/>
    </svg>`,
    2,
    2,
    'default'
  ),

  // 2. Tactical Movement pointer (cyan/teal glowing destination cursor)
  move: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="msh" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <!-- Stylized compass move pointer -->
      <path d="M2 2 L14 8 L8 14 Z" fill="#4deeea" stroke="#04121a" stroke-width="2.2" stroke-linejoin="round" filter="url(#msh)"/>
      <circle cx="18" cy="18" r="7" fill="none" stroke="#4deeea" stroke-width="1.8" stroke-dasharray="3,2" filter="url(#msh)"/>
      <circle cx="18" cy="18" r="2.5" fill="#4deeea"/>
    </svg>`,
    2,
    2,
    'crosshair'
  ),

  // 3. Blocked / impassable indicator (crimson shield with slash)
  blocked: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="bsh" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="1.5" stdDeviation="1" flood-color="#000000" flood-opacity="0.85"/>
        </filter>
      </defs>
      <circle cx="16" cy="16" r="11" fill="#1c0709" stroke="#ff3b30" stroke-width="2.5" filter="url(#bsh)"/>
      <line x1="8" y1="8" x2="24" y2="24" stroke="#ff3b30" stroke-width="2.5"/>
    </svg>`,
    16,
    16,
    'not-allowed'
  ),

  // 4. Talk / Dialogue (golden speech bubble with parchment paper)
  talk: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="tsh" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <!-- Pointer pointer tip at top-left -->
      <path d="M3 3 L12 9 L9 12 Z" fill="#ffd700" stroke="#090c10" stroke-width="1.5"/>
      <!-- Main parchment speech balloon -->
      <path d="M7 11 Q7 7 14 7 L25 7 Q29 7 29 11 L29 20 Q29 24 25 24 L16 24 L11 28 L12 24 L10 24 Q7 24 7 20 Z"
        fill="#fdf6e2" stroke="#12161f" stroke-width="2" filter="url(#tsh)"/>
      <!-- Inner text lines -->
      <line x1="12" y1="12" x2="24" y2="12" stroke="#b38728" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="16" x2="21" y2="16" stroke="#b38728" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="18" cy="20" r="1.2" fill="#d97706"/>
    </svg>`,
    3,
    3,
    'pointer'
  ),

  // 5. Attack / Combat (sharpened steel blade with blood-ruby gem & gold guard)
  attack: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="ash" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <!-- Blade: tip at (2, 2) pointing down-right -->
      <path d="M2 2 L10 6 L20 16 L22 21 L17 19 L7 9 Z"
        fill="#f1f5f9" stroke="#06090e" stroke-width="2" stroke-linejoin="round" filter="url(#ash)"/>
      <line x1="2" y1="2" x2="19" y2="19" stroke="#94a3b8" stroke-width="1.2"/>
      <!-- Crossguard -->
      <path d="M15 22 L22 15 L24 17 L17 24 Z" fill="#f59e0b" stroke="#06090e" stroke-width="1.6"/>
      <!-- Grip and Pommel -->
      <line x1="20" y1="20" x2="27" y2="27" stroke="#78350f" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="28" cy="28" r="2.5" fill="#ef4444" stroke="#06090e" stroke-width="1.2"/>
    </svg>`,
    2,
    2,
    'crosshair'
  ),

  // 6. Loot / Pick up (leather adventurer coin sack with glittering golden coin)
  loot: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="lsh" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <!-- Top pointer arrow -->
      <polygon points="4,3 10,6 6,10" fill="#ffd54f" stroke="#090c10" stroke-width="1.5"/>
      <!-- Leather pouch body -->
      <path d="M14 10 Q19 8 22 11 Q26 14 26 21 Q26 28 17 28 Q8 28 8 21 Q8 14 12 11 Z"
        fill="#b45309" stroke="#090c10" stroke-width="2" stroke-linejoin="round" filter="url(#lsh)"/>
      <!-- Pouch neck / rope -->
      <path d="M12 13 Q17 14 22 13" stroke="#fef08a" stroke-width="2" fill="none"/>
      <!-- Golden coin embossed -->
      <circle cx="17" cy="21" r="4.2" fill="#fbbf24" stroke="#78350f" stroke-width="1.2"/>
      <text x="17" y="24" font-size="6" font-weight="bold" text-anchor="middle" fill="#78350f" font-family="serif">$</text>
    </svg>`,
    4,
    4,
    'pointer'
  ),

  // 7. Interact / Open (ornate gothic key & doorway)
  interact: createSvgCursor(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="ish" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="1" dy="2" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <!-- Gothic Key: teeth at (3, 3) pointing to key ring -->
      <path d="M3 6 L8 6 L8 4 L10 4 L10 6 L12 6 L12 8 L6 8 L20 22"
        stroke="#fde047" stroke-width="2.4" stroke-linecap="square" fill="none" filter="url(#ish)"/>
      <path d="M3 6 L8 6 L8 4 L10 4 L10 6 L12 6 L12 8 L6 8 L20 22"
        stroke="#171717" stroke-width="3.8" stroke-linecap="square" fill="none" style="paint-order: stroke fill"/>
      <!-- Key Ring -->
      <circle cx="23" cy="25" r="5" fill="#facc15" stroke="#171717" stroke-width="2" filter="url(#ish)"/>
      <circle cx="23" cy="25" r="2" fill="#0b0e14"/>
    </svg>`,
    3,
    3,
    'pointer'
  )
};

/**
 * Returns the CSS cursor property value (SVG Data-URI) for the given action cursor type.
 */
export function getCursorCss(cursorType: ActionCursorType): string {
  return SVG_CURSORS[cursorType] || SVG_CURSORS.default;
}

/**
 * Evaluates the hover state and returns the appropriate action cursor.
 */
export function determineActionCursor(ctx: CursorContextInput): ActionCursorType {
  // If pointer is not over any tile, or user is in level editor mode, return default
  if (!ctx.hoveredWorldTile || ctx.activeTool !== 'interact') {
    return 'default';
  }

  // 1. Alive Hostile NPC -> Attack
  if (ctx.hoveredNpc && ctx.hoveredNpc.isAlive && ctx.hoveredNpc.isHostile) {
    return 'attack';
  }

  // 2. Dead unlooted NPC corpse -> Loot
  if (ctx.hoveredNpc && !ctx.hoveredNpc.isAlive && !ctx.hoveredNpc.isLooted) {
    return 'loot';
  }

  // 3. Alive Friendly/Neutral NPC -> Talk
  if (ctx.hoveredNpc && ctx.hoveredNpc.isAlive && !ctx.hoveredNpc.isHostile) {
    return 'talk';
  }

  // 4. Props with loot (ground loot, closed lootable barrels/chests) -> Loot
  if (ctx.hoveredProp) {
    const isLootProp =
      ctx.hoveredProp.kind === 'ground_loot' ||
      ((ctx.hoveredProp.kind === 'chest' ||
        ctx.hoveredProp.kind === 'dungeon_barrel' ||
        ctx.hoveredProp.kind === 'dungeon_crate' ||
        ctx.hoveredProp.kind === 'market_stall') &&
        !ctx.hoveredProp.isOpen);

    if (isLootProp) {
      return 'loot';
    }

    // Interactive fixtures (doors, exits, portals, campfire, shrine, signpost) -> Interact
    if (ctx.hoveredProp.interactive || ctx.hoveredProp.kind === 'exit_path' || ctx.hoveredProp.kind === 'door') {
      return 'interact';
    }
  }

  // 5. Ground movement
  if (ctx.isTileWalkable) {
    return 'move';
  }

  // 6. Blocked tile
  return 'blocked';
}
