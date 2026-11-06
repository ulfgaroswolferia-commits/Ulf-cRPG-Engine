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

export function generateRandomCharacterRecipe(seed: number, customId?: string): CharacterVisualRecipe {
  const rng = mulberry32(seed);
  const pick = <T>(arr: ReadonlyArray<T>): T => arr[Math.floor(rng() * arr.length)];

  const torsos = ['torso_warden_brigandine', 'torso_aethel_plate', 'torso_archmage_robes', 'torso_linen_tunic'];
  const heads: Array<string | null> = [null, 'helm_dread_plate', 'helm_shadow_hood', 'helm_arcane_circlet'];
  const cloaks: Array<string | null> = [null, 'cloak_crimson_mantle', 'cloak_steel_pauldrons'];
  const legs = ['legs_steel_greaves', 'legs_leather_boots'];
  const weapons: Array<string | null> = [
    'weapon_sunblade_longsword',
    'weapon_Executioner_axe',
    'weapon_astral_staff'
  ];
  const offhands: Array<string | null> = [
    null,
    'offhand_heraldic_shield',
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

  // Encode tangent-space normal (-1..1 -> 0..255) + roughness + metallic
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
  metallic: number
): void {
  const minX = Math.floor(cx - rx);
  const maxX = Math.ceil(cx + rx);
  const minY = Math.floor(cy - ry);
  const maxY = Math.ceil(cy + ry);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / Math.max(1, rx);
      const dy = (y - cy) / Math.max(1, ry);
      const distSq = dx * dx + dy * dy;
      if (distSq <= 1.0) {
        const isBorder = trimColor !== null && distSq > 0.72;
        const activeColor = isBorder && trimColor ? trimColor : color;
        const nz = Math.sqrt(Math.max(0.05, 1.0 - distSq));
        // Isometric rim & top-left zenith shading baked subtly into albedo + clean normal vector
        const shade = 0.72 + 0.34 * nz - 0.12 * dy;
        setPixelWithNormal(
          albedo,
          normalMat,
          sheetW,
          sheetH,
          x,
          y,
          activeColor,
          shade,
          dx * 0.85,
          dy * 0.85,
          roughness,
          metallic
        );
      }
    }
  }
}

function drawShadedSegment(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  sheetW: number,
  sheetH: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  color: RGBAColor,
  roughness: number,
  metallic: number
): void {
  const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    drawShadedEllipse(
      albedo,
      normalMat,
      sheetW,
      sheetH,
      px,
      py,
      radius,
      radius,
      color,
      null,
      roughness,
      metallic
    );
  }
}

const bufferCache = new Map<string, BakedCharacterBuffers>();

/**
 * Bakes a complete 8-directional x 4-animation-frame character sprite sheet
 * into both an Albedo RGBA buffer and a Normal+Material RGBA buffer.
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
    // Direction angle around character (0=N/Back-Right, 2=E, 4=S/Front, 6=W)
    const angle = (dir / 8) * Math.PI * 2;
    const facingX = Math.sin(angle);
    const facingY = Math.cos(angle); // +1 = facing camera (South), -1 = facing away (North)

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 82;

      const stridePhase = (frame / framesPerDirection) * Math.PI * 2;
      const legSwing = frame === 0 ? 0 : Math.sin(stridePhase) * 4.5;
      const bobY = frame === 0 ? 0 : Math.abs(Math.cos(stridePhase)) * 2.0;

      const drawCloakFirst = facingY >= 0; // If facing camera, cloak is behind torso

      const renderCloak = (): void => {
        if (!layers.cloakItem) return;
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx - facingX * 3,
          groundY - 34 - bobY,
          12,
          20,
          layers.cloakItem.primaryColor,
          layers.cloakItem.trimColor,
          layers.cloakItem.roughness,
          layers.cloakItem.metallic
        );
      };

      if (drawCloakFirst) renderCloak();

      // Legs & Boots
      const leftLegX = cx - 5 + facingX * 2;
      const rightLegX = cx + 5 + facingX * 2;
      drawShadedSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        leftLegX,
        groundY - 24 - bobY,
        leftLegX - legSwing * 0.4,
        groundY - 4 + legSwing * 0.5,
        3.6,
        layers.legsItem.primaryColor,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );
      drawShadedSegment(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        rightLegX,
        groundY - 24 - bobY,
        rightLegX + legSwing * 0.4,
        groundY - 4 - legSwing * 0.5,
        3.6,
        layers.legsItem.primaryColor,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );

      // Torso / Cuirass / Robes
      const torsoHeight = layers.torsoItem.visualStyle === 'robes' ? 21 : 16;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        groundY - 35 - bobY,
        10.5,
        torsoHeight,
        layers.torsoItem.primaryColor,
        layers.torsoItem.trimColor,
        layers.torsoItem.roughness,
        layers.torsoItem.metallic
      );

      // Shoulder Pauldrons
      if (layers.cloakItem || layers.torsoItem.visualStyle === 'plate') {
        const pauldronColor = layers.cloakItem?.trimColor ?? layers.torsoItem.trimColor;
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx - 10,
          groundY - 46 - bobY,
          5,
          4.5,
          pauldronColor,
          null,
          0.25,
          0.85
        );
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + 10,
          groundY - 46 - bobY,
          5,
          4.5,
          pauldronColor,
          null,
          0.25,
          0.85
        );
      }

      if (!drawCloakFirst) renderCloak();

      // Head & Skin
      const headY = groundY - 56 - bobY;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        headY,
        7.5,
        8.5,
        recipe.skinTone,
        null,
        0.65,
        0.05
      );

      // Hair layer (if not occluded by full helmet/hood)
      if (layers.showHair) {
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx - facingX * 1.2,
          headY - 2.5,
          8.2,
          7.0,
          recipe.hairColor,
          null,
          0.75,
          0.08
        );
      }

      // Helmet / Hood / Circlet
      if (layers.headItem) {
        const helmRy = layers.headItem.visualStyle === 'circlet' ? 3.2 : 9.0;
        const helmCy = layers.headItem.visualStyle === 'circlet' ? headY - 3.5 : headY - 1.0;
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx,
          helmCy,
          8.6,
          helmRy,
          layers.headItem.primaryColor,
          layers.headItem.trimColor,
          layers.headItem.roughness,
          layers.headItem.metallic
        );
      }

      // Main Hand Weapon
      if (layers.mainHandItem) {
        const handX = cx + 12 * Math.cos(angle * 0.5) + 4;
        const handY = groundY - 34 - bobY + legSwing * 0.25;
        const tipX = handX + 8 + facingX * 5;
        const tipY = handY - 22;

        drawShadedSegment(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          handX,
          handY,
          tipX,
          tipY,
          2.2,
          layers.mainHandItem.primaryColor,
          layers.mainHandItem.roughness,
          layers.mainHandItem.metallic
        );

        // Glowing tip or crossguard
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          tipX,
          tipY,
          3.8,
          3.8,
          layers.mainHandItem.trimColor,
          null,
          0.15,
          0.95
        );
      }

      // Off-Hand Shield / Torch / Tome
      if (layers.offHandItem) {
        const offX = cx - 12;
        const offY = groundY - 33 - bobY - legSwing * 0.2;
        const rx = layers.offHandItem.visualStyle === 'kiteshield' ? 6.5 : 4.2;
        const ry = layers.offHandItem.visualStyle === 'kiteshield' ? 10.5 : 6.0;
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          offX,
          offY,
          rx,
          ry,
          layers.offHandItem.primaryColor,
          layers.offHandItem.trimColor,
          layers.offHandItem.roughness,
          layers.offHandItem.metallic
        );
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
