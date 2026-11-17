import {
  CharacterVisualRecipe,
  EQUIPMENT_CATALOG,
  EquipmentItemDef,
  HAIR_COLORS,
  HairStyle,
  RGBAColor,
  SKIN_TONES
} from '../rpg/characterData';

export interface ResolvedCharacterLayers {
  recipe: CharacterVisualRecipe;
  showHair: boolean;
  headItem: EquipmentItemDef | null;
  torsoItem: EquipmentItemDef;
  cloakItem: EquipmentItemDef | null;
  legsItem: EquipmentItemDef;
  mainHandItem: EquipmentItemDef | null;
  offHandItem: EquipmentItemDef | null;
}

export interface BakedCharacterBuffers {
  recipeHash: string;
  frameWidth: number;
  frameHeight: number;
  directions: number;
  framesPerDirection: number;
  sheetWidth: number;
  sheetHeight: number;
  albedoRGBA: Uint8ClampedArray;
  normalMaterialRGBA: Uint8ClampedArray;
}

const HAIR_STYLES: ReadonlyArray<HairStyle> = [
  'short_crop',
  'long_braids',
  'noble_crest',
  'tonsure',
  'slavic_parted',
  'elder_beard',
  'wreath_braids',
  'none'
];

const FIRST_NAMES = [
  'Kaelen',
  'Vaelen',
  'Lyra',
  'Theron',
  'Seraphina',
  'Bram',
  'Isolde',
  'Corvus',
  'Aldric',
  'Miriel'
];

const TITLES = [
  'Strażnik Sanktuarium',
  'Poszukiwacz Popiołów',
  'Inkwizytor Żelaznej Korony',
  'Uczony Konklawe',
  'Najemnik z Północy',
  'Ostrze Zmierzchu'
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRandomCharacterRecipe(
  seed: number,
  customId?: string
): CharacterVisualRecipe {
  const rng = mulberry32(seed);
  const pick = <T>(arr: ReadonlyArray<T>): T => arr[Math.floor(rng() * arr.length)];

  const torsos = [
    'torso_warden_brigandine',
    'torso_aethel_plate',
    'torso_archmage_robes',
    'torso_linen_tunic',
    'torso_slavic_giezlo',
    'torso_przeszywanica',
    'torso_slavic_lamellar'
  ];
  const heads: Array<string | null> = [
    null,
    'helm_dread_plate',
    'helm_shadow_hood',
    'helm_arcane_circlet',
    'helm_szyszak',
    'helm_klobuk',
    'helm_druid_antlers',
    'helm_ranger_cowl'
  ];
  const cloaks: Array<string | null> = [
    null,
    'cloak_crimson_mantle',
    'cloak_steel_pauldrons',
    'cloak_ranger_quiver'
  ];
  const legs = ['legs_steel_greaves', 'legs_leather_boots', 'legs_lapcie'];
  const weapons: Array<string | null> = [
    'weapon_sunblade_longsword',
    'weapon_Executioner_axe',
    'weapon_astral_staff',
    'weapon_slavic_axe',
    'weapon_hunting_bow'
  ];
  const offhands: Array<string | null> = [
    null,
    'offhand_heraldic_shield',
    'offhand_slavic_shield',
    'offhand_torch',
    'offhand_grimoire'
  ];

  return {
    id: customId ?? `char_${seed}`,
    name: pick(FIRST_NAMES),
    title: pick(TITLES),
    seed,
    skinTone: pick(SKIN_TONES),
    hairColor: pick(HAIR_COLORS),
    hairStyle: pick(HAIR_STYLES),
    equipment: {
      head: pick(heads),
      torso: pick(torsos),
      cloak: pick(cloaks),
      legs: pick(legs),
      mainHand: pick(weapons),
      offHand: pick(offhands)
    },
    attributes: {
      might: 10 + Math.floor(rng() * 8),
      finesse: 10 + Math.floor(rng() * 8),
      resolve: 10 + Math.floor(rng() * 8),
      lore: 10 + Math.floor(rng() * 8),
      perception: 10 + Math.floor(rng() * 8)
    }
  };
}

export function resolveCharacterArchetypeTag(recipe: CharacterVisualRecipe): string {
  const id = (recipe.id || '').toLowerCase();
  const name = (recipe.name || '').toLowerCase();
  if (id.includes('wilk') || id.includes('wolf') || name.includes('wilk') || name.includes('basior') || name.includes('wadera')) {
    return 'wilk';
  }
  if (id.includes('skeleton') || id.includes('vault_warden') || name.includes('szkielet') || name.includes('kościotrup')) {
    return 'skeleton';
  }
  if (id.includes('utopiec') || id.includes('lake_lurker') || name.includes('utopiec') || name.includes('topielec')) {
    return 'utopiec';
  }
  if (id.includes('goblin') || id.includes('cave_raider') || name.includes('goblin')) {
    return 'goblin';
  }
  if (id.includes('leszy') || name.includes('leszy') || name.includes('borowy')) {
    return 'leszy';
  }
  if (id.includes('bies') || name.includes('bies') || name.includes('czart')) {
    return 'bies';
  }
  if (id.includes('poludnica') || name.includes('południca') || name.includes('poludnica')) {
    return 'poludnica';
  }
  if (
    id.includes('strzyga') ||
    id.includes('nocnica') ||
    id.includes('zmora') ||
    name.includes('strzyga') ||
    name.includes('nocnica') ||
    name.includes('zmora')
  ) {
    return 'wraith';
  }
  if (id.includes('wislawa') || name.includes('wisława') || name.includes('zielarka')) {
    return 'peasant_woman';
  }
  if (id.includes('sambor') || name.includes('sambor') || name.includes('kmieć')) {
    return 'peasant_man';
  }
  if (
    id.includes('dobromir') ||
    id.includes('bogusz') ||
    id.includes('gniewosz') ||
    name.includes('kupiec') ||
    name.includes('kramarz') ||
    name.includes('paser')
  ) {
    return 'trader';
  }
  if (id.includes('gniewko') || name.includes('gniewko') || name.includes('starosta')) {
    return 'noble';
  }
  return '';
}

export function computeCharacterRecipeHash(recipe: CharacterVisualRecipe): string {
  const { skinTone, hairColor, hairStyle, equipment } = recipe;
  const base = [
    `${skinTone.r}_${skinTone.g}_${skinTone.b}`,
    `${hairColor.r}_${hairColor.g}_${hairColor.b}`,
    hairStyle,
    equipment.head ?? 'none',
    equipment.torso,
    equipment.cloak ?? 'none',
    equipment.legs,
    equipment.mainHand ?? 'none',
    equipment.offHand ?? 'none'
  ].join('|');
  const tag = resolveCharacterArchetypeTag(recipe);
  return tag ? `${base}|${tag}` : base;
}

export function resolveEffectiveCharacterLayers(
  recipe: CharacterVisualRecipe
): ResolvedCharacterLayers {
  const headItem = recipe.equipment.head ? EQUIPMENT_CATALOG[recipe.equipment.head] ?? null : null;
  const torsoItem =
    EQUIPMENT_CATALOG[recipe.equipment.torso] ?? EQUIPMENT_CATALOG.torso_warden_brigandine;
  const cloakItem = recipe.equipment.cloak
    ? EQUIPMENT_CATALOG[recipe.equipment.cloak] ?? null
    : null;
  const legsItem =
    EQUIPMENT_CATALOG[recipe.equipment.legs] ?? EQUIPMENT_CATALOG.legs_leather_boots;
  const mainHandItem = recipe.equipment.mainHand
    ? EQUIPMENT_CATALOG[recipe.equipment.mainHand] ?? null
    : null;
  const offHandItem = recipe.equipment.offHand
    ? EQUIPMENT_CATALOG[recipe.equipment.offHand] ?? null
    : null;

  const showHair = recipe.hairStyle !== 'none' && !(headItem?.hidesHair ?? false);

  return {
    recipe,
    showHair,
    headItem,
    torsoItem,
    cloakItem,
    legsItem,
    mainHandItem,
    offHandItem
  };
}

function setPixelWithNormal(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  px: number,
  py: number,
  color: RGBAColor,
  shade: number,
  nx: number,
  ny: number,
  roughness: number,
  metallic: number
): void {
  const x = Math.round(px);
  const y = Math.round(py);
  if (x < 0 || x >= sheetW || y < 0 || y >= sheetH) return;
  const idx = (y * sheetW + x) * 4;

  albedo[idx] = Math.min(255, Math.max(0, Math.round(color.r * shade)));
  albedo[idx + 1] = Math.min(255, Math.max(0, Math.round(color.g * shade)));
  albedo[idx + 2] = Math.min(255, Math.max(0, Math.round(color.b * shade)));
  albedo[idx + 3] = 255;

  normalMat[idx] = Math.min(255, Math.max(0, Math.round((nx * 0.5 + 0.5) * 255)));
  normalMat[idx + 1] = Math.min(255, Math.max(0, Math.round((ny * 0.5 + 0.5) * 255)));
  normalMat[idx + 2] = Math.min(255, Math.max(0, Math.round(roughness * 255)));
  normalMat[idx + 3] = Math.min(255, Math.max(0, Math.round(metallic * 255)));
}

function drawShadedEllipse(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: RGBAColor,
  trimColor: RGBAColor | null,
  roughness: number,
  metallic: number,
  outlineDarken = true
): void {
  const minX = Math.max(0, Math.floor(cx - rx));
  const maxX = Math.min(sheetW - 1, Math.ceil(cx + rx));
  const minY = Math.max(0, Math.floor(cy - ry));
  const maxY = Math.min(sheetH - 1, Math.ceil(cy + ry));
  const invRx = 1 / Math.max(1, rx);
  const invRy = 1 / Math.max(1, ry);
  const roughByte = Math.min(255, Math.max(0, Math.round(roughness * 255)));
  const metalByte = Math.min(255, Math.max(0, Math.round(metallic * 255)));

  for (let y = minY; y <= maxY; y++) {
    const dy = (y - cy) * invRy;
    const dySq = dy * dy;
    const rowOffset = y * sheetW;
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) * invRx;
      const distSq = dx * dx + dySq;
      if (distSq <= 1.0) {
        const isOuterEdge = outlineDarken && distSq > 0.84;
        const isBorder = trimColor !== null && distSq > 0.68 && distSq <= 0.84;
        const activeColor = isBorder && trimColor ? trimColor : color;
        const nz = Math.sqrt(Math.max(0.05, 1.0 - distSq));
        // Strong metallic specular rim & zenith shading
        const specHighlight =
          metallic > 0.5 && dx < -0.15 && dy < -0.15 ? (1.0 - distSq) * 0.42 : 0;
        const baseShade = 0.68 + 0.38 * nz - 0.16 * dy - 0.1 * dx + specHighlight;
        const shade = isOuterEdge ? baseShade * 0.42 : baseShade;

        const idx = (rowOffset + x) * 4;
        const r = Math.round(activeColor.r * shade);
        const g = Math.round(activeColor.g * shade);
        const b = Math.round(activeColor.b * shade);
        albedo[idx] = r < 0 ? 0 : r > 255 ? 255 : r;
        albedo[idx + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        albedo[idx + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        albedo[idx + 3] = 255;

        const nxByte = Math.round((dx * 0.85 * 0.5 + 0.5) * 255);
        const nyByte = Math.round((dy * 0.85 * 0.5 + 0.5) * 255);
        normalMat[idx] = nxByte < 0 ? 0 : nxByte > 255 ? 255 : nxByte;
        normalMat[idx + 1] = nyByte < 0 ? 0 : nyByte > 255 ? 255 : nyByte;
        normalMat[idx + 2] = roughByte;
        normalMat[idx + 3] = metalByte;
      }
    }
  }
}

function drawTaperedLimb(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r0: number,
  r1: number,
  color: RGBAColor,
  trimColor: RGBAColor | null,
  roughness: number,
  metallic: number
): void {
  const steps = Math.max(6, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const r = r0 * (1 - t) + r1 * t;
    const useTrim = trimColor && Math.abs(t - 0.52) < 0.08;
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      px,
      py,
      r,
      r,
      useTrim && trimColor ? trimColor : color,
      null,
      roughness,
      metallic,
      true
    );
  }
}

function drawArticulatedArm(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  shoulderX: number,
  shoulderY: number,
  handX: number,
  handY: number,
  isLeftArm: boolean,
  facingX: number,
  skinColor: RGBAColor,
  sleeveColor: RGBAColor,
  vambraceColor: RGBAColor | null,
  roughness: number,
  metallic: number
): void {
  // Articulated elbow position
  const elbowBendX = isLeftArm ? -2.8 + facingX * 1.5 : 2.8 + facingX * 1.5;
  const elbowX = (shoulderX + handX) * 0.5 + elbowBendX;
  const elbowY = (shoulderY + handY) * 0.5 + 2.5;

  // Upper arm (sleeve/muscle)
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    shoulderX,
    shoulderY,
    elbowX,
    elbowY,
    3.8,
    3.0,
    sleeveColor,
    vambraceColor,
    roughness,
    metallic
  );

  // Forearm & Vambrace (karwasz)
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    elbowX,
    elbowY,
    handX,
    handY,
    3.2,
    2.4,
    vambraceColor ? vambraceColor : sleeveColor,
    vambraceColor ? { r: 218, g: 174, b: 84 } : null,
    vambraceColor ? 0.3 : roughness,
    vambraceColor ? 0.8 : metallic
  );

  // Clenched hand / gauntlet
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX,
    handY,
    2.6,
    2.6,
    skinColor,
    vambraceColor ? vambraceColor : null,
    0.6,
    0.2
  );
}

function drawLayeredPauldron(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  px: number,
  py: number,
  isLeft: boolean,
  primaryColor: RGBAColor,
  trimColor: RGBAColor,
  hasFurMantle: boolean,
  roughness: number,
  metallic: number
): void {
  // Fur collar / tuft under pauldron
  if (hasFurMantle) {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      px + (isLeft ? 1.5 : -1.5),
      py - 1.5,
      6.2,
      5.2,
      { r: 78, g: 68, b: 60 },
      { r: 142, g: 128, b: 114 },
      0.9,
      0.05
    );
  }

  // Tier 1: Main curved shoulder plate
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    px,
    py,
    5.6,
    5.0,
    primaryColor,
    trimColor,
    roughness,
    metallic
  );

  // Tier 2: Lower articulating pauldron lame
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    px + (isLeft ? -1.2 : 1.2),
    py + 3.2,
    4.4,
    3.2,
    primaryColor,
    trimColor,
    roughness,
    metallic
  );

  // Center rivet highlight
  setPixelWithNormal(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    px,
    py,
    trimColor,
    1.25,
    0,
    0,
    0.15,
    0.95
  );
}

function drawDetailedBlade(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  handX: number,
  handY: number,
  tipX: number,
  tipY: number,
  bladeColor: RGBAColor,
  goldColor: RGBAColor
): void {
  const dx = tipX - handX;
  const dy = tipY - handY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;

  // Crossguard quillons with winged finials
  const guardX0 = handX + nx * 5.5;
  const guardY0 = handY + ny * 5.5;
  const guardX1 = handX - nx * 5.5;
  const guardY1 = handY - ny * 5.5;

  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    guardX0,
    guardY0,
    guardX1,
    guardY1,
    2.2,
    2.2,
    goldColor,
    null,
    0.18,
    0.95
  );

  // Disc pommel counterweight
  const pommelX = handX - (dx / len) * 4.5;
  const pommelY = handY - (dy / len) * 4.5;
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    pommelX,
    pommelY,
    2.2,
    2.2,
    goldColor,
    null,
    0.2,
    0.92
  );

  // Double-edged steel blade
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX,
    handY,
    tipX,
    tipY,
    3.0,
    1.2,
    bladeColor,
    { r: 245, g: 250, b: 255 },
    0.14,
    0.96
  );

  // Dark fuller groove (zbrocze)
  const fullerSteps = Math.floor(len * 0.65);
  for (let i = 2; i < fullerSteps; i++) {
    const t = i / len;
    const fx = handX + dx * t;
    const fy = handY + dy * t;
    setPixelWithNormal(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      fx,
      fy,
      { r: 84, g: 96, b: 112 },
      0.65,
      0,
      0,
      0.35,
      0.75
    );
  }
}

function drawDetailedAxe(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  handX: number,
  handY: number,
  tipX: number,
  tipY: number,
  woodColor: RGBAColor,
  ironColor: RGBAColor,
  goldColor: RGBAColor
): void {
  // Wood haft (ash wood toporzysko)
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX - 2,
    handY + 7,
    tipX,
    tipY,
    2.4,
    2.2,
    woodColor,
    goldColor,
    0.7,
    0.1
  );

  // Steel socket
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    tipX,
    tipY + 2,
    2.8,
    3.2,
    goldColor,
    null,
    0.25,
    0.9
  );

  // Bearded axe head (broda topora)
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    tipX + 3.8,
    tipY + 4.5,
    6.8,
    5.4,
    ironColor,
    { r: 245, g: 250, b: 255 },
    0.18,
    0.94
  );

  // Rear hammer lug
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    tipX - 2.8,
    tipY + 2.0,
    2.4,
    2.0,
    ironColor,
    null,
    0.28,
    0.9
  );
}

function drawDetailedStaff(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  handX: number,
  handY: number,
  tipX: number,
  tipY: number,
  woodColor: RGBAColor,
  crystalColor: RGBAColor
): void {
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX - 2,
    handY + 12,
    tipX,
    tipY,
    2.6,
    2.2,
    woodColor,
    { r: 212, g: 174, b: 84 },
    0.65,
    0.15
  );

  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    tipX,
    tipY + 1.5,
    4.2,
    3.0,
    { r: 224, g: 182, b: 84 },
    null,
    0.2,
    0.92
  );

  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    tipX,
    tipY - 2.5,
    5.2,
    5.2,
    crystalColor,
    { r: 255, g: 255, b: 255 },
    0.05,
    0.98,
    false
  );
}

function drawDetailedBow(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  handX: number,
  handY: number,
  facingX: number,
  woodColor: RGBAColor,
  goldColor: RGBAColor
): void {
  const topX = handX + facingX * 2 - 2;
  const topY = handY - 24;
  const btmX = handX + facingX * 2 - 2;
  const btmY = handY + 14;

  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX,
    handY,
    topX,
    topY,
    2.6,
    1.4,
    woodColor,
    goldColor,
    0.45,
    0.2
  );

  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    handX,
    handY,
    btmX,
    btmY,
    2.6,
    1.4,
    woodColor,
    goldColor,
    0.45,
    0.2
  );

  const bowSteps = Math.ceil(Math.hypot(btmX - topX, btmY - topY));
  for (let i = 0; i <= bowSteps; i++) {
    const t = i / bowSteps;
    const sx = topX + (btmX - topX) * t + 3;
    const sy = topY + (btmY - topY) * t;
    setPixelWithNormal(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      sx,
      sy,
      { r: 235, g: 235, b: 240 },
      1.0,
      0,
      0,
      0.8,
      0.1
    );
  }
}

function drawDetailedShield(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  offX: number,
  offY: number,
  shieldId: string,
  primaryColor: RGBAColor,
  trimColor: RGBAColor,
  roughness: number,
  metallic: number
): void {
  const isSlavicRound = shieldId === 'offhand_slavic_shield';

  if (isSlavicRound) {
    const rad = 10.5;
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      offX,
      offY,
      rad,
      rad * 0.95,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      const rx = offX + Math.cos(angle) * (rad * 0.55);
      const ry = offY + Math.sin(angle) * (rad * 0.55 * 0.95);
      setPixelWithNormal(
        albedo,
        normalMat,
        sheetW,
        sheetH,
        rx,
        ry,
        trimColor,
        1.15,
        0,
        0,
        0.2,
        0.88
      );
    }

    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      offX,
      offY,
      3.8,
      3.6,
      { r: 184, g: 192, b: 204 },
      trimColor,
      0.16,
      0.96
    );
  } else {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      offX,
      offY - 2,
      7.8,
      12.5,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );

    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      offX,
      offY - 3,
      3.5,
      4.8,
      trimColor,
      null,
      0.2,
      0.92
    );
  }
}

function drawDetailedTorch(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  offX: number,
  offY: number,
  frame: number,
  primaryColor: RGBAColor
): void {
  drawTaperedLimb(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    offX,
    offY + 4,
    offX - 3,
    offY - 14,
    2.4,
    2.8,
    primaryColor,
    { r: 42, g: 32, b: 24 },
    0.7,
    0.1
  );

  const flicker = Math.sin(frame * 1.6) * 1.5;
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    offX - 3 + flicker,
    offY - 18,
    5.6,
    7.5,
    { r: 255, g: 196, b: 64 },
    { r: 255, g: 96, b: 24 },
    0.05,
    0.95,
    false
  );
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    offX - 3 + flicker * 0.5,
    offY - 17,
    2.8,
    3.8,
    { r: 255, g: 252, b: 220 },
    null,
    0.02,
    0.98,
    false
  );
}

function drawDetailedGrimoire(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  offX: number,
  offY: number,
  primaryColor: RGBAColor,
  trimColor: RGBAColor
): void {
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    offX,
    offY,
    5.5,
    7.5,
    primaryColor,
    trimColor,
    0.65,
    0.25
  );
  drawShadedEllipse(
    albedo,
    normalMat,
    sheetW,
    sheetH,
    offX,
    offY,
    2.2,
    2.8,
    trimColor,
    null,
    0.2,
    0.92
  );
}

function drawDetailedHelm(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  cx: number,
  headY: number,
  facingX: number,
  facingY: number,
  headItem: EquipmentItemDef
): void {
  const { id, visualStyle, primaryColor, trimColor, roughness, metallic } = headItem;

  if (id === 'helm_szyszak') {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY + 3.5,
      8.8,
      5.2,
      { r: 96, g: 104, b: 114 },
      null,
      0.45,
      0.75
    );

    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 2.5,
      8.6,
      8.4,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );

    drawTaperedLimb(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 9.5,
      cx,
      headY - 14.5,
      2.2,
      0.8,
      trimColor,
      null,
      0.18,
      0.96
    );

    if (facingY > 0) {
      const nasalX = cx + facingX * 2.2;
      for (let ny = -2; ny <= 4; ny++) {
        setPixelWithNormal(
          albedo,
          normalMat,
          sheetW,
          sheetH,
          nasalX,
          headY + ny,
          trimColor,
          1.2,
          0,
          0,
          0.2,
          0.92
        );
      }
    }
  } else if (id === 'helm_klobuk') {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 6.5,
      6.8,
      6.5,
      primaryColor,
      trimColor,
      0.92,
      0.0
    );
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 2.5,
      9.4,
      3.2,
      trimColor,
      primaryColor,
      0.95,
      0.0
    );
  } else if (id === 'helm_druid_antlers') {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 3.8,
      8.8,
      3.2,
      { r: 52, g: 112, b: 64 },
      trimColor,
      0.65,
      0.15
    );
    drawTaperedLimb(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx - 5,
      headY - 5,
      cx - 10,
      headY - 14,
      2.0,
      0.8,
      primaryColor,
      null,
      0.55,
      0.1
    );
    drawTaperedLimb(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx + 5,
      headY - 5,
      cx + 10,
      headY - 14,
      2.0,
      0.8,
      primaryColor,
      null,
      0.55,
      0.1
    );
  } else if (visualStyle === 'hood') {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 2.0,
      9.4,
      9.8,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );
    if (facingY > 0.1) {
      drawShadedEllipse(
        albedo,
        normalMat,
        sheetW,
        sheetH,
        cx + facingX * 2,
        headY + 1.5,
        5.4,
        4.8,
        { r: 12, g: 16, b: 22 },
        null,
        0.8,
        0.05
      );
      const eyeColor = { r: 112, g: 235, b: 255 };
      setPixelWithNormal(albedo, normalMat, sheetW, sheetH, cx + facingX * 2 - 2.5, headY + 1, eyeColor, 1.4, 0, 0, 0.05, 0.98);
      setPixelWithNormal(albedo, normalMat, sheetW, sheetH, cx + facingX * 2 + 2.5, headY + 1, eyeColor, 1.4, 0, 0, 0.05, 0.98);
    }
  } else if (visualStyle === 'full_helm') {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 1.2,
      8.8,
      9.4,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );
    if (facingY > 0) {
      for (let vx = -4; vx <= 4; vx++) {
        setPixelWithNormal(
          albedo,
          normalMat,
          sheetW,
          sheetH,
          cx + facingX * 2 + vx,
          headY - 1,
          { r: 16, g: 20, b: 28 },
          1.0,
          0,
          0,
          0.1,
          0.9
        );
      }
    }
  } else {
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      cx,
      headY - 3.8,
      8.8,
      3.0,
      primaryColor,
      trimColor,
      roughness,
      metallic
    );
  }
}

const bufferCache = new Map<string, BakedCharacterBuffers>();

export interface CharacterSpriteSheetBuffer {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

const characterSheetMap = new Map<string, CharacterSpriteSheetBuffer>();

/**
 * Registers preloaded 256x768 8-directional isometric character and monster sprite sheets
 * (packed from Flare RPG CC-BY-SA 3.0 / CC-BY 3.0 assets) and flushes the bake cache.
 */
export function registerCharacterSpriteSheets(
  sheets: ReadonlyMap<string, CharacterSpriteSheetBuffer>
): void {
  characterSheetMap.clear();
  for (const [k, v] of sheets.entries()) {
    characterSheetMap.set(k, v);
  }
  bufferCache.clear();
}

export function hasLoadedCharacterSpriteSheets(): boolean {
  return characterSheetMap.size > 0;
}

/**
 * Blits a 64x96 frame from a registered 256x768 character layer sheet onto the target buffers
 * with optional color-grading tint and PBR roughness/metallic assignment.
 */
function blitCharacterSheetCell(
  sheet: CharacterSpriteSheetBuffer,
  albedoRGBA: Uint8ClampedArray,
  normalMaterialRGBA: Uint8ClampedArray,
  sheetW: number,
  dir: number,
  frame: number,
  tintColor: RGBAColor | null,
  tintStrength: number,
  roughness: number,
  metallic: number
): void {
  const cellW = 64;
  const cellH = 96;
  const ox = frame * cellW;
  const oy = dir * cellH;
  if (sheet.width < ox + cellW || sheet.height < oy + cellH) return;

  const roughByte = Math.min(255, Math.max(0, Math.round(roughness * 255)));
  const metalByte = Math.min(255, Math.max(0, Math.round(metallic * 255)));
  const src = sheet.rgba;

  for (let y = 0; y < cellH; y++) {
    const sy = oy + y;
    const rowOff = sy * sheetW;
    const srcRowOff = sy * sheet.width;
    for (let x = 0; x < cellW; x++) {
      const sx = ox + x;
      const sIdx = (srcRowOff + sx) * 4;
      const sa = src[sIdx + 3];
      if (sa < 12) continue;

      let sr = src[sIdx];
      let sg = src[sIdx + 1];
      let sb = src[sIdx + 2];

      if (tintColor && tintStrength > 0) {
        // Luminance-preserving color grading so 3D highlights & folds remain crisp
        const lum = (sr * 0.299 + sg * 0.587 + sb * 0.114) / 142;
        const tr = Math.min(255, tintColor.r * lum);
        const tg = Math.min(255, tintColor.g * lum);
        const tb = Math.min(255, tintColor.b * lum);
        sr = Math.round(sr * (1 - tintStrength) + tr * tintStrength);
        sg = Math.round(sg * (1 - tintStrength) + tg * tintStrength);
        sb = Math.round(sb * (1 - tintStrength) + tb * tintStrength);
      }

      const dIdx = (rowOff + sx) * 4;
      const alpha = sa / 255;
      const invA = 1 - alpha;
      const dstA = albedoRGBA[dIdx + 3] / 255;
      const outA = alpha + dstA * invA;

      if (dstA < 0.05 || alpha > 0.92) {
        albedoRGBA[dIdx] = Math.min(255, Math.max(0, sr));
        albedoRGBA[dIdx + 1] = Math.min(255, Math.max(0, sg));
        albedoRGBA[dIdx + 2] = Math.min(255, Math.max(0, sb));
        albedoRGBA[dIdx + 3] = Math.max(sa, albedoRGBA[dIdx + 3]);
      } else {
        albedoRGBA[dIdx] = Math.min(
          255,
          Math.round((sr * alpha + albedoRGBA[dIdx] * dstA * invA) / Math.max(0.01, outA))
        );
        albedoRGBA[dIdx + 1] = Math.min(
          255,
          Math.round((sg * alpha + albedoRGBA[dIdx + 1] * dstA * invA) / Math.max(0.01, outA))
        );
        albedoRGBA[dIdx + 2] = Math.min(
          255,
          Math.round((sb * alpha + albedoRGBA[dIdx + 2] * dstA * invA) / Math.max(0.01, outA))
        );
        albedoRGBA[dIdx + 3] = Math.min(255, Math.round(outA * 255));
      }

      normalMaterialRGBA[dIdx + 2] = roughByte;
      normalMaterialRGBA[dIdx + 3] = metalByte;
    }
  }
}

/**
 * Synthesizes tangent-space normal vectors (R=Nx, G=Ny) across all 8x4 cells
 * of a composited character sprite sheet using 3x3 Sobel luminance + cylindrical cell volume.
 */
function synthesizeSheetNormalVectors(
  albedoRGBA: Uint8ClampedArray,
  normalMaterialRGBA: Uint8ClampedArray,
  sheetW: number,
  sheetH: number
): void {
  const cellW = 64;
  const cellH = 96;
  const lumAt = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(sheetW - 1, x));
    const cy = Math.max(0, Math.min(sheetH - 1, y));
    const idx = (cy * sheetW + cx) * 4;
    const a = albedoRGBA[idx + 3] / 255;
    if (a < 0.04) return 0;
    return (
      ((albedoRGBA[idx] * 0.299 + albedoRGBA[idx + 1] * 0.587 + albedoRGBA[idx + 2] * 0.114) /
        255) *
      0.7 +
      a * 0.3
    );
  };

  for (let y = 0; y < sheetH; y++) {
    const localY = y % cellH;
    const volNy = (localY - 52) / 38;
    for (let x = 0; x < sheetW; x++) {
      const idx = (y * sheetW + x) * 4;
      if (albedoRGBA[idx + 3] < 12) continue;

      const localX = x % cellW;
      const volNx = (localX - 32) / 22;

      const tl = lumAt(x - 1, y - 1);
      const tc = lumAt(x, y - 1);
      const tr = lumAt(x + 1, y - 1);
      const ml = lumAt(x - 1, y);
      const mr = lumAt(x + 1, y);
      const bl = lumAt(x - 1, y + 1);
      const bc = lumAt(x, y + 1);
      const br = lumAt(x + 1, y + 1);

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

      let nx = -gx * 1.35 + volNx * 0.42;
      let ny = -gy * 1.35 + volNy * 0.36;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;

      normalMaterialRGBA[idx] = Math.min(255, Math.max(0, Math.round((nx * 0.5 + 0.5) * 255)));
      normalMaterialRGBA[idx + 1] = Math.min(255, Math.max(0, Math.round((ny * 0.5 + 0.5) * 255)));
    }
  }
}

/**
 * Renders a sculpted 8-directional quadruped wolf (Wilk Puszczański / Basior)
 * with 4 articulated legs, torso, hunched shoulders, pointed ears, snout, bushy tail, and glowing eyes.
 */
function bakeQuadrupedWolfSheet(
  recipe: CharacterVisualRecipe,
  albedoRGBA: Uint8ClampedArray,
  normalMaterialRGBA: Uint8ClampedArray,
  sheetWidth: number,
  sheetHeight: number
): void {
  const furBase: RGBAColor = {
    r: Math.max(54, Math.min(132, Math.round(recipe.skinTone.r * 0.52))),
    g: Math.max(50, Math.min(124, Math.round(recipe.skinTone.g * 0.5))),
    b: Math.max(46, Math.min(118, Math.round(recipe.skinTone.b * 0.48)))
  };
  const furDark: RGBAColor = {
    r: Math.max(28, Math.round(furBase.r * 0.62)),
    g: Math.max(26, Math.round(furBase.g * 0.62)),
    b: Math.max(24, Math.round(furBase.b * 0.65))
  };
  const furHighlight: RGBAColor = {
    r: Math.min(210, Math.round(furBase.r * 1.32)),
    g: Math.min(205, Math.round(furBase.g * 1.3)),
    b: Math.min(198, Math.round(furBase.b * 1.28))
  };

  for (let dir = 0; dir < 8; dir++) {
    // Isometric screen angle for Ulf direction `dir`:
    // dir 3 (SE) = towards camera (bottom); dir 7 (NW) = away (top); dir 1 (NE) = right; dir 5 (SW) = left
    const screenAngles = [
      -Math.PI * 0.25, // 0: N -> Top-Right
      0,               // 1: NE -> Right
      Math.PI * 0.25,  // 2: E -> Bottom-Right
      Math.PI * 0.5,   // 3: SE -> Down (towards camera)
      Math.PI * 0.75,  // 4: S -> Bottom-Left
      Math.PI,         // 5: SW -> Left
      -Math.PI * 0.75, // 6: W -> Top-Left
      -Math.PI * 0.5   // 7: NW -> Up (away from camera)
    ];
    const ang = screenAngles[dir];
    const fx = Math.cos(ang);
    const fy = Math.sin(ang);

    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * 64;
      const oy = dir * 96;
      const cx = ox + 32;
      const groundY = oy + 82;
      const phase = (frame / 4) * Math.PI * 2;
      const stride = frame === 0 ? 0 : Math.sin(phase) * 4.5;
      const bob = frame === 0 ? 0 : Math.abs(Math.cos(phase)) * 1.8;

      const bodyY = groundY - 22 - bob;
      const chestX = cx + fx * 8.5;
      const chestY = bodyY + fy * 4.2 - 1.5;
      const rumpX = cx - fx * 8.5;
      const rumpY = bodyY - fy * 4.2 + 1.0;

      // Bushy tail extending behind rump
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rumpX,
        rumpY,
        rumpX - fx * 9.5,
        rumpY + 8 - fy * 2.5,
        3.6,
        1.8,
        furDark,
        null,
        0.85,
        0.04
      );

      // 4 Quadruped Legs (hind pair + fore pair)
      const perpX = -fy * 3.8;
      const perpY = fx * 2.0;
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rumpX - perpX,
        rumpY + 2,
        rumpX - perpX - stride * 0.6,
        groundY - 2,
        3.2,
        1.8,
        furDark,
        null,
        0.82,
        0.04
      );
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rumpX + perpX,
        rumpY + 2,
        rumpX + perpX + stride * 0.6,
        groundY - 2,
        3.2,
        1.8,
        furBase,
        null,
        0.82,
        0.04
      );
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        chestX - perpX,
        chestY + 2,
        chestX - perpX + stride * 0.7,
        groundY - 1,
        3.4,
        1.9,
        furDark,
        null,
        0.82,
        0.04
      );
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        chestX + perpX,
        chestY + 2,
        chestX + perpX - stride * 0.7,
        groundY - 1,
        3.4,
        1.9,
        furBase,
        null,
        0.82,
        0.04
      );

      // Ribcage & spine barrel connecting rump to muscular chest/ruff
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rumpX,
        rumpY,
        chestX,
        chestY,
        7.2,
        8.8,
        furBase,
        furHighlight,
        0.78,
        0.05
      );

      // Thick neck & shoulder mane
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        chestX + fx * 2.2,
        chestY - 3.5,
        8.2,
        7.4,
        furHighlight,
        furDark,
        0.8,
        0.05
      );

      // Wolf Head, Pointed Ears & Snout
      const headX = chestX + fx * 7.2;
      const headY = chestY - 7.5 + fy * 2.2;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY,
        6.2,
        5.6,
        furBase,
        furDark,
        0.76,
        0.06
      );
      // Pointed ears
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX - 3.2,
        headY - 3,
        headX - 4.2,
        headY - 8.5,
        2.2,
        0.9,
        furDark,
        null,
        0.8,
        0.04
      );
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX + 3.2,
        headY - 3,
        headX + 4.2,
        headY - 8.5,
        2.2,
        0.9,
        furDark,
        null,
        0.8,
        0.04
      );
      // Elongated lupine snout
      const snoutX = headX + fx * 5.2;
      const snoutY = headY + 1.8 + fy * 2.0;
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        headX,
        headY + 1,
        snoutX,
        snoutY,
        3.8,
        2.1,
        furHighlight,
        furDark,
        0.72,
        0.08
      );

      // Glowing amber predator eyes when facing camera or side
      if (fy > -0.35) {
        const eyeColor: RGBAColor = { r: 255, g: 196, b: 36 };
        setPixelWithNormal(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          headX + fx * 2 - 2,
          headY - 1,
          eyeColor,
          1.3,
          0,
          0,
          0.05,
          0.95
        );
        setPixelWithNormal(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          headX + fx * 2 + 2,
          headY - 1,
          eyeColor,
          1.3,
          0,
          0,
          0.05,
          0.95
        );
      }
    }
  }
}

/**
 * Composites preloaded 8-directional Flare RPG character/monster sprite sheets
 * with modular equipment layers and Slavic details when available.
 */
function tryBakeFromLoadedCharacterSheets(
  recipe: CharacterVisualRecipe,
  layers: ResolvedCharacterLayers,
  albedoRGBA: Uint8ClampedArray,
  normalMaterialRGBA: Uint8ClampedArray,
  sheetWidth: number,
  sheetHeight: number
): boolean {
  if (characterSheetMap.size === 0) return false;

  const tag = resolveCharacterArchetypeTag(recipe);
  const getSheet = (name: string): CharacterSpriteSheetBuffer | undefined =>
    characterSheetMap.get(name);

  // 1. Dedicated Monster & NPC Archetype Sheets
  let singleArchetypeSheet: CharacterSpriteSheetBuffer | undefined;
  let singleTint: RGBAColor | null = null;
  let singleTintStrength = 0;
  let singleRoughness = 0.65;
  let singleMetallic = 0.18;

  if (tag === 'skeleton') {
    singleArchetypeSheet = getSheet('enemy_skeleton');
    const isWarden = (recipe.id || '').toLowerCase().includes('vault_warden');
    singleTint = isWarden ? { r: 235, g: 195, b: 120 } : null;
    singleTintStrength = isWarden ? 0.28 : 0;
    singleRoughness = 0.45;
    singleMetallic = 0.42;
  } else if (tag === 'utopiec') {
    singleArchetypeSheet = getSheet('enemy_zombie');
    singleTint = { r: 74, g: 168, b: 146 };
    singleTintStrength = 0.48;
    singleRoughness = 0.28;
    singleMetallic = 0.35;
  } else if (tag === 'goblin') {
    singleArchetypeSheet = getSheet('enemy_goblin');
    singleRoughness = 0.58;
    singleMetallic = 0.22;
  } else if (tag === 'wraith') {
    singleArchetypeSheet = getSheet('enemy_zombie');
    singleTint = { r: 164, g: 148, b: 214 };
    singleTintStrength = 0.45;
    singleRoughness = 0.38;
    singleMetallic = 0.48;
  } else if (tag === 'poludnica') {
    singleArchetypeSheet = getSheet('npc_peasant_woman');
    singleTint = { r: 248, g: 242, b: 220 };
    singleTintStrength = 0.55;
    singleRoughness = 0.55;
    singleMetallic = 0.25;
  } else if (tag === 'peasant_woman') {
    singleArchetypeSheet = getSheet('npc_peasant_woman');
    singleRoughness = 0.72;
    singleMetallic = 0.08;
  } else if (tag === 'peasant_man') {
    singleArchetypeSheet = getSheet('npc_peasant_man');
    singleRoughness = 0.72;
    singleMetallic = 0.08;
  } else if (tag === 'trader') {
    singleArchetypeSheet = getSheet('npc_trader');
    singleRoughness = 0.65;
    singleMetallic = 0.14;
  } else if (tag === 'noble') {
    singleArchetypeSheet = getSheet('npc_noble');
    singleRoughness = 0.55;
    singleMetallic = 0.24;
  }

  if (singleArchetypeSheet) {
    for (let dir = 0; dir < 8; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        blitCharacterSheetCell(
          singleArchetypeSheet,
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          dir,
          frame,
          singleTint,
          singleTintStrength,
          singleRoughness,
          singleMetallic
        );
      }
    }
    synthesizeSheetNormalVectors(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight);
    return true;
  }

  // 2. Modular Humanoid / Leszy / Bies Compositor
  const torsoId = layers.torsoItem.id;
  let armorSheetName = 'armor_brigandine';
  let armorTintStrength = 0.22;

  if (tag === 'leszy') {
    armorSheetName = 'armor_robes';
    armorTintStrength = 0.52;
  } else if (tag === 'bies') {
    armorSheetName = 'body_male';
    armorTintStrength = 0.58;
  } else if (torsoId === 'torso_aethel_plate') {
    armorSheetName = 'armor_plate';
    armorTintStrength = 0.14;
  } else if (torsoId === 'torso_slavic_lamellar') {
    armorSheetName = 'armor_chain';
    armorTintStrength = 0.22;
  } else if (torsoId === 'torso_archmage_robes') {
    armorSheetName = 'armor_robes';
    armorTintStrength = 0.24;
  } else if (torsoId === 'torso_linen_tunic' || torsoId === 'torso_slavic_giezlo') {
    armorSheetName = 'armor_tunic';
    armorTintStrength = torsoId === 'torso_slavic_giezlo' ? 0.36 : 0.2;
  } else {
    armorSheetName = 'armor_brigandine';
    armorTintStrength = 0.2;
  }

  const armorSheet = getSheet(armorSheetName) ?? getSheet('body_male');
  if (!armorSheet) return false;

  const armorTint: RGBAColor =
    tag === 'leszy'
      ? { r: 84, g: 108, b: 62 }
      : tag === 'bies'
        ? { r: 124, g: 42, b: 38 }
        : layers.torsoItem.primaryColor;

  // Resolve Head / Helmet Sheet
  let headSheet: CharacterSpriteSheetBuffer | undefined;
  let headTint: RGBAColor | null = null;
  let headTintStrength = 0;
  let headRoughness = 0.65;
  let headMetallic = 0.12;

  if (layers.headItem) {
    const hid = layers.headItem.id;
    headRoughness = layers.headItem.roughness;
    headMetallic = layers.headItem.metallic;
    if (hid === 'helm_dread_plate') {
      headSheet = getSheet('head_helm');
      headTint = layers.headItem.primaryColor;
      headTintStrength = 0.18;
    } else if (hid === 'helm_szyszak') {
      headSheet = getSheet('head_coif');
      headTint = layers.headItem.primaryColor;
      headTintStrength = 0.28;
    } else if (hid === 'helm_shadow_hood' || hid === 'helm_ranger_cowl') {
      headSheet = getSheet('head_hood');
      headTint = layers.headItem.primaryColor;
      headTintStrength = 0.32;
    } else if (hid === 'helm_klobuk') {
      headSheet = getSheet('head_mage_hood');
      headTint = layers.headItem.primaryColor;
      headTintStrength = 0.35;
    } else {
      headSheet = getSheet('head_hair');
      headTint = recipe.hairColor;
      headTintStrength = 0.38;
    }
  } else if (recipe.hairStyle === 'none' || recipe.hairStyle === 'tonsure') {
    headSheet = getSheet('head_bald');
    headTint = recipe.skinTone;
    headTintStrength = 0.18;
  } else {
    headSheet = getSheet('head_hair');
    headTint = recipe.hairColor;
    headTintStrength = 0.42;
  }

  // Resolve Main-Hand Weapon Sheet
  let weaponSheet: CharacterSpriteSheetBuffer | undefined;
  let weaponTint: RGBAColor | null = null;
  let weaponTintStrength = 0;
  let weaponRoughness = 0.22;
  let weaponMetallic = 0.88;

  if (tag === 'leszy') {
    weaponSheet = getSheet('weapon_staff');
  } else if (tag === 'bies') {
    weaponSheet = getSheet('weapon_axe');
  } else if (layers.mainHandItem) {
    const vs = layers.mainHandItem.visualStyle;
    weaponRoughness = layers.mainHandItem.roughness;
    weaponMetallic = layers.mainHandItem.metallic;
    weaponTint = layers.mainHandItem.primaryColor;
    weaponTintStrength = 0.18;
    if (vs === 'bow') {
      weaponSheet = getSheet('weapon_bow');
    } else if (vs === 'battleaxe') {
      weaponSheet = getSheet('weapon_axe');
    } else if (vs === 'runestaff') {
      weaponSheet = getSheet('weapon_staff');
    } else {
      weaponSheet = getSheet('weapon_longsword');
    }
  }

  // Resolve Off-Hand Shield Sheet
  let offhandSheet: CharacterSpriteSheetBuffer | undefined;
  let offhandTint: RGBAColor | null = null;
  let offhandTintStrength = 0;
  let offhandRoughness = 0.45;
  let offhandMetallic = 0.55;

  if (layers.offHandItem && layers.offHandItem.visualStyle === 'kiteshield') {
    offhandRoughness = layers.offHandItem.roughness;
    offhandMetallic = layers.offHandItem.metallic;
    offhandTint = layers.offHandItem.primaryColor;
    if (layers.offHandItem.id === 'offhand_slavic_shield') {
      offhandSheet = getSheet('offhand_buckler');
      offhandTintStrength = 0.32;
    } else {
      offhandSheet = getSheet('offhand_kite_shield') ?? getSheet('offhand_shield');
      offhandTintStrength = 0.22;
    }
  }

  for (let dir = 0; dir < 8; dir++) {
    const flareDir = (dir + 3) % 8;
    const angle = (dir / 8) * Math.PI * 2;
    const facingX = Math.sin(angle);
    const facingY = -Math.cos(angle);

    for (let frame = 0; frame < 4; frame++) {
      const ox = frame * 64;
      const oy = dir * 96;
      const cx = ox + 32;
      const groundY = oy + 82;
      const stridePhase = (frame / 4) * Math.PI * 2;
      const legSwing = frame === 0 ? 0 : Math.sin(stridePhase) * 4.0;
      const bobY = frame === 0 ? 0 : Math.abs(Math.cos(stridePhase)) * 1.8;

      const drawArmor = (): void => {
        blitCharacterSheetCell(
          armorSheet,
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          dir,
          frame,
          armorTint,
          armorTintStrength,
          layers.torsoItem.roughness,
          layers.torsoItem.metallic
        );
      };

      const drawHead = (): void => {
        if (headSheet) {
          blitCharacterSheetCell(
            headSheet,
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            dir,
            frame,
            headTint,
            headTintStrength,
            headRoughness,
            headMetallic
          );
        }
        // Procedural Slavic / Mythic headgear overlays (antlers, ram horns, elder beard)
        const headY = groundY - 56 - bobY;
        if (tag === 'leszy' || layers.headItem?.id === 'helm_druid_antlers') {
          drawDetailedHelm(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            headY,
            facingX,
            facingY,
            EQUIPMENT_CATALOG.helm_druid_antlers
          );
        } else if (tag === 'bies') {
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx - 4,
            headY - 3,
            cx - 12,
            headY - 12,
            2.6,
            1.0,
            { r: 38, g: 32, b: 28 },
            null,
            0.55,
            0.25
          );
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx + 4,
            headY - 3,
            cx + 12,
            headY - 12,
            2.6,
            1.0,
            { r: 38, g: 32, b: 28 },
            null,
            0.55,
            0.25
          );
        }
      };

      const drawWeapon = (): void => {
        if (weaponSheet) {
          blitCharacterSheetCell(
            weaponSheet,
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            dir,
            frame,
            weaponTint,
            weaponTintStrength,
            weaponRoughness,
            weaponMetallic
          );
        }
      };

      const drawOffhand = (): void => {
        if (offhandSheet) {
          blitCharacterSheetCell(
            offhandSheet,
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            dir,
            frame,
            offhandTint,
            offhandTintStrength,
            offhandRoughness,
            offhandMetallic
          );
        } else if (layers.offHandItem?.visualStyle === 'torch') {
          const offHandX = cx - 10 - facingX * 1.5;
          const offHandY = groundY - 35 - bobY - legSwing * 0.25;
          drawDetailedTorch(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offHandX,
            offHandY,
            frame,
            layers.offHandItem.primaryColor
          );
        } else if (layers.offHandItem?.visualStyle === 'tome') {
          const offHandX = cx - 10 - facingX * 1.5;
          const offHandY = groundY - 35 - bobY - legSwing * 0.25;
          drawDetailedGrimoire(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offHandX,
            offHandY,
            layers.offHandItem.primaryColor,
            layers.offHandItem.trimColor
          );
        }
      };

      // Follow Flare's hero_layers.txt per-direction draw order:
      if (flareDir === 0 || flareDir === 1 || flareDir === 7) {
        drawWeapon();
        drawArmor();
        drawOffhand();
        drawHead();
      } else if (flareDir === 2 || flareDir === 3 || flareDir === 4) {
        drawArmor();
        drawOffhand();
        drawHead();
        drawWeapon();
      } else if (flareDir === 5) {
        drawArmor();
        drawWeapon();
        drawHead();
        drawOffhand();
      } else {
        drawWeapon();
        drawArmor();
        drawHead();
        drawOffhand();
      }
    }
  }

  synthesizeSheetNormalVectors(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight);
  return true;
}

/**
 * Bakes a complete 8-directional x 4-animation-frame character sprite sheet
 * into both an Albedo RGBA buffer and a Normal+Material RGBA buffer with articulated heroic anatomy.
 */
export function bakeCharacterBuffers(recipe: CharacterVisualRecipe): BakedCharacterBuffers {
  const hash = computeCharacterRecipeHash(recipe);
  const cached = bufferCache.get(hash);
  if (cached) return cached;

  const layers = resolveEffectiveCharacterLayers(recipe);
  const frameWidth = 64;
  const frameHeight = 96;
  const directions = 8;
  const framesPerDirection = 4;
  const sheetWidth = frameWidth * framesPerDirection;
  const sheetHeight = frameHeight * directions;

  const albedoRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(sheetWidth * sheetHeight * 4);

  const archetypeTag = resolveCharacterArchetypeTag(recipe);
  if (archetypeTag === 'wilk') {
    bakeQuadrupedWolfSheet(recipe, albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight);
    const wolfResult: BakedCharacterBuffers = {
      recipeHash: hash,
      frameWidth,
      frameHeight,
      directions,
      framesPerDirection,
      sheetWidth,
      sheetHeight,
      albedoRGBA,
      normalMaterialRGBA
    };
    bufferCache.set(hash, wolfResult);
    return wolfResult;
  }

  if (
    tryBakeFromLoadedCharacterSheets(
      recipe,
      layers,
      albedoRGBA,
      normalMaterialRGBA,
      sheetWidth,
      sheetHeight
    )
  ) {
    const spriteResult: BakedCharacterBuffers = {
      recipeHash: hash,
      frameWidth,
      frameHeight,
      directions,
      framesPerDirection,
      sheetWidth,
      sheetHeight,
      albedoRGBA,
      normalMaterialRGBA
    };
    bufferCache.set(hash, spriteResult);
    return spriteResult;
  }

  for (let dir = 0; dir < directions; dir++) {
    const angle = (dir / 8) * Math.PI * 2;
    const facingX = Math.sin(angle);
    const facingY = -Math.cos(angle); // +1 = facing camera (South, dir=4), -1 = facing away (North, dir=0)

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 84;

      const stridePhase = (frame / framesPerDirection) * Math.PI * 2;
      const legSwing = frame === 0 ? 0 : Math.sin(stridePhase) * 5.0;
      const bobY = frame === 0 ? 0 : Math.abs(Math.cos(stridePhase)) * 2.2;

      // Hand & Arm Coordinates
      const shoulderLeftX = cx - 11.5;
      const shoulderRightX = cx + 11.5;
      const shoulderY = groundY - 47 - bobY;

      const mainHandX = cx + 12 + facingX * 2.5;
      const mainHandY = groundY - 35 - bobY + legSwing * 0.25;

      const offHandX = cx - 12 - facingX * 1.5;
      const offHandY = groundY - 35 - bobY - legSwing * 0.25;

      const drawCloakFirst = facingY >= -0.15;

      const renderCloakOrQuiver = (): void => {
        if (!layers.cloakItem) return;
        const { visualStyle, primaryColor, trimColor, roughness, metallic } = layers.cloakItem;

        if (visualStyle === 'quiver') {
          // Ranger leather quiver across back with protruding arrows
          const quiverX = cx - facingX * 2.5;
          const quiverY = groundY - 42 - bobY;

          // Cross-torso baldric strap
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx - 9,
            groundY - 46 - bobY,
            cx + 8,
            groundY - 28 - bobY,
            2.2,
            2.0,
            primaryColor,
            trimColor,
            0.65,
            0.2
          );

          // Cylindrical leather quiver
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            quiverX - 3,
            quiverY - 10,
            quiverX + 4,
            quiverY + 8,
            3.6,
            3.0,
            primaryColor,
            trimColor,
            roughness,
            metallic
          );

          // 4 wooden arrows protruding with goose feather fletchings (lotki)
          const fletchColors: RGBAColor[] = [
            { r: 240, g: 244, b: 248 },
            { r: 188, g: 42, b: 36 },
            { r: 240, g: 244, b: 248 },
            { r: 188, g: 42, b: 36 }
          ];
          for (let ai = 0; ai < 4; ai++) {
            const ax = quiverX - 5 + ai * 2.2;
            const ay = quiverY - 14 - ai * 1.5;
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              ax,
              ay + 2,
              { r: 168, g: 124, b: 78 },
              0.9,
              0,
              0,
              0.7,
              0.1
            );
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              ax,
              ay,
              fletchColors[ai],
              1.1,
              0,
              0,
              0.5,
              0.1
            );
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              ax + 1,
              ay - 1,
              fletchColors[ai],
              1.2,
              0,
              0,
              0.5,
              0.1
            );
          }
        } else {
          // Flowing pleated cape with dynamic stride waves and golden/fur hem
          for (let row = 0; row <= 28; row++) {
            const t = row / 28;
            const flare = 8.5 + t * 8.5;
            const wave = Math.sin(t * 5.2 + stridePhase) * 1.8;
            drawShadedEllipse(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              cx - facingX * 3.8 + wave,
              groundY - 48 - bobY + row,
              flare,
              2.6,
              primaryColor,
              row > 23 ? trimColor : null,
              roughness,
              metallic
            );
          }

          // Brooch clasp at collarbones
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            groundY - 48 - bobY,
            2.8,
            2.2,
            trimColor,
            null,
            0.18,
            0.94
          );
        }
      };

      if (drawCloakFirst) renderCloakOrQuiver();

      // 1. Articulated Legs, Knee-Cops & Boots
      const leftHipX = cx - 5 + facingX * 1.8;
      const rightHipX = cx + 5 + facingX * 1.8;
      const leftFootX = leftHipX - legSwing * 0.45;
      const leftFootY = groundY - 4 + legSwing * 0.55;
      const rightFootX = rightHipX + legSwing * 0.45;
      const rightFootY = groundY - 4 - legSwing * 0.55;

      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        leftHipX,
        groundY - 27 - bobY,
        leftFootX,
        leftFootY,
        4.6,
        3.2,
        layers.legsItem.primaryColor,
        layers.legsItem.trimColor,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );
      drawTaperedLimb(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rightHipX,
        groundY - 27 - bobY,
        rightFootX,
        rightFootY,
        4.6,
        3.2,
        layers.legsItem.primaryColor,
        layers.legsItem.trimColor,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );

      // Boots & Sabatons
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        leftFootX + facingX * 1.5,
        leftFootY,
        4.4,
        3.0,
        layers.legsItem.trimColor,
        null,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rightFootX + facingX * 1.5,
        rightFootY,
        4.4,
        3.0,
        layers.legsItem.trimColor,
        null,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );

      // 2. Skirt / Tassets / Robes / Tunic Hem
      const isRobes = layers.torsoItem.visualStyle === 'robes';
      const isPlateOrBrig =
        layers.torsoItem.visualStyle === 'plate' ||
        layers.torsoItem.visualStyle === 'brigandine';

      if (isRobes) {
        // Draped flared robe skirt down to ankles with mystical runic hem
        for (let ry = 0; ry <= 22; ry++) {
          const t = ry / 22;
          const rFlare = 8.5 + t * 6.5;
          const rColor = ry > 18 ? layers.torsoItem.trimColor : layers.torsoItem.primaryColor;
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx + legSwing * 0.15 * t,
            groundY - 26 - bobY + ry,
            rFlare,
            2.0,
            rColor,
            ry > 19 ? { r: 124, g: 228, b: 255 } : null,
            layers.torsoItem.roughness,
            layers.torsoItem.metallic
          );
        }
      } else if (isPlateOrBrig) {
        // Articulated chainmail hauberk / plate tassets covering upper thighs
        for (let ty = 0; ty <= 8; ty++) {
          const tColor = ty > 6 ? layers.torsoItem.trimColor : { r: 88, g: 96, b: 108 };
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            groundY - 26 - bobY + ty,
            9.8 + ty * 0.35,
            2.0,
            tColor,
            ty === 8 ? layers.torsoItem.trimColor : null,
            0.32,
            0.85
          );
        }
      } else {
        // Slavic linen tunic / giezlo hem with red woven krajka border
        for (let ty = 0; ty <= 7; ty++) {
          const tColor = ty > 4 ? { r: 198, g: 36, b: 36 } : layers.torsoItem.primaryColor;
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            groundY - 26 - bobY + ty,
            9.2 + ty * 0.4,
            2.0,
            tColor,
            ty > 5 ? { r: 248, g: 244, b: 236 } : null,
            0.85,
            0.02
          );
        }
      }

      // 3. Sculpted Heroic Torso / Cuirass
      const torsoHeight = isRobes ? 23 : 17;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        groundY - 37 - bobY,
        11.5,
        torsoHeight,
        layers.torsoItem.primaryColor,
        layers.torsoItem.trimColor,
        layers.torsoItem.roughness,
        layers.torsoItem.metallic
      );

      // Waist Belt & Buckle
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        groundY - 27 - bobY,
        10.8,
        2.8,
        { r: 52, g: 36, b: 26 },
        layers.torsoItem.trimColor,
        0.4,
        0.75
      );
      if (facingY > -0.2) {
        // Center bronze buckle
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + facingX * 2.2,
          groundY - 27 - bobY,
          2.6,
          2.2,
          { r: 218, g: 172, b: 74 },
          null,
          0.18,
          0.94
        );
        // Chest emblem (Swaróg Kolowrót / Griffin)
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + facingX * 2.5,
          groundY - 41 - bobY,
          3.8,
          4.2,
          layers.torsoItem.trimColor,
          null,
          0.18,
          0.92,
          false
        );
      }

      // Adventurer's Leather Side Pouch & Crystal Potion Flask
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx - 8.5 + facingX * 1.5,
        groundY - 25 - bobY,
        3.2,
        3.6,
        { r: 68, g: 46, b: 32 },
        { r: 212, g: 172, b: 84 },
        0.55,
        0.2
      );
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx + 8.5 + facingX * 1.5,
        groundY - 25 - bobY,
        2.4,
        3.2,
        { r: 224, g: 42, b: 48 },
        { r: 255, g: 240, b: 240 },
        0.05,
        0.95,
        false
      );

      // Slavic folk krajka embroidery (crimson-and-white geometric sash & placket)
      const isSlavicTorso =
        layers.torsoItem.id === 'torso_slavic_giezlo' ||
        layers.torsoItem.id === 'torso_przeszywanica' ||
        layers.torsoItem.id === 'torso_slavic_lamellar';
      if (isSlavicTorso && facingY > -0.2) {
        for (let py = -8; py <= 4; py++) {
          const krajkaColor =
            py % 2 === 0 ? layers.torsoItem.trimColor : { r: 248, g: 244, b: 236 };
          setPixelWithNormal(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx + facingX * 2,
            groundY - 42 - bobY + py,
            krajkaColor,
            1.0,
            0,
            0,
            0.85,
            0.02
          );
        }
      }

      // 4. Articulated Arms Connecting Shoulders to Hands with Vambraces
      const sleeveColor = layers.torsoItem.primaryColor;
      const vambraceColor = isPlateOrBrig
        ? layers.torsoItem.trimColor
        : { r: 84, g: 58, b: 42 };

      drawArticulatedArm(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderLeftX,
        shoulderY,
        offHandX,
        offHandY,
        true,
        facingX,
        recipe.skinTone,
        sleeveColor,
        vambraceColor,
        layers.torsoItem.roughness,
        layers.torsoItem.metallic
      );

      drawArticulatedArm(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderRightX,
        shoulderY,
        mainHandX,
        mainHandY,
        false,
        facingX,
        recipe.skinTone,
        sleeveColor,
        vambraceColor,
        layers.torsoItem.roughness,
        layers.torsoItem.metallic
      );

      // 5. Layered Multi-Tiered Shoulder Pauldrons
      const pauldronColor = layers.cloakItem?.trimColor ?? layers.torsoItem.trimColor;
      const pauldronTrim = layers.torsoItem.primaryColor;
      const hasFurMantle = layers.cloakItem?.visualStyle === 'pauldrons';

      drawLayeredPauldron(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderLeftX,
        shoulderY,
        true,
        pauldronColor,
        pauldronTrim,
        hasFurMantle,
        0.24,
        0.86
      );
      drawLayeredPauldron(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        shoulderRightX,
        shoulderY,
        false,
        pauldronColor,
        pauldronTrim,
        hasFurMantle,
        0.24,
        0.86
      );

      if (!drawCloakFirst) renderCloakOrQuiver();

      // 6. Neck & Head
      const headY = groundY - 58 - bobY;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        headY + 7,
        4.2,
        3.5,
        recipe.skinTone,
        null,
        0.7,
        0.05
      );
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        headY,
        7.8,
        8.8,
        recipe.skinTone,
        null,
        0.62,
        0.05
      );

      // Hair Layer
      if (layers.showHair) {
        const crestBoost = recipe.hairStyle === 'noble_crest' ? 2.5 : 0;
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx - facingX * 1.2,
          headY - 3.2 - crestBoost * 0.5,
          8.5,
          6.8 + crestBoost,
          recipe.hairColor,
          null,
          0.72,
          0.08
        );

        if (recipe.hairStyle === 'slavic_parted') {
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx - facingX * 1.2,
            headY - 2.8,
            8.8,
            6.5,
            recipe.hairColor,
            null,
            0.76,
            0.08
          );
        }

        if (recipe.hairStyle === 'wreath_braids') {
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx - 6,
            headY + 3,
            cx - 6 + facingX * 1.5,
            headY + 15,
            2.5,
            1.5,
            recipe.hairColor,
            null,
            0.78,
            0.06
          );
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx + 6,
            headY + 3,
            cx + 6 + facingX * 1.5,
            headY + 15,
            2.5,
            1.5,
            recipe.hairColor,
            null,
            0.78,
            0.06
          );

          const wreathRadius = 7.5;
          const flowerPalette: RGBAColor[] = [
            { r: 235, g: 60, b: 60 },
            { r: 245, g: 215, b: 50 },
            { r: 65, g: 140, b: 245 },
            { r: 70, g: 160, b: 70 }
          ];
          for (let wa = 0; wa < Math.PI * 2; wa += 0.45) {
            const wx = cx + Math.cos(wa) * wreathRadius;
            const wy = headY - 4 + Math.sin(wa) * 3.0;
            const fColor =
              flowerPalette[
                Math.floor(Math.abs(Math.sin(wa * 3.5)) * flowerPalette.length) % flowerPalette.length
              ];
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              wx,
              wy,
              fColor,
              1.0,
              0,
              0,
              0.65,
              0.05
            );
          }
        }
      }

      // Helmet / Headgear
      if (layers.headItem) {
        drawDetailedHelm(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx,
          headY,
          facingX,
          facingY,
          layers.headItem
        );
      }

      // Facial Features (Crisp Sclera, Iris, Eyebrows, Mustache, Beard)
      if (facingY > -0.05 && layers.headItem?.visualStyle !== 'full_helm') {
        const eyeOffsetX = facingX * 2.8;

        // Eyebrows
        const browColor = recipe.hairColor;
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX - 3, headY - 3, browColor, 0.9, 0, 0, 0.7, 0.1);
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX - 2, headY - 3, browColor, 0.9, 0, 0, 0.7, 0.1);
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX + 2, headY - 3, browColor, 0.9, 0, 0, 0.7, 0.1);
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX + 3, headY - 3, browColor, 0.9, 0, 0, 0.7, 0.1);

        // Eyes: White sclera with dark iris/pupil
        const eyeWhite: RGBAColor = { r: 242, g: 242, b: 246 };
        const irisColor: RGBAColor = { r: 24, g: 30, b: 42 };

        // Left eye
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX - 3, headY - 1, eyeWhite, 1.0, 0, 0, 0.3, 0.1);
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX - 2, headY - 1, irisColor, 1.0, 0, 0, 0.1, 0.2);

        // Right eye
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX + 2, headY - 1, irisColor, 1.0, 0, 0, 0.1, 0.2);
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX + 3, headY - 1, eyeWhite, 1.0, 0, 0, 0.3, 0.1);

        // Nose bridge
        setPixelWithNormal(albedoRGBA, normalMaterialRGBA, sheetWidth, sheetHeight, cx + eyeOffsetX, headY + 1, recipe.skinTone, 0.85, 0, 0, 0.6, 0.05);

        // Slavic mustache (wąsy)
        if (recipe.hairStyle === 'slavic_parted' || recipe.hairStyle === 'elder_beard' || recipe.hairStyle === 'noble_crest') {
          for (let wx = -4; wx <= 4; wx++) {
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              cx + eyeOffsetX + wx,
              headY + 3 + Math.abs(wx) * 0.35,
              recipe.hairColor,
              1.0,
              0,
              0,
              0.8,
              0.05
            );
          }
        }

        // Patriarchal flowing beard for Żercy & Elder characters
        if (recipe.hairStyle === 'elder_beard') {
          for (let by = 0; by <= 12; by++) {
            const bt = by / 12;
            const bWidth = Math.max(1.8, 5.4 * (1.0 - bt * 0.62));
            drawShadedEllipse(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              cx + facingX * 2.6,
              headY + 5 + by,
              bWidth,
              1.8,
              recipe.hairColor,
              null,
              0.85,
              0.05
            );
          }
        }
      }

      // 7. Main Hand Weapon
      if (layers.mainHandItem) {
        const { visualStyle, primaryColor, trimColor } = layers.mainHandItem;
        const tipX = mainHandX + 7 + facingX * 4;
        const tipY = mainHandY - 26;

        if (visualStyle === 'bow') {
          drawDetailedBow(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            mainHandX,
            mainHandY,
            facingX,
            primaryColor,
            trimColor
          );
        } else if (visualStyle === 'battleaxe') {
          drawDetailedAxe(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            mainHandX,
            mainHandY,
            tipX,
            tipY,
            trimColor,
            primaryColor,
            { r: 218, g: 174, b: 84 }
          );
        } else if (visualStyle === 'runestaff') {
          drawDetailedStaff(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            mainHandX,
            mainHandY,
            tipX,
            tipY,
            primaryColor,
            trimColor
          );
        } else {
          // Longsword
          drawDetailedBlade(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            mainHandX,
            mainHandY,
            tipX,
            tipY,
            primaryColor,
            trimColor
          );
        }
      }

      // 8. Off-Hand Shield / Torch / Tome
      if (layers.offHandItem) {
        const { visualStyle, primaryColor, trimColor, roughness, metallic } = layers.offHandItem;

        if (visualStyle === 'torch') {
          drawDetailedTorch(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offHandX,
            offHandY,
            frame,
            primaryColor
          );
        } else if (visualStyle === 'tome') {
          drawDetailedGrimoire(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offHandX,
            offHandY,
            primaryColor,
            trimColor
          );
        } else {
          // Slavic or Heraldic Shield
          drawDetailedShield(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offHandX,
            offHandY,
            layers.offHandItem.id,
            primaryColor,
            trimColor,
            roughness,
            metallic
          );
        }
      }
    }
  }

  const result: BakedCharacterBuffers = {
    recipeHash: hash,
    frameWidth,
    frameHeight,
    directions,
    framesPerDirection,
    sheetWidth,
    sheetHeight,
    albedoRGBA,
    normalMaterialRGBA
  };

  bufferCache.set(hash, result);
  return result;
}
