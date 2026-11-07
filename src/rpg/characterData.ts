export type EquipmentSlot =
  | 'head'
  | 'torso'
  | 'cloak'
  | 'legs'
  | 'mainHand'
  | 'offHand'
  | 'consumable'
  | 'relic';

export type HairStyle =
  | 'none'
  | 'short_crop'
  | 'long_braids'
  | 'noble_crest'
  | 'tonsure'
  | 'slavic_parted'
  | 'elder_beard'
  | 'wreath_braids';

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
  priceSiekance?: number;
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
    | 'relic_item'
    | 'bow'
    | 'quiver';
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
  trinket_lunula: {
    id: 'trinket_lunula',
    name: 'Srebrna Lunula z Krzemieniem',
    slot: 'relic',
    description: 'Tradycyjny słowiański wisiorek w kształcie młodego księżyca. Chroni przed biesami i zmorami (+2 Percepcja, +15 Mana).',
    primaryColor: { r: 216, g: 226, b: 236 },
    trimColor: { r: 72, g: 184, b: 228 },
    roughness: 0.2,
    metallic: 0.92,
    loreBonus: 2,
    visualStyle: 'relic_item'
  },
  trinket_kolowrot: {
    id: 'trinket_kolowrot',
    name: 'Amulet Kołowrotu Swaroga',
    slot: 'relic',
    description: 'Kuty w brązie ośmioramienny symbol świętego słońca i ognia domowego (+2 Siła, +12 Zdrowie).',
    primaryColor: { r: 228, g: 164, b: 52 },
    trimColor: { r: 148, g: 42, b: 26 },
    roughness: 0.25,
    metallic: 0.88,
    attackBonus: 2,
    visualStyle: 'relic_item'
  },
  trinket_motanka: {
    id: 'trinket_motanka',
    name: 'Lalka Motanka z Lnu i Chrustu',
    slot: 'relic',
    description: 'Słowiańska rytualna lalka bez twarzy, motana z lnu bez użycia igły. Chroni przed otępieniem i urokiem (+2 Determinacja).',
    primaryColor: { r: 204, g: 188, b: 164 },
    trimColor: { r: 178, g: 42, b: 40 },
    roughness: 0.88,
    metallic: 0.02,
    visualStyle: 'relic_item'
  },
  item_piolun_herb: {
    id: 'item_piolun_herb',
    name: 'Piołun z Uroczyska',
    slot: 'consumable',
    description: 'Gorzkie leśne ziele o srebrzystych liściach. Odpędza leśne zmory i wzmacnia hart ducha (+2 Determinacja).',
    primaryColor: { r: 112, g: 132, b: 96 },
    trimColor: { r: 164, g: 184, b: 148 },
    roughness: 0.75,
    metallic: 0.05,
    consumableEffect: {
      resolve: 2,
      barkText: 'Piołunowy wywar rozgrzewa wnętrze i odpędza leśne uroki!'
    },
    visualStyle: 'food'
  },
  item_dziurawiec_herb: {
    id: 'item_dziurawiec_herb',
    name: 'Świętojański Dziurawiec',
    slot: 'consumable',
    description: 'Złote ziele słońca. Goi rany, odpędza zwątpienie i przywraca siły witalne (+1 Siła, +1 Percepcja).',
    primaryColor: { r: 228, g: 184, b: 42 },
    trimColor: { r: 252, g: 224, b: 84 },
    roughness: 0.65,
    metallic: 0.08,
    consumableEffect: {
      might: 1,
      perception: 1,
      barkText: 'Złocisty dziurawiec przywraca siły i męstwo!'
    },
    visualStyle: 'food'
  },
  item_dzban_miodu: {
    id: 'item_dzban_miodu',
    name: 'Gliniany Dzban Miodu Czwórniaka',
    slot: 'consumable',
    description: 'Staropolski sycony miód pitny z leśnej pasieki w glinianym dzbanku (+2 Siła, +1 Determinacja).',
    primaryColor: { r: 196, g: 118, b: 52 },
    trimColor: { r: 236, g: 178, b: 64 },
    roughness: 0.55,
    metallic: 0.1,
    consumableEffect: {
      might: 2,
      resolve: 1,
      barkText: 'Łyk miodu pitnego rozgrzewa krew i dodaje żeru do walki!'
    },
    visualStyle: 'food'
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
  torso_przeszywanica: {
    id: 'torso_przeszywanica',
    name: 'Przeszywanica i Giezło z Krajką',
    slot: 'torso',
    description: 'Pikowany kaftan z bielonego lnu obszyty tradycyjną czerwono-białą krajką i przewiązany sznurem.',
    primaryColor: { r: 220, g: 214, b: 198 },
    trimColor: { r: 188, g: 38, b: 36 },
    roughness: 0.82,
    metallic: 0.05,
    armorBonus: 4,
    visualStyle: 'brigandine'
  },
  torso_slavic_giezlo: {
    id: 'torso_slavic_giezlo',
    name: 'Lniane Giezło z Czerwoną Krajką',
    slot: 'torso',
    description: 'Bielona lniana szata słowiańska przepasana krajką tkaną na bardku w tradycyjne czerwone motywy solarne.',
    primaryColor: { r: 236, g: 230, b: 216 },
    trimColor: { r: 196, g: 32, b: 32 },
    roughness: 0.88,
    metallic: 0.02,
    armorBonus: 2,
    visualStyle: 'tunic'
  },

  // Head
  helm_szyszak: {
    id: 'helm_szyszak',
    name: 'Słowiański Szyszak z Nosalem',
    slot: 'head',
    description: 'Spiczasty wczesnośredniowieczny szyszak z profilowaną czaszą, nitowanym nosalem i czepcem kolczym.',
    primaryColor: { r: 132, g: 140, b: 152 },
    trimColor: { r: 198, g: 156, b: 64 },
    roughness: 0.28,
    metallic: 0.9,
    hidesHair: true,
    armorBonus: 3,
    visualStyle: 'full_helm'
  },
  helm_klobuk: {
    id: 'helm_klobuk',
    name: 'Filcowy Kłobuk Kmiecia',
    slot: 'head',
    description: 'Tradycyjne słowiańskie nakrycie głowy z gęstego szarego filcu o stożkowatym kształcie z wywiniętym rondem.',
    primaryColor: { r: 142, g: 136, b: 128 },
    trimColor: { r: 96, g: 88, b: 80 },
    roughness: 0.95,
    metallic: 0.0,
    hidesHair: false,
    armorBonus: 1,
    visualStyle: 'hood'
  },
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
  legs_lapcie: {
    id: 'legs_lapcie',
    name: 'Łapcie z Łyka i Onuce',
    slot: 'legs',
    description: 'Tradycyjne słowiańskie obuwie wyplatane z lipowego łyka, z wełnianymi onucami wokół łydek.',
    primaryColor: { r: 168, g: 128, b: 82 },
    trimColor: { r: 122, g: 88, b: 52 },
    roughness: 0.85,
    metallic: 0.02,
    armorBonus: 1,
    visualStyle: 'boots'
  },

  // Main Hand
  weapon_slavic_axe: {
    id: 'weapon_slavic_axe',
    name: 'Wąsaty Topór Bojowy Woja',
    slot: 'mainHand',
    description: 'Wczesnośredniowieczny żelazny topór z wąsatym żeleźcem i jesionowym toporzyskiem. Przebija tarcze i pancerze.',
    primaryColor: { r: 154, g: 160, b: 168 },
    trimColor: { r: 104, g: 68, b: 42 },
    roughness: 0.35,
    metallic: 0.85,
    attackBonus: 5,
    visualStyle: 'battleaxe'
  },
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
  weapon_hunting_bow: {
    id: 'weapon_hunting_bow',
    name: 'Refleksyjny Łuk Cisowy Myśliwego',
    slot: 'mainHand',
    description: 'Starannie wyprofilowany łuk z cisowego drewna ze ścięgnistym oplotem, zdolny szyć strzałami na znaczny dystans.',
    primaryColor: { r: 128, g: 86, b: 52 },
    trimColor: { r: 218, g: 182, b: 94 },
    roughness: 0.45,
    metallic: 0.2,
    attackBonus: 5,
    visualStyle: 'bow'
  },
  cloak_ranger_quiver: {
    id: 'cloak_ranger_quiver',
    name: 'Skórzany Kołczan i Opończa Tropiciela',
    slot: 'cloak',
    description: 'Wzmocniony kołczan z brzechwami gęsich piór, narzucony na ramiona wraz z ciemnozieloną opończą.',
    primaryColor: { r: 52, g: 68, b: 54 },
    trimColor: { r: 168, g: 132, b: 84 },
    roughness: 0.72,
    metallic: 0.1,
    armorBonus: 1,
    visualStyle: 'quiver'
  },
  torso_slavic_lamellar: {
    id: 'torso_slavic_lamellar',
    name: 'Słowiańska Zbroja Łuskowa Drużynnika',
    slot: 'torso',
    description: 'Ciężki pancerz z zachodzących na siebie żelaznych łusek związanych rzemieniami, noszony przez elitarnych wojów księcia.',
    primaryColor: { r: 122, g: 130, b: 142 },
    trimColor: { r: 212, g: 168, b: 72 },
    roughness: 0.25,
    metallic: 0.9,
    armorBonus: 7,
    visualStyle: 'plate'
  },
  helm_druid_antlers: {
    id: 'helm_druid_antlers',
    name: 'Wieniec Żercy z Rogami Jelenia',
    slot: 'head',
    description: 'Rytualna korona z poroża jelenia opleciona liśćmi dębu i runicznymi wstęgami, wzmacniająca więź z duchami puszczy.',
    primaryColor: { r: 196, g: 184, b: 162 },
    trimColor: { r: 84, g: 218, b: 164 },
    roughness: 0.45,
    metallic: 0.15,
    hidesHair: false,
    loreBonus: 3,
    visualStyle: 'circlet'
  },
  helm_ranger_cowl: {
    id: 'helm_ranger_cowl',
    name: 'Kaptur Czatownika z Wilczym Kłem',
    slot: 'head',
    description: 'Głęboki leśny kaptur rzucający cień na twarz z przymocowanym talizmanem wilczego kła.',
    primaryColor: { r: 38, g: 52, b: 42 },
    trimColor: { r: 218, g: 196, b: 154 },
    roughness: 0.8,
    metallic: 0.05,
    hidesHair: true,
    armorBonus: 2,
    visualStyle: 'hood'
  },

  // Off Hand
  offhand_slavic_shield: {
    id: 'offhand_slavic_shield',
    name: 'Okrągła Tarcza z Kołowrotem',
    slot: 'offHand',
    description: 'Drewniana deszczułkowa tarcza lipowa z kutym żelaznym umbem, malowana w słoneczny Kołowrót Swaroga.',
    primaryColor: { r: 168, g: 44, b: 36 },
    trimColor: { r: 218, g: 168, b: 54 },
    roughness: 0.55,
    metallic: 0.45,
    armorBonus: 3,
    visualStyle: 'kiteshield'
  },
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
