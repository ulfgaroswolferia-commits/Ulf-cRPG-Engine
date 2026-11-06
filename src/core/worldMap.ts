import { RGBAColor } from '../rpg/characterData';

export type MapId = 'forest_clearing' | 'sanctum_dungeon';

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
  | 'fallen_log'; // 1x2 multi-tile prop

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

  // 7. Surrounding Dense Forest Perimeter (9 Glionox Tree Variants + Stumps + Berry Bushes + Wildflowers)
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
        const treeVariant = (x * 7 + y * 13) % 9;
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
        // Walkable Glionox Wildflowers & Tall Grass Clusters (`forest_env.png` rows 0..3)
        const floraVariant = (x * 11 + y * 17) % 32;
        props.push({
          id: `flora_${x}_${y}`,
          name: floraVariant < 16 ? 'Kępa Polnych Kwiatów' : 'Wysoka Trawa Leśna',
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
