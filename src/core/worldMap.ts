import { RGBAColor } from '../rpg/characterData';

export type MapId = 'forest_clearing' | 'slavic_village' | 'sanctum_dungeon';

export type TileTerrainType =
  | 'dungeon_stone'
  | 'sanctum_marble'
  | 'mossy_cobble'
  | 'arcane_inlay'
  | 'stairs_stone'
  | 'abyss_water'
  | 'forest_grass'
  | 'dirt_path'
  | 'forest_soil';

export type PropKind =
  | 'wall_block'
  | 'pillar'
  | 'door'
  | 'torch_sconce'
  | 'arcane_crystal'
  | 'chest'
  | 'runic_altar' // 2x1 multi-tile prop
  | 'sarcophagus' // 1x2 multi-tile prop
  | 'pine_tree'
  | 'ancient_oak'
  | 'tree_stump'
  | 'berry_bush'
  | 'wildflower_patch'
  | 'campfire'
  | 'ground_loot'
  | 'exit_path'
  | 'ranger_tent' // 2x1 multi-tile prop
  | 'fallen_log' // 1x2 multi-tile prop
  | 'slavic_cottage' // 2x1 / 1x2 Slavic thatched log cottage
  | 'market_stall' // 2x1 / 1x2 medieval marketplace vendor stall
  | 'slavic_shrine' // 1x1 carved four-faced Światowid idol
  | 'slavic_well' // 1x1 timber village well with rooflet & bucket
  | 'wattle_fence' // 1x1 woven willow fence
  | 'travel_signpost' // 1x1 wooden signpost for traveling between locations
  | 'watchtower' // 1x1 / 2x1 Isometric Game Kit defensive watchtower / bastion spire
  | 'graveyard_fence' // 1x1 OpenGameArt wrought-iron gothic fence / gate
  | 'dead_tree' // 1x1 OpenGameArt gnarled dead / swamp tree
  | 'rock_cliff' // 1x1 OpenGameArt sculpted rock cliff / mossy boulder outcrop
  | 'dungeon_barrel' // 1x1 dungeon wooden barrel
  | 'dungeon_crate' // 1x1 dungeon supply crate
  | 'dungeon_table' // 1x1 dungeon table
  | 'dungeon_support'; // 1x1 mine timber support frame

export interface TileCell {
  x: number;
  y: number;
  z: number; // Elevation in world steps (0..4)
  terrain: TileTerrainType;
  walkable: boolean;
}

export interface PointLightSource {
  id: string;
  x: number;
  y: number;
  z: number;
  color: RGBAColor;
  intensity: number;
  radius: number; // in grid tiles
  flickerSpeed: number;
  enabled: boolean;
}

export interface WorldPropEntity {
  id: string;
  name: string;
  kind: PropKind;
  variant?: number;
  x: number;
  y: number;
  z: number;
  sizeX: number;
  sizeY: number;
  heightZ: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  interactive: boolean;
  isOpen?: boolean;
  lootItems?: string[];
  linkedLightId?: string;
}

export interface IsometricWorldMap {
  id: MapId;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  maxElevation: number;
  tiles: TileCell[][];
  props: WorldPropEntity[];
  lights: PointLightSource[];
}

/**
 * Large 32x32 multi-screen showcase location:
 * "Polana Wilczego Ognia" — Forest clearing surrounded by dense woods,
 * central campfire (where raw sausage can be roasted), multi-elevation hill & ruins,
 * lootable items & equipment on the ground, and one single exit path blocked by the hero's bark.
 */
export function createForestClearingMap(): IsometricWorldMap {
  const width = 32;
  const height = 32;
  const tiles: TileCell[][] = [];
  const centerX = 15.5;
  const centerY = 15.5;

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      let z = 0;
      let terrain: TileTerrainType = 'forest_grass';
      let walkable = true;

      const distFromCenter = Math.hypot(x - centerX, y - centerY);
      const isSouthExitPath = x >= 15 && x <= 16 && y >= 15 && y <= 31;

      // Raised forest border ridge around the clearing (except the single southern exit path)
      if (!isSouthExitPath && distFromCenter >= 12.2) {
        z = distFromCenter >= 14.2 ? 2 : 1;
        terrain = 'forest_soil';
      }

      // North-West Ancient Druid Hill (x: 5..11, y: 5..10) at Z=2 with stairs at x=12, y=7..8
      if (x >= 5 && x <= 11 && y >= 5 && y <= 10) {
        z = 2;
        terrain = x >= 7 && x <= 9 && y >= 7 && y <= 8 ? 'arcane_inlay' : 'mossy_cobble';
      }
      if (x === 12 && (y === 7 || y === 8)) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // North-East Ruined Watchtower Bastion (x: 20..25, y: 6..11) at Z=1
      if (x >= 20 && x <= 25 && y >= 6 && y <= 11) {
        z = 1;
        terrain = 'dungeon_stone';
      }
      if (x === 19 && (y === 8 || y === 9)) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // South-West Woodland Stream & Pond (x: 6..10, y: 20..24)
      if (x >= 6 && x <= 10 && y >= 20 && y <= 23 && Math.hypot(x - 8, y - 21.5) <= 2.3) {
        z = 0;
        terrain = 'abyss_water';
        walkable = false;
      }

      // Central Campfire Dirt Circle & Single Exit Path Heading South (x=15..16, y=15..31)
      if (Math.hypot(x - 15.5, y - 15.5) <= 3.2 || isSouthExitPath) {
        terrain = 'dirt_path';
        if (isSouthExitPath) {
          z = 0;
        }
      }

      // Secondary footpath towards the Ancient Hill stairs and Watchtower stairs
      if ((y === 14 && x >= 12 && x <= 19) || (x === 12 && y >= 9 && y <= 14)) {
        terrain = 'dirt_path';
      }

      row.push({ x, y, z, terrain, walkable });
    }
    tiles.push(row);
  }

  const props: WorldPropEntity[] = [];
  const lights: PointLightSource[] = [];

  // 1. Central Campfire (15, 15) + Dynamic Warm Firelight
  const campfireLightId = 'light_central_campfire';
  lights.push({
    id: campfireLightId,
    x: 15,
    y: 15,
    z: tiles[15][15].z + 1.4,
    color: { r: 255, g: 154, b: 52 },
    intensity: 1.75,
    radius: 8.5,
    flickerSpeed: 5.2,
    enabled: true
  });

  props.push({
    id: 'campfire_center',
    name: 'Ognisko Obozowe (Piecz Kiełbasę)',
    kind: 'campfire',
    x: 15,
    y: 15,
    z: tiles[15][15].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.4,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: campfireLightId
  });

  // 2. Log Seats & Ranger Tent around the Central Campfire (Wild Clearing Focal Point)
  props.push({
    id: 'log_campfire_seat',
    name: 'Powalony Pień przy Ognisku (1x2)',
    kind: 'fallen_log',
    x: 13,
    y: 15,
    z: tiles[15][13].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.0,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  props.push({
    id: 'log_campfire_seat_east',
    name: 'Ociosany Pień Obozowy (1x2)',
    kind: 'fallen_log',
    x: 17,
    y: 15,
    z: tiles[15][17].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.0,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  props.push({
    id: 'tent_scout_shelter',
    name: 'Namiot Zwiadowcy Puszczy (2x1)',
    kind: 'ranger_tent',
    x: 12,
    y: 12,
    z: tiles[12][12].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  // 3. The Single Exit Path Trigger at the Southern Edge of the Path (x: 15..16, y: 29)
  props.push({
    id: 'exit_forest_pass',
    name: 'Ścieżka Wyjścia z Polany',
    kind: 'exit_path',
    x: 15,
    y: 29,
    z: tiles[29][15].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  // Torches flanking the exit path entrance
  const pathTorches = [
    { x: 14, y: 24, id: 'torch_exit_west' },
    { x: 17, y: 24, id: 'torch_exit_east' },
    { x: 14, y: 28, id: 'torch_gate_west' },
    { x: 17, y: 28, id: 'torch_gate_east' }
  ];
  for (const pt of pathTorches) {
    const lid = `light_${pt.id}`;
    const tz = tiles[pt.y][pt.x].z;
    lights.push({
      id: lid,
      x: pt.x,
      y: pt.y,
      z: tz + 1.5,
      color: { r: 255, g: 168, b: 64 },
      intensity: 1.3,
      radius: 5.8,
      flickerSpeed: 4.0,
      enabled: true
    });
    props.push({
      id: pt.id,
      name: 'Pochodnia Szlaku',
      kind: 'torch_sconce',
      x: pt.x,
      y: pt.y,
      z: tz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.8,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lid
    });
  }

  // 4. Lootable Ground Items & Equipment scattered around the Clearing
  props.push({
    id: 'loot_campfire_provisions',
    name: 'Kosz Prowiantowy (Surowa Kiełbasa i Miód)',
    kind: 'ground_loot',
    x: 14,
    y: 14,
    z: tiles[14][14].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 0.9,
    blocksMovement: false,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'item_old_mead', 'item_dzban_miodu']
  });

  props.push({
    id: 'loot_hunter_pack',
    name: 'Sakwa Myśliwego (Kiełbasa, Kaptur i Płaszcz)',
    kind: 'ground_loot',
    x: 18,
    y: 16,
    z: tiles[16][18].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 0.9,
    blocksMovement: false,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'helm_shadow_hood', 'cloak_crimson_mantle']
  });

  props.push({
    id: 'loot_knight_armory',
    name: 'Porzucony Rynsztunek Rycerza (Zbroja Płytowa, Hełm, Tarcza)',
    kind: 'ground_loot',
    x: 12,
    y: 12,
    z: tiles[12][12].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 0.9,
    blocksMovement: false,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: [
      'torso_aethel_plate',
      'helm_dread_plate',
      'offhand_heraldic_shield',
      'cloak_steel_pauldrons'
    ]
  });

  props.push({
    id: 'loot_stream_herbs',
    name: 'Kępa Ziół Księżycowych i Kostur nad Stawem',
    kind: 'ground_loot',
    x: 11,
    y: 21,
    z: tiles[21][11].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 0.9,
    blocksMovement: false,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: [
      'item_moon_herbs',
      'weapon_astral_staff',
      'torso_archmage_robes',
      'item_piolun_herb',
      'item_dziurawiec_herb',
      'trinket_motanka'
    ]
  });

  props.push({
    id: 'chest_watchtower_ruins',
    name: 'Okuta Skrzynia w Ruinach Strażnicy',
    kind: 'chest',
    x: 23,
    y: 8,
    z: tiles[8][23].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['weapon_Executioner_axe', 'helm_arcane_circlet', 'item_runic_compass', 'offhand_grimoire']
  });

  // 5. Ancient Druid Hill Props (NW Hill at Z=2)
  props.push({
    id: 'altar_druid_hill',
    name: 'Ołtarz Leśnych Run (2x1)',
    kind: 'runic_altar',
    x: 7,
    y: 7,
    z: tiles[7][7].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  const crystalSpots = [
    { x: 6, y: 6, id: 'crystal_hill_nw' },
    { x: 10, y: 6, id: 'crystal_hill_ne' },
    { x: 11, y: 22, id: 'crystal_pond_south' }
  ];
  for (const c of crystalSpots) {
    const lid = `light_${c.id}`;
    const cz = tiles[c.y][c.x].z;
    lights.push({
      id: lid,
      x: c.x,
      y: c.y,
      z: cz + 1.5,
      color: { r: 68, g: 232, b: 255 },
      intensity: 1.5,
      radius: 6.5,
      flickerSpeed: 2.0,
      enabled: true
    });
    props.push({
      id: c.id,
      name: 'Kamień Świetlistych Run',
      kind: 'arcane_crystal',
      x: c.x,
      y: c.y,
      z: cz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.2,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lid
    });
  }

  // 6. Ruined Watchtower Walls & Interactive Door (NE Bastion x: 20..25, y: 6..11)
  for (let x = 20; x <= 25; x++) {
    props.push({
      id: `ruin_wall_n_${x}`,
      name: 'Mur Ruin Strażnicy',
      kind: 'wall_block',
      x,
      y: 6,
      z: tiles[6][x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.6,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
    if (x !== 22) {
      props.push({
        id: `ruin_wall_s_${x}`,
        name: 'Mur Ruin Strażnicy',
        kind: 'wall_block',
        x,
        y: 11,
        z: tiles[11][x].z,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2.6,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      });
    }
  }
  for (let y = 7; y <= 10; y++) {
    if (y !== 8 && y !== 9) {
      props.push({
        id: `ruin_wall_w_${y}`,
        name: 'Mur Ruin Strażnicy',
        kind: 'wall_block',
        x: 20,
        y,
        z: tiles[y][20].z,
        sizeX: 1,
        sizeY: 1,
        heightZ: 2.6,
        blocksMovement: true,
        blocksSight: true,
        interactive: false
      });
    }
    props.push({
      id: `ruin_wall_e_${y}`,
      name: 'Mur Ruin Strażnicy',
      kind: 'wall_block',
      x: 25,
      y,
      z: tiles[y][25].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.6,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  props.push({
    id: 'door_watchtower',
    name: 'Okute Drzwi Strażnicy',
    kind: 'door',
    x: 22,
    y: 11,
    z: tiles[11][22].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.5,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  // 6B. Slavic Roadside Shrine of Światowid & Travel Signpost to the Slavic Settlement
  const forestShrineLightId = 'light_forest_shrine';
  lights.push({
    id: forestShrineLightId,
    x: 12,
    y: 17,
    z: tiles[17][12].z + 1.4,
    color: { r: 255, g: 188, b: 68 },
    intensity: 1.25,
    radius: 5.5,
    flickerSpeed: 2.8,
    enabled: true
  });
  props.push({
    id: 'forest_slavic_shrine',
    name: 'Przydrożny Posąg Światowida',
    kind: 'slavic_shrine',
    x: 12,
    y: 17,
    z: tiles[17][12].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.4,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: forestShrineLightId
  });

  props.push({
    id: 'signpost_to_slavic_village',
    name: 'Drogowskaz: Słowiańska Osada i Targowisko →',
    kind: 'travel_signpost',
    variant: 0,
    x: 18,
    y: 16,
    z: tiles[16][18].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  props.push({
    id: 'signpost_to_dungeon',
    name: 'Drogowskaz: Zejście do Jaskiń i Lochów ↓',
    kind: 'travel_signpost',
    variant: 0,
    x: 19,
    y: 7,
    z: tiles[7][19].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  // 6C. Isometric Game Kit Watchtower & Exactly 2 Cottages on Outer Edges + 1 Outbuilding
  props.push({
    id: 'watchtower_bastion_ne',
    name: 'Baszta Obserwacyjna Strażnicy',
    kind: 'watchtower',
    variant: 0,
    x: 24,
    y: 7,
    z: tiles[7][24].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 3.4,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true
  });

  // Cottage 1 (Skraj zachodni): Chata Myśliwska
  const hunterLightId = 'light_cabin_hunter';
  lights.push({
    id: hunterLightId,
    x: 7.5,
    y: 10.5,
    z: tiles[10][7].z + 1.6,
    color: { r: 255, g: 186, b: 78 },
    intensity: 1.3,
    radius: 6.2,
    flickerSpeed: 2.4,
    enabled: true
  });
  props.push({
    id: 'cabin_hunter_clearing',
    name: 'Chata Myśliwska na Skraju Polany (2×1)',
    kind: 'slavic_cottage',
    variant: 7,
    x: 7,
    y: 10,
    z: tiles[10][7].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 4.8,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true,
    linkedLightId: hunterLightId
  });

  // Budynek gospodarczy (Skraj zachodni przy chacie myśliwego): Szopa na Drwa i Narzędzia
  props.push({
    id: 'shed_woodcutter_outbuilding',
    name: 'Szopa na Drwa i Narzędzia (Budynek Gospodarczy, 1×2)',
    kind: 'slavic_cottage',
    variant: 11,
    x: 6,
    y: 12,
    z: tiles[12][6].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 3.6,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  // Cottage 2 (Skraj wschodni): Chata Zielarki
  const herbalistLightId = 'light_cottage_herbalist';
  lights.push({
    id: herbalistLightId,
    x: 22.5,
    y: 19.5,
    z: tiles[19][22].z + 1.6,
    color: { r: 255, g: 186, b: 78 },
    intensity: 1.3,
    radius: 6.2,
    flickerSpeed: 2.4,
    enabled: true
  });
  props.push({
    id: 'cottage_herbalist_clearing',
    name: 'Chata Zielarki na Skraju Polany (2×1)',
    kind: 'slavic_cottage',
    variant: 9,
    x: 22,
    y: 19,
    z: tiles[19][22].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 4.8,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true,
    linkedLightId: herbalistLightId
  });

  const clearingRockCliffs = [
    { x: 5, y: 11, v: 0, name: 'Skalna Turnia Wzgórza Druidów' },
    { x: 11, y: 5, v: 2, name: 'Omszały Głaz Narzutowy' },
    { x: 6, y: 23, v: 4, name: 'Skalna Skarpa nad Stawem' },
    { x: 25, y: 12, v: 6, name: 'Urwisko pod Strażnicą' }
  ];
  for (const rc of clearingRockCliffs) {
    props.push({
      id: `cliff_${rc.x}_${rc.y}`,
      name: rc.name,
      kind: 'rock_cliff',
      variant: rc.v,
      x: rc.x,
      y: rc.y,
      z: tiles[rc.y][rc.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.4,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  const clearingDeadTrees = [
    { x: 6, y: 20, v: 0 },
    { x: 10, y: 23, v: 3 },
    { x: 19, y: 6, v: 6 }
  ];
  for (const dt of clearingDeadTrees) {
    props.push({
      id: `dead_tree_${dt.x}_${dt.y}`,
      name: 'Uschnięte Drzewo Moczaru',
      kind: 'dead_tree',
      variant: dt.v,
      x: dt.x,
      y: dt.y,
      z: tiles[dt.y][dt.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 3.0,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  const druidIronFences = [
    { x: 5, y: 10, v: 0 },
    { x: 6, y: 10, v: 1 },
    { x: 10, y: 10, v: 2 },
    { x: 11, y: 10, v: 3 }
  ];
  for (const gf of druidIronFences) {
    props.push({
      id: `gfence_${gf.x}_${gf.y}`,
      name: 'Kute Ogrodzenie Kręgu Druidów',
      kind: 'graveyard_fence',
      variant: gf.v,
      x: gf.x,
      y: gf.y,
      z: tiles[gf.y][gf.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.3,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // 7. Surrounding Dense Forest Perimeter (19 OGA + Glionox Tree Variants + Stumps + Berry Bushes + Wildflowers)
  const occupied = new Set<string>([
    '15,16', // Player spawn
    '16,14', // NPC Torvin
    '13,15', // NPC Lyra
    '22,9'   // NPC Vaelen
  ]);
  for (const p of props) {
    for (let dy = 0; dy < p.sizeY; dy++) {
      for (let dx = 0; dx < p.sizeX; dx++) {
        occupied.add(`${p.x + dx},${p.y + dy}`);
      }
    }
  }

  // 7A. Scenic Glionox Tree Stumps (`forest_stumps.png` variants 0..8)
  const stumpLocations = [
    { x: 11, y: 15, v: 0 },
    { x: 19, y: 14, v: 1 },
    { x: 10, y: 18, v: 2 },
    { x: 17, y: 20, v: 3 },
    { x: 13, y: 11, v: 4 },
    { x: 8, y: 14, v: 5 },
    { x: 22, y: 16, v: 6 },
    { x: 13, y: 23, v: 7 },
    { x: 18, y: 25, v: 8 }
  ];
  for (const st of stumpLocations) {
    if (occupied.has(`${st.x},${st.y}`)) continue;
    occupied.add(`${st.x},${st.y}`);
    props.push({
      id: `stump_${st.x}_${st.y}`,
      name: 'Pień Ściętego Drzewa',
      kind: 'tree_stump',
      variant: st.v,
      x: st.x,
      y: st.y,
      z: tiles[st.y][st.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 0.9,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // 7B. Glionox Lush & Berry Bushes (`forest_env.png` row 4 variants 0..7)
  const bushLocations = [
    { x: 11, y: 19, v: 4, name: 'Krzew Leśnych Jagód' },
    { x: 6, y: 19, v: 5, name: 'Krzew Leśnych Jagód' },
    { x: 10, y: 24, v: 6, name: 'Krzew Dziki Maliniak' },
    { x: 19, y: 12, v: 7, name: 'KrzewZłotych Jagód' },
    { x: 13, y: 20, v: 0, name: 'Gęsty Krzew Leszczyny' },
    { x: 20, y: 21, v: 1, name: 'Krzew Paprociowy' },
    { x: 8, y: 11, v: 2, name: 'Krzew Wzgórza Druidów' },
    { x: 18, y: 19, v: 3, name: 'Krzew Polany' }
  ];
  for (const b of bushLocations) {
    if (occupied.has(`${b.x},${b.y}`)) continue;
    occupied.add(`${b.x},${b.y}`);
    props.push({
      id: `bush_${b.x}_${b.y}`,
      name: b.name,
      kind: 'berry_bush',
      variant: b.v,
      x: b.x,
      y: b.y,
      z: tiles[b.y][b.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.0,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (occupied.has(`${x},${y}`)) continue;

      const isExitCorridor = x >= 14 && x <= 17 && y >= 15;
      if (isExitCorridor) continue;

      const dist = Math.hypot(x - centerX, y - centerY);
      const isOuterBorder = x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2;
      const isForestRing = dist >= 12.6 && ((x * 7 + y * 13) % 3 === 0);
      const isScenicCluster =
        (x === 9 && y === 16) ||
        (x === 21 && y === 18) ||
        (x === 12 && y === 24) ||
        (x === 19 && y === 23);

      if (isOuterBorder || isForestRing || isScenicCluster) {
        const treeVariant = (x * 7 + y * 13) % 19;
        const isOak = treeVariant % 2 === 1;
        props.push({
          id: `tree_${x}_${y}`,
          name: isOak ? 'Prastary Dąb Puszczy' : 'Wysoka Sosna Puszczy',
          kind: isOak ? 'ancient_oak' : 'pine_tree',
          variant: treeVariant,
          x,
          y,
          z: tiles[y][x].z,
          sizeX: 1,
          sizeY: 1,
          heightZ: 3.2,
          blocksMovement: true,
          blocksSight: true,
          interactive: false
        });
        occupied.add(`${x},${y}`);
      } else if (
        tiles[y][x].terrain === 'forest_grass' &&
        dist > 4.2 &&
        dist < 11.8 &&
        (x * 19 + y * 31) % 7 === 0
      ) {
        // Walkable OGA + Glionox Wildflowers & Tall Grass Clusters (variants 0..39)
        const floraVariant = (x * 11 + y * 17) % 40;
        props.push({
          id: `flora_${x}_${y}`,
          name: floraVariant < 20 ? 'Kępa Polnych Kwiatów' : 'Wysoka Trawa Leśna',
          kind: 'wildflower_patch',
          variant: floraVariant,
          x,
          y,
          z: tiles[y][x].z,
          sizeX: 1,
          sizeY: 1,
          heightZ: 0.4,
          blocksMovement: false,
          blocksSight: false,
          interactive: false
        });
      }
    }
  }

  return {
    id: 'forest_clearing',
    name: 'Polana Wilczego Ognia',
    subtitle: 'Otoczona puszczą polana obozowa (32×32) — Pieczenie na ognisku & Pokaz silnika',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}

/**
 * Generates the Slavic Dark-Fantasy Settlement & Marketplace (32x32):
 * "Osada Nadbrzeżna: Targowisko pod Światowidem"
 * Features thatched-roof log cottages, bustling vendor stalls with linen awnings,
 * a central village well, a sacred hill grove with a four-faced Światowid idol,
 * woven willow wattle fences, and surrounding forest/stream outskirts.
 */
export function createSlavicVillageMap(): IsometricWorldMap {
  const width = 44;
  const height = 44;
  const tiles: TileCell[][] = [];
  const props: WorldPropEntity[] = [];
  const lights: PointLightSource[] = [];

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      let z = 0;
      let terrain: TileTerrainType = 'forest_grass';
      let walkable = true;

      // 1. Sacred Pagan Hill Grove of Światowid in North-West (x: 5..14, y: 5..14)
      if (x >= 5 && x <= 14 && y >= 5 && y <= 14) {
        z = 1;
        terrain = 'forest_grass';
        if (x >= 8 && x <= 11 && y >= 8 && y <= 11) {
          z = 2;
          terrain = 'mossy_cobble';
        }
      }

      // Stone steps ascending to the Sacred Grove
      if ((x === 11 || x === 12) && y === 14) {
        z = 1;
        terrain = 'stairs_stone';
      }
      if (x === 14 && (y === 11 || y === 12)) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // 2. Ancestral Kurhan & Burial Mound in North-East (x: 30..39, y: 4..12)
      if (x >= 30 && x <= 39 && y >= 4 && y <= 12) {
        z = 1;
        terrain = 'forest_soil';
        if (x >= 33 && x <= 36 && y >= 6 && y <= 9) {
          z = 2;
          terrain = 'arcane_inlay';
        }
      }

      // Stone steps ascending to the Ancestral Kurhan
      if ((x === 29 || x === 30) && (y === 7 || y === 8)) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // 3. Central Marketplace Plaza (Rynek Osady, center at 22, 22)
      if (x >= 16 && x <= 28 && y >= 16 && y <= 28) {
        const distCenter = Math.hypot(x - 22, y - 22);
        if (distCenter <= 5.5) {
          terrain = 'mossy_cobble';
        } else if (distCenter <= 7.2) {
          terrain = 'dirt_path';
        }
      }

      // 4. Village Roads connecting gates, cottages, market square, kurhan, and mill
      const isSouthRoad = x >= 21 && x <= 23 && y >= 22 && y < height;
      const isNorthRoad = x >= 21 && x <= 23 && y >= 2 && y <= 22;
      const isEastRoad = y >= 21 && y <= 23 && x >= 22 && x <= 38;
      const isWestRoad = y >= 21 && y <= 23 && x >= 5 && x <= 22;
      const isKurhanRoad = x >= 28 && x <= 29 && y >= 8 && y <= 21;
      const isWharfRoad = x >= 28 && x <= 29 && y >= 23 && y <= 32;
      const isGroveRoad = y === 15 && x >= 12 && x <= 21;
      if (
        (isSouthRoad || isNorthRoad || isEastRoad || isWestRoad || isKurhanRoad || isWharfRoad || isGroveRoad) &&
        z === 0
      ) {
        if (terrain !== 'mossy_cobble') {
          terrain = 'dirt_path';
        }
      }

      // 5. Scenic Stream, Mill Pond & Fisherman's Wharf in South-East (x: 30..42, y: 28..40)
      const pondDist = Math.hypot((x - 36) * 0.9, (y - 34) * 1.1);
      const isPier = (x === 30 || x === 31) && (y === 31 || y === 32);
      const isMillFoundation = (x === 34 || x === 35) && y === 35;
      if (isPier) {
        z = 0;
        terrain = 'dungeon_stone';
        walkable = true;
      } else if (isMillFoundation) {
        z = 0;
        terrain = 'forest_soil';
        walkable = true;
      } else if (pondDist <= 3.6) {
        terrain = 'abyss_water';
        walkable = false;
      } else if (pondDist <= 5.2 && terrain === 'forest_grass') {
        terrain = 'forest_soil';
      }

      row.push({ x, y, z, terrain, walkable });
    }
    tiles.push(row);
  }

  // --- A. Central Village Well & Communal Market Campfire ---
  props.push({
    id: 'village_central_well',
    name: 'Studnia Gromadna z Żurawiem',
    kind: 'slavic_well',
    x: 22,
    y: 22,
    z: tiles[22][22].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false
  });

  const marketFireLightId = 'light_village_campfire';
  lights.push({
    id: marketFireLightId,
    x: 20,
    y: 24,
    z: tiles[24][20].z + 1.2,
    color: { r: 255, g: 156, b: 54 },
    intensity: 1.55,
    radius: 8.5,
    flickerSpeed: 4.6,
    enabled: true
  });
  props.push({
    id: 'village_market_campfire',
    name: 'Ognisko Targowe (Ruszt Kucharski)',
    kind: 'campfire',
    x: 20,
    y: 24,
    z: tiles[24][20].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.3,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: marketFireLightId
  });

  // --- B. Bustling Marketplace Stalls (Kramy Kupieckie) ---
  props.push({
    id: 'stall_dobromir_wares',
    name: 'Kram Kupca Dobromira (Sukno, Bursztyn i Prowiant)',
    kind: 'market_stall',
    variant: 0,
    x: 19,
    y: 19,
    z: tiles[19][19].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'cloak_crimson_mantle', 'trinket_lunula', 'item_dzban_miodu']
  });

  props.push({
    id: 'stall_herbalist_wislawa',
    name: 'Stragan Zielarki Wisławy (Zioła i Amulety)',
    kind: 'market_stall',
    variant: 1,
    x: 24,
    y: 19,
    z: tiles[19][24].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: [
      'ring_emerald_seal',
      'helm_arcane_circlet',
      'item_piolun_herb',
      'item_dziurawiec_herb',
      'trinket_motanka'
    ]
  });

  props.push({
    id: 'stall_smith_bozydar',
    name: 'Kram Płatnerza Bożydara (Oręż i Zbroje)',
    kind: 'market_stall',
    variant: 2,
    x: 25,
    y: 23,
    z: tiles[23][25].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: [
      'weapon_slavic_axe',
      'offhand_slavic_shield',
      'helm_szyszak',
      'torso_przeszywanica',
      'legs_lapcie'
    ]
  });

  props.push({
    id: 'stall_baker_wares',
    name: 'Kram Prowiantowy (Chleb, Kołacze i Miód)',
    kind: 'market_stall',
    variant: 0,
    x: 19,
    y: 23,
    z: tiles[23][19].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'item_old_mead']
  });

  // Barrels and Crates in Market Square
  const marketBarrels = [
    { id: 'm_bar_1', x: 18, y: 19, name: 'Beczka Solonych Śledzi' },
    { id: 'm_bar_2', x: 26, y: 24, name: 'Beczka Smoły Kuźniczej' },
    { id: 'm_bar_3', x: 21, y: 25, name: 'Beczka Miodu Pitnego' }
  ];
  for (const mb of marketBarrels) {
    props.push({
      id: mb.id,
      name: mb.name,
      kind: 'dungeon_barrel',
      x: mb.x,
      y: mb.y,
      z: tiles[mb.y][mb.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.2,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: false
    });
  }

  const marketCrates = [
    { id: 'm_cra_1', x: 19, y: 18, name: 'Skrzynia Sukna i Futer' },
    { id: 'm_cra_2', x: 25, y: 22, name: 'Skrzynia Sztab Żelaza' }
  ];
  for (const mc of marketCrates) {
    props.push({
      id: mc.id,
      name: mc.name,
      kind: 'dungeon_crate',
      x: mc.x,
      y: mc.y,
      z: tiles[mc.y][mc.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.1,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: false
    });
  }

  // --- C. Slavic Log Cottages & Farmstead Outbuildings (20 buildings: cottages + barns/sheds/spichlerze) ---
  const villageBuildings: ReadonlyArray<{
    id: string;
    name: string;
    x: number;
    y: number;
    sizeX: number;
    sizeY: number;
    variant: number;
  }> = [
    // 1. Dwór Starosty i Kniazia Gniewomira
    {
      id: 'cottage_elder_starosta',
      name: 'Dwór Starosty i Króla Gniewomira (Chata z Gankiem)',
      x: 19,
      y: 12,
      sizeX: 2,
      sizeY: 1,
      variant: 0
    },
    // 2. Budynek gospodarczy dworu: Wielki Spichlerz Gromadzki
    {
      id: 'barn_granary_communal',
      name: 'Wielki Spichlerz Gromadzki i Magazyn Kupiecki',
      x: 14,
      y: 12,
      sizeX: 2,
      sizeY: 1,
      variant: 4
    },
    // 3. Karczma Grodowa
    {
      id: 'cottage_inn_wolf_fang',
      name: 'Gospoda „Pod Wilczym Kłem” (Karczma Zrębowa)',
      x: 27,
      y: 14,
      sizeX: 2,
      sizeY: 1,
      variant: 5
    },
    // 4. Budynek gospodarczy karczmy: Wozownia i Stajenka
    {
      id: 'shed_inn_stable',
      name: 'Wozownia i Stajenka Karczemna (Budynek Gospodarczy)',
      x: 30,
      y: 14,
      sizeX: 1,
      sizeY: 2,
      variant: 12
    },
    // 5. Kuźnia Grodowa
    {
      id: 'cottage_blacksmith_bozydar',
      name: 'Kuźnia Płatnerza Bożydara (Dymarka i Kowadło)',
      x: 27,
      y: 20,
      sizeX: 2,
      sizeY: 1,
      variant: 7
    },
    // 6. Budynek gospodarczy kuźni: Szopa na węgiel i narzędzia
    {
      id: 'shed_blacksmith_forge',
      name: 'Szopa Kuźnicza i Skład Węgla (Budynek Gospodarczy)',
      x: 30,
      y: 20,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 7. Chata Zielarki
    {
      id: 'cottage_herbalist_hut',
      name: 'Chata Zielarki Wisławy (Strzecha)',
      x: 12,
      y: 24,
      sizeX: 1,
      sizeY: 2,
      variant: 9
    },
    // 8. Budynek gospodarczy zielarki: Suszarnia ziół
    {
      id: 'shed_herbalist_drying',
      name: 'Suszarnia Ziół i Chlewik Zielarki (Budynek Gospodarczy)',
      x: 10,
      y: 25,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 9. Zagroda Gospodarska Północna
    {
      id: 'cottage_hunter_north',
      name: 'Zagroda Chłopska Północna (Chata Rolnika)',
      x: 25,
      y: 8,
      sizeX: 2,
      sizeY: 1,
      variant: 2
    },
    // 10. Budynek gospodarczy: Wielka Stodoła na Siano
    {
      id: 'barn_peasant_north',
      name: 'Wielka Stodoła na Siano i Snopek (Budynek Gospodarczy)',
      x: 28,
      y: 8,
      sizeX: 2,
      sizeY: 1,
      variant: 4
    },
    // 11. Chata Rzemieślnicza Tkaczki i Garncarki
    {
      id: 'cottage_potter_weaver',
      name: 'Chata Garncarki i Tkaczki',
      x: 11,
      y: 29,
      sizeX: 2,
      sizeY: 1,
      variant: 1
    },
    // 12. Budynek gospodarczy garncarki: Wiata na glinę i piec
    {
      id: 'shed_potter_kiln',
      name: 'Wiata na Glinę i Piec Garncarski (Budynek Gospodarczy)',
      x: 8,
      y: 29,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 13. Chata Drwala i Smolarza
    {
      id: 'cottage_woodcutter',
      name: 'Chata Drwala i Smolarza',
      x: 7,
      y: 17,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 14. Budynek gospodarczy: Drewutnia gromadzka na kłody
    {
      id: 'shed_woodcutter_logs',
      name: 'Drewutnia Gromadzka na Kłody i Drzewce (Budynek Gospodarczy)',
      x: 7,
      y: 19,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 15. Chata Rybaka nad Przystanią
    {
      id: 'cottage_fisherman_pond',
      name: 'Chata Rybaka nad Przystanią',
      x: 34,
      y: 26,
      sizeX: 2,
      sizeY: 1,
      variant: 14
    },
    // 16. Budynek gospodarczy rybaka: Wiata na sieci i czółna
    {
      id: 'shed_wharf_nets',
      name: 'Wiata Rybacka na Sieci i Czółna (Budynek Gospodarczy)',
      x: 34,
      y: 28,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 17. Chata Kołodzieja i Rymarza
    {
      id: 'cottage_wheelwright',
      name: 'Chata Kołodzieja i Bartnika',
      x: 26,
      y: 27,
      sizeX: 2,
      sizeY: 1,
      variant: 12
    },
    // 18. Budynek gospodarczy kołodzieja: Szopa na koła i osie
    {
      id: 'shed_wheelwright_timber',
      name: 'Szopa Kołodziejska z Kołami i Ośkami (Budynek Gospodarczy)',
      x: 29,
      y: 27,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    // 19. Wartownia Straży Grodowej przy Bramie Południowej
    {
      id: 'cottage_gatekeeper',
      name: 'Wartownia Strażników Bramy Południowej',
      x: 18,
      y: 34,
      sizeX: 1,
      sizeY: 2,
      variant: 3
    },
    // 20. Młyn Wodny Nadbrzeżny
    {
      id: 'cottage_watermill',
      name: 'Młyn Wodny Nadbrzeżny z Kołem Młyńskim (Budynek Gospodarczy)',
      x: 34,
      y: 35,
      sizeX: 2,
      sizeY: 1,
      variant: 8
    }
  ];

  for (const c of villageBuildings) {
    const cz = tiles[c.y][c.x].z;
    const lightId = `light_${c.id}`;
    lights.push({
      id: lightId,
      x: c.x + 0.5,
      y: c.y + 0.5,
      z: cz + 1.5,
      color: { r: 255, g: 186, b: 78 },
      intensity: 1.25,
      radius: 6.0,
      flickerSpeed: 2.4,
      enabled: true
    });
    props.push({
      id: c.id,
      name: c.name,
      kind: 'slavic_cottage',
      variant: c.variant,
      x: c.x,
      y: c.y,
      z: cz,
      sizeX: c.sizeX,
      sizeY: c.sizeY,
      heightZ: 4.8,
      blocksMovement: true,
      blocksSight: true,
      interactive: true,
      isOpen: true,
      linkedLightId: lightId
    });
  }

  // --- D. Sacred Pagan Shrine of Four-Faced Światowid on Grove Hill ---
  const shrineLightId = 'light_swiatowid_grove';
  lights.push({
    id: shrineLightId,
    x: 9,
    y: 9,
    z: tiles[9][9].z + 1.6,
    color: { r: 255, g: 196, b: 64 },
    intensity: 1.5,
    radius: 7.2,
    flickerSpeed: 3.1,
    enabled: true
  });
  props.push({
    id: 'shrine_swiatowid_hill',
    name: 'Posąg Czterotwarzowego Światowida (Święty Gaj)',
    kind: 'slavic_shrine',
    x: 9,
    y: 9,
    z: tiles[9][9].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.6,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: shrineLightId
  });

  // --- D2. Ancestral Kurhan & Burial Mound of Ancient Kniaz (North-East) ---
  const kurhanLightId = 'light_ancestral_kurhan';
  lights.push({
    id: kurhanLightId,
    x: 34.5,
    y: 7.5,
    z: tiles[7][34].z + 1.8,
    color: { r: 168, g: 92, b: 255 },
    intensity: 1.6,
    radius: 7.0,
    flickerSpeed: 3.8,
    enabled: true
  });

  props.push({
    id: 'prop_kurhan_sarcophagus',
    name: 'Kamienny Sarkofag Dawnego Kniazia na Kurhanie',
    kind: 'sarcophagus',
    variant: 0,
    x: 34,
    y: 7,
    z: tiles[7][34].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'trinket_kolowrot', 'trinket_lunula', 'weapon_slavic_axe']
  });

  props.push({
    id: 'prop_kurhan_arcane_crystal',
    name: 'Runiczny Monolit Duszy Przodków',
    kind: 'arcane_crystal',
    variant: 0,
    x: 33,
    y: 6,
    z: tiles[6][33].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: kurhanLightId
  });

  const kurhanPillars = [
    { id: 'kurhan_pillar_nw', x: 32, y: 5, v: 1 },
    { id: 'kurhan_pillar_sw', x: 32, y: 9, v: 3 },
    { id: 'kurhan_pillar_ne', x: 37, y: 5, v: 5 },
    { id: 'kurhan_pillar_se', x: 37, y: 9, v: 7 }
  ];
  for (const kp of kurhanPillars) {
    props.push({
      id: kp.id,
      name: 'Starożytny Obelisk Kurhanu',
      kind: 'pillar',
      variant: kp.v,
      x: kp.x,
      y: kp.y,
      z: tiles[kp.y][kp.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.3,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  props.push({
    id: 'watchtower_kurhan',
    name: 'Baszta Cmentarna i Obserwacyjna Kurhanu',
    kind: 'watchtower',
    variant: 2,
    x: 37,
    y: 6,
    z: tiles[6][37].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 3.6,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true
  });

  const kurhanFences = [
    { x: 31, y: 4, v: 0 },
    { x: 32, y: 4, v: 1 },
    { x: 33, y: 4, v: 2 },
    { x: 34, y: 4, v: 3 },
    { x: 38, y: 5, v: 4 },
    { x: 38, y: 6, v: 5 },
    { x: 38, y: 7, v: 4 },
    { x: 33, y: 10, v: 0 },
    { x: 34, y: 10, v: 1 },
    { x: 35, y: 10, v: 2 }
  ];
  for (const kf of kurhanFences) {
    props.push({
      id: `kfence_${kf.x}_${kf.y}`,
      name: 'Kute Ogrodzenie Cmentarne Kurhanu',
      kind: 'graveyard_fence',
      variant: kf.v,
      x: kf.x,
      y: kf.y,
      z: tiles[kf.y][kf.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.3,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  const kurhanDeadTrees = [
    { x: 30, y: 4, v: 1 },
    { x: 38, y: 8, v: 3 }
  ];
  for (const dt of kurhanDeadTrees) {
    props.push({
      id: `kdeadtree_${dt.x}_${dt.y}`,
      name: 'Uschnięte Drzewo Kurhanu',
      kind: 'dead_tree',
      variant: dt.v,
      x: dt.x,
      y: dt.y,
      z: tiles[dt.y][dt.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.7,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // --- E. Woven Willow Wattle Fences around Homestead Yards (20+ fences) ---
  const fenceCoords: ReadonlyArray<{ x: number; y: number; v: number }> = [
    { x: 18, y: 12, v: 0 },
    { x: 21, y: 12, v: 0 },
    { x: 13, y: 12, v: 0 },
    { x: 16, y: 12, v: 0 },
    { x: 26, y: 14, v: 0 },
    { x: 29, y: 14, v: 0 },
    { x: 26, y: 20, v: 0 },
    { x: 29, y: 20, v: 0 },
    { x: 11, y: 24, v: 1 },
    { x: 11, y: 25, v: 1 },
    { x: 11, y: 26, v: 1 },
    { x: 25, y: 27, v: 0 },
    { x: 28, y: 27, v: 0 },
    { x: 6, y: 17, v: 1 },
    { x: 6, y: 18, v: 1 },
    { x: 6, y: 19, v: 1 },
    { x: 10, y: 29, v: 0 },
    { x: 13, y: 29, v: 0 },
    { x: 24, y: 8, v: 0 },
    { x: 27, y: 8, v: 0 },
    { x: 30, y: 8, v: 0 }
  ];

  for (const f of fenceCoords) {
    props.push({
      id: `fence_${f.x}_${f.y}`,
      name: 'Pleciony Płot Wiklinowy',
      kind: 'wattle_fence',
      variant: f.v,
      x: f.x,
      y: f.y,
      z: tiles[f.y][f.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.1,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // --- F. Travel Signposts (Bidirectional connections to Forest Clearing and Dungeons) ---
  props.push({
    id: 'signpost_to_forest_clearing',
    name: 'Drogowskaz: Polana Wilczego Ognia ←',
    kind: 'travel_signpost',
    x: 22,
    y: 36,
    z: tiles[36][22].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  props.push({
    id: 'signpost_to_dungeon',
    name: 'Drogowskaz: Zejście do Jaskiń i Lochów Aethelgardu ↓',
    kind: 'travel_signpost',
    x: 22,
    y: 5,
    z: tiles[5][22].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  props.push({
    id: 'village_chest_starosta',
    name: 'Okuta Skrzynia Starosty',
    kind: 'chest',
    variant: 0,
    x: 18,
    y: 13,
    z: tiles[13][18].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'weapon_astral_staff']
  });

  // Wharf & Pier Props (South-East)
  props.push({
    id: 'village_chest_wharf_1',
    name: 'Skrzynia Rybacka z Narzędziami',
    kind: 'chest',
    variant: 1,
    x: 30,
    y: 31,
    z: tiles[31][30].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'legs_leather_boots']
  });

  props.push({
    id: 'village_chest_wharf_2',
    name: 'Beczka i Skrzynia Towarowa Przystani',
    kind: 'chest',
    variant: 2,
    x: 31,
    y: 32,
    z: tiles[32][31].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['ring_emerald_seal']
  });

  const wharfDeadTrees = [
    { x: 33, y: 31, v: 0 },
    { x: 39, y: 35, v: 2 }
  ];
  for (const wdt of wharfDeadTrees) {
    props.push({
      id: `wdeadtree_${wdt.x}_${wdt.y}`,
      name: 'Pochylona Sosna Bagienna nad Wodą',
      kind: 'dead_tree',
      variant: wdt.v,
      x: wdt.x,
      y: wdt.y,
      z: tiles[wdt.y][wdt.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 4.8,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // --- F2. Village Watchtowers, Street Lanterns, Sacred Grove Iron Fences & Rock Cliffs ---
  const villageWatchtowers = [
    { id: 'watchtower_south_west', name: 'Baszta Strażnicza Bramy Zachodniej', x: 18, y: 38, v: 1 },
    { id: 'watchtower_south_east', name: 'Kamienna Baszta Straży Grodowej', x: 24, y: 38, v: 0 },
    { id: 'watchtower_north_pass', name: 'Baszta Obserwacyjna Przełęczy Północnej', x: 24, y: 4, v: 0 }
  ];
  for (const wt of villageWatchtowers) {
    props.push({
      id: wt.id,
      name: wt.name,
      kind: 'watchtower',
      variant: wt.v,
      x: wt.x,
      y: wt.y,
      z: tiles[wt.y][wt.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 3.4,
      blocksMovement: true,
      blocksSight: true,
      interactive: true,
      isOpen: true
    });
  }

  const villageLanterns = [
    { id: 'lantern_market_nw', x: 18, y: 20 },
    { id: 'lantern_market_ne', x: 26, y: 20 },
    { id: 'lantern_road_south', x: 21, y: 32 },
    { id: 'lantern_wharf', x: 29, y: 31 },
    { id: 'lantern_kurhan_approach', x: 29, y: 10 },
    { id: 'lantern_sacred_steps', x: 13, y: 15 },
    { id: 'lantern_gate_north', x: 21, y: 6 }
  ];
  for (const vl of villageLanterns) {
    const lid = `light_${vl.id}`;
    const lz = tiles[vl.y][vl.x].z;
    lights.push({
      id: lid,
      x: vl.x,
      y: vl.y,
      z: lz + 1.5,
      color: { r: 255, g: 184, b: 76 },
      intensity: 1.3,
      radius: 5.8,
      flickerSpeed: 3.2,
      enabled: true
    });
    props.push({
      id: vl.id,
      name: 'Latarnia Grodowa na Słupie',
      kind: 'torch_sconce',
      variant: 1,
      x: vl.x,
      y: vl.y,
      z: lz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.9,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lid
    });
  }

  const groveIronFences = [
    { x: 6, y: 13, v: 0 },
    { x: 7, y: 13, v: 1 },
    { x: 8, y: 13, v: 2 },
    { x: 13, y: 9, v: 4 },
    { x: 13, y: 10, v: 5 }
  ];
  for (const gf of groveIronFences) {
    props.push({
      id: `vgfence_${gf.x}_${gf.y}`,
      name: 'Kute Ogrodzenie Świętego Gaju',
      kind: 'graveyard_fence',
      variant: gf.v,
      x: gf.x,
      y: gf.y,
      z: tiles[gf.y][gf.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.3,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  const villageCliffs = [
    { x: 5, y: 14, v: 1 },
    { x: 14, y: 5, v: 3 },
    { x: 29, y: 34, v: 0 },
    { x: 31, y: 36, v: 4 },
    { x: 39, y: 37, v: 6 }
  ];
  for (const vc of villageCliffs) {
    props.push({
      id: `vcliff_${vc.x}_${vc.y}`,
      name: 'Skalna Skarpa Nadbrzeżna',
      kind: 'rock_cliff',
      variant: vc.v,
      x: vc.x,
      y: vc.y,
      z: tiles[vc.y][vc.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.4,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  // --- G. Surrounding Slavic Forest Perimeter & Wildflowers ---
  const occupied = new Set<string>([
    '22,26', // Player spawn
    '21,15', // NPC Król Gniewomir
    '20,20', // NPC Kupiec Dobromir
    '26,21', // NPC Płatnerz Bożydar
    '10,9',  // NPC Żerca Radogost
    '22,24'  // Marketplace center
  ]);
  for (const p of props) {
    for (let dy = 0; dy < p.sizeY; dy++) {
      for (let dx = 0; dx < p.sizeX; dx++) {
        occupied.add(`${p.x + dx},${p.y + dy}`);
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (occupied.has(`${x},${y}`)) continue;
      if (!tiles[y][x].walkable) continue;
      if (tiles[y][x].terrain === 'dirt_path' || tiles[y][x].terrain === 'mossy_cobble') continue;

      const isOuterBorder = x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2;
      const distCenter = Math.hypot(x - 22, y - 22);
      const isOutskirtWoods = distCenter >= 16.5 && (x * 11 + y * 17) % 3 === 0;

      if (isOuterBorder || isOutskirtWoods) {
        const treeVariant = (x * 7 + y * 13) % 19;
        const isOak = treeVariant % 2 === 0;
        props.push({
          id: `vtree_${x}_${y}`,
          name: isOak ? 'Dąb Świętego Gaju' : 'Sosna Nadbrzeżna',
          kind: isOak ? 'ancient_oak' : 'pine_tree',
          variant: treeVariant,
          x,
          y,
          z: tiles[y][x].z,
          sizeX: 1,
          sizeY: 1,
          heightZ: 3.2,
          blocksMovement: true,
          blocksSight: true,
          interactive: false
        });
        occupied.add(`${x},${y}`);
      } else if ((x * 19 + y * 29) % 8 === 0) {
        const floraVariant = (x * 13 + y * 23) % 40;
        props.push({
          id: `vflora_${x}_${y}`,
          name: floraVariant < 20 ? 'Słowiańskie Zioła i Kwiaty' : 'Kępa Trawy Łąkowej',
          kind: 'wildflower_patch',
          variant: floraVariant,
          x,
          y,
          z: tiles[y][x].z,
          sizeX: 1,
          sizeY: 1,
          heightZ: 0.4,
          blocksMovement: false,
          blocksSight: false,
          interactive: false
        });
      }
    }
  }

  return {
    id: 'slavic_village',
    name: 'Osada Żerców — Targowisko pod Światowidem',
    subtitle:
      'Powiększona osada słowiańska (44×44) — 20 chat i budynków gospodarczych, Kurhan Kniazia, Przystań i Młyn, Baszty oraz Święty Gaj Światowida',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}

/**
 * Third Test Location: Multi-zone Cavern & Dungeon Crawler (36x36):
 * "Sanktuarium Zatopionej Korony & Jaskinie Aethelgardu"
 * 
 * Features 3 progressive zones:
 * Zone 1: Upper Caverns (wilgotne pieczary, podziemne jezioro, drewniane podpory kopalniane, 4 łatwych wrogów)
 * Zone 2: Catacombs & Crypts (kamienne korytarze, wrota, kolumny, beczki, skrzynie, 3 średnich wrogów)
 * Zone 3: Deep Inner Sanctum & Boss Chamber (marmur, runiczny ołtarz, kryształy eteryczne, złote relikwie, 1 potężny Boss)
 */
export function createSanctumWorldMap(): IsometricWorldMap {
  const width = 36;
  const height = 36;
  const tiles: TileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      let z = 0;
      let terrain: TileTerrainType = 'dungeon_stone';
      let walkable = true;

      // Zone 1: Upper Caverns (x: 2..15, y: 2..16)
      if (x <= 15 && y <= 16) {
        terrain = 'mossy_cobble';
        // Raised cave ridge at NW
        if (x <= 6 && y <= 6) {
          z = 1;
        }
        // Subterranean lake / stream
        if (x >= 2 && x <= 6 && y >= 9 && y <= 14) {
          terrain = 'abyss_water';
          walkable = false;
        }
      }

      // Cave steps down from ridge
      if ((x === 7 && (y === 4 || y === 5)) || (y === 7 && (x === 4 || x === 5))) {
        z = 0;
        terrain = 'stairs_stone';
      }

      // Zone 2: Middle Catacombs & Crypts (x: 16..34, y: 2..17)
      if (x >= 16 && y <= 17) {
        terrain = 'dungeon_stone';
      }

      // Corridor connector stairs between Caverns and Catacombs
      if (x === 15 && (y === 7 || y === 8)) {
        terrain = 'stairs_stone';
      }

      // Zone 3: Inner Sanctum & Boss Chamber (x: 14..34, y: 18..34)
      if (x >= 14 && y >= 18) {
        terrain = 'sanctum_marble';
        // Raised dais in Boss Chamber
        if (x >= 20 && x <= 28 && y >= 22 && y <= 30) {
          z = 1;
          terrain = x >= 22 && x <= 26 && y >= 24 && y <= 28 ? 'arcane_inlay' : 'sanctum_marble';
        }
        // Steps up to the dais
        if ((y === 21 && x >= 23 && x <= 25) || (y === 31 && x >= 23 && x <= 25)) {
          z = 0;
          terrain = 'stairs_stone';
        }
      }

      // Perimeter boundary walls
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        walkable = false;
      }

      row.push({ x, y, z, terrain, walkable });
    }
    tiles.push(row);
  }

  const props: WorldPropEntity[] = [];
  const lights: PointLightSource[] = [];

  const addWall = (x: number, y: number, name = 'Mur Kamienny Głębin'): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const z = tiles[y][x].z;
    props.push({
      id: `wall_${x}_${y}`,
      name,
      kind: 'wall_block',
      x,
      y,
      z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.6,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  };

  // Outer Perimeter Walls
  for (let x = 0; x < width; x++) {
    addWall(x, 0, 'Ściana Skalna Głębin');
    addWall(x, height - 1, 'Ściana Skalna Głębin');
  }
  for (let y = 1; y < height - 1; y++) {
    addWall(0, y, 'Ściana Skalna Głębin');
    addWall(width - 1, y, 'Ściana Skalna Głębin');
  }

  // --- Dividing Wall between Zone 1 (Caverns) and Zone 2 (Catacombs) (x=15, y: 1..17) ---
  for (let y = 1; y <= 17; y++) {
    if (y !== 8) {
      addWall(15, y, 'Kamienny Mur Katakumb');
    }
  }

  // Reinforced Door separating Caverns from Catacombs at (15, 8)
  props.push({
    id: 'door_cavern_gate',
    name: 'Ciężkie Żelazne Wrota Krypt',
    kind: 'door',
    x: 15,
    y: 8,
    z: tiles[8][15].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.5,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  // --- Crypt Internal Chamber Partition Walls (Zone 2) ---
  // North Vault (x: 24..34, y: 8) with door at (28, 8)
  for (let x = 24; x <= 34; x++) {
    if (x !== 28) {
      addWall(x, 8, 'Ściana Krypty Rycerskiej');
    }
  }
  props.push({
    id: 'door_crypt_north',
    name: 'Okute Drzwi Krypty Rycerskiej',
    kind: 'door',
    x: 28,
    y: 8,
    z: tiles[8][28].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.5,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  // Dividing Wall between Zone 2 (Catacombs) and Zone 3 (Sanctum) (y=18, x: 14..34)
  for (let x = 14; x <= 34; x++) {
    if (x !== 24) {
      addWall(x, 18, 'Wielki Portal Sanktuarium');
    }
  }

  // Grand Portal Door leading into Boss Sanctum at (24, 18)
  props.push({
    id: 'door_sanctum_gate',
    name: 'Wielkie Runiczne Wrota Wewnętrznego Sanktuarium',
    kind: 'door',
    x: 24,
    y: 18,
    z: tiles[18][24].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.6,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  // ==========================================
  // ZONE 1: UPPER CAVERNS PROPS & DECORATION
  // ==========================================

  // Surface Travel Signposts (Exit back to Polana / Osada)
  props.push({
    id: 'signpost_to_forest_clearing',
    name: 'Schody na Powierzchnię: Polana Wilczego Ognia ↑',
    kind: 'travel_signpost',
    x: 3,
    y: 3,
    z: tiles[3][3].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  props.push({
    id: 'signpost_to_slavic_village',
    name: 'Tunel do Słowiańskiej Osady ↑',
    kind: 'travel_signpost',
    x: 3,
    y: 4,
    z: tiles[4][3].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true
  });

  // Mine Timber Supports (`dungeon_support`)
  const mineSupports = [
    { x: 6, y: 5, id: 'sup_1' },
    { x: 10, y: 5, id: 'sup_2' },
    { x: 8, y: 9, id: 'sup_3' },
    { x: 13, y: 9, id: 'sup_4' },
    { x: 7, y: 15, id: 'sup_5' },
    { x: 12, y: 15, id: 'sup_6' }
  ];
  for (const s of mineSupports) {
    props.push({
      id: s.id,
      name: 'Drewniana Podpora Kopalniana',
      kind: 'dungeon_support',
      x: s.x,
      y: s.y,
      z: tiles[s.y][s.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.4,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // Supply Crates in Caverns (`dungeon_crate`)
  const cavernCrates = [
    { x: 5, y: 6, id: 'cra_cav_1', loot: ['item_raw_sausage', 'item_healing_salve'] },
    { x: 9, y: 7, id: 'cra_cav_2', loot: ['item_healing_salve'] },
    { x: 13, y: 6, id: 'cra_cav_3', loot: ['item_old_mead'] }
  ];
  for (const c of cavernCrates) {
    props.push({
      id: c.id,
      name: 'Porzucona Skrzynia Poszukiwaczy',
      kind: 'dungeon_crate',
      x: c.x,
      y: c.y,
      z: tiles[c.y][c.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.1,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: false,
      lootItems: c.loot
    });
  }

  // Rock Cliffs in Caverns
  const cavernCliffs = [
    { x: 2, y: 8, v: 0 },
    { x: 5, y: 15, v: 4 },
    { x: 14, y: 4, v: 2 }
  ];
  for (const rc of cavernCliffs) {
    props.push({
      id: `cavcliff_${rc.x}_${rc.y}`,
      name: 'Skalny Występ Jaskiniowy',
      kind: 'rock_cliff',
      variant: rc.v,
      x: rc.x,
      y: rc.y,
      z: tiles[rc.y][rc.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.2,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  // ==========================================
  // ZONE 2: CATACOMBS & CRYPTS PROPS
  // ==========================================

  // Pillars in Crypts
  const cryptPillars = [
    { x: 18, y: 5 },
    { x: 22, y: 5 },
    { x: 18, y: 12 },
    { x: 22, y: 12 },
    { x: 26, y: 12 },
    { x: 30, y: 12 }
  ];
  for (const p of cryptPillars) {
    props.push({
      id: `cpillar_${p.x}_${p.y}`,
      name: 'Kamienna Kolumna Katakumb',
      kind: 'pillar',
      x: p.x,
      y: p.y,
      z: tiles[p.y][p.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.8,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  // Barrels in Crypts (`dungeon_barrel`)
  const cryptBarrels = [
    { x: 17, y: 6, id: 'bar_cr_1', loot: ['item_old_mead'] },
    { x: 22, y: 9, id: 'bar_cr_2', loot: ['item_healing_salve'] },
    { x: 27, y: 5, id: 'bar_cr_3', loot: ['item_raw_sausage'] },
    { x: 32, y: 11, id: 'bar_cr_4', loot: ['item_old_mead'] }
  ];
  for (const b of cryptBarrels) {
    props.push({
      id: b.id,
      name: 'Okuta Beczka ze Smołą',
      kind: 'dungeon_barrel',
      x: b.x,
      y: b.y,
      z: tiles[b.y][b.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.2,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: false,
      lootItems: b.loot
    });
  }

  // Dungeon Tables (`dungeon_table`)
  props.push({
    id: 'tbl_crypt_guard',
    name: 'Kamienny Stół Straży Krypt',
    kind: 'dungeon_table',
    x: 20,
    y: 9,
    z: tiles[9][20].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: false
  });

  props.push({
    id: 'tbl_crypt_cult',
    name: 'Stół Rytualny Guślarzy',
    kind: 'dungeon_table',
    x: 26,
    y: 15,
    z: tiles[15][26].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: false
  });

  // Ancient Crypt Sarcophagi
  props.push({
    id: 'sarcophagus_crypt_1',
    name: 'Sarkofag Rycerza Zakonu Cienia',
    kind: 'sarcophagus',
    x: 31,
    y: 5,
    z: tiles[5][31].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.6,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_przeszywanica', 'weapon_slavic_axe']
  });

  props.push({
    id: 'sarcophagus_crypt_2',
    name: 'Sarkofag Zapomnianego Inkwizytora',
    kind: 'sarcophagus',
    x: 18,
    y: 15,
    z: tiles[15][18].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.6,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['helm_arcane_circlet', 'ring_emerald_seal']
  });

  // Treasure Chests in Crypts
  props.push({
    id: 'chest_crypt_north',
    name: 'Żelazna Skrzynia Strażników Krypt',
    kind: 'chest',
    x: 33,
    y: 6,
    z: tiles[6][33].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['weapon_sunblade_longsword', 'cloak_crimson_mantle', 'item_old_mead']
  });

  props.push({
    id: 'chest_crypt_south',
    name: 'Okuty Kufer Kultu Cieni',
    kind: 'chest',
    x: 29,
    y: 15,
    z: tiles[15][29].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_warden_brigandine', 'legs_leather_boots', 'item_moon_herbs']
  });

  // ==========================================
  // ZONE 3: INNER SANCTUM & BOSS CHAMBER PROPS
  // ==========================================

  // Grand Columns flanking Boss Chamber Dais
  const sanctumPillars = [
    { x: 20, y: 22 },
    { x: 28, y: 22 },
    { x: 20, y: 29 },
    { x: 28, y: 29 }
  ];
  for (const sp of sanctumPillars) {
    props.push({
      id: `spillar_${sp.x}_${sp.y}`,
      name: 'Monolityczna Kolumna Sanktuarium',
      kind: 'pillar',
      x: sp.x,
      y: sp.y,
      z: tiles[sp.y][sp.x].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 3.2,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  // Runic Sacrificial Altar in Center of Dais (24, 25)
  props.push({
    id: 'altar_sunken_crown',
    name: 'Ołtarz Zatopionej Korony (2x1)',
    kind: 'runic_altar',
    x: 23,
    y: 25,
    z: tiles[25][23].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  // Royal Sarcophagus of First Archon
  props.push({
    id: 'sarcophagus_ancient_king',
    name: 'Sarkofag Pierwszego Archonta (1x2)',
    kind: 'sarcophagus',
    x: 21,
    y: 27,
    z: tiles[27][21].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.6,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'trinket_kolowrot']
  });

  // Grand Treasure Vault Chest with Legendary Loot
  props.push({
    id: 'chest_sanctum_vault',
    name: 'Królewski Relikwiarz Zatopionej Korony',
    kind: 'chest',
    x: 26,
    y: 27,
    z: tiles[27][26].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.2,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: [
      'weapon_Executioner_axe',
      'torso_aethel_plate',
      'helm_dread_plate',
      'offhand_heraldic_shield',
      'weapon_astral_staff'
    ]
  });

  // Glowing Arcane Crystals in Boss Chamber
  const arcaneCrystals = [
    { x: 21, y: 23, id: 'crys_boss_nw' },
    { x: 27, y: 23, id: 'crys_boss_ne' },
    { x: 24, y: 30, id: 'crys_boss_s' }
  ];
  for (const ac of arcaneCrystals) {
    const lid = `light_${ac.id}`;
    const cz = tiles[ac.y][ac.x].z;
    lights.push({
      id: lid,
      x: ac.x,
      y: ac.y,
      z: cz + 1.5,
      color: { r: 64, g: 224, b: 255 },
      intensity: 1.65,
      radius: 6.8,
      flickerSpeed: 2.2,
      enabled: true
    });
    props.push({
      id: ac.id,
      name: 'Kryształ Wiecznego Eteru',
      kind: 'arcane_crystal',
      x: ac.x,
      y: ac.y,
      z: cz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 2.2,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lid
    });
  }

  // Torches across All 3 Zones
  const dungeonTorches = [
    // Caverns
    { x: 3, y: 5, id: 'torch_cav_spawn' },
    { x: 9, y: 4, id: 'torch_cav_mine' },
    { x: 14, y: 7, id: 'torch_cav_gate' },
    { x: 8, y: 13, id: 'torch_cav_lake' },
    // Crypts
    { x: 16, y: 7, id: 'torch_cr_entry' },
    { x: 21, y: 6, id: 'torch_cr_hall' },
    { x: 27, y: 7, id: 'torch_cr_vault_door' },
    { x: 32, y: 7, id: 'torch_cr_vault_inner' },
    { x: 23, y: 17, id: 'torch_cr_sanctum_gate_l' },
    { x: 25, y: 17, id: 'torch_cr_sanctum_gate_r' },
    // Sanctum
    { x: 19, y: 24, id: 'torch_boss_w' },
    { x: 29, y: 24, id: 'torch_boss_e' },
    { x: 24, y: 22, id: 'torch_boss_n' }
  ];

  for (const dt of dungeonTorches) {
    const tz = tiles[dt.y][dt.x].z;
    const lid = `light_${dt.id}`;
    lights.push({
      id: lid,
      x: dt.x,
      y: dt.y,
      z: tz + 1.5,
      color: { r: 255, g: 166, b: 68 },
      intensity: 1.35,
      radius: 6.2,
      flickerSpeed: 4.2,
      enabled: true
    });
    props.push({
      id: dt.id,
      name: 'Pochodnia Ścienna',
      kind: 'torch_sconce',
      x: dt.x,
      y: dt.y,
      z: tz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.8,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lid
    });
  }

  return {
    id: 'sanctum_dungeon',
    name: 'Lochy i Jaskinie Aethelgardu',
    subtitle: 'Wielostrefowy labirynt podziemi (36×36) — Górne Jaskinie, Katakumby i Tron Czempiona',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}
