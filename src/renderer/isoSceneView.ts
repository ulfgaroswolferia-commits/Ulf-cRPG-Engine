import { determineActionCursor, getCursorCss } from '../ui/cursorManager';
import {
  Application,
  Container,
  Filter,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture
} from 'pixi.js';
import {
  bakeCharacterBuffers,
  BakedCharacterBuffers,
  computeCharacterRecipeHash,
  generateRandomCharacterRecipe
} from '../assets/characterBakery';
import {
  getOgaGroundMicroTuftPbr,
  preloadGlionoxForestAssets
} from '../assets/glionoxAtlas';
import {
  generatePropPbrBuffers,
  generateTilePbrBuffers,
  SynthesizedPbrBufferPair
} from '../assets/proceduralForge';
import {
  clearTerrainTransitionCache,
  computeReachableTilesBfs,
  computeTileTransitions,
  generateTerrainTransitionPbr,
  getMicroFoliagePlacement,
  getWorldGroundColorMod,
  getWorldTileVariant,
  MicroFoliagePlacement,
  NeighborTileInfo,
  TerrainEdgeSlot,
  TerrainTransitionKind,
  TerrainTransitionOverlay
} from '../assets/terrainBlending';
import {
  DepthBox3D,
  shouldApplyWallCutaway,
  sortEntitiesTopological
} from '../core/depthSorter';
import {
  computeEdgePanState,
  EdgePanDirection,
  ELEVATION_STEP_PX,
  gridToScreen,
  pickGridTileAtScreen,
  TILE_HEIGHT,
  TILE_WIDTH
} from '../core/isoMath';
import {
  CameraRotation,
  getRotatedDimensions,
  rotateDirection8,
  rotateFootprint,
  toRotatedContinuous,
  toRotatedGrid,
  toWorldGrid
} from '../core/mapRotation';
import { findPathAStar3D, PathStepNode } from '../core/pathfinding';
import { PropKind, TileTerrainType, WorldPropEntity } from '../core/worldMap';
import {
  computeAttackPreview,
  createDefaultProficiencies,
  EnemyDifficultyTier
} from '../rpg/combatSystem';
import { getMerchantSpecialty } from '../rpg/dialogueSystem';
import {
  ActorEntity,
  CrpgGameState,
  direction8ToVector,
  MERCHANT_ACTOR_IDS,
  resolveTravelSignpostDestination
} from '../rpg/gameLoop';
import {
  createAtmosphericPostFilter,
  evaluateDeferredPbrLightAtPoint,
  RenderBufferMode,
  ScreenSpacePointLight,
  updateAtmosphericFilterUniforms
} from './deferredPipeline';
import {
  classifyCombatImpact,
  computeArcanePulseScale,
  computeAttackLungeTransform,
  computeDeathCollapsePose,
  computeDodgeGhostOffset,
  computeFearTrembleOffset,
  computeFloatingTextMotion,
  computeHitRecoilTransform,
  computeHoverFloatTransform,
  computeIdleBreathingTransform,
  computePropReactionTransform,
  computeTelegraphAnticipationPose,
  computeWalkStrideTransform,
  computeWindSwaySkew,
  DEATH_COLLAPSE_DURATION_SEC,
  DODGE_ANIM_DURATION_SEC,
  isHoveringActor,
  isNpcNameCoveredBySpeechMarker,
  resolveNonOverlappingLabelPosition,
  type LabelRect,
  type PropReactionKind
} from './sceneMotion';

export type InspectorToolMode =
  | 'interact'
  | 'paint_terrain'
  | 'raise_elevation'
  | 'lower_elevation'
  | 'flatten_elevation'
  | 'place_prop'
  | 'remove_prop'
  | 'place_torch_light'
  | 'place_arcane_light'
  | 'remove_light'
  | 'spawn_npc'
  | 'spawn_enemy';

export type EditorPropOrientation = '1x1' | '2x1' | '1x2';

export interface PropVisualTransform {
  scaleX: number;
  scaleY: number;
  centerOnFootprint: boolean;
  offsetY: number;
  aoScale: number;
}

export type PropVisualTransformResolver = (
  prop: Pick<WorldPropEntity, 'kind' | 'sizeX' | 'sizeY' | 'heightZ'>
) => PropVisualTransform;

const IDENTITY_PROP_VISUAL_TRANSFORM: PropVisualTransform = {
  scaleX: 1,
  scaleY: 1,
  centerOnFootprint: false,
  offsetY: 0,
  aoScale: 1
};

let customPropVisualTransformResolver: PropVisualTransformResolver | null = null;

export function registerPropVisualTransform(resolver: PropVisualTransformResolver | null): void {
  customPropVisualTransformResolver = resolver;
}

export function resolvePropVisualTransform(
  prop: Pick<WorldPropEntity, 'kind' | 'sizeX' | 'sizeY' | 'heightZ'>
): PropVisualTransform {
  return customPropVisualTransformResolver
    ? customPropVisualTransformResolver(prop)
    : IDENTITY_PROP_VISUAL_TRANSFORM;
}

export const BLOCKING_MODAL_SELECTOR =
  '.character-backdrop, .credits-modal-backdrop, .dialogue-backdrop, .combat-confirm-backdrop, .combat-report-modal-backdrop, .item-details-backdrop, .ostrze-overlay';

export interface CustomPropSpriteSpec {
  id?: string;
  idPrefix?: string;
  kind?: PropKind;
  /** Optional open/closed state filter (e.g. closed vs open chest). Undefined matches any state. */
  isOpen?: boolean;
  url: string;
  anchorX?: number;
  anchorY?: number;
  targetWidthPx?: number;
  keyOutWhiteBackground?: boolean;
  /** Deterministic horizontal mirror on odd prop variants (ideal for trees & cliffs). */
  allowMirrorX?: boolean;
}

const customPropSpriteRegistry: CustomPropSpriteSpec[] = [];

export function registerCustomPropSprite(spec: CustomPropSpriteSpec): void {
  const existingIdx = customPropSpriteRegistry.findIndex(
    (s) =>
      s.isOpen === spec.isOpen &&
      ((spec.id && s.id === spec.id) ||
        (spec.idPrefix && s.idPrefix === spec.idPrefix) ||
        (!spec.id && !spec.idPrefix && spec.kind && s.kind === spec.kind))
  );
  if (existingIdx >= 0) {
    customPropSpriteRegistry[existingIdx] = spec;
  } else {
    customPropSpriteRegistry.push(spec);
  }
}

export function clearCustomPropSprites(): void {
  customPropSpriteRegistry.length = 0;
}

/**
 * Removes solid white backgrounds (both border-connected and enclosed interior pockets)
 * from RGBA pixel buffers and defringes 1px white JPEG halos around dark outlines while
 * preserving warm/tinted bright highlights (e.g. candle flames, cream canvas, pale bark).
 */
export function keyOutWhiteBackgroundRgba(
  px: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isBgLike = (idx4: number): boolean => {
    const a = px[idx4 + 3];
    if (a < 20) return true;
    const r = px[idx4];
    const g = px[idx4 + 1];
    const b = px[idx4 + 2];
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    return mn >= 216 && mx - mn <= 18;
  };

  const isPureWhiteSeed = (idx4: number): boolean => {
    const a = px[idx4 + 3];
    if (a < 20) return false;
    const r = px[idx4];
    const g = px[idx4 + 1];
    const b = px[idx4 + 2];
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
    return mn >= 222 && mx - mn <= 15;
  };

  const pushIfBg = (x: number, y: number): void => {
    const p = y * width + x;
    if (visited[p]) return;
    if (isBgLike(p * 4)) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  const drainQueue = (): void => {
    while (head < tail) {
      const p = queue[head++];
      px[p * 4 + 3] = 0;
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) pushIfBg(x - 1, y);
      if (x < width - 1) pushIfBg(x + 1, y);
      if (y > 0) pushIfBg(x, y - 1);
      if (y < height - 1) pushIfBg(x, y + 1);
    }
  };

  // Pass 1: Border-connected white background flood-fill
  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }
  drainQueue();

  // Pass 2: Enclosed pure-white background pockets (e.g. between rafters, wheel spokes, branches)
  for (let p = 0; p < total; p++) {
    if (visited[p]) continue;
    if (isPureWhiteSeed(p * 4)) {
      visited[p] = 1;
      queue[tail++] = p;
      drainQueue();
    }
  }

  // Pass 3: Soft 1px white-halo defringing on silhouette edges adjacent to keyed-out background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (visited[p]) continue;
      const touchesBg =
        (x > 0 && visited[p - 1] === 1) ||
        (x < width - 1 && visited[p + 1] === 1) ||
        (y > 0 && visited[p - width] === 1) ||
        (y < height - 1 && visited[p + width] === 1);
      if (!touchesBg) continue;

      const i4 = p * 4;
      const r = px[i4];
      const g = px[i4 + 1];
      const b = px[i4 + 2];
      const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (mn >= 115 && mx - mn <= 32) {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const alpha = Math.max(0, Math.min(1, (232 - lum) / 117));
        if (alpha <= 0.06) {
          px[i4 + 3] = 0;
        } else {
          px[i4] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) / alpha)));
          px[i4 + 1] = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) / alpha)));
          px[i4 + 2] = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) / alpha)));
          px[i4 + 3] = Math.round(px[i4 + 3] * alpha);
        }
      }
    }
  }
}

export function resolveCustomPropSprite(prop: {
  id?: string;
  kind: PropKind;
  isOpen?: boolean;
}): CustomPropSpriteSpec | null {
  const stateMatches = (s: CustomPropSpriteSpec): boolean =>
    s.isOpen === undefined || prop.isOpen === undefined ? s.isOpen === undefined : s.isOpen === prop.isOpen;
  const pickBest = (predicate: (s: CustomPropSpriteSpec) => boolean): CustomPropSpriteSpec | null => {
    if (prop.isOpen !== undefined) {
      const exactState = customPropSpriteRegistry.find(
        (s) => predicate(s) && s.isOpen === prop.isOpen
      );
      if (exactState) return exactState;
    }
    const anyState = customPropSpriteRegistry.find((s) => predicate(s) && stateMatches(s));
    if (anyState) return anyState;
    return customPropSpriteRegistry.find((s) => predicate(s) && s.isOpen === false) ?? null;
  };

  if (prop.id) {
    const exact = pickBest((s) => s.id === prop.id);
    if (exact) return exact;
    const prefix = pickBest((s) => Boolean(s.idPrefix && prop.id!.startsWith(s.idPrefix)));
    if (prefix) return prefix;
  }
  return pickBest((s) => !s.id && !s.idPrefix && s.kind === prop.kind);
}

interface DualPbrTexturePair {
  albedo: Texture;
  normalMat: Texture;
  anchorX: number;
  anchorY: number;
  allowMirrorX?: boolean;
}

interface CharacterDualFrameTextures {
  recipeHash: string;
  albedoFrames: Texture[][]; // [dir 0..7][frame 0..3]
  normalFrames: Texture[][];
  portraitDataUrl: string;
  bakeDurationMs: number;
  /** Render scale normalization relative to canonical 64px frame width (0.5 for 128px HD sprites). */
  baseScale: number;
  /** Normalized vertical foot anchor matching baked sprite headroom. */
  anchorY: number;
}

export type AmbientTimeOfDay = 'swit' | 'dzien' | 'zmierzch' | 'noc';

/**
 * Computes grid tiles threatened by a telegraphed enemy combat intent so the 2.5D
 * battlefield can render pulsing crimson-amber danger zones before the enemy strikes.
 */
export function getTelegraphThreatTiles(
  originX: number,
  originY: number,
  intent: string,
  mapW: number,
  mapH: number
): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  const radius = intent === 'terror_howl' ? 2 : 1;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (intent === 'terror_howl' && Math.abs(dx) + Math.abs(dy) > 2) continue;
      const nx = originX + dx;
      const ny = originY + dy;
      if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
        tiles.push({ x: nx, y: ny });
      }
    }
  }
  return tiles;
}

/**
 * Classifies whether a WorldMap is an outdoor environment (grass/dirt/mud/water or trees)
 * vs an indoor/underground dungeon/crypt, so ambient leaves, fireflies, and dawn mist
 * never appear inside mines or crypts.
 */
export function isOutdoorMap(map: {
  width: number;
  height: number;
  tiles: { terrain: TileTerrainType }[][];
  props: { kind: PropKind }[];
}): boolean {
  if (
    map.props.some(
      (p) => p.kind === 'ancient_oak' || p.kind === 'pine_tree' || p.kind === 'dead_tree'
    )
  ) {
    return true;
  }
  let outdoorCount = 0;
  let totalCount = 0;
  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.width; x++) {
      const tile = row[x];
      if (!tile) continue;
      totalCount++;
      if (
        tile.terrain === 'forest_grass' ||
        tile.terrain === 'dirt_path' ||
        tile.terrain === 'forest_soil'
      ) {
        outdoorCount++;
      }
    }
  }
  return totalCount > 0 && outdoorCount / totalCount >= 0.2;
}

interface FloatingParticle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  kind?: 'ember' | 'mote' | 'leaf' | 'firefly' | 'mist' | 'dust';
  phase?: number;
}

interface SlashArcVfx {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  life: number;
  maxLife: number;
  color: number;
  widthScale?: number;
}

interface ShockwaveRingVfx {
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  color: number;
}

function rgbaBufferToTexture(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'linear';
  return tex;
}

/**
 * Per-frame display-object pool. The scene is redrawn every ticker frame, so instead of
 * allocating (and leaking) thousands of Sprites / Graphics / Text objects per second we
 * recycle them. Text objects are cached by (style + content) because re-rasterizing text
 * into a canvas and uploading it to the GPU every frame is the most expensive operation.
 */
class FrameDisplayPool {
  private readonly sprites: Sprite[] = [];
  private spriteCursor = 0;
  private readonly graphicsList: Graphics[] = [];
  private graphicsCursor = 0;
  private readonly texts = new Map<string, { text: Text; lastUsedFrame: number }>();
  private readonly textOccurrences = new Map<string, number>();
  private readonly styles = new Map<string, TextStyle>();
  private frame = 0;

  public beginFrame(): void {
    this.frame++;
    this.spriteCursor = 0;
    this.graphicsCursor = 0;
    this.textOccurrences.clear();
  }

  public sprite(texture: Texture): Sprite {
    let sp = this.sprites[this.spriteCursor];
    if (!sp) {
      sp = new Sprite(texture);
      this.sprites.push(sp);
    } else if (sp.texture !== texture) {
      sp.texture = texture;
    }
    this.spriteCursor++;
    sp.alpha = 1;
    sp.tint = 0xffffff;
    sp.scale.set(1, 1);
    sp.skew.set(0, 0);
    sp.rotation = 0;
    sp.anchor.set(0, 0);
    sp.visible = true;
    return sp;
  }

  public graphics(): Graphics {
    let g = this.graphicsList[this.graphicsCursor];
    if (!g) {
      g = new Graphics();
      this.graphicsList.push(g);
    } else {
      g.clear();
    }
    this.graphicsCursor++;
    g.alpha = 1;
    g.position.set(0, 0);
    g.scale.set(1, 1);
    g.rotation = 0;
    g.zIndex = 0;
    g.visible = true;
    return g;
  }

  public text(
    content: string,
    styleKey: string,
    styleFactory: () => ConstructorParameters<typeof TextStyle>[0]
  ): Text {
    const baseKey = `${styleKey}\u0000${content}`;
    const occurrence = this.textOccurrences.get(baseKey) ?? 0;
    this.textOccurrences.set(baseKey, occurrence + 1);
    const key = `${baseKey}\u0000${occurrence}`;

    let entry = this.texts.get(key);
    if (!entry) {
      let style = this.styles.get(styleKey);
      if (!style) {
        style = new TextStyle(styleFactory());
        this.styles.set(styleKey, style);
      }
      entry = { text: new Text({ text: content, style }), lastUsedFrame: this.frame };
      this.texts.set(key, entry);
    }
    entry.lastUsedFrame = this.frame;
    entry.text.alpha = 1;
    entry.text.scale.set(1, 1);
    entry.text.zIndex = 0;
    return entry.text;
  }

  /** Releases GPU resources of objects that have not been used for a while. */
  public endFrame(): void {
    if (this.frame % 60 !== 0) return;
    for (const [key, entry] of this.texts) {
      if (this.frame - entry.lastUsedFrame > 120) {
        entry.text.destroy({ texture: true, textureSource: true });
        this.texts.delete(key);
      }
    }
    const keepSprites = Math.max(256, this.spriteCursor * 2);
    while (this.sprites.length > keepSprites) {
      this.sprites.pop()?.destroy();
    }
    const keepGraphics = Math.max(64, this.graphicsCursor * 2);
    while (this.graphicsList.length > keepGraphics) {
      this.graphicsList.pop()?.destroy();
    }
  }

  public destroy(): void {
    for (const sp of this.sprites) {
      if (!sp.destroyed) sp.destroy();
    }
    this.sprites.length = 0;
    for (const g of this.graphicsList) {
      if (!g.destroyed) g.destroy();
    }
    this.graphicsList.length = 0;
    for (const entry of this.texts.values()) {
      if (!entry.text.destroyed) {
        entry.text.destroy({ texture: true, textureSource: true });
      }
    }
    this.texts.clear();
    this.textOccurrences.clear();
    this.styles.clear();
  }
}

export class IsoSceneView {
  public readonly app: Application;
  public readonly game: CrpgGameState;
  public rotation: CameraRotation = 0;
  public bufferMode: RenderBufferMode = 'final_pbr';
  public activeTool: InspectorToolMode = 'interact';
  public editorTerrainType: TileTerrainType = 'forest_grass';
  public editorTerrainWalkable = true;
  public editorBrushSize: 1 | 3 = 1;
  public editorTargetElevation = 0;
  public editorPropKind: PropKind = 'pine_tree';
  public editorPropVariant = 0;
  public editorRandomizeVariant = true;
  public editorPropOrientation: EditorPropOrientation = '1x1';
  public editorEnemyDifficulty: EnemyDifficultyTier = 'normal';
  public zoom = 1.0;
  public organicTerrainBlending = true;
  public showGridInExploration = false;
  public cameraOffsetX = 0;
  public cameraOffsetY = 140;
  public edgePanEnabled = true;
  public edgePanMarginPx = 24;
  public edgePanSpeed = 580;
  public activeEdgeDirection: EdgePanDirection | null = null;
  public forcedEdgeDirection: EdgePanDirection | null = null;
  public targetZoom = 1.0;
  private cameraVelX = 0;
  private cameraVelY = 0;
  private isManualCameraPanning = false;
  private currentAppliedCursor = '';
  public hoveredWorldTile: { x: number; y: number; z: number } | null = null;
  public isHighlightAltHeld = false;
  public lastBakeDurationMs = 1.2;
  public fps = 60;

  private readonly worldContainer = new Container();
  private readonly floorLayer = new Container();
  private readonly floorStaticLayer = new Container();
  private readonly floorDynamicLayer = new Container();
  private readonly cursorAndPathGraphics = new Graphics();
  private readonly groundShadowsGraphics = new Graphics();
  private readonly sortedObjectLayer = new Container();
  private readonly lightingOverlayGraphics = new Graphics();
  private readonly debugOverlayContainer = new Container();
  private cachedFloorStaticKey = '';
  private cachedWaterTiles: Array<{ rx: number; ry: number; sx: number; sy: number }> = [];

  private readonly tileTextureCache = new Map<string, DualPbrTexturePair>();
  private readonly transitionTextureCache = new Map<string, DualPbrTexturePair>();
  private readonly microFoliageTextureCache = new Map<number, DualPbrTexturePair>();
  private readonly propTextureCache = new Map<string, DualPbrTexturePair>();
  private readonly customPropImageCache = new Map<string, DualPbrTexturePair>();
  private readonly customPropLoadingUrls = new Set<string>();
  public explorationAttackMode = false;
  public hitStopTimer = 0;
  private readonly characterTextureCache = new Map<string, CharacterDualFrameTextures>();
  private readonly displayPool = new FrameDisplayPool();
  private readonly scratchPbrLit = { r: 0, g: 0, b: 0, specular: 0 };
  private readonly scratchSurface = { nx: 0, ny: 0, roughness: 0, metallic: 0 };
  private readonly scratchGroundMod = { r: 1, g: 1, b: 1 };
  private readonly scratchMicroFoliage: MicroFoliagePlacement = {
    variant: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    alpha: 1
  };
  private readonly scratchNeighbor: NeighborTileInfo = { terrain: 'forest_grass', z: 0 };
  private cachedTransitionsKey = '';
  private cachedTransitionsByTile: TerrainTransitionOverlay[][] = [];
  private readonly scratchCombatPoly: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  private readonly combatEnemyTileSet = new Set<number>();
  private readonly cachedCombatReachSet = new Set<number>();
  private cachedCombatReachKey = '';
  private cachedHoverPathKey = '';
  private cachedHoverPath: PathStepNode[] = [];
  private readonly particles: FloatingParticle[] = [];
  private readonly slashArcs: SlashArcVfx[] = [];
  private readonly shockwaves: ShockwaveRingVfx[] = [];
  private readonly propReactions = new Map<
    string,
    { kind: PropReactionKind; life: number; maxLife: number }
  >();
  private readonly knownOpenChestIds = new Set<string>();
  private readonly deathCollapseTimers = new Map<string, number>();
  private readonly dodgeTimers = new Map<
    string,
    { life: number; maxLife: number; dirX: number; dirY: number }
  >();
  private readonly lastActorPos = new Map<string, { x: number; y: number; distAccum: number }>();
  private statusParticleTimer = 0;
  private screenShakeTimer = 0;
  private screenShakeMaxTimer = 0.15;
  private screenShakeIntensity = 0;
  private postFilter: Filter | null = null;

  private elapsedSeconds = 0;
  private isDraggingCamera = false;
  private isPaintingWithBrush = false;
  private lastPaintedTileKey = '';
  private dragLastX = 0;
  private dragLastY = 0;
  private pointerClientX = 0;
  private pointerClientY = 0;
  private isPointerInsideViewport = false;
  private isPointerOverUi = false;
  private readonly keysDown = new Set<string>();
  private inputAbortController: AbortController | null = null;
  private unsubscribeCombatAttack: (() => void) | null = null;
  private isDestroyed = false;
  private lastRenderedMapId = '';
  private cachedFloorTintKey = '';
  private cachedFloorStaticTintEntries: Array<{ sprite: Sprite; worldX: number; worldY: number }> = [];
  private lastCursorKey = '';
  private cachedParticleMapRef: unknown = null;
  private cachedParticlePropsLen = -1;
  private cachedFireProps: WorldPropEntity[] = [];
  private cachedArcaneProps: WorldPropEntity[] = [];
  private cachedTreeProps: WorldPropEntity[] = [];
  private cachedIsOutdoor = true;
  public timeOfDay: AmbientTimeOfDay = 'dzien';
  public getTelegraphedIntent?: (actorId: string) => string | null;
  public getActorStatuses?: (actorId: string) => readonly string[];
  private readonly reducedMotion: boolean =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private onUiStateChange?: () => void;

  constructor(game: CrpgGameState, onUiStateChange?: () => void) {
    this.app = new Application();
    this.game = game;
    this.onUiStateChange = onUiStateChange;

    this.unsubscribeCombatAttack = this.game.addCombatAttackListener((evt) => {
      const impact = classifyCombatImpact(evt.outcome);
      if (impact === 'dodge') {
        this.triggerDodgeSidestep(
          evt.target.id,
          evt.target.x - evt.attacker.x,
          evt.target.y - evt.attacker.y
        );
        this.spawnSlashArc(
          evt.attacker.x,
          evt.attacker.y,
          evt.target.x,
          evt.target.y,
          0x94a3b8,
          evt.attacker.z,
          evt.target.z,
          0.65
        );
        return;
      }

      if (impact === 'parry') {
        if (!this.reducedMotion) {
          this.hitStopTimer = Math.max(this.hitStopTimer, 0.05);
        }
        this.triggerScreenShake(95, 2.2);
        this.spawnParrySparks(evt.target.x, evt.target.y, evt.target.z + 0.85);
        this.spawnShockwaveRing(evt.target.x, evt.target.y, evt.target.z, 24, 0xd4af37);
        this.spawnSlashArc(
          evt.attacker.x,
          evt.attacker.y,
          evt.target.x,
          evt.target.y,
          0xe2c275,
          evt.attacker.z,
          evt.target.z,
          0.95
        );
        return;
      }

      if (impact === 'critical') {
        if (!this.reducedMotion) {
          this.hitStopTimer = Math.max(this.hitStopTimer, 0.085);
        }
        this.triggerScreenShake(220, 4.8);
        this.spawnCombatHitVfx(
          evt.target.x,
          evt.target.y,
          evt.target.z + 0.8,
          true,
          evt.outcome.mitigatedByArmor > 0
        );
        this.spawnShockwaveRing(evt.target.x, evt.target.y, evt.target.z, 34, 0xd97706);
        this.spawnSlashArc(
          evt.attacker.x,
          evt.attacker.y,
          evt.target.x,
          evt.target.y,
          0xf5c451,
          evt.attacker.z,
          evt.target.z,
          1.45
        );
        return;
      }

      // Standard hit — grounded Slavic weight
      if (!this.reducedMotion) {
        this.hitStopTimer = Math.max(this.hitStopTimer, 0.045);
      }
      this.triggerScreenShake(115, 2.7);
      this.spawnCombatHitVfx(
        evt.target.x,
        evt.target.y,
        evt.target.z + 0.8,
        false,
        evt.outcome.mitigatedByArmor > 0
      );
      this.spawnSlashArc(
        evt.attacker.x,
        evt.attacker.y,
        evt.target.x,
        evt.target.y,
        0xdbe4ee,
        evt.attacker.z,
        evt.target.z,
        1.0
      );
    });
  }

  public async mount(containerEl: HTMLElement): Promise<void> {
    await preloadGlionoxForestAssets();
    this.clearCachedTextures();
    clearTerrainTransitionCache();

    const cappedResolution = Math.min(window.devicePixelRatio || 1, 1.5);
    try {
      await this.app.init({
        preference: 'webgl',
        resizeTo: containerEl,
        backgroundColor: 0x0b0e14,
        antialias: true,
        resolution: cappedResolution,
        autoDensity: true
      });
    } catch {
      await this.app.init({
        preference: 'canvas',
        resizeTo: containerEl,
        backgroundColor: 0x0b0e14,
        resolution: cappedResolution,
        autoDensity: true
      });
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(this.app.canvas);

    this.centerCameraOnPlayer();

    this.floorLayer.addChild(this.floorStaticLayer, this.floorDynamicLayer);
    this.worldContainer.addChild(
      this.floorLayer,
      this.cursorAndPathGraphics,
      this.groundShadowsGraphics,
      this.sortedObjectLayer,
      this.lightingOverlayGraphics,
      this.debugOverlayContainer
    );
    this.app.stage.addChild(this.worldContainer);

    this.postFilter = createAtmosphericPostFilter();
    if (this.postFilter) {
      this.app.stage.filters = [this.postFilter];
    }

    this.bindInputEvents(this.app.canvas);

    this.app.ticker.add((ticker) => {
      try {
        const dt = Math.min(0.1, ticker.deltaMS / 1000);
        this.fps = Math.round(ticker.FPS);
        if (this.hitStopTimer > 0) {
          this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
          if (!this.reducedMotion && this.screenShakeIntensity > 0) {
            const vibX = (Math.random() - 0.5) * 1.4 * this.screenShakeIntensity;
            const vibY = (Math.random() - 0.5) * 1.4 * this.screenShakeIntensity;
            this.worldContainer.position.set(this.cameraOffsetX + vibX, this.cameraOffsetY + vibY);
          }
          return;
        }
        this.elapsedSeconds += dt;
        if (this.screenShakeTimer > 0) {
          this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
        }
        const viewportW = this.app.screen?.width || window.innerWidth || 1280;
        const viewportH = this.app.screen?.height || window.innerHeight || 720;

        // Smooth frame-rate independent zoom transition centered on screen
        if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
          const prevZoom = this.zoom;
          const zoomLerp = 1.0 - Math.exp(-12.0 * dt);
          this.zoom += (this.targetZoom - this.zoom) * zoomLerp;
          const zoomRatio = this.zoom / prevZoom;
          const cx = viewportW * 0.5;
          const cy = viewportH * 0.53;
          this.cameraOffsetX = cx - (cx - this.cameraOffsetX) * zoomRatio;
          this.cameraOffsetY = cy - (cy - this.cameraOffsetY) * zoomRatio;
        }

        const prevMapId = this.game.map.id;
        const prevTopLog = this.game.logs[0];
        const prevTopCombatLog = this.game.combatLogs[0];
        const prevTurnActorId = this.game.combatState.activeTurnActorId;
        const prevRound = this.game.combatState.round;
        const prevPlayerHp = this.game.player.combat?.hp;
        const prevPlayerAp = this.game.player.combat?.ap;
        const prevDialogue = this.game.activeDialogue;
        const prevCombatActive = this.game.combatState.active;
        const prevPendingCombatConfirm = this.game.pendingCombatConfirmation;
        const prevStealthActive = this.game.isStealthActive;

        // 1. Update game simulation first so render uses fresh actor positions
        this.game.update(dt);

        if (this.game.map.id !== prevMapId) {
          this.clearTransientSceneVfx();
          this.centerCameraOnPlayer();
          this.onUiStateChange?.();
        } else if (
          this.game.logs[0] !== prevTopLog ||
          this.game.combatLogs[0] !== prevTopCombatLog ||
          this.game.combatState.activeTurnActorId !== prevTurnActorId ||
          this.game.combatState.round !== prevRound ||
          this.game.player.combat?.hp !== prevPlayerHp ||
          this.game.player.combat?.ap !== prevPlayerAp ||
          this.game.activeDialogue !== prevDialogue ||
          this.game.combatState.active !== prevCombatActive ||
          this.game.pendingCombatConfirmation !== prevPendingCombatConfirm ||
          this.game.isStealthActive !== prevStealthActive
        ) {
          this.onUiStateChange?.();
        }

        // 2. Handle manual camera controls (keyboard & edge panning)
        this.handleKeyboardCameraPan(dt);
        this.stepCameraEdgePan(dt, viewportW, viewportH);

        // 3. Smooth camera follow lerp when following player hero
        if (
          !this.isDraggingCamera &&
          !this.activeEdgeDirection &&
          this.keysDown.size === 0 &&
          !this.isManualCameraPanning
        ) {
          const { width: mapW, height: mapH } = this.game.map;
          const pRot = toRotatedContinuous(
            this.game.player.x,
            this.game.player.y,
            mapW,
            mapH,
            this.rotation
          );
          const pScr = gridToScreen(pRot.rx, pRot.ry, this.game.player.z);
          const targetCamX = viewportW * 0.5 - pScr.x * this.zoom;
          const targetCamY = viewportH * 0.53 - pScr.y * this.zoom;

          const dist = Math.hypot(targetCamX - this.cameraOffsetX, targetCamY - this.cameraOffsetY);
          if (dist > 0.6) {
            const followSpeed = this.game.player.isMoving ? 9.0 : 6.5;
            const followLerp = 1.0 - Math.exp(-followSpeed * dt);
            this.cameraOffsetX += (targetCamX - this.cameraOffsetX) * followLerp;
            this.cameraOffsetY += (targetCamY - this.cameraOffsetY) * followLerp;
          } else if (dist > 0) {
            this.cameraOffsetX = targetCamX;
            this.cameraOffsetY = targetCamY;
          }
        }

        this.updateParticles(dt);
        this.renderFrame();
      } catch (err) {
        console.error('Błąd w pętli renderowania klatki IsoSceneView:', err);
        if (this.app.stage.filters && this.app.stage.filters.length > 0) {
          console.warn('Wyłączam post-filter z powodu błędu, aby scena pozostała widoczna.');
          this.app.stage.filters = [];
          this.postFilter = null;
        }
      }
    });
  }

  public rotateCamera(deltaSteps: 1 | -1): void {
    this.rotation = (((this.rotation + deltaSteps) % 4 + 4) % 4) as CameraRotation;
    this.centerCameraOnPlayer();
    this.game.addLog(
      `Obrócono kamerę izometryczną 2.5D do kąta ${this.rotation * 90}° (${['N', 'E', 'S', 'W'][this.rotation]}).`
    );
    this.onUiStateChange?.();
  }

  public setRotation(rot: CameraRotation): void {
    this.rotation = rot;
    this.centerCameraOnPlayer();
    this.onUiStateChange?.();
  }

  /** Resets rotation, zoom, and position to the initial isometric view centered on the player. */
  public resetCameraToDefault(): void {
    this.rotation = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.centerCameraOnPlayer();
    this.onUiStateChange?.();
  }

  public applyEditorToolAtTile(centerX: number, centerY: number): void {
    const map = this.game.map;
    if (centerX < 0 || centerX >= map.width || centerY < 0 || centerY >= map.height) {
      return;
    }

    const radius = this.editorBrushSize === 3 ? 1 : 0;
    const affectedCoords: Array<{ x: number; y: number }> = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          affectedCoords.push({ x: tx, y: ty });
        }
      }
    }

    if (this.activeTool === 'paint_terrain') {
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].terrain = this.editorTerrainType;
        map.tiles[c.y][c.x].walkable =
          this.editorTerrainType === 'abyss_water' ? false : this.editorTerrainWalkable;
      }
      this.game.bumpMapRevision();
      this.game.recomputeFov();
      this.game.addLog(
        `[Edytor] Pomalowano teren (${centerX}, ${centerY}) pędzlem ${this.editorBrushSize}×${this.editorBrushSize}: ${this.editorTerrainType}.`
      );
      return;
    }

    const syncEntitiesElevationAtCoords = (): void => {
      for (const c of affectedCoords) {
        const tz = map.tiles[c.y][c.x].z;
        if (tz > map.maxElevation) {
          map.maxElevation = tz;
        }
        for (const prop of map.props) {
          if (prop.x === c.x && prop.y === c.y) {
            prop.z = tz;
          }
        }
        for (const npc of this.game.npcs) {
          if (npc.tileX === c.x && npc.tileY === c.y) {
            npc.z = tz;
          }
        }
        if (this.game.player.tileX === c.x && this.game.player.tileY === c.y) {
          this.game.player.z = tz;
        }
      }
      this.game.bumpMapRevision();
    };

    if (this.activeTool === 'raise_elevation') {
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].z = Math.min(4, map.tiles[c.y][c.x].z + 1);
      }
      syncEntitiesElevationAtCoords();
      this.game.addLog(
        `[Edytor] Podniesiono wysokość kafla (${centerX}, ${centerY}) do Z=${map.tiles[centerY][centerX].z}.`
      );
      return;
    }

    if (this.activeTool === 'lower_elevation') {
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].z = Math.max(0, map.tiles[c.y][c.x].z - 1);
      }
      syncEntitiesElevationAtCoords();
      this.game.addLog(
        `[Edytor] Obniżono wysokość kafla (${centerX}, ${centerY}) do Z=${map.tiles[centerY][centerX].z}.`
      );
      return;
    }

    if (this.activeTool === 'flatten_elevation') {
      const targetZ = Math.max(0, Math.min(4, Math.round(this.editorTargetElevation)));
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].z = targetZ;
      }
      syncEntitiesElevationAtCoords();
      this.game.addLog(
        `[Edytor] Wyrównano wysokość (${centerX}, ${centerY}) do Z=${targetZ}.`
      );
      return;
    }

    if (this.activeTool === 'remove_prop') {
      const existing = this.game.getPropAtTile(centerX, centerY);
      if (existing) {
        const idx = map.props.findIndex((p) => p.id === existing.id);
        if (idx >= 0) {
          map.props.splice(idx, 1);
        }
        if (existing.linkedLightId) {
          const lIdx = map.lights.findIndex((l) => l.id === existing.linkedLightId);
          if (lIdx >= 0) map.lights.splice(lIdx, 1);
        }
        this.game.rebuildPropGrid();
        this.game.bumpMapRevision();
        this.game.recomputeFov();
        this.game.addLog(`[Edytor] Usunięto obiekt „${existing.name}” z (${centerX}, ${centerY}).`);
        return;
      }
      const npcIdx = this.game.npcs.findIndex(
        (n) => n.tileX === centerX && n.tileY === centerY
      );
      if (npcIdx >= 0) {
        const removedNpc = this.game.npcs.splice(npcIdx, 1)[0];
        this.game.addLog(`[Edytor] Usunięto postać „${removedNpc.recipe.name}” z (${centerX}, ${centerY}).`);
      }
      return;
    }

    if (this.activeTool === 'place_prop') {
      const kind = this.editorPropKind;
      const multiTileKinds: ReadonlyArray<PropKind> = [
        'slavic_cottage',
        'market_stall',
        'ranger_tent',
        'runic_altar',
        'sarcophagus',
        'fallen_log'
      ];
      let sizeX = 1;
      let sizeY = 1;
      if (multiTileKinds.includes(kind)) {
        if (this.editorPropOrientation === '2x1') {
          sizeX = 2;
          sizeY = 1;
        } else if (this.editorPropOrientation === '1x2') {
          sizeX = 1;
          sizeY = 2;
        }
      }

      // Remove any overlapping prop in footprint
      for (let dy = 0; dy < sizeY; dy++) {
        for (let dx = 0; dx < sizeX; dx++) {
          const overlap = this.game.getPropAtTile(centerX + dx, centerY + dy);
          if (overlap) {
            const idx = map.props.findIndex((p) => p.id === overlap.id);
            if (idx >= 0) map.props.splice(idx, 1);
          }
        }
      }

      const passableKinds: ReadonlyArray<PropKind> = [
        'wildflower_patch',
        'ground_loot',
        'exit_path',
        'watermill_wheel',
        'perched_crow'
      ];
      const sightBlockingKinds: ReadonlyArray<PropKind> = [
        'wall_block',
        'pillar',
        'dungeon_column',
        'door',
        'pine_tree',
        'ancient_oak',
        'dead_tree',
        'slavic_cottage',
        'watchtower',
        'rock_cliff'
      ];
      const interactiveKinds: ReadonlyArray<PropKind> = [
        'door',
        'torch_sconce',
        'arcane_crystal',
        'chest',
        'sarcophagus',
        'campfire',
        'ground_loot',
        'exit_path',
        'market_stall',
        'slavic_shrine',
        'slavic_well',
        'watermill_wheel',
        'perched_crow',
        'travel_signpost',
        'watchtower',
        'dungeon_barrel',
        'dungeon_crate'
      ];

      const z = map.tiles[centerY][centerX].z;
      const propId = `editor_prop_${kind}_${centerX}_${centerY}_${Date.now()}`;
      let linkedLightId: string | undefined;

      if (kind === 'campfire' || kind === 'torch_sconce' || kind === 'arcane_crystal') {
        linkedLightId = `light_${propId}`;
        const isArcane = kind === 'arcane_crystal';
        map.lights.push({
          id: linkedLightId,
          x: centerX,
          y: centerY,
          z: z + 1.4,
          color: isArcane ? { r: 72, g: 224, b: 255 } : { r: 255, g: 164, b: 64 },
          intensity: 1.5,
          radius: 6.5,
          flickerSpeed: isArcane ? 1.8 : 4.2,
          enabled: true
        });
      }

      map.props.push({
        id: propId,
        name: `${kind} (#${this.editorPropVariant})`,
        kind,
        variant: this.editorPropVariant,
        x: centerX,
        y: centerY,
        z,
        sizeX,
        sizeY,
        heightZ: sightBlockingKinds.includes(kind) ? 2.6 : 1.2,
        blocksMovement: !passableKinds.includes(kind),
        blocksSight: sightBlockingKinds.includes(kind),
        interactive: interactiveKinds.includes(kind),
        isOpen: false,
        lootItems:
          kind === 'chest' ||
          kind === 'sarcophagus' ||
          kind === 'market_stall' ||
          kind === 'ground_loot' ||
          kind === 'dungeon_barrel' ||
          kind === 'dungeon_crate'
            ? ['item_raw_sausage']
            : undefined,
        linkedLightId
      });

      this.game.rebuildPropGrid();
      this.game.bumpMapRevision();
      this.game.recomputeFov();
      this.game.addLog(
        `[Edytor] Postawiono obiekt „${kind}” (wariant #${this.editorPropVariant}, ${sizeX}×${sizeY}) na (${centerX}, ${centerY}).`
      );
      return;
    }

    if (this.activeTool === 'place_torch_light' || this.activeTool === 'place_arcane_light') {
      const isArcane = this.activeTool === 'place_arcane_light';
      const z = map.tiles[centerY][centerX].z + 1.5;
      map.lights.push({
        id: `custom_light_${Date.now()}_${Math.random()}`,
        x: centerX,
        y: centerY,
        z,
        color: isArcane ? { r: 68, g: 228, b: 255 } : { r: 255, g: 168, b: 64 },
        intensity: 1.45,
        radius: 6.2,
        flickerSpeed: isArcane ? 1.8 : 4.2,
        enabled: true
      });
      this.game.addLog(
        `[Edytor] Dodano źródło światła PBR (${isArcane ? 'Eteryczny Kryształ' : 'Płomień Pochodni'}) na (${centerX}, ${centerY}).`
      );
      return;
    }

    if (this.activeTool === 'remove_light') {
      let nearestIdx = -1;
      let nearestDist = 2.5;
      map.lights.forEach((l, idx) => {
        const d = Math.hypot(l.x - centerX, l.y - centerY);
        if (d <= nearestDist) {
          nearestDist = d;
          nearestIdx = idx;
        }
      });
      if (nearestIdx >= 0) {
        const removed = map.lights.splice(nearestIdx, 1)[0];
        this.game.addLog(`[Edytor] Usunięto źródło światła PBR (${removed.id}) w pobliżu (${centerX}, ${centerY}).`);
      }
      return;
    }

    if (this.activeTool === 'spawn_npc') {
      const seed = Math.floor(Math.random() * 89000) + 1000;
      const recipe = generateRandomCharacterRecipe(seed);
      const z = map.tiles[centerY][centerX].z;
      this.game.npcs.push({
        id: `npc_editor_${seed}_${Date.now()}`,
        recipe,
        x: centerX + 0.5,
        y: centerY + 0.5,
        z,
        tileX: centerX,
        tileY: centerY,
        direction: 4,
        isMoving: false,
        animFrame: 0,
        animTimer: 0,
        path: [],
        dialogueId: 'npc_dobromir'
      });
      this.game.addLog(`[Edytor] Umieszczono NPC „${recipe.name}” na kaflu (${centerX}, ${centerY}).`);
      return;
    }

    if (this.activeTool === 'spawn_enemy') {
      const diff = this.editorEnemyDifficulty;
      const seed = Math.floor(Math.random() * 89000) + 2000;
      const recipe = generateRandomCharacterRecipe(seed);
      const z = map.tiles[centerY][centerX].z;

      const tierConfig =
        diff === 'easy'
          ? {
              name: 'Zdziczały Maruder Szlaku',
              label: '🟢 ŁATWY',
              hp: 48,
              ap: 8,
              skill: 56,
              armorBonus: -2,
              dmgBonus: -4
            }
          : diff === 'very_hard'
            ? {
                name: 'Upadły Czempion Pogranicza',
                label: '🔴 BARDZO TRUDNY',
                hp: 168,
                ap: 11,
                skill: 92,
                armorBonus: 18,
                dmgBonus: 8
              }
            : {
                name: 'Najemny Wiarus z Jaru',
                label: '🟡 NORMALNY',
                hp: 96,
                ap: 10,
                skill: 74,
                armorBonus: 4,
                dmgBonus: 2
              };

      recipe.name = tierConfig.name;
      recipe.title = `${tierConfig.label} Przeciwnik`;

      this.game.npcs.push({
        id: `enemy_editor_${diff}_${Date.now()}`,
        recipe,
        x: centerX + 0.5,
        y: centerY + 0.5,
        z,
        tileX: centerX,
        tileY: centerY,
        direction: 4,
        isMoving: false,
        animFrame: 0,
        animTimer: 0,
        path: [],
        combat: {
          isHostile: true,
          difficulty: diff,
          difficultyLabel: tierConfig.label,
          aggroRadius: 3.5,
          hp: tierConfig.hp,
          maxHp: tierConfig.hp,
          ap: tierConfig.ap,
          maxAp: tierConfig.ap,
          proficiencies: createDefaultProficiencies({ blades: tierConfig.skill }),
          defending: false,
          dazedHeadTurns: 0,
          crippledLegsTurns: 0,
          xpReward: 6,
          lootTable: ['item_raw_sausage'],
          isAlive: true,
          customArmorBonus: tierConfig.armorBonus,
          customDamageBonus: tierConfig.dmgBonus
        }
      });
      this.game.addLog(
        `[Edytor] Umieszczono przeciwnika (${tierConfig.label}) na kaflu (${centerX}, ${centerY}).`
      );
    }
  }

  public exportMapToJson(): string {
    return JSON.stringify(this.game.map, null, 2);
  }

  public importMapFromJson(jsonText: string): boolean {
    try {
      const parsed = JSON.parse(jsonText);
      if (
        !parsed ||
        typeof parsed.width !== 'number' ||
        typeof parsed.height !== 'number' ||
        !Array.isArray(parsed.tiles) ||
        !Array.isArray(parsed.props)
      ) {
        this.game.addLog('[Edytor] Błąd importu: nieprawidłowy format JSON mapy.');
        return false;
      }
      this.game.map.width = parsed.width;
      this.game.map.height = parsed.height;
      this.game.map.name = parsed.name || this.game.map.name;
      this.game.map.subtitle = parsed.subtitle || this.game.map.subtitle;
      this.game.map.tiles = parsed.tiles;
      this.game.map.props = parsed.props;
      this.game.map.lights = Array.isArray(parsed.lights) ? parsed.lights : [];
      this.game.rebuildPropGrid();
      this.game.bumpMapRevision();
      this.game.recomputeFov();
      this.game.addLog(`[Edytor] Wczytano mapę „${this.game.map.name}” (${parsed.width}×${parsed.height}) z pliku JSON.`);
      this.onUiStateChange?.();
      return true;
    } catch {
      this.game.addLog('[Edytor] Błąd parsowania pliku JSON mapy.');
      return false;
    }
  }

  public fillMapTerrain(
    terrain: TileTerrainType = this.editorTerrainType,
    walkable = this.editorTerrainWalkable
  ): void {
    const map = this.game.map;
    const isWalkable = terrain === 'abyss_water' ? false : walkable;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        map.tiles[y][x].terrain = terrain;
        map.tiles[y][x].walkable = isWalkable;
      }
    }
    this.game.bumpMapRevision();
    this.game.recomputeFov();
    this.game.addLog(`[Edytor] Wypełniono całą mapę (${map.width}×${map.height}) terenem: ${terrain}.`);
    this.onUiStateChange?.();
  }

  public flattenAllMapElevation(targetZ = 0): void {
    const map = this.game.map;
    const clampedZ = Math.max(0, Math.min(4, Math.round(targetZ)));
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        map.tiles[y][x].z = clampedZ;
      }
    }
    for (const p of map.props) {
      p.z = clampedZ;
    }
    for (const n of this.game.npcs) {
      n.z = clampedZ;
    }
    this.game.player.z = clampedZ;
    map.maxElevation = Math.max(map.maxElevation, clampedZ);
    this.game.bumpMapRevision();
    this.game.addLog(`[Edytor] Wyrównano wysokość całej mapy do poziomu Z=${clampedZ}.`);
    this.onUiStateChange?.();
  }

  public clearMapEntities(): void {
    this.game.map.props.length = 0;
    this.game.map.lights.length = 0;
    this.game.npcs.length = 0;
    this.game.rebuildPropGrid();
    this.game.bumpMapRevision();
    this.game.recomputeFov();
    this.game.addLog('[Edytor] Wyczyszczono wszystkie obiekty, światła i NPC z mapy (czysta makieta).');
    this.onUiStateChange?.();
  }

  public resetCurrentMap(): void {
    this.game.loadMap(this.game.map.id);
    this.centerCameraOnPlayer();
    this.onUiStateChange?.();
  }

  public centerCameraOnPlayer(): void {
    const { width: mapW, height: mapH } = this.game.map;
    const pRot = toRotatedContinuous(
      this.game.player.x,
      this.game.player.y,
      mapW,
      mapH,
      this.rotation
    );
    const pScr = gridToScreen(pRot.rx, pRot.ry, this.game.player.z);
    const screenW =
      (this.app.renderer ? this.app.screen.width : 0) ||
      (typeof window !== 'undefined' ? window.innerWidth : 0) ||
      1280;
    const screenH =
      (this.app.renderer ? this.app.screen.height : 0) ||
      (typeof window !== 'undefined' ? window.innerHeight : 0) ||
      720;
    this.cameraOffsetX = screenW * 0.5 - pScr.x * this.zoom;
    this.cameraOffsetY = screenH * 0.53 - pScr.y * this.zoom;
    this.isManualCameraPanning = false;
    this.cameraVelX = 0;
    this.cameraVelY = 0;
    this.targetZoom = this.zoom;
  }

  public getCharacterTextures(actor: ActorEntity): CharacterDualFrameTextures {
    const fastHash = computeCharacterRecipeHash(actor.recipe);
    const cached = this.characterTextureCache.get(fastHash);
    if (cached) {
      // Refresh insertion order for true LRU eviction
      this.characterTextureCache.delete(fastHash);
      this.characterTextureCache.set(fastHash, cached);
      return cached;
    }

    const t0 = performance.now();
    const baked: BakedCharacterBuffers = bakeCharacterBuffers(actor.recipe);

    if (typeof document === 'undefined') {
      const headlessEntry: CharacterDualFrameTextures = {
        recipeHash: baked.recipeHash,
        albedoFrames: [],
        normalFrames: [],
        portraitDataUrl: 'data:image/png;base64,',
        bakeDurationMs: 0.5,
        baseScale: 64 / Math.max(1, baked.frameWidth),
        anchorY: baked.anchorY ?? 82 / 96
      };
      this.characterTextureCache.set(fastHash, headlessEntry);
      return headlessEntry;
    }

    const baseAlbedo = rgbaBufferToTexture(
      baked.albedoRGBA,
      baked.sheetWidth,
      baked.sheetHeight
    );
    const baseNormal = rgbaBufferToTexture(
      baked.normalMaterialRGBA,
      baked.sheetWidth,
      baked.sheetHeight
    );

    const albedoFrames: Texture[][] = [];
    const normalFrames: Texture[][] = [];

    for (let dir = 0; dir < baked.directions; dir++) {
      const dirAlbedo: Texture[] = [];
      const dirNormal: Texture[] = [];
      for (let frame = 0; frame < baked.framesPerDirection; frame++) {
        const rect = new Rectangle(
          frame * baked.frameWidth,
          dir * baked.frameHeight,
          baked.frameWidth,
          baked.frameHeight
        );
        dirAlbedo.push(
          new Texture({
            source: baseAlbedo.source,
            frame: rect
          })
        );
        dirNormal.push(
          new Texture({
            source: baseNormal.source,
            frame: rect
          })
        );
      }
      albedoFrames.push(dirAlbedo);
      normalFrames.push(dirNormal);
    }

    // Extract South-West (dir 3) idle frame as crisp UI Paperdoll Portrait DataURL
    const portraitCanvas = document.createElement('canvas');
    portraitCanvas.width = baked.frameWidth;
    portraitCanvas.height = baked.frameHeight;
    const pCtx = portraitCanvas.getContext('2d');
    if (pCtx) {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = baked.sheetWidth;
      fullCanvas.height = baked.sheetHeight;
      const fCtx = fullCanvas.getContext('2d');
      if (fCtx) {
        fCtx.putImageData(
          new ImageData(new Uint8ClampedArray(baked.albedoRGBA), baked.sheetWidth, baked.sheetHeight),
          0,
          0
        );
        pCtx.drawImage(
          fullCanvas,
          0,
          3 * baked.frameHeight,
          baked.frameWidth,
          baked.frameHeight,
          0,
          0,
          baked.frameWidth,
          baked.frameHeight
        );
      }
    }

    const bakeDurationMs = Math.max(0.4, Number((performance.now() - t0).toFixed(2)));
    this.lastBakeDurationMs = bakeDurationMs;

    const portraitDataUrl = portraitCanvas.toDataURL();
    portraitCanvas.width = 0;
    portraitCanvas.height = 0;

    const entry: CharacterDualFrameTextures = {
      recipeHash: baked.recipeHash,
      albedoFrames,
      normalFrames,
      portraitDataUrl,
      bakeDurationMs,
      baseScale: 64 / Math.max(1, baked.frameWidth),
      anchorY: baked.anchorY ?? 82 / 96
    };

    if (this.characterTextureCache.size >= 64) {
      const oldestKey = this.characterTextureCache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldest = this.characterTextureCache.get(oldestKey);
        if (oldest) this.disposeCharacterTextureEntry(oldest);
        this.characterTextureCache.delete(oldestKey);
      }
    }
    this.characterTextureCache.set(fastHash, entry);
    return entry;
  }

  private getTileTexturePair(
    terrain: TileTerrainType,
    z: number,
    variant = 0
  ): DualPbrTexturePair {
    const key = `${terrain}_z${z}_v${variant}`;
    const existing = this.tileTextureCache.get(key);
    if (existing) return existing;

    const synth: SynthesizedPbrBufferPair = generateTilePbrBuffers(terrain, z, variant);
    const pair: DualPbrTexturePair = {
      albedo: rgbaBufferToTexture(synth.albedoRGBA, synth.width, synth.height),
      normalMat: rgbaBufferToTexture(synth.normalMaterialRGBA, synth.width, synth.height),
      anchorX: synth.anchorX,
      anchorY: synth.anchorY
    };
    this.tileTextureCache.set(key, pair);
    return pair;
  }

  private getTransitionTexturePair(
    terrain: TileTerrainType,
    slot: TerrainEdgeSlot,
    kind: TerrainTransitionKind,
    variant = 0
  ): DualPbrTexturePair {
    const key = `${terrain}_${slot}_${kind}_v${variant}`;
    const existing = this.transitionTextureCache.get(key);
    if (existing) return existing;

    const synth = generateTerrainTransitionPbr(terrain, slot, kind, variant);
    const pair: DualPbrTexturePair = {
      albedo: rgbaBufferToTexture(synth.albedoRGBA, synth.width, synth.height),
      normalMat: rgbaBufferToTexture(synth.normalMaterialRGBA, synth.width, synth.height),
      anchorX: synth.anchorX,
      anchorY: synth.anchorY
    };
    this.transitionTextureCache.set(key, pair);
    return pair;
  }

  private getMicroFoliageTexturePair(variant: number): DualPbrTexturePair | null {
    const vNorm = ((variant % 8) + 8) % 8;
    const existing = this.microFoliageTextureCache.get(vNorm);
    if (existing) return existing;

    const synth = getOgaGroundMicroTuftPbr(vNorm);
    if (!synth) return null;

    const pair: DualPbrTexturePair = {
      albedo: rgbaBufferToTexture(synth.albedoRGBA, synth.width, synth.height),
      normalMat: rgbaBufferToTexture(synth.normalMaterialRGBA, synth.width, synth.height),
      anchorX: synth.anchorX,
      anchorY: synth.anchorY
    };
    this.microFoliageTextureCache.set(vNorm, pair);
    return pair;
  }

  private loadCustomPropImageTexture(spec: CustomPropSpriteSpec): void {
    const cacheKey = `${spec.url}|${spec.targetWidthPx ?? 0}|${spec.anchorX ?? 0.5}|${spec.anchorY ?? 0.86}|${spec.allowMirrorX ? 1 : 0}`;
    if (this.customPropImageCache.has(cacheKey) || this.customPropLoadingUrls.has(cacheKey)) {
      return;
    }
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return;
    }
    this.customPropLoadingUrls.add(cacheKey);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this.isDestroyed) {
        this.customPropLoadingUrls.delete(cacheKey);
        return;
      }
      try {
        const targetW = Math.max(
          48,
          Math.min(512, Math.round(spec.targetWidthPx ?? Math.min(240, img.naturalWidth || 200)))
        );
        const aspect = (img.naturalHeight || targetW) / Math.max(1, img.naturalWidth || targetW);
        const targetH = Math.max(48, Math.round(targetW * aspect));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Key out white backgrounds at higher working resolution (up to 512px) BEFORE
        // downscaling to targetW x targetH so narrow slits (e.g. wattle weave, thin twigs)
        // never blur with white background into grey artifacts, and edges anti-alias cleanly.
        if (spec.keyOutWhiteBackground !== false) {
          const workW = Math.max(targetW, Math.min(512, img.naturalWidth || targetW));
          const workH = Math.max(targetH, Math.round(workW * aspect));
          const workCanvas = document.createElement('canvas');
          workCanvas.width = workW;
          workCanvas.height = workH;
          const workCtx = workCanvas.getContext('2d');
          if (workCtx) {
            workCtx.drawImage(img, 0, 0, workW, workH);
            const workData = workCtx.getImageData(0, 0, workW, workH);
            keyOutWhiteBackgroundRgba(workData.data, workW, workH);
            workCtx.putImageData(workData, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(workCanvas, 0, 0, targetW, targetH);
          } else {
            ctx.drawImage(img, 0, 0, targetW, targetH);
          }
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const px = imgData.data;

        // Synthesize lightweight Sobel luminance normal map for dynamic PBR torch/daylight lighting
        const normalRGBA = new Uint8ClampedArray(targetW * targetH * 4);
        const lum = new Float32Array(targetW * targetH);
        for (let i = 0; i < targetW * targetH; i++) {
          lum[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
        }
        for (let y = 0; y < targetH; y++) {
          for (let x = 0; x < targetW; x++) {
            const i = y * targetW + x;
            const i4 = i * 4;
            if (px[i4 + 3] < 10) {
              normalRGBA[i4 + 3] = 0;
              continue;
            }
            const lL = lum[y * targetW + Math.max(0, x - 1)];
            const lR = lum[y * targetW + Math.min(targetW - 1, x + 1)];
            const lU = lum[Math.max(0, y - 1) * targetW + x];
            const lD = lum[Math.min(targetH - 1, y + 1) * targetW + x];
            const nx = Math.max(-1, Math.min(1, (lL - lR) * 2.2));
            const ny = Math.max(-1, Math.min(1, (lU - lD) * 2.2 - 0.18));
            normalRGBA[i4] = Math.round((nx * 0.5 + 0.5) * 255);
            normalRGBA[i4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
            normalRGBA[i4 + 2] = 205;
            normalRGBA[i4 + 3] = px[i4 + 3];
          }
        }

        const pair: DualPbrTexturePair = {
          albedo: rgbaBufferToTexture(px, targetW, targetH),
          normalMat: rgbaBufferToTexture(normalRGBA, targetW, targetH),
          anchorX: spec.anchorX ?? 0.5,
          anchorY: spec.anchorY ?? 0.86,
          allowMirrorX: spec.allowMirrorX
        };
        this.customPropImageCache.set(cacheKey, pair);
      } finally {
        this.customPropLoadingUrls.delete(cacheKey);
      }
    };
    img.onerror = () => {
      this.customPropLoadingUrls.delete(cacheKey);
    };
    img.src = spec.url;
  }

  private getPropTexturePair(
    kind: PropKind,
    isOpen: boolean,
    rotW: number,
    rotH: number,
    variant = 0,
    propId?: string
  ): DualPbrTexturePair {
    const customSpec = resolveCustomPropSprite({ id: propId, kind, isOpen });
    if (customSpec) {
      const customKey = `${customSpec.url}|${customSpec.targetWidthPx ?? 0}|${customSpec.anchorX ?? 0.5}|${customSpec.anchorY ?? 0.86}|${customSpec.allowMirrorX ? 1 : 0}`;
      const loaded = this.customPropImageCache.get(customKey);
      if (loaded) return loaded;
      this.loadCustomPropImageTexture(customSpec);
    }

    const key = `${kind}_${isOpen ? 'open' : 'closed'}_${rotW}x${rotH}_v${variant}`;
    const existing = this.propTextureCache.get(key);
    if (existing) return existing;

    const synth = generatePropPbrBuffers(kind, isOpen, rotW, rotH, variant);
    const pair: DualPbrTexturePair = {
      albedo: rgbaBufferToTexture(synth.albedoRGBA, synth.width, synth.height),
      normalMat: rgbaBufferToTexture(synth.normalMaterialRGBA, synth.width, synth.height),
      anchorX: synth.anchorX,
      anchorY: synth.anchorY
    };
    this.propTextureCache.set(key, pair);
    return pair;
  }

  private clearCachedTextures(): void {
    for (const pair of this.tileTextureCache.values()) {
      pair.albedo.destroy(true);
      pair.normalMat.destroy(true);
    }
    this.tileTextureCache.clear();

    for (const pair of this.transitionTextureCache.values()) {
      pair.albedo.destroy(true);
      pair.normalMat.destroy(true);
    }
    this.transitionTextureCache.clear();

    for (const pair of this.microFoliageTextureCache.values()) {
      pair.albedo.destroy(true);
      pair.normalMat.destroy(true);
    }
    this.microFoliageTextureCache.clear();

    for (const pair of this.propTextureCache.values()) {
      pair.albedo.destroy(true);
      pair.normalMat.destroy(true);
    }
    this.propTextureCache.clear();

    for (const pair of this.customPropImageCache.values()) {
      pair.albedo.destroy(true);
      pair.normalMat.destroy(true);
    }
    this.customPropImageCache.clear();
    this.customPropLoadingUrls.clear();
    const prevStatic = this.floorStaticLayer.removeChildren();
    for (const ch of prevStatic) ch.destroy();
    this.cachedFloorStaticKey = '';
    this.cachedFloorTintKey = '';
    this.cachedFloorStaticTintEntries = [];
    this.cachedWaterTiles = [];
  }

  private clearTransientSceneVfx(): void {
    this.particles.length = 0;
    this.slashArcs.length = 0;
    this.shockwaves.length = 0;
    this.propReactions.clear();
    this.knownOpenChestIds.clear();
    this.deathCollapseTimers.clear();
    this.dodgeTimers.clear();
    this.lastActorPos.clear();
    this.cachedCombatReachKey = '';
    this.cachedHoverPathKey = '';
    this.cachedHoverPath = [];
  }

  private disposeCharacterTextureEntry(charTex: CharacterDualFrameTextures): void {
    const destroyedSources = new Set<unknown>();
    const disposeGrid = (grid: Texture[][]): void => {
      for (const row of grid) {
        for (const t of row) {
          if (t === Texture.EMPTY) continue;
          const src = t.source;
          t.destroy(false);
          if (src && !destroyedSources.has(src)) {
            destroyedSources.add(src);
            src.destroy();
          }
        }
      }
    };
    disposeGrid(charTex.albedoFrames);
    disposeGrid(charTex.normalFrames);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.unsubscribeCombatAttack?.();
    this.unsubscribeCombatAttack = null;
    this.inputAbortController?.abort();
    this.inputAbortController = null;

    this.clearTransientSceneVfx();
    this.clearCachedTextures();

    for (const charTex of this.characterTextureCache.values()) {
      this.disposeCharacterTextureEntry(charTex);
    }
    this.characterTextureCache.clear();
    this.displayPool.destroy();

    if (this.postFilter) {
      this.postFilter.destroy();
      this.postFilter = null;
    }

    try {
      this.app.destroy(true, { children: true, texture: true });
    } catch {
      // Ignore if Pixi app was never mounted/initialized
    }
  }

  private bindInputEvents(canvas: HTMLCanvasElement): void {
    this.inputAbortController?.abort();
    this.inputAbortController = new AbortController();
    const { signal } = this.inputAbortController;

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (document.querySelector(BLOCKING_MODAL_SELECTOR)) {
        this.keysDown.clear();
        return;
      }
      if (e.key === 'Alt') {
        e.preventDefault();
        this.isHighlightAltHeld = true;
        return;
      }
      const k = e.key.toLowerCase();
      this.keysDown.add(k);
      if (k === 'q') {
        this.rotateCamera(-1);
      } else if (k === 'e') {
        this.rotateCamera(1);
      } else if (k === 'home' || k === 'f') {
        this.centerCameraOnPlayer();
      } else if (k === 'r' && this.activeTool === 'place_prop') {
        this.editorPropOrientation =
          this.editorPropOrientation === '1x1'
            ? '2x1'
            : this.editorPropOrientation === '2x1'
              ? '1x2'
              : '1x1';
        this.onUiStateChange?.();
      }
    }, { signal });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') {
        this.isHighlightAltHeld = false;
      }
      this.keysDown.delete(e.key.toLowerCase());
    }, { signal });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (document.querySelector(BLOCKING_MODAL_SELECTOR)) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        this.targetZoom = Math.min(1.85, Math.max(0.55, Number((this.targetZoom * factor).toFixed(2))));
        if (this.activeTool !== 'interact') {
          this.onUiStateChange?.();
        }
      },
      { passive: false, signal }
    );

    canvas.addEventListener('pointerdown', (e) => {
      if (document.querySelector(BLOCKING_MODAL_SELECTOR)) {
        return;
      }
      if (e.button === 2 && !this.game.combatState.active && this.activeTool === 'interact') {
        this.updateHoveredTileFromPointer(e.clientX, e.clientY);
        if (this.hoveredWorldTile) {
          const { x, y } = this.hoveredWorldTile;
          const hostileAtTile = this.game.npcs.find(
            (n) =>
              n.tileX === x &&
              n.tileY === y &&
              n.combat?.isHostile &&
              n.combat.isAlive
          );
          if (hostileAtTile) {
            this.explorationAttackMode = false;
            this.game.commandAttackEnemyFromExploration(hostileAtTile.id);
            this.onUiStateChange?.();
            return;
          }
        }
      }

      if (e.button === 1 || e.button === 2) {
        this.isDraggingCamera = true;
        this.isManualCameraPanning = true;
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        return;
      }

      if (e.button === 0) {
        this.isManualCameraPanning = false;
        this.updateHoveredTileFromPointer(e.clientX, e.clientY);
        if (!this.hoveredWorldTile) return;
        const { x, y } = this.hoveredWorldTile;

        if (this.activeTool !== 'interact') {
          const isContinuousTool =
            this.activeTool === 'paint_terrain' ||
            this.activeTool === 'raise_elevation' ||
            this.activeTool === 'lower_elevation' ||
            this.activeTool === 'flatten_elevation' ||
            this.activeTool === 'remove_prop';
          if (isContinuousTool) {
            this.isPaintingWithBrush = true;
            this.lastPaintedTileKey = `${x},${y}`;
          }
          this.applyEditorToolAtTile(x, y);
          this.onUiStateChange?.();
          return;
        }

        if (this.explorationAttackMode && !this.game.combatState.active) {
          const hostileAtTile = this.game.npcs.find(
            (n) =>
              n.tileX === x &&
              n.tileY === y &&
              n.combat?.isHostile &&
              n.combat.isAlive
          );
          this.explorationAttackMode = false;
          if (hostileAtTile) {
            this.game.commandAttackEnemyFromExploration(hostileAtTile.id);
          } else {
            this.game.addLog('Anulowano celowanie — kliknij przeciwnika, aby rozpocząć walkę.', 'info');
          }
          this.onUiStateChange?.();
          return;
        }

        // Standard cRPG interaction / movement
        const npcAtTile = this.game.npcs.find(
          (n) => n.tileX === x && n.tileY === y && (!n.combat || n.combat.isAlive)
        );
        if (npcAtTile) {
          this.game.commandTalkToNpc(npcAtTile.id);
          this.onUiStateChange?.();
          return;
        }

        const deadNpcAtTile = this.game.npcs.find(
          (n) => n.tileX === x && n.tileY === y && n.combat && !n.combat.isAlive
        );
        if (deadNpcAtTile) {
          this.game.commandLootCorpse(deadNpcAtTile.id);
          this.onUiStateChange?.();
          return;
        }

        const propAtTile = this.game.getPropAtTile(x, y);
        if (propAtTile && propAtTile.interactive) {
          const prevMapId = this.game.map.id;
          this.game.commandInteractWithProp(propAtTile.id);
          if (this.game.map.id !== prevMapId) {
            this.centerCameraOnPlayer();
          }
          this.onUiStateChange?.();
          return;
        }

        this.game.commandPlayerMoveTo(x, y);
      }
    }, { signal });

    const onPointerOrMouseMove = (e: MouseEvent | PointerEvent): void => {
      const target = e.target as HTMLElement | null;
      const isBlockingModalOpen = Boolean(document.querySelector(BLOCKING_MODAL_SELECTOR));
      if (isBlockingModalOpen) {
        this.isDraggingCamera = false;
        this.isPaintingWithBrush = false;
        this.hoveredWorldTile = null;
        this.updateEdgePanPointerState(e.clientX, e.clientY, true, true);
        if (canvas.style.cursor !== 'default') {
          canvas.style.cursor = 'default';
        }
        return;
      }
      const overUi = Boolean(
        target?.closest(
          '.top-bar, .top-bar button, .hero-card, .chronicle-log.expanded, .chronicle-log .chronicle-toggle-btn, .chronicle-log .combat-tab-btn, .chronicle-log .combat-report-tag-btn, .combat-top-banner, .combat-unified-dock, .combat-tactical-bar, .combat-live-log, .combat-confirm-backdrop, .combat-report-modal-backdrop, .item-details-backdrop, .character-backdrop, .character-drawer, .credits-modal-backdrop, .credits-modal-window, .inventory-drawer, .inspector-card, .inspector-expand-btn, .dialogue-modal, .ostrze-overlay'
        )
      );
      this.updateEdgePanPointerState(e.clientX, e.clientY, true, overUi);

      if (this.isDraggingCamera) {
        const dx = e.clientX - this.dragLastX;
        const dy = e.clientY - this.dragLastY;
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        this.cameraOffsetX += dx;
        this.cameraOffsetY += dy;
        return;
      }
      if (overUi) {
        this.hoveredWorldTile = null;
        return;
      }
      this.updateHoveredTileFromPointer(e.clientX, e.clientY);
      if (this.isPaintingWithBrush && this.hoveredWorldTile && !overUi) {
        const key = `${this.hoveredWorldTile.x},${this.hoveredWorldTile.y}`;
        if (key !== this.lastPaintedTileKey) {
          this.lastPaintedTileKey = key;
          this.applyEditorToolAtTile(this.hoveredWorldTile.x, this.hoveredWorldTile.y);
          this.onUiStateChange?.();
        }
      }
    };

    if (typeof window !== 'undefined') {
      const hasPointer = 'PointerEvent' in (window as object);
      if (hasPointer) {
        window.addEventListener('pointermove', onPointerOrMouseMove, { passive: true, signal });
      } else {
        window.addEventListener('mousemove', onPointerOrMouseMove, { passive: true, signal });
      }
    }

    window.addEventListener('pointerup', () => {
      this.isDraggingCamera = false;
      this.isPaintingWithBrush = false;
      this.lastPaintedTileKey = '';
      this.updateCanvasCursor();
    }, { signal });

    document.documentElement.addEventListener('mouseleave', () => {
      this.isPointerInsideViewport = false;
      this.forcedEdgeDirection = null;
    }, { signal });

    window.addEventListener('blur', () => {
      this.isPointerInsideViewport = false;
      this.forcedEdgeDirection = null;
      this.keysDown.clear();
      this.isHighlightAltHeld = false;
    }, { signal });
  }

  public updateEdgePanPointerState(
    clientX: number,
    clientY: number,
    isInside: boolean,
    isOverUi: boolean
  ): void {
    this.pointerClientX = clientX;
    this.pointerClientY = clientY;
    this.isPointerInsideViewport = isInside;
    this.isPointerOverUi = isOverUi;
  }

  public setForcedEdgeDirection(dir: EdgePanDirection | null): void {
    this.forcedEdgeDirection = dir;
  }

  public stepCameraEdgePan(dt: number, viewportW: number, viewportH: number): void {
    if (this.isDraggingCamera || this.game.combatState.active || this.game.pendingCombatConfirmation) {
      if (this.activeEdgeDirection !== null) {
        this.activeEdgeDirection = null;
        this.syncEdgeIndicatorDom();
      }
      return;
    }

    const res = computeEdgePanState({
      pointerX: this.pointerClientX,
      pointerY: this.pointerClientY,
      viewportWidth: viewportW,
      viewportHeight: viewportH,
      marginPx: this.edgePanMarginPx,
      enabled: this.edgePanEnabled,
      isPointerInside: this.isPointerInsideViewport,
      isOverUi: this.isPointerOverUi,
      forcedDirection: this.forcedEdgeDirection
    });

    const prevDir = this.activeEdgeDirection;
    this.activeEdgeDirection = res.direction;
    if (prevDir !== this.activeEdgeDirection) {
      this.syncEdgeIndicatorDom();
    }

    if (res.direction) {
      this.isManualCameraPanning = true;
      const step = this.edgePanSpeed * dt;
      this.cameraOffsetX += res.offsetDeltaX * step;
      this.cameraOffsetY += res.offsetDeltaY * step;

      if (this.app.renderer?.canvas && this.isPointerInsideViewport && !this.isPointerOverUi) {
        this.updateHoveredTileFromPointer(this.pointerClientX, this.pointerClientY);
      }
    }
  }

  private syncEdgeIndicatorDom(): void {
    if (typeof document === 'undefined') return;
    const arrows = document.querySelectorAll<HTMLElement>('.edge-pan-arrow');
    arrows.forEach((el) => {
      const dir = el.dataset.edgeDir as EdgePanDirection | undefined;
      el.classList.toggle('active', Boolean(dir && dir === this.activeEdgeDirection));
    });

    this.updateCanvasCursor();
  }

  public updateCanvasCursor(): void {
    const canvas = this.app.renderer?.canvas;
    if (!canvas) return;

    if (this.isDraggingCamera) {
      if (this.currentAppliedCursor !== 'grabbing') {
        this.currentAppliedCursor = 'grabbing';
        canvas.style.cursor = 'grabbing';
      }
      return;
    }

    if (this.activeEdgeDirection) {
      const cursorMap: Record<EdgePanDirection, string> = {
        N: 'n-resize',
        NE: 'ne-resize',
        E: 'e-resize',
        SE: 'se-resize',
        S: 's-resize',
        SW: 'sw-resize',
        W: 'w-resize',
        NW: 'nw-resize'
      };
      const edgeCursor = cursorMap[this.activeEdgeDirection] || 'default';
      if (this.currentAppliedCursor !== edgeCursor) {
        this.currentAppliedCursor = edgeCursor;
        canvas.style.cursor = edgeCursor;
      }
      return;
    }

    if (this.isPointerOverUi || !this.isPointerInsideViewport) {
      if (this.currentAppliedCursor !== 'default') {
        this.currentAppliedCursor = 'default';
        canvas.style.cursor = 'default';
      }
      return;
    }

    let hoveredNpc = null;
    let hoveredProp = null;
    let isWalkable = false;

    if (this.hoveredWorldTile) {
      const { x, y } = this.hoveredWorldTile;
      isWalkable = this.game.isTileWalkable(x, y);

      const npc = this.game.npcs.find((n) => n.tileX === x && n.tileY === y);
      if (npc) {
        hoveredNpc = {
          id: npc.id,
          isAlive: Boolean(!npc.combat || npc.combat.isAlive),
          isHostile: Boolean(npc.combat?.isHostile),
          isLooted: Boolean(npc.isLooted),
          hasDialogue: Boolean(npc.dialogueId)
        };
      }

      const prop = this.game.getPropAtTile(x, y);
      if (prop) {
        hoveredProp = {
          id: prop.id,
          kind: prop.kind,
          interactive: Boolean(prop.interactive),
          isOpen: Boolean(prop.isOpen),
          lootItems: prop.lootItems
        };
      }
    }

    const action = determineActionCursor({
      hasActiveEdgePan: Boolean(this.activeEdgeDirection),
      hoveredWorldTile: this.hoveredWorldTile,
      isTileWalkable: isWalkable,
      hoveredNpc,
      hoveredProp,
      activeTool: this.activeTool
    });

    const targetCss = getCursorCss(action);
    if (this.currentAppliedCursor !== targetCss) {
      this.currentAppliedCursor = targetCss;
      canvas.style.cursor = targetCss;
    }
  }

  private handleKeyboardCameraPan(dt: number): void {
    let targetVx = 0;
    let targetVy = 0;
    const speed = 540;

    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) targetVy += speed;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) targetVy -= speed;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) targetVx += speed;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) targetVx -= speed;

    if (targetVx !== 0 || targetVy !== 0) {
      this.isManualCameraPanning = true;
      if (targetVx !== 0 && targetVy !== 0) {
        targetVx *= 0.7071;
        targetVy *= 0.7071;
      }
    }

    const accel = 16.0;
    const panLerp = 1.0 - Math.exp(-accel * dt);
    this.cameraVelX += (targetVx - this.cameraVelX) * panLerp;
    this.cameraVelY += (targetVy - this.cameraVelY) * panLerp;

    if (Math.abs(this.cameraVelX) > 0.05 || Math.abs(this.cameraVelY) > 0.05) {
      this.cameraOffsetX += this.cameraVelX * dt;
      this.cameraOffsetY += this.cameraVelY * dt;
      if (this.app.renderer?.canvas && this.isPointerInsideViewport && !this.isPointerOverUi) {
        this.updateHoveredTileFromPointer(this.pointerClientX, this.pointerClientY);
      }
    }
  }

  private updateHoveredTileFromPointer(clientX: number, clientY: number): void {
    const rect = this.app.canvas.getBoundingClientRect();
    const localX = (clientX - rect.left - this.cameraOffsetX) / this.zoom;
    const localY = (clientY - rect.top - this.cameraOffsetY) / this.zoom;

    const { width: rotW, height: rotH } = getRotatedDimensions(
      this.game.map.width,
      this.game.map.height,
      this.rotation
    );

    const picked = pickGridTileAtScreen(
      localX,
      localY,
      rotW,
      rotH,
      this.game.map.maxElevation,
      (rx, ry) => {
        const w = toWorldGrid(rx, ry, this.game.map.width, this.game.map.height, this.rotation);
        return this.game.map.tiles[w.y]?.[w.x]?.z ?? 0;
      }
    );

    if (!picked) {
      this.hoveredWorldTile = null;
      this.updateCanvasCursor();
      return;
    }

    const worldPt = toWorldGrid(
      picked.rx,
      picked.ry,
      this.game.map.width,
      this.game.map.height,
      this.rotation
    );
    this.hoveredWorldTile = {
      x: worldPt.x,
      y: worldPt.y,
      z: picked.z
    };
    this.updateCanvasCursor();
  }

  private updateParticles(dt: number): void {
    // Spawn atmospheric crackling embers, sparks, ethereal motes, and everyday time-of-day ambient
    if (!this.reducedMotion && this.particles.length < 150 && Math.random() < 0.75) {
      if (
        this.cachedParticleMapRef !== this.game.map ||
        this.cachedParticlePropsLen !== this.game.map.props.length
      ) {
        this.cachedParticleMapRef = this.game.map;
        this.cachedParticlePropsLen = this.game.map.props.length;
        this.cachedFireProps = this.game.map.props.filter(
          (p) => p.kind === 'campfire' || p.kind === 'torch_sconce'
        );
        this.cachedArcaneProps = this.game.map.props.filter(
          (p) =>
            p.kind === 'arcane_crystal' ||
            p.kind === 'slavic_shrine' ||
            p.kind === 'runic_altar'
        );
        this.cachedTreeProps = this.game.map.props.filter(
          (p) => p.kind === 'ancient_oak' || p.kind === 'pine_tree'
        );
        this.cachedIsOutdoor = isOutdoorMap(this.game.map);
      }

      const fireProps = this.cachedFireProps;
      const arcaneProps = this.cachedArcaneProps;
      const treeProps = this.cachedTreeProps;
      const px = this.game.player.x;
      const py = this.game.player.y;
      const mapW = this.game.map.width;
      const mapH = this.game.map.height;

      const roll = Math.random();
      if (fireProps.length > 0 && roll < 0.38) {
        // Crackling sparks & embers rising from campfires / torches
        const p = fireProps[Math.floor(Math.random() * fireProps.length)];
        if (p.isOpen) {
          const isCampfire = p.kind === 'campfire';
          const sparkColors = [0xffe066, 0xffa726, 0xff7043, 0xff3d00];
          this.particles.push({
            x: p.x + 0.5 + (Math.random() - 0.5) * (isCampfire ? 0.45 : 0.22),
            y: p.y + 0.5 + (Math.random() - 0.5) * (isCampfire ? 0.45 : 0.22),
            z: p.z + (isCampfire ? 0.35 : 1.35),
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            vz: 0.85 + Math.random() * 0.75,
            life: 0,
            maxLife: 0.8 + Math.random() * 0.85,
            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
            size: 1.6 + Math.random() * 1.4,
            kind: 'ember'
          });
        }
      } else if (arcaneProps.length > 0 && roll < 0.54) {
        // Floating ethereal motes around arcane crystals & ancient shrines
        const p = arcaneProps[Math.floor(Math.random() * arcaneProps.length)];
        const moteColors = [0x58e6ff, 0x80d8ff, 0xce93d8, 0x69f0ae];
        this.particles.push({
          x: p.x + 0.5 + (Math.random() - 0.5) * 0.5,
          y: p.y + 0.5 + (Math.random() - 0.5) * 0.5,
          z: p.z + 0.3 + Math.random() * 0.8,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          vz: 0.3 + Math.random() * 0.35,
          life: 0,
          maxLife: 1.6 + Math.random() * 1.2,
          color: moteColors[Math.floor(Math.random() * moteColors.length)],
          size: 2.2 + Math.random() * 1.5,
          kind: 'mote'
        });
      } else if (
        this.cachedIsOutdoor &&
        treeProps.length > 0 &&
        (this.timeOfDay === 'dzien' || this.timeOfDay === 'swit') &&
        roll < 0.78
      ) {
        // Gently drifting autumn birch/pine leaves falling from tree canopies
        const t = treeProps[Math.floor(Math.random() * treeProps.length)];
        const leafColors = [0xc9963b, 0xa86f2c, 0x7d8a3c, 0xb87d34];
        this.particles.push({
          x: t.x + 0.5 + (Math.random() - 0.5) * 1.6,
          y: t.y + 0.5 + (Math.random() - 0.5) * 1.6,
          z: t.z + 1.8 + Math.random() * 1.1,
          vx: 0.22 + Math.random() * 0.18,
          vy: 0.08 + (Math.random() - 0.5) * 0.16,
          vz: -(0.34 + Math.random() * 0.22),
          life: 0,
          maxLife: 3.4 + Math.random() * 2.2,
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
          size: 2.4 + Math.random() * 1.2,
          kind: 'leaf',
          phase: Math.random() * Math.PI * 2
        });
      } else if (
        this.cachedIsOutdoor &&
        (this.timeOfDay === 'zmierzch' || this.timeOfDay === 'noc') &&
        roll < 0.84
      ) {
        // Warm golden-lime fireflies bobbing lazily at dusk & night
        const fx = Math.max(1, Math.min(mapW - 2, px + (Math.random() - 0.5) * 14));
        const fy = Math.max(1, Math.min(mapH - 2, py + (Math.random() - 0.5) * 14));
        const fz = this.game.map.tiles[Math.floor(fy)]?.[Math.floor(fx)]?.z ?? 0;
        const fireflyColors = [0xd9f99d, 0xfef08a, 0xbef264];
        this.particles.push({
          x: fx,
          y: fy,
          z: fz + 0.35 + Math.random() * 0.85,
          vx: (Math.random() - 0.5) * 0.32,
          vy: (Math.random() - 0.5) * 0.32,
          vz: (Math.random() - 0.5) * 0.12,
          life: 0,
          maxLife: 3.2 + Math.random() * 2.6,
          color: fireflyColors[Math.floor(Math.random() * fireflyColors.length)],
          size: 2.2 + Math.random() * 1.1,
          kind: 'firefly',
          phase: Math.random() * Math.PI * 2
        });
      } else if (this.cachedIsOutdoor && this.timeOfDay === 'swit' && roll < 0.9) {
        // Subtle low-lying dawn ground mist wisps
        const mx = Math.max(1, Math.min(mapW - 2, px + (Math.random() - 0.5) * 16));
        const my = Math.max(1, Math.min(mapH - 2, py + (Math.random() - 0.5) * 16));
        const mz = this.game.map.tiles[Math.floor(my)]?.[Math.floor(mx)]?.z ?? 0;
        this.particles.push({
          x: mx,
          y: my,
          z: mz + 0.18,
          vx: 0.25 + Math.random() * 0.15,
          vy: (Math.random() - 0.5) * 0.08,
          vz: 0.02,
          life: 0,
          maxLife: 5.0 + Math.random() * 2.5,
          color: 0xdbeafe,
          size: 26 + Math.random() * 18,
          kind: 'mist',
          phase: Math.random() * Math.PI * 2
        });
      } else if (!this.cachedIsOutdoor && roll < 0.82) {
        // Subtle subterranean dust motes in crypts & mines
        const dx = Math.max(1, Math.min(mapW - 2, px + (Math.random() - 0.5) * 12));
        const dy = Math.max(1, Math.min(mapH - 2, py + (Math.random() - 0.5) * 12));
        const dz = this.game.map.tiles[Math.floor(dy)]?.[Math.floor(dx)]?.z ?? 0;
        this.particles.push({
          x: dx,
          y: dy,
          z: dz + 0.4 + Math.random() * 1.4,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          vz: 0.04 + (Math.random() - 0.5) * 0.08,
          life: 0,
          maxLife: 4.0 + Math.random() * 2.5,
          color: 0xcbd5e1,
          size: 1.5 + Math.random() * 0.9,
          kind: 'dust',
          phase: Math.random() * Math.PI * 2
        });
      } else {
        const enabledLights = this.game.map.lights.filter((l) => l.enabled);
        if (enabledLights.length > 0) {
          const l = enabledLights[Math.floor(Math.random() * enabledLights.length)];
          const isCyan = l.color.b > l.color.r;
          this.particles.push({
            x: l.x + 0.5 + (Math.random() - 0.5) * 0.35,
            y: l.y + 0.5 + (Math.random() - 0.5) * 0.35,
            z: l.z + 0.1,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            vz: 0.55 + Math.random() * 0.5,
            life: 0,
            maxLife: 1.2 + Math.random() * 1.1,
            color: isCyan ? 0x58e6ff : 0xffb347,
            size: isCyan ? 2.6 : 2.2,
            kind: 'ember'
          });
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'leaf') {
        const ph = (p.phase ?? 0) + p.life * 2.6;
        p.x += (p.vx + Math.sin(ph) * 0.28) * dt;
        p.y += (p.vy + Math.cos(ph * 0.8) * 0.18) * dt;
        p.z = Math.max(0.05, p.z + p.vz * dt);
      } else if (p.kind === 'firefly') {
        const ph = (p.phase ?? 0) + p.life * 2.1;
        p.x += (p.vx + Math.sin(ph) * 0.22) * dt;
        p.y += (p.vy + Math.cos(ph * 1.15) * 0.22) * dt;
        p.z += (p.vz + Math.sin(ph * 1.6) * 0.14) * dt;
      } else if (p.kind === 'mist' || p.kind === 'dust') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      } else {
        p.vx += Math.sin(p.life * 7.5 + p.y * 2.5) * 0.06 * dt;
        p.vy += Math.cos(p.life * 7.5 + p.x * 2.5) * 0.06 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
    }

    for (let i = this.slashArcs.length - 1; i >= 0; i--) {
      const arc = this.slashArcs[i];
      arc.life += dt;
      if (arc.life >= arc.maxLife) {
        this.slashArcs.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
      }
    }

    for (const [propId, reaction] of this.propReactions) {
      reaction.life += dt;
      if (reaction.life >= reaction.maxLife) {
        this.propReactions.delete(propId);
      }
    }

    for (const [actorId, dodge] of this.dodgeTimers) {
      dodge.life += dt;
      if (dodge.life >= dodge.maxLife) {
        this.dodgeTimers.delete(actorId);
      }
    }

    // Track chest openings for automatic 'pop' reaction & clear stale map caches
    for (const prop of this.game.map.props) {
      if (prop.kind === 'chest') {
        if (prop.isOpen) {
          if (!this.knownOpenChestIds.has(prop.id)) {
            this.knownOpenChestIds.add(prop.id);
            this.triggerPropReaction(prop.id, 'pop', 0.34);
          }
        } else {
          this.knownOpenChestIds.delete(prop.id);
        }
      }
    }

    // Track actor movement for footstep dust puffs, death collapse timers, and status auras
    const allActors: ActorEntity[] = [this.game.player, ...this.game.npcs];
    this.statusParticleTimer += dt;
    const emitStatusNow = !this.reducedMotion && this.statusParticleTimer >= 0.28;
    if (emitStatusNow) {
      this.statusParticleTimer = 0;
    }

    for (const actor of allActors) {
      const isDead = Boolean((actor.combat && !actor.combat.isAlive) || actor.isFallenCorpse);
      if (isDead) {
        if (actor.isFallenCorpse) {
          this.deathCollapseTimers.set(actor.id, DEATH_COLLAPSE_DURATION_SEC);
        } else {
          const cur = this.deathCollapseTimers.get(actor.id) ?? 0;
          if (cur < DEATH_COLLAPSE_DURATION_SEC) {
            this.deathCollapseTimers.set(
              actor.id,
              Math.min(DEATH_COLLAPSE_DURATION_SEC, cur + dt)
            );
          }
        }
        continue;
      } else if (this.deathCollapseTimers.has(actor.id)) {
        this.deathCollapseTimers.delete(actor.id);
      }

      const prev = this.lastActorPos.get(actor.id);
      if (!prev) {
        this.lastActorPos.set(actor.id, { x: actor.x, y: actor.y, distAccum: 0 });
      } else {
        const moved = Math.hypot(actor.x - prev.x, actor.y - prev.y);
        prev.x = actor.x;
        prev.y = actor.y;
        if (!this.reducedMotion && moved > 0.002 && moved < 2.5 && !isHoveringActor(actor.id, actor.recipe.name)) {
          prev.distAccum += moved;
          if (prev.distAccum >= 0.65 && this.particles.length < 130) {
            prev.distAccum = 0;
            this.particles.push({
              x: actor.x + (Math.random() - 0.5) * 0.18,
              y: actor.y + (Math.random() - 0.5) * 0.18,
              z: actor.z + 0.06,
              vx: (Math.random() - 0.5) * 0.18,
              vy: (Math.random() - 0.5) * 0.18,
              vz: 0.16 + Math.random() * 0.12,
              life: 0,
              maxLife: 0.42 + Math.random() * 0.18,
              color: 0xb8ad9a,
              size: 2.2 + Math.random() * 1.1,
              kind: 'dust'
            });
          }
        }
      }

      if (emitStatusNow && this.getActorStatuses && this.particles.length < 135) {
        const statuses = this.getActorStatuses(actor.id);
        for (const st of statuses) {
          if (st === 'krwawienie') {
            this.particles.push({
              x: actor.x + (Math.random() - 0.5) * 0.24,
              y: actor.y + (Math.random() - 0.5) * 0.24,
              z: actor.z + 0.75 + Math.random() * 0.35,
              vx: (Math.random() - 0.5) * 0.08,
              vy: (Math.random() - 0.5) * 0.08,
              vz: -0.55 - Math.random() * 0.25,
              life: 0,
              maxLife: 0.55 + Math.random() * 0.2,
              color: 0x991b1b,
              size: 2.1 + Math.random() * 0.9
            });
          } else if (st === 'zatrucie') {
            this.particles.push({
              x: actor.x + (Math.random() - 0.5) * 0.32,
              y: actor.y + (Math.random() - 0.5) * 0.32,
              z: actor.z + 0.35 + Math.random() * 0.4,
              vx: (Math.random() - 0.5) * 0.14,
              vy: (Math.random() - 0.5) * 0.14,
              vz: 0.32 + Math.random() * 0.18,
              life: 0,
              maxLife: 0.85 + Math.random() * 0.3,
              color: 0x65a30d,
              size: 2.6 + Math.random() * 1.2,
              kind: 'dust'
            });
          } else if (st === 'strach') {
            this.particles.push({
              x: actor.x + (Math.random() - 0.5) * 0.3,
              y: actor.y + (Math.random() - 0.5) * 0.3,
              z: actor.z + 0.65 + Math.random() * 0.5,
              vx: (Math.random() - 0.5) * 0.16,
              vy: (Math.random() - 0.5) * 0.16,
              vz: 0.24 + Math.random() * 0.14,
              life: 0,
              maxLife: 0.75 + Math.random() * 0.25,
              color: 0x475569,
              size: 2.8 + Math.random() * 1.2,
              kind: 'dust'
            });
          } else if (st === 'podpalenie') {
            this.particles.push({
              x: actor.x + (Math.random() - 0.5) * 0.26,
              y: actor.y + (Math.random() - 0.5) * 0.26,
              z: actor.z + 0.45 + Math.random() * 0.4,
              vx: (Math.random() - 0.5) * 0.15,
              vy: (Math.random() - 0.5) * 0.15,
              vz: 0.55 + Math.random() * 0.3,
              life: 0,
              maxLife: 0.5 + Math.random() * 0.25,
              color: 0xea580c,
              size: 2.2 + Math.random() * 0.9,
              kind: 'ember'
            });
          }
        }
      }
    }
  }

  public triggerPropReaction(
    propId: string,
    kind: PropReactionKind,
    durationSec = kind === 'rock' ? 0.55 : 0.34
  ): void {
    if (this.reducedMotion) return;
    this.propReactions.set(propId, { kind, life: 0, maxLife: durationSec });
  }

  public triggerDodgeSidestep(actorId: string, dirX: number, dirY: number): void {
    if (this.reducedMotion) return;
    this.dodgeTimers.set(actorId, {
      life: 0,
      maxLife: DODGE_ANIM_DURATION_SEC,
      dirX,
      dirY
    });
  }

  public spawnShockwaveRing(
    worldX: number,
    worldY: number,
    worldZ: number,
    maxRadius = 30,
    color = 0xd97706
  ): void {
    if (this.reducedMotion) return;
    this.shockwaves.push({
      x: worldX,
      y: worldY,
      z: worldZ,
      life: 0,
      maxLife: 0.28,
      maxRadius,
      color
    });
  }

  public spawnParrySparks(worldX: number, worldY: number, worldZ: number): void {
    const parryColors = [0xfef08a, 0xeab308, 0xd97706, 0xf8fafc];
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.1 + Math.random() * 1.9;
      this.particles.push({
        x: worldX + (Math.random() - 0.5) * 0.2,
        y: worldY + (Math.random() - 0.5) * 0.2,
        z: worldZ + (Math.random() - 0.5) * 0.25,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 1.0 + Math.random() * 0.9,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.22,
        color: parryColors[Math.floor(Math.random() * parryColors.length)],
        size: 1.7 + Math.random() * 1.1
      });
    }
  }

  public triggerScreenShake(durationMs = 150, intensityPx = 3.2): void {
    if (this.reducedMotion) return;
    const durSec = Math.max(0.02, durationMs / 1000);
    if (intensityPx >= this.screenShakeIntensity || this.screenShakeTimer <= 0) {
      this.screenShakeIntensity = intensityPx;
      this.screenShakeMaxTimer = durSec;
      this.screenShakeTimer = durSec;
    } else {
      this.screenShakeTimer = Math.max(this.screenShakeTimer, durSec);
      this.screenShakeMaxTimer = Math.max(this.screenShakeMaxTimer, this.screenShakeTimer);
    }
  }

  public spawnCombatHitVfx(
    worldX: number,
    worldY: number,
    worldZ: number,
    isCritical: boolean,
    isArmored: boolean
  ): void {
    const bloodColors = [0xb71c1c, 0xc62828, 0xd32f2f, 0x8e0000];
    const sparkColors = [0xffea00, 0xffd600, 0xff9100, 0xffffff];

    const count = isCritical ? 18 : 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 1.8;
      const isSpark = isArmored && Math.random() < 0.65;
      this.particles.push({
        x: worldX + (Math.random() - 0.5) * 0.25,
        y: worldY + (Math.random() - 0.5) * 0.25,
        z: worldZ + (Math.random() - 0.5) * 0.3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: (isSpark ? 1.2 : 0.4) + Math.random() * 0.8,
        life: 0,
        maxLife: isSpark ? 0.35 + Math.random() * 0.3 : 0.65 + Math.random() * 0.5,
        color: isSpark
          ? sparkColors[Math.floor(Math.random() * sparkColors.length)]
          : bloodColors[Math.floor(Math.random() * bloodColors.length)],
        size: isSpark ? 1.8 + Math.random() * 1.2 : 2.5 + Math.random() * 2.0
      });
    }
  }

  public spawnSlashArc(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color = 0xedf2f7,
    startZ = 0,
    targetZ = 0,
    widthScale = 1
  ): void {
    this.slashArcs.push({
      startX: fromX,
      startY: fromY,
      startZ,
      targetX: toX,
      targetY: toY,
      targetZ,
      life: 0,
      maxLife: 0.18,
      color,
      widthScale
    });
  }

  private buildScreenSpaceLights(): ScreenSpacePointLight[] {
    const result: ScreenSpacePointLight[] = [];
    const { width: mapW, height: mapH } = this.game.map;

    for (const l of this.game.map.lights) {
      if (!l.enabled) continue;
      const rot = toRotatedContinuous(l.x + 0.5, l.y + 0.5, mapW, mapH, this.rotation);
      const scr = gridToScreen(rot.rx, rot.ry, l.z);
      const flicker =
        1.0 +
        Math.sin(this.elapsedSeconds * l.flickerSpeed + l.x * 1.7) * 0.09 +
        Math.cos(this.elapsedSeconds * l.flickerSpeed * 1.6 + l.y) * 0.05;

      result.push({
        screenX: scr.x,
        screenY: scr.y,
        zHeightPx: 42,
        r: l.color.r / 255,
        g: l.color.g / 255,
        b: l.color.b / 255,
        intensity: l.intensity * flicker,
        radiusPx: l.radius * (TILE_WIDTH * 0.5)
      });
    }

    // Add player's dynamic light (Torch / Astral Staff or subtle Hero Key Light)
    const playerOffhand = this.game.player.recipe.equipment.offHand;
    const playerMainhand = this.game.player.recipe.equipment.mainHand;
    const pRot = toRotatedContinuous(
      this.game.player.x,
      this.game.player.y,
      mapW,
      mapH,
      this.rotation
    );
    const pScr = gridToScreen(pRot.rx, pRot.ry, this.game.player.z + 1.4);

    if (playerOffhand === 'offhand_torch' || playerMainhand === 'weapon_astral_staff') {
      const isStaff = playerMainhand === 'weapon_astral_staff';
      result.push({
        screenX: pScr.x,
        screenY: pScr.y,
        zHeightPx: 46,
        r: isStaff ? 0.35 : 1.0,
        g: isStaff ? 0.88 : 0.68,
        b: isStaff ? 1.0 : 0.28,
        intensity: 1.45 + Math.sin(this.elapsedSeconds * 5.0) * 0.08,
        radiusPx: 5.8 * (TILE_WIDTH * 0.5)
      });
    } else {
      // Subtle personal adventurer fill / aura light (ARPG standard so hero is always readable)
      result.push({
        screenX: pScr.x,
        screenY: pScr.y,
        zHeightPx: 38,
        r: 0.88,
        g: 0.82,
        b: 0.94,
        intensity: 0.65,
        radiusPx: 3.6 * (TILE_WIDTH * 0.5)
      });
    }

    return result;
  }

  private computeRgbTintForScreenPoint(
    sx: number,
    sy: number,
    nx: number,
    ny: number,
    roughness: number,
    metallic: number,
    fovFactor: number,
    lights: ReadonlyArray<ScreenSpacePointLight>
  ): number {
    if (this.bufferMode !== 'final_pbr') {
      return 0xffffff;
    }

    this.scratchSurface.nx = nx;
    this.scratchSurface.ny = ny;
    this.scratchSurface.roughness = roughness;
    this.scratchSurface.metallic = metallic;

    const lit = evaluateDeferredPbrLightAtPoint(
      sx,
      sy,
      this.scratchSurface,
      lights,
      this.game.ambientLightIntensity,
      this.scratchPbrLit
    );

    // Softly compress tint into [0..240] so sprites never blow out when combined with the GLSL shader
    const compress = (v: number): number => v / (1.0 + v * 0.55);
    const r = Math.min(242, Math.max(18, Math.round(compress(lit.r) * fovFactor * 245)));
    const g = Math.min(242, Math.max(20, Math.round(compress(lit.g) * fovFactor * 245)));
    const b = Math.min(246, Math.max(26, Math.round(compress(lit.b) * fovFactor * 250)));
    return (r << 16) | (g << 8) | b;
  }

  private renderFrame(): void {
    this.displayPool.beginFrame();
    const cursorKey = `${this.hoveredWorldTile?.x ?? -1},${this.hoveredWorldTile?.y ?? -1}|${this.activeTool}|${this.activeEdgeDirection ?? ''}|${this.isDraggingCamera ? 1 : 0}`;
    if (cursorKey !== this.lastCursorKey) {
      this.lastCursorKey = cursorKey;
      this.updateCanvasCursor();
    }

    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShakeTimer > 0) {
      const decay = Math.pow(
        Math.max(0, Math.min(1, this.screenShakeTimer / Math.max(0.01, this.screenShakeMaxTimer))),
        1.4
      );
      const amp = this.screenShakeIntensity * decay;
      shakeX = (Math.random() - 0.5) * 2 * amp;
      shakeY = (Math.random() - 0.5) * 2 * amp;
    }
    const camPosX = Math.round(this.cameraOffsetX + shakeX);
    const camPosY = Math.round(this.cameraOffsetY + shakeY);
    this.worldContainer.position.set(camPosX, camPosY);
    this.worldContainer.scale.set(this.zoom);

    this.floorDynamicLayer.removeChildren();
    this.sortedObjectLayer.removeChildren();
    this.debugOverlayContainer.removeChildren();
    this.cursorAndPathGraphics.clear();
    this.groundShadowsGraphics.clear();
    this.lightingOverlayGraphics.clear();

    const { width: mapW, height: mapH } = this.game.map;
    const { width: rotW, height: rotH } = getRotatedDimensions(mapW, mapH, this.rotation);
    const useNormalTex = this.bufferMode === 'normal_map';
    const screenLights = this.buildScreenSpaceLights();

    const viewW =
      (this.app.renderer ? this.app.screen.width : 0) ||
      (typeof window !== 'undefined' ? window.innerWidth : 0) ||
      1280;
    const viewH =
      (this.app.renderer ? this.app.screen.height : 0) ||
      (typeof window !== 'undefined' ? window.innerHeight : 0) ||
      720;

    updateAtmosphericFilterUniforms(
      this.postFilter,
      this.game.ambientLightIntensity,
      this.elapsedSeconds,
      this.bufferMode === 'final_pbr',
      this.cameraOffsetX + shakeX,
      this.cameraOffsetY + shakeY,
      this.zoom,
      screenLights,
      viewW * 0.5,
      viewH * 0.5
    );

    // When the WebGL per-pixel atmospheric post-filter is active, floor tiles MUST use a uniform
    // ambient tint so point lights and world dappling are evaluated smoothly per-pixel in GLSL
    // instead of creating flat-shaded diamond steps across the ground.
    const usePerPixelFloorLighting = this.postFilter !== null && this.bufferMode === 'final_pbr';
    const emptyLights: ReadonlyArray<ScreenSpacePointLight> = [];
    const uniformFloorAmbientTint = usePerPixelFloorLighting
      ? this.computeRgbTintForScreenPoint(0, 0, 0, -0.25, 0.6, 0.15, 1.0, emptyLights)
      : 0xffffff;
    const cullPad = 380;
    const minLocalX = (-this.cameraOffsetX - cullPad) / Math.max(0.25, this.zoom);
    const maxLocalX = (viewW - this.cameraOffsetX + cullPad) / Math.max(0.25, this.zoom);
    const minLocalY = (-this.cameraOffsetY - cullPad) / Math.max(0.25, this.zoom);
    const maxLocalY = (viewH - this.cameraOffsetY + cullPad) / Math.max(0.25, this.zoom);

    // 1. Render Seamless Isometric Floor Tiles + Organic Terrain Transitions in Painter Order
    const showTacticalGrid =
      this.bufferMode !== 'walkability_fov' &&
      (this.game.combatState.active || this.showGridInExploration);
    const isPlayerCombatTurn =
      this.game.combatState.active &&
      this.game.combatState.activeTurnActorId === this.game.player.id;
    const combatApPerStep =
      this.game.player.combat && this.game.player.combat.crippledLegsTurns > 0 ? 2 : 1;
    const combatMaxReachSteps = isPlayerCombatTurn
      ? Math.floor((this.game.player.combat?.ap ?? 0) / combatApPerStep)
      : 0;

    if (showTacticalGrid) {
      this.combatEnemyTileSet.clear();
      let enemyPosSig = '';
      for (const npc of this.game.npcs) {
        if (npc.combat?.isHostile && npc.combat.isAlive) {
          this.combatEnemyTileSet.add(npc.tileY * mapW + npc.tileX);
          enemyPosSig += `${npc.tileX},${npc.tileY};`;
        }
      }

      if (isPlayerCombatTurn && combatMaxReachSteps > 0) {
        const reachKey = `${this.game.map.id}:${this.game.mapRevision}:${this.game.map.props.length}:${this.game.player.tileX},${this.game.player.tileY}:${combatMaxReachSteps}:${enemyPosSig}`;
        if (reachKey !== this.cachedCombatReachKey) {
          this.cachedCombatReachKey = reachKey;
          computeReachableTilesBfs(
            mapW,
            mapH,
            this.game.player.tileX,
            this.game.player.tileY,
            combatMaxReachSteps,
            (tx, ty) => this.game.isTileWalkable(tx, ty, this.game.player.id),
            (tx, ty) => this.game.map.tiles[ty][tx].z,
            1,
            this.cachedCombatReachSet
          );
        }
      } else {
        this.cachedCombatReachSet.clear();
        this.cachedCombatReachKey = '';
      }
    }

    if (this.organicTerrainBlending && this.bufferMode !== 'depth_dag') {
      const transitionsKey = `${this.game.map.id}:${this.game.mapRevision}:${this.rotation}:${rotW}x${rotH}`;
      if (transitionsKey !== this.cachedTransitionsKey) {
        this.cachedTransitionsKey = transitionsKey;
        const totalRotated = rotW * rotH;
        const cache = new Array<TerrainTransitionOverlay[]>(totalRotated);
        const getRotatedNeighborInfo = (nrx: number, nry: number): NeighborTileInfo | null => {
          if (nrx < 0 || nrx >= rotW || nry < 0 || nry >= rotH) return null;
          const nw = toWorldGrid(nrx, nry, mapW, mapH, this.rotation);
          const nCell = this.game.map.tiles[nw.y]?.[nw.x];
          if (!nCell) return null;
          this.scratchNeighbor.terrain = nCell.terrain;
          this.scratchNeighbor.z = nCell.z;
          return this.scratchNeighbor;
        };
        for (let cry = 0; cry < rotH; cry++) {
          for (let crx = 0; crx < rotW; crx++) {
            const cw = toWorldGrid(crx, cry, mapW, mapH, this.rotation);
            const cCell = this.game.map.tiles[cw.y][cw.x];
            cache[cry * rotW + crx] = computeTileTransitions(
              crx,
              cry,
              cCell.terrain,
              cCell.z,
              getRotatedNeighborInfo
            );
          }
        }
        this.cachedTransitionsByTile = cache;
      }
    }

    const waterCausticsGfx = this.bufferMode === 'final_pbr' ? this.displayPool.graphics() : null;
    let hasWaterCaustics = false;

    // Detect map switches initiated outside game.update(dt) (e.g. loadCustomScene)
    if (this.game.map.id !== this.lastRenderedMapId) {
      if (this.lastRenderedMapId !== '') {
        this.clearTransientSceneVfx();
      }
      this.lastRenderedMapId = this.game.map.id;
    }

    // Cache static floor tiles/transitions/micro-foliage across frames in WebGL per-pixel PBR mode.
    // Geometry key is decoupled from per-step FOV/ambient tint so stepping never tears down sprites.
    const canCacheStaticFloor = usePerPixelFloorLighting && this.bufferMode === 'final_pbr';
    const fovSig = this.game.fogOfWarEnabled
      ? `${this.game.player.tileX},${this.game.player.tileY}`
      : 'nofov';
    const floorStaticKey = canCacheStaticFloor
      ? `${this.game.map.id}:${this.game.mapRevision}:${this.game.map.props.length}:${this.rotation}:${this.organicTerrainBlending ? 1 : 0}`
      : '';
    const floorTintKey = canCacheStaticFloor ? `${uniformFloorAmbientTint}:${fovSig}` : '';

    const needsStaticRebuild = !canCacheStaticFloor || floorStaticKey !== this.cachedFloorStaticKey;
    if (needsStaticRebuild) {
      const prevStaticChildren = this.floorStaticLayer.removeChildren();
      for (const child of prevStaticChildren) {
        child.destroy();
      }
      this.cachedFloorStaticKey = floorStaticKey;
      this.cachedFloorTintKey = floorTintKey;
      this.cachedFloorStaticTintEntries = [];
      this.cachedWaterTiles = [];

      for (let sum = 0; sum <= rotW + rotH - 2; sum++) {
        for (let rx = 0; rx < rotW; rx++) {
          const ry = sum - rx;
          if (ry < 0 || ry >= rotH) continue;

          const worldCoord = toWorldGrid(rx, ry, mapW, mapH, this.rotation);
          const cell = this.game.map.tiles[worldCoord.y][worldCoord.x];
          const scr = gridToScreen(rx + 0.5, ry + 0.5, cell.z);

          if (cell.terrain === 'abyss_water') {
            this.cachedWaterTiles.push({ rx, ry, sx: scr.x, sy: scr.y });
          }

          if (
            !canCacheStaticFloor &&
            (scr.x < minLocalX || scr.x > maxLocalX || scr.y < minLocalY || scr.y > maxLocalY)
          ) {
            continue;
          }

          const variantCount =
            cell.terrain === 'forest_grass' ||
            cell.terrain === 'dirt_path' ||
            cell.terrain === 'forest_soil' ||
            cell.terrain === 'abyss_water'
              ? 8
              : 4;
          const tileVariant = getWorldTileVariant(cell.x, cell.y, variantCount);
          const texPair = this.getTileTexturePair(cell.terrain, cell.z, tileVariant);
          const tileTex = useNormalTex ? texPair.normalMat : texPair.albedo;
          const sprite = canCacheStaticFloor ? new Sprite(tileTex) : this.displayPool.sprite(tileTex);
          sprite.anchor.set(texPair.anchorX, texPair.anchorY);
          sprite.position.set(scr.x, scr.y);
          // Subtle 1.5% overdraw prevents any hairline subpixel grid seams across zoom levels
          sprite.scale.set(1.015, 1.015);

          const fovFactor = this.game.fogOfWarEnabled
            ? this.game.fov.getLightFactor(cell.x, cell.y)
            : 1.0;

          let tileTint: number;
          if (usePerPixelFloorLighting) {
            tileTint =
              fovFactor >= 0.999
                ? uniformFloorAmbientTint
                : this.computeRgbTintForScreenPoint(
                    0,
                    0,
                    0,
                    -0.25,
                    0.6,
                    0.15,
                    fovFactor,
                    emptyLights
                  );
          } else {
            const baseTint = this.computeRgbTintForScreenPoint(
              scr.x,
              scr.y,
              0,
              -0.25,
              0.6,
              0.15,
              fovFactor,
              screenLights
            );
            tileTint = baseTint;
            if (this.bufferMode === 'final_pbr') {
              const mod = getWorldGroundColorMod(cell.x, cell.y, this.scratchGroundMod);
              const rMod = Math.min(255, Math.max(0, Math.round(((baseTint >> 16) & 0xff) * mod.r)));
              const gMod = Math.min(255, Math.max(0, Math.round(((baseTint >> 8) & 0xff) * mod.g)));
              const bMod = Math.min(255, Math.max(0, Math.round((baseTint & 0xff) * mod.b)));
              tileTint = (rMod << 16) | (gMod << 8) | bMod;
            }
          }

          sprite.tint = tileTint;
          if (canCacheStaticFloor) {
            this.floorStaticLayer.addChild(sprite);
            this.cachedFloorStaticTintEntries.push({ sprite, worldX: cell.x, worldY: cell.y });
          } else {
            this.floorDynamicLayer.addChild(sprite);
          }

          // 1B. Organic Terrain Edge & Corner Transition Blending (cached per mapRevision & camera rotation)
          if (this.organicTerrainBlending && this.bufferMode !== 'depth_dag') {
            const transitions = this.cachedTransitionsByTile[ry * rotW + rx];
            if (transitions && transitions.length > 0) {
              const transVariant = getWorldTileVariant(cell.x, cell.y, 4);
              for (let ti = 0; ti < transitions.length; ti++) {
                const tr = transitions[ti];
                const trTex = this.getTransitionTexturePair(
                  tr.terrain,
                  tr.slot,
                  tr.kind,
                  transVariant
                );
                const trTexture = useNormalTex ? trTex.normalMat : trTex.albedo;
                const trSprite = canCacheStaticFloor
                  ? new Sprite(trTexture)
                  : this.displayPool.sprite(trTexture);
                trSprite.anchor.set(trTex.anchorX, trTex.anchorY);
                trSprite.position.set(scr.x, scr.y);
                trSprite.scale.set(1.015, 1.015);
                trSprite.tint = tileTint;
                if (canCacheStaticFloor) {
                  this.floorStaticLayer.addChild(trSprite);
                  this.cachedFloorStaticTintEntries.push({
                    sprite: trSprite,
                    worldX: cell.x,
                    worldY: cell.y
                  });
                } else {
                  this.floorDynamicLayer.addChild(trSprite);
                }
              }
            }
          }

          // 1C. Subtle Ground-Level Grass Tufts & Field Pebbles on open natural tiles
          if (
            this.organicTerrainBlending &&
            this.bufferMode === 'final_pbr' &&
            cell.walkable &&
            !this.game.getPropAtTile(cell.x, cell.y)
          ) {
            const mf = getMicroFoliagePlacement(
              cell.x,
              cell.y,
              cell.terrain,
              this.scratchMicroFoliage
            );
            if (mf) {
              const mfTex = this.getMicroFoliageTexturePair(mf.variant);
              if (mfTex) {
                const mfSprite = canCacheStaticFloor
                  ? new Sprite(mfTex.albedo)
                  : this.displayPool.sprite(mfTex.albedo);
                mfSprite.anchor.set(mfTex.anchorX, mfTex.anchorY);
                mfSprite.position.set(scr.x + mf.offsetX, scr.y + mf.offsetY);
                mfSprite.scale.set(mf.scale, mf.scale);
                mfSprite.alpha = mf.alpha;
                mfSprite.tint = tileTint;
                if (canCacheStaticFloor) {
                  this.floorStaticLayer.addChild(mfSprite);
                  this.cachedFloorStaticTintEntries.push({
                    sprite: mfSprite,
                    worldX: cell.x,
                    worldY: cell.y
                  });
                } else {
                  this.floorDynamicLayer.addChild(mfSprite);
                }
              }
            }
          }
        }
      }
    } else if (canCacheStaticFloor && floorTintKey !== this.cachedFloorTintKey) {
      // Fast in-place tint update on FOV / ambient change without rebuilding sprites
      this.cachedFloorTintKey = floorTintKey;
      for (let i = 0; i < this.cachedFloorStaticTintEntries.length; i++) {
        const entry = this.cachedFloorStaticTintEntries[i];
        const fovFactor = this.game.fogOfWarEnabled
          ? this.game.fov.getLightFactor(entry.worldX, entry.worldY)
          : 1.0;
        entry.sprite.tint =
          fovFactor >= 0.999
            ? uniformFloorAmbientTint
            : this.computeRgbTintForScreenPoint(
                0,
                0,
                0,
                -0.25,
                0.6,
                0.15,
                fovFactor,
                emptyLights
              );
      }
    }

    // Dynamic water caustics (only iterates cached water tiles, batched into 1 Graphics)
    if (waterCausticsGfx && this.cachedWaterTiles.length > 0) {
      for (let wi = 0; wi < this.cachedWaterTiles.length; wi++) {
        const wt = this.cachedWaterTiles[wi];
        if (wt.sx < minLocalX || wt.sx > maxLocalX || wt.sy < minLocalY || wt.sy > maxLocalY) {
          continue;
        }
        const wavePhase = this.elapsedSeconds * 2.2 + wt.rx * 1.5 + wt.ry * 2.1;
        const shimmerAlpha = 0.16 + Math.sin(wavePhase) * 0.12;
        if (shimmerAlpha > 0.06) {
          const caustW = TILE_WIDTH * 0.32;
          const caustH = TILE_HEIGHT * 0.2;
          const caustOffX = Math.sin(wavePhase * 0.8) * 6;
          const caustOffY = Math.cos(wavePhase * 0.9) * 3;
          waterCausticsGfx
            .ellipse(wt.sx + caustOffX, wt.sy + caustOffY, caustW, caustH)
            .stroke({ color: 0x90e0ef, width: 1.2, alpha: shimmerAlpha })
            .ellipse(wt.sx - caustOffX * 0.5, wt.sy - caustOffY * 0.5, caustW * 0.55, caustH * 0.45)
            .fill({ color: 0x00b4d8, alpha: shimmerAlpha * 0.35 });
          hasWaterCaustics = true;
        }
      }
    }

    if (waterCausticsGfx && hasWaterCaustics) {
      this.floorDynamicLayer.addChild(waterCausticsGfx);
    }

    // 1D. Tactical Isometric Ground Grid & Walkability/FoV overlay (only runs when active!)
    if (showTacticalGrid || this.bufferMode === 'walkability_fov') {
      for (let ry = 0; ry < rotH; ry++) {
        for (let rx = 0; rx < rotW; rx++) {
          const worldCoord = toWorldGrid(rx, ry, mapW, mapH, this.rotation);
          const cell = this.game.map.tiles[worldCoord.y][worldCoord.x];
          const scr = gridToScreen(rx + 0.5, ry + 0.5, cell.z);
          if (scr.x < minLocalX || scr.x > maxLocalX || scr.y < minLocalY || scr.y > maxLocalY) {
            continue;
          }

          if (showTacticalGrid) {
            const vis = this.game.fov.getVisibility(cell.x, cell.y);
            if (!this.game.fogOfWarEnabled || vis !== 'unexplored') {
              const cellIdx = cell.y * mapW + cell.x;
              const walkOk = this.game.isTileWalkable(cell.x, cell.y, this.game.player.id);
              const isPlayerTile =
                cell.x === this.game.player.tileX && cell.y === this.game.player.tileY;
              const hasHostileEnemy = this.combatEnemyTileSet.has(cellIdx);

              if (walkOk || isPlayerTile || hasHostileEnemy) {
                const poly = this.scratchCombatPoly;
                poly[0] = scr.x;
                poly[1] = scr.y - TILE_HEIGHT * 0.5;
                poly[2] = scr.x + TILE_WIDTH * 0.5;
                poly[3] = scr.y;
                poly[4] = scr.x;
                poly[5] = scr.y + TILE_HEIGHT * 0.5;
                poly[6] = scr.x - TILE_WIDTH * 0.5;
                poly[7] = scr.y;

                if (hasHostileEnemy) {
                  this.cursorAndPathGraphics
                    .poly(poly)
                    .fill({ color: 0xff453a, alpha: 0.08 })
                    .stroke({ color: 0xff453a, width: 1.35, alpha: 0.48 });
                } else if (isPlayerCombatTurn && walkOk && this.cachedCombatReachSet.has(cellIdx)) {
                  this.cursorAndPathGraphics
                    .poly(poly)
                    .fill({ color: 0x4deeea, alpha: 0.055 })
                    .stroke({ color: 0x4deeea, width: 1.35, alpha: 0.48 });
                } else {
                  this.cursorAndPathGraphics
                    .poly(poly)
                    .stroke({ color: 0xdccaa4, width: 1.05, alpha: 0.30 });
                }
              }
            }
          }

          if (this.bufferMode === 'walkability_fov') {
            const walkOk = this.game.isTileWalkable(cell.x, cell.y);
            const vis = this.game.fov.getVisibility(cell.x, cell.y);
            const color = !walkOk
              ? 0xff3b30
              : vis === 'visible'
                ? 0x30d158
                : vis === 'explored'
                  ? 0x0a84ff
                  : 0x5e5ce6;
            this.cursorAndPathGraphics
              .poly([
                scr.x,
                scr.y - TILE_HEIGHT * 0.45,
                scr.x + TILE_WIDTH * 0.45,
                scr.y,
                scr.x,
                scr.y + TILE_HEIGHT * 0.45,
                scr.x - TILE_WIDTH * 0.45,
                scr.y
              ])
              .fill({ color, alpha: 0.28 })
              .stroke({ color, width: 1.2, alpha: 0.75 });
          }
        }
      }
    }

    // 1D. Stealth Mode: Enemy Vision Cones & Player Shadow Ring (BG3/DOS2 style)
    if (this.game.isStealthActive && !this.game.combatState.active) {
      const pRot = toRotatedContinuous(
        this.game.player.x,
        this.game.player.y,
        mapW,
        mapH,
        this.rotation
      );
      const pScr = gridToScreen(pRot.rx, pRot.ry, this.game.player.z);
      this.cursorAndPathGraphics
        .ellipse(pScr.x, pScr.y, 26, 13)
        .fill({ color: 0x312e81, alpha: 0.34 })
        .stroke({ color: 0x818cf8, width: 1.5, alpha: 0.78 });

      const halfAngle = (48 * Math.PI) / 180;
      const arcSteps = 7;
      for (const npc of this.game.npcs) {
        if (!npc.combat?.isHostile || !npc.combat.isAlive) continue;
        const coneRange = Math.min(5.5, (npc.combat.aggroRadius || 3.5) + 1.5);
        const fwd = direction8ToVector(npc.direction);
        const baseAngle = Math.atan2(fwd.y, fwd.x);
        const originRot = toRotatedContinuous(npc.x, npc.y, mapW, mapH, this.rotation);
        const originScr = gridToScreen(originRot.rx, originRot.ry, npc.z);

        const polyPts: number[] = [originScr.x, originScr.y];
        for (let i = 0; i <= arcSteps; i++) {
          const a = baseAngle - halfAngle + (2 * halfAngle * i) / arcSteps;
          const wx = npc.x + Math.cos(a) * coneRange;
          const wy = npc.y + Math.sin(a) * coneRange;
          const ptRot = toRotatedContinuous(wx, wy, mapW, mapH, this.rotation);
          const ptScr = gridToScreen(ptRot.rx, ptRot.ry, npc.z);
          polyPts.push(ptScr.x, ptScr.y);
        }

        this.cursorAndPathGraphics
          .poly(polyPts)
          .fill({ color: 0xef4444, alpha: 0.22 })
          .stroke({ color: 0xf87171, width: 1.4, alpha: 0.62 });
      }
    }

    // 2. Render Hovered Tile Highlight & Active Player A* Path Preview
    if (this.hoveredWorldTile) {
      const { x: hx, y: hy, z: hz } = this.hoveredWorldTile;
      const rotHover = toRotatedGrid(hx, hy, mapW, mapH, this.rotation);
      const hScr = gridToScreen(rotHover.rx + 0.5, rotHover.ry + 0.5, hz);
      const propHover = this.game.getPropAtTile(hx, hy);
      const npcHover = this.game.npcs.find(
        (n) => n.tileX === hx && n.tileY === hy && (!n.combat || n.combat.isAlive)
      );

      const highlightColor =
        npcHover?.combat?.isHostile
          ? 0xff453a
          : npcHover || (propHover && propHover.interactive)
            ? 0xf5c451
            : this.game.isTileWalkable(hx, hy)
              ? 0x4deeea
              : 0xff453a;

      const useDiamondHover =
        this.game.combatState.active ||
        this.activeTool !== 'interact' ||
        this.showGridInExploration ||
        this.bufferMode === 'walkability_fov';

      if (useDiamondHover) {
        this.cursorAndPathGraphics
          .poly([
            hScr.x,
            hScr.y - TILE_HEIGHT * 0.5,
            hScr.x + TILE_WIDTH * 0.5,
            hScr.y,
            hScr.x,
            hScr.y + TILE_HEIGHT * 0.5,
            hScr.x - TILE_WIDTH * 0.5,
            hScr.y
          ])
          .fill({ color: highlightColor, alpha: 0.18 })
          .stroke({ color: highlightColor, width: 2.2, alpha: 0.92 });
      } else {
        // Organic circular/elliptical ground reticle during exploration (no blocky grid diamond)
        const pulse = 1.0 + Math.sin(this.elapsedSeconds * 5.0) * 0.06;
        this.cursorAndPathGraphics
          .ellipse(hScr.x, hScr.y, 26 * pulse, 13 * pulse)
          .fill({ color: highlightColor, alpha: 0.10 })
          .stroke({ color: highlightColor, width: 1.8, alpha: 0.72 })
          .ellipse(hScr.x, hScr.y, 11, 5.5)
          .stroke({ color: highlightColor, width: 1.1, alpha: 0.45 });
      }

      // Preview A* path if in interact mode and hovering walkable tile
      if (this.activeTool === 'interact' && this.game.isTileWalkable(hx, hy)) {
        let previewPath: PathStepNode[];
        if (this.game.player.path.length > 0) {
          previewPath = this.game.player.path;
        } else {
          const hoverKey = `${this.game.map.id}:${this.game.map.props.length}:${this.game.player.tileX},${this.game.player.tileY}->${hx},${hy}`;
          if (hoverKey !== this.cachedHoverPathKey) {
            this.cachedHoverPathKey = hoverKey;
            this.cachedHoverPath = findPathAStar3D(
              {
                width: mapW,
                height: mapH,
                isWalkable: (tx, ty) => this.game.isTileWalkable(tx, ty, this.game.player.id),
                getElevation: (tx, ty) => this.game.map.tiles[ty][tx].z
              },
              { x: this.game.player.tileX, y: this.game.player.tileY },
              { x: hx, y: hy }
            ).slice(1);
          }
          previewPath = this.cachedHoverPath;
        }

        const apPerStep =
          this.game.player.combat && this.game.player.combat.crippledLegsTurns > 0 ? 2 : 1;
        const availAp = this.game.player.combat?.ap ?? 99;

        for (let i = 0; i < previewPath.length; i++) {
          const step = previewPath[i];
          const rStep = toRotatedGrid(step.x, step.y, mapW, mapH, this.rotation);
          const sPt = gridToScreen(rStep.rx + 0.5, rStep.ry + 0.5, step.z);
          const stepCost = (i + 1) * apPerStep;
          const canAfford = !this.game.combatState.active || stepCost <= availAp;
          this.cursorAndPathGraphics
            .circle(sPt.x, sPt.y, 5)
            .fill({ color: canAfford ? 0x4deeea : 0xff453a, alpha: 0.82 });
        }

        if (this.game.combatState.active && previewPath.length > 0) {
          const totalApCost = previewPath.length * apPerStep;
          const canAfford = totalApCost <= availAp;
          const apLabel = this.displayPool.text(
            `👣 Ruch: ${totalApCost} AP`,
            canAfford ? 'ap_ok' : 'ap_low',
            () => ({
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: '700',
              fill: canAfford ? 0x4deeea : 0xff5252,
              stroke: { color: 0x06080c, width: 3.2 }
            })
          );
          apLabel.anchor.set(0.5, 1);
          apLabel.position.set(hScr.x, hScr.y - 16);
          this.debugOverlayContainer.addChild(apLabel);
        }
      }
    }

    // 2b. Highlight exit_path travel zones directly on the ground across the entire exit footprint
    if (this.bufferMode !== 'depth_dag') {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedSeconds * 3.4);
      for (const prop of this.game.map.props) {
        if (prop.kind !== 'exit_path') continue;
        const fp = rotateFootprint(prop.x, prop.y, prop.sizeX, prop.sizeY, mapW, mapH, this.rotation);

        // Soft antique-amber travel threshold beneath the painterly gateway (no harsh wireframe box)
        const gateCenter = gridToScreen(
          fp.rx + fp.width * 0.5,
          fp.ry + fp.height * 0.5,
          prop.z
        );
        this.cursorAndPathGraphics
          .ellipse(
            gateCenter.x,
            gateCenter.y,
            Math.max(38, fp.width * 28),
            Math.max(19, fp.height * 16)
          )
          .fill({ color: 0xc89a45, alpha: 0.07 + 0.04 * pulse })
          .stroke({ color: 0xd4a957, width: 1.2, alpha: 0.24 + 0.14 * pulse });

        // Subtle pulsing waypoint stepping rings on exit tiles
        for (let dy = 0; dy < fp.height; dy++) {
          for (let dx = 0; dx < fp.width; dx++) {
            const c = gridToScreen(fp.rx + dx + 0.5, fp.ry + dy + 0.5, prop.z);
            this.cursorAndPathGraphics
              .ellipse(c.x, c.y, 14 + pulse * 3.0, 7 + pulse * 1.5)
              .stroke({ color: 0xe2c275, width: 1.0, alpha: 0.2 + 0.14 * pulse });
          }
        }
      }
    }

    // 3. Build 3D Bounding Boxes for Props and Characters & Run Topological DAG Sorter
    type RenderableNode = DepthBox3D & {
      kind: 'prop' | 'actor';
      render: (orderIndex: number, totalCount: number, playerBox: DepthBox3D) => void;
    };

    const playerRot = toRotatedContinuous(
      this.game.player.x,
      this.game.player.y,
      mapW,
      mapH,
      this.rotation
    );
    const playerDepthBox: DepthBox3D = {
      id: this.game.player.id,
      rxMin: playerRot.rx - 0.32,
      rxMax: playerRot.rx + 0.32,
      ryMin: playerRot.ry - 0.32,
      ryMax: playerRot.ry + 0.32,
      zMin: this.game.player.z,
      zMax: this.game.player.z + 1.9
    };

    const renderables: RenderableNode[] = [];
    const worldLabelBounds: LabelRect[] = [];
    const batchedHpBarsGfx = this.displayPool.graphics();
    let hasBatchedHpBars = false;

    for (const prop of this.game.map.props) {
      const vis = this.game.fov.getVisibility(prop.x, prop.y);
      if (vis === 'unexplored' && this.game.fogOfWarEnabled && this.bufferMode === 'final_pbr') {
        continue;
      }

      const fp = rotateFootprint(
        prop.x,
        prop.y,
        prop.sizeX,
        prop.sizeY,
        mapW,
        mapH,
        this.rotation
      );

      const vt = resolvePropVisualTransform(prop);
      const scr = vt.centerOnFootprint
        ? gridToScreen(fp.rx + fp.width * 0.5, fp.ry + fp.height * 0.5, prop.z)
        : gridToScreen(fp.rx + 0.5, fp.ry + 0.5, prop.z);
      if (
        scr.x < minLocalX - 500 ||
        scr.x > maxLocalX + 500 ||
        scr.y < minLocalY - 600 ||
        scr.y > maxLocalY + 500
      ) {
        continue;
      }

      renderables.push({
        id: prop.id,
        kind: 'prop',
        rxMin: fp.rx + 0.05,
        rxMax: fp.rx + fp.width - 0.05,
        ryMin: fp.ry + 0.05,
        ryMax: fp.ry + fp.height - 0.05,
        zMin: prop.z,
        zMax: prop.z + prop.heightZ,
        occludesVision: prop.blocksSight && (!prop.isOpen || prop.kind !== 'door'),
        render: (orderIndex, totalCount, pBox) => {
          const texPair = this.getPropTexturePair(
            prop.kind,
            Boolean(prop.isOpen),
            fp.width,
            fp.height,
            prop.variant ?? ((prop.x * 7 + prop.y * 13) % 9),
            prop.id
          );

          // Grounding Ambient Occlusion (AO) & Directional Penumbra Shadow for solid props
          if (this.bufferMode === 'final_pbr') {
            const isFloraOrNonSolid =
              prop.kind === 'wildflower_patch' ||
              prop.kind === 'ground_loot' ||
              prop.kind === 'exit_path';

            if (!isFloraOrNonSolid) {
              const baseRx = Math.max(16, (fp.width + fp.height) * 14 * vt.aoScale);
              const baseRy = Math.max(8, (fp.width + fp.height) * 7 * vt.aoScale);

              const aoGfx = this.groundShadowsGraphics;
              // Dense inner contact AO anchoring prop to ground
              aoGfx
                .ellipse(scr.x, scr.y, baseRx * 0.72, baseRy * 0.72)
                .fill({ color: 0x010204, alpha: 0.16 });
              // Soft feathered outer ambient occlusion
              aoGfx
                .ellipse(scr.x, scr.y, baseRx, baseRy)
                .fill({ color: 0x030508, alpha: 0.06 });

              // Directional penumbra cast shadow for tall structures
              const isTall =
                prop.kind === 'pine_tree' ||
                prop.kind === 'ancient_oak' ||
                prop.kind === 'pillar' ||
                prop.kind === 'dungeon_column' ||
                prop.kind === 'dungeon_support' ||
                prop.kind === 'dead_tree' ||
                prop.kind === 'watchtower' ||
                prop.kind === 'rock_cliff' ||
                prop.kind === 'slavic_cottage' ||
                prop.kind === 'wall_block';

              if (isTall) {
                let sdx = -16;
                let sdy = 8;
                if (screenLights.length > 0) {
                  let nearest = screenLights[0];
                  let bestD = Infinity;
                  for (const l of screenLights) {
                    const d = Math.hypot(scr.x - l.screenX, scr.y - l.screenY);
                    if (d < bestD) {
                      bestD = d;
                      nearest = l;
                    }
                  }
                  const dx = scr.x - nearest.screenX;
                  const dy = scr.y - nearest.screenY;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  sdx = (dx / len) * 26;
                  sdy = (dy / len) * 13;
                }
                aoGfx
                  .ellipse(scr.x + sdx * 0.65, scr.y + sdy * 0.65, baseRx * 1.08, baseRy * 1.08)
                  .fill({ color: 0x020406, alpha: 0.14 });
              }
            }
          }

          const sp = this.displayPool.sprite(useNormalTex ? texPair.normalMat : texPair.albedo);
          sp.anchor.set(texPair.anchorX, texPair.anchorY);
          const windSkew = computeWindSwaySkew(
            prop.kind,
            prop.x,
            prop.y,
            this.elapsedSeconds,
            this.reducedMotion
          );
          const arcanePulse = computeArcanePulseScale(
            prop.kind,
            prop.x,
            prop.y,
            this.elapsedSeconds,
            this.reducedMotion
          );
          const reactionState = this.propReactions.get(prop.id);
          const reactionTx = reactionState
            ? computePropReactionTransform(
                reactionState.kind,
                reactionState.life / Math.max(0.01, reactionState.maxLife),
                this.reducedMotion
              )
            : null;
          const mirrorSign = texPair.allowMirrorX && ((prop.variant ?? 0) & 1) === 1 ? -1 : 1;
          const finalScaleX =
            vt.scaleX * mirrorSign * arcanePulse.scale * (reactionTx ? reactionTx.scaleX : 1);
          const finalScaleY =
            vt.scaleY * arcanePulse.scale * (reactionTx ? reactionTx.scaleY : 1);
          sp.position.set(scr.x, scr.y + vt.offsetY + (reactionTx ? reactionTx.offsetY : 0));
          if (finalScaleX !== 1 || finalScaleY !== 1) {
            sp.scale.set(finalScaleX, finalScaleY);
          }
          const totalSkewX = windSkew + (reactionTx ? reactionTx.skewX : 0);
          if (totalSkewX !== 0) {
            sp.skew.x = totalSkewX;
          }
          if (arcanePulse.glowAlpha > 0 && this.bufferMode === 'final_pbr') {
            const glowGfx = this.displayPool.graphics();
            glowGfx
              .ellipse(scr.x, scr.y - 8, 22 * arcanePulse.scale, 11 * arcanePulse.scale)
              .fill({ color: 0x38bdf8, alpha: arcanePulse.glowAlpha * 0.45 });
            this.sortedObjectLayer.addChild(glowGfx);
          }

          // Apply X-Ray Wall Cutaway if wall occludes the player character!
          const selfBox: DepthBox3D = {
            id: prop.id,
            rxMin: fp.rx,
            rxMax: fp.rx + fp.width,
            ryMin: fp.ry,
            ryMax: fp.ry + fp.height,
            zMin: prop.z,
            zMax: prop.z + prop.heightZ,
            occludesVision: prop.blocksSight && (!prop.isOpen || prop.kind !== 'door')
          };

          if (this.game.wallCutawayEnabled && shouldApplyWallCutaway(selfBox, pBox)) {
            sp.alpha = 0.34;
          }

          const fovFactor = this.game.fogOfWarEnabled
            ? this.game.fov.getLightFactor(prop.x, prop.y)
            : 1.0;
          if (this.bufferMode === 'depth_dag') {
            const t = orderIndex / Math.max(1, totalCount - 1);
            const r = Math.round(45 + t * 210);
            const g = Math.round(190 - Math.abs(t - 0.5) * 140);
            const b = Math.round(245 - t * 200);
            sp.tint = (r << 16) | (g << 8) | b;
          } else {
            let propTint = this.computeRgbTintForScreenPoint(
              scr.x,
              scr.y - 24,
              0.25,
              -0.35,
              0.45,
              0.3,
              fovFactor,
              screenLights
            );
            // Harmonize bright Kenney wood props ONLY when they do not use a custom painterly sprite
            const hasPainterlySprite = Boolean(
              resolveCustomPropSprite({
                id: prop.id,
                kind: prop.kind,
                isOpen: Boolean(prop.isOpen)
              })
            );
            if (
              !hasPainterlySprite &&
              (prop.kind === 'dungeon_crate' ||
                prop.kind === 'dungeon_barrel' ||
                prop.kind === 'dungeon_table' ||
                prop.kind === 'dungeon_support')
            ) {
              const tr = Math.round(((propTint >> 16) & 0xff) * 0.64);
              const tg = Math.round(((propTint >> 8) & 0xff) * 0.58);
              const tb = Math.round((propTint & 0xff) * 0.52);
              propTint = (tr << 16) | (tg << 8) | tb;
            }
            sp.tint = propTint;
          }

          this.sortedObjectLayer.addChild(sp);

          // Live animated painterly flame & warm ember glow on active campfire & torches
          if (
            this.bufferMode === 'final_pbr' &&
            (prop.isOpen || prop.kind === 'campfire') &&
            (prop.kind === 'campfire' || prop.kind === 'torch_sconce')
          ) {
            const isCampfire = prop.kind === 'campfire';
            const flameBaseY = isCampfire ? scr.y - 6 : scr.y - 52;
            const flameRadius = isCampfire ? 10.5 : 6.0;
            const phase = prop.x * 1.7 + prop.y * 2.3;
            const t = this.reducedMotion ? 0 : this.elapsedSeconds;
            const flicker1 = Math.sin(t * 9.5 + phase) * 2.6;
            const flicker2 = Math.cos(t * 13.0 + phase * 1.4) * 2.1;
            const pulse = 0.88 + 0.12 * Math.sin(t * 7.2 + phase);

            const flameGfx = this.displayPool.graphics();
            // Soft warm radial ember halo grounded over the logs
            flameGfx
              .ellipse(
                scr.x,
                flameBaseY + (isCampfire ? 2 : 0),
                flameRadius * 2.1 * pulse,
                flameRadius * (isCampfire ? 1.05 : 0.9) * pulse
              )
              .fill({ color: 0xff6d00, alpha: 0.16 * pulse });

            if (prop.isOpen || !isCampfire) {
              // Outer organic flame tongue (quadratic curves instead of sharp triangles)
              flameGfx
                .moveTo(scr.x - flameRadius * 0.95, flameBaseY)
                .quadraticCurveTo(
                  scr.x - flameRadius * 0.65,
                  flameBaseY - flameRadius * 1.35,
                  scr.x + flicker1,
                  flameBaseY - flameRadius * 2.15 * pulse
                )
                .quadraticCurveTo(
                  scr.x + flameRadius * 0.65,
                  flameBaseY - flameRadius * 1.35,
                  scr.x + flameRadius * 0.95,
                  flameBaseY
                )
                .closePath()
                .fill({ color: 0xea580c, alpha: 0.68 })
                // Warm golden inner flame
                .moveTo(scr.x - flameRadius * 0.55, flameBaseY)
                .quadraticCurveTo(
                  scr.x - flameRadius * 0.35,
                  flameBaseY - flameRadius * 0.95,
                  scr.x - flicker2 * 0.8,
                  flameBaseY - flameRadius * 1.55 * pulse
                )
                .quadraticCurveTo(
                  scr.x + flameRadius * 0.35,
                  flameBaseY - flameRadius * 0.95,
                  scr.x + flameRadius * 0.55,
                  flameBaseY
                )
                .closePath()
                .fill({ color: 0xfef08a, alpha: 0.84 });
            } else {
              // Subtle smoldering ember flicker on idle painted campfire
              flameGfx
                .ellipse(scr.x + flicker2 * 0.25, flameBaseY - 1, flameRadius * 0.72 * pulse, flameRadius * 0.36 * pulse)
                .fill({ color: 0xff9800, alpha: 0.26 * pulse });
            }
            this.sortedObjectLayer.addChild(flameGfx);
          }

          const isPropHovered =
            this.hoveredWorldTile &&
            this.hoveredWorldTile.x >= prop.x &&
            this.hoveredWorldTile.x < prop.x + prop.sizeX &&
            this.hoveredWorldTile.y >= prop.y &&
            this.hoveredWorldTile.y < prop.y + prop.sizeY;

          const showInteractiveHint =
            isPropHovered ||
            prop.kind === 'campfire' ||
            prop.kind === 'exit_path' ||
            prop.kind === 'travel_signpost' ||
            (prop.kind === 'market_stall' && !prop.isOpen) ||
            (prop.kind === 'ground_loot' && !prop.isOpen) ||
            (this.isHighlightAltHeld &&
              (prop.interactive ||
                prop.kind === 'chest' ||
                prop.kind === 'slavic_well' ||
                prop.kind === 'door' ||
                prop.kind === 'market_stall' ||
                prop.kind === 'wildflower_patch' ||
                prop.kind === 'berry_bush'));

          if (showInteractiveHint && this.bufferMode !== 'depth_dag') {
            if (prop.kind === 'travel_signpost' && isPropHovered) {
              const dest = resolveTravelSignpostDestination(prop.id, this.game.map.id);
              const textStr = `🧭 Transport do:\n${dest.label}`;
              const label = this.displayPool.text(textStr, 'prop_transport_hover', () => ({
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: '700',
                align: 'center',
                fill: 0xfde68a,
                stroke: { color: 0x06080c, width: 3.5 }
              }));
              label.anchor.set(0.5, 1);
              const labelY = scr.y - 60;
              label.position.set(scr.x, labelY);

              const padX = 10;
              const padY = 6;
              const boxW = Math.max(170, label.width + padX * 2);
              const boxH = label.height + padY * 2;
              const pill = this.displayPool.graphics();
              pill
                .roundRect(scr.x - boxW * 0.5, labelY - label.height - padY, boxW, boxH, 6)
                .fill({ color: 0x0a0e16, alpha: 0.94 })
                .stroke({ color: 0xe5bd68, width: 1.6, alpha: 0.95 });
              pill.zIndex = 900;
              label.zIndex = 901;
              this.debugOverlayContainer.sortableChildren = true;
              this.debugOverlayContainer.addChild(pill);
              this.debugOverlayContainer.addChild(label);
            } else {
              const styleKey =
                prop.kind === 'campfire'
                  ? 'prop_campfire'
                  : prop.kind === 'exit_path'
                    ? 'prop_exit'
                    : 'prop_default';
              const label = this.displayPool.text(prop.name, styleKey, () => ({
                fontFamily: 'Inter, sans-serif',
                fontSize: prop.kind === 'exit_path' ? 13 : 11,
                fontWeight: prop.kind === 'exit_path' ? '700' : '600',
                fill:
                  prop.kind === 'campfire'
                    ? 0xffb74d
                    : prop.kind === 'exit_path'
                      ? 0xffe082
                      : 0xffe082,
                stroke: { color: 0x06080c, width: prop.kind === 'exit_path' ? 4.0 : 3.2 }
              }));
              label.anchor.set(0.5, 1);
              let baseLabelX = scr.x;
              let baseLabelY = scr.y;
              let propCandidates: Array<{ x: number; y: number }>;
              if (prop.kind === 'exit_path') {
                const centerScr = gridToScreen(
                  fp.rx + fp.width * 0.5,
                  fp.ry + fp.height * 0.5,
                  prop.z
                );
                baseLabelX = centerScr.x;
                baseLabelY = centerScr.y;
                propCandidates = [
                  { x: 0, y: -84 },
                  { x: 0, y: -106 },
                  { x: 0, y: -128 }
                ];
              } else if (prop.kind === 'campfire') {
                propCandidates = [
                  { x: 0, y: -42 },
                  { x: 0, y: -64 },
                  { x: 26, y: -42 },
                  { x: -26, y: -42 },
                  { x: 0, y: -86 }
                ];
              } else {
                const y0 = prop.kind === 'ground_loot' ? -28 : -54;
                propCandidates = [
                  { x: 0, y: y0 },
                  { x: 0, y: y0 - 22 },
                  { x: 0, y: y0 - 44 }
                ];
              }
              const placedPos = resolveNonOverlappingLabelPosition(
                baseLabelX,
                baseLabelY,
                label.width,
                label.height,
                propCandidates,
                worldLabelBounds
              );
              label.position.set(placedPos.x, placedPos.y);
              this.debugOverlayContainer.addChild(label);
            }
          }

          if (this.bufferMode === 'depth_dag') {
            const badge = this.displayPool.text(`#${orderIndex}`, 'dag_badge', () => ({
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fill: 0xffffff,
              stroke: { color: 0x000000, width: 3 }
            }));
            badge.anchor.set(0.5);
            badge.position.set(scr.x, scr.y - 36);
            this.debugOverlayContainer.addChild(badge);
          }
        }
      });
    }

    const allActors: ActorEntity[] = [this.game.player, ...this.game.npcs];
    for (const actor of allActors) {
      const isDead = Boolean((actor.combat && !actor.combat.isAlive) || actor.isFallenCorpse);
      const isPlayer = actor.id === this.game.player.id;
      const vis = this.game.fov.getVisibility(actor.tileX, actor.tileY);
      if (
        !isPlayer &&
        vis !== 'visible' &&
        this.game.fogOfWarEnabled &&
        this.bufferMode === 'final_pbr'
      ) {
        continue;
      }

      const rotPos = toRotatedContinuous(actor.x, actor.y, mapW, mapH, this.rotation);
      const scr = gridToScreen(rotPos.rx, rotPos.ry, actor.z);
      if (
        !isPlayer &&
        (scr.x < minLocalX - 120 ||
          scr.x > maxLocalX + 120 ||
          scr.y < minLocalY - 180 ||
          scr.y > maxLocalY + 120)
      ) {
        continue;
      }

      renderables.push({
        id: actor.id,
        kind: 'actor',
        rxMin: rotPos.rx - 0.32,
        rxMax: rotPos.rx + 0.32,
        ryMin: rotPos.ry - 0.32,
        ryMax: rotPos.ry + 0.32,
        zMin: actor.z,
        zMax: isDead ? actor.z + 0.25 : actor.z + 1.9,
        render: (orderIndex, totalCount) => {
          let actorScrX = scr.x;
          let actorScrY = scr.y;
          let groundScrX = scr.x;
          let groundScrY = scr.y;
          let actorRotation = 0;
          let actorScaleX = 1.0;
          let actorScaleY = 1.0;
          let bloodPoolScale = 1.0;
          let dodgeGhostAlpha = 0;
          const baseScrX = scr.x;
          const baseScrY = scr.y;
          const isHovering = isHoveringActor(actor.id, actor.recipe.name);
          const telegraphedIntent =
            !isDead && this.game.combatState.active && !isPlayer && actor.combat?.isHostile
              ? (this.getTelegraphedIntent?.(actor.id) ?? null)
              : null;

          if (isDead) {
            const collapseElapsed = this.deathCollapseTimers.get(actor.id) ?? DEATH_COLLAPSE_DURATION_SEC;
            const collapsePose = computeDeathCollapsePose(
              collapseElapsed / DEATH_COLLAPSE_DURATION_SEC,
              this.reducedMotion
            );
            actorScrY += collapsePose.offsetY;
            actorScaleY = collapsePose.scaleY;
            actorRotation = collapsePose.rotation;
            bloodPoolScale = collapsePose.bloodPoolScale;
          } else {
            const isMoving = Boolean(actor.isMoving && actor.path && actor.path.length > 0);
            const isStealth = actor.id === this.game.player.id && this.game.isStealthActive;
            if (isHovering) {
              const hover = computeHoverFloatTransform(
                actor.id,
                this.elapsedSeconds,
                isMoving,
                this.reducedMotion
              );
              actorScrY += hover.offsetY;
              actorScaleX = hover.scaleX;
              actorScaleY = hover.scaleY;
              actorRotation = hover.rotation;
            } else if (isMoving) {
              const stride = computeWalkStrideTransform(
                actor.animTimer,
                isStealth,
                this.reducedMotion
              );
              actorScrY += stride.offsetY;
              actorScaleX = stride.scaleX;
              actorScaleY = stride.scaleY;
              actorRotation = stride.rotation;
            } else {
              const breath = computeIdleBreathingTransform(
                actor.id,
                this.elapsedSeconds,
                this.game.combatState.active,
                false,
                isStealth,
                this.reducedMotion
              );
              actorScrY += breath.offsetY;
              actorScaleX = breath.scaleX;
              actorScaleY = breath.scaleY;
            }

            // Braced guard stance when actor is actively defending (Garda)
            if (actor.combat?.defending) {
              actorScaleX *= 1.04;
              actorScaleY *= 0.96;
              actorScrY += 1.2;
            }

            // Boss / elite telegraph anticipation posture (coiled cleave / swelling howl)
            if (telegraphedIntent) {
              const tPose = computeTelegraphAnticipationPose(
                telegraphedIntent,
                this.elapsedSeconds,
                this.reducedMotion
              );
              actorScrX += tPose.offsetX;
              actorScrY += tPose.offsetY;
              actorScaleX *= tPose.scaleX;
              actorScaleY *= tPose.scaleY;
              actorRotation += tPose.rotation;
            }

            // NPC aggro alert startle-hop when spotting the player
            if (
              !this.reducedMotion &&
              !isPlayer &&
              actor.aggroReactionTimer !== undefined &&
              actor.aggroReactionTimer > 0.42
            ) {
              const hopProgress = (0.65 - actor.aggroReactionTimer) / 0.23;
              const hop = Math.sin(Math.max(0, Math.min(1, hopProgress)) * Math.PI);
              actorScrY -= hop * 5.2;
              actorScaleY *= 1 + hop * 0.07;
              actorScaleX *= 1 - hop * 0.04;
            }

            // Subtle fear tremble when afflicted by 'strach'
            const statuses = this.getActorStatuses?.(actor.id);
            if (statuses && statuses.includes('strach')) {
              actorScrX += computeFearTrembleOffset(
                actor.id,
                this.elapsedSeconds,
                this.reducedMotion
              );
            }

            // Dodge sidestep + afterimage ghost (moves both body and ground shadow)
            const dodgeState = this.dodgeTimers.get(actor.id);
            if (dodgeState) {
              const dodgeOff = computeDodgeGhostOffset(
                dodgeState.life / Math.max(0.01, dodgeState.maxLife),
                dodgeState.dirX,
                dodgeState.dirY,
                this.reducedMotion
              );
              actorScrX += dodgeOff.offsetX;
              actorScrY += dodgeOff.offsetY;
              groundScrX += dodgeOff.offsetX;
              groundScrY += dodgeOff.offsetY;
              dodgeGhostAlpha = dodgeOff.ghostAlpha;
            }

            // Asymmetric Attack Lunge animation (wind-up -> explosive snap -> recovery)
            if (actor.attackAnimTimer && actor.attackAnimTimer > 0) {
              const maxT = actor.attackAnimMaxTimer || 0.22;
              const progress = 1 - Math.max(0, actor.attackAnimTimer) / maxT;
              const lunge = computeAttackLungeTransform(progress, this.reducedMotion);
              const lungeDist = lunge.distFactor * 16;
              const targetWorldX = actor.attackTargetX ?? actor.x;
              const targetWorldY = actor.attackTargetY ?? actor.y;
              const rotTarget = toRotatedContinuous(targetWorldX, targetWorldY, mapW, mapH, this.rotation);
              const scrTarget = gridToScreen(rotTarget.rx, rotTarget.ry, actor.z);
              const dx = scrTarget.x - scr.x;
              const dy = scrTarget.y - scr.y;
              const len = Math.hypot(dx, dy) || 1;
              const offX = (dx / len) * lungeDist;
              const offY = (dy / len) * lungeDist;
              actorScrX += offX;
              actorScrY += offY;
              groundScrX += offX;
              groundScrY += offY;
              actorScaleX *= lunge.scaleX;
              actorScaleY *= lunge.scaleY;
              actorRotation = (dx >= 0 ? 1 : -1) * lunge.leanRad;
            }

            // Crisp Hit Recoil animation (instant knockback impulse + cushioned recovery)
            if (actor.hitRecoilTimer && actor.hitRecoilTimer > 0) {
              const maxT = actor.hitRecoilMaxTimer || 0.18;
              const progress = 1 - Math.max(0, actor.hitRecoilTimer) / maxT;
              const recoil = computeHitRecoilTransform(progress, this.reducedMotion);
              const recoilDist = recoil.distFactor * 12;
              const fromWorldX = actor.hitFromX ?? actor.x;
              const fromWorldY = actor.hitFromY ?? actor.y;
              const rotFrom = toRotatedContinuous(fromWorldX, fromWorldY, mapW, mapH, this.rotation);
              const scrFrom = gridToScreen(rotFrom.rx, rotFrom.ry, actor.z);
              const rx = scr.x - scrFrom.x;
              const ry = scr.y - scrFrom.y;
              const rlen = Math.hypot(rx, ry) || 1;
              const offX = (rx / rlen) * recoilDist;
              const offY = (ry / rlen) * recoilDist;
              actorScrX += offX;
              actorScrY += offY;
              groundScrX += offX;
              groundScrY += offY;
              actorScaleX *= recoil.scaleX;
              actorScaleY *= recoil.scaleY;
              actorRotation = (rx >= 0 ? 1 : -1) * recoil.leanRad;
            }
          }

          // Render Dual-Layer Cast Shadow / Blood Pool / Combat Circle (batched in groundShadowsGraphics)
          if (this.bufferMode === 'final_pbr') {
            const shadowGfx = this.groundShadowsGraphics;
            if (isDead) {
              // Expanding deep blood pool beneath fallen corpse
              shadowGfx
                .ellipse(groundScrX, groundScrY + 1, 22 * bloodPoolScale, 11 * bloodPoolScale)
                .fill({ color: 0x3d0808, alpha: 0.85 * bloodPoolScale });
              shadowGfx
                .ellipse(groundScrX + 2, groundScrY + 2, 12 * bloodPoolScale, 6 * bloodPoolScale)
                .fill({ color: 0x1a0303, alpha: 0.95 * bloodPoolScale });
            } else {
              const verticalLiftPx = Math.max(0, groundScrY - actorScrY);
              const shadowAirScale = Math.max(0.76, 1 - verticalLiftPx * 0.028);
              let shadowOffsetX = -8;
              let shadowOffsetY = 4;
              if (screenLights.length > 0) {
                let nearest = screenLights[0];
                let bestD = Infinity;
                for (const l of screenLights) {
                  const d = Math.hypot(groundScrX - l.screenX, groundScrY - l.screenY);
                  if (d < bestD) {
                    bestD = d;
                    nearest = l;
                  }
                }
                const dx = groundScrX - nearest.screenX;
                const dy = groundScrY - nearest.screenY;
                const len = Math.max(1, Math.hypot(dx, dy));
                shadowOffsetX = (dx / len) * 14;
                shadowOffsetY = (dy / len) * 7;
              }

              // Layer 1: Dense tight contact shadow directly beneath feet (scales subtly with jump/hover height)
              shadowGfx
                .ellipse(groundScrX, groundScrY + 1, 13 * shadowAirScale, 6.5 * shadowAirScale)
                .fill({ color: 0x010204, alpha: 0.44 * shadowAirScale });
              // Layer 2: Directional penumbra cast shadow away from light
              shadowGfx
                .ellipse(
                  groundScrX + shadowOffsetX * 0.55,
                  groundScrY + shadowOffsetY * 0.55,
                  20 * shadowAirScale,
                  10 * shadowAirScale
                )
                .fill({ color: 0x030509, alpha: 0.20 * shadowAirScale });

              // Tactical Combat Stance indicator ring, Selected Target Reticle & Boss Telegraph Danger Zone
              if (this.game.combatState.active) {
                const isActiveTurn = this.game.combatState.activeTurnActorId === actor.id;
                const isSelectedTarget =
                  !isPlayer &&
                  Boolean(actor.combat?.isHostile) &&
                  this.game.combatState.selectedTargetId === actor.id;
                const pulse = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.elapsedSeconds * 7.5);

                if (telegraphedIntent) {
                  // Draw pulsing crimson-amber danger diamonds on ground layer (beneath all actors & props)
                  const threatTiles = getTelegraphThreatTiles(
                    actor.tileX,
                    actor.tileY,
                    telegraphedIntent,
                    mapW,
                    mapH
                  );
                  for (const tt of threatTiles) {
                    const tileObj = this.game.map.tiles[tt.y]?.[tt.x];
                    if (!tileObj || !tileObj.walkable) continue;
                    const rotT = toRotatedContinuous(
                      tt.x + 0.5,
                      tt.y + 0.5,
                      mapW,
                      mapH,
                      this.rotation
                    );
                    const centerScr = gridToScreen(rotT.rx, rotT.ry, tileObj.z);
                    this.cursorAndPathGraphics
                      .poly([
                        centerScr.x,
                        centerScr.y - 16,
                        centerScr.x + 32,
                        centerScr.y,
                        centerScr.x,
                        centerScr.y + 16,
                        centerScr.x - 32,
                        centerScr.y
                      ])
                      .fill({ color: 0xdc2626, alpha: 0.14 + pulse * 0.14 })
                      .stroke({ color: 0xf59e0b, width: 1.5, alpha: 0.45 + pulse * 0.4 });
                  }
                  // Double pulsing danger ring beneath the telegraphing enemy
                  const warnR = 25 + pulse * 3.5;
                  shadowGfx
                    .ellipse(groundScrX, groundScrY, warnR, warnR * 0.5)
                    .stroke({ color: 0xff3b30, width: 2.8, alpha: 0.72 + pulse * 0.25 })
                    .ellipse(groundScrX, groundScrY, warnR + 4, (warnR + 4) * 0.5)
                    .stroke({ color: 0xf59e0b, width: 1.4, alpha: 0.45 + pulse * 0.4 });
                }

                const ringRadius = isActiveTurn ? 24 + Math.sin(this.elapsedSeconds * 8) * 2.2 : 21;
                const ringColor = isPlayer
                  ? 0xf5c451
                  : actor.combat?.isHostile
                    ? (actor.combat.difficulty === 'very_hard' ? 0xff453a : 0xf5c451)
                    : 0x69f0ae;
                shadowGfx
                  .ellipse(groundScrX, groundScrY, ringRadius, ringRadius * 0.5)
                  .stroke({
                    color: ringColor,
                    width: isActiveTurn ? 2.6 : 1.4,
                    alpha: isActiveTurn ? 0.96 : 0.65
                  });

                if (isSelectedTarget) {
                  const retR = 26 + pulse * 2.0;
                  shadowGfx
                    .ellipse(groundScrX, groundScrY, retR, retR * 0.5)
                    .stroke({ color: 0xf5c451, width: 2.2, alpha: 0.92 })
                    .moveTo(groundScrX - retR - 5, groundScrY)
                    .lineTo(groundScrX - retR + 3, groundScrY)
                    .moveTo(groundScrX + retR - 3, groundScrY)
                    .lineTo(groundScrX + retR + 5, groundScrY)
                    .moveTo(groundScrX, groundScrY - retR * 0.5 - 4)
                    .lineTo(groundScrX, groundScrY - retR * 0.5 + 3)
                    .moveTo(groundScrX, groundScrY + retR * 0.5 - 3)
                    .lineTo(groundScrX, groundScrY + retR * 0.5 + 4)
                    .stroke({ color: 0xff5252, width: 2.0, alpha: 0.95 });
                }
              } else if (actor.id === this.game.player.id) {
                shadowGfx
                  .ellipse(groundScrX, groundScrY, 21, 10.5)
                  .fill({ color: 0x2d6a4f, alpha: 0.1 })
                  .stroke({ color: 0x67b987, width: 1.6, alpha: 0.62 });
              } else if (actor.combat?.isHostile) {
                shadowGfx
                  .ellipse(groundScrX, groundScrY, 21, 10.5)
                  .fill({ color: 0x7f1d1d, alpha: 0.1 })
                  .stroke({ color: 0xc94a42, width: 1.6, alpha: 0.68 });
              }
            }
          }

          const charTex = this.getCharacterTextures(actor);
          const rotDir = rotateDirection8(actor.direction, this.rotation);
          const frameIdx =
            isHovering && !isDead && !this.reducedMotion
              ? Math.floor(this.elapsedSeconds * 5.2) % 4
              : actor.animFrame % 4;
          const tex = useNormalTex
            ? charTex.normalFrames[rotDir][frameIdx]
            : charTex.albedoFrames[rotDir][frameIdx];

          const texScale = charTex.baseScale || 1;
          if (dodgeGhostAlpha > 0.03 && this.bufferMode === 'final_pbr') {
            const ghostSp = this.displayPool.sprite(tex);
            ghostSp.anchor.set(0.5, isDead ? 0.65 : charTex.anchorY);
            ghostSp.position.set(baseScrX, baseScrY);
            ghostSp.scale.set(actorScaleX * texScale, actorScaleY * texScale);
            ghostSp.rotation = actorRotation;
            ghostSp.alpha = dodgeGhostAlpha;
            ghostSp.tint = 0xcbd5e1;
            this.sortedObjectLayer.addChild(ghostSp);
          }

          const sp = this.displayPool.sprite(tex);
          sp.anchor.set(0.5, isDead ? 0.65 : charTex.anchorY);
          sp.position.set(actorScrX, actorScrY);
          sp.scale.set(actorScaleX * texScale, actorScaleY * texScale);
          sp.rotation = actorRotation;

          if (this.bufferMode === 'depth_dag') {
            const t = orderIndex / Math.max(1, totalCount - 1);
            sp.tint = ((Math.round(55 + t * 200) << 16) | (220 << 8) | 120);
          } else if (isDead) {
            sp.tint = 0x6e7683;
          } else if (
            actor.hitRecoilTimer &&
            actor.hitRecoilTimer > (actor.hitRecoilMaxTimer || 0.18) * 0.45
          ) {
            // Crisp warm-white impact peak flash before crimson damage tint
            sp.tint = 0xfff2e0;
          } else if (actor.damageFlashTimer && actor.damageFlashTimer > 0) {
            sp.tint = 0xff3b30;
          } else {
            sp.tint = this.computeRgbTintForScreenPoint(
              actorScrX,
              actorScrY - 32,
              0,
              -0.2,
              0.32,
              0.65,
              1.0,
              screenLights
            );
          }

          this.sortedObjectLayer.addChild(sp);

          // Render HP Bar & Status Badges above Hostile Enemies & Player in Combat
          const showHpBar =
            !isDead &&
            actor.combat &&
            (actor.combat.isHostile ||
              this.game.combatState.active ||
              actor.combat.hp < actor.combat.maxHp);

          if (showHpBar && actor.combat && this.bufferMode !== 'depth_dag') {
            const barW = 46;
            const barH = 5;
            const barX = Math.round(groundScrX - barW * 0.5);
            const barY = Math.round(groundScrY - 72);
            const hpRatio = Math.max(0, Math.min(1, actor.combat.hp / Math.max(1, actor.combat.maxHp)));
            const barFillCol =
              actor.id === this.game.player.id
                ? 0x38ef7d
                : actor.combat.difficulty === 'easy'
                  ? 0x4cd964
                  : actor.combat.difficulty === 'normal'
                    ? 0xf5c451
                    : 0xff453a;

            batchedHpBarsGfx
              .roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3)
              .fill({ color: 0x06080c, alpha: 0.88 })
              .roundRect(barX, barY, Math.max(2, barW * hpRatio), barH, 2)
              .fill({ color: barFillCol, alpha: 0.95 });
            hasBatchedHpBars = true;

            // Overhead ⚠️ warning badge when this hostile enemy has a telegraphed attack pending
            if (this.game.combatState.active && !isPlayer && actor.combat.isHostile) {
              const intent = this.getTelegraphedIntent?.(actor.id) ?? null;
              if (intent) {
                const labelText =
                  intent === 'heavy_cleave'
                    ? '⚠️ POTĘŻNY ZAMACH'
                    : intent === 'terror_howl'
                      ? '⚠️ WYCIE GROZY'
                      : '⚠️ ATAK SPECJALNY';
                const bob = this.reducedMotion ? 0 : Math.sin(this.elapsedSeconds * 7) * 2.5;
                const warnLabel = this.displayPool.text(labelText, 'telegraph_warn', () => ({
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 10,
                  fontWeight: '800',
                  fill: '#fef08a',
                  stroke: { color: '#7f1d1d', width: 3 }
                }));
                warnLabel.anchor.set(0.5, 1);
                warnLabel.position.set(actorScrX, barY - 6 + bob);
                this.debugOverlayContainer.addChild(warnLabel);
              }
            }
          }

          // Floating nameplate for story NPCs, Hostile Enemies, Dead Corpses, and Player
          const isHovered =
            this.hoveredWorldTile?.x === actor.tileX && this.hoveredWorldTile?.y === actor.tileY;
          const nameAlreadyShownInMarker = isNpcNameCoveredBySpeechMarker(
            actor.speechBubbleText,
            actor.recipe.name
          );

          if (isDead) {
            if (isHovered && this.bufferMode !== 'depth_dag') {
              const corpseLabel = actor.isFallenCorpse
                ? `🕯️ ${actor.recipe.name} (${actor.recipe.title || 'Zbadaj ciało'})`
                : actor.isLooted
                  ? `💀 ${actor.recipe.name} (Przeszukano)`
                  : `💰 ${actor.recipe.name} (Kliknij, aby przeszukać)`;
              const corpseTag = this.displayPool.text(
                corpseLabel,
                `corpse_${actor.id}_${actor.isFallenCorpse ? 'story' : actor.isLooted ? 'looted' : 'loot'}`,
                () => ({
                  fontFamily: 'Cinzel, serif',
                  fontSize: 11,
                  fontWeight: '700',
                  fill: actor.isLooted ? 0x94a3b8 : 0xf6df92,
                  stroke: { color: 0x05070b, width: 3.5 }
                })
              );
              corpseTag.anchor.set(0.5, 1);
              corpseTag.position.set(actorScrX, actorScrY - 24);
              this.debugOverlayContainer.addChild(corpseTag);
            }
          } else if (
            isHovered ||
            this.isHighlightAltHeld ||
            (actor.dialogueId && !nameAlreadyShownInMarker) ||
            actor.combat?.isHostile ||
            this.bufferMode === 'depth_dag'
          ) {
            const statusIcons = [
              actor.combat?.defending ? '🛡️' : '',
              (actor.combat?.dazedHeadTurns ?? 0) > 0 ? '💀' : '',
              (actor.combat?.crippledLegsTurns ?? 0) > 0 ? '🦵' : ''
            ]
              .filter(Boolean)
              .join('');

            const diffPrefix = actor.combat?.difficultyLabel
              ? `${actor.combat.difficultyLabel} • `
              : '';
            const hpSuffix = actor.combat?.isHostile
              ? ` (${actor.combat.hp}/${actor.combat.maxHp} HP)${statusIcons ? ' ' + statusIcons : ''}`
              : statusIcons
                ? ` ${statusIcons}`
                : '';

            const isMerchantActor =
              Boolean(actor.isMerchant) || MERCHANT_ACTOR_IDS.includes(actor.id);
            const merchantSpec = isMerchantActor ? getMerchantSpecialty(actor.id) : null;

            const labelText =
              this.bufferMode === 'depth_dag'
                ? `#${orderIndex} ${actor.recipe.name}`
                : merchantSpec
                  ? `${merchantSpec.icon} ${actor.recipe.name}`
                  : `${diffPrefix}${actor.recipe.name}${hpSuffix}`;

            const nameFill =
              actor.id === this.game.player.id
                ? 0x69f0ae
                : actor.combat?.isHostile
                  ? actor.combat.difficulty === 'easy'
                    ? 0x81c784
                    : actor.combat.difficulty === 'normal'
                      ? 0xffd54f
                      : 0xff6e6e
                  : merchantSpec
                    ? 0xffe082
                    : 0xf5d77f;

            const nameTag = this.displayPool.text(
              labelText,
              `name_${nameFill.toString(16)}`,
              () => ({
                fontFamily: 'Cinzel, serif',
                fontSize: 11.5,
                fontWeight: '700',
                fill: nameFill,
                stroke: { color: 0x080a0f, width: 3.5 }
              })
            );
            nameTag.anchor.set(0.5, 1);
            const candidateOffsets = [
              { x: 0, y: -79 },
              { x: 0, y: -105 },
              { x: -28, y: -80 },
              { x: 28, y: -80 },
              { x: 0, y: -131 },
              { x: -38, y: -106 },
              { x: 38, y: -106 },
              { x: 0, y: -157 }
            ];
            const labelPosition = resolveNonOverlappingLabelPosition(
              scr.x,
              scr.y,
              nameTag.width,
              nameTag.height,
              candidateOffsets,
              worldLabelBounds
            );
            nameTag.position.set(Math.round(labelPosition.x), Math.round(labelPosition.y));
            this.debugOverlayContainer.addChild(nameTag);

            // Overhead specialization icon badge visible from afar for every vendor
            if (merchantSpec && this.bufferMode !== 'depth_dag') {
              const badgeText = this.displayPool.text(
                merchantSpec.icon,
                'merchant_icon_badge',
                () => ({
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  fontWeight: '800',
                  fill: 0xfff6d6,
                  stroke: { color: 0x080a0f, width: 3.5 }
                })
              );
              badgeText.anchor.set(0.5, 0.5);
              const pillW = Math.max(36, badgeText.width + 14);
              const pillH = 22;
              const pillX = scr.x;
              const pillY = scr.y - 108;

              const badgeBg = this.displayPool.graphics();
              badgeBg
                .roundRect(pillX - pillW * 0.5, pillY - pillH * 0.5, pillW, pillH, 9)
                .fill({ color: 0x101520, alpha: 0.88 })
                .stroke({ color: 0xe5bd68, width: 1.6, alpha: 0.95 });
              badgeText.position.set(pillX, pillY);
              this.debugOverlayContainer.addChild(badgeBg, badgeText);
            }

            // Tactical Hit Chance & Damage Preview when hovering a Hostile Enemy
            if (isHovered && actor.combat?.isHostile && this.bufferMode !== 'depth_dag') {
              const pSnap = this.game.getActorCombatant(this.game.player);
              const eSnap = this.game.getActorCombatant(actor);
              const dist = Math.hypot(
                actor.tileX - this.game.player.tileX,
                actor.tileY - this.game.player.tileY
              );
              const preview = computeAttackPreview(
                pSnap,
                eSnap,
                dist,
                this.game.combatState.selectedAttackMode
              );
              const previewTag = this.displayPool.text(
                `🎯 Szansa: ${preview.hitChancePct}% | ⚔️ ${preview.estimatedMinDamage}-${preview.estimatedMaxDamage} obr. | ⚡ ${preview.apCost} AP${preview.inRange ? '' : ' (Podejdź)'}`,
                preview.inRange ? 'aim_in' : 'aim_out',
                () => ({
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: '700',
                  fill: preview.inRange ? 0xfff176 : 0xffab40,
                  stroke: { color: 0x05070b, width: 3.5 }
                })
              );
              previewTag.anchor.set(0.5, 1);
              previewTag.position.set(scr.x, scr.y - 95);
              this.debugOverlayContainer.addChild(previewTag);
            }
          }

          // Render Floating cRPG Speech Bubble (e.g. "Jeszcze nie czas iść dalej...") or Quest/Role Badge
          if (actor.speechBubbleText) {
            const rawBubble = actor.speechBubbleText.trim();
            const isMarkerBadge =
              rawBubble.length <= 3 ||
              /^[❗❓⚔️🛡️🌿⚒️🍺💰🗣️💬⚖️📜🔥🪧⭐💀]/u.test(rawBubble);
            const displayBubbleText = isMarkerBadge ? rawBubble : `„${rawBubble}”`;
            const bubbleText = this.displayPool.text(
              displayBubbleText,
              'speech_bubble',
              () => ({
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: '700',
                fill: 0xfff6d6,
                stroke: { color: 0x080a0f, width: 4 }
              })
            );
            bubbleText.anchor.set(0.5, 1);
            const padX = 12;
            const padY = 7;
            const bw = bubbleText.width + padX * 2;
            const bh = bubbleText.height + padY * 2;
            const safeZoom = Math.max(0.25, this.zoom);
            const viewLeft = -this.cameraOffsetX / safeZoom + 12;
            const viewRight = (viewW - this.cameraOffsetX) / safeZoom - 12;
            const viewTop = -this.cameraOffsetY / safeZoom + 60;
            const bx = Math.max(
              viewLeft + bw * 0.5,
              Math.min(viewRight - bw * 0.5, scr.x)
            );
            const by = Math.max(viewTop + bh, scr.y - 104);

            const bubbleBg = this.displayPool.graphics();
            bubbleBg
              .roundRect(bx - bw * 0.5, by - bh + 4, bw, bh, 7)
              .fill({ color: 0x101520, alpha: 0.92 })
              .stroke({ color: 0xe5bd68, width: 1.8, alpha: 0.95 });
            bubbleText.position.set(bx, by - padY + 4);

            this.debugOverlayContainer.addChild(bubbleBg, bubbleText);
          }
        }
      });
    }

    const sortedNodes = sortEntitiesTopological(renderables);
    for (let i = 0; i < sortedNodes.length; i++) {
      sortedNodes[i].render(i, sortedNodes.length, playerDepthBox);
    }
    if (hasBatchedHpBars) {
      this.debugOverlayContainer.addChild(batchedHpBarsGfx);
    }

    // Render Floating Combat Popups (Criticals, Damage, Misses, Statuses) with pop-in scale punch
    for (const ft of this.game.combatState.floatingTexts) {
      const rotFt = toRotatedContinuous(ft.x, ft.y, mapW, mapH, this.rotation);
      const scrFt = gridToScreen(rotFt.rx, rotFt.ry, ft.z);
      const isCritText = /KRYT|!|💥/i.test(ft.text);
      const motion = computeFloatingTextMotion(
        ft.elapsed,
        ft.duration,
        isCritText,
        this.reducedMotion
      );
      const popText = this.displayPool.text(
        ft.text,
        `pop_${ft.colorHex.toString(16)}`,
        () => ({
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          fontWeight: '800',
          fill: ft.colorHex,
          stroke: { color: 0x05070b, width: 3.8 }
        })
      );
      popText.anchor.set(0.5, 1);
      popText.position.set(scrFt.x, scrFt.y - 68 + motion.offsetY);
      popText.scale.set(motion.scale, motion.scale);
      popText.alpha = motion.alpha;
      this.debugOverlayContainer.addChild(popText);
    }

    // 4. Render Atmospheric Ember, Spark, Leaf, Firefly, Mist, and Dust Particles in Final PBR Mode
    if (this.bufferMode === 'final_pbr') {
      for (const p of this.particles) {
        const rotP = toRotatedContinuous(p.x, p.y, mapW, mapH, this.rotation);
        const scrP = gridToScreen(rotP.rx, rotP.ry, p.z);
        const lifeRatio = p.life / p.maxLife;
        const envelope = Math.sin(lifeRatio * Math.PI);

        if (p.kind === 'leaf') {
          const flutter = Math.sin((p.phase ?? 0) + p.life * 5.2);
          const rx = p.size * (0.9 + 0.35 * Math.abs(flutter));
          const ry = p.size * (0.45 + 0.25 * Math.abs(Math.cos((p.phase ?? 0) + p.life * 4.1)));
          this.lightingOverlayGraphics
            .ellipse(scrP.x, scrP.y, rx, ry)
            .fill({ color: p.color, alpha: envelope * 0.72 });
        } else if (p.kind === 'firefly') {
          const pulse = 0.4 + 0.6 * Math.abs(Math.sin((p.phase ?? 0) + p.life * 3.8));
          const alpha = envelope * pulse * 0.85;
          this.lightingOverlayGraphics
            .circle(scrP.x, scrP.y, p.size * 2.1)
            .fill({ color: p.color, alpha: alpha * 0.24 });
          this.lightingOverlayGraphics
            .circle(scrP.x, scrP.y, p.size * 0.7)
            .fill({ color: 0xfefce8, alpha: alpha * 0.92 });
        } else if (p.kind === 'mist') {
          const drift = Math.sin((p.phase ?? 0) + p.life * 0.9) * 8;
          this.lightingOverlayGraphics
            .ellipse(scrP.x, scrP.y, p.size * 2.4, p.size * 0.72)
            .fill({ color: p.color, alpha: envelope * 0.014 })
            .ellipse(scrP.x + drift * 0.5, scrP.y - 1, p.size * 1.75, p.size * 0.52)
            .fill({ color: p.color, alpha: envelope * 0.018 })
            .ellipse(scrP.x - drift * 0.4, scrP.y + 1, p.size * 1.15, p.size * 0.34)
            .fill({ color: p.color, alpha: envelope * 0.02 });
        } else if (p.kind === 'dust') {
          this.lightingOverlayGraphics
            .circle(scrP.x, scrP.y, p.size)
            .fill({ color: p.color, alpha: envelope * 0.26 });
        } else {
          const alpha = envelope * 0.82;
          // Inner bright spark core
          this.lightingOverlayGraphics
            .circle(scrP.x, scrP.y, p.size * 0.55)
            .fill({ color: 0xffffff, alpha: alpha * 0.95 });
          // Outer colored glow halo
          this.lightingOverlayGraphics
            .circle(scrP.x, scrP.y, p.size)
            .fill({ color: p.color, alpha: alpha * 0.65 });
        }
      }
    }

    // 5. Render Ground Shockwave Rings (Critical hits & Parries)
    for (const sw of this.shockwaves) {
      const rotSw = toRotatedContinuous(sw.x, sw.y, mapW, mapH, this.rotation);
      const scrSw = gridToScreen(rotSw.rx, rotSw.ry, sw.z);
      const progress = Math.max(0, Math.min(1, sw.life / sw.maxLife));
      const eased = 1 - Math.pow(1 - progress, 2);
      const radius = 8 + eased * sw.maxRadius;
      const alpha = (1 - progress) * 0.72;
      const swGfx = this.displayPool.graphics();
      swGfx
        .ellipse(scrSw.x, scrSw.y, radius, radius * 0.5)
        .stroke({ color: sw.color, width: 2.6 * (1 - progress * 0.5), alpha });
      this.sortedObjectLayer.addChild(swGfx);
    }

    // 6. Render Slash Arc Trails (Dynamic weapon blade trails)
    for (const arc of this.slashArcs) {
      const rotStart = toRotatedContinuous(arc.startX, arc.startY, mapW, mapH, this.rotation);
      const rotEnd = toRotatedContinuous(arc.targetX, arc.targetY, mapW, mapH, this.rotation);
      const scrStart = gridToScreen(rotStart.rx, rotStart.ry, arc.startZ);
      const scrEnd = gridToScreen(rotEnd.rx, rotEnd.ry, arc.targetZ);
      const progress = Math.max(0, Math.min(1, arc.life / arc.maxLife));
      const alpha = Math.sin(progress * Math.PI) * 0.95;
      const midX = (scrStart.x + scrEnd.x) * 0.5;
      const midY = (scrStart.y + scrEnd.y) * 0.5 - 24;
      const wScale = arc.widthScale ?? 1;

      const slashGfx = this.displayPool.graphics();
      // Outer colored swing blade
      slashGfx
        .moveTo(scrStart.x, scrStart.y - 18)
        .quadraticCurveTo(midX, midY - 12, scrEnd.x, scrEnd.y - 18)
        .stroke({ color: arc.color, width: 4.8 * wScale * (1 - progress * 0.4), alpha });
      // Inner glowing white core
      slashGfx
        .moveTo(scrStart.x, scrStart.y - 18)
        .quadraticCurveTo(midX, midY - 12, scrEnd.x, scrEnd.y - 18)
        .stroke({ color: 0xffffff, width: 2.2 * wScale * (1 - progress * 0.4), alpha: alpha * 0.95 });
      this.sortedObjectLayer.addChild(slashGfx);
    }

    this.displayPool.endFrame();
  }
}
