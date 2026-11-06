import { ELEVATION_STEP_PX, TILE_HEIGHT, TILE_WIDTH } from '../core/isoMath';
import { PropKind, TileTerrainType } from '../core/worldMap';
import { RGBAColor } from '../rpg/characterData';

export interface SynthesizedPbrBufferPair {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  albedoRGBA: Uint8ClampedArray;
  normalMaterialRGBA: Uint8ClampedArray;
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

/**
 * Voronoi cellular distance for realistic cobblestones, flagstone slabs, and cracked rock.
 */
function voronoiStone(x: number, y: number): { f1: number; f2: number; edge: number; cellId: number } {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  let f1 = 8.0;
  let f2 = 8.0;
  let cellId = 0;

  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const rx = i - fx + hash2D(ix + i, iy + j) * 0.78;
      const ry = j - fy + hash2D(ix + i + 37, iy + j + 91) * 0.78;
      const d = Math.hypot(rx, ry);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        cellId = hash2D(ix + i + 11, iy + j + 23);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1, f2, edge: f2 - f1, cellId };
}

function blendPixel(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  color: RGBAColor,
  shade: number,
  alpha: number,
  nx: number,
  ny: number,
  roughness: number,
  metallic: number
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= w || py < 0 || py >= h || alpha <= 0) return;
  const idx = (py * w + px) * 4;

  const r = Math.min(255, Math.max(0, Math.round(color.r * shade)));
  const g = Math.min(255, Math.max(0, Math.round(color.g * shade)));
  const b = Math.min(255, Math.max(0, Math.round(color.b * shade)));

  const prevA = albedo[idx + 3] / 255;
  const outA = alpha + prevA * (1 - alpha);
  if (outA <= 0) return;

  albedo[idx] = Math.round((r * alpha + albedo[idx] * prevA * (1 - alpha)) / outA);
  albedo[idx + 1] = Math.round((g * alpha + albedo[idx + 1] * prevA * (1 - alpha)) / outA);
  albedo[idx + 2] = Math.round((b * alpha + albedo[idx + 2] * prevA * (1 - alpha)) / outA);
  albedo[idx + 3] = Math.min(255, Math.round(outA * 255));

  normalMat[idx] = Math.min(255, Math.max(0, Math.round((nx * 0.5 + 0.5) * 255)));
  normalMat[idx + 1] = Math.min(255, Math.max(0, Math.round((ny * 0.5 + 0.5) * 255)));
  normalMat[idx + 2] = Math.min(255, Math.max(0, Math.round(roughness * 255)));
  normalMat[idx + 3] = Math.min(255, Math.max(0, Math.round(metallic * 255)));
}

function writePbrPixel(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  color: RGBAColor,
  shade: number,
  nx: number,
  ny: number,
  roughness: number,
  metallic: number
): void {
  blendPixel(albedo, normalMat, w, h, x, y, color, shade, 1.0, nx, ny, roughness, metallic);
}

/**
 * Computes tangent-space normal map from luminance/height gradients of the Albedo buffer
 * where normals weren't explicitly overridden, giving every painterly detail crisp 3D relief.
 */
function enhanceNormalsFromAlbedoRelief(
  albedo: Uint8ClampedArray,
  normalMat: Uint8ClampedArray,
  w: number,
  h: number,
  strength = 2.2
): void {
  const lum = (x: number, y: number): number => {
    const cx = Math.min(w - 1, Math.max(0, x));
    const cy = Math.min(h - 1, Math.max(0, y));
    const i = (cy * w + cx) * 4;
    if (albedo[i + 3] < 16) return 0;
    return (albedo[i] * 0.299 + albedo[i + 1] * 0.587 + albedo[i + 2] * 0.114) / 255;
  };

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (albedo[i + 3] < 16) continue;

      const dX = (lum(x - 1, y) - lum(x + 1, y)) * strength;
      const dY = (lum(x, y - 1) - lum(x, y + 1)) * strength;

      const baseNx = (normalMat[i] / 255 - 0.5) * 2;
      const baseNy = (normalMat[i + 1] / 255 - 0.5) * 2;

      const nx = Math.max(-1, Math.min(1, baseNx * 0.65 + dX * 0.65));
      const ny = Math.max(-1, Math.min(1, baseNy * 0.65 + dY * 0.65));

      normalMat[i] = Math.round((nx * 0.5 + 0.5) * 255);
      normalMat[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    }
  }
}

const tileCache = new Map<string, SynthesizedPbrBufferPair>();

/**
 * Generates an isometric 2:1 tile sprite with sculpted Voronoi stonework, multi-layered grass blades,
 * wildflowers, water ripples, and 3D extruded cliff rock faces.
 */
export function generateTilePbrBuffers(
  terrain: TileTerrainType,
  elevationSteps = 1
): SynthesizedPbrBufferPair {
  const key = `${terrain}_z${elevationSteps}`;
  const cached = tileCache.get(key);
  if (cached) return cached;

  const skirtSteps = Math.max(1, elevationSteps + 1);
  const skirtPx = skirtSteps * ELEVATION_STEP_PX;
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT + skirtPx;
  const halfW = width * 0.5;
  const halfH = TILE_HEIGHT * 0.5;

  const albedoRGBA = new Uint8ClampedArray(width * height * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(width * height * 4);

  let baseColor: RGBAColor = { r: 66, g: 72, b: 84 };
  let roughness = 0.68;
  let metallic = 0.14;

  if (terrain === 'sanctum_marble') {
    baseColor = { r: 122, g: 128, b: 142 };
    roughness = 0.25;
    metallic = 0.32;
  } else if (terrain === 'mossy_cobble') {
    baseColor = { r: 68, g: 82, b: 64 };
    roughness = 0.76;
    metallic = 0.08;
  } else if (terrain === 'arcane_inlay') {
    baseColor = { r: 52, g: 64, b: 92 };
    roughness = 0.22;
    metallic = 0.62;
  } else if (terrain === 'stairs_stone') {
    baseColor = { r: 96, g: 92, b: 86 };
    roughness = 0.58;
    metallic = 0.15;
  } else if (terrain === 'abyss_water') {
    baseColor = { r: 18, g: 58, b: 86 };
    roughness = 0.08;
    metallic = 0.78;
  } else if (terrain === 'forest_grass') {
    baseColor = { r: 46, g: 84, b: 38 };
    roughness = 0.82;
    metallic = 0.03;
  } else if (terrain === 'dirt_path') {
    baseColor = { r: 108, g: 82, b: 56 };
    roughness = 0.74;
    metallic = 0.06;
  } else if (terrain === 'forest_soil') {
    baseColor = { r: 38, g: 58, b: 34 };
    roughness = 0.86;
    metallic = 0.02;
  }

  const isNatural =
    terrain === 'forest_grass' || terrain === 'dirt_path' || terrain === 'forest_soil';

  // 1. Render Top Diamond Face with Voronoi Cellular Relief & fBm Micro-Detail
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - halfW) / halfW;
      const dy = Math.abs(y - halfH) / halfH;
      if (dx + dy <= 1.0) {
        const u = ((x - halfW) / halfW + (y - halfH) / halfH) * 0.5 + 0.5;
        const v = ((y - halfH) / halfH - (x - halfW) / halfW) * 0.5 + 0.5;

        const detailNoise = fbm(x * 0.12, y * 0.12, 4);
        const fineNoise = valueNoise(x * 0.45, y * 0.45);
        let nx = (detailNoise - fbm((x + 1) * 0.12, y * 0.12, 3)) * 2.8;
        let ny = (detailNoise - fbm(x * 0.12, (y + 1) * 0.12, 3)) * 2.8 - 0.22;
        let shade = 0.82 + (detailNoise - 0.5) * 0.38 + (fineNoise - 0.5) * 0.14;
        let pixelColor = { ...baseColor };

        const edgeDist = 1.0 - (dx + dy);

        if (terrain === 'forest_grass' || terrain === 'forest_soil') {
          const patch = fbm(u * 4.5, v * 4.5, 3);
          if (patch > 0.56) {
            pixelColor =
              terrain === 'forest_grass'
                ? { r: 64, g: 112, b: 48 }
                : { r: 52, g: 76, b: 42 };
          } else if (patch < 0.38) {
            pixelColor = { r: 58, g: 52, b: 36 }; // Earthy soil showing through
          }
          if (edgeDist < 0.04) shade *= 0.9;
        } else if (terrain === 'dirt_path') {
          const vor = voronoiStone(u * 7.5, v * 7.5);
          // Embedded trail cobblestones & gravel
          if (vor.f1 < 0.28 && detailNoise > 0.46) {
            pixelColor = { r: 124, g: 108, b: 88 };
            shade = 0.95 + (0.28 - vor.f1) * 0.6;
            nx += (vor.f1 - 0.14) * 1.4;
          } else if (edgeDist < 0.14) {
            // Grassy border blending into the trail edges
            pixelColor = { r: 56, g: 88, b: 44 };
          }
        } else if (terrain === 'abyss_water') {
          const wave =
            Math.sin(u * 18 + detailNoise * 5) * 0.5 +
            Math.cos(v * 18 - detailNoise * 5) * 0.5;
          shade = 0.88 + wave * 0.22;
          nx = wave * 0.45;
          ny = -0.35 + wave * 0.35;
          if (edgeDist < 0.09) {
            // Shoreline foam & shallow tint
            pixelColor = { r: 68, g: 142, b: 168 };
            shade = 1.15;
          }
        } else if (terrain === 'stairs_stone') {
          const stepIdx = Math.floor(y / 8);
          const stepLocal = y % 8;
          shade = stepLocal < 2 ? 0.48 : 1.08 - stepIdx * 0.025;
          ny = stepLocal < 2 ? 0.82 : -0.32;
        } else {
          // Sculpted Voronoi Flagstones / Cobblestones for dungeon_stone, mossy_cobble, sanctum_marble, arcane_inlay
          const scale = terrain === 'mossy_cobble' ? 6.2 : 4.2;
          const vor = voronoiStone(u * scale, v * scale);
          const slabTint = (vor.cellId - 0.5) * 18;
          pixelColor = {
            r: Math.min(255, Math.max(0, baseColor.r + slabTint)),
            g: Math.min(255, Math.max(0, baseColor.g + slabTint)),
            b: Math.min(255, Math.max(0, baseColor.b + slabTint))
          };

          if (vor.edge < 0.085) {
            // Deep mortar joint between stones
            if (terrain === 'mossy_cobble' || (terrain === 'dungeon_stone' && detailNoise > 0.58)) {
              pixelColor = { r: 48, g: 88, b: 42 }; // Lush moss in stone crevices
              shade = 0.78;
            } else {
              shade *= 0.46;
            }
            ny += 0.55;
          } else if (vor.edge < 0.15) {
            // Beveled stone highlight
            shade *= 1.12;
            nx -= 0.28;
            ny -= 0.28;
          }

          if (terrain === 'arcane_inlay') {
            const rDist = Math.hypot(u - 0.5, v - 0.5);
            if (
              Math.abs(rDist - 0.34) < 0.035 ||
              Math.abs(rDist - 0.18) < 0.028 ||
              Math.abs(u - v) < 0.024 ||
              Math.abs(u + v - 1.0) < 0.024
            ) {
              pixelColor = { r: 82, g: 228, b: 255 };
              shade = 1.35;
            }
          }

          if (edgeDist < 0.05) {
            shade *= 0.65;
          }
        }

        writePbrPixel(
          albedoRGBA,
          normalMaterialRGBA,
          width,
          height,
          x,
          y,
          pixelColor,
          shade,
          Math.max(-1, Math.min(1, nx)),
          Math.max(-1, Math.min(1, ny)),
          roughness,
          metallic
        );
      }
    }
  }

  // 1B. Overlay Individual Painterly Grass Blades & Wildflowers on Forest Grass
  if (terrain === 'forest_grass' || terrain === 'forest_soil') {
    const bladeCount = terrain === 'forest_grass' ? 150 : 65;
    for (let i = 0; i < bladeCount; i++) {
      const rx = hash2D(i * 13.7, elevationSteps + 1.3);
      const ry = hash2D(i * 29.3, elevationSteps + 7.1);
      // Map unit square (rx, ry) into diamond
      const px = halfW + (rx - ry) * (halfW - 8);
      const py = (rx + ry) * (halfH - 4) + 4;
      const bladeH = 4 + Math.floor(hash2D(i, 99) * 5);
      const lean = (hash2D(i, 41) - 0.5) * 2.5;
      const isFlower = terrain === 'forest_grass' && i % 22 === 0;

      for (let b = 0; b < bladeH; b++) {
        const t = b / bladeH;
        const bx = px + lean * t;
        const by = py - b;
        const col: RGBAColor = isFlower && b >= bladeH - 2
          ? i % 44 === 0
            ? { r: 245, g: 210, b: 78 }
            : { r: 168, g: 138, b: 235 }
          : { r: 58 + Math.round(t * 36), g: 102 + Math.round(t * 48), b: 44 + Math.round(t * 18) };
        blendPixel(
          albedoRGBA,
          normalMaterialRGBA,
          width,
          height,
          bx,
          by,
          col,
          0.9 + t * 0.25,
          0.92,
          lean * 0.2,
          -0.55,
          0.7,
          0.05
        );
      }
    }
  }

  // 2. Render Sculpted 3D Cliff Rock / Root-Laced Earth Wall below the front diamond edges
  for (let x = 0; x < width; x++) {
    const bottomDiamondY = Math.round(TILE_HEIGHT - Math.abs(x - halfW) * 0.5);
    const isLeftFace = x < halfW;

    for (let sy = 0; sy < skirtPx; sy++) {
      const py = bottomDiamondY + sy;
      if (py >= height) continue;

      const vor = voronoiStone(x * 0.08, sy * 0.11);
      const rockNoise = fbm(x * 0.15, sy * 0.15, 3);
      let cliffCol: RGBAColor = isNatural
        ? sy < 5
          ? { r: 48, g: 82, b: 38 } // Overhanging grass lip
          : { r: 76, g: 62, b: 48 }
        : baseColor;

      if (!isNatural && vor.edge < 0.09) {
        cliffCol = { r: 38, g: 42, b: 48 };
      }

      const depthDarken = 1.0 - (sy / Math.max(1, skirtPx)) * 0.28;
      const faceShade =
        (isLeftFace ? 0.72 : 0.48) *
        (0.84 + rockNoise * 0.32) *
        (vor.edge < 0.09 ? 0.62 : 1.0) *
        depthDarken;

      const nx = (isLeftFace ? -0.68 : 0.68) + (rockNoise - 0.5) * 0.3;
      const ny = 0.32 + (vor.f1 - 0.3) * 0.25;

      writePbrPixel(
        albedoRGBA,
        normalMaterialRGBA,
        width,
        height,
        x,
        py,
        cliffCol,
        faceShade,
        Math.max(-1, Math.min(1, nx)),
        Math.max(-1, Math.min(1, ny)),
        roughness,
        metallic
      );
    }
  }

  enhanceNormalsFromAlbedoRelief(albedoRGBA, normalMaterialRGBA, width, height, 1.85);

  const pair: SynthesizedPbrBufferPair = {
    width,
    height,
    anchorX: 0.5,
    anchorY: (TILE_HEIGHT * 0.5) / height,
    albedoRGBA,
    normalMaterialRGBA
  };

  tileCache.set(key, pair);
  return pair;
}

const propCache = new Map<string, SynthesizedPbrBufferPair>();

/**
 * Generates high-detail painterly 2.5D Prop sprites with sculpted bark, layered foliage boughs,
 * roaring campfire flames with roasting spit, canvas pavilion tents, iron-bound chests,
 * and carved stone altars/walls + matching Normal+Material maps.
 */
export function generatePropPbrBuffers(
  kind: PropKind,
  isOpen = false,
  rotatedSizeX = 1,
  rotatedSizeY = 1
): SynthesizedPbrBufferPair {
  const key = `${kind}_${isOpen ? 'open' : 'closed'}_${rotatedSizeX}x${rotatedSizeY}`;
  const cached = propCache.get(key);
  if (cached) return cached;

  const isMulti = rotatedSizeX > 1 || rotatedSizeY > 1;
  const width = isMulti ? 192 : 128;
  const height = 160;
  const albedoRGBA = new Uint8ClampedArray(width * height * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(width * height * 4);

  let anchorX = 0.5;
  let anchorY = 124 / height;

  if (rotatedSizeX === 2 && rotatedSizeY === 1) {
    anchorX = 64 / width;
    anchorY = 96 / height;
  } else if (rotatedSizeX === 1 && rotatedSizeY === 2) {
    anchorX = 128 / width;
    anchorY = 96 / height;
  }

  const baseAnchorPxX = Math.round(width * anchorX);
  const baseAnchorPxY = Math.round(height * anchorY);

  const renderSoftGroundAO = (cx: number, cy: number, rx: number, ry: number): void => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d <= 1.0) {
          blendPixel(
            albedoRGBA,
            normalMaterialRGBA,
            width,
            height,
            x,
            y,
            { r: 8, g: 10, b: 14 },
            1.0,
            (1.0 - d) * 0.45,
            0,
            -0.5,
            0.9,
            0.0
          );
        }
      }
    }
  };

  const renderFoliageCluster = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    baseCol: RGBAColor,
    highlightCol: RGBAColor,
    seedOffset: number
  ): void => {
    // Paint dozens of overlapping leaf/needle sub-clusters for rich organic canopy volume
    for (let sub = 0; sub < 28; sub++) {
      const angle = hash2D(sub * 11.3, seedOffset) * Math.PI * 2;
      const dist = Math.sqrt(hash2D(sub * 23.1, seedOffset + 5)) * 0.78;
      const scx = cx + Math.cos(angle) * rx * dist;
      const scy = cy + Math.sin(angle) * ry * dist;
      const srx = rx * (0.28 + hash2D(sub, seedOffset + 19) * 0.22);
      const sry = ry * (0.28 + hash2D(sub, seedOffset + 31) * 0.22);

      const globalDx = (scx - cx) / rx;
      const globalDy = (scy - cy) / ry;
      const isTopLit = globalDy < 0 && globalDx < 0.35;
      const col = isTopLit ? highlightCol : baseCol;
      const clusterShade = 0.72 - globalDy * 0.28 - globalDx * 0.12;

      for (let y = Math.floor(scy - sry); y <= Math.ceil(scy + sry); y++) {
        for (let x = Math.floor(scx - srx); x <= Math.ceil(scx + srx); x++) {
          const lx = (x - scx) / srx;
          const ly = (y - scy) / sry;
          const dSq = lx * lx + ly * ly;
          if (dSq <= 1.0) {
            const n = valueNoise(x * 0.42, y * 0.42);
            if (dSq > 0.72 && n < 0.38) continue;
            const nz = Math.sqrt(Math.max(0.05, 1.0 - dSq));
            const shade = clusterShade * (0.8 + 0.32 * nz + (n - 0.5) * 0.25);
            writePbrPixel(
              albedoRGBA,
              normalMaterialRGBA,
              width,
              height,
              x,
              y,
              col,
              shade,
              Math.max(-1, Math.min(1, globalDx * 0.5 + lx * 0.5)),
              Math.max(-1, Math.min(1, globalDy * 0.5 + ly * 0.5)),
              0.78,
              0.04
            );
          }
        }
      }
    }
  };

  const renderGnarledTrunk = (
    cx: number,
    cy: number,
    baseRadius: number,
    topRadius: number,
    trunkHeight: number,
    barkColor: RGBAColor
  ): void => {
    for (let sy = 0; sy <= trunkHeight; sy++) {
      const t = sy / trunkHeight;
      const r = baseRadius * (1 - t) + topRadius * t + (sy < 8 ? (8 - sy) * 0.65 : 0);
      const sway = Math.sin(t * Math.PI * 1.4) * 3.0;
      const py = cy - sy;
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const nx = dx / Math.max(1, r);
        if (Math.abs(nx) <= 1.0) {
          const barkGroove = Math.sin(dx * 1.6 + valueNoise(dx * 0.3, sy * 0.2) * 3.0);
          const shade = (0.72 - nx * 0.26) * (0.86 + barkGroove * 0.16);
          writePbrPixel(
            albedoRGBA,
            normalMaterialRGBA,
            width,
            height,
            cx + sway + dx,
            py,
            barkColor,
            shade,
            nx * 0.85,
            0.15,
            0.84,
            0.03
          );
        }
      }
    }
  };

  const renderIsoPrism = (
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    prismHeight: number,
    topColor: RGBAColor,
    sideColor: RGBAColor,
    roughness: number,
    metallic: number,
    voronoiScale = 0.12
  ): void => {
    const topCenterY = cy - prismHeight;
    for (let y = Math.floor(topCenterY - halfH); y <= Math.ceil(topCenterY + halfH); y++) {
      for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
        const dx = Math.abs(x - cx) / halfW;
        const dy = Math.abs(y - topCenterY) / halfH;
        if (dx + dy <= 1.0) {
          const vor = voronoiStone(x * voronoiScale, y * voronoiScale);
          const n = fbm(x * 0.18, y * 0.18, 3);
          const edgeBevel = 1.0 - (dx + dy) < 0.09 ? 1.18 : 0.9 + n * 0.2;
          const mortar = vor.edge < 0.08 ? 0.62 : 1.0;
          writePbrPixel(
            albedoRGBA,
            normalMaterialRGBA,
            width,
            height,
            x,
            y,
            topColor,
            edgeBevel * mortar,
            ((x - cx) / halfW) * 0.25,
            -0.55,
            roughness,
            metallic
          );
        }
      }
    }

    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
      const frontEdgeY = Math.round(topCenterY + halfH - Math.abs(x - cx) * (halfH / halfW));
      const isLeft = x < cx;
      const isCornerSeam = Math.abs(x - cx) <= 2;

      for (let sy = 0; sy < prismHeight; sy++) {
        const py = frontEdgeY + sy;
        const vor = voronoiStone(x * voronoiScale, sy * voronoiScale);
        const n = fbm(x * 0.16, sy * 0.16, 3);
        const mortar = sy % 13 === 0 || vor.edge < 0.075;
        const aoBottom = sy > prismHeight - 8 ? 0.72 + ((prismHeight - sy) / 8) * 0.28 : 1.0;
        const cornerHighlight = isCornerSeam ? 1.16 : 1.0;
        const shade =
          (isLeft ? 0.82 : 0.52) *
          (0.86 + n * 0.26) *
          (mortar ? 0.58 : 1.0) *
          aoBottom *
          cornerHighlight;

        writePbrPixel(
          albedoRGBA,
          normalMaterialRGBA,
          width,
          height,
          x,
          py,
          sideColor,
          shade,
          isLeft ? -0.72 : 0.72,
          0.25,
          roughness,
          metallic
        );
      }
    }
  };

  if (kind === 'pine_tree') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 36, 18);
    renderGnarledTrunk(baseAnchorPxX, baseAnchorPxY, 9, 4, 44, { r: 84, g: 54, b: 34 });
    // 4 tiered lush conifer boughs with sunlit tips and deep inner needle shadows
    renderFoliageCluster(
      baseAnchorPxX,
      baseAnchorPxY - 38,
      38,
      22,
      { r: 26, g: 58, b: 34 },
      { r: 48, g: 94, b: 48 },
      11
    );
    renderFoliageCluster(
      baseAnchorPxX,
      baseAnchorPxY - 60,
      31,
      20,
      { r: 32, g: 68, b: 38 },
      { r: 58, g: 112, b: 54 },
      27
    );
    renderFoliageCluster(
      baseAnchorPxX,
      baseAnchorPxY - 80,
      23,
      18,
      { r: 38, g: 78, b: 44 },
      { r: 72, g: 128, b: 62 },
      43
    );
    renderFoliageCluster(
      baseAnchorPxX,
      baseAnchorPxY - 98,
      14,
      15,
      { r: 46, g: 92, b: 48 },
      { r: 88, g: 146, b: 72 },
      61
    );
  } else if (kind === 'ancient_oak') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 44, 22);
    renderGnarledTrunk(baseAnchorPxX, baseAnchorPxY, 13, 7, 48, { r: 76, g: 52, b: 32 });
    renderFoliageCluster(
      baseAnchorPxX - 18,
      baseAnchorPxY - 58,
      28,
      22,
      { r: 36, g: 72, b: 32 },
      { r: 68, g: 118, b: 48 },
      101
    );
    renderFoliageCluster(
      baseAnchorPxX + 18,
      baseAnchorPxY - 56,
      28,
      22,
      { r: 32, g: 66, b: 30 },
      { r: 62, g: 108, b: 44 },
      137
    );
    renderFoliageCluster(
      baseAnchorPxX,
      baseAnchorPxY - 78,
      36,
      26,
      { r: 44, g: 84, b: 36 },
      { r: 86, g: 138, b: 56 },
      173
    );
  } else if (kind === 'campfire') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 34, 17);
    // Ring of 10 individual field boulders around ash pit
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rx = baseAnchorPxX + Math.cos(a) * 24;
      const ry = baseAnchorPxY - 4 + Math.sin(a) * 12;
      renderIsoPrism(
        rx,
        ry + 4,
        7,
        4,
        7,
        { r: 104, g: 100, b: 96 },
        { r: 74, g: 70, b: 66 },
        0.72,
        0.1
      );
    }
    // Glowing red-hot ember bed & charred split logs
    for (let y = -8; y <= 8; y++) {
      for (let x = -18; x <= 18; x++) {
        const d = Math.hypot(x / 18, y / 8);
        if (d <= 1.0) {
          const ember = valueNoise(x * 0.45, y * 0.45);
          const col =
            ember > 0.52 && isOpen
              ? { r: 255, g: 112, b: 28 }
              : { r: 42, g: 34, b: 30 };
          writePbrPixel(
            albedoRGBA,
            normalMaterialRGBA,
            width,
            height,
            baseAnchorPxX + x,
            baseAnchorPxY - 4 + y,
            col,
            isOpen ? 1.25 : 0.8,
            0,
            -0.6,
            0.5,
            0.2
          );
        }
      }
    }
    // Wooden spit / tripod stand over the campfire for roasting sausage!
    renderGnarledTrunk(baseAnchorPxX - 22, baseAnchorPxY + 2, 2.5, 2, 34, {
      r: 108,
      g: 74,
      b: 42
    });
    renderGnarledTrunk(baseAnchorPxX + 22, baseAnchorPxY + 2, 2.5, 2, 34, {
      r: 108,
      g: 74,
      b: 42
    });
    for (let sx = -22; sx <= 22; sx++) {
      writePbrPixel(
        albedoRGBA,
        normalMaterialRGBA,
        width,
        height,
        baseAnchorPxX + sx,
        baseAnchorPxY - 30,
        { r: 92, g: 64, b: 36 },
        1.0,
        0,
        -0.5,
        0.6,
        0.3
      );
    }

    if (isOpen) {
      // Multi-layered roaring fire tongues
      for (let y = -36; y <= 2; y++) {
        for (let x = -16; x <= 16; x++) {
          const hNorm = (2 - y) / 38; // 0 at base, 1 at tip
          const wave = Math.sin(y * 0.32 + x * 0.25) * 3.5 * hNorm;
          const widthAtY = (1.0 - hNorm * 0.82) * 15;
          const dist = Math.abs(x - wave) / Math.max(1, widthAtY);
          if (dist <= 1.0) {
            const core = 1.0 - dist;
            const col: RGBAColor =
              core > 0.62
                ? { r: 255, g: 244, b: 156 }
                : core > 0.32
                  ? { r: 255, g: 164, b: 42 }
                  : { r: 232, g: 68, b: 18 };
            blendPixel(
              albedoRGBA,
              normalMaterialRGBA,
              width,
              height,
              baseAnchorPxX + x,
              baseAnchorPxY - 6 + y,
              col,
              1.35,
              Math.min(1, core * 1.35),
              0,
              -0.85,
              0.05,
              0.95
            );
          }
        }
      }
    }
  } else if (kind === 'ground_loot') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 22, 11);
    if (!isOpen) {
      // Adventurer's leather knapsack + gleaming brass buckle + visible sausage coil / potion flask
      renderIsoPrism(
        baseAnchorPxX - 4,
        baseAnchorPxY,
        16,
        9,
        16,
        { r: 146, g: 88, b: 44 },
        { r: 112, g: 64, b: 32 },
        0.55,
        0.22
      );
      renderIsoPrism(
        baseAnchorPxX + 8,
        baseAnchorPxY + 2,
        10,
        6,
        11,
        { r: 186, g: 72, b: 62 },
        { r: 142, g: 52, b: 44 },
        0.4,
        0.15
      );
      // Gold glint badge
      renderIsoPrism(
        baseAnchorPxX - 2,
        baseAnchorPxY - 8,
        5,
        3,
        6,
        { r: 248, g: 212, b: 86 },
        { r: 212, g: 168, b: 54 },
        0.15,
        0.95
      );
    } else {
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        12,
        6,
        4,
        { r: 86, g: 68, b: 52 },
        { r: 64, g: 50, b: 38 },
        0.8,
        0.05
      );
    }
  } else if (kind === 'wall_block') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 58, 29);
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      58,
      29,
      68,
      { r: 94, g: 98, b: 112 },
      { r: 78, g: 82, b: 96 },
      0.62,
      0.18,
      0.09
    );
  } else if (kind === 'pillar') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 34, 17);
    // Stepped plinth base + fluted shaft + carved capital
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      32,
      16,
      14,
      { r: 108, g: 112, b: 126 },
      { r: 88, g: 92, b: 106 },
      0.5,
      0.25
    );
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY - 12,
      22,
      11,
      68,
      { r: 122, g: 126, b: 140 },
      { r: 102, g: 106, b: 120 },
      0.42,
      0.32
    );
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY - 76,
      30,
      15,
      12,
      { r: 136, g: 140, b: 154 },
      { r: 112, g: 116, b: 130 },
      0.38,
      0.35
    );
  } else if (kind === 'door') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 54, 27);
    if (!isOpen) {
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        54,
        26,
        64,
        { r: 128, g: 86, b: 48 },
        { r: 98, g: 64, b: 36 },
        0.52,
        0.42
      );
      // Iron reinforcement bands
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY - 18,
        55,
        27,
        5,
        { r: 148, g: 156, b: 168 },
        { r: 112, g: 118, b: 130 },
        0.25,
        0.88
      );
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY - 42,
        55,
        27,
        5,
        { r: 148, g: 156, b: 168 },
        { r: 112, g: 118, b: 130 },
        0.25,
        0.88
      );
    } else {
      renderIsoPrism(
        baseAnchorPxX - 34,
        baseAnchorPxY - 12,
        16,
        8,
        64,
        { r: 112, g: 94, b: 72 },
        { r: 88, g: 72, b: 54 },
        0.5,
        0.4
      );
      renderIsoPrism(
        baseAnchorPxX + 34,
        baseAnchorPxY + 12,
        16,
        8,
        64,
        { r: 112, g: 94, b: 72 },
        { r: 88, g: 72, b: 54 },
        0.5,
        0.4
      );
    }
  } else if (kind === 'chest') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 32, 16);
    const lidColor = isOpen ? { r: 238, g: 198, b: 78 } : { r: 142, g: 94, b: 46 };
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      28,
      14,
      24,
      lidColor,
      { r: 96, g: 62, b: 32 },
      0.32,
      0.68
    );
    // Brass lock plate
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY - 8,
      8,
      4,
      10,
      { r: 232, g: 192, b: 84 },
      { r: 196, g: 154, b: 58 },
      0.2,
      0.92
    );
  } else if (kind === 'torch_sconce') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 18, 9);
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      12,
      6,
      46,
      { r: 96, g: 86, b: 76 },
      { r: 64, g: 58, b: 54 },
      0.48,
      0.68
    );
    if (isOpen) {
      for (let y = -18; y <= 4; y++) {
        for (let x = -10; x <= 10; x++) {
          const d = Math.hypot(x / 9, y / 14);
          if (d <= 1.0) {
            writePbrPixel(
              albedoRGBA,
              normalMaterialRGBA,
              width,
              height,
              baseAnchorPxX + x,
              baseAnchorPxY - 52 + y,
              d < 0.45 ? { r: 255, g: 242, b: 148 } : { r: 255, g: 164, b: 48 },
              1.4 - d * 0.35,
              0,
              -0.85,
              0.08,
              0.92
            );
          }
        }
      }
    }
  } else if (kind === 'arcane_crystal') {
    renderSoftGroundAO(baseAnchorPxX, baseAnchorPxY, 28, 14);
    const cColor = isOpen ? { r: 72, g: 232, b: 255 } : { r: 62, g: 84, b: 102 };
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      26,
      13,
      14,
      { r: 78, g: 84, b: 98 },
      { r: 58, g: 64, b: 78 },
      0.5,
      0.35
    );
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY - 12,
      18,
      9,
      54,
      cColor,
      cColor,
      0.12,
      0.92
    );
  } else if (
    kind === 'runic_altar' ||
    kind === 'sarcophagus' ||
    kind === 'ranger_tent' ||
    kind === 'fallen_log' ||
    kind === 'exit_path'
  ) {
    const stepDx = rotatedSizeX > 1 ? 32 : -32;
    const stepDy = 16;

    if (kind === 'ranger_tent') {
      renderSoftGroundAO(baseAnchorPxX + stepDx * 0.5, baseAnchorPxY + stepDy * 0.5, 62, 30);
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        46,
        23,
        44,
        { r: 158, g: 126, b: 86 },
        { r: 118, g: 92, b: 62 },
        0.74,
        0.1
      );
      renderIsoPrism(
        baseAnchorPxX + stepDx,
        baseAnchorPxY + stepDy,
        46,
        23,
        44,
        { r: 158, g: 126, b: 86 },
        { r: 118, g: 92, b: 62 },
        0.74,
        0.1
      );
      // Wooden ridge beam & crimson heraldic stripe
      renderIsoPrism(
        baseAnchorPxX + stepDx * 0.5,
        baseAnchorPxY + stepDy * 0.5 - 40,
        36,
        14,
        10,
        { r: 156, g: 44, b: 42 },
        { r: 118, g: 32, b: 32 },
        0.65,
        0.18
      );
    } else if (kind === 'fallen_log') {
      renderSoftGroundAO(baseAnchorPxX + stepDx * 0.5, baseAnchorPxY + stepDy * 0.5, 52, 24);
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        32,
        16,
        18,
        { r: 72, g: 98, b: 48 }, // Moss-covered top bark
        { r: 84, g: 56, b: 34 },
        0.82,
        0.05
      );
      renderIsoPrism(
        baseAnchorPxX + stepDx,
        baseAnchorPxY + stepDy,
        32,
        16,
        18,
        { r: 72, g: 98, b: 48 },
        { r: 84, g: 56, b: 34 },
        0.82,
        0.05
      );
    } else if (kind === 'exit_path') {
      renderSoftGroundAO(baseAnchorPxX + stepDx * 0.5, baseAnchorPxY + stepDy * 0.5, 56, 26);
      // Frontier wooden gateposts + crossbeam signpost
      renderIsoPrism(
        baseAnchorPxX - 18,
        baseAnchorPxY,
        14,
        7,
        58,
        { r: 138, g: 98, b: 54 },
        { r: 98, g: 68, b: 38 },
        0.65,
        0.2
      );
      renderIsoPrism(
        baseAnchorPxX + stepDx + 14,
        baseAnchorPxY + stepDy,
        14,
        7,
        58,
        { r: 138, g: 98, b: 54 },
        { r: 98, g: 68, b: 38 },
        0.65,
        0.2
      );
      renderIsoPrism(
        baseAnchorPxX + stepDx * 0.5,
        baseAnchorPxY + stepDy * 0.5 - 42,
        42,
        14,
        10,
        { r: 164, g: 118, b: 64 },
        { r: 118, g: 82, b: 44 },
        0.58,
        0.25
      );
    } else {
      renderSoftGroundAO(baseAnchorPxX + stepDx * 0.5, baseAnchorPxY + stepDy * 0.5, 58, 28);
      const topCol =
        kind === 'runic_altar' ? { r: 88, g: 214, b: 245 } : { r: 152, g: 144, b: 124 };
      const sideCol =
        kind === 'runic_altar' ? { r: 64, g: 78, b: 104 } : { r: 108, g: 102, b: 90 };

      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        44,
        22,
        36,
        topCol,
        sideCol,
        0.25,
        0.58
      );
      renderIsoPrism(
        baseAnchorPxX + stepDx,
        baseAnchorPxY + stepDy,
        44,
        22,
        36,
        topCol,
        sideCol,
        0.25,
        0.58
      );
    }
  }

  enhanceNormalsFromAlbedoRelief(albedoRGBA, normalMaterialRGBA, width, height, 2.1);

  const pair: SynthesizedPbrBufferPair = {
    width,
    height,
    anchorX,
    anchorY,
    albedoRGBA,
    normalMaterialRGBA
  };

  propCache.set(key, pair);
  return pair;
}
