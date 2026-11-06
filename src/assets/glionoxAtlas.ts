import { ELEVATION_STEP_PX, TILE_HEIGHT, TILE_WIDTH } from '../core/isoMath';
import { SynthesizedPbrBufferPair } from './proceduralForge';

export interface LoadedImageBuffer {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export interface GlionoxForestRawSheets {
  trees: LoadedImageBuffer;   // 864 x 224 (9 frames of 96x224)
  stumps: LoadedImageBuffer;  // 864 x 48  (9 frames of 96x48)
  env: LoadedImageBuffer;     // 384 x 240 (8 cols x 5 rows of 48x48)
  tileset: LoadedImageBuffer; // 144 x 208 (9 cols x 13 rows of 16x16)
}

let loadedSheets: GlionoxForestRawSheets | null = null;
let loadPromise: Promise<GlionoxForestRawSheets | null> | null = null;

function loadSinglePngBuffer(url: string): Promise<LoadedImageBuffer> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('DOM Image API unavailable in headless test environment'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve({
        width: canvas.width,
        height: canvas.height,
        rgba: imgData.data
      });
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * Asynchronously loads the 4 official PNG sheets from Glionox's
 * "Forest Biome Environment Set" (https://glionox.itch.io/forest-biome-environment-set)
 * located in `public/assets/glionox/`.
 */
export async function preloadGlionoxForestAssets(): Promise<GlionoxForestRawSheets | null> {
  if (loadedSheets) return loadedSheets;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [trees, stumps, env, tileset] = await Promise.all([
        loadSinglePngBuffer('./assets/glionox/forest_trees.png'),
        loadSinglePngBuffer('./assets/glionox/forest_stumps.png'),
        loadSinglePngBuffer('./assets/glionox/forest_env.png'),
        loadSinglePngBuffer('./assets/glionox/forest_tileset.png')
      ]);
      loadedSheets = { trees, stumps, env, tileset };
      return loadedSheets;
    } catch {
      // Graceful fallback in Node/Vitest environment
      return null;
    }
  })();

  return loadPromise;
}

export function getGlionoxSheets(): GlionoxForestRawSheets | null {
  return loadedSheets;
}

/**
 * Generates a tangent-space normal & PBR material map for a pixel-art sprite
 * by combining spherical canopy/object volume normals with crisp Sobel luminance relief.
 */
function buildPixelArtNormalMaterialBuffer(
  albedo: Uint8ClampedArray,
  width: number,
  height: number,
  roughness = 0.78,
  metallic = 0.04,
  reliefStrength = 2.4
): Uint8ClampedArray {
  const normalMat = new Uint8ClampedArray(width * height * 4);

  // Find bounding box of opaque pixels to shape spherical volume normal
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (albedo[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const rx = Math.max(8, (maxX - minX) * 0.5);
  const ry = Math.max(8, (maxY - minY) * 0.5);

  const lumAt = (x: number, y: number): number => {
    const px = Math.min(width - 1, Math.max(0, x));
    const py = Math.min(height - 1, Math.max(0, y));
    const idx = (py * width + px) * 4;
    if (albedo[idx + 3] < 16) return 0;
    return (albedo[idx] * 0.299 + albedo[idx + 1] * 0.587 + albedo[idx + 2] * 0.114) / 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (albedo[idx + 3] < 16) continue;

      const volNx = ((x - cx) / rx) * 0.55;
      const volNy = ((y - cy) / ry) * 0.55 - 0.15;

      const dX = (lumAt(x - 1, y) - lumAt(x + 1, y)) * reliefStrength;
      const dY = (lumAt(x, y - 1) - lumAt(x, y + 1)) * reliefStrength;

      const nx = Math.max(-1, Math.min(1, volNx + dX * 0.65));
      const ny = Math.max(-1, Math.min(1, volNy + dY * 0.65));

      normalMat[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalMat[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalMat[idx + 2] = Math.round(roughness * 255);
      normalMat[idx + 3] = Math.round(metallic * 255);
    }
  }

  return normalMat;
}

/**
 * Extracts a rectangular frame from a source sheet and scales it with crisp Nearest-Neighbor
 * interpolation into a target canvas buffer, adding a subtle ground ambient occlusion shadow.
 */
function extractAndScaleSpritePbr(
  sheet: LoadedImageBuffer,
  srcX: number,
  srcY: number,
  srcW: number,
  srcH: number,
  scale: number,
  anchorYRatio: number,
  aoRadiusX: number,
  aoRadiusY: number
): SynthesizedPbrBufferPair {
  const width = Math.round(srcW * scale);
  const height = Math.round(srcH * scale);
  const albedoRGBA = new Uint8ClampedArray(width * height * 4);

  const anchorPxX = Math.round(width * 0.5);
  const anchorPxY = Math.round(height * anchorYRatio);

  // 1. Soft Ground Ambient Occlusion ellipse under the sprite base
  if (aoRadiusX > 0 && aoRadiusY > 0) {
    for (let y = Math.max(0, Math.floor(anchorPxY - aoRadiusY)); y <= Math.min(height - 1, Math.ceil(anchorPxY + aoRadiusY)); y++) {
      for (let x = Math.max(0, Math.floor(anchorPxX - aoRadiusX)); x <= Math.min(width - 1, Math.ceil(anchorPxX + aoRadiusX)); x++) {
        const d = Math.hypot((x - anchorPxX) / aoRadiusX, (y - anchorPxY) / aoRadiusY);
        if (d <= 1.0) {
          const i = (y * width + x) * 4;
          albedoRGBA[i] = 10;
          albedoRGBA[i + 1] = 14;
          albedoRGBA[i + 2] = 12;
          albedoRGBA[i + 3] = Math.round((1.0 - d) * 105);
        }
      }
    }
  }

  // 2. Nearest-Neighbor crisp pixel-art blit
  for (let y = 0; y < height; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x / scale));
      const sIdx = ((srcY + sy) * sheet.width + (srcX + sx)) * 4;
      const a = sheet.rgba[sIdx + 3];
      if (a > 12) {
        const dIdx = (y * width + x) * 4;
        albedoRGBA[dIdx] = sheet.rgba[sIdx];
        albedoRGBA[dIdx + 1] = sheet.rgba[sIdx + 1];
        albedoRGBA[dIdx + 2] = sheet.rgba[sIdx + 2];
        albedoRGBA[dIdx + 3] = a;
      }
    }
  }

  const normalMaterialRGBA = buildPixelArtNormalMaterialBuffer(
    albedoRGBA,
    width,
    height,
    0.78,
    0.04,
    2.2
  );

  return {
    width,
    height,
    anchorX: 0.5,
    anchorY: anchorYRatio,
    albedoRGBA,
    normalMaterialRGBA
  };
}

const glionoxPropCache = new Map<string, SynthesizedPbrBufferPair>();

/**
 * Extracts one of the 9 Glionox Forest Trees (`forest_trees.png`, 96x224 per frame)
 * scaled by 1.25x nearest-neighbor (120x280) to fit the 128x64 isometric grid.
 */
export function getGlionoxTreePbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 9) + 9) % 9;
  const key = `glionox_tree_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.trees,
    idx * 96,
    0,
    96,
    224,
    1.25,
    218 / 224,
    34,
    16
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 9 Glionox Tree Stumps (`forest_stumps.png`, 96x48 per frame)
 * scaled by 1.25x nearest-neighbor (120x60).
 */
export function getGlionoxStumpPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 9) + 9) % 9;
  const key = `glionox_stump_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.stumps,
    idx * 96,
    0,
    96,
    48,
    1.25,
    44 / 48,
    22,
    11
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 8 Glionox Lush / Berry Bushes (`forest_env.png`, row 4, 48x48 per cell)
 * scaled by 1.35x nearest-neighbor (65x65).
 */
export function getGlionoxBushPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const col = ((variantIndex % 8) + 8) % 8;
  const key = `glionox_bush_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.env,
    col * 48,
    4 * 48,
    48,
    48,
    1.35,
    44 / 48,
    20,
    10
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 32 Glionox Wildflowers & Grass Clumps (`forest_env.png`, rows 0..3, 48x48 per cell)
 * scaled by 1.25x nearest-neighbor (60x60).
 */
export function getGlionoxWildflowerOrGrassPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 32) + 32) % 32;
  const key = `glionox_flora_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const row = Math.floor(idx / 8); // 0..1 = wildflowers, 2..3 = grass clumps
  const col = idx % 8;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.env,
    col * 48,
    row * 48,
    48,
    48,
    1.25,
    42 / 48,
    0,
    0
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

const glionoxTileCache = new Map<string, SynthesizedPbrBufferPair>();

/**
 * Synthesizes an isometric 2:1 tile (`forest_grass`, `forest_soil`, or `dirt_path`) using
 * Glionox's `forest_tileset.png` textures (olive-green meadow top, jagged grass overhang lip,
 * and rocky brown cliff walls from rows 11..12) + grass tuft accents from `forest_env.png`.
 */
export function generateGlionoxForestTilePbr(
  terrain: 'forest_grass' | 'forest_soil' | 'dirt_path',
  elevationSteps: number
): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const key = `glionox_tile_${terrain}_z${elevationSteps}`;
  const cached = glionoxTileCache.get(key);
  if (cached) return cached;

  const ts = loadedSheets.tileset;
  const skirtSteps = Math.max(1, elevationSteps + 1);
  const skirtPx = skirtSteps * ELEVATION_STEP_PX;
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT + skirtPx;
  const halfW = width * 0.5;
  const halfH = TILE_HEIGHT * 0.5;

  const albedoRGBA = new Uint8ClampedArray(width * height * 4);

  // Sample helper from `forest_tileset.png` with pixel-art scale factor 2x
  const sampleTileset = (srcBaseX: number, srcBaseY: number, spanW: number, spanH: number, px: number, py: number) => {
    const tx = srcBaseX + (Math.floor(px * 0.5) % spanW + spanW) % spanW;
    const ty = srcBaseY + (Math.floor(py * 0.5) % spanH + spanH) % spanH;
    const idx = (ty * ts.width + tx) * 4;
    return {
      r: ts.rgba[idx],
      g: ts.rgba[idx + 1],
      b: ts.rgba[idx + 2],
      a: ts.rgba[idx + 3]
    };
  };

  // 1. Top Isometric Diamond Face using Glionox's exact grass & soil tileset palette
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - halfW) / halfW;
      const dy = Math.abs(y - halfH) / halfH;
      if (dx + dy <= 1.0) {
        const edgeDist = 1.0 - (dx + dy);
        // Sample textured detail tile (rows 9..10, cols 3..7 have Glionox grass tufts & pebbles)
        const detailSample = sampleTileset(48, 144, 64, 32, x, y);

        let r = 127;
        let g = 142;
        let b = 68;

        if (terrain === 'forest_grass') {
          r = detailSample.a > 128 ? detailSample.r : 127;
          g = detailSample.a > 128 ? detailSample.g : 142;
          b = detailSample.a > 128 ? detailSample.b : 68;
          // Subtle checkerboard pixel-art grass variation
          if (((Math.floor(x / 2) + Math.floor(y / 2)) % 7 === 0) && r === 127) {
            r = 116;
            g = 132;
            b = 62;
          }
        } else if (terrain === 'forest_soil') {
          // Darker canopy-shaded forest floor matching Glionox shadow grass
          r = Math.round((detailSample.a > 128 ? detailSample.r : 127) * 0.76);
          g = Math.round((detailSample.a > 128 ? detailSample.g : 142) * 0.78);
          b = Math.round((detailSample.a > 128 ? detailSample.b : 68) * 0.74);
        } else if (terrain === 'dirt_path') {
          // Earthy brown trail sampled from Glionox's dirt/stone palette (rows 11..12) with grassy edge transition
          if (edgeDist < 0.14) {
            r = 104;
            g = 124;
            b = 58;
          } else {
            const cliffSample = sampleTileset(32, 176, 64, 32, x, y);
            r = Math.min(255, Math.round(cliffSample.r * 1.25 + 22));
            g = Math.min(255, Math.round(cliffSample.g * 1.18 + 18));
            b = Math.min(255, Math.round(cliffSample.b * 1.1 + 14));
          }
        }

        const edgeShade = edgeDist < 0.04 ? 0.92 : 1.0;
        const outIdx = (y * width + x) * 4;
        albedoRGBA[outIdx] = Math.round(r * edgeShade);
        albedoRGBA[outIdx + 1] = Math.round(g * edgeShade);
        albedoRGBA[outIdx + 2] = Math.round(b * edgeShade);
        albedoRGBA[outIdx + 3] = 255;
      }
    }
  }

  // 2. Stamp 2 small pixel-art grass tufts from `forest_env.png` (rows 2..3) onto `forest_grass`
  if (terrain === 'forest_grass') {
    const env = loadedSheets.env;
    const tuftSpots = [
      { cx: 46, cy: 26, col: (elevationSteps * 3 + 1) % 8, row: 2 },
      { cx: 82, cy: 38, col: (elevationSteps * 5 + 4) % 8, row: 3 }
    ];
    for (const spot of tuftSpots) {
      const srcX0 = spot.col * 48;
      const srcY0 = spot.row * 48;
      for (let sy = 16; sy < 44; sy++) {
        for (let sx = 12; sx < 36; sx++) {
          const sIdx = ((srcY0 + sy) * env.width + (srcX0 + sx)) * 4;
          if (env.rgba[sIdx + 3] > 120) {
            const dx = spot.cx + (sx - 24);
            const dy = spot.cy + (sy - 32);
            if (dx >= 8 && dx < width - 8 && dy >= 4 && dy < TILE_HEIGHT - 4) {
              const dIdx = (dy * width + dx) * 4;
              if (albedoRGBA[dIdx + 3] > 0) {
                albedoRGBA[dIdx] = env.rgba[sIdx];
                albedoRGBA[dIdx + 1] = env.rgba[sIdx + 1];
                albedoRGBA[dIdx + 2] = env.rgba[sIdx + 2];
              }
            }
          }
        }
      }
    }
  }

  // 3. Render Glionox's Jagged Grass Overhang Lip + Rocky Brown Cliff Wall (rows 11..12 of `forest_tileset.png`)
  for (let x = 0; x < width; x++) {
    const bottomDiamondY = Math.round(TILE_HEIGHT - Math.abs(x - halfW) * 0.5);
    const isLeftFace = x < halfW;
    // Jagged pixel-art grass overhang length (4..8 px)
    const lipDepth = 4 + ((Math.floor(x / 2) * 5 + 3) % 5);

    for (let sy = 0; sy < skirtPx; sy++) {
      const py = bottomDiamondY + sy;
      if (py >= height) continue;

      const outIdx = (py * width + x) * 4;
      const faceShade = isLeftFace ? 0.96 : 0.72;

      if (sy < lipDepth && terrain !== 'dirt_path') {
        // Jagged overhanging grass lip (#7f8e44 top -> #477238 dark lower tip)
        const isTip = sy >= lipDepth - 2;
        const r = isTip ? 71 : 112;
        const g = isTip ? 114 : 132;
        const b = isTip ? 56 : 62;
        albedoRGBA[outIdx] = Math.round(r * faceShade);
        albedoRGBA[outIdx + 1] = Math.round(g * faceShade);
        albedoRGBA[outIdx + 2] = Math.round(b * faceShade);
        albedoRGBA[outIdx + 3] = 255;
      } else {
        // Sample Glionox rocky cliff wall directly from `forest_tileset.png` (x: 16..127, y: 176..207)
        const cliff = sampleTileset(16, 176, 96, 32, x, sy);
        const depthDarken = 1.0 - (sy / Math.max(1, skirtPx)) * 0.22;
        const shade = faceShade * depthDarken;
        albedoRGBA[outIdx] = Math.round((cliff.a > 0 ? cliff.r : 76) * shade);
        albedoRGBA[outIdx + 1] = Math.round((cliff.a > 0 ? cliff.g : 61) * shade);
        albedoRGBA[outIdx + 2] = Math.round((cliff.a > 0 ? cliff.b : 46) * shade);
        albedoRGBA[outIdx + 3] = 255;
      }
    }
  }

  const normalMaterialRGBA = buildPixelArtNormalMaterialBuffer(
    albedoRGBA,
    width,
    height,
    0.82,
    0.03,
    1.8
  );

  const pair: SynthesizedPbrBufferPair = {
    width,
    height,
    anchorX: 0.5,
    anchorY: (TILE_HEIGHT * 0.5) / height,
    albedoRGBA,
    normalMaterialRGBA
  };

  glionoxTileCache.set(key, pair);
  return pair;
}
