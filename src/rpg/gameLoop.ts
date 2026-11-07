import { generateRandomCharacterRecipe } from '../assets/characterBakery';
import { computeFieldOfView, FovGridState } from '../core/fov';
import { Direction8, WorldGridPoint } from '../core/mapRotation';
import { deltaToDirection8, findPathAStar3D, PathStepNode } from '../core/pathfinding';
import {
  createForestClearingMap,
  createSanctumWorldMap,
  createSlavicVillageMap,
  IsometricWorldMap,
  MapId,
  WorldPropEntity
} from '../core/worldMap';
import {
  CharacterVisualRecipe,
  EQUIPMENT_CATALOG
} from './characterData';
import {
  ActorCombatComponent,
  ATTACK_MODE_META,
  CombatantSnapshot,
  CombatAttackMode,
  CombatAttackOutcome,
  computeAttackPreview,
  computeDerivedCombatStats,
  createDefaultProficiencies,
  PROFICIENCY_META,
  resolveCombatAttack,
  TurnBasedCombatSession
} from './combatSystem';
import { DIALOGUE_TREES, DialogueChoice, DialogueNode } from './dialogueSystem';
import {
  CharacterStatSheet,
  createItemInstance,
  EquipmentManager,
  EquipOperationResult,
  EquipSlot,
  getAllItemModifiers,
  getItemDefinition,
  InventoryContainer,
  StatType
} from './inventorySystem';

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
  speechBubbleText?: string | null;
  speechBubbleTimer?: number;
  dialogueId?: string;
  patrolPoints?: WorldGridPoint[];
  patrolIndex?: number;
  patrolWaitTimer?: number;
  pendingInteractionPropId?: string | null;
  pendingDialogueActorId?: string | null;
  pendingAttackTargetId?: string | null;
  combat?: ActorCombatComponent;
}

export class CrpgGameState {
  public map!: IsometricWorldMap;
  public fov!: FovGridState;
  public player!: ActorEntity;
  public readonly npcs: ActorEntity[] = [];
  public readonly statSheet: CharacterStatSheet;
  public readonly backpack: InventoryContainer;
  public readonly equipmentManager: EquipmentManager;
  public readonly combatState: TurnBasedCombatSession = {
    active: false,
    round: 1,
    participantIds: [],
    activeTurnActorId: null,
    selectedAttackMode: 'quick',
    selectedTargetId: null,
    floatingTexts: []
  };
  public readonly logs: string[] = [];
  public activeDialogue: { actorId: string; node: DialogueNode } | null = null;
  public fogOfWarEnabled = true;
  public wallCutawayEnabled = true;
  public ambientLightIntensity = 0.46;

  /**
   * Returns a flat list of all definitionIds currently held in the backpack or equipped,
   * preserving backward-compatibility with existing map/quest checks.
   */
  public get inventory(): string[] {
    const ids: string[] = [];
    for (const entry of this.backpack.getOccupiedSlots()) {
      if (entry.item) {
        ids.push(entry.item.definitionId);
      }
    }
    for (const eq of Object.values(this.equipmentManager.getAllEquipped())) {
      if (eq && !ids.includes(eq.definitionId)) {
        ids.push(eq.definitionId);
      }
    }
    return ids;
  }

  constructor(initialMapId: MapId = 'forest_clearing') {
    const baseAttrs = {
      might: 15,
      finesse: 13,
      resolve: 14,
      lore: 14,
      perception: 15
    };

    const playerRecipe: CharacterVisualRecipe = {
      id: 'player_hero',
      name: 'Kaelen Vane',
      title: 'Wędrowiec z Wilczego Szlaku',
      seed: 1001,
      skinTone: { r: 232, g: 194, b: 164 },
      hairColor: { r: 36, g: 28, b: 24 },
      hairStyle: 'noble_crest',
      equipment: {
        head: null,
        torso: 'torso_warden_brigandine',
        cloak: null,
        legs: 'legs_leather_boots',
        mainHand: 'weapon_sunblade_longsword',
        offHand: 'offhand_torch'
      },
      attributes: { ...baseAttrs }
    };

    this.player = {
      id: 'player_hero',
      recipe: playerRecipe,
      x: 15.5,
      y: 17.5,
      z: 0,
      tileX: 15,
      tileY: 17,
      direction: 0,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      speechBubbleText: null,
      speechBubbleTimer: 0,
      combat: {
        isHostile: false,
        aggroRadius: 0,
        hp: 215,
        maxHp: 215,
        ap: 11,
        maxAp: 11,
        proficiencies: createDefaultProficiencies(),
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 0,
        lootTable: [],
        isAlive: true
      }
    };

    this.statSheet = new CharacterStatSheet(baseAttrs);
    this.backpack = new InventoryContainer(20, this.statSheet.getMaxCarryWeight());
    this.equipmentManager = new EquipmentManager(this.backpack, this.statSheet);

    const syncPlayerCombatMax = (): void => {
      if (!this.player?.combat) return;
      const derived = computeDerivedCombatStats(
        this.statSheet,
        this.player.combat.proficiencies,
        this.player.recipe.equipment.mainHand,
        this.player.recipe.equipment.offHand,
        this.player.combat.defending,
        this.player.combat.dazedHeadTurns > 0
      );
      const prevMaxHp = this.player.combat.maxHp;
      this.player.combat.maxHp = derived.maxHp;
      if (this.player.combat.hp > derived.maxHp || this.player.combat.hp === prevMaxHp) {
        this.player.combat.hp = derived.maxHp;
      }
      this.player.combat.maxAp = derived.maxAp;
      if (!this.combatState.active) {
        this.player.combat.ap = derived.maxAp;
      } else {
        this.player.combat.ap = Math.min(this.player.combat.ap, derived.maxAp);
      }
    };

    // Sync CharacterStatSheet and Visual Paperdoll whenever equipment or stats change
    this.statSheet.onStatsChanged(() => {
      this.backpack.maxWeight = this.statSheet.getMaxCarryWeight();
      if (this.player) {
        this.player.recipe = {
          ...this.player.recipe,
          attributes: this.statSheet.getEffectiveAttributes()
        };
      }
      syncPlayerCombatMax();
    });

    this.equipmentManager.onEquipmentChanged(() => {
      if (this.player) {
        this.player.recipe = {
          ...this.player.recipe,
          equipment: this.equipmentManager.toVisualLoadout(),
          attributes: this.statSheet.getEffectiveAttributes()
        };
      }
      syncPlayerCombatMax();
    });

    // Equip starter gear
    this.equipmentManager.equipDirectInstance(createItemInstance('torso_warden_brigandine', 1), 'torso');
    this.equipmentManager.equipDirectInstance(createItemInstance('legs_leather_boots', 1), 'legs');
    this.equipmentManager.equipDirectInstance(createItemInstance('weapon_sunblade_longsword', 1), 'mainHand');
    this.equipmentManager.equipDirectInstance(createItemInstance('offhand_torch', 1), 'offHand');
    this.equipmentManager.equipDirectInstance(createItemInstance('ring_wolf_signet', 1), 'ring1');

    // Add initial items to backpack for immediate comparison & loadout customization
    this.backpack.tryAddItem(createItemInstance('torso_linen_tunic', 1), true);
    this.backpack.tryAddItem(createItemInstance('helm_shadow_hood', 1), true);
    this.backpack.tryAddItem(createItemInstance('offhand_heraldic_shield', 1), true);
    this.backpack.tryAddItem(createItemInstance('ring_emerald_seal', 1), true);

    this.loadMap(initialMapId);
  }

  public loadMap(mapId: MapId): void {
    this.map =
      mapId === 'forest_clearing'
        ? createForestClearingMap()
        : mapId === 'slavic_village'
          ? createSlavicVillageMap()
          : createSanctumWorldMap();
    this.fov = new FovGridState(this.map.width, this.map.height);
    this.npcs.length = 0;
    this.activeDialogue = null;
    this.combatState.active = false;
    this.combatState.round = 1;
    this.combatState.participantIds = [];
    this.combatState.activeTurnActorId = null;
    this.combatState.selectedTargetId = null;
    this.combatState.floatingTexts = [];

    const startX = mapId === 'forest_clearing' ? 15 : mapId === 'slavic_village' ? 16 : 4;
    const startY = mapId === 'forest_clearing' ? 17 : mapId === 'slavic_village' ? 20 : 4;
    this.player.tileX = startX;
    this.player.tileY = startY;
    this.player.x = startX + 0.5;
    this.player.y = startY + 0.5;
    this.player.z = this.map.tiles[startY][startX].z;
    this.player.path = [];
    this.player.isMoving = false;
    this.player.speechBubbleText = null;
    this.player.speechBubbleTimer = 0;

    if (mapId === 'forest_clearing') {
      this.initForestClearingNpcs();
      this.addLog(
        'Witaj na Polanie Wilczego Ognia (32×32). Podnieś porozrzucany ekwipunek oraz Surową Kiełbasę, upiecz ją na ognisku lub ruszaj drogowskazem do Słowiańskiej Osady!'
      );
    } else if (mapId === 'slavic_village') {
      this.initSlavicVillageNpcs();
      this.addLog(
        'Witaj w Osadzie Żerców — Targowisko pod Światowidem (32×32). Obejrzyj kramy kupieckie, porozmawiaj z Kupcem Dobromirem i odwiedź Święty Gaj na wzgórzu!'
      );
    } else {
      this.initSanctumNpcs();
      this.addLog('Przeniesiono do lokacji: Sanktuarium Zatopionej Korony (20×20).');
    }

    this.recomputeFov();
  }

  private initSlavicVillageNpcs(): void {
    // 0. Sovereign King Gniewomir at the southern market square (verbal collapse dialogue)
    const gniewkoRecipe = generateRandomCharacterRecipe(488, 'npc_gniewko');
    gniewkoRecipe.name = 'Król Gniewomir';
    gniewkoRecipe.title = 'Suweren Pogranicza';
    gniewkoRecipe.equipment = {
      head: 'helm_arcane_circlet',
      torso: 'torso_aethel_plate',
      cloak: 'cloak_crimson_mantle',
      legs: 'legs_steel_greaves',
      mainHand: 'weapon_sunblade_longsword',
      offHand: null
    };
    this.npcs.push({
      id: 'npc_gniewko',
      recipe: gniewkoRecipe,
      x: 15.5,
      y: 18.5,
      z: this.map.tiles[18][15].z,
      tileX: 15,
      tileY: 18,
      direction: 4,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_gniewko'
    });

    // 1. Merchant Dobromir at the central market stall
    const dobromirRecipe = generateRandomCharacterRecipe(512, 'npc_dobromir');
    dobromirRecipe.name = 'Kupiec Dobromir';
    dobromirRecipe.title = 'Starszy Targowiska pod Światowidem';
    dobromirRecipe.equipment = {
      head: 'helm_shadow_hood',
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_crimson_mantle',
      legs: 'legs_leather_boots',
      mainHand: null,
      offHand: 'offhand_grimoire'
    };
    this.npcs.push({
      id: 'npc_dobromir',
      recipe: dobromirRecipe,
      x: 14.5,
      y: 14.5,
      z: this.map.tiles[14][14].z,
      tileX: 14,
      tileY: 14,
      direction: 4,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_dobromir'
    });

    // 2. Blacksmith Bożydar by the eastern market stall & forge
    const bozydarRecipe = generateRandomCharacterRecipe(576, 'npc_bozydar');
    bozydarRecipe.name = 'Płatnerz Bożydar';
    bozydarRecipe.title = 'Kowal Grodowy';
    bozydarRecipe.equipment = {
      head: null,
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_steel_pauldrons',
      legs: 'legs_steel_greaves',
      mainHand: 'weapon_Executioner_axe',
      offHand: null
    };
    this.npcs.push({
      id: 'npc_bozydar',
      recipe: bozydarRecipe,
      x: 18.5,
      y: 14.5,
      z: this.map.tiles[14][18].z,
      tileX: 18,
      tileY: 14,
      direction: 5,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_bozydar'
    });

    // 3. Pagan Priest (Żerca) Radogost on the Sacred Grove hill of Światowid
    const radogostRecipe = generateRandomCharacterRecipe(618, 'npc_radogost');
    radogostRecipe.name = 'Żerca Radogost';
    radogostRecipe.title = 'Strażnik Świętego Gaju Światowida';
    radogostRecipe.equipment = {
      head: 'helm_arcane_circlet',
      torso: 'torso_archmage_robes',
      cloak: 'cloak_crimson_mantle',
      legs: 'legs_leather_boots',
      mainHand: 'weapon_astral_staff',
      offHand: null
    };
    this.npcs.push({
      id: 'npc_radogost',
      recipe: radogostRecipe,
      x: 8.5,
      y: 8.5,
      z: this.map.tiles[8][8].z,
      tileX: 8,
      tileY: 8,
      direction: 3,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_radogost'
    });

    // 3. Town Guard Miłosz patrolling the marketplace and cottages
    const miloszRecipe = generateRandomCharacterRecipe(724, 'npc_milosz_patrol');
    miloszRecipe.name = 'Drużynnik Miłosz';
    miloszRecipe.title = 'Strażnik Grodowy';
    miloszRecipe.equipment = {
      head: 'helm_dread_plate',
      torso: 'torso_aethel_plate',
      cloak: 'cloak_steel_pauldrons',
      legs: 'legs_steel_greaves',
      mainHand: 'weapon_sunblade_longsword',
      offHand: 'offhand_heraldic_shield'
    };
    this.npcs.push({
      id: 'npc_milosz_patrol',
      recipe: miloszRecipe,
      x: 18.5,
      y: 17.5,
      z: this.map.tiles[17][18].z,
      tileX: 18,
      tileY: 17,
      direction: 2,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      patrolPoints: [
        { x: 18, y: 17 },
        { x: 15, y: 12 },
        { x: 12, y: 16 },
        { x: 17, y: 20 }
      ],
      patrolIndex: 0,
      patrolWaitTimer: 1.5
    });
  }

  private initForestClearingNpcs(): void {
    // 1. Captain Vaelen resting by the campfire
    const vaelenRecipe = generateRandomCharacterRecipe(202, 'npc_vaelen');
    vaelenRecipe.name = 'Kapitan Vaelen';
    vaelenRecipe.title = 'Zwiadowca Puszczy';
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
      x: 16.5,
      y: 14.5,
      z: this.map.tiles[14][16].z,
      tileX: 16,
      tileY: 14,
      direction: 4,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_vaelen'
    });

    // 2. Scholar Lyra examining the Ancient Druid Hill
    const lyraRecipe = generateRandomCharacterRecipe(303, 'npc_lyra');
    lyraRecipe.name = 'Uczona Lyra';
    lyraRecipe.title = 'Badaczka Leśnych Run';
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
      x: 9.5,
      y: 8.5,
      z: this.map.tiles[8][9].z,
      tileX: 9,
      tileY: 8,
      direction: 5,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      dialogueId: 'npc_lyra'
    });

    // 3. Patrolling Forest Ranger walking across the clearing & hill stairs
    const patrolRecipe = generateRandomCharacterRecipe(408, 'npc_warden_patrol');
    patrolRecipe.name = 'Tropiciell Aldric';
    patrolRecipe.title = 'Strażnik Szlaku';
    this.npcs.push({
      id: 'npc_warden_patrol',
      recipe: patrolRecipe,
      x: 13.5,
      y: 20.5,
      z: this.map.tiles[20][13].z,
      tileX: 13,
      tileY: 20,
      direction: 2,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      patrolPoints: [
        { x: 13, y: 20 },
        { x: 19, y: 18 },
        { x: 16, y: 12 },
        { x: 10, y: 9 }
      ],
      patrolIndex: 0,
      patrolWaitTimer: 1.5
    });

    // 4. EASY TEST ENEMY: Zdziczały Maruder Szlaku (South-West Clearing, x=10, y=21)
    const easyRecipe = generateRandomCharacterRecipe(801, 'enemy_bandit_easy');
    easyRecipe.name = 'Zdziczały Maruder Szlaku';
    easyRecipe.title = '🟢 [ŁATWY] Maruder z Uroczyska';
    easyRecipe.attributes = {
      might: 10,
      finesse: 10,
      resolve: 9,
      lore: 6,
      perception: 10
    };
    easyRecipe.equipment = {
      head: 'helm_shadow_hood',
      torso: 'torso_linen_tunic',
      cloak: null,
      legs: 'legs_leather_boots',
      mainHand: 'weapon_sunblade_longsword',
      offHand: null
    };
    this.npcs.push({
      id: 'enemy_bandit_easy',
      recipe: easyRecipe,
      x: 10.5,
      y: 21.5,
      z: this.map.tiles[21][10].z,
      tileX: 10,
      tileY: 21,
      direction: 1,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      combat: {
        isHostile: true,
        difficulty: 'easy',
        difficultyLabel: '🟢 ŁATWY',
        aggroRadius: 3.5,
        hp: 48,
        maxHp: 48,
        ap: 8,
        maxAp: 8,
        proficiencies: createDefaultProficiencies({ blades: 56 }),
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 4,
        lootTable: ['item_raw_sausage'],
        isAlive: true,
        customArmorBonus: -2,
        customDamageBonus: -4
      }
    });

    // 5. NORMAL TEST ENEMY: Najemny Wiarus — Kosynier z Jaru (South-East Clearing, x=21, y=19)
    const normalRecipe = generateRandomCharacterRecipe(805, 'enemy_mercenary_normal');
    normalRecipe.name = 'Najemny Wiarus z Jaru';
    normalRecipe.title = '🟡 [NORMALNY] Dezerter Straży';
    normalRecipe.attributes = {
      might: 13,
      finesse: 12,
      resolve: 12,
      lore: 8,
      perception: 12
    };
    normalRecipe.equipment = {
      head: 'helm_shadow_hood',
      torso: 'torso_warden_brigandine',
      cloak: 'cloak_crimson_mantle',
      legs: 'legs_leather_boots',
      mainHand: 'weapon_sunblade_longsword',
      offHand: 'offhand_heraldic_shield'
    };
    this.npcs.push({
      id: 'enemy_mercenary_normal',
      recipe: normalRecipe,
      x: 21.5,
      y: 19.5,
      z: this.map.tiles[19][21].z,
      tileX: 21,
      tileY: 19,
      direction: 6,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      combat: {
        isHostile: true,
        difficulty: 'normal',
        difficultyLabel: '🟡 NORMALNY',
        aggroRadius: 3.5,
        hp: 96,
        maxHp: 96,
        ap: 10,
        maxAp: 10,
        proficiencies: createDefaultProficiencies({ blades: 74 }),
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 6,
        lootTable: ['ring_wolf_signet'],
        isAlive: true,
        customArmorBonus: 4,
        customDamageBonus: 2
      }
    });

    // 6. VERY HARD TEST ENEMY: Upadły Czempion Aethelgardu (North-East Ruins, x=22, y=13)
    const hardRecipe = generateRandomCharacterRecipe(809, 'enemy_dread_champion_hard');
    hardRecipe.name = 'Upadły Czempion Aethelgardu';
    hardRecipe.title = '🔴 [BARDZO TRUDNY] Zakuty Strażnik Kurhanu';
    hardRecipe.attributes = {
      might: 19,
      finesse: 14,
      resolve: 18,
      lore: 12,
      perception: 15
    };
    hardRecipe.equipment = {
      head: 'helm_dread_plate',
      torso: 'torso_aethel_plate',
      cloak: 'cloak_steel_pauldrons',
      legs: 'legs_steel_greaves',
      mainHand: 'weapon_Executioner_axe',
      offHand: null
    };
    this.npcs.push({
      id: 'enemy_dread_champion_hard',
      recipe: hardRecipe,
      x: 22.5,
      y: 13.5,
      z: this.map.tiles[13][22].z,
      tileX: 22,
      tileY: 13,
      direction: 4,
      isMoving: false,
      animFrame: 0,
      animTimer: 0,
      path: [],
      combat: {
        isHostile: true,
        difficulty: 'very_hard',
        difficultyLabel: '🔴 BARDZO TRUDNY',
        aggroRadius: 3.8,
        hp: 168,
        maxHp: 168,
        ap: 11,
        maxAp: 11,
        proficiencies: createDefaultProficiencies({ axes_blunt: 92 }),
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 10,
        lootTable: ['weapon_Executioner_axe', 'torso_aethel_plate'],
        isAlive: true,
        customArmorBonus: 18,
        customDamageBonus: 8
      }
    });
  }

  private initSanctumNpcs(): void {
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
  }

  public sayPlayerBark(text: string, durationSeconds = 4.5): void {
    this.player.speechBubbleText = text;
    this.player.speechBubbleTimer = durationSeconds;
    this.addLog(`${this.player.recipe.name}: „${text}”`);
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
      if (npc.combat && !npc.combat.isAlive) continue;
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
    computeFieldOfView(this.fov, this.player.tileX, this.player.tileY, 10.5, (x, y) =>
      this.isTileOpaque(x, y)
    );
  }

  public pushFloatingCombatText(
    x: number,
    y: number,
    z: number,
    text: string,
    colorHex: number
  ): void {
    this.combatState.floatingTexts.push({
      id: `fct_${Date.now()}_${Math.random()}`,
      x,
      y,
      z,
      text,
      colorHex,
      elapsed: 0,
      duration: 1.55
    });
  }

  public getActorCombatant(actor: ActorEntity): CombatantSnapshot {
    if (!actor.combat) {
      actor.combat = {
        isHostile: false,
        aggroRadius: 0,
        hp: 100,
        maxHp: 100,
        ap: 8,
        maxAp: 8,
        proficiencies: createDefaultProficiencies(),
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 0,
        lootTable: [],
        isAlive: true
      };
    }

    if (actor.id === this.player.id) {
      const attrs = this.statSheet.getEffectiveAttributes();
      const derived = computeDerivedCombatStats(
        this.statSheet,
        actor.combat.proficiencies,
        actor.recipe.equipment.mainHand,
        actor.recipe.equipment.offHand,
        actor.combat.defending,
        actor.combat.dazedHeadTurns > 0,
        actor.combat.customArmorBonus ?? 0,
        actor.combat.customDamageBonus ?? 0
      );
      return {
        actorId: actor.id,
        name: actor.recipe.name,
        perception: attrs.perception,
        finesse: attrs.finesse,
        might: attrs.might,
        resolve: attrs.resolve,
        lore: attrs.lore,
        combat: actor.combat,
        derived
      };
    }

    // Build transient stat sheet for NPC from their recipe attributes and equipped items
    const npcSheet = new CharacterStatSheet(actor.recipe.attributes);
    for (const eqId of Object.values(actor.recipe.equipment)) {
      if (eqId) {
        const inst = createItemInstance(eqId, 1);
        for (const mod of getAllItemModifiers(inst)) {
          npcSheet.addModifier(mod);
        }
      }
    }
    const npcAttrs = npcSheet.getEffectiveAttributes();
    const derived = computeDerivedCombatStats(
      npcSheet,
      actor.combat.proficiencies,
      actor.recipe.equipment.mainHand,
      actor.recipe.equipment.offHand,
      actor.combat.defending,
      actor.combat.dazedHeadTurns > 0,
      actor.combat.customArmorBonus ?? 0,
      actor.combat.customDamageBonus ?? 0
    );

    return {
      actorId: actor.id,
      name: actor.recipe.name,
      perception: npcAttrs.perception,
      finesse: npcAttrs.finesse,
      might: npcAttrs.might,
      resolve: npcAttrs.resolve,
      lore: npcAttrs.lore,
      combat: actor.combat,
      derived
    };
  }

  public startCombatWithEnemy(enemyId: string): boolean {
    const enemy = this.npcs.find((n) => n.id === enemyId);
    if (!enemy || !enemy.combat || !enemy.combat.isAlive) return false;

    if (this.combatState.active) {
      this.combatState.selectedTargetId = enemy.id;
      if (!this.combatState.participantIds.includes(enemy.id)) {
        this.combatState.participantIds.push(enemy.id);
      }
      return true;
    }

    this.player.path = [];
    this.player.isMoving = false;
    this.player.pendingAttackTargetId = null;

    const participants: ActorEntity[] = [this.player, enemy];
    // Include any other hostile living enemies within 6.5 tiles of the target or player
    for (const other of this.npcs) {
      if (
        other.id !== enemy.id &&
        other.combat?.isHostile &&
        other.combat.isAlive &&
        (Math.hypot(other.tileX - this.player.tileX, other.tileY - this.player.tileY) <= 6.5 ||
          Math.hypot(other.tileX - enemy.tileX, other.tileY - enemy.tileY) <= 5.5)
      ) {
        participants.push(other);
      }
    }

    for (const p of participants) {
      const snap = this.getActorCombatant(p);
      p.combat!.maxAp = snap.derived.maxAp;
      p.combat!.ap = snap.derived.maxAp;
      p.combat!.defending = false;
      p.path = [];
      p.isMoving = false;
    }

    this.combatState.active = true;
    this.combatState.round = 1;
    this.combatState.participantIds = participants.map((p) => p.id);
    this.combatState.activeTurnActorId = this.player.id;
    this.combatState.selectedTargetId = enemy.id;

    const diffTag = enemy.combat.difficultyLabel ?? 'WRÓG';
    this.addLog(
      `⚔️ ROZPOCZĘTO WALKĘ TUROWĄ (Runda 1)! Cel: ${enemy.recipe.name} (${diffTag}, ${enemy.combat.hp}/${enemy.combat.maxHp} HP). Twoja tura: masz ${this.player.combat!.ap} AP.`
    );
    this.pushFloatingCombatText(
      this.player.x,
      this.player.y,
      this.player.z + 1.8,
      '⚔️ WALKA TUROWA!',
      0xf5c451
    );
    return true;
  }

  public commandAttackEnemy(enemyId: string): void {
    const enemy = this.npcs.find((n) => n.id === enemyId);
    if (!enemy || !enemy.combat || !enemy.combat.isAlive) return;

    const playerSnap = this.getActorCombatant(this.player);
    const maxRange = playerSnap.derived.weaponProfile.maxRange;
    const dist = Math.hypot(enemy.tileX - this.player.tileX, enemy.tileY - this.player.tileY);

    if (this.combatState.active) {
      this.combatState.selectedTargetId = enemy.id;
      if (dist <= maxRange + 0.45) {
        this.performPlayerCombatAttack(enemy.id, this.combatState.selectedAttackMode);
        return;
      }
      // In combat but out of range -> move closer using AP
      const adj = this.findBestAdjacentWalkableTile(enemy.tileX, enemy.tileY, 1, 1);
      if (adj) {
        this.commandPlayerMoveTo(adj.x, adj.y);
      }
      return;
    }

    // Out of combat: if within weapon range (or within 2.5 tiles), start combat right away!
    if (dist <= Math.max(2.2, maxRange + 0.45)) {
      this.startCombatWithEnemy(enemy.id);
      if (dist <= maxRange + 0.45) {
        this.performPlayerCombatAttack(enemy.id, this.combatState.selectedAttackMode);
      }
      return;
    }

    // Walk up to the enemy and then start combat
    const adj = this.findBestAdjacentWalkableTile(enemy.tileX, enemy.tileY, 1, 1);
    if (adj && this.commandPlayerMoveTo(adj.x, adj.y)) {
      this.player.pendingAttackTargetId = enemy.id;
    }
  }

  public performPlayerCombatAttack(
    targetId: string,
    mode: CombatAttackMode = this.combatState.selectedAttackMode,
    rng: () => number = Math.random
  ): CombatAttackOutcome | null {
    const enemy = this.npcs.find((n) => n.id === targetId);
    if (!enemy || !enemy.combat || !enemy.combat.isAlive) return null;

    if (!this.combatState.active) {
      this.startCombatWithEnemy(enemy.id);
    }

    if (this.combatState.activeTurnActorId !== this.player.id) {
      this.addLog('⏳ Poczekaj na swoją turę!');
      return null;
    }

    this.combatState.selectedTargetId = enemy.id;
    this.combatState.selectedAttackMode = mode;

    const playerSnap = this.getActorCombatant(this.player);
    const enemySnap = this.getActorCombatant(enemy);
    const dist = Math.hypot(enemy.tileX - this.player.tileX, enemy.tileY - this.player.tileY);
    const preview = computeAttackPreview(playerSnap, enemySnap, dist, mode);

    if (!preview.inRange) {
      this.addLog(
        `⚠️ Cel „${enemy.recipe.name}” jest poza zasięgiem broni (${dist.toFixed(1)} kafli, maks. zasięg: ${preview.maxRange}). Podejdź bliżej za AP!`
      );
      return null;
    }

    if (!preview.hasEnoughAp) {
      this.addLog(
        `⚠️ Za mało Punktów Akcji (AP)! Wymagane: ${preview.apCost} AP, posiadasz: ${this.player.combat!.ap} AP. Zakończ turę (Spacja / przycisk Koniec Tury).`
      );
      return null;
    }

    // Face each other
    this.player.direction = deltaToDirection8(
      enemy.tileX - this.player.tileX,
      enemy.tileY - this.player.tileY
    );
    enemy.direction = deltaToDirection8(
      this.player.tileX - enemy.tileX,
      this.player.tileY - enemy.tileY
    );

    const outcome = resolveCombatAttack(playerSnap, enemySnap, dist, mode, rng);
    const modeLabel = ATTACK_MODE_META[mode].label;

    if (!outcome.hit) {
      this.pushFloatingCombatText(
        enemy.x,
        enemy.y,
        enemy.z + 1.8,
        `PUDŁO! (${outcome.hitChancePct}%)`,
        0xb0b7c6
      );
      this.addLog(
        `💨 [${modeLabel}] Pudło w ${enemy.recipe.name}! (Szansa: ${outcome.hitChancePct}%, rzut: ${outcome.rollPct}%, koszt: -${outcome.apSpent} AP).`
      );
    } else {
      const statusText =
        outcome.appliedStatus === 'dazed_head'
          ? ' + OGŁUSZENIE (-3 AP)!'
          : outcome.appliedStatus === 'crippled_legs'
            ? ' + OKALECZENIE NÓG!'
            : '';
      const floatLabel = outcome.critical
        ? `💥 KRYTYK -${outcome.damageDealt} HP!${statusText}`
        : `-${outcome.damageDealt} HP${statusText}`;
      this.pushFloatingCombatText(
        enemy.x,
        enemy.y,
        enemy.z + 1.85,
        floatLabel,
        outcome.critical ? 0xffca28 : 0xff5252
      );
      this.addLog(
        `${outcome.critical ? '💥 KRYTYK!' : '🗡️ Trafienie!'} [${modeLabel}] Zadano ${outcome.damageDealt} obr. celowi ${enemy.recipe.name} (wytłumiono ${outcome.mitigatedByArmor} przez DT/DR, szansa: ${outcome.hitChancePct}%)${statusText}.`
      );
    }

    if (outcome.targetDefeated) {
      this.handleEnemyDefeated(enemy, playerSnap.derived.weaponProfile.category);
    }

    return outcome;
  }

  private handleEnemyDefeated(
    enemy: ActorEntity,
    usedWeaponCategory: keyof ActorCombatComponent['proficiencies']
  ): void {
    const c = enemy.combat!;
    c.isAlive = false;
    c.hp = 0;
    enemy.path = [];
    enemy.isMoving = false;

    const gain = c.xpReward || 4;
    const prevProf = this.player.combat!.proficiencies[usedWeaponCategory];
    const nextProf = Math.min(150, prevProf + gain);
    this.player.combat!.proficiencies[usedWeaponCategory] = nextProf;

    const profLabel = PROFICIENCY_META[usedWeaponCategory].label;
    const droppedNames: string[] = [];
    for (const itemId of c.lootTable) {
      this.backpack.tryAddItem(createItemInstance(itemId, 1), true);
      droppedNames.push(EQUIPMENT_CATALOG[itemId]?.name ?? itemId);
    }

    this.pushFloatingCombatText(
      enemy.x,
      enemy.y,
      enemy.z + 2.1,
      `☠️ POKONANO! (+${gain}% ${PROFICIENCY_META[usedWeaponCategory].shortLabel})`,
      0x4cd964
    );

    this.addLog(
      `🏆 Pokonano przeciwnika: ${enemy.recipe.name}! Biegłość „${profLabel}” wzrosła o +${gain}% (do ${nextProf}%).${droppedNames.length > 0 ? ` Zdobyty łup: ${droppedNames.join(', ')}.` : ''}`
    );

    // Check if any hostile participants remain alive
    const remainingEnemies = this.combatState.participantIds
      .map((id) => this.npcs.find((n) => n.id === id))
      .filter((n): n is ActorEntity => Boolean(n && n.combat?.isHostile && n.combat.isAlive));

    if (remainingEnemies.length === 0) {
      this.combatState.active = false;
      this.combatState.activeTurnActorId = null;
      this.combatState.selectedTargetId = null;
      this.player.combat!.ap = this.player.combat!.maxAp;
      this.player.combat!.defending = false;
      this.player.combat!.dazedHeadTurns = 0;
      this.player.combat!.crippledLegsTurns = 0;
      this.sayPlayerBark('Starcie wygrane! Czas przejrzeć łupy.', 4.5);
      this.addLog('✨ Walka turowa zakończona zwycięstwem! Punkty Akcji (AP) zostały odnowione.');
    } else {
      this.combatState.selectedTargetId = remainingEnemies[0].id;
    }
  }

  public activatePlayerDefendStance(): boolean {
    if (!this.combatState.active || this.combatState.activeTurnActorId !== this.player.id) {
      return false;
    }
    const c = this.player.combat!;
    if (c.ap < 2) {
      this.addLog('⚠️ Potrzebujesz minimum 2 AP, aby przyjąć Postawę Obronną!');
      return false;
    }
    c.ap -= 2;
    c.defending = true;
    this.pushFloatingCombatText(
      this.player.x,
      this.player.y,
      this.player.z + 1.8,
      '🛡️ POSTAWA OBRONNA (+20% Unik, +15% DR)',
      0x4da6ff
    );
    this.addLog(
      '🛡️ Przyjęto Postawę Obronną (-2 AP): +20% Uniku, +2 DT oraz +15% Redukcji Obrażeń (DR) do kolejnej tury.'
    );
    return true;
  }

  public endPlayerCombatTurn(): void {
    if (!this.combatState.active) return;

    // Tick down player's temporary status effects from previous round
    if (this.player.combat) {
      if (this.player.combat.dazedHeadTurns > 0) this.player.combat.dazedHeadTurns--;
      if (this.player.combat.crippledLegsTurns > 0) this.player.combat.crippledLegsTurns--;
    }

    // Execute turn for each living hostile participant
    const livingEnemies = this.combatState.participantIds
      .map((id) => this.npcs.find((n) => n.id === id))
      .filter((n): n is ActorEntity => Boolean(n && n.combat?.isHostile && n.combat.isAlive));

    for (const enemy of livingEnemies) {
      if (!this.combatState.active) break;
      this.executeEnemyCombatTurn(enemy);
    }

    if (!this.combatState.active) return;

    // Start next round & restore player's AP
    this.combatState.round += 1;
    this.combatState.activeTurnActorId = this.player.id;
    const pSnap = this.getActorCombatant(this.player);
    this.player.combat!.maxAp = pSnap.derived.maxAp;
    this.player.combat!.ap = pSnap.derived.maxAp;
    this.player.combat!.defending = false;

    this.addLog(
      `🔔 Runda ${this.combatState.round} — Twoja tura! Odnowiono ${this.player.combat!.ap}/${this.player.combat!.maxAp} AP.`
    );
  }

  private executeEnemyCombatTurn(enemy: ActorEntity): void {
    const ec = enemy.combat!;
    this.combatState.activeTurnActorId = enemy.id;
    ec.defending = false;

    const eSnap = this.getActorCombatant(enemy);
    ec.maxAp = eSnap.derived.maxAp;
    ec.ap = eSnap.derived.maxAp;

    const moveApCost = ec.crippledLegsTurns > 0 ? 2 : 1;
    const maxRange = eSnap.derived.weaponProfile.maxRange;
    const baseAttackAp = eSnap.derived.weaponProfile.baseApCost;

    // 1. Move closer to player if out of weapon range
    let dist = Math.hypot(this.player.tileX - enemy.tileX, this.player.tileY - enemy.tileY);
    if (dist > maxRange + 0.45 && ec.ap >= moveApCost) {
      const adj = this.findBestAdjacentWalkableTile(this.player.tileX, this.player.tileY, 1, 1);
      if (adj) {
        const path = findPathAStar3D(
          {
            width: this.map.width,
            height: this.map.height,
            isWalkable: (x, y) => this.isTileWalkable(x, y, enemy.id),
            getElevation: (x, y) => this.map.tiles[y][x].z
          },
          { x: enemy.tileX, y: enemy.tileY },
          adj
        );
        if (path.length > 1) {
          const maxSteps = Math.floor(ec.ap / moveApCost);
          const stepsToTake = Math.min(path.length - 1, maxSteps);
          if (stepsToTake > 0) {
            const destNode = path[stepsToTake];
            ec.ap -= stepsToTake * moveApCost;
            enemy.tileX = destNode.x;
            enemy.tileY = destNode.y;
            enemy.x = destNode.x + 0.5;
            enemy.y = destNode.y + 0.5;
            enemy.z = destNode.z;
            enemy.direction = destNode.direction;
            this.addLog(
              `👣 ${enemy.recipe.name} przemieszcza się o ${stepsToTake} kafli (-${stepsToTake * moveApCost} AP).`
            );
          }
        }
      }
    }

    // 2. Attack player while in range and enough AP
    dist = Math.hypot(this.player.tileX - enemy.tileX, this.player.tileY - enemy.tileY);
    let attacksMade = 0;
    while (dist <= maxRange + 0.45 && ec.ap >= baseAttackAp && attacksMade < 2) {
      attacksMade++;
      const freshEnemySnap = this.getActorCombatant(enemy);
      const freshPlayerSnap = this.getActorCombatant(this.player);

      const chosenMode: CombatAttackMode =
        ec.difficulty === 'very_hard' && ec.ap >= baseAttackAp + 1 && attacksMade === 1
          ? 'power'
          : 'quick';

      enemy.direction = deltaToDirection8(
        this.player.tileX - enemy.tileX,
        this.player.tileY - enemy.tileY
      );

      const out = resolveCombatAttack(freshEnemySnap, freshPlayerSnap, dist, chosenMode);
      if (!out.hit) {
        this.pushFloatingCombatText(
          this.player.x,
          this.player.y,
          this.player.z + 1.8,
          `UNIK! (${enemy.recipe.name})`,
          0x69f0ae
        );
        this.addLog(
          `🛡️ Uniknąłeś ataku ${enemy.recipe.name}! (Szansa wroga: ${out.hitChancePct}%, rzut: ${out.rollPct}%).`
        );
      } else {
        this.pushFloatingCombatText(
          this.player.x,
          this.player.y,
          this.player.z + 1.85,
          `-${out.damageDealt} HP`,
          0xff453a
        );
        this.addLog(
          `🩸 ${enemy.recipe.name} trafia Cię (${ATTACK_MODE_META[chosenMode].label}) za ${out.damageDealt} obr.! (Pancerz DT/DR pochłonął ${out.mitigatedByArmor} obr.).`
        );
      }

      if (this.player.combat!.hp <= 0) {
        this.handlePlayerDefeated();
        return;
      }
    }

    // 3. If enemy still has >= 2 AP left, enter Defensive Stance
    if (ec.ap >= 2) {
      ec.ap -= 2;
      ec.defending = true;
    }

    if (ec.dazedHeadTurns > 0) ec.dazedHeadTurns--;
    if (ec.crippledLegsTurns > 0) ec.crippledLegsTurns--;
  }

  private handlePlayerDefeated(): void {
    this.combatState.active = false;
    this.combatState.activeTurnActorId = null;
    this.combatState.selectedTargetId = null;

    // Respawn / Second Wind at campfire so player never gets soft-locked
    this.player.combat!.isAlive = true;
    this.player.combat!.hp = this.player.combat!.maxHp;
    this.player.combat!.ap = this.player.combat!.maxAp;
    this.player.combat!.defending = false;
    this.player.combat!.dazedHeadTurns = 0;
    this.player.combat!.crippledLegsTurns = 0;

    this.player.tileX = 15;
    this.player.tileY = 17;
    this.player.x = 15.5;
    this.player.y = 17.5;
    this.player.z = this.map.tiles[17][15].z;
    this.player.path = [];
    this.player.isMoving = false;

    this.sayPlayerBark(
      'Ten przeciwnik był zbyt silny... Muszę dobrać lepszy pancerz i broń przy ognisku!',
      5.0
    );
    this.addLog(
      '💀 Zostałeś powalony w walce! Ocucono Cię przy ognisku obozowym (pełne HP). Wskazówka: na trudnego wroga użyj Dwuręcznego Topora Kata (przebicie pancerza) lub Kostura Runicznego!'
    );
    this.recomputeFov();
  }

  public fleeCombat(): void {
    if (!this.combatState.active) return;
    this.combatState.active = false;
    this.combatState.activeTurnActorId = null;
    this.combatState.selectedTargetId = null;
    this.player.combat!.ap = this.player.combat!.maxAp;
    this.player.combat!.defending = false;
    this.sayPlayerBark('Taktyczny odwrót! Przegrupuję się.', 3.5);
    this.addLog('🏃 Wycofano się z walki turowej.');
  }

  public commandPlayerMoveTo(targetX: number, targetY: number): boolean {
    this.player.pendingInteractionPropId = null;
    this.player.pendingDialogueActorId = null;
    this.player.pendingAttackTargetId = null;

    if (this.combatState.active && this.combatState.activeTurnActorId !== this.player.id) {
      this.addLog('⏳ Poczekaj na swoją turę!');
      return false;
    }

    // Check if the player clicked beyond the exit barrier on the forest clearing path
    if (this.map.id === 'forest_clearing' && targetY >= 29 && targetX >= 14 && targetX <= 17) {
      const exitProp = this.map.props.find((p) => p.kind === 'exit_path');
      if (exitProp) {
        this.commandInteractWithProp(exitProp.id);
        return true;
      }
    }

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

    if (this.combatState.active && this.player.combat) {
      const apPerStep = this.player.combat.crippledLegsTurns > 0 ? 2 : 1;
      const maxSteps = Math.floor(this.player.combat.ap / apPerStep);
      if (maxSteps <= 0) {
        this.addLog('⚠️ Brak Punktów Akcji (AP) na ruch! Zakończ turę.');
        return false;
      }
      const steps = path.slice(1, 1 + maxSteps);
      const apCost = steps.length * apPerStep;
      this.player.combat.ap = Math.max(0, this.player.combat.ap - apCost);
      const dest = steps[steps.length - 1];
      this.player.tileX = dest.x;
      this.player.tileY = dest.y;
      this.player.x = dest.x + 0.5;
      this.player.y = dest.y + 0.5;
      this.player.z = dest.z;
      this.player.direction = dest.direction;
      this.player.path = [];
      this.player.isMoving = false;
      this.recomputeFov();
      this.addLog(
        `👣 Ruch taktyczny o ${steps.length} kafli (-${apCost} AP, pozostało: ${this.player.combat.ap} AP).`
      );
      return true;
    }

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
    if (dist <= 1.85) {
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

    if (npc.combat?.isHostile) {
      if (!npc.combat.isAlive) {
        this.addLog(`☠️ ${npc.recipe.name} został już pokonany.`);
        return;
      }
      this.commandAttackEnemy(npc.id);
      return;
    }

    const dist = Math.hypot(npc.tileX - this.player.tileX, npc.tileY - this.player.tileY);
    if (dist <= 1.85) {
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

    if (prop.kind === 'exit_path') {
      this.player.isMoving = false;
      this.player.path = [];
      this.sayPlayerBark('Jeszcze nie czas iść dalej...', 5.0);
      return;
    }

    if (prop.kind === 'travel_signpost') {
      const targetMap: MapId =
        this.map.id === 'forest_clearing' ? 'slavic_village' : 'forest_clearing';
      this.loadMap(targetMap);
      this.sayPlayerBark(
        targetMap === 'slavic_village'
          ? 'Dotarłem do słowiańskiej osady i targowiska!'
          : 'Powróciłem na Polanę Wilczego Ognia.',
        4.5
      );
      return;
    }

    if (prop.kind === 'slavic_well') {
      prop.isOpen = !prop.isOpen;
      this.sayPlayerBark('Zimna, źródlana woda ze studni dodaje sił!', 4.0);
      this.addLog('💧 Zaczerpnięto krystalicznie czystej wody ze studni gromadnej.');
      return;
    }

    if (prop.kind === 'slavic_shrine') {
      prop.isOpen = !prop.isOpen;
      if (prop.linkedLightId) {
        const light = this.map.lights.find((l) => l.id === prop.linkedLightId);
        if (light) light.enabled = Boolean(prop.isOpen);
      }
      this.sayPlayerBark(
        'Cztery oblicza Światowida spoglądają przychylnie na moją wędrówkę.',
        4.5
      );
      this.addLog(
        `🔥 ${prop.name}: ${prop.isOpen ? 'rozpalono święty znicz ofiarny' : 'wygaszono płomień u stóp posągu'}.`
      );
      return;
    }

    if (prop.kind === 'slavic_cottage') {
      prop.isOpen = !prop.isOpen;
      if (prop.linkedLightId) {
        const light = this.map.lights.find((l) => l.id === prop.linkedLightId);
        if (light) light.enabled = Boolean(prop.isOpen);
      }
      this.addLog(
        `🏠 ${prop.name}: ${prop.isOpen ? 'zza błony okiennej bije ciepły blask paleniska' : 'okiennice chaty zostały przymknięte'}.`
      );
      return;
    }

    if (prop.kind === 'market_stall') {
      if (!prop.isOpen && prop.lootItems && prop.lootItems.length > 0) {
        prop.isOpen = true;
        const loot = prop.lootItems;
        for (const itemId of loot) {
          this.backpack.tryAddItem(createItemInstance(itemId, 1), true);
        }
        const names = loot.map((id) => EQUIPMENT_CATALOG[id]?.name ?? id).join(', ');
        this.sayPlayerBark(`Nabyto z kramu: ${names}`, 4.0);
        this.addLog(`🛒 Odebrano towary z „${prop.name}”: ${names}.`);
      } else {
        this.addLog(`🛒 Obejrzano towary wyłożone na: ${prop.name}.`);
      }
      return;
    }

    if (prop.kind === 'campfire') {
      if (this.backpack.hasDefinitionId('item_raw_sausage')) {
        if (!prop.isOpen) {
          prop.isOpen = true;
          if (prop.linkedLightId) {
            const l = this.map.lights.find((lt) => lt.id === prop.linkedLightId);
            if (l) l.enabled = true;
          }
        }
        this.backpack.removeByDefinitionId('item_raw_sausage', 1);
        this.backpack.tryAddItem(createItemInstance('item_roasted_sausage', 1), true);
        this.sayPlayerBark('Kiełbasa pięknie się upiekła nad ogniskiem!', 4.5);
        this.addLog(
          '🔥 Upieczono Surową Kiełbasę Myśliwską na ognisku! Otrzymano: Upieczona Kiełbasa z Ogniska.'
        );
        return;
      }

      prop.isOpen = !prop.isOpen;
      if (prop.linkedLightId) {
        const light = this.map.lights.find((l) => l.id === prop.linkedLightId);
        if (light) light.enabled = Boolean(prop.isOpen);
      }
      this.addLog(
        prop.isOpen
          ? 'Dorzucono drew do ogniska. Jeśli znajdziesz Surową Kiełbasę, kliknij ognisko, aby ją upiec!'
          : 'Przygaszono ognisko obozowe.'
      );
      return;
    }

    if (prop.kind === 'door') {
      prop.isOpen = !prop.isOpen;
      this.addLog(`${prop.name}: ${prop.isOpen ? 'otwarto' : 'zamknięto'}.`);
      this.recomputeFov();
      return;
    }

    if (prop.kind === 'chest' || prop.kind === 'ground_loot') {
      if (!prop.isOpen) {
        prop.isOpen = true;
        const loot = prop.lootItems ?? [];
        for (const itemId of loot) {
          this.backpack.tryAddItem(createItemInstance(itemId, 1), true);
        }
        const names = loot.map((id) => EQUIPMENT_CATALOG[id]?.name ?? id).join(', ');
        this.sayPlayerBark(`Znaleziono: ${names}`, 3.5);
        this.addLog(`Podniesiono z „${prop.name}”: ${names}.`);
      } else {
        this.addLog(`${prop.name} — wszystko zostało już zabrane.`);
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

    if (
      prop.kind === 'runic_altar' ||
      prop.kind === 'sarcophagus' ||
      prop.kind === 'ranger_tent' ||
      prop.kind === 'fallen_log'
    ) {
      this.addLog(`Zbadano obiekt wielokaflowy: ${prop.name}.`);
    }
  }

  public startDialogueWithNpc(npcId: string): void {
    const npc = this.npcs.find((n) => n.id === npcId);
    if (!npc) return;

    this.player.direction = deltaToDirection8(
      npc.tileX - this.player.tileX,
      npc.tileY - this.player.tileY
    );
    npc.direction = deltaToDirection8(
      this.player.tileX - npc.tileX,
      this.player.tileY - npc.tileY
    );

    const tree = npc.dialogueId ? DIALOGUE_TREES[npc.dialogueId] : undefined;
    if (!tree) {
      this.addLog(`${npc.recipe.name} (${npc.recipe.title}): „Czuwam nad bezpieczeństwem szlaku.”`);
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
      if (!this.backpack.hasDefinitionId(choice.grantsItemId)) {
        this.backpack.tryAddItem(createItemInstance(choice.grantsItemId, 1), true);
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

  public useOrEquipInstance(instanceId: string, preferredSlot?: EquipSlot): boolean {
    const found = this.backpack.findByInstanceId(instanceId);
    if (!found) return false;
    const def = getItemDefinition(found.item.definitionId);
    if (!def) return false;

    if (def.itemType === 'Consumable') {
      return this.consumeBackpackInstance(found.item.instanceId);
    }

    const res: EquipOperationResult = this.equipmentManager.equipFromInventory(
      instanceId,
      preferredSlot
    );
    if (!res.success) {
      this.addLog(`⚠️ Nie można założyć ${def.name}: ${res.reason}`);
      return false;
    }

    const unequippedNames = (res.unequippedItems ?? [])
      .map((u) => getItemDefinition(u.definitionId)?.name ?? u.definitionId)
      .join(', ');
    if (unequippedNames) {
      this.addLog(`Założono: ${def.name} (zdjęto do plecaka: ${unequippedNames}).`);
    } else {
      this.addLog(`Założono wyposażenie: ${def.name}.`);
    }
    return true;
  }

  public unequipSlotToBackpack(slot: EquipSlot): boolean {
    const current = this.equipmentManager.getEquipped(slot);
    if (!current) return false;
    const def = getItemDefinition(current.definitionId);
    const res = this.equipmentManager.unequipToInventory(slot);
    if (!res.success) {
      this.addLog(`⚠️ ${res.reason}`);
      return false;
    }
    this.addLog(`Zdjęto z wyposażenia do plecaka: ${def?.name ?? current.definitionId}.`);
    return true;
  }

  private consumeBackpackInstance(instanceId: string): boolean {
    const found = this.backpack.findByInstanceId(instanceId);
    if (!found) return false;
    const item = EQUIPMENT_CATALOG[found.item.definitionId];
    if (!item) return false;

    if (item.id === 'item_raw_sausage') {
      const campfire = this.map.props.find((p) => p.kind === 'campfire');
      if (campfire) {
        this.commandInteractWithProp(campfire.id);
      } else {
        this.sayPlayerBark('Muszę najpierw znaleźć ognisko, żeby upiec surową kiełbasę!');
      }
      return true;
    }

    if (item.consumableEffect) {
      if (this.combatState.active && this.player.combat) {
        if (this.player.combat.ap < 2) {
          this.addLog('⚠️ Użycie przedmiotu w walce wymaga 2 AP!');
          return false;
        }
        this.player.combat.ap -= 2;
      }
      const eff = item.consumableEffect;
      const base = this.statSheet.getBaseAttributes();
      if (eff.might) base.might += eff.might;
      if (eff.resolve) base.resolve += eff.resolve;
      if (eff.perception) base.perception += eff.perception;
      if (eff.lore) base.lore += eff.lore;
      this.statSheet.setBaseAttributes(base);

      if (this.player.combat) {
        const healed = Math.min(60, this.player.combat.maxHp - this.player.combat.hp);
        this.player.combat.hp = Math.min(
          this.player.combat.maxHp,
          this.player.combat.hp + 60
        );
        if (healed > 0) {
          this.pushFloatingCombatText(
            this.player.x,
            this.player.y,
            this.player.z + 1.8,
            `+${healed} HP`,
            0x4cd964
          );
        }
      }

      this.sayPlayerBark(eff.barkText, 4.0);
      this.backpack.removeItem(instanceId, 1);
      return true;
    }

    return false;
  }

  public equipInventoryItem(itemId: string): boolean {
    const item = EQUIPMENT_CATALOG[itemId];
    if (!item) return false;

    let inBag = this.backpack.findByDefinitionId(itemId);
    if (!inBag) {
      // Check if already equipped -> unequip if optional slot
      for (const [slotKey, eqInst] of Object.entries(this.equipmentManager.getAllEquipped())) {
        if (eqInst && eqInst.definitionId === itemId) {
          return this.unequipSlotToBackpack(slotKey as EquipSlot);
        }
      }
      // Otherwise create and add to backpack first (used by tests & grants)
      const created = createItemInstance(itemId, 1);
      this.backpack.tryAddItem(created, true);
      inBag = this.backpack.findByInstanceId(created.instanceId);
    }

    if (!inBag) return false;
    return this.useOrEquipInstance(inBag.item.instanceId);
  }

  public spawnRandomNpc(seed = Math.floor(Math.random() * 90000) + 1000): ActorEntity | null {
    const recipe = generateRandomCharacterRecipe(seed);
    const center = this.map.id === 'forest_clearing' ? 15 : 9;
    for (let radius = 1; radius < 12; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = center + dx;
          const ty = center + dy;
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
    if (this.player.speechBubbleTimer && this.player.speechBubbleTimer > 0) {
      this.player.speechBubbleTimer -= dtSeconds;
      if (this.player.speechBubbleTimer <= 0) {
        this.player.speechBubbleTimer = 0;
        this.player.speechBubbleText = null;
      }
    }

    for (let i = this.combatState.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.combatState.floatingTexts[i];
      ft.elapsed += dtSeconds;
      ft.z += dtSeconds * 0.65;
      if (ft.elapsed >= ft.duration) {
        this.combatState.floatingTexts.splice(i, 1);
      }
    }

    this.updateActorMovement(this.player, dtSeconds, 4.2, true);

    if (this.combatState.active) {
      return;
    }

    for (const npc of this.npcs) {
      if (npc.combat && !npc.combat.isAlive) continue;

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
      this.updateActorMovement(npc, dtSeconds, 2.2, false);
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
        // If player stepped right up to the southern exit gate on the forest clearing path
        if (
          this.map.id === 'forest_clearing' &&
          actor.tileY >= 28 &&
          actor.tileX >= 14 &&
          actor.tileX <= 17
        ) {
          actor.path = [];
          actor.isMoving = false;
          actor.animFrame = 0;
          actor.pendingInteractionPropId = null;
          this.sayPlayerBark('Jeszcze nie czas iść dalej...', 5.0);
          return;
        }
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
          if (actor.pendingAttackTargetId) {
            const enemyId = actor.pendingAttackTargetId;
            actor.pendingAttackTargetId = null;
            this.startCombatWithEnemy(enemyId);
            this.performPlayerCombatAttack(enemyId, this.combatState.selectedAttackMode);
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
