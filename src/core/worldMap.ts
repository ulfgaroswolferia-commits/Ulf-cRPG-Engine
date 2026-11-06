import { RGBAColor } from '../rpg/characterData';

export type TileTerrainType =
  | 'dungeon_stone'
  | 'sanctum_marble'
  | 'mossy_cobble'
  | 'arcane_inlay'
  | 'stairs_stone'
  | 'abyss_water';

export type PropKind =
  | 'wall_block'
  | 'pillar'
  | 'door'
  | 'torch_sconce'
  | 'arcane_crystal'
  | 'chest'
  | 'runic_altar' // 2x1 multi-tile prop
  | 'sarcophagus'; // 1x2 multi-tile prop

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
  name: string;
  subtitle: string;
  width: number;
  height: number;
  maxElevation: number;
  tiles: TileCell[][];
  props: WorldPropEntity[];
  lights: PointLightSource[];
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

      // Upper Courtyard on North-West Quadrant (x < 8, y < 8) -> Elevation Z=2
      if (x <= 7 && y <= 7) {
        z = 2;
        terrain = 'mossy_cobble';
      }

      // Raised Sanctum Altar Dais on South-East (x >= 12, y >= 12) -> Elevation Z=2
      if (x >= 12 && y >= 12) {
        z = 2;
        terrain = 'sanctum_marble';
      }

      // Connecting Stone Stairs between Z=2 and Z=0
      if ((x === 8 && (y === 4 || y === 5)) || (y === 8 && (x === 4 || x === 5))) {
        z = 1;
        terrain = 'stairs_stone';
      }

      if ((x === 11 && (y === 14 || y === 15)) || (y === 11 && (x === 14 || x === 15))) {
        z = 1;
        terrain = 'stairs_stone';
      }

      // Central Arcane Plaza
      if (x >= 8 && x <= 11 && y >= 8 && y <= 11) {
        terrain = 'arcane_inlay';
      }

      // Abyssal moat channel on South-West corner
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

  // Sanctum Dividing Wall along x = 8 (rows 0..3 and 6..7) and y = 8 (cols 0..3 and 6..7)
  for (let i = 0; i <= 7; i++) {
    if (i !== 4 && i !== 5) {
      addWall(8, i, 'Mur Dziedzińca');
      addWall(i, 8, 'Mur Dziedzińca');
    }
  }

  // Vault Wall enclosing North-East Arcane Chamber (x: 13..18, y: 2..7)
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

  // Interactive Doors
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

  // Pillars around Central Arcane Plaza
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

  // Multi-Tile Props (2x1 Runic Altar & 1x2 Royal Sarcophagus) demonstrating 4-way multi-tile rotation & DAG sorting
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

  // Interactive Chests with wearable equipment
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

  // Torch Sconces & Arcane Crystals with Point Lights
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
    name: 'Sanktuarium Zatopionej Korony',
    subtitle: 'Dziedziniec Aethelgardu — Poziom I',
    width,
    height,
    maxElevation: 3,
    tiles,
    props,
    lights
  };
}
