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
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const idx = (y * w + x) * 4;
  albedo[idx] = Math.min(255, Math.max(0, Math.round(color.r * shade)));
  albedo[idx + 1] = Math.min(255, Math.max(0, Math.round(color.g * shade)));
  albedo[idx + 2] = Math.min(255, Math.max(0, Math.round(color.b * shade)));
  albedo[idx + 3] = 255;

  normalMat[idx] = Math.min(255, Math.max(0, Math.round((nx * 0.5 + 0.5) * 255)));
  normalMat[idx + 1] = Math.min(255, Math.max(0, Math.round((ny * 0.5 + 0.5) * 255)));
  normalMat[idx + 2] = Math.min(255, Math.max(0, Math.round(roughness * 255)));
  normalMat[idx + 3] = Math.min(255, Math.max(0, Math.round(metallic * 255)));
}

const tileCache = new Map<string, SynthesizedPbrBufferPair>();

/**
 * Generates an isometric 2:1 tile sprite with extruded vertical cliff faces (for elevation > 0)
 * plus matching tangent-space Normal + Roughness/Metallic buffers.
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

  let baseColor: RGBAColor = { r: 64, g: 68, b: 78 };
  let roughness = 0.72;
  let metallic = 0.1;

  if (terrain === 'sanctum_marble') {
    baseColor = { r: 108, g: 112, b: 126 };
    roughness = 0.32;
    metallic = 0.25;
  } else if (terrain === 'mossy_cobble') {
    baseColor = { r: 66, g: 76, b: 64 };
    roughness = 0.8;
    metallic = 0.05;
  } else if (terrain === 'arcane_inlay') {
    baseColor = { r: 58, g: 68, b: 92 };
    roughness = 0.28;
    metallic = 0.55;
  } else if (terrain === 'stairs_stone') {
    baseColor = { r: 88, g: 86, b: 82 };
    roughness = 0.65;
    metallic = 0.12;
  } else if (terrain === 'abyss_water') {
    baseColor = { r: 22, g: 48, b: 68 };
    roughness = 0.12;
    metallic = 0.65;
  }

  // 1. Render Top Diamond Face
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - halfW) / halfW;
      const dy = Math.abs(y - halfH) / halfH;
      if (dx + dy <= 1.0) {
        // Compute isometric UV coordinates u, v in [0..1]
        const u = ((x - halfW) / halfW + (y - halfH) / halfH) * 0.5 + 0.5;
        const v = ((y - halfH) / halfH - (x - halfW) / halfW) * 0.5 + 0.5;

        const n1 = valueNoise(x * 0.16, y * 0.16);
        const n2 = valueNoise(x * 0.42, y * 0.42) * 0.5;
        const hCenter = n1 * 0.7 + n2 * 0.3;
        const hRight = valueNoise((x + 1) * 0.16, y * 0.16);
        const hDown = valueNoise(x * 0.16, (y + 1) * 0.16);

        let nx = (hCenter - hRight) * 1.9;
        let ny = (hCenter - hDown) * 1.9 - 0.18; // Tilted slightly toward viewer/zenith
        let shade = 0.86 + (hCenter - 0.5) * 0.24;
        let pixelColor = baseColor;

        // Stone block joints & bevel border
        const edgeDist = 1.0 - (dx + dy);
        if (edgeDist < 0.065) {
          shade *= 0.68;
          ny += 0.35;
        }

        // Masonry grid grooves
        const gridU = (u * 2) % 1;
        const gridV = (v * 2) % 1;
        if (terrain !== 'abyss_water' && (gridU < 0.05 || gridV < 0.05)) {
          shade *= 0.64;
          nx += gridU < 0.05 ? 0.45 : 0;
          ny += gridV < 0.05 ? 0.45 : 0;
        }

        // Gold/Cyan runic inlay circle for arcane_inlay
        if (terrain === 'arcane_inlay') {
          const rDist = Math.hypot(u - 0.5, v - 0.5);
          if (Math.abs(rDist - 0.32) < 0.038 || Math.abs(u - v) < 0.025) {
            pixelColor = { r: 78, g: 218, b: 248 };
            shade = 1.22;
          }
        }

        // Stepped ledges for stairs_stone
        if (terrain === 'stairs_stone') {
          const stepIdx = Math.floor(y / 10);
          const stepLocal = y % 10;
          shade = stepLocal < 3 ? 0.62 : 1.05 - stepIdx * 0.03;
          ny = stepLocal < 3 ? 0.75 : -0.25;
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

  // 2. Render Extruded Left & Right Vertical Cliff Walls below the front edges of the diamond
  for (let x = 0; x < width; x++) {
    const bottomDiamondY = Math.round(TILE_HEIGHT - Math.abs(x - halfW) * 0.5);
    const isLeftFace = x < halfW;

    for (let sy = 0; sy < skirtPx; sy++) {
      const py = bottomDiamondY + sy;
      if (py >= height) continue;

      const brickNoise = valueNoise(x * 0.18, sy * 0.22);
      const mortarRow = sy % 12 === 0;
      const faceShade = (isLeftFace ? 0.66 : 0.46) * (0.85 + brickNoise * 0.25) * (mortarRow ? 0.65 : 1.0);
      const nx = isLeftFace ? -0.68 : 0.68;
      const ny = 0.38;

      writePbrPixel(
        albedoRGBA,
        normalMaterialRGBA,
        width,
        height,
        x,
        py,
        baseColor,
        faceShade,
        nx,
        ny,
        roughness,
        metallic
      );
    }
  }

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
 * Generates isometric 2.5D Prop sprites (walls, pillars, doors, chests, torches, crystals,
 * and 2x1 / 1x2 multi-tile altars & sarcophagi) with matching Normal+Material maps.
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
  const height = isMulti ? 160 : 160;
  const albedoRGBA = new Uint8ClampedArray(width * height * 4);
  const normalMaterialRGBA = new Uint8ClampedArray(width * height * 4);

  // Anchor is positioned at the center of the back-most tile (rx, ry)
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

  const renderIsoPrism = (
    cx: number,
    cy: number,
    halfW: number,
    halfH: number,
    prismHeight: number,
    topColor: RGBAColor,
    sideColor: RGBAColor,
    roughness: number,
    metallic: number
  ): void => {
    const topCenterY = cy - prismHeight;
    // Top diamond
    for (let y = Math.floor(topCenterY - halfH); y <= Math.ceil(topCenterY + halfH); y++) {
      for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
        const dx = Math.abs(x - cx) / halfW;
        const dy = Math.abs(y - topCenterY) / halfH;
        if (dx + dy <= 1.0) {
          const n = valueNoise(x * 0.2, y * 0.2);
          const border = 1.0 - (dx + dy) < 0.08 ? 1.15 : 0.92 + n * 0.16;
          writePbrPixel(
            albedoRGBA,
            normalMaterialRGBA,
            width,
            height,
            x,
            y,
            topColor,
            border,
            (x - cx) / halfW * 0.2,
            -0.45,
            roughness,
            metallic
          );
        }
      }
    }

    // Left and right extruded vertical faces
    for (let x = Math.floor(cx - halfW); x <= Math.ceil(cx + halfW); x++) {
      const frontEdgeY = Math.round(topCenterY + halfH - Math.abs(x - cx) * (halfH / halfW));
      const isLeft = x < cx;
      for (let sy = 0; sy < prismHeight; sy++) {
        const py = frontEdgeY + sy;
        const n = valueNoise(x * 0.18, sy * 0.18);
        const mortar = sy % 14 === 0 || (x + Math.floor(sy / 14) * 11) % 22 === 0;
        const shade = (isLeft ? 0.78 : 0.54) * (0.88 + n * 0.22) * (mortar ? 0.68 : 1.0);
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

  if (kind === 'wall_block') {
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      58,
      29,
      66,
      { r: 86, g: 90, b: 102 },
      { r: 74, g: 78, b: 90 },
      0.68,
      0.15
    );
  } else if (kind === 'pillar') {
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      30,
      15,
      86,
      { r: 112, g: 116, b: 128 },
      { r: 96, g: 100, b: 114 },
      0.45,
      0.28
    );
  } else if (kind === 'door') {
    if (!isOpen) {
      renderIsoPrism(
        baseAnchorPxX,
        baseAnchorPxY,
        54,
        26,
        62,
        { r: 124, g: 84, b: 48 },
        { r: 98, g: 64, b: 36 },
        0.52,
        0.42
      );
    } else {
      // Open doorway pillars on the left & right corners
      renderIsoPrism(
        baseAnchorPxX - 34,
        baseAnchorPxY - 12,
        16,
        8,
        62,
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
        62,
        { r: 112, g: 94, b: 72 },
        { r: 88, g: 72, b: 54 },
        0.5,
        0.4
      );
    }
  } else if (kind === 'chest') {
    const lidColor = isOpen ? { r: 218, g: 182, b: 78 } : { r: 138, g: 92, b: 46 };
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      28,
      14,
      24,
      lidColor,
      { r: 96, g: 62, b: 32 },
      0.35,
      0.65
    );
  } else if (kind === 'torch_sconce') {
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      14,
      7,
      44,
      { r: 92, g: 82, b: 74 },
      { r: 64, g: 58, b: 54 },
      0.5,
      0.65
    );
    if (isOpen) {
      // Glowing ember crown
      for (let y = -12; y <= 6; y++) {
        for (let x = -9; x <= 9; x++) {
          const d = Math.hypot(x / 8, y / 11);
          if (d <= 1.0) {
            writePbrPixel(
              albedoRGBA,
              normalMaterialRGBA,
              width,
              height,
              baseAnchorPxX + x,
              baseAnchorPxY - 50 + y,
              { r: 255, g: 196, b: 78 },
              1.35 - d * 0.4,
              0,
              -0.8,
              0.1,
              0.9
            );
          }
        }
      }
    }
  } else if (kind === 'arcane_crystal') {
    const cColor = isOpen ? { r: 68, g: 228, b: 255 } : { r: 62, g: 84, b: 102 };
    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      24,
      12,
      58,
      cColor,
      cColor,
      0.15,
      0.88
    );
  } else if (kind === 'runic_altar' || kind === 'sarcophagus') {
    const stepDx = rotatedSizeX > 1 ? 32 : -32;
    const stepDy = 16;
    const topCol =
      kind === 'runic_altar' ? { r: 84, g: 196, b: 224 } : { r: 146, g: 138, b: 118 };
    const sideCol =
      kind === 'runic_altar' ? { r: 64, g: 76, b: 98 } : { r: 104, g: 98, b: 86 };

    renderIsoPrism(
      baseAnchorPxX,
      baseAnchorPxY,
      44,
      22,
      36,
      topCol,
      sideCol,
      0.28,
      0.55
    );
    renderIsoPrism(
      baseAnchorPxX + stepDx,
      baseAnchorPxY + stepDy,
      44,
      22,
      36,
      topCol,
      sideCol,
      0.28,
      0.55
    );
  }

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
