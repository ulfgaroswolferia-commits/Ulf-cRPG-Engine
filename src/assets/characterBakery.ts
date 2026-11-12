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

export function computeCharacterRecipeHash(recipe: CharacterVisualRecipe): string {
  const { skinTone, hairColor, hairStyle, equipment } = recipe;
  return [
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
