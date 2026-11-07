export type EquipmentSlot =
  | 'head'
  | 'torso'
  | 'cloak'
  | 'legs'
  | 'mainHand'
  | 'offHand'
  | 'consumable'
  | 'relic';

export type HairStyle = 'none' | 'short_crop' | 'long_braids' | 'noble_crest' | 'tonsure';

export interface RGBAColor {
  r: number;
  g: number;
  b: number;
}

export interface EquipmentItemDef {
  id: string;
  name: string;
  slot: EquipmentSlot;
  description: string;
  primaryColor: RGBAColor;
  trimColor: RGBAColor;
  roughness: number; // 0.0 (mirror) .. 1.0 (matte cloth)
  metallic: number; // 0.0 (dielectric) .. 1.0 (pure metal)
  emissive?: boolean;
  hidesHair?: boolean;
  armorBonus?: number;
  attackBonus?: number;
  loreBonus?: number;
  consumableEffect?: {
    might?: number;
    resolve?: number;
    perception?: number;
    lore?: number;
    barkText: string;
  };
  visualStyle:
    | 'plate'
    | 'brigandine'
    | 'robes'
    | 'tunic'
    | 'full_helm'
    | 'hood'
    | 'circlet'
    | 'cape'
    | 'pauldrons'
    | 'greaves'
    | 'boots'
    | 'longsword'
    | 'battleaxe'
    | 'runestaff'
    | 'torch'
    | 'kiteshield'
    | 'tome'
    | 'food'
    | 'relic_item';
}

export interface CharacterEquipmentLoadout {
  head: string | null;
  torso: string;
  cloak: string | null;
  legs: string;
  mainHand: string | null;
  offHand: string | null;
}

export interface CharacterAttributes {
  might: number;
  finesse: number;
  resolve: number;
  lore: number;
  perception: number;
}

export interface CharacterVisualRecipe {
  id: string;
  name: string;
  title: string;
  seed: number;
  skinTone: RGBAColor;
  hairColor: RGBAColor;
  hairStyle: HairStyle;
  equipment: CharacterEquipmentLoadout;
  attributes: CharacterAttributes;
}

export const SKIN_TONES: ReadonlyArray<RGBAColor> = [
  { r: 232, g: 194, b: 164 },
  { r: 214, g: 170, b: 136 },
  { r: 186, g: 138, b: 104 },
  { r: 142, g: 98, b: 72 },
  { r: 205, g: 188, b: 178 }
];

export const HAIR_COLORS: ReadonlyArray<RGBAColor> = [
  { r: 36, g: 28, b: 24 },
  { r: 112, g: 58, b: 32 },
  { r: 178, g: 132, b: 68 },
  { r: 148, g: 46, b: 34 },
  { r: 196, g: 202, b: 212 }
];

export const EQUIPMENT_CATALOG: Record<string, EquipmentItemDef> = {
  // Consumables & Campfire Items
  item_raw_sausage: {
    id: 'item_raw_sausage',
    name: 'Surowa Kiełbasa Myśliwska',
    slot: 'consumable',
    description: 'Dobrze przyprawiona surowa kiełbasa z dziczyzny. Kliknij na Ognisko Obozowe na środku polany, aby ją upiec!',
    primaryColor: { r: 178, g: 72, b: 68 },
    trimColor: { r: 224, g: 168, b: 132 },
    roughness: 0.65,
    metallic: 0.05,
    visualStyle: 'food'
  },
  item_roasted_sausage: {
    id: 'item_roasted_sausage',
    name: 'Upieczona Kiełbasa z Ogniska',
    slot: 'consumable',
    description: 'Skwiercząca, złocista kiełbasa pachnąca dymem olchowym i jałowcem. Kliknij, aby zjeść (+2 Siła, +2 Determinacja).',
    primaryColor: { r: 156, g: 76, b: 32 },
    trimColor: { r: 255, g: 184, b: 68 },
    roughness: 0.35,
    metallic: 0.15,
    consumableEffect: {
      might: 2,
      resolve: 2,
      barkText: 'Wyśmienita! Ciepła kiełbasa z ogniska dodaje sił.'
    },
    visualStyle: 'food'
  },
  item_old_mead: {
    id: 'item_old_mead',
    name: 'Bukłak Starego Miodu',
    slot: 'consumable',
    description: 'Rozgrzewający trójniak z leśnej pasieki (+1 Determinacja po wypiciu).',
    primaryColor: { r: 196, g: 134, b: 42 },
    trimColor: { r: 112, g: 74, b: 38 },
    roughness: 0.4,
    metallic: 0.2,
    consumableEffect: {
      resolve: 1,
      barkText: 'Przedni miód pitny! Od razu cieplej na duchu.'
    },
    visualStyle: 'food'
  },
  item_moon_herbs: {
    id: 'item_moon_herbs',
    name: 'Zioła Księżycowe',
    slot: 'consumable',
    description: 'Świetliste liście rosnące nad leśnym potokiem (+1 Percepcja, +1 Wiedza).',
    primaryColor: { r: 64, g: 198, b: 156 },
    trimColor: { r: 134, g: 242, b: 255 },
    roughness: 0.55,
    metallic: 0.15,
    consumableEffect: {
      perception: 1,
      lore: 1,
      barkText: 'Zmysły wyostrzają się od księżycowego naparu.'
    },
    visualStyle: 'food'
  },
  item_runic_compass: {
    id: 'item_runic_compass',
    name: 'Starożytny Kompas Runiczny',
    slot: 'relic',
    description: 'Mosiężny artefakt wskazujący anomalie eteryczne na polanie (+2 Wiedza Tajemna).',
    primaryColor: { r: 212, g: 172, b: 78 },
    trimColor: { r: 72, g: 224, b: 255 },
    roughness: 0.22,
    metallic: 0.88,
    loreBonus: 2,
    consumableEffect: {
      lore: 2,
      barkText: 'Igła kompasu wiruje, wskazując leśny ołtarz na wzgórzu!'
    },
    visualStyle: 'relic_item'
  },
  ring_wolf_signet: {
    id: 'ring_wolf_signet',
    name: 'Sygnet Szarego Wilka',
    slot: 'relic',
    description: 'Srebrny pierścień weteranów pogranicza wzmacniający siłę ciosu i odporność.',
    primaryColor: { r: 186, g: 196, b: 210 },
    trimColor: { r: 212, g: 164, b: 68 },
    roughness: 0.2,
    metallic: 0.92,
    armorBonus: 1,
    attackBonus: 2,
    visualStyle: 'relic_item'
  },
  ring_emerald_seal: {
    id: 'ring_emerald_seal',
    name: 'Szmaragdowy Pierścień Druidów',
    slot: 'relic',
    description: 'Pierścień opleciony żywym korzeniem, wyostrzający zmysły i skupienie runiczne.',
    primaryColor: { r: 52, g: 188, b: 118 },
    trimColor: { r: 204, g: 172, b: 84 },
    roughness: 0.25,
    metallic: 0.85,
    loreBonus: 2,
    visualStyle: 'relic_item'
  },

  // Torso
  torso_warden_brigandine: {
    id: 'torso_warden_brigandine',
    name: 'Brygantyna Strażnika Korony',
    slot: 'torso',
    description: 'Nabijana stalowymi nitami skórzana zbroja z wytłoczonym symbolem Aethelgardu.',
    primaryColor: { r: 78, g: 54, b: 42 },
    trimColor: { r: 182, g: 148, b: 84 },
    roughness: 0.55,
    metallic: 0.35,
    armorBonus: 4,
    visualStyle: 'brigandine'
  },
  torso_aethel_plate: {
    id: 'torso_aethel_plate',
    name: 'Kirys Płytowy z Czarnego Żelaza',
    slot: 'torso',
    description: 'Ciężka kuta zbroja płytowa odbijająca blask ogniska i zaklęć.',
    primaryColor: { r: 118, g: 128, b: 144 },
    trimColor: { r: 212, g: 174, b: 92 },
    roughness: 0.22,
    metallic: 0.92,
    armorBonus: 8,
    visualStyle: 'plate'
  },
  torso_archmage_robes: {
    id: 'torso_archmage_robes',
    name: 'Szaty Runiczne Konklawe',
    slot: 'torso',
    description: 'Jedwabne szaty przetykane srebrzystą nicią astronomiczną.',
    primaryColor: { r: 44, g: 58, b: 108 },
    trimColor: { r: 112, g: 204, b: 232 },
    roughness: 0.78,
    metallic: 0.18,
    armorBonus: 2,
    loreBonus: 3,
    visualStyle: 'robes'
  },
  torso_linen_tunic: {
    id: 'torso_linen_tunic',
    name: 'Pikowany Dublet Podróżny',
    slot: 'torso',
    description: 'Wygodny przeszywany dublet noszony przez zwiadowców.',
    primaryColor: { r: 88, g: 94, b: 74 },
    trimColor: { r: 142, g: 116, b: 78 },
    roughness: 0.85,
    metallic: 0.05,
    armorBonus: 2,
    visualStyle: 'tunic'
  },

  // Head
  helm_dread_plate: {
    id: 'helm_dread_plate',
    name: 'Zamknięty Przyłbicowy Hełm Inkwizytora',
    slot: 'head',
    description: 'Stalowy hełm całkowicie osłaniający twarz i skronie.',
    primaryColor: { r: 126, g: 136, b: 152 },
    trimColor: { r: 206, g: 168, b: 86 },
    roughness: 0.24,
    metallic: 0.94,
    hidesHair: true,
    armorBonus: 3,
    visualStyle: 'full_helm'
  },
  helm_shadow_hood: {
    id: 'helm_shadow_hood',
    name: 'Kaptur Zwiadowcy Głębin',
    slot: 'head',
    description: 'Głęboki kaptur z impregnowanej skóry tłumiący odgłosy kroków.',
    primaryColor: { r: 46, g: 52, b: 48 },
    trimColor: { r: 132, g: 112, b: 76 },
    roughness: 0.75,
    metallic: 0.1,
    hidesHair: true,
    armorBonus: 1,
    visualStyle: 'hood'
  },
  helm_arcane_circlet: {
    id: 'helm_arcane_circlet',
    name: 'Diadem Gwiaździstego Spojrzenia',
    slot: 'head',
    description: 'Złocona obręcz z osadzonym szafirem wspomagająca percepcję.',
    primaryColor: { r: 214, g: 178, b: 92 },
    trimColor: { r: 76, g: 214, b: 245 },
    roughness: 0.2,
    metallic: 0.88,
    hidesHair: false,
    loreBonus: 2,
    visualStyle: 'circlet'
  },

  // Cloak
  cloak_crimson_mantle: {
    id: 'cloak_crimson_mantle',
    name: 'Karmazynowy Płaszcz Gwardii',
    slot: 'cloak',
    description: 'Ciężki wełniany płaszcz z mosiężnymi klamrami naramiennymi.',
    primaryColor: { r: 138, g: 32, b: 36 },
    trimColor: { r: 198, g: 162, b: 82 },
    roughness: 0.82,
    metallic: 0.12,
    armorBonus: 1,
    visualStyle: 'cape'
  },
  cloak_steel_pauldrons: {
    id: 'cloak_steel_pauldrons',
    name: 'Naramienniki Szturmowe z Futrem',
    slot: 'cloak',
    description: 'Kute stalowe naramienniki podszyte ciemnym wilczym futrem.',
    primaryColor: { r: 112, g: 120, b: 132 },
    trimColor: { r: 74, g: 62, b: 54 },
    roughness: 0.32,
    metallic: 0.82,
    armorBonus: 2,
    visualStyle: 'pauldrons'
  },

  // Legs
  legs_steel_greaves: {
    id: 'legs_steel_greaves',
    name: 'Nagolenniki Płytowe',
    slot: 'legs',
    description: 'Segmentowane stalowe osłony nogawic i kolan.',
    primaryColor: { r: 96, g: 104, b: 118 },
    trimColor: { r: 174, g: 144, b: 78 },
    roughness: 0.28,
    metallic: 0.86,
    armorBonus: 2,
    visualStyle: 'greaves'
  },
  legs_leather_boots: {
    id: 'legs_leather_boots',
    name: 'Wysokie Buty Traperskie',
    slot: 'legs',
    description: 'Elastyczne skórzane buty ze wzmocnioną podeszwą.',
    primaryColor: { r: 58, g: 42, b: 32 },
    trimColor: { r: 124, g: 98, b: 64 },
    roughness: 0.68,
    metallic: 0.15,
    armorBonus: 1,
    visualStyle: 'boots'
  },

  // Main Hand
  weapon_sunblade_longsword: {
    id: 'weapon_sunblade_longsword',
    name: 'Miecz Długi „Ostrze Przysięgi”',
    slot: 'mainHand',
    description: 'Doskonale wyważona stalowa klinga z jelcem w kształcie skrzydeł.',
    primaryColor: { r: 192, g: 204, b: 218 },
    trimColor: { r: 218, g: 176, b: 84 },
    roughness: 0.16,
    metallic: 0.96,
    attackBonus: 5,
    visualStyle: 'longsword'
  },
  weapon_Executioner_axe: {
    id: 'weapon_Executioner_axe',
    name: 'Topór Bojowy z Głębokich Kuźni',
    slot: 'mainHand',
    description: 'Masywne ostrze zdolne kruszyć tarcze i pancerze.',
    primaryColor: { r: 148, g: 156, b: 168 },
    trimColor: { r: 112, g: 76, b: 48 },
    roughness: 0.28,
    metallic: 0.88,
    attackBonus: 7,
    visualStyle: 'battleaxe'
  },
  weapon_astral_staff: {
    id: 'weapon_astral_staff',
    name: 'Kostur Runiczny Zatopionej Korony',
    slot: 'mainHand',
    description: 'Zwieńczony świecącym kryształem eterycznym rzucającym błękitny blask.',
    primaryColor: { r: 94, g: 68, b: 46 },
    trimColor: { r: 72, g: 224, b: 255 },
    roughness: 0.35,
    metallic: 0.45,
    emissive: true,
    attackBonus: 4,
    loreBonus: 3,
    visualStyle: 'runestaff'
  },

  // Off Hand
  offhand_heraldic_shield: {
    id: 'offhand_heraldic_shield',
    name: 'Tarcza Rycerska z Gryfem',
    slot: 'offHand',
    description: 'Trójkątna tarcza okuta stalą z pozłacanym herbem.',
    primaryColor: { r: 42, g: 68, b: 114 },
    trimColor: { r: 212, g: 176, b: 88 },
    roughness: 0.3,
    metallic: 0.75,
    armorBonus: 3,
    visualStyle: 'kiteshield'
  },
  offhand_torch: {
    id: 'offhand_torch',
    name: 'Smolna Pochodnia Obozowa',
    slot: 'offHand',
    description: 'Rozprasza mrok nocy ciepłym, ruchomym światłem.',
    primaryColor: { r: 108, g: 72, b: 44 },
    trimColor: { r: 255, g: 168, b: 56 },
    roughness: 0.6,
    metallic: 0.1,
    emissive: true,
    visualStyle: 'torch'
  },
  offhand_grimoire: {
    id: 'offhand_grimoire',
    name: 'Grimuar Pieczęci Przodków',
    slot: 'offHand',
    description: 'Oprawiona w skórę księga z inkantacjami ochronnymi.',
    primaryColor: { r: 102, g: 34, b: 44 },
    trimColor: { r: 218, g: 186, b: 98 },
    roughness: 0.65,
    metallic: 0.25,
    loreBonus: 2,
    visualStyle: 'tome'
  }
};
