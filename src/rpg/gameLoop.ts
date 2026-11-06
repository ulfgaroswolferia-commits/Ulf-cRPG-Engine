import { generateRandomCharacterRecipe } from '../assets/characterBakery';
import { computeFieldOfView, FovGridState } from '../core/fov';
import { Direction8, WorldGridPoint } from '../core/mapRotation';
import { deltaToDirection8, findPathAStar3D, PathStepNode } from '../core/pathfinding';
import { createSanctumWorldMap, IsometricWorldMap, WorldPropEntity } from '../core/worldMap';
import {
  CharacterVisualRecipe,
  EQUIPMENT_CATALOG,
  EquipmentSlot
} from './characterData';
import { DIALOGUE_TREES, DialogueChoice, DialogueNode } from './dialogueSystem';

export interface ActorEntity {
  id: string;
  recipe: CharacterVisualRecipe;
  x: number; // Continuous world X (tile center is floor(x) + 0.5)
  y: number; // Continuous world Y
  z: number; // Continuous world Z
  tileX: number;
  tileY: number;
  direction: Direction8;
  isMoving: boolean;
  animFrame: number;
  animTimer: number;
  path: PathStepNode[];
  dialogueId?: string;
  patrolPoints?: WorldGridPoint[];
  patrolIndex?: number;
  patrolWaitTimer?: number;
  pendingInteractionPropId?: string | null;
  pendingDialogueActorId?: string | null;
}

export class CrpgGameState {
  public readonly map: IsometricWorldMap;
  public readonly fov: FovGridState;
  public readonly player: ActorEntity;
  public readonly npcs: ActorEntity[] = [];
  public readonly inventory: string[] = [
    'torso_warden_brigandine',
    'torso_aethel_plate',
    'torso_archmage_robes',
    'torso_linen_tunic',
    'helm_dread_plate',
    'helm_shadow_hood',
    'helm_arcane_circlet',
    'cloak_crimson_mantle',
    'cloak_steel_pauldrons',
    'legs_steel_greaves',
    'legs_leather_boots',
    'weapon_sunblade_longsword',
    'weapon_Executioner_axe',
    'weapon_astral_staff',
    'offhand_heraldic_shield',
    'offhand_torch',
    'offhand_grimoire'
  ];
  public readonly logs: string[] = [];
  public activeDialogue: { actorId: string; node: DialogueNode } | null = null;
  public fogOfWarEnabled = true;
  public wallCutawayEnabled = true;
  public ambientLightIntensity = 0.42;

  constructor() {
    this.map = createSanctumWorldMap();
    this.fov = new FovGridState(this.map.width, this.map.height);

    const playerRecipe: CharacterVisualRecipe = {
      id: 'player_hero',
      name: 'Kaelen Vane',
      title: 'Wysłannik Żelaznej Korony',
      seed: 1001,
      skinTone: { r: 232, g: 194, b: 164 },
      hairColor: { r: 36, g: 28, b: 24 },
      hairStyle: 'noble_crest',
      equipment: {
        head: null,
        torso: 'torso_warden_brigandine',
        cloak: 'cloak_crimson_mantle',
        legs: 'legs_steel_greaves',
        mainHand: 'weapon_sunblade_longsword',
        offHand: 'offhand_torch'
      },
      attributes: {
        might: 15,
        finesse: 13,
        resolve: 14,
        lore: 14,
        perception: 15
      }
    };

    const startX = 4;
    const startY = 4;
    this.player = {
      id: 'player_hero',
      recipe: playerRecipe,
      x: startX + 0.5,
      y: startY + 0.5,
      z: this.map.tiles[startY][startX].z,
      tileX: startX,
      tileY: startY,
      direction: 3, // SE
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: []
    };

    this.initStoryNpcs();
    this.recomputeFov();
    this.addLog('Witaj w Sanktuarium Zatopionej Korony. Kliknij LPM na kafel, aby się poruszyć, lub na obiekt/NPC, aby wejść w interakcję.');
    this.addLog('Obracaj kamerę 2.5D o 90° klawiszami Q / E lub przyciskami na górnym pasku.');
  }

  private initStoryNpcs(): void {
    // 1. Captain Vaelen near the courtyard stairs
    const vaelenRecipe = generateRandomCharacterRecipe(202, 'npc_vaelen');
    vaelenRecipe.name = 'Kapitan Vaelen';
    vaelenRecipe.title = 'Dowódca Straży Dziedzińca';
    vaelenRecipe.equipment = {
      head: 'helm_dread_plate',
      torso: 'torso_aethel_plate',
      cloak: 'cloak_steel_pauldrons',
      legs: 'legs_steel_greaves',
      mainHand: 'weapon_sunblade_longsword',
      offHand: 'offhand_heraldic_shield'
    };
    this.npcs.push({
      id: 'npc_vaelen',
      recipe: vaelenRecipe,
      x: 6.5,
      y: 5.5,
      z: this.map.tiles[5][6].z,
      tileX: 6,
      tileY: 5,
      direction: 4,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_vaelen'
    });

    // 2. Scholar Lyra at the Central Arcane Plaza
    const lyraRecipe = generateRandomCharacterRecipe(303, 'npc_lyra');
    lyraRecipe.name = 'Uczona Lyra';
    lyraRecipe.title = 'Kronikarka Astralna';
    lyraRecipe.equipment = {
      head: 'helm_arcane_circlet',
      torso: 'torso_archmage_robes',
      cloak: 'cloak_crimson_mantle',
      legs: 'legs_leather_boots',
      mainHand: 'weapon_astral_staff',
      offHand: 'offhand_grimoire'
    };
    this.npcs.push({
      id: 'npc_lyra',
      recipe: lyraRecipe,
      x: 10.5,
      y: 10.5,
      z: this.map.tiles[10][10].z,
      tileX: 10,
      tileY: 10,
      direction: 5,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_lyra'
    });

    // 3. Patrolling Warden Guard
    const patrolRecipe = generateRandomCharacterRecipe(408, 'npc_warden_patrol');
    patrolRecipe.name = 'Strażnik Aldric';
    patrolRecipe.title = 'Patrol Sanktuarium';
    this.npcs.push({
      id: 'npc_warden_patrol',
      recipe: patrolRecipe,
      x: 9.5,
      y: 13.5,
      z: this.map.tiles[13][9].z,
      tileX: 9,
      tileY: 13,
      direction: 2,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      patrolPoints: [
        { x: 9, y: 13 },
        { x: 14, y: 14 },
        { x: 11, y: 8 }
      ],
      patrolIndex: 0,
      patrolWaitTimer: 1.5
    });
  }

  public addLog(message: string): void {
    this.logs.unshift(message);
    if (this.logs.length > 40) {
      this.logs.pop();
    }
  }

  public getPropAtTile(x: number, y: number): WorldPropEntity | undefined {
    return this.map.props.find(
      (p) => x >= p.x && x < p.x + p.sizeX && y >= p.y && y < p.y + p.sizeY
    );
  }

  public isTileWalkable(x: number, y: number, ignoreActorId?: string): boolean {
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return false;
    const cell = this.map.tiles[y][x];
    if (!cell.walkable) return false;

    const prop = this.getPropAtTile(x, y);
    if (prop) {
      if (prop.kind === 'door') {
        if (!prop.isOpen) return false;
      } else if (prop.blocksMovement) {
        return false;
      }
    }

    for (const npc of this.npcs) {
      if (npc.id !== ignoreActorId && npc.tileX === x && npc.tileY === y) {
        return false;
      }
    }

    return true;
  }

  public isTileOpaque(x: number, y: number): boolean {
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) return true;
    const prop = this.getPropAtTile(x, y);
    if (!prop) return false;
    if (prop.kind === 'door') {
      return !prop.isOpen;
    }
    return prop.blocksSight;
  }

  public recomputeFov(): void {
    if (!this.fogOfWarEnabled) {
      this.fov.revealAll();
      return;
    }
    computeFieldOfView(this.fov, this.player.tileX, this.player.tileY, 8.5, (x, y) =>
      this.isTileOpaque(x, y)
    );
  }

  public commandPlayerMoveTo(targetX: number, targetY: number): boolean {
    this.player.pendingInteractionPropId = null;
    this.player.pendingDialogueActorId = null;

    const path = findPathAStar3D(
      {
        width: this.map.width,
        height: this.map.height,
        isWalkable: (x, y) => this.isTileWalkable(x, y, this.player.id),
        getElevation: (x, y) => this.map.tiles[y][x].z
      },
      { x: this.player.tileX, y: this.player.tileY },
      { x: targetX, y: targetY }
    );

    if (path.length <= 1) return false;
    this.player.path = path.slice(1);
    this.player.isMoving = true;
    return true;
  }

  public findBestAdjacentWalkableTile(
    centerX: number,
    centerY: number,
    sizeX = 1,
    sizeY = 1
  ): WorldGridPoint | null {
    const candidates: WorldGridPoint[] = [];
    for (let y = centerY - 1; y <= centerY + sizeY; y++) {
      for (let x = centerX - 1; x <= centerX + sizeX; x++) {
        const insideFootprint =
          x >= centerX && x < centerX + sizeX && y >= centerY && y < centerY + sizeY;
        if (!insideFootprint && this.isTileWalkable(x, y, this.player.id)) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - this.player.tileX, a.y - this.player.tileY) -
        Math.hypot(b.x - this.player.tileX, b.y - this.player.tileY)
    );
    return candidates[0];
  }

  public commandInteractWithProp(propId: string): void {
    const prop = this.map.props.find((p) => p.id === propId);
    if (!prop || !prop.interactive) return;

    const dist = Math.hypot(prop.x - this.player.tileX, prop.y - this.player.tileY);
    if (dist <= 1.8) {
      this.togglePropInteraction(prop.id);
      return;
    }

    const adj = this.findBestAdjacentWalkableTile(prop.x, prop.y, prop.sizeX, prop.sizeY);
    if (adj && this.commandPlayerMoveTo(adj.x, adj.y)) {
      this.player.pendingInteractionPropId = prop.id;
    }
  }

  public commandTalkToNpc(npcId: string): void {
    const npc = this.npcs.find((n) => n.id === npcId);
    if (!npc) return;

    const dist = Math.hypot(npc.tileX - this.player.tileX, npc.tileY - this.player.tileY);
    if (dist <= 1.8) {
      this.startDialogueWithNpc(npc.id);
      return;
    }

    const adj = this.findBestAdjacentWalkableTile(npc.tileX, npc.tileY, 1, 1);
    if (adj && this.commandPlayerMoveTo(adj.x, adj.y)) {
      this.player.pendingDialogueActorId = npc.id;
    }
  }

  public togglePropInteraction(propId: string): void {
    const prop = this.map.props.find((p) => p.id === propId);
    if (!prop) return;

    if (prop.kind === 'door') {
      prop.isOpen = !prop.isOpen;
      this.addLog(`${prop.name}: ${prop.isOpen ? 'otwarto' : 'zamknięto'}.`);
      this.recomputeFov();
      return;
    }

    if (prop.kind === 'chest') {
      if (!prop.isOpen) {
        prop.isOpen = true;
        const loot = prop.lootItems ?? [];
        for (const itemId of loot) {
          if (!this.inventory.includes(itemId)) {
            this.inventory.push(itemId);
          }
        }
        const names = loot.map((id) => EQUIPMENT_CATALOG[id]?.name ?? id).join(', ');
        this.addLog(`Otwarto ${prop.name}! Znaleziono: ${names || 'starożytne monety'}.`);
      } else {
        this.addLog(`${prop.name} jest już opróżniona.`);
      }
      return;
    }

    if (prop.kind === 'torch_sconce' || prop.kind === 'arcane_crystal') {
      prop.isOpen = !prop.isOpen;
      if (prop.linkedLightId) {
        const light = this.map.lights.find((l) => l.id === prop.linkedLightId);
        if (light) {
          light.enabled = Boolean(prop.isOpen);
        }
      }
      this.addLog(
        `${prop.name}: ${prop.isOpen ? 'rozpalono płomień / aktywowano blask' : 'wygaszono źródło światła'}.`
      );
      return;
    }

    if (prop.kind === 'runic_altar' || prop.kind === 'sarcophagus') {
      this.addLog(
        `Zbadano ${prop.name}: starożytne płaskorzeźby opisują rytuał Zatopionej Korony (+1 Wiedza Tajemna).`
      );
      this.player.recipe.attributes.lore += 1;
    }
  }

  public startDialogueWithNpc(npcId: string): void {
    const npc = this.npcs.find((n) => n.id === npcId);
    if (!npc) return;

    // Face each other
    this.player.direction = deltaToDirection8(npc.tileX - this.player.tileX, npc.tileY - this.player.tileY);
    npc.direction = deltaToDirection8(this.player.tileX - npc.tileX, this.player.tileY - npc.tileY);

    const tree = npc.dialogueId ? DIALOGUE_TREES[npc.dialogueId] : undefined;
    if (!tree) {
      this.addLog(`${npc.recipe.name} (${npc.recipe.title}): „Czuwam nad bezpieczeństwem Sanktuarium.”`);
      return;
    }

    this.activeDialogue = {
      actorId: npc.id,
      node: tree.root
    };
  }

  public selectDialogueChoice(choice: DialogueChoice): void {
    if (!this.activeDialogue) return;

    if (choice.unlocksDoorId) {
      const door = this.map.props.find((p) => p.id === choice.unlocksDoorId);
      if (door && !door.isOpen) {
        door.isOpen = true;
        this.recomputeFov();
      }
    }

    if (choice.grantsItemId) {
      if (!this.inventory.includes(choice.grantsItemId)) {
        this.inventory.push(choice.grantsItemId);
      }
      this.equipInventoryItem(choice.grantsItemId);
    }

    if (choice.logMessage) {
      this.addLog(choice.logMessage);
    }

    if (!choice.nextNodeId) {
      this.activeDialogue = null;
      return;
    }

    const npc = this.npcs.find((n) => n.id === this.activeDialogue?.actorId);
    const tree = npc?.dialogueId ? DIALOGUE_TREES[npc.dialogueId] : undefined;
    const nextNode = tree?.[choice.nextNodeId];
    if (nextNode) {
      this.activeDialogue = { actorId: this.activeDialogue.actorId, node: nextNode };
    } else {
      this.activeDialogue = null;
    }
  }

  public equipInventoryItem(itemId: string): boolean {
    const item = EQUIPMENT_CATALOG[itemId];
    if (!item) return false;

    const slot: EquipmentSlot = item.slot;
    const nextEquipment = { ...this.player.recipe.equipment };

    // Toggle off if optional slot and already equipped
    if (
      (slot === 'head' || slot === 'cloak' || slot === 'mainHand' || slot === 'offHand') &&
      nextEquipment[slot] === itemId
    ) {
      nextEquipment[slot] = null;
      this.player.recipe = { ...this.player.recipe, equipment: nextEquipment };
      this.addLog(`Zdjęto z wyposażenia: ${item.name}.`);
      return true;
    }

    nextEquipment[slot] = itemId;
    this.player.recipe = { ...this.player.recipe, equipment: nextEquipment };
    this.addLog(`Założono wyposażenie: ${item.name} (przepieczono teksturę izometryczną postaci).`);
    return true;
  }

  public spawnRandomNpc(seed = Math.floor(Math.random() * 90000) + 1000): ActorEntity | null {
    const recipe = generateRandomCharacterRecipe(seed);
    // Find a walkable tile near the center plaza or courtyard
    for (let radius = 1; radius < 10; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = 9 + dx;
          const ty = 10 + dy;
          if (
            this.isTileWalkable(tx, ty) &&
            (tx !== this.player.tileX || ty !== this.player.tileY)
          ) {
            const npc: ActorEntity = {
              id: `npc_rand_${seed}_${this.npcs.length}`,
              recipe,
              x: tx + 0.5,
              y: ty + 0.5,
              z: this.map.tiles[ty][tx].z,
              tileX: tx,
              tileY: ty,
              direction: ((seed % 8) as Direction8),
              isMoving: false,
              animFrame: 0,
              animTimer: 0,
              path: []
            };
            this.npcs.push(npc);
            this.addLog(
              `Wygenerowano nową postać izometryczną: ${recipe.name} (${recipe.title}, seed #${seed}).`
            );
            return npc;
          }
        }
      }
    }
    return null;
  }

  public update(dtSeconds: number): void {
    this.updateActorMovement(this.player, dtSeconds, 3.8, true);

    for (const npc of this.npcs) {
      if (!npc.isMoving && npc.patrolPoints && npc.patrolPoints.length > 1) {
        npc.patrolWaitTimer = (npc.patrolWaitTimer ?? 1.5) - dtSeconds;
        if (npc.patrolWaitTimer <= 0) {
          npc.patrolIndex = ((npc.patrolIndex ?? 0) + 1) % npc.patrolPoints.length;
          const target = npc.patrolPoints[npc.patrolIndex];
          const path = findPathAStar3D(
            {
              width: this.map.width,
              height: this.map.height,
              isWalkable: (x, y) =>
                this.isTileWalkable(x, y, npc.id) &&
                (x !== this.player.tileX || y !== this.player.tileY),
              getElevation: (x, y) => this.map.tiles[y][x].z
            },
            { x: npc.tileX, y: npc.tileY },
            target
          );
          if (path.length > 1) {
            npc.path = path.slice(1);
            npc.isMoving = true;
          }
          npc.patrolWaitTimer = 2.8;
        }
      }
      this.updateActorMovement(npc, dtSeconds, 2.1, false);
    }
  }

  private updateActorMovement(
    actor: ActorEntity,
    dt: number,
    speedTilesPerSec: number,
    isPlayer: boolean
  ): void {
    if (!actor.isMoving || actor.path.length === 0) {
      actor.isMoving = false;
      actor.animFrame = 0;
      return;
    }

    const nextNode = actor.path[0];
    const targetX = nextNode.x + 0.5;
    const targetY = nextNode.y + 0.5;
    const targetZ = nextNode.z;

    const dx = targetX - actor.x;
    const dy = targetY - actor.y;
    const dist = Math.hypot(dx, dy);

    actor.direction = nextNode.direction;
    actor.animTimer += dt * speedTilesPerSec * 2.6;
    actor.animFrame = (Math.floor(actor.animTimer) % 3) + 1;

    const step = speedTilesPerSec * dt;
    if (dist <= step) {
      actor.x = targetX;
      actor.y = targetY;
      actor.z = targetZ;
      actor.tileX = nextNode.x;
      actor.tileY = nextNode.y;
      actor.path.shift();
      if (isPlayer) {
        this.recomputeFov();
      }

      if (actor.path.length === 0) {
        actor.isMoving = false;
        actor.animFrame = 0;
        if (isPlayer) {
          if (actor.pendingInteractionPropId) {
            const propId = actor.pendingInteractionPropId;
            actor.pendingInteractionPropId = null;
            this.togglePropInteraction(propId);
          }
          if (actor.pendingDialogueActorId) {
            const npcId = actor.pendingDialogueActorId;
            actor.pendingDialogueActorId = null;
            this.startDialogueWithNpc(npcId);
          }
        }
      }
    } else {
      actor.x += (dx / dist) * step;
      actor.y += (dy / dist) * step;
      actor.z += (targetZ - actor.z) * Math.min(1, step * 4);
    }
  }
}
