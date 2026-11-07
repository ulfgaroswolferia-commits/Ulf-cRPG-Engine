import { CameraRotation } from '../core/mapRotation';
import { MapId } from '../core/worldMap';
import { IsoSceneView } from '../renderer/isoSceneView';
import { CharacterAttributes, CharacterVisualRecipe } from './characterData';
import { ActorCombatComponent, CombatAttackMode } from './combatSystem';
import { ActorEntity, CrpgGameState } from './gameLoop';
import { EquipSlot, ItemInstance } from './inventorySystem';

export const STORAGE_KEY_AUTOSAVE = 'ulf_crpg_save_autosave';
export const STORAGE_KEY_MANUAL = 'ulf_crpg_save_manual';

export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

class MemoryStorage implements SimpleStorage {
  private data = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  public removeItem(key: string): void {
    this.data.delete(key);
  }
  public clear(): void {
    this.data.clear();
  }
}

const memoryFallback = new MemoryStorage();

export function getStorage(): SimpleStorage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // If access to localStorage is denied (e.g. strict iframe sandboxing), fallback to memory
  }
  return memoryFallback;
}

export interface SerializedNpcState {
  id: string;
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  direction: number;
  combat?: {
    hp: number;
    maxHp: number;
    ap: number;
    maxAp: number;
    isAlive: boolean;
    defending: boolean;
    dazedHeadTurns: number;
    crippledLegsTurns: number;
  };
}

export interface SerializedPropState {
  id: string;
  isOpen?: boolean;
  lootItems?: string[];
}

export interface SerializedGameState {
  version: number;
  timestamp: number;
  mapId: MapId;
  player: {
    x: number;
    y: number;
    z: number;
    tileX: number;
    tileY: number;
    direction: number;
    recipe: CharacterVisualRecipe;
    combat?: ActorCombatComponent;
  };
  baseAttributes: CharacterAttributes;
  backpack: Array<{ slotIndex: number; item: ItemInstance | null }>;
  equipment: Record<EquipSlot, ItemInstance | null>;
  mapProps: SerializedPropState[];
  npcs: SerializedNpcState[];
  logs: string[];
  combatState?: {
    active: boolean;
    round: number;
    participantIds: string[];
    activeTurnActorId: string | null;
    selectedAttackMode: CombatAttackMode;
    selectedTargetId: string | null;
  };
  camera?: {
    rotation: CameraRotation;
    zoom: number;
  };
  settings?: {
    fogOfWarEnabled: boolean;
    wallCutawayEnabled: boolean;
    ambientLightIntensity: number;
  };
}

export function serializeGameState(
  game: CrpgGameState,
  scene?: IsoSceneView
): SerializedGameState {
  const backpackSlots = game.backpack.getSlots().map((item, idx) => ({
    slotIndex: idx,
    item: item ? JSON.parse(JSON.stringify(item)) : null
  }));

  const allEquipped = game.equipmentManager.getAllEquipped();
  const serializedEquipped: Record<EquipSlot, ItemInstance | null> = {
    head: allEquipped.head ? JSON.parse(JSON.stringify(allEquipped.head)) : null,
    cloak: allEquipped.cloak ? JSON.parse(JSON.stringify(allEquipped.cloak)) : null,
    torso: allEquipped.torso ? JSON.parse(JSON.stringify(allEquipped.torso)) : null,
    legs: allEquipped.legs ? JSON.parse(JSON.stringify(allEquipped.legs)) : null,
    mainHand: allEquipped.mainHand ? JSON.parse(JSON.stringify(allEquipped.mainHand)) : null,
    offHand: allEquipped.offHand ? JSON.parse(JSON.stringify(allEquipped.offHand)) : null,
    ring1: allEquipped.ring1 ? JSON.parse(JSON.stringify(allEquipped.ring1)) : null,
    ring2: allEquipped.ring2 ? JSON.parse(JSON.stringify(allEquipped.ring2)) : null
  };

  const mapProps: SerializedPropState[] = game.map.props.map((p) => ({
    id: p.id,
    isOpen: p.isOpen,
    lootItems: p.lootItems ? [...p.lootItems] : undefined
  }));

  const npcs: SerializedNpcState[] = game.npcs.map((n) => ({
    id: n.id,
    tileX: n.tileX,
    tileY: n.tileY,
    x: n.x,
    y: n.y,
    direction: n.direction,
    combat: n.combat
      ? {
          hp: n.combat.hp,
          maxHp: n.combat.maxHp,
          ap: n.combat.ap,
          maxAp: n.combat.maxAp,
          isAlive: n.combat.isAlive,
          defending: n.combat.defending,
          dazedHeadTurns: n.combat.dazedHeadTurns,
          crippledLegsTurns: n.combat.crippledLegsTurns
        }
      : undefined
  }));

  return {
    version: 1,
    timestamp: Date.now(),
    mapId: game.map.id,
    player: {
      x: game.player.x,
      y: game.player.y,
      z: game.player.z,
      tileX: game.player.tileX,
      tileY: game.player.tileY,
      direction: game.player.direction,
      recipe: JSON.parse(JSON.stringify(game.player.recipe)),
      combat: game.player.combat ? JSON.parse(JSON.stringify(game.player.combat)) : undefined
    },
    baseAttributes: game.statSheet.getBaseAttributes(),
    backpack: backpackSlots,
    equipment: serializedEquipped,
    mapProps,
    npcs,
    logs: game.logs.slice(0, 80),
    combatState: {
      active: game.combatState.active,
      round: game.combatState.round,
      participantIds: [...game.combatState.participantIds],
      activeTurnActorId: game.combatState.activeTurnActorId,
      selectedAttackMode: game.combatState.selectedAttackMode,
      selectedTargetId: game.combatState.selectedTargetId
    },
    camera: scene
      ? {
          rotation: scene.rotation,
          zoom: scene.zoom
        }
      : undefined,
    settings: {
      fogOfWarEnabled: game.fogOfWarEnabled,
      wallCutawayEnabled: game.wallCutawayEnabled,
      ambientLightIntensity: game.ambientLightIntensity
    }
  };
}

export function deserializeGameState(
  data: SerializedGameState,
  game: CrpgGameState,
  scene?: IsoSceneView
): boolean {
  try {
    if (!data || typeof data !== 'object' || !data.mapId || !data.player) {
      return false;
    }

    // 1. Load the target map first (initializes map geometry and default entities)
    game.loadMap(data.mapId);

    // 2. Restore map props state
    if (Array.isArray(data.mapProps)) {
      for (const sp of data.mapProps) {
        const prop = game.map.props.find((p) => p.id === sp.id);
        if (prop) {
          if (typeof sp.isOpen === 'boolean') {
            prop.isOpen = sp.isOpen;
            if (prop.linkedLightId) {
              const l = game.map.lights.find((light) => light.id === prop.linkedLightId);
              if (l) l.enabled = Boolean(sp.isOpen);
            }
          }
          if (Array.isArray(sp.lootItems)) {
            prop.lootItems = [...sp.lootItems];
          }
        }
      }
    }

    // 3. Restore NPCs state (including dead enemies and positions)
    if (Array.isArray(data.npcs)) {
      for (const sn of data.npcs) {
        const npc = game.npcs.find((n) => n.id === sn.id);
        if (npc) {
          npc.tileX = sn.tileX;
          npc.tileY = sn.tileY;
          npc.x = sn.x;
          npc.y = sn.y;
          npc.direction = sn.direction as any;
          if (npc.combat && sn.combat) {
            npc.combat.hp = sn.combat.hp;
            npc.combat.maxHp = sn.combat.maxHp;
            npc.combat.ap = sn.combat.ap;
            npc.combat.maxAp = sn.combat.maxAp;
            npc.combat.isAlive = sn.combat.isAlive;
            npc.combat.defending = sn.combat.defending;
            npc.combat.dazedHeadTurns = sn.combat.dazedHeadTurns;
            npc.combat.crippledLegsTurns = sn.combat.crippledLegsTurns;
          }
        }
      }
    }

    // 4. Restore Player attributes & character recipe
    if (data.baseAttributes) {
      game.statSheet.setBaseAttributes(data.baseAttributes);
    }
    if (data.player.recipe) {
      game.player.recipe = {
        ...game.player.recipe,
        ...data.player.recipe
      };
    }

    game.player.tileX = data.player.tileX;
    game.player.tileY = data.player.tileY;
    game.player.x = data.player.x;
    game.player.y = data.player.y;
    game.player.z = data.player.z;
    game.player.direction = data.player.direction as any;
    game.player.path = [];
    game.player.isMoving = false;

    if (game.player.combat && data.player.combat) {
      game.player.combat.hp = data.player.combat.hp;
      game.player.combat.maxHp = data.player.combat.maxHp;
      game.player.combat.ap = data.player.combat.ap;
      game.player.combat.maxAp = data.player.combat.maxAp;
      game.player.combat.defending = data.player.combat.defending;
      game.player.combat.dazedHeadTurns = data.player.combat.dazedHeadTurns;
      game.player.combat.crippledLegsTurns = data.player.combat.crippledLegsTurns;
      if (data.player.combat.proficiencies) {
        game.player.combat.proficiencies = { ...data.player.combat.proficiencies };
      }
    }

    // 5. Restore Inventory & Equipment
    game.equipmentManager.clearAllEquipped();
    game.backpack.clearAllSlots();

    if (data.equipment) {
      const slots = Object.keys(data.equipment) as EquipSlot[];
      for (const slot of slots) {
        const item = data.equipment[slot];
        if (item) {
          game.equipmentManager.equipDirectInstance(item, slot);
        }
      }
    }

    if (Array.isArray(data.backpack)) {
      for (const entry of data.backpack) {
        if (entry.item) {
          game.backpack.setSlot(entry.slotIndex, entry.item);
        }
      }
    }

    // 6. Restore Combat session state
    if (data.combatState) {
      game.combatState.active = Boolean(data.combatState.active);
      game.combatState.round = data.combatState.round || 1;
      game.combatState.participantIds = Array.isArray(data.combatState.participantIds)
        ? [...data.combatState.participantIds]
        : [];
      game.combatState.activeTurnActorId = data.combatState.activeTurnActorId;
      game.combatState.selectedAttackMode = data.combatState.selectedAttackMode || 'quick';
      game.combatState.selectedTargetId = data.combatState.selectedTargetId;
    }

    // 7. Restore Logs
    if (Array.isArray(data.logs) && data.logs.length > 0) {
      game.logs.length = 0;
      game.logs.push(...data.logs);
    }

    // 8. Restore Settings
    if (data.settings) {
      game.fogOfWarEnabled = data.settings.fogOfWarEnabled ?? game.fogOfWarEnabled;
      game.wallCutawayEnabled = data.settings.wallCutawayEnabled ?? game.wallCutawayEnabled;
      game.ambientLightIntensity = data.settings.ambientLightIntensity ?? game.ambientLightIntensity;
    }

    // 9. Restore Camera
    if (scene && data.camera) {
      scene.setRotation(data.camera.rotation);
      if (typeof data.camera.zoom === 'number') {
        scene.zoom = data.camera.zoom;
      }
      scene.centerCameraOnPlayer();
    }

    game.recomputeFov();
    return true;
  } catch (err) {
    console.error('Błąd podczas deserializacji stanu gry:', err);
    return false;
  }
}

export function saveGame(
  game: CrpgGameState,
  scene?: IsoSceneView,
  slot: 'autosave' | 'manual' = 'autosave'
): boolean {
  try {
    const storage = getStorage();
    const key = slot === 'manual' ? STORAGE_KEY_MANUAL : STORAGE_KEY_AUTOSAVE;
    const serialized = serializeGameState(game, scene);
    storage.setItem(key, JSON.stringify(serialized));
    return true;
  } catch (err) {
    console.warn(`Nie udało się zapisać gry do localStorage (${slot}):`, err);
    return false;
  }
}

export function loadGame(
  game: CrpgGameState,
  scene?: IsoSceneView,
  slot: 'autosave' | 'manual' = 'autosave'
): boolean {
  try {
    const storage = getStorage();
    const key = slot === 'manual' ? STORAGE_KEY_MANUAL : STORAGE_KEY_AUTOSAVE;
    const raw = storage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SerializedGameState;
    return deserializeGameState(parsed, game, scene);
  } catch (err) {
    console.warn(`Nie udało się wczytać gry z localStorage (${slot}):`, err);
    return false;
  }
}

export function hasSavedGame(slot: 'autosave' | 'manual' = 'autosave'): boolean {
  try {
    const storage = getStorage();
    const key = slot === 'manual' ? STORAGE_KEY_MANUAL : STORAGE_KEY_AUTOSAVE;
    return Boolean(storage.getItem(key));
  } catch {
    return false;
  }
}

export function clearSave(slot: 'autosave' | 'manual' | 'all' = 'autosave'): void {
  try {
    const storage = getStorage();
    if (slot === 'all' || slot === 'autosave') {
      storage.removeItem(STORAGE_KEY_AUTOSAVE);
    }
    if (slot === 'all' || slot === 'manual') {
      storage.removeItem(STORAGE_KEY_MANUAL);
    }
  } catch (err) {
    console.warn('Nie udało się wyczyścić zapisu w storage:', err);
  }
}
