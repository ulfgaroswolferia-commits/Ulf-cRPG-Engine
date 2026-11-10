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
  ogaCabins?: LoadedImageBuffer;        // 1024 x 1024 (4 cols x 4 rows of 256x256)
  ogaTrees?: LoadedImageBuffer;         // 1600 x 640  (10 cols x 2 rows of 160x320)
  ogaPropsFence?: LoadedImageBuffer;    // 1024 x 640  (8 cols x 5 rows of 128x128)
  ogaTerrainTiles?: LoadedImageBuffer;  // 1024 x 384  (8 cols x 6 rows of 128x64)
  ogaCliffsFoliage?: LoadedImageBuffer; // 1024 x 512  (row 0: 8x 128x256 cliffs; row 1..2: 8x 128x128 bushes/grass)
  dungeonPngMap?: Map<string, LoadedImageBuffer>;
}

const dungeonPngMap = new Map<string, LoadedImageBuffer>();

export function getKenneyDungeonPropPbr(
  filename: string,
  scale = 0.5,
  anchorRatioY = 384 / 512,
  aoRadiusX = 32,
  aoRadiusY = 16,
  roughness = 0.72,
  metallic = 0.12
): SynthesizedPbrBufferPair | null {
  const buf = dungeonPngMap.get(filename);
  if (!buf) return null;
  const key = `kenney_${filename}_s${scale}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    buf,
    0,
    0,
    buf.width,
    buf.height,
    scale,
    anchorRatioY,
    aoRadiusX,
    aoRadiusY,
    roughness,
    metallic
  );
  glionoxPropCache.set(key, pair);
  return pair;
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

async function tryLoadOptionalPng(url: string): Promise<LoadedImageBuffer | undefined> {
  try {
    return await loadSinglePngBuffer(url);
  } catch {
    return undefined;
  }
}

/**
 * Asynchronously loads the 4 official PNG sheets from Glionox's
 * "Forest Biome Environment Set" (`public/assets/glionox/`) AND the 5 pre-packed
 * OpenGameArt isometric sprite atlases (`public/assets/oga/`):
 * - `oga_cabins.png` (isometric-log-cabins, 16 variants)
 * - `oga_trees.png` (isometric-trees-1, 10 lush + 10 dead trees)
 * - `oga_props_fence.png` (graveyard-fence-and-props: fences, stone well, lantern, signpost, obelisks, chests)
 * - `oga_terrain_tiles.png` (updated-grassland-tileset-stylized: grass, wildflowers, dirt, soil, water)
 * - `oga_cliffs_foliage.png` (updated-grassland-tileset-stylized: rock cliffs/boulders, bushes, tall grass)
 */
export async function preloadGlionoxForestAssets(): Promise<GlionoxForestRawSheets | null> {
  if (loadedSheets) return loadedSheets;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const [
        trees,
        stumps,
        env,
        tileset,
        ogaCabins,
        ogaTrees,
        ogaPropsFence,
        ogaTerrainTiles,
        ogaCliffsFoliage
      ] = await Promise.all([
        loadSinglePngBuffer('./assets/glionox/forest_trees.png'),
        loadSinglePngBuffer('./assets/glionox/forest_stumps.png'),
        loadSinglePngBuffer('./assets/glionox/forest_env.png'),
        loadSinglePngBuffer('./assets/glionox/forest_tileset.png'),
        tryLoadOptionalPng('./assets/oga/oga_cabins.png'),
        tryLoadOptionalPng('./assets/oga/oga_trees.png'),
        tryLoadOptionalPng('./assets/oga/oga_props_fence.png'),
        tryLoadOptionalPng('./assets/oga/oga_terrain_tiles.png'),
        tryLoadOptionalPng('./assets/oga/oga_cliffs_foliage.png')
      ]);

      const dungeonFiles = [
        'stoneWall_N.png',
        'stoneWallBroken_N.png',
        'stoneWallDoorClosed_N.png',
        'stoneWallDoorOpen_N.png',
        'stoneColumn_N.png',
        'chestClosed_N.png',
        'chestOpen_N.png',
        'barrel_N.png',
        'barrels_N.png',
        'woodenCrate_N.png',
        'woodenCrates_N.png',
        'tableRound_N.png',
        'woodenSupports_N.png'
      ];
      await Promise.all(
        dungeonFiles.map(async (fn) => {
          const loaded = await tryLoadOptionalPng(`./assets/dungeon/${fn}`);
          if (loaded) dungeonPngMap.set(fn, loaded);
        })
      );

      loadedSheets = {
        trees,
        stumps,
        env,
        tileset,
        ogaCabins,
        ogaTrees,
        ogaPropsFence,
        ogaTerrainTiles,
        ogaCliffsFoliage,
        dungeonPngMap
      };
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
 * Generates a tangent-space normal & PBR material map for a sprite
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
 * Extracts a rectangular frame from a source sheet and scales it into a target canvas buffer,
 * adding a subtle ground ambient occlusion shadow and computing a PBR Normal+Material map.
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
  aoRadiusY: number,
  roughness = 0.76,
  metallic = 0.06
): SynthesizedPbrBufferPair {
  const width = Math.round(srcW * scale);
  const height = Math.round(srcH * scale);
  const albedoRGBA = new Uint8ClampedArray(width * height * 4);

  const anchorPxX = Math.round(width * 0.5);
  const anchorPxY = Math.round(height * anchorYRatio);

  // 1. Soft Ground Ambient Occlusion ellipse under the sprite base
  if (aoRadiusX > 0 && aoRadiusY > 0) {
    for (
      let y = Math.max(0, Math.floor(anchorPxY - aoRadiusY));
      y <= Math.min(height - 1, Math.ceil(anchorPxY + aoRadiusY));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(anchorPxX - aoRadiusX));
        x <= Math.min(width - 1, Math.ceil(anchorPxX + aoRadiusX));
        x++
      ) {
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

  // 2. Blit source sprite (preserving baked alpha ground shadows)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(srcH - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(srcW - 1, Math.floor(x / scale));
      const sIdx = ((srcY + sy) * sheet.width + (srcX + sx)) * 4;
      const a = sheet.rgba[sIdx + 3];
      if (a > 8) {
        const dIdx = (y * width + x) * 4;
        const srcAlpha = a / 255;
        const dstAlpha = albedoRGBA[dIdx + 3] / 255;
        const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);
        if (outAlpha > 0) {
          albedoRGBA[dIdx] = Math.round(
            (sheet.rgba[sIdx] * srcAlpha + albedoRGBA[dIdx] * dstAlpha * (1 - srcAlpha)) / outAlpha
          );
          albedoRGBA[dIdx + 1] = Math.round(
            (sheet.rgba[sIdx + 1] * srcAlpha + albedoRGBA[dIdx + 1] * dstAlpha * (1 - srcAlpha)) /
              outAlpha
          );
          albedoRGBA[dIdx + 2] = Math.round(
            (sheet.rgba[sIdx + 2] * srcAlpha + albedoRGBA[dIdx + 2] * dstAlpha * (1 - srcAlpha)) /
              outAlpha
          );
          albedoRGBA[dIdx + 3] = Math.min(255, Math.round(outAlpha * 255));
        }
      }
    }
  }

  const normalMaterialRGBA = buildPixelArtNormalMaterialBuffer(
    albedoRGBA,
    width,
    height,
    roughness,
    metallic,
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
 * Extracts a lush isometric tree:
 * - Variants 0..9 use the 10 high-res painterly isometric trees from `oga_trees.png` (row 0, 160x320)
 * - Variants 10..18 use the 9 pixel-art forest trees from Glionox's `forest_trees.png` (96x224)
 */
export function getGlionoxTreePbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 19) + 19) % 19;
  const key = `hybrid_tree_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  if (idx < 10 && loadedSheets.ogaTrees) {
    const pair = extractAndScaleSpritePbr(
      loadedSheets.ogaTrees,
      idx * 160,
      0,
      160,
      320,
      0.92,
      258 / 320,
      28,
      14,
      0.78,
      0.04
    );
    glionoxPropCache.set(key, pair);
    return pair;
  }

  const gIdx = idx % 9;
  const pair = extractAndScaleSpritePbr(
    loadedSheets.trees,
    gIdx * 96,
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
 * Extracts one of the 10 Gnarled Dead / Swamp Trees from `oga_trees.png` (row 1, 160x320 per cell).
 */
export function getOgaDeadTreePbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaTrees) return null;
  const col = ((variantIndex % 10) + 10) % 10;
  const key = `oga_dead_tree_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaTrees,
    col * 160,
    320,
    160,
    320,
    0.92,
    258 / 320,
    24,
    12,
    0.82,
    0.03
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 16 Isometric Log Cabins & Slavic Thatched Huts from `oga_cabins.png`
 * (4x4 grid of 256x256 cells).
 */
export function getOgaCabinPbr(
  variantIndex: number,
  isOpen = true
): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaCabins) return null;
  const idx = ((variantIndex % 16) + 16) % 16;
  const key = `oga_cabin_${idx}_${isOpen ? 'lit' : 'dim'}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaCabins,
    col * 256,
    row * 256,
    256,
    256,
    1.76, // Doubled from 0.88 to 1.76 (powiększone ×2 zgodnie z prośbą)
    190 / 256,
    112,
    56,
    0.72,
    0.08
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts the Stone & Timber Roofed Village Well from `oga_props_fence.png` (col=1, row=2, 128x128).
 */
export function getOgaWellPbr(): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const key = 'oga_well_0';
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    1 * 128,
    2 * 128,
    128,
    128,
    1.1,
    102 / 128,
    28,
    14,
    0.68,
    0.12
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts the Wooden Street Lantern Post from `oga_props_fence.png` (col=2, row=2, 128x128)
 * and adds a warm glowing lantern core when `isOpen` is true.
 */
export function getOgaLanternPostPbr(isOpen: boolean): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const key = `oga_lantern_${isOpen ? 'on' : 'off'}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    2 * 128,
    2 * 128,
    128,
    128,
    1.1,
    104 / 128,
    18,
    9,
    0.62,
    0.22
  );

  if (isOpen) {
    const cx = Math.round(pair.width * 0.44);
    const cy = Math.round(pair.height * 0.36);
    for (let y = -10; y <= 10; y++) {
      for (let x = -10; x <= 10; x++) {
        const d = Math.hypot(x / 9, y / 9);
        if (d <= 1.0) {
          const px = cx + x;
          const py = cy + y;
          if (px >= 0 && px < pair.width && py >= 0 && py < pair.height) {
            const idx = (py * pair.width + px) * 4;
            const glow = (1.0 - d) * 0.85;
            pair.albedoRGBA[idx] = Math.min(255, Math.round(pair.albedoRGBA[idx] + 255 * glow));
            pair.albedoRGBA[idx + 1] = Math.min(
              255,
              Math.round(pair.albedoRGBA[idx + 1] + 195 * glow)
            );
            pair.albedoRGBA[idx + 2] = Math.min(
              255,
              Math.round(pair.albedoRGBA[idx + 2] + 75 * glow)
            );
            pair.albedoRGBA[idx + 3] = Math.max(pair.albedoRGBA[idx + 3], Math.round(glow * 240));
            pair.normalMaterialRGBA[idx + 2] = 20; // low roughness
            pair.normalMaterialRGBA[idx + 3] = 235; // high emissive/metallic glint
          }
        }
      }
    }
  }

  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts Wooden Rail Fences & Trough from `oga_props_fence.png` (row 2, cols 4, 5, 3).
 */
export function getOgaWoodenFencePbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const cols = [4, 5, 3];
  const col = cols[((variantIndex % cols.length) + cols.length) % cols.length];
  const key = `oga_wood_fence_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    col * 128,
    2 * 128,
    128,
    128,
    1.08,
    102 / 128,
    24,
    11,
    0.76,
    0.06
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 16 Wrought-Iron Graveyard Fences, Gates & Stone-Post Railings
 * from `oga_props_fence.png` (rows 0..1, cols 0..7, 128x128 per cell).
 */
export function getOgaGraveyardFencePbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const idx = ((variantIndex % 16) + 16) % 16;
  const key = `oga_grave_fence_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const col = idx % 8;
  const row = Math.floor(idx / 8); // 0 or 1
  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    col * 128,
    row * 128,
    128,
    128,
    1.08,
    104 / 128,
    26,
    12,
    0.45,
    0.58
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts the Crossroads Wooden Signpost (col=6, row=2) or Wayside Stone Shrine (col=7, row=2)
 * from `oga_props_fence.png`.
 */
export function getOgaSignpostPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const col = variantIndex % 2 === 0 ? 6 : 7;
  const key = `oga_signpost_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    col * 128,
    2 * 128,
    128,
    128,
    1.1,
    104 / 128,
    22,
    11,
    0.68,
    0.12
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 8 Carved Stone Obelisks, Pillars & Tombstones
 * from `oga_props_fence.png` (row 3, cols 0..7, 128x128).
 */
export function getOgaPillarOrObeliskPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const col = ((variantIndex % 8) + 8) % 8;
  const key = `oga_pillar_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    col * 128,
    3 * 128,
    128,
    128,
    1.12,
    104 / 128,
    26,
    13,
    0.56,
    0.22
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts the Iron-Bound Treasure Chest (closed at col=6, row=4; open at col=7, row=4)
 * or Wooden Supply Crates (cols=4..5, row=4) from `oga_props_fence.png`.
 */
export function getOgaChestPbr(
  isOpen: boolean,
  variantIndex = 0
): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaPropsFence) return null;
  const isCrate = variantIndex % 3 !== 0;
  const col = isCrate ? (variantIndex % 2 === 1 ? 4 : 5) : isOpen ? 7 : 6;
  const key = `oga_chest_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaPropsFence,
    col * 128,
    4 * 128,
    128,
    128,
    1.05,
    102 / 128,
    24,
    12,
    0.48,
    0.42
  );
  glionoxPropCache.set(key, pair);
  return pair;
}

/**
 * Extracts one of the 8 Sculpted Isometric Rock Cliffs / Boulders
 * from `oga_cliffs_foliage.png` (row 0, cols 0..7, 128x256).
 */
export function getOgaRockCliffPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets?.ogaCliffsFoliage) return null;
  const col = ((variantIndex % 8) + 8) % 8;
  const key = `oga_rock_cliff_${col}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  const pair = extractAndScaleSpritePbr(
    loadedSheets.ogaCliffsFoliage,
    col * 128,
    0,
    128,
    256,
    1.0,
    204 / 256,
    36,
    18,
    0.72,
    0.1
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
 * Extracts a Lush Bush / Shrub:
 * - Variants 0..7: Stylized OGA grassland bushes (`oga_cliffs_foliage.png` row 1, 128x128)
 * - Variants 8..15: Glionox pixel-art berry bushes (`forest_env.png` row 4, 48x48)
 */
export function getGlionoxBushPbr(variantIndex: number): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 16) + 16) % 16;
  const key = `hybrid_bush_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  if (idx < 8 && loadedSheets.ogaCliffsFoliage) {
    const pair = extractAndScaleSpritePbr(
      loadedSheets.ogaCliffsFoliage,
      idx * 128,
      256,
      128,
      128,
      1.0,
      98 / 128,
      20,
      10
    );
    glionoxPropCache.set(key, pair);
    return pair;
  }

  const col = idx % 8;
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
 * Extracts Wildflowers, Tall Grass Clumps & Field Stones:
 * - Variants 0..7: Stylized OGA tall grass & stones (`oga_cliffs_foliage.png` row 2, 128x128)
 * - Variants 8..39: Glionox wildflowers & grass tufts (`forest_env.png` rows 0..3, 48x48)
 */
export function getGlionoxWildflowerOrGrassPbr(
  variantIndex: number
): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const idx = ((variantIndex % 40) + 40) % 40;
  const key = `hybrid_flora_${idx}`;
  const cached = glionoxPropCache.get(key);
  if (cached) return cached;

  if (idx < 8 && loadedSheets.ogaCliffsFoliage) {
    const pair = extractAndScaleSpritePbr(
      loadedSheets.ogaCliffsFoliage,
      idx * 128,
      384,
      128,
      128,
      1.0,
      98 / 128,
      0,
      0
    );
    glionoxPropCache.set(key, pair);
    return pair;
  }

  const gIdx = (idx - 8) % 32;
  const row = Math.floor(gIdx / 8); // 0..1 = wildflowers, 2..3 = grass clumps
  const col = gIdx % 8;

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
 * Synthesizes an isometric 2:1 tile (`forest_grass`, `forest_soil`, `dirt_path`, or `abyss_water`)
 * using OpenGameArt's "Updated Grassland Tileset Centralized/Stylized" (`oga_terrain_tiles.png`, 128x64 diamonds)
 * combined with Glionox's 3D overhanging grass lip & rocky cliff wall (`forest_tileset.png`).
 */
export function generateGlionoxForestTilePbr(
  terrain: 'forest_grass' | 'forest_soil' | 'dirt_path' | 'abyss_water',
  elevationSteps: number
): SynthesizedPbrBufferPair | null {
  if (!loadedSheets) return null;
  const key = `oga_glionox_tile_${terrain}_z${elevationSteps}`;
  const cached = glionoxTileCache.get(key);
  if (cached) return cached;

  const ts = loadedSheets.tileset;
  const ogaTiles = loadedSheets.ogaTerrainTiles;
  const skirtSteps = Math.max(1, elevationSteps + 1);
  const skirtPx = skirtSteps * ELEVATION_STEP_PX;
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT + skirtPx;
  const halfW = width * 0.5;
  const halfH = TILE_HEIGHT * 0.5;

  const albedoRGBA = new Uint8ClampedArray(width * height * 4);

  const sampleTileset = (
    srcBaseX: number,
    srcBaseY: number,
    spanW: number,
    spanH: number,
    px: number,
    py: number
  ) => {
    const tx = srcBaseX + ((Math.floor(px * 0.5) % spanW) + spanW) % spanW;
    const ty = srcBaseY + ((Math.floor(py * 0.5) % spanH) + spanH) % spanH;
    const idx = (ty * ts.width + tx) * 4;
    return {
      r: ts.rgba[idx],
      g: ts.rgba[idx + 1],
      b: ts.rgba[idx + 2],
      a: ts.rgba[idx + 3]
    };
  };

  // Select OGA 128x64 isometric diamond tile row & column
  const ogaCol = (elevationSteps * 3 + 1) % 8;
  const ogaRow =
    terrain === 'forest_grass'
      ? elevationSteps % 2 === 0
        ? 0 // wildflower meadow grass
        : 1 // deep lush grassland
      : terrain === 'dirt_path'
        ? 2 // stylized warm dirt path
        : terrain === 'forest_soil'
          ? 3 // dark forest soil
          : 5; // rippled deep water (abyss_water)

  // 1. Top Isometric Diamond Face
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < width; x++) {
      const dx = Math.abs(x - halfW) / halfW;
      const dy = Math.abs(y - halfH) / halfH;
      if (dx + dy <= 1.0) {
        const edgeDist = 1.0 - (dx + dy);
        let r = 110;
        let g = 132;
        let b = 64;

        if (ogaTiles) {
          const ox = ogaCol * 128 + x;
          const oy = ogaRow * 64 + y;
          const oIdx = (oy * ogaTiles.width + ox) * 4;
          if (ogaTiles.rgba[oIdx + 3] > 32) {
            r = ogaTiles.rgba[oIdx];
            g = ogaTiles.rgba[oIdx + 1];
            b = ogaTiles.rgba[oIdx + 2];
          }
        } else {
          const detailSample = sampleTileset(48, 144, 64, 32, x, y);
          r = detailSample.a > 128 ? detailSample.r : 127;
          g = detailSample.a > 128 ? detailSample.g : 142;
          b = detailSample.a > 128 ? detailSample.b : 68;
        }

        const edgeShade = edgeDist < 0.04 ? 0.9 : 1.0;
        const outIdx = (y * width + x) * 4;
        albedoRGBA[outIdx] = Math.round(r * edgeShade);
        albedoRGBA[outIdx + 1] = Math.round(g * edgeShade);
        albedoRGBA[outIdx + 2] = Math.round(b * edgeShade);
        albedoRGBA[outIdx + 3] = 255;
      }
    }
  }

  // 2. Render 3D Jagged Grass Overhang Lip + Rocky Brown Cliff Wall
  for (let x = 0; x < width; x++) {
    const bottomDiamondY = Math.round(TILE_HEIGHT - Math.abs(x - halfW) * 0.5);
    const isLeftFace = x < halfW;
    const lipDepth = 4 + ((Math.floor(x / 2) * 5 + 3) % 5);

    for (let sy = 0; sy < skirtPx; sy++) {
      const py = bottomDiamondY + sy;
      if (py >= height) continue;

      const outIdx = (py * width + x) * 4;
      const faceShade = isLeftFace ? 0.96 : 0.72;

      if (terrain === 'abyss_water') {
        const depthDarken = 1.0 - (sy / Math.max(1, skirtPx)) * 0.35;
        albedoRGBA[outIdx] = Math.round(18 * faceShade * depthDarken);
        albedoRGBA[outIdx + 1] = Math.round(48 * faceShade * depthDarken);
        albedoRGBA[outIdx + 2] = Math.round(68 * faceShade * depthDarken);
        albedoRGBA[outIdx + 3] = 255;
      } else if (sy < lipDepth && terrain === 'forest_grass') {
        const isTip = sy >= lipDepth - 2;
        const r = isTip ? 54 : 76;
        const g = isTip ? 86 : 108;
        const b = isTip ? 38 : 48;
        albedoRGBA[outIdx] = Math.round(r * faceShade);
        albedoRGBA[outIdx + 1] = Math.round(g * faceShade);
        albedoRGBA[outIdx + 2] = Math.round(b * faceShade);
        albedoRGBA[outIdx + 3] = 255;
      } else {
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

  const isWater = terrain === 'abyss_water';
  const normalMaterialRGBA = buildPixelArtNormalMaterialBuffer(
    albedoRGBA,
    width,
    height,
    isWater ? 0.12 : 0.82,
    isWater ? 0.78 : 0.03,
    isWater ? 1.4 : 1.8
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
