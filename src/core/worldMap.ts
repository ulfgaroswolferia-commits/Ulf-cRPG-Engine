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
  | 'rock_cliff'; // 1x1 OpenGameArt sculpted rock cliff / mossy boulder outcrop

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

  // 2. Multi-tile Camp Props around the Central Campfire (2x1 Ranger Tent & 1x2 Fallen Log)
  props.push({
    id: 'tent_ranger_camp',
    name: 'Namiot Traperski (2x1)',
    kind: 'ranger_tent',
    x: 17,
    y: 13,
    z: tiles[13][17].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.0,
    blocksMovement: true,
    blocksSight: true,
    interactive: true
  });

  props.push({
    id: 'log_campfire_seat',
    name: 'Powalony Pień przy Ognisku (1x2)',
    kind: 'fallen_log',
    x: 13,
    y: 16,
    z: tiles[16][13].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.0,
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
    lootItems: ['item_raw_sausage', 'item_old_mead']
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
    lootItems: ['item_moon_herbs', 'weapon_astral_staff', 'torso_archmage_robes']
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

  // 6C. Isometric Game Kit Watchtower & OGA Log Cabin / Cliffs / Graveyard Fence Accents
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

  props.push({
    id: 'cabin_forester_lodge',
    name: 'Zrębowa Chata Gajowego (2×1)',
    kind: 'slavic_cottage',
    variant: 3,
    x: 19,
    y: 20,
    z: tiles[20][19].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.8,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true
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
  const width = 32;
  const height = 32;
  const tiles: TileCell[][] = [];
  const props: WorldPropEntity[] = [];
  const lights: PointLightSource[] = [];

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      let z = 0;
      let terrain: TileTerrainType = 'forest_grass';
      let walkable = true;

      // 1. Sacred Pagan Hill Grove of Światowid in North-West (x: 4..10, y: 4..10)
      if (x >= 4 && x <= 10 && y >= 4 && y <= 10) {
        z = 1;
        terrain = 'forest_grass';
        if (x >= 6 && x <= 8 && y >= 6 && y <= 8) {
          z = 2;
          terrain = 'mossy_cobble';
        }
      }

      // Stone steps ascending to the Sacred Grove
      if ((x === 9 || x === 10) && y === 10) {
        z = 1;
        terrain = 'stairs_stone';
      }
      if (x === 8 && y === 9) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // 2. Ancestral Kurhan & Burial Mound in North-East (x: 23..29, y: 3..8)
      if (x >= 23 && x <= 29 && y >= 3 && y <= 8) {
        z = 1;
        terrain = 'forest_soil';
        if (x >= 25 && x <= 27 && y >= 5 && y <= 7) {
          z = 2;
          terrain = 'arcane_inlay';
        }
      }

      // Stone steps ascending to the Ancestral Kurhan
      if ((x === 23 || x === 24) && (y === 5 || y === 6)) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // 3. Central Marketplace Plaza (Rynek Osady, x: 12..20, y: 12..20)
      if (x >= 12 && x <= 20 && y >= 12 && y <= 20) {
        const distCenter = Math.hypot(x - 16, y - 16);
        if (distCenter <= 4.3) {
          terrain = 'mossy_cobble';
        } else if (distCenter <= 5.6) {
          terrain = 'dirt_path';
        }
      }

      // 4. Village Roads connecting cottages, market square, kurhan, wharf and southern gate
      const isSouthRoad = x >= 15 && x <= 17 && y >= 16 && y < height;
      const isEastRoad = y >= 15 && y <= 17 && x >= 16 && x <= 27;
      const isWestRoad = y >= 15 && y <= 16 && x >= 7 && x <= 16;
      const isNorthRoad = x >= 15 && x <= 16 && y >= 6 && y <= 16;
      const isKurhanRoad = x >= 22 && x <= 23 && y >= 7 && y <= 15;
      const isWharfRoad = x >= 21 && x <= 22 && y >= 18 && y <= 22;
      if (
        (isSouthRoad || isEastRoad || isWestRoad || isNorthRoad || isKurhanRoad || isWharfRoad) &&
        z === 0
      ) {
        if (terrain !== 'mossy_cobble') {
          terrain = 'dirt_path';
        }
      }

      // 5. Scenic Stream, Mill Pond & Fisherman's Wharf in South-East (x: 22..29, y: 20..27)
      const pondDist = Math.hypot((x - 25.5) * 0.9, (y - 23.5) * 1.1);
      const isPier = (x === 22 || x === 23) && (y === 22 || y === 23);
      const isMillFoundation = (x === 26 || x === 27) && y === 26;
      if (isPier) {
        z = 0;
        terrain = 'dungeon_stone';
        walkable = true;
      } else if (isMillFoundation) {
        z = 0;
        terrain = 'forest_soil';
        walkable = true;
      } else if (pondDist <= 2.5) {
        terrain = 'abyss_water';
        walkable = false;
      } else if (pondDist <= 3.8 && terrain === 'forest_grass') {
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
    x: 16,
    y: 16,
    z: tiles[16][16].z,
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
    x: 14,
    y: 18,
    z: tiles[18][14].z + 1.2,
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
    x: 14,
    y: 18,
    z: tiles[18][14].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.3,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: true,
    linkedLightId: marketFireLightId
  });

  // --- B. Three Bustling Marketplace Stalls (Kramy Kupieckie 2x1 / 1x2) ---
  props.push({
    id: 'stall_dobromir_wares',
    name: 'Kram Kupca Dobromira (Sukno, Bursztyn i Prowiant)',
    kind: 'market_stall',
    variant: 0,
    x: 13,
    y: 13,
    z: tiles[13][13].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['item_raw_sausage', 'cloak_crimson_mantle']
  });

  props.push({
    id: 'stall_herbalist_wislawa',
    name: 'Stragan Zielarki Wisławy (Zioła i Amulety)',
    kind: 'market_stall',
    variant: 1,
    x: 18,
    y: 13,
    z: tiles[13][18].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['ring_emerald_seal', 'helm_arcane_circlet']
  });

  props.push({
    id: 'stall_smith_bozydar',
    name: 'Kram Płatnerza Bożydara (Oręż i Zbroje)',
    kind: 'market_stall',
    variant: 2,
    x: 20,
    y: 16,
    z: tiles[16][20].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 2.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['weapon_Executioner_axe', 'legs_steel_greaves']
  });

  // --- C. Twelve Slavic Log Cabins & Thatched Cottages (OpenGameArt Isometric Log Cabins 0..15) ---
  const cottages: ReadonlyArray<{
    id: string;
    name: string;
    x: number;
    y: number;
    sizeX: number;
    sizeY: number;
    variant: number;
  }> = [
    {
      id: 'cottage_elder_starosta',
      name: 'Dwór Starosty Grodowego (Chata z Gankiem)',
      x: 14,
      y: 8,
      sizeX: 2,
      sizeY: 1,
      variant: 0
    },
    {
      id: 'cottage_inn_wolf_fang',
      name: 'Gospoda „Pod Wilczym Kłem” (Karczma Zrębowa)',
      x: 22,
      y: 11,
      sizeX: 2,
      sizeY: 1,
      variant: 5
    },
    {
      id: 'cottage_blacksmith_bozydar',
      name: 'Kuźnia Płatnerza Bożydara (Dymarka i Kowadło)',
      x: 21,
      y: 14,
      sizeX: 2,
      sizeY: 1,
      variant: 7
    },
    {
      id: 'cottage_herbalist_hut',
      name: 'Chata Zielarki nad Jarem (Strzecha)',
      x: 8,
      y: 18,
      sizeX: 1,
      sizeY: 2,
      variant: 9
    },
    {
      id: 'cottage_wheelwright',
      name: 'Chata Kołodzieja i Bartnika',
      x: 20,
      y: 21,
      sizeX: 2,
      sizeY: 1,
      variant: 12
    },
    {
      id: 'cottage_hunter_north',
      name: 'Chata Łowczego Puszczy',
      x: 19,
      y: 7,
      sizeX: 2,
      sizeY: 1,
      variant: 2
    },
    {
      id: 'cottage_fisherman_pond',
      name: 'Chata Rybaka nad Stawem',
      x: 25,
      y: 18,
      sizeX: 2,
      sizeY: 1,
      variant: 14
    },
    {
      id: 'cottage_granary',
      name: 'Spichlerz Zbożowy i Magazyn Kupiecki',
      x: 9,
      y: 11,
      sizeX: 2,
      sizeY: 1,
      variant: 4
    },
    {
      id: 'cottage_potter_weaver',
      name: 'Chata Garncarki i Tkaczki',
      x: 8,
      y: 23,
      sizeX: 2,
      sizeY: 1,
      variant: 1
    },
    {
      id: 'cottage_woodcutter',
      name: 'Chata Drwala i Smolarza',
      x: 5,
      y: 14,
      sizeX: 1,
      sizeY: 2,
      variant: 11
    },
    {
      id: 'cottage_gatekeeper',
      name: 'Wartownia Strażników Bramy Południowej',
      x: 12,
      y: 22,
      sizeX: 1,
      sizeY: 2,
      variant: 3
    },
    {
      id: 'cottage_watermill',
      name: 'Młyn Wodny Nadbrzeżny z Kołem Młyńskim',
      x: 26,
      y: 26,
      sizeX: 2,
      sizeY: 1,
      variant: 8
    }
  ];

  for (const c of cottages) {
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
      heightZ: 2.8,
      blocksMovement: true,
      blocksSight: true,
      interactive: true,
      isOpen: true,
      linkedLightId: lightId
    });
  }

  // --- D. Sacred Pagan Shrine of Four-Faced Światowid on the Grove Hill ---
  const shrineLightId = 'light_swiatowid_grove';
  lights.push({
    id: shrineLightId,
    x: 7,
    y: 7,
    z: tiles[7][7].z + 1.6,
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
    x: 7,
    y: 7,
    z: tiles[7][7].z,
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
    x: 25.5,
    y: 5.5,
    z: tiles[5][25].z + 1.8,
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
    x: 26,
    y: 6,
    z: tiles[6][26].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'ring_emerald_seal']
  });

  props.push({
    id: 'prop_kurhan_arcane_crystal',
    name: 'Runiczny Monolit Duszy Przodków',
    kind: 'arcane_crystal',
    variant: 0,
    x: 25,
    y: 5,
    z: tiles[5][25].z,
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
    { id: 'kurhan_pillar_nw', x: 24, y: 4, v: 1 },
    { id: 'kurhan_pillar_sw', x: 24, y: 7, v: 3 },
    { id: 'kurhan_pillar_ne', x: 28, y: 4, v: 5 },
    { id: 'kurhan_pillar_se', x: 28, y: 7, v: 7 }
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
    x: 28,
    y: 5,
    z: tiles[5][28].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 3.6,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: true
  });

  const kurhanFences = [
    { x: 24, y: 3, v: 0 },
    { x: 25, y: 3, v: 1 },
    { x: 26, y: 3, v: 2 },
    { x: 27, y: 3, v: 3 },
    { x: 29, y: 4, v: 4 },
    { x: 29, y: 5, v: 5 },
    { x: 29, y: 6, v: 4 },
    { x: 25, y: 8, v: 0 },
    { x: 26, y: 8, v: 1 },
    { x: 27, y: 8, v: 2 }
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
    { x: 23, y: 3, v: 1 },
    { x: 29, y: 7, v: 3 }
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

  // --- E. Woven Willow Wattle Fences (Plecione Płoty Wiklinowe) around Cottages ---
  const fenceCoords: ReadonlyArray<{ x: number; y: number; v: number }> = [
    { x: 13, y: 8, v: 0 },
    { x: 16, y: 8, v: 0 },
    { x: 17, y: 8, v: 0 },
    { x: 21, y: 11, v: 0 },
    { x: 24, y: 11, v: 0 },
    { x: 24, y: 12, v: 1 },
    { x: 7, y: 18, v: 1 },
    { x: 7, y: 19, v: 1 },
    { x: 7, y: 20, v: 1 },
    { x: 19, y: 21, v: 0 },
    { x: 22, y: 21, v: 0 },
    { x: 4, y: 14, v: 1 },
    { x: 4, y: 15, v: 1 },
    { x: 8, y: 11, v: 0 },
    { x: 11, y: 11, v: 0 }
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

  // --- F. Travel Signpost back to Forest Clearing & Village Chests ---
  props.push({
    id: 'signpost_to_forest_clearing',
    name: 'Drogowskaz: Polana Wilczego Ognia ←',
    kind: 'travel_signpost',
    x: 17,
    y: 23,
    z: tiles[23][17].z,
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
    x: 13,
    y: 9,
    z: tiles[9][13].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'weapon_astral_staff']
  });

  // --- Wharf, Fisher's Pier & Deep Water Props (South-East) ---
  props.push({
    id: 'village_chest_wharf_1',
    name: 'Skrzynia Rybacka z Narzędziami',
    kind: 'chest',
    variant: 1,
    x: 22,
    y: 22,
    z: tiles[22][22].z,
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
    x: 23,
    y: 23,
    z: tiles[23][23].z,
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
    { x: 24, y: 20, v: 0 },
    { x: 28, y: 23, v: 2 }
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
      heightZ: 2.8,
      blocksMovement: true,
      blocksSight: false,
      interactive: false
    });
  }

  // --- F2. Village Watchtowers, Street Lanterns, Sacred Grove Iron Fences & Rock Cliffs ---
  const villageWatchtowers = [
    { id: 'watchtower_south_west', name: 'Baszta Strażnicza Bramy Zachodniej', x: 13, y: 24, v: 1 },
    { id: 'watchtower_south_east', name: 'Kamienna Baszta Straży Grodowej', x: 18, y: 24, v: 0 }
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
    { id: 'lantern_market_nw', x: 12, y: 15 },
    { id: 'lantern_market_ne', x: 19, y: 15 },
    { id: 'lantern_road_south', x: 15, y: 22 },
    { id: 'lantern_wharf', x: 21, y: 22 },
    { id: 'lantern_kurhan_approach', x: 22, y: 9 },
    { id: 'lantern_sacred_steps', x: 10, y: 11 }
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
    { x: 5, y: 10, v: 0 },
    { x: 6, y: 10, v: 1 },
    { x: 7, y: 10, v: 2 },
    { x: 10, y: 8, v: 4 },
    { x: 10, y: 9, v: 5 }
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
    { x: 4, y: 11, v: 1 },
    { x: 11, y: 4, v: 3 },
    { x: 21, y: 24, v: 0 },
    { x: 23, y: 25, v: 4 },
    { x: 28, y: 26, v: 6 }
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
    '16,20', // Player spawn
    '15,18', // NPC Król Gniewomir
    '14,14', // NPC Kupiec Dobromir
    '18,14', // NPC Płatnerz Bożydar
    '8,8',   // NPC Żerca Radogost
    '18,17'  // NPC Strażnik Miłosz
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
      const distCenter = Math.hypot(x - 16, y - 16);
      const isOutskirtWoods = distCenter >= 12.2 && (x * 11 + y * 17) % 3 === 0;

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
      'Słowiańska osada (32×32) — 12 chat zrębowych, Kurhan Kniazia z runami, Przystań i Młyn, Baszty oraz Święty Gaj Światowida',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}

export function createSanctumWorldMap(): IsometricWorldMap {
  const width = 20;
  const height = 20;
  const tiles: TileCell[][] = [];

  for (let y = 0; y < height; y++) {
    const row: TileCell[] = [];
    for (let x = 0; x < width; x++) {
      let z = 0;
      let terrain: TileTerrainType = 'dungeon_stone';
      let walkable = true;

      if (x <= 7 && y <= 7) {
        z = 2;
        terrain = 'mossy_cobble';
      }

      if (x >= 12 && y >= 12) {
        z = 2;
        terrain = 'sanctum_marble';
      }

      if ((x === 8 && (y === 4 || y === 5)) || (y === 8 && (x === 4 || x === 5))) {
        z = 1;
        terrain = 'stairs_stone';
      }

      if ((x === 11 && (y === 14 || y === 15)) || (y === 11 && (x === 14 || x === 15))) {
        z = 1;
        terrain = 'stairs_stone';
      }

      if (x >= 8 && x <= 11 && y >= 8 && y <= 11) {
        terrain = 'arcane_inlay';
      }

      if (x <= 3 && y >= 15) {
        terrain = 'abyss_water';
        walkable = false;
      }

      row.push({ x, y, z, terrain, walkable });
    }
    tiles.push(row);
  }

  const props: WorldPropEntity[] = [];
  const lights: PointLightSource[] = [];

  const addWall = (x: number, y: number, name = 'Mur Twierdzy'): void => {
    const z = tiles[y]?.[x]?.z ?? 0;
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

  for (let i = 0; i <= 7; i++) {
    if (i !== 4 && i !== 5) {
      addWall(8, i, 'Mur Dziedzińca');
      addWall(i, 8, 'Mur Dziedzińca');
    }
  }

  for (let x = 13; x <= 18; x++) {
    addWall(x, 2, 'Ściana Skarbca Konklawe');
    if (x !== 15) {
      addWall(x, 7, 'Ściana Skarbca Konklawe');
    }
  }
  for (let y = 3; y <= 6; y++) {
    if (y !== 5) {
      addWall(13, y, 'Ściana Skarbca Konklawe');
    }
    addWall(18, y, 'Ściana Skarbca Konklawe');
  }

  props.push({
    id: 'door_vault_west',
    name: 'Okute Wrota Skarbca',
    kind: 'door',
    x: 13,
    y: 5,
    z: tiles[5][13].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.5,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  props.push({
    id: 'door_vault_south',
    name: 'Południowa krata Sanktuarium',
    kind: 'door',
    x: 15,
    y: 7,
    z: tiles[7][15].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 2.5,
    blocksMovement: true,
    blocksSight: true,
    interactive: true,
    isOpen: false
  });

  const pillarCoords = [
    [7, 11],
    [11, 7],
    [12, 12],
    [16, 12],
    [12, 16]
  ];
  for (const [px, py] of pillarCoords) {
    props.push({
      id: `pillar_${px}_${py}`,
      name: 'Kolumna Starożytnych',
      kind: 'pillar',
      x: px,
      y: py,
      z: tiles[py][px].z,
      sizeX: 1,
      sizeY: 1,
      heightZ: 3.0,
      blocksMovement: true,
      blocksSight: true,
      interactive: false
    });
  }

  props.push({
    id: 'altar_sunken_crown',
    name: 'Ołtarz Zatopionej Korony (2x1)',
    kind: 'runic_altar',
    x: 15,
    y: 15,
    z: tiles[15][15].z,
    sizeX: 2,
    sizeY: 1,
    heightZ: 1.8,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  props.push({
    id: 'sarcophagus_ancient_king',
    name: 'Sarkofag Pierwszego Archonta (1x2)',
    kind: 'sarcophagus',
    x: 3,
    y: 11,
    z: tiles[11][3].z,
    sizeX: 1,
    sizeY: 2,
    heightZ: 1.5,
    blocksMovement: true,
    blocksSight: false,
    interactive: true
  });

  props.push({
    id: 'chest_courtyard',
    name: 'Okuta Skrzynia Gwardii',
    kind: 'chest',
    x: 2,
    y: 2,
    z: tiles[2][2].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_aethel_plate', 'helm_dread_plate', 'weapon_Executioner_axe']
  });

  props.push({
    id: 'chest_vault',
    name: 'Relikwiarz Konklawe',
    kind: 'chest',
    x: 16,
    y: 4,
    z: tiles[4][16].z,
    sizeX: 1,
    sizeY: 1,
    heightZ: 1.1,
    blocksMovement: true,
    blocksSight: false,
    interactive: true,
    isOpen: false,
    lootItems: ['torso_archmage_robes', 'helm_arcane_circlet', 'weapon_astral_staff', 'offhand_grimoire']
  });

  const torchLocations = [
    { x: 6, y: 4, id: 'torch_courtyard' },
    { x: 9, y: 6, id: 'torch_gate_north' },
    { x: 6, y: 9, id: 'torch_gate_west' },
    { x: 12, y: 5, id: 'torch_vault_entry' },
    { x: 16, y: 3, id: 'torch_vault_inner' },
    { x: 13, y: 14, id: 'torch_dais_left' }
  ];

  for (const t of torchLocations) {
    const tz = tiles[t.y][t.x].z;
    const lightId = `light_${t.id}`;
    lights.push({
      id: lightId,
      x: t.x,
      y: t.y,
      z: tz + 1.5,
      color: { r: 255, g: 166, b: 68 },
      intensity: 1.35,
      radius: 6.5,
      flickerSpeed: 4.2,
      enabled: true
    });
    props.push({
      id: t.id,
      name: 'Pochodnia Ścienna',
      kind: 'torch_sconce',
      x: t.x,
      y: t.y,
      z: tz,
      sizeX: 1,
      sizeY: 1,
      heightZ: 1.8,
      blocksMovement: true,
      blocksSight: false,
      interactive: true,
      isOpen: true,
      linkedLightId: lightId
    });
  }

  const crystalLocations = [
    { x: 9, y: 9, id: 'crystal_nexus' },
    { x: 16, y: 16, id: 'crystal_sanctum' },
    { x: 5, y: 14, id: 'crystal_abyss' }
  ];

  for (const c of crystalLocations) {
    const cz = tiles[c.y][c.x].z;
    const lightId = `light_${c.id}`;
    lights.push({
      id: lightId,
      x: c.x,
      y: c.y,
      z: cz + 1.4,
      color: { r: 64, g: 224, b: 255 },
      intensity: 1.45,
      radius: 6.0,
      flickerSpeed: 1.8,
      enabled: true
    });
    props.push({
      id: c.id,
      name: 'Monolit Eteryczny',
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
      linkedLightId: lightId
    });
  }

  return {
    id: 'sanctum_dungeon',
    name: 'Sanktuarium Zatopionej Korony',
    subtitle: 'Dziedziniec Aethelgardu — Poziom I (20×20)',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}
