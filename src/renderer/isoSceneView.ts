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
import { preloadGlionoxForestAssets } from '../assets/glionoxAtlas';
import {
  generatePropPbrBuffers,
  generateTilePbrBuffers,
  SynthesizedPbrBufferPair
} from '../assets/proceduralForge';
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
import { PropKind, TileTerrainType } from '../core/worldMap';
import {
  computeAttackPreview,
  createDefaultProficiencies,
  EnemyDifficultyTier
} from '../rpg/combatSystem';
import { ActorEntity, CrpgGameState } from '../rpg/gameLoop';
import {
  createAtmosphericPostFilter,
  evaluateDeferredPbrLightAtPoint,
  RenderBufferMode,
  ScreenSpacePointLight,
  updateAtmosphericFilterUniforms
} from './deferredPipeline';

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

interface DualPbrTexturePair {
  albedo: Texture;
  normalMat: Texture;
  anchorX: number;
  anchorY: number;
}

interface CharacterDualFrameTextures {
  recipeHash: string;
  albedoFrames: Texture[][]; // [dir 0..7][frame 0..3]
  normalFrames: Texture[][];
  portraitDataUrl: string;
  bakeDurationMs: number;
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
  tex.source.scaleMode = 'nearest';
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
  public cameraOffsetX = 0;
  public cameraOffsetY = 140;
  public edgePanEnabled = true;
  public edgePanMarginPx = 96;
  public edgePanSpeed = 520;
  public activeEdgeDirection: EdgePanDirection | null = null;
  public forcedEdgeDirection: EdgePanDirection | null = null;
  public hoveredWorldTile: { x: number; y: number; z: number } | null = null;
  public lastBakeDurationMs = 1.2;
  public fps = 60;

  private readonly worldContainer = new Container();
  private readonly floorLayer = new Container();
  private readonly cursorAndPathGraphics = new Graphics();
  private readonly sortedObjectLayer = new Container();
  private readonly lightingOverlayGraphics = new Graphics();
  private readonly debugOverlayContainer = new Container();

  private readonly tileTextureCache = new Map<string, DualPbrTexturePair>();
  private readonly propTextureCache = new Map<string, DualPbrTexturePair>();
  private readonly characterTextureCache = new Map<string, CharacterDualFrameTextures>();
  private readonly displayPool = new FrameDisplayPool();
  private readonly scratchPbrLit = { r: 0, g: 0, b: 0, specular: 0 };
  private readonly scratchSurface = { nx: 0, ny: 0, roughness: 0, metallic: 0 };
  private cachedHoverPathKey = '';
  private cachedHoverPath: PathStepNode[] = [];
  private readonly particles: FloatingParticle[] = [];
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
  private onUiStateChange?: () => void;

  constructor(game: CrpgGameState, onUiStateChange?: () => void) {
    this.app = new Application();
    this.game = game;
    this.onUiStateChange = onUiStateChange;
  }

  public async mount(containerEl: HTMLElement): Promise<void> {
    await preloadGlionoxForestAssets();
    this.tileTextureCache.clear();
    this.propTextureCache.clear();

    try {
      await this.app.init({
        preference: 'webgl',
        resizeTo: containerEl,
        backgroundColor: 0x0b0e14,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
    } catch {
      await this.app.init({
        preference: 'canvas',
        resizeTo: containerEl,
        backgroundColor: 0x0b0e14,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });
    }

    containerEl.innerHTML = '';
    containerEl.appendChild(this.app.canvas);

    this.centerCameraOnPlayer();

    this.worldContainer.addChild(
      this.floorLayer,
      this.cursorAndPathGraphics,
      this.sortedObjectLayer,
      this.lightingOverlayGraphics,
      this.debugOverlayContainer
    );
    this.app.stage.addChild(this.worldContainer);

    this.postFilter = createAtmosphericPostFilter();
    if (this.postFilter) {
      this.worldContainer.filters = [this.postFilter];
    }

    this.bindInputEvents(this.app.canvas);

    this.app.ticker.add((ticker) => {
      try {
        const dt = Math.min(0.1, ticker.deltaMS / 1000);
        this.fps = Math.round(ticker.FPS);
        this.elapsedSeconds += dt;
        const viewportW = this.app.screen?.width || window.innerWidth || 1280;
        const viewportH = this.app.screen?.height || window.innerHeight || 720;
        this.handleKeyboardCameraPan(dt);
        this.stepCameraEdgePan(dt, viewportW, viewportH);

        // Smooth camera follow lerp when player hero is moving along path
        if (
          this.game.player.isMoving &&
          !this.isDraggingCamera &&
          !this.activeEdgeDirection &&
          this.keysDown.size === 0
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
          const targetCamY = viewportH * 0.46 - pScr.y * this.zoom;
          const lerp = Math.min(1.0, dt * 4.5);
          this.cameraOffsetX += (targetCamX - this.cameraOffsetX) * lerp;
          this.cameraOffsetY += (targetCamY - this.cameraOffsetY) * lerp;
        }

        const prevMapId = this.game.map.id;
        const prevTopLog = this.game.logs[0];
        const prevDialogue = this.game.activeDialogue;
        const prevCombatActive = this.game.combatState.active;

        this.game.update(dt);

        if (this.game.map.id !== prevMapId) {
          this.centerCameraOnPlayer();
          this.onUiStateChange?.();
        } else if (
          this.game.logs[0] !== prevTopLog ||
          this.game.activeDialogue !== prevDialogue ||
          this.game.combatState.active !== prevCombatActive
        ) {
          this.onUiStateChange?.();
        }

        this.updateParticles(dt);
        this.renderFrame();
      } catch (err) {
        console.error('Błąd w pętli renderowania klatki IsoSceneView:', err);
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
      this.game.recomputeFov();
      this.game.addLog(
        `[Edytor] Pomalowano teren (${centerX}, ${centerY}) pędzlem ${this.editorBrushSize}×${this.editorBrushSize}: ${this.editorTerrainType}.`
      );
      return;
    }

    if (this.activeTool === 'raise_elevation') {
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].z = Math.min(4, map.tiles[c.y][c.x].z + 1);
      }
      for (const prop of map.props) {
        if (prop.x === centerX && prop.y === centerY) {
          prop.z = map.tiles[centerY][centerX].z;
        }
      }
      this.game.addLog(
        `[Edytor] Podniesiono wysokość kafla (${centerX}, ${centerY}) do Z=${map.tiles[centerY][centerX].z}.`
      );
      return;
    }

    if (this.activeTool === 'lower_elevation') {
      for (const c of affectedCoords) {
        map.tiles[c.y][c.x].z = Math.max(0, map.tiles[c.y][c.x].z - 1);
      }
      for (const prop of map.props) {
        if (prop.x === centerX && prop.y === centerY) {
          prop.z = map.tiles[centerY][centerX].z;
        }
      }
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

      const passableKinds: ReadonlyArray<PropKind> = ['wildflower_patch', 'ground_loot', 'exit_path'];
      const sightBlockingKinds: ReadonlyArray<PropKind> = [
        'wall_block',
        'pillar',
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
        'campfire',
        'ground_loot',
        'exit_path',
        'market_stall',
        'slavic_shrine',
        'slavic_well',
        'travel_signpost',
        'watchtower'
      ];

      const z = map.tiles[centerY][centerX].z;
      const propId = `editor_prop_${kind}_${centerX}_${centerY}_${Date.now()}`;
      let linkedLightId: string | undefined;

      if (kind === 'campfire' || kind === 'torch_sconce' || kind === 'arcane_crystal') {
        linkedLightId = `light_${propId}`;
        const isArcane = kind === 'arcane_crystal';
        map.lights.push({
          id: linkedLightId,
          x: centerX + 0.5,
          y: centerY + 0.5,
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
          kind === 'chest' || kind === 'market_stall' || kind === 'ground_loot'
            ? ['item_raw_sausage']
            : undefined,
        linkedLightId
      });

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
    this.game.addLog(`[Edytor] Wyrównano wysokość całej mapy do poziomu Z=${clampedZ}.`);
    this.onUiStateChange?.();
  }

  public clearMapEntities(): void {
    this.game.map.props.length = 0;
    this.game.map.lights.length = 0;
    this.game.npcs.length = 0;
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
    this.cameraOffsetY = screenH * 0.46 - pScr.y * this.zoom;
  }

  public getCharacterTextures(actor: ActorEntity): CharacterDualFrameTextures {
    const fastHash = computeCharacterRecipeHash(actor.recipe);
    const cached = this.characterTextureCache.get(fastHash);
    if (cached) return cached;

    const t0 = performance.now();
    const baked: BakedCharacterBuffers = bakeCharacterBuffers(actor.recipe);

    if (typeof document === 'undefined') {
      const headlessEntry: CharacterDualFrameTextures = {
        recipeHash: baked.recipeHash,
        albedoFrames: [],
        normalFrames: [],
        portraitDataUrl: 'data:image/png;base64,',
        bakeDurationMs: 0.5
      };
      this.characterTextureCache.set(baked.recipeHash, headlessEntry);
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

    const entry: CharacterDualFrameTextures = {
      recipeHash: baked.recipeHash,
      albedoFrames,
      normalFrames,
      portraitDataUrl: portraitCanvas.toDataURL(),
      bakeDurationMs
    };

    this.characterTextureCache.set(baked.recipeHash, entry);
    return entry;
  }

  private getTileTexturePair(terrain: TileTerrainType, z: number): DualPbrTexturePair {
    const key = `${terrain}_z${z}`;
    const existing = this.tileTextureCache.get(key);
    if (existing) return existing;

    const synth: SynthesizedPbrBufferPair = generateTilePbrBuffers(terrain, z);
    const pair: DualPbrTexturePair = {
      albedo: rgbaBufferToTexture(synth.albedoRGBA, synth.width, synth.height),
      normalMat: rgbaBufferToTexture(synth.normalMaterialRGBA, synth.width, synth.height),
      anchorX: synth.anchorX,
      anchorY: synth.anchorY
    };
    this.tileTextureCache.set(key, pair);
    return pair;
  }

  private getPropTexturePair(
    kind: PropKind,
    isOpen: boolean,
    rotW: number,
    rotH: number,
    variant = 0
  ): DualPbrTexturePair {
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

  private bindInputEvents(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toLowerCase();
      this.keysDown.add(k);
      if (k === 'q') {
        this.rotateCamera(-1);
      } else if (k === 'e') {
        this.rotateCamera(1);
      } else if (k === 'r' && this.activeTool === 'place_prop') {
        this.editorPropOrientation =
          this.editorPropOrientation === '1x1'
            ? '2x1'
            : this.editorPropOrientation === '2x1'
              ? '1x2'
              : '1x1';
        this.onUiStateChange?.();
      } else if (k === ' ' && this.game.combatState.active) {
        e.preventDefault();
        this.game.endPlayerCombatTurn();
        this.onUiStateChange?.();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key.toLowerCase());
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.zoom = Math.min(1.85, Math.max(0.55, Number((this.zoom * factor).toFixed(2))));
        this.onUiStateChange?.();
      },
      { passive: false }
    );

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.isDraggingCamera = true;
        this.dragLastX = e.clientX;
        this.dragLastY = e.clientY;
        return;
      }

      if (e.button === 0) {
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

        // Standard cRPG interaction / movement
        const npcAtTile = this.game.npcs.find(
          (n) => n.tileX === x && n.tileY === y && (!n.combat || n.combat.isAlive)
        );
        if (npcAtTile) {
          this.game.commandTalkToNpc(npcAtTile.id);
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
        this.onUiStateChange?.();
      }
    });

    const onPointerOrMouseMove = (e: MouseEvent | PointerEvent): void => {
      const target = e.target as HTMLElement | null;
      const overUi = Boolean(
        target?.closest(
          '.top-bar button, .hero-card, .chronicle-log, .combat-tactical-bar, .inventory-drawer, .inspector-card, .inspector-expand-btn, .dialogue-modal'
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
        window.addEventListener('pointermove', onPointerOrMouseMove, { passive: true });
      } else {
        window.addEventListener('mousemove', onPointerOrMouseMove, { passive: true });
      }
    }

    window.addEventListener('pointerup', () => {
      this.isDraggingCamera = false;
      this.isPaintingWithBrush = false;
      this.lastPaintedTileKey = '';
    });

    document.documentElement.addEventListener('mouseleave', () => {
      this.isPointerInsideViewport = false;
      this.forcedEdgeDirection = null;
    });

    window.addEventListener('blur', () => {
      this.isPointerInsideViewport = false;
      this.forcedEdgeDirection = null;
      this.keysDown.clear();
    });
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
    if (this.isDraggingCamera) {
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

    const canvas = this.app.renderer?.canvas;
    if (canvas) {
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
      canvas.style.cursor = this.activeEdgeDirection
        ? cursorMap[this.activeEdgeDirection]
        : 'crosshair';
    }
  }

  private handleKeyboardCameraPan(dt: number): void {
    const panSpeed = 420 * dt;
    let moved = false;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) {
      this.cameraOffsetY += panSpeed;
      moved = true;
    }
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) {
      this.cameraOffsetY -= panSpeed;
      moved = true;
    }
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) {
      this.cameraOffsetX += panSpeed;
      moved = true;
    }
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) {
      this.cameraOffsetX -= panSpeed;
      moved = true;
    }
    if (moved && this.app.renderer?.canvas && this.isPointerInsideViewport && !this.isPointerOverUi) {
      this.updateHoveredTileFromPointer(this.pointerClientX, this.pointerClientY);
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
  }

  private updateParticles(dt: number): void {
    // Spawn atmospheric crackling embers, sparks, and ethereal motes
    if (this.particles.length < 140 && Math.random() < 0.72) {
      const fireProps = this.game.map.props.filter(
        (p) => (p.kind === 'campfire' || p.kind === 'torch_sconce') && p.isOpen
      );
      const arcaneProps = this.game.map.props.filter(
        (p) =>
          p.kind === 'arcane_crystal' ||
          p.kind === 'slavic_shrine' ||
          p.kind === 'runic_altar'
      );

      if (fireProps.length > 0 && Math.random() < 0.55) {
        // Crackling sparks & embers rising from campfires / torches
        const p = fireProps[Math.floor(Math.random() * fireProps.length)];
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
          size: 1.6 + Math.random() * 1.4
        });
      } else if (arcaneProps.length > 0 && Math.random() < 0.45) {
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
          size: 2.2 + Math.random() * 1.5
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
            size: isCyan ? 2.6 : 2.2
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
      p.vx += Math.sin(p.life * 7.5 + p.y * 2.5) * 0.06 * dt;
      p.vy += Math.cos(p.life * 7.5 + p.x * 2.5) * 0.06 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
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

    this.worldContainer.position.set(this.cameraOffsetX, this.cameraOffsetY);
    this.worldContainer.scale.set(this.zoom);

    this.floorLayer.removeChildren();
    this.sortedObjectLayer.removeChildren();
    this.debugOverlayContainer.removeChildren();
    this.cursorAndPathGraphics.clear();
    this.lightingOverlayGraphics.clear();

    const { width: mapW, height: mapH } = this.game.map;
    const { width: rotW, height: rotH } = getRotatedDimensions(mapW, mapH, this.rotation);
    const useNormalTex = this.bufferMode === 'normal_map';
    const screenLights = this.buildScreenSpaceLights();

    updateAtmosphericFilterUniforms(
      this.postFilter,
      this.game.ambientLightIntensity,
      this.elapsedSeconds,
      this.bufferMode === 'final_pbr',
      this.cameraOffsetX,
      this.cameraOffsetY,
      this.zoom,
      screenLights
    );

    const viewW =
      (this.app.renderer ? this.app.screen.width : 0) ||
      (typeof window !== 'undefined' ? window.innerWidth : 0) ||
      1280;
    const viewH =
      (this.app.renderer ? this.app.screen.height : 0) ||
      (typeof window !== 'undefined' ? window.innerHeight : 0) ||
      720;
    const cullPad = 220;
    const minLocalX = (-this.cameraOffsetX - cullPad) / Math.max(0.25, this.zoom);
    const maxLocalX = (viewW - this.cameraOffsetX + cullPad) / Math.max(0.25, this.zoom);
    const minLocalY = (-this.cameraOffsetY - cullPad) / Math.max(0.25, this.zoom);
    const maxLocalY = (viewH - this.cameraOffsetY + cullPad) / Math.max(0.25, this.zoom);

    // 1. Render Isometric Floor Tiles in Painter Order (rx + ry from 0 to rotW + rotH)
    for (let sum = 0; sum <= rotW + rotH - 2; sum++) {
      for (let rx = 0; rx < rotW; rx++) {
        const ry = sum - rx;
        if (ry < 0 || ry >= rotH) continue;

        const worldCoord = toWorldGrid(rx, ry, mapW, mapH, this.rotation);
        const cell = this.game.map.tiles[worldCoord.y][worldCoord.x];
        const scr = gridToScreen(rx + 0.5, ry + 0.5, cell.z);

        if (
          scr.x < minLocalX ||
          scr.x > maxLocalX ||
          scr.y < minLocalY ||
          scr.y > maxLocalY
        ) {
          continue;
        }

        const texPair = this.getTileTexturePair(cell.terrain, cell.z);
        const sprite = this.displayPool.sprite(useNormalTex ? texPair.normalMat : texPair.albedo);
        sprite.anchor.set(texPair.anchorX, texPair.anchorY);
        sprite.position.set(scr.x, scr.y);

        const fovFactor = this.game.fogOfWarEnabled
          ? this.game.fov.getLightFactor(cell.x, cell.y)
          : 1.0;
        sprite.tint = this.computeRgbTintForScreenPoint(
          scr.x,
          scr.y,
          0,
          -0.25,
          0.6,
          0.15,
          fovFactor,
          screenLights
        );

        this.floorLayer.addChild(sprite);

        if (cell.terrain === 'abyss_water' && this.bufferMode === 'final_pbr') {
          // Dynamic specular caustics rippling across dark water surface
          const wavePhase = this.elapsedSeconds * 2.2 + rx * 1.5 + ry * 2.1;
          const shimmerAlpha = 0.16 + Math.sin(wavePhase) * 0.12;
          if (shimmerAlpha > 0.06) {
            const causticGfx = this.displayPool.graphics();
            const caustW = TILE_WIDTH * 0.32;
            const caustH = TILE_HEIGHT * 0.2;
            const caustOffX = Math.sin(wavePhase * 0.8) * 6;
            const caustOffY = Math.cos(wavePhase * 0.9) * 3;
            causticGfx
              .ellipse(scr.x + caustOffX, scr.y + caustOffY, caustW, caustH)
              .stroke({ color: 0x90e0ef, width: 1.2, alpha: shimmerAlpha })
              .ellipse(scr.x - caustOffX * 0.5, scr.y - caustOffY * 0.5, caustW * 0.55, caustH * 0.45)
              .fill({ color: 0x00b4d8, alpha: shimmerAlpha * 0.35 });
            this.floorLayer.addChild(causticGfx);
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

      // Preview A* path if in interact mode and hovering walkable tile
      if (this.activeTool === 'interact' && this.game.isTileWalkable(hx, hy)) {
        let previewPath: PathStepNode[];
        if (this.game.player.path.length > 0) {
          previewPath = this.game.player.path;
        } else {
          const hoverKey = `${this.game.map.id}:${this.game.player.tileX},${this.game.player.tileY}->${hx},${hy}`;
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

      const scr = gridToScreen(fp.rx + 0.5, fp.ry + 0.5, prop.z);
      if (
        scr.x < minLocalX - 300 ||
        scr.x > maxLocalX + 300 ||
        scr.y < minLocalY - 450 ||
        scr.y > maxLocalY + 300
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
            prop.variant ?? ((prop.x * 7 + prop.y * 13) % 9)
          );

          // Grounding Ambient Occlusion (AO) & Directional Penumbra Shadow for solid props
          if (this.bufferMode === 'final_pbr') {
            const isFloraOrNonSolid =
              prop.kind === 'wildflower_patch' ||
              prop.kind === 'ground_loot' ||
              prop.kind === 'exit_path';

            if (!isFloraOrNonSolid) {
              const baseRx = Math.max(16, (fp.width + fp.height) * 14);
              const baseRy = Math.max(8, (fp.width + fp.height) * 7);

              const aoGfx = this.displayPool.graphics();
              // Dense inner contact AO anchoring prop to ground
              aoGfx
                .ellipse(scr.x, scr.y, baseRx * 0.72, baseRy * 0.72)
                .fill({ color: 0x010204, alpha: 0.58 });
              // Soft feathered outer ambient occlusion
              aoGfx
                .ellipse(scr.x, scr.y, baseRx, baseRy)
                .fill({ color: 0x030508, alpha: 0.28 });

              // Directional penumbra cast shadow for tall structures
              const isTall =
                prop.kind === 'pine_tree' ||
                prop.kind === 'ancient_oak' ||
                prop.kind === 'pillar' ||
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
                  .fill({ color: 0x020406, alpha: 0.36 });
              }

              this.sortedObjectLayer.addChild(aoGfx);
            }
          }

          const sp = this.displayPool.sprite(useNormalTex ? texPair.normalMat : texPair.albedo);
          sp.anchor.set(texPair.anchorX, texPair.anchorY);
          sp.position.set(scr.x, scr.y);

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
            sp.tint = this.computeRgbTintForScreenPoint(
              scr.x,
              scr.y - 24,
              0.25,
              -0.35,
              0.45,
              0.3,
              fovFactor,
              screenLights
            );
          }

          this.sortedObjectLayer.addChild(sp);

          // Live animated roaring flame tongues on active campfire & torches
          if (
            this.bufferMode === 'final_pbr' &&
            prop.isOpen &&
            (prop.kind === 'campfire' || prop.kind === 'torch_sconce')
          ) {
            const isCampfire = prop.kind === 'campfire';
            const flameBaseY = isCampfire ? scr.y - 12 : scr.y - 52;
            const flameRadius = isCampfire ? 13 : 6.5;
            const flicker1 = Math.sin(this.elapsedSeconds * 11 + prop.x) * 3.5;
            const flicker2 = Math.cos(this.elapsedSeconds * 15 + prop.y) * 2.5;

            const flameGfx = this.displayPool.graphics();
            flameGfx
              .poly([
                scr.x - flameRadius,
                flameBaseY,
                scr.x + flicker1,
                flameBaseY - flameRadius * 2.3,
                scr.x + flameRadius,
                flameBaseY
              ])
              .fill({ color: 0xff6d00, alpha: 0.78 })
              .poly([
                scr.x - flameRadius * 0.6,
                flameBaseY,
                scr.x - flicker2,
                flameBaseY - flameRadius * 1.7,
                scr.x + flameRadius * 0.6,
                flameBaseY
              ])
              .fill({ color: 0xfff176, alpha: 0.92 });
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
            (prop.kind === 'ground_loot' && !prop.isOpen);

          if (showInteractiveHint && this.bufferMode !== 'depth_dag') {
            const styleKey =
              prop.kind === 'campfire'
                ? 'prop_campfire'
                : prop.kind === 'exit_path'
                  ? 'prop_exit'
                  : 'prop_default';
            const label = this.displayPool.text(prop.name, styleKey, () => ({
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: '600',
              fill:
                prop.kind === 'campfire'
                  ? 0xffb74d
                  : prop.kind === 'exit_path'
                    ? 0xff7043
                    : 0xffe082,
              stroke: { color: 0x06080c, width: 3.2 }
            }));
            label.anchor.set(0.5, 1);
            label.position.set(scr.x, scr.y - (prop.kind === 'ground_loot' ? 28 : 54));
            this.debugOverlayContainer.addChild(label);
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
      if (actor.combat && !actor.combat.isAlive) {
        continue;
      }
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
        zMax: actor.z + 1.9,
        render: (orderIndex, totalCount) => {

          // Render Dual-Layer Cast Shadow (Inner Contact Core + Directional Penumbra)
          if (this.bufferMode === 'final_pbr') {
            let shadowOffsetX = -8;
            let shadowOffsetY = 4;
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
              shadowOffsetX = (dx / len) * 14;
              shadowOffsetY = (dy / len) * 7;
            }

            const shadowGfx = this.displayPool.graphics();
            // Layer 1: Dense tight contact shadow directly beneath feet (anchors actor to ground)
            shadowGfx
              .ellipse(scr.x, scr.y + 1, 13, 6.5)
              .fill({ color: 0x010204, alpha: 0.68 });
            // Layer 2: Directional penumbra cast shadow away from light
            shadowGfx
              .ellipse(scr.x + shadowOffsetX * 0.55, scr.y + shadowOffsetY * 0.55, 20, 10)
              .fill({ color: 0x030509, alpha: 0.42 });

            if (actor.id === this.game.player.id) {
              // Subtle selection ring under active player hero
              shadowGfx
                .ellipse(scr.x, scr.y, 22, 11)
                .stroke({ color: 0x38ef7d, width: 2, alpha: 0.78 });
            } else if (actor.combat?.isHostile) {
              const isSelectedTarget = this.game.combatState.selectedTargetId === actor.id;
              const ringColor =
                actor.combat.difficulty === 'easy'
                  ? 0x4cd964
                  : actor.combat.difficulty === 'normal'
                    ? 0xf5c451
                    : 0xff453a;
              shadowGfx
                .ellipse(scr.x, scr.y, isSelectedTarget ? 25 : 22, isSelectedTarget ? 12.5 : 11)
                .stroke({
                  color: ringColor,
                  width: isSelectedTarget ? 2.8 : 1.9,
                  alpha: isSelectedTarget ? 0.96 : 0.78
                });
            }
            this.sortedObjectLayer.addChild(shadowGfx);
          }

          const charTex = this.getCharacterTextures(actor);
          const rotDir = rotateDirection8(actor.direction, this.rotation);
          const frameIdx = actor.animFrame % 4;
          const tex = useNormalTex
            ? charTex.normalFrames[rotDir][frameIdx]
            : charTex.albedoFrames[rotDir][frameIdx];

          const sp = this.displayPool.sprite(tex);
          sp.anchor.set(0.5, 82 / 96);
          sp.position.set(scr.x, scr.y);

          if (this.bufferMode === 'depth_dag') {
            const t = orderIndex / Math.max(1, totalCount - 1);
            sp.tint = ((Math.round(55 + t * 200) << 16) | (220 << 8) | 120);
          } else {
            sp.tint = this.computeRgbTintForScreenPoint(
              scr.x,
              scr.y - 32,
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
            actor.combat &&
            (actor.combat.isHostile ||
              this.game.combatState.active ||
              actor.combat.hp < actor.combat.maxHp);

          if (showHpBar && actor.combat && this.bufferMode !== 'depth_dag') {
            const barW = 46;
            const barH = 5;
            const barX = scr.x - barW * 0.5;
            const barY = scr.y - 72;
            const hpRatio = Math.max(0, Math.min(1, actor.combat.hp / Math.max(1, actor.combat.maxHp)));
            const barFillCol =
              actor.id === this.game.player.id
                ? 0x38ef7d
                : actor.combat.difficulty === 'easy'
                  ? 0x4cd964
                  : actor.combat.difficulty === 'normal'
                    ? 0xf5c451
                    : 0xff453a;

            const hpGfx = this.displayPool.graphics();
            hpGfx
              .roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3)
              .fill({ color: 0x06080c, alpha: 0.88 })
              .roundRect(barX, barY, Math.max(2, barW * hpRatio), barH, 2)
              .fill({ color: barFillCol, alpha: 0.95 });
            this.debugOverlayContainer.addChild(hpGfx);
          }

          // Floating nameplate for story NPCs, Hostile Enemies, and Player
          const isHovered =
            this.hoveredWorldTile?.x === actor.tileX && this.hoveredWorldTile?.y === actor.tileY;
          if (
            isHovered ||
            actor.dialogueId ||
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

            const labelText =
              this.bufferMode === 'depth_dag'
                ? `#${orderIndex} ${actor.recipe.name}`
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
            nameTag.position.set(scr.x, scr.y - 79);
            this.debugOverlayContainer.addChild(nameTag);

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

          // Render Floating cRPG Speech Bubble (e.g. "Jeszcze nie czas iść dalej...")
          if (actor.speechBubbleText) {
            const bubbleText = this.displayPool.text(
              `„${actor.speechBubbleText}”`,
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
            const bx = scr.x;
            const by = scr.y - 104;
            const padX = 12;
            const padY = 7;
            const bw = bubbleText.width + padX * 2;
            const bh = bubbleText.height + padY * 2;

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

    // Render Floating Combat Popups (Criticals, Damage, Misses, Statuses)
    for (const ft of this.game.combatState.floatingTexts) {
      const rotFt = toRotatedContinuous(ft.x, ft.y, mapW, mapH, this.rotation);
      const scrFt = gridToScreen(rotFt.rx, rotFt.ry, ft.z);
      const alpha = Math.max(0, Math.min(1, 1 - (ft.elapsed / ft.duration) * 0.75));
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
      popText.position.set(scrFt.x, scrFt.y - 68);
      popText.alpha = alpha;
      this.debugOverlayContainer.addChild(popText);
    }

    // 4. Render Atmospheric Ember, Spark, and Ethereal Mote Particles in Final PBR Mode
    if (this.bufferMode === 'final_pbr') {
      for (const p of this.particles) {
        const rotP = toRotatedContinuous(p.x, p.y, mapW, mapH, this.rotation);
        const scrP = gridToScreen(rotP.rx, rotP.ry, p.z);
        const lifeRatio = p.life / p.maxLife;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.82;
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

    this.displayPool.endFrame();
  }
}
