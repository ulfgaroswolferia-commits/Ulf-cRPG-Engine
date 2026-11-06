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
  BakedCharacterBuffers,
  bakeCharacterBuffers
} from '../assets/characterBakery';
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
import { findPathAStar3D } from '../core/pathfinding';
import { PropKind, TileTerrainType } from '../core/worldMap';
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
  | 'raise_elevation'
  | 'lower_elevation'
  | 'place_torch_light'
  | 'place_arcane_light';

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
  return Texture.from(canvas);
}

export class IsoSceneView {
  public readonly app: Application;
  public readonly game: CrpgGameState;
  public rotation: CameraRotation = 0;
  public bufferMode: RenderBufferMode = 'final_pbr';
  public activeTool: InspectorToolMode = 'interact';
  public zoom = 1.0;
  public cameraOffsetX = 0;
  public cameraOffsetY = 140;
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
  private readonly particles: FloatingParticle[] = [];
  private postFilter: Filter | null = null;

  private elapsedSeconds = 0;
  private isDraggingCamera = false;
  private dragLastX = 0;
  private dragLastY = 0;
  private readonly keysDown = new Set<string>();
  private onUiStateChange?: () => void;

  constructor(game: CrpgGameState, onUiStateChange?: () => void) {
    this.app = new Application();
    this.game = game;
    this.onUiStateChange = onUiStateChange;
  }

  public async mount(containerEl: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: containerEl,
      backgroundColor: 0x0b0e14,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

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
      const dt = Math.min(0.1, ticker.deltaMS / 1000);
      this.fps = Math.round(ticker.FPS);
      this.elapsedSeconds += dt;
      this.handleKeyboardCameraPan(dt);
      this.game.update(dt);
      this.updateParticles(dt);
      this.renderFrame();
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
    const screenW = this.app.screen?.width || window.innerWidth || 1280;
    const screenH = this.app.screen?.height || window.innerHeight || 720;
    this.cameraOffsetX = screenW * 0.5 - pScr.x * this.zoom;
    this.cameraOffsetY = screenH * 0.46 - pScr.y * this.zoom;
  }

  public getCharacterTextures(actor: ActorEntity): CharacterDualFrameTextures {
    const t0 = performance.now();
    const baked: BakedCharacterBuffers = bakeCharacterBuffers(actor.recipe);
    const cached = this.characterTextureCache.get(baked.recipeHash);
    if (cached) return cached;

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
    rotH: number
  ): DualPbrTexturePair {
    const key = `${kind}_${isOpen ? 'open' : 'closed'}_${rotW}x${rotH}`;
    const existing = this.propTextureCache.get(key);
    if (existing) return existing;

    const synth = generatePropPbrBuffers(kind, isOpen, rotW, rotH);
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

        if (this.activeTool === 'raise_elevation') {
          this.game.map.tiles[y][x].z = Math.min(4, this.game.map.tiles[y][x].z + 1);
          this.game.addLog(`Podniesiono wysokość kafla (${x}, ${y}) do Z=${this.game.map.tiles[y][x].z}.`);
          this.onUiStateChange?.();
          return;
        }

        if (this.activeTool === 'lower_elevation') {
          this.game.map.tiles[y][x].z = Math.max(0, this.game.map.tiles[y][x].z - 1);
          this.game.addLog(`Obniżono wysokość kafla (${x}, ${y}) do Z=${this.game.map.tiles[y][x].z}.`);
          this.onUiStateChange?.();
          return;
        }

        if (this.activeTool === 'place_torch_light' || this.activeTool === 'place_arcane_light') {
          const isArcane = this.activeTool === 'place_arcane_light';
          const z = this.game.map.tiles[y][x].z + 1.5;
          this.game.map.lights.push({
            id: `custom_light_${Date.now()}`,
            x,
            y,
            z,
            color: isArcane ? { r: 68, g: 228, b: 255 } : { r: 255, g: 168, b: 64 },
            intensity: 1.45,
            radius: 6.2,
            flickerSpeed: isArcane ? 1.8 : 4.2,
            enabled: true
          });
          this.game.addLog(
            `Dodano dynamiczne źródło światła PBR (${isArcane ? 'Eteryczny Kryształ' : 'Płomień Pochodni'}) na (${x}, ${y}).`
          );
          this.onUiStateChange?.();
          return;
        }

        // Standard cRPG interaction / movement
        const npcAtTile = this.game.npcs.find((n) => n.tileX === x && n.tileY === y);
        if (npcAtTile) {
          this.game.commandTalkToNpc(npcAtTile.id);
          this.onUiStateChange?.();
          return;
        }

        const propAtTile = this.game.getPropAtTile(x, y);
        if (propAtTile && propAtTile.interactive) {
          this.game.commandInteractWithProp(propAtTile.id);
          this.onUiStateChange?.();
          return;
        }

        this.game.commandPlayerMoveTo(x, y);
        this.onUiStateChange?.();
      }
    });

    window.addEventListener('pointermove', (e) => {
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
    });

    window.addEventListener('pointerup', () => {
      this.isDraggingCamera = false;
    });
  }

  private handleKeyboardCameraPan(dt: number): void {
    const panSpeed = 420 * dt;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) this.cameraOffsetY += panSpeed;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) this.cameraOffsetY -= panSpeed;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) this.cameraOffsetX += panSpeed;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) this.cameraOffsetX -= panSpeed;
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
    // Spawn embers / arcane motes from active light sources
    if (this.particles.length < 75 && Math.random() < 0.65) {
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

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
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

    // Add player's equipped torch or rune staff light!
    const playerOffhand = this.game.player.recipe.equipment.offHand;
    const playerMainhand = this.game.player.recipe.equipment.mainHand;
    if (playerOffhand === 'offhand_torch' || playerMainhand === 'weapon_astral_staff') {
      const isStaff = playerMainhand === 'weapon_astral_staff';
      const pRot = toRotatedContinuous(
        this.game.player.x,
        this.game.player.y,
        mapW,
        mapH,
        this.rotation
      );
      const pScr = gridToScreen(pRot.rx, pRot.ry, this.game.player.z + 1.4);
      result.push({
        screenX: pScr.x,
        screenY: pScr.y,
        zHeightPx: 46,
        r: isStaff ? 0.35 : 1.0,
        g: isStaff ? 0.88 : 0.68,
        b: isStaff ? 1.0 : 0.28,
        intensity: 1.38 + Math.sin(this.elapsedSeconds * 5.0) * 0.08,
        radiusPx: 5.8 * (TILE_WIDTH * 0.5)
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

    const lit = evaluateDeferredPbrLightAtPoint(
      sx,
      sy,
      { nx, ny, roughness, metallic },
      lights,
      this.game.ambientLightIntensity
    );

    // Softly compress tint into [0..240] so sprites never blow out when combined with the GLSL shader
    const compress = (v: number): number => v / (1.0 + v * 0.55);
    const r = Math.min(242, Math.max(18, Math.round(compress(lit.r) * fovFactor * 245)));
    const g = Math.min(242, Math.max(20, Math.round(compress(lit.g) * fovFactor * 245)));
    const b = Math.min(246, Math.max(26, Math.round(compress(lit.b) * fovFactor * 250)));
    return (r << 16) | (g << 8) | b;
  }

  private renderFrame(): void {
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

    // 1. Render Isometric Floor Tiles in Painter Order (rx + ry from 0 to rotW + rotH)
    for (let sum = 0; sum <= rotW + rotH - 2; sum++) {
      for (let rx = 0; rx < rotW; rx++) {
        const ry = sum - rx;
        if (ry < 0 || ry >= rotH) continue;

        const worldCoord = toWorldGrid(rx, ry, mapW, mapH, this.rotation);
        const cell = this.game.map.tiles[worldCoord.y][worldCoord.x];
        const texPair = this.getTileTexturePair(cell.terrain, cell.z);
        const scr = gridToScreen(rx + 0.5, ry + 0.5, cell.z);

        const sprite = new Sprite(useNormalTex ? texPair.normalMat : texPair.albedo);
        sprite.anchor.set(texPair.anchorX, texPair.anchorY);
        sprite.position.set(scr.x, scr.y);

        const fovFactor = this.game.fov.getLightFactor(cell.x, cell.y);
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
      const npcHover = this.game.npcs.find((n) => n.tileX === hx && n.tileY === hy);

      const highlightColor =
        npcHover || (propHover && propHover.interactive)
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
        const previewPath =
          this.game.player.path.length > 0
            ? this.game.player.path
            : findPathAStar3D(
                {
                  width: mapW,
                  height: mapH,
                  isWalkable: (tx, ty) => this.game.isTileWalkable(tx, ty, this.game.player.id),
                  getElevation: (tx, ty) => this.game.map.tiles[ty][tx].z
                },
                { x: this.game.player.tileX, y: this.game.player.tileY },
                { x: hx, y: hy }
              );

        for (let i = 0; i < previewPath.length; i++) {
          const step = previewPath[i];
          const rStep = toRotatedGrid(step.x, step.y, mapW, mapH, this.rotation);
          const sPt = gridToScreen(rStep.rx + 0.5, rStep.ry + 0.5, step.z);
          this.cursorAndPathGraphics
            .circle(sPt.x, sPt.y, 5)
            .fill({ color: 0x4deeea, alpha: 0.78 });
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
      const fp = rotateFootprint(
        prop.x,
        prop.y,
        prop.sizeX,
        prop.sizeY,
        mapW,
        mapH,
        this.rotation
      );

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
          const vis = this.game.fov.getVisibility(prop.x, prop.y);
          if (vis === 'unexplored' && this.game.fogOfWarEnabled && this.bufferMode === 'final_pbr') {
            return;
          }

          const texPair = this.getPropTexturePair(
            prop.kind,
            Boolean(prop.isOpen),
            fp.width,
            fp.height
          );
          const scr = gridToScreen(fp.rx + 0.5, fp.ry + 0.5, prop.z);

          // Render Dynamic Tree / Pillar Cast Shadow away from nearest firelight
          if (
            this.bufferMode === 'final_pbr' &&
            (prop.kind === 'pine_tree' || prop.kind === 'ancient_oak' || prop.kind === 'pillar')
          ) {
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
            const treeShadow = new Graphics();
            treeShadow
              .ellipse(scr.x + sdx * 0.55, scr.y + sdy * 0.55, 32, 16)
              .fill({ color: 0x030508, alpha: 0.42 });
            this.sortedObjectLayer.addChild(treeShadow);
          }

          const sp = new Sprite(useNormalTex ? texPair.normalMat : texPair.albedo);
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

          const fovFactor = this.game.fov.getLightFactor(prop.x, prop.y);
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

            const flameGfx = new Graphics();
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
            (prop.kind === 'ground_loot' && !prop.isOpen);

          if (showInteractiveHint && this.bufferMode !== 'depth_dag') {
            const label = new Text({
              text: prop.name,
              style: new TextStyle({
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
              })
            });
            label.anchor.set(0.5, 1);
            label.position.set(scr.x, scr.y - (prop.kind === 'ground_loot' ? 28 : 54));
            this.debugOverlayContainer.addChild(label);
          }

          if (this.bufferMode === 'depth_dag') {
            const badge = new Text({
              text: `#${orderIndex}`,
              style: new TextStyle({
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                fill: 0xffffff,
                stroke: { color: 0x000000, width: 3 }
              })
            });
            badge.anchor.set(0.5);
            badge.position.set(scr.x, scr.y - 36);
            this.debugOverlayContainer.addChild(badge);
          }
        }
      });
    }

    const allActors: ActorEntity[] = [this.game.player, ...this.game.npcs];
    for (const actor of allActors) {
      const rotPos = toRotatedContinuous(actor.x, actor.y, mapW, mapH, this.rotation);
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
          const vis = this.game.fov.getVisibility(actor.tileX, actor.tileY);
          if (
            actor.id !== this.game.player.id &&
            vis !== 'visible' &&
            this.game.fogOfWarEnabled &&
            this.bufferMode === 'final_pbr'
          ) {
            return;
          }

          const scr = gridToScreen(rotPos.rx, rotPos.ry, actor.z);

          // Render Dynamic 2.5D Cast Shadow away from nearest point light
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

            const shadowGfx = new Graphics();
            shadowGfx
              .ellipse(scr.x + shadowOffsetX * 0.45, scr.y + shadowOffsetY * 0.45, 19, 9.5)
              .fill({ color: 0x04060a, alpha: 0.52 });
            if (actor.id === this.game.player.id) {
              // Subtle selection ring under active player hero
              shadowGfx
                .ellipse(scr.x, scr.y, 22, 11)
                .stroke({ color: 0x38ef7d, width: 2, alpha: 0.78 });
            }
            this.sortedObjectLayer.addChild(shadowGfx);
          }

          const charTex = this.getCharacterTextures(actor);
          const rotDir = rotateDirection8(actor.direction, this.rotation);
          const frameIdx = actor.animFrame % 4;
          const tex = useNormalTex
            ? charTex.normalFrames[rotDir][frameIdx]
            : charTex.albedoFrames[rotDir][frameIdx];

          const sp = new Sprite(tex);
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

          // Floating nameplate for story NPCs and Player when hovered or in inspect mode
          const isHovered =
            this.hoveredWorldTile?.x === actor.tileX && this.hoveredWorldTile?.y === actor.tileY;
          if (isHovered || actor.dialogueId || this.bufferMode === 'depth_dag') {
            const labelText =
              this.bufferMode === 'depth_dag'
                ? `#${orderIndex} ${actor.recipe.name}`
                : actor.recipe.name;
            const nameTag = new Text({
              text: labelText,
              style: new TextStyle({
                fontFamily: 'Cinzel, serif',
                fontSize: 12,
                fontWeight: '700',
                fill: actor.id === this.game.player.id ? 0x69f0ae : 0xf5d77f,
                stroke: { color: 0x080a0f, width: 3.5 }
              })
            });
            nameTag.anchor.set(0.5, 1);
            nameTag.position.set(scr.x, scr.y - 74);
            this.debugOverlayContainer.addChild(nameTag);
          }

          // Render Floating cRPG Speech Bubble (e.g. "Jeszcze nie czas iść dalej...")
          if (actor.speechBubbleText) {
            const bubbleText = new Text({
              text: `„${actor.speechBubbleText}”`,
              style: new TextStyle({
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                fontWeight: '700',
                fill: 0xfff6d6,
                stroke: { color: 0x080a0f, width: 4 }
              })
            });
            bubbleText.anchor.set(0.5, 1);
            const bx = scr.x;
            const by = scr.y - 96;
            const padX = 12;
            const padY = 7;
            const bw = bubbleText.width + padX * 2;
            const bh = bubbleText.height + padY * 2;

            const bubbleBg = new Graphics();
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

    // 4. Render Subtle Atmospheric Ember & Firefly Particles in Final PBR Mode (no blinding giant halos)
    if (this.bufferMode === 'final_pbr') {
      for (const p of this.particles) {
        const rotP = toRotatedContinuous(p.x, p.y, mapW, mapH, this.rotation);
        const scrP = gridToScreen(rotP.rx, rotP.ry, p.z);
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.65;
        this.lightingOverlayGraphics
          .circle(scrP.x, scrP.y, p.size)
          .fill({ color: p.color, alpha });
      }
    }
  }
}
