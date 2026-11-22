import { TILE_HEIGHT, TILE_WIDTH } from '../core/isoMath';
import { TileTerrainType } from '../core/worldMap';
import { getGlionoxSheets } from './glionoxAtlas';
import { SynthesizedPbrBufferPair } from './proceduralForge';

export type TerrainEdgeSlot =
  | 'edge_tl'
  | 'edge_tr'
  | 'edge_br'
  | 'edge_bl'
  | 'corner_t'
  | 'corner_r'
  | 'corner_b'
  | 'corner_l';

export type TerrainTransitionKind = 'edge' | 'inner_round' | 'outer_tip';

export interface TerrainTransitionOverlay {
  terrain: TileTerrainType;
  slot: TerrainEdgeSlot;
  kind: TerrainTransitionKind;
}

export interface NeighborTileInfo {
  terrain: TileTerrainType;
  z: number;
}

export interface MicroFoliagePlacement {
  variant: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
}

const TERRAIN_BLEND_PRIORITY: Record<TileTerrainType, number> = {
  forest_grass: 50,
  forest_soil: 40,
  dirt_path: 30,
  mossy_cobble: 25,
  sanctum_marble: 20,
  arcane_inlay: 20,
  dungeon_stone: 15,
  stairs_stone: 15,
  abyss_water: 0
};

export function getTerrainBlendPriority(terrain: TileTerrainType): number {
  return TERRAIN_BLEND_PRIORITY[terrain] ?? 10;
}

function hashInt2D(x: number, y: number, seed = 0): number {
  let h =
    Math.imul((x | 0) + 374761393, 668265263) ^
    Math.imul((y | 0) + 1274126177, 2246822519) ^
    Math.imul((seed | 0) + 1013904223, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function hashFloat2D(x: number, y: number, seed = 0): number {
  return hashInt2D(x, y, seed) / 4294967296;
}

function valueNoise2D(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hashFloat2D(ix, iy, seed);
  const b = hashFloat2D(ix + 1, iy, seed);
  const c = hashFloat2D(ix, iy + 1, seed);
  const d = hashFloat2D(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 31);
    freq *= 2.05;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Deterministic world-coordinate tile variant selector (stable across camera rotations).
 */
export function getWorldTileVariant(
  worldX: number,
  worldY: number,
  variantCount = 8
): number {
  if (variantCount <= 1) return 0;
  return hashInt2D(worldX, worldY, 17) % variantCount;
}

/**
 * Smooth, continuous low-frequency world-space lighting & hue modulation
 * to break up uniform flat expanses of grass or dirt without per-tile grid stepping.
 * Accepts an optional `out` object to avoid per-frame allocations in hot render loops.
 */
export function getWorldGroundColorMod(
  worldX: number,
  worldY: number,
  out?: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  const wave1 = Math.sin(worldX * 0.34 + worldY * 0.21) * Math.cos(worldY * 0.29 - worldX * 0.14);
  const wave2 = Math.sin(worldX * 0.72 - worldY * 0.58) * 0.5;
  const combined = (wave1 * 0.7 + wave2 * 0.3) * 0.055; // +/- ~5.5%
  const r = 1.0 + combined * 0.85;
  const g = 1.0 + combined * 1.05;
  const b = 1.0 + combined * 0.65;
  if (out) {
    out.r = r;
    out.g = g;
    out.b = b;
    return out;
  }
  return { r, g, b };
}

/**
 * Deterministically selects subtle low-profile ground grass tufts / pebbles for open natural tiles.
 * Offsets are constrained to the safe upper-center interior of the diamond so front tiles never clip tufts.
 * Returns null for tiles that should remain clean.
 */
export function getMicroFoliagePlacement(
  worldX: number,
  worldY: number,
  terrain: TileTerrainType,
  out?: MicroFoliagePlacement
): MicroFoliagePlacement | null {
  const roll = hashFloat2D(worldX, worldY, 709);

  if (terrain === 'forest_grass') {
    if (roll > 0.30) return null;
    const sub = hashInt2D(worldX, worldY, 811);
    const target = out ?? ({} as MicroFoliagePlacement);
    target.variant = sub % 4; // OGA grass tufts (cols 0..3)
    target.offsetX = (hashFloat2D(worldX, worldY, 821) - 0.5) * 36; // [-18, +18]
    target.offsetY = -10 + hashFloat2D(worldX, worldY, 829) * 12; // [-10, +2] safe from front-tile clipping
    target.scale = 0.38 + hashFloat2D(worldX, worldY, 839) * 0.14;
    target.alpha = 0.72 + hashFloat2D(worldX, worldY, 853) * 0.2;
    return target;
  }

  if (terrain === 'dirt_path' || terrain === 'forest_soil') {
    if (roll > 0.16) return null;
    const sub = hashInt2D(worldX, worldY, 911);
    const target = out ?? ({} as MicroFoliagePlacement);
    target.variant = 4 + (sub % 4); // OGA small field pebbles (cols 4..7)
    target.offsetX = (hashFloat2D(worldX, worldY, 919) - 0.5) * 34; // [-17, +17]
    target.offsetY = -8 + hashFloat2D(worldX, worldY, 929) * 10; // [-8, +2]
    target.scale = 0.42 + hashFloat2D(worldX, worldY, 937) * 0.14;
    target.alpha = 0.68 + hashFloat2D(worldX, worldY, 947) * 0.18;
    return target;
  }

  return null;
}

/**
 * Computes organic edge & corner transition overlays for a tile at rotated coordinates (rx, ry),
 * based on same-elevation neighbors that have a higher blend priority.
 * Accepts an optional reusable `out` array to minimize GC pressure in 60 FPS render loops.
 */
export function computeTileTransitions(
  rx: number,
  ry: number,
  cellTerrain: TileTerrainType,
  cellZ: number,
  getNeighbor: (nrx: number, nry: number) => NeighborTileInfo | null,
  out?: TerrainTransitionOverlay[]
): TerrainTransitionOverlay[] {
  const basePrio = getTerrainBlendPriority(cellTerrain);

  const checkNeighbor = (nrx: number, nry: number): TileTerrainType | null => {
    const n = getNeighbor(nrx, nry);
    if (!n || n.z !== cellZ) return null;
    if (n.terrain === cellTerrain) return null;
    if (getTerrainBlendPriority(n.terrain) <= basePrio) return null;
    return n.terrain;
  };

  const tl = checkNeighbor(rx - 1, ry);
  const tr = checkNeighbor(rx, ry - 1);
  const br = checkNeighbor(rx + 1, ry);
  const bl = checkNeighbor(rx, ry + 1);

  const overlays = out ?? [];
  overlays.length = 0;

  if (tl) overlays.push({ terrain: tl, slot: 'edge_tl', kind: 'edge' });
  if (tr) overlays.push({ terrain: tr, slot: 'edge_tr', kind: 'edge' });
  if (br) overlays.push({ terrain: br, slot: 'edge_br', kind: 'edge' });
  if (bl) overlays.push({ terrain: bl, slot: 'edge_bl', kind: 'edge' });

  // Unrolled corner checks (zero temporary array allocation):
  // Corner T (between TL and TR)
  if (tl && tr && tl === tr) {
    overlays.push({ terrain: tl, slot: 'corner_t', kind: 'inner_round' });
  } else if (!tl && !tr) {
    const diag = checkNeighbor(rx - 1, ry - 1);
    if (diag) overlays.push({ terrain: diag, slot: 'corner_t', kind: 'outer_tip' });
  }

  // Corner R (between TR and BR)
  if (tr && br && tr === br) {
    overlays.push({ terrain: tr, slot: 'corner_r', kind: 'inner_round' });
  } else if (!tr && !br) {
    const diag = checkNeighbor(rx + 1, ry - 1);
    if (diag) overlays.push({ terrain: diag, slot: 'corner_r', kind: 'outer_tip' });
  }

  // Corner B (between BR and BL)
  if (br && bl && br === bl) {
    overlays.push({ terrain: br, slot: 'corner_b', kind: 'inner_round' });
  } else if (!br && !bl) {
    const diag = checkNeighbor(rx + 1, ry + 1);
    if (diag) overlays.push({ terrain: diag, slot: 'corner_b', kind: 'outer_tip' });
  }

  // Corner L (between BL and TL)
  if (bl && tl && bl === tl) {
    overlays.push({ terrain: bl, slot: 'corner_l', kind: 'inner_round' });
  } else if (!bl && !tl) {
    const diag = checkNeighbor(rx - 1, ry + 1);
    if (diag) overlays.push({ terrain: diag, slot: 'corner_l', kind: 'outer_tip' });
  }

  if (overlays.length > 1) {
    overlays.sort((a, b) => getTerrainBlendPriority(a.terrain) - getTerrainBlendPriority(b.terrain));
  }

  return overlays;
}

const BFS_DIRS_8: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1]
];

/**
 * Computes the exact set of tile indices (`y * width + x`) reachable within `maxSteps`
 * using 8-directional BFS matching `findPathAStar3D` rules (walkability, `|Δz| <= maxStepElevation`,
 * and no diagonal corner-cutting around obstacles).
 */
export function computeReachableTilesBfs(
  width: number,
  height: number,
  startX: number,
  startY: number,
  maxSteps: number,
  isWalkable: (x: number, y: number) => boolean,
  getElevation: (x: number, y: number) => number,
  maxStepElevation = 1,
  outSet?: Set<number>
): Set<number> {
  const reachable = outSet ?? new Set<number>();
  reachable.clear();

  if (maxSteps <= 0 || startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return reachable;
  }

  const startIdx = startY * width + startX;
  const dist = new Int16Array(width * height);
  dist.fill(-1);
  dist[startIdx] = 0;

  const queueX: number[] = [startX];
  const queueY: number[] = [startY];
  let head = 0;

  while (head < queueX.length) {
    const cx = queueX[head];
    const cy = queueY[head];
    head++;

    const cSteps = dist[cy * width + cx];
    if (cSteps >= maxSteps) continue;

    const cz = getElevation(cx, cy);

    for (let i = 0; i < 8; i++) {
      const dx = BFS_DIRS_8[i][0];
      const dy = BFS_DIRS_8[i][1];
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (dist[nIdx] !== -1) continue;
      if (!isWalkable(nx, ny)) continue;

      const nz = getElevation(nx, ny);
      if (Math.abs(nz - cz) > maxStepElevation) continue;

      // Prevent diagonal corner-cutting around impassable obstacles or cliffs
      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(cx + dx, cy) || !isWalkable(cx, cy + dy)) continue;
        if (
          Math.abs(getElevation(cx + dx, cy) - cz) > maxStepElevation ||
          Math.abs(getElevation(cx, cy + dy) - cz) > maxStepElevation
        ) {
          continue;
        }
      }

      dist[nIdx] = cSteps + 1;
      reachable.add(nIdx);
      queueX.push(nx);
      queueY.push(ny);
    }
  }

  return reachable;
}

const transitionCache = new Map<string, SynthesizedPbrBufferPair>();

function fallbackTerrainRgb(
  terrain: TileTerrainType,
  u: number,
  v: number,
  seed: number
): { r: number; g: number; b: number } {
  const n = fbm2D(u * 6.5, v * 6.5, seed, 3);
  const shade = 0.86 + (n - 0.5) * 0.28;
  switch (terrain) {
    case 'forest_grass':
      return {
        r: Math.round((n > 0.55 ? 72 : 58) * shade),
        g: Math.round((n > 0.55 ? 114 : 96) * shade),
        b: Math.round((n > 0.55 ? 46 : 40) * shade)
      };
    case 'forest_soil':
      return {
        r: Math.round(58 * shade),
        g: Math.round(62 * shade),
        b: Math.round(38 * shade)
      };
    case 'dirt_path':
      return {
        r: Math.round(122 * shade),
        g: Math.round(96 * shade),
        b: Math.round(68 * shade)
      };
    case 'mossy_cobble':
      return {
        r: Math.round(74 * shade),
        g: Math.round(90 * shade),
        b: Math.round(66 * shade)
      };
    case 'sanctum_marble':
      return {
        r: Math.round(124 * shade),
        g: Math.round(130 * shade),
        b: Math.round(142 * shade)
      };
    case 'arcane_inlay':
      return {
        r: Math.round(58 * shade),
        g: Math.round(72 * shade),
        b: Math.round(98 * shade)
      };
    default:
      return {
        r: Math.round(74 * shade),
        g: Math.round(78 * shade),
        b: Math.round(88 * shade)
      };
  }
}

/**
 * Generates a cached 128x64 organic feathered transition overlay sprite (albedo + normal/material)
 * that smoothly blends `sourceTerrain` over an adjacent lower-priority terrain tile,
 * eliminating hard isometric diamond boundaries.
 */
export function generateTerrainTransitionPbr(
  sourceTerrain: TileTerrainType,
  slot: TerrainEdgeSlot,
  kind: TerrainTransitionKind,
  variant = 0
): SynthesizedPbrBufferPair {
  const sheets = getGlionoxSheets();
  const hasOga = Boolean(sheets?.ogaTerrainTiles);
  const vNorm = ((variant % 4) + 4) % 4;
  const key = `trans_${sourceTerrain}_${slot}_${kind}_v${vNorm}_oga${hasOga ? 1 : 0}`;
  const cached = transitionCache.get(key);
  if (cached) return cached;

  const width = TILE_WIDTH;
  const height = TILE_HEIGHT;
  const halfW = width * 0.5;
  const halfH = height * 0.5;

  const albedoRGBA = new Uint8ClampedArray(width * height * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(width * height * 4);

  const ogaTiles = sheets?.ogaTerrainTiles;
  const ogaRow =
    sourceTerrain === 'forest_grass'
      ? 1 // consistent lush grassland base across all transition variants
      : sourceTerrain === 'dirt_path'
        ? 2
        : sourceTerrain === 'forest_soil'
          ? 3
          : -1;
  const ogaCol = (vNorm * 2 + 1) % 8;
  const seed = vNorm * 97 + slot.length * 13 + (kind === 'inner_round' ? 41 : 7);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nxRaw = (x - halfW) / halfW;
      const nyRaw = (y - halfH) / halfH;
      const diamondDist = Math.abs(nxRaw) + Math.abs(nyRaw);
      if (diamondDist > 1.032) continue;

      const u = Math.max(0, Math.min(1, (nxRaw + nyRaw) * 0.5 + 0.5));
      const v = Math.max(0, Math.min(1, (nyRaw - nxRaw) * 0.5 + 0.5));

      let edgeDist = 1.0;
      let along = 0.5;

      switch (slot) {
        case 'edge_tl':
          edgeDist = u;
          along = v;
          break;
        case 'edge_tr':
          edgeDist = v;
          along = u;
          break;
        case 'edge_br':
          edgeDist = 1 - u;
          along = v;
          break;
        case 'edge_bl':
          edgeDist = 1 - v;
          along = u;
          break;
        case 'corner_t':
          edgeDist = Math.hypot(u, v);
          along = Math.atan2(v, u + 0.001);
          break;
        case 'corner_r':
          edgeDist = Math.hypot(1 - u, v);
          along = Math.atan2(v, 1 - u + 0.001);
          break;
        case 'corner_b':
          edgeDist = Math.hypot(1 - u, 1 - v);
          along = Math.atan2(1 - v, 1 - u + 0.001);
          break;
        case 'corner_l':
          edgeDist = Math.hypot(u, 1 - v);
          along = Math.atan2(1 - v, u + 0.001);
          break;
      }

      const wave = fbm2D(along * 4.2 + seed * 0.13, edgeDist * 2.8, seed, 3);
      const tuftNoise = valueNoise2D(u * 19.0 + seed, v * 19.0 + seed * 2, seed + 53);

      let reach: number;
      if (kind === 'inner_round') {
        reach = 0.46 + (wave - 0.5) * 0.20 + (tuftNoise - 0.5) * 0.08;
      } else if (kind === 'outer_tip') {
        reach = 0.28 + (wave - 0.5) * 0.14 + (tuftNoise - 0.5) * 0.07;
      } else {
        reach = 0.28 + (wave - 0.5) * 0.18 + (tuftNoise - 0.5) * 0.08;
      }

      if (edgeDist >= reach) continue;

      const t = edgeDist / Math.max(0.01, reach);
      // Smooth organic falloff with crisp grass-tuft micro-edge
      let alpha: number;
      if (t < 0.42) {
        alpha = 1.0;
      } else {
        const fade = 1.0 - (t - 0.42) / 0.58;
        const smooth = fade * fade * (3 - 2 * fade);
        const organicCutoff = smooth + (tuftNoise - 0.5) * 0.35;
        alpha = Math.max(0, Math.min(1, organicCutoff * 1.15));
      }

      if (alpha <= 0.04) continue;

      let r: number;
      let g: number;
      let b: number;

      if (ogaTiles && ogaRow >= 0) {
        // Pull sample slightly inward if on the 1px overdraw rim so we always hit opaque OGA pixels
        const pull = diamondDist > 0.96 ? 0.94 / diamondDist : 1.0;
        const sx = Math.max(0, Math.min(127, Math.round(halfW + (x - halfW) * pull)));
        const sy = Math.max(0, Math.min(63, Math.round(halfH + (y - halfH) * pull)));
        const oIdx = ((ogaRow * 64 + sy) * ogaTiles.width + (ogaCol * 128 + sx)) * 4;
        if (ogaTiles.rgba[oIdx + 3] > 32) {
          r = ogaTiles.rgba[oIdx];
          g = ogaTiles.rgba[oIdx + 1];
          b = ogaTiles.rgba[oIdx + 2];
        } else {
          const fb = fallbackTerrainRgb(sourceTerrain, u, v, seed);
          r = fb.r;
          g = fb.g;
          b = fb.b;
        }
      } else {
        const fb = fallbackTerrainRgb(sourceTerrain, u, v, seed);
        r = fb.r;
        g = fb.g;
        b = fb.b;
      }

      // Subtle grass-blade tip highlight along the feathered grass border
      if (sourceTerrain === 'forest_grass' && t > 0.55 && tuftNoise > 0.58) {
        r = Math.min(255, Math.round(r * 1.12));
        g = Math.min(255, Math.round(g * 1.14));
        b = Math.min(255, Math.round(b * 1.05));
      }

      const idx = (y * width + x) * 4;
      albedoRGBA[idx] = r;
      albedoRGBA[idx + 1] = g;
      albedoRGBA[idx + 2] = b;
      albedoRGBA[idx + 3] = Math.round(alpha * 255);

      normalMaterialRGBA[idx] = 128;
      normalMaterialRGBA[idx + 1] = 112;
      normalMaterialRGBA[idx + 2] = 208; // natural matte roughness
      normalMaterialRGBA[idx + 3] = 8;   // low metallic
    }
  }

  // Sobel luminance-derived micro-relief normal pass so transition edges catch dynamic point lights
  const lumGrid = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    if (albedoRGBA[p + 3] > 16) {
      lumGrid[i] =
        (albedoRGBA[p] * 0.299 + albedoRGBA[p + 1] * 0.587 + albedoRGBA[p + 2] * 0.114) / 255;
    }
  }
  const reliefStrength = 2.6;
  for (let y = 1; y < height - 1; y++) {
    const rowOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (rowOff + x) * 4;
      if (albedoRGBA[idx + 3] <= 16) continue;
      const dX = (lumGrid[rowOff + x - 1] - lumGrid[rowOff + x + 1]) * reliefStrength;
      const dY = (lumGrid[rowOff - width + x] - lumGrid[rowOff + width + x]) * reliefStrength;
      const nx = Math.max(-1, Math.min(1, dX));
      const ny = Math.max(-1, Math.min(1, -0.12 + dY));
      normalMaterialRGBA[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalMaterialRGBA[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    }
  }

  const pair: SynthesizedPbrBufferPair = {
    width,
    height,
    anchorX: 0.5,
    anchorY: 0.5,
    albedoRGBA,
    normalMaterialRGBA
  };

  transitionCache.set(key, pair);
  return pair;
}

export function clearTerrainTransitionCache(): void {
  transitionCache.clear();
}
