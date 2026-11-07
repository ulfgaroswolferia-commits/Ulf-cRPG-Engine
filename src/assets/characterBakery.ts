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
    'torso_przeszywanica'
  ];
  const heads: Array<string | null> = [
    null,
    'helm_dread_plate',
    'helm_shadow_hood',
    'helm_arcane_circlet',
    'helm_szyszak',
    'helm_klobuk'
  ];
  const cloaks: Array<string | null> = [null, 'cloak_crimson_mantle', 'cloak_steel_pauldrons'];
  const legs = ['legs_steel_greaves', 'legs_leather_boots', 'legs_lapcie'];
  const weapons: Array<string | null> = [
    'weapon_sunblade_longsword',
    'weapon_Executioner_axe',
    'weapon_astral_staff',
    'weapon_slavic_axe'
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
        const isOuterEdge = outlineDarken && distSq > 0.84;
        const isBorder = trimColor !== null && distSq > 0.68 && distSq <= 0.84;
        const activeColor = isBorder && trimColor ? trimColor : color;
        const nz = Math.sqrt(Math.max(0.05, 1.0 - distSq));
        // Strong metallic specular rim & zenith shading
        const specHighlight =
          metallic > 0.5 && dx < -0.15 && dy < -0.15 ? (1.0 - distSq) * 0.42 : 0;
        const baseShade = 0.68 + 0.38 * nz - 0.16 * dy - 0.1 * dx + specHighlight;
        const shade = isOuterEdge ? baseShade * 0.42 : baseShade;

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
    const facingY = Math.cos(angle); // +1 = facing camera (South), -1 = facing away (North)

    for (let frame = 0; frame < framesPerDirection; frame++) {
      const ox = frame * frameWidth;
      const oy = dir * frameHeight;
      const cx = ox + 32;
      const groundY = oy + 84;

      const stridePhase = (frame / framesPerDirection) * Math.PI * 2;
      const legSwing = frame === 0 ? 0 : Math.sin(stridePhase) * 5.0;
      const bobY = frame === 0 ? 0 : Math.abs(Math.cos(stridePhase)) * 2.2;

      const drawCloakFirst = facingY >= -0.15;

      const renderCloak = (): void => {
        if (!layers.cloakItem) return;
        // Flowing pleated cape with tapered hem
        for (let row = 0; row <= 28; row++) {
          const t = row / 28;
          const flare = 8 + t * 7.5;
          const wave = Math.sin(t * 5 + frame * 1.4) * 1.2;
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx - facingX * 3.5 + wave,
            groundY - 48 - bobY + row,
            flare,
            2.5,
            layers.cloakItem.primaryColor,
            row > 24 ? layers.cloakItem.trimColor : null,
            layers.cloakItem.roughness,
            layers.cloakItem.metallic
          );
        }
      };

      if (drawCloakFirst) renderCloak();

      // Articulated Legs, Knee-Cops & Boots
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
        4.4,
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
        4.4,
        3.2,
        layers.legsItem.primaryColor,
        layers.legsItem.trimColor,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );

      // Boots Sabatons
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        leftFootX + facingX * 1.5,
        leftFootY,
        4.2,
        2.8,
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
        4.2,
        2.8,
        layers.legsItem.trimColor,
        null,
        layers.legsItem.roughness,
        layers.legsItem.metallic
      );

      // Sculpted Heroic Torso / Cuirass / Robes
      const isRobes = layers.torsoItem.visualStyle === 'robes';
      const torsoHeight = isRobes ? 23 : 17;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        groundY - 37 - bobY,
        11.2,
        torsoHeight,
        layers.torsoItem.primaryColor,
        layers.torsoItem.trimColor,
        layers.torsoItem.roughness,
        layers.torsoItem.metallic
      );

      // Waist Belt & Buckle + Chest Emblem
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx,
        groundY - 27 - bobY,
        10.6,
        2.6,
        { r: 54, g: 38, b: 26 },
        layers.torsoItem.trimColor,
        0.4,
        0.75
      );
      if (facingY > -0.2) {
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

      // Slavic folk krajka embroidery (crimson-and-white geometric sash & placket)
      const isSlavicTorso =
        layers.torsoItem.id === 'torso_slavic_giezlo' ||
        layers.torsoItem.id === 'torso_przeszywanica';
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
        drawShadedEllipse(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx,
          groundY - 27 - bobY,
          10.8,
          2.0,
          layers.torsoItem.trimColor,
          { r: 248, g: 244, b: 236 },
          0.85,
          0.02
        );
      }

      // Layered Shoulder Pauldrons & Arms
      const pauldronColor = layers.cloakItem?.trimColor ?? layers.torsoItem.trimColor;
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx - 11.5,
        groundY - 47 - bobY,
        5.5,
        4.8,
        pauldronColor,
        layers.torsoItem.primaryColor,
        0.24,
        0.86
      );
      drawShadedEllipse(
        albedoRGBA,
        normalMaterialRGBA,
        sheetWidth,
        sheetHeight,
        cx + 11.5,
        groundY - 47 - bobY,
        5.5,
        4.8,
        pauldronColor,
        layers.torsoItem.primaryColor,
        0.24,
        0.86
      );

      if (!drawCloakFirst) renderCloak();

      // Neck & Head
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

      // Facial Features (Eyes & Brow when facing forward/sideways)
      if (facingY > 0.1 && layers.headItem?.visualStyle !== 'full_helm') {
        const eyeOffsetX = facingX * 2.5;
        setPixelWithNormal(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + eyeOffsetX - 2.5,
          headY - 1,
          { r: 28, g: 34, b: 46 },
          1.0,
          0,
          0,
          0.2,
          0.1
        );
        setPixelWithNormal(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          cx + eyeOffsetX + 2.5,
          headY - 1,
          { r: 28, g: 34, b: 46 },
          1.0,
          0,
          0,
          0.2,
          0.1
        );
      }

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

        // Slavic parted bowl-cut styling
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
          if (facingY > 0.1) {
            setPixelWithNormal(
              albedoRGBA,
              normalMaterialRGBA,
              sheetWidth,
              sheetHeight,
              cx + facingX * 1.8,
              headY - 5,
              recipe.skinTone,
              0.85,
              0,
              0,
              0.6,
              0.05
            );
          }
        }

        // Patriarchal flowing beard for Żercy & Wołchwowie
        if (recipe.hairStyle === 'elder_beard' && facingY > -0.25) {
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

        // Twin braids and flower wreath (wianek) for Slavic maidens & herbalists
        if (recipe.hairStyle === 'wreath_braids') {
          // Left & right draped braids
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

          // Floral & herb wreath around the crown
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

      // Helmet / Hood / Circlet / Kłobuk
      if (layers.headItem) {
        if (layers.headItem.id === 'helm_klobuk') {
          // Conical Slavic felt hat with rolled brim
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            headY - 6.5,
            6.5,
            6.0,
            layers.headItem.primaryColor,
            layers.headItem.trimColor,
            0.92,
            0.0
          );
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            headY - 2.5,
            9.2,
            3.0,
            layers.headItem.trimColor,
            layers.headItem.primaryColor,
            0.95,
            0.0
          );
        } else {
          const isCirclet = layers.headItem.visualStyle === 'circlet';
          const helmRy = isCirclet ? 3.0 : 9.4;
          const helmCy = isCirclet ? headY - 3.8 : headY - 1.2;
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            cx,
            helmCy,
            8.8,
            helmRy,
            layers.headItem.primaryColor,
            layers.headItem.trimColor,
            layers.headItem.roughness,
            layers.headItem.metallic
          );

          // Dark T-visor slit on full plate helmet
          if (layers.headItem.visualStyle === 'full_helm' && facingY > 0) {
            for (let vx = -4; vx <= 4; vx++) {
              setPixelWithNormal(
                albedoRGBA,
                normalMaterialRGBA,
                sheetWidth,
                sheetHeight,
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
        }
      }

      // Main Hand Weapon (Sword with crossguard, Battleaxe with crescent blade, or Crystal Staff)
      if (layers.mainHandItem) {
        const handX = cx + 13 + facingX * 2;
        const handY = groundY - 34 - bobY + legSwing * 0.25;
        const tipX = handX + 7 + facingX * 4;
        const tipY = handY - 26;

        // Crossguard / Hilt
        drawTaperedLimb(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          handX - 4,
          handY - 2,
          handX + 5,
          handY + 2,
          2.0,
          2.0,
          layers.mainHandItem.trimColor,
          null,
          0.2,
          0.92
        );

        // Weapon Shaft / Blade
        drawTaperedLimb(
          albedoRGBA,
          normalMaterialRGBA,
          sheetWidth,
          sheetHeight,
          handX,
          handY,
          tipX,
          tipY,
          2.5,
          1.4,
          layers.mainHandItem.primaryColor,
          layers.mainHandItem.trimColor,
          layers.mainHandItem.roughness,
          layers.mainHandItem.metallic
        );

        if (layers.mainHandItem.visualStyle === 'battleaxe') {
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            tipX + 2,
            tipY + 5,
            6.5,
            5.0,
            layers.mainHandItem.primaryColor,
            layers.mainHandItem.trimColor,
            0.2,
            0.94
          );
        } else if (layers.mainHandItem.visualStyle === 'runestaff') {
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            tipX,
            tipY,
            4.8,
            4.8,
            layers.mainHandItem.trimColor,
            { r: 220, g: 252, b: 255 },
            0.08,
            0.96
          );
        }
      }

      // Off-Hand Shield / Flaming Torch / Tome
      if (layers.offHandItem) {
        const offX = cx - 13;
        const offY = groundY - 34 - bobY - legSwing * 0.2;
        if (layers.offHandItem.visualStyle === 'torch') {
          drawTaperedLimb(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offX,
            offY + 4,
            offX - 3,
            offY - 14,
            2.2,
            2.8,
            layers.offHandItem.primaryColor,
            null,
            0.7,
            0.1
          );
          drawShadedEllipse(
            albedoRGBA,
            normalMaterialRGBA,
            sheetWidth,
            sheetHeight,
            offX - 3,
            offY - 18,
            5.2,
            7.0,
            { r: 255, g: 192, b: 64 },
            { r: 255, g: 98, b: 24 },
            0.05,
            0.95,
            false
          );
        } else {
          const rx = layers.offHandItem.visualStyle === 'kiteshield' ? 7.2 : 4.8;
          const ry = layers.offHandItem.visualStyle === 'kiteshield' ? 11.5 : 6.5;
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
