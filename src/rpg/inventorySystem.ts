import {
  CharacterAttributes,
  CharacterEquipmentLoadout,
  EQUIPMENT_CATALOG,
  EquipmentItemDef
} from './characterData';

export enum StatType {
  HealthMax = 'HealthMax',
  ManaMax = 'ManaMax',
  PhysicalDamage = 'PhysicalDamage',
  ArmorRating = 'ArmorRating',
  Strength = 'Strength', // SIŁ (might)
  Agility = 'Agility', // FIN (finesse)
  Resolve = 'Resolve', // DET (resolve)
  Intelligence = 'Intelligence', // WIE (lore)
  Perception = 'Perception', // PER (perception)
  CriticalStrikeChance = 'CriticalStrikeChance',
  MovementSpeed = 'MovementSpeed'
}

export enum ModifierType {
  Flat = 100,
  PercentAdd = 200,
  PercentMult = 300
}

export interface StatModifier {
  targetStat: StatType;
  value: number;
  type: ModifierType;
  sourceId: string;
}

export type ItemType = 'Weapon' | 'Armor' | 'Consumable' | 'Trinket' | 'Quest';

export type EquipSlot =
  | 'head'
  | 'torso'
  | 'cloak'
  | 'legs'
  | 'mainHand'
  | 'offHand'
  | 'ring1'
  | 'ring2';

export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export interface EquipRequirement {
  stat: StatType;
  minValue: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  itemType: ItemType;
  equipSlot: EquipSlot | null;
  isTwoHanded: boolean;
  rarity: ItemRarity;
  maxStack: number;
  weight: number;
  priceSiekance: number;
  baseModifiers: StatModifier[];
  requirements: EquipRequirement[];
  visualDef: EquipmentItemDef;
}

export interface ItemInstance {
  instanceId: string;
  definitionId: string;
  stackCount: number;
  currentDurability: number;
  maxDurability: number;
  dynamicModifiers: StatModifier[];
}

export const STAT_META: Record<
  StatType,
  { label: string; shortLabel: string; icon: string; isPercent?: boolean }
> = {
  [StatType.ArmorRating]: { label: 'Pancerz', shortLabel: 'PANC', icon: '🛡️' },
  [StatType.PhysicalDamage]: { label: 'Obrażenia Fizyczne', shortLabel: 'OBR', icon: '⚔️' },
  [StatType.HealthMax]: { label: 'Maks. Zdrowie', shortLabel: 'HP', icon: '❤️' },
  [StatType.ManaMax]: { label: 'Moc Runiczna', shortLabel: 'MANA', icon: '💧' },
  [StatType.CriticalStrikeChance]: {
    label: 'Szansa na Krytyk',
    shortLabel: 'KRYT',
    icon: '🎯',
    isPercent: true
  },
  [StatType.MovementSpeed]: {
    label: 'Szybkość Ruchu',
    shortLabel: 'RUCH',
    icon: '👢',
    isPercent: true
  },
  [StatType.Strength]: { label: 'Siła (SIŁ)', shortLabel: 'SIŁ', icon: '💪' },
  [StatType.Agility]: { label: 'Finezja (FIN)', shortLabel: 'FIN', icon: '🗡️' },
  [StatType.Resolve]: { label: 'Determinacja (DET)', shortLabel: 'DET', icon: '🔥' },
  [StatType.Intelligence]: { label: 'Wiedza Tajemna (WIE)', shortLabel: 'WIE', icon: '✨' },
  [StatType.Perception]: { label: 'Percepcja (PER)', shortLabel: 'PER', icon: '👁️' }
};

export const RARITY_META: Record<
  ItemRarity,
  { label: string; colorHex: string; order: number }
> = {
  Common: { label: 'Zwykły', colorHex: '#b0b7c6', order: 1 },
  Uncommon: { label: 'Niepospolity', colorHex: '#4cd964', order: 2 },
  Rare: { label: 'Rzadki', colorHex: '#4da6ff', order: 3 },
  Epic: { label: 'Epicki', colorHex: '#c471ed', order: 4 },
  Legendary: { label: 'Legendarny', colorHex: '#f5b942', order: 5 }
};

export const EQUIP_SLOT_LABELS: Record<EquipSlot, { label: string; icon: string }> = {
  head: { label: 'Głowa', icon: '🪖' },
  cloak: { label: 'Płaszcz / Ramiona', icon: '🧣' },
  torso: { label: 'Korpus (Zbroja)', icon: '🥋' },
  legs: { label: 'Nogawice / Buty', icon: '🥾' },
  mainHand: { label: 'Ręka Główna', icon: '⚔️' },
  offHand: { label: 'Ręka Pomocnicza', icon: '🛡️' },
  ring1: { label: 'Pierścień I', icon: '💍' },
  ring2: { label: 'Pierścień II', icon: '📿' }
};

interface ExtendedItemMeta {
  rarity: ItemRarity;
  weight: number;
  priceSiekance?: number;
  maxStack?: number;
  isTwoHanded?: boolean;
  itemType?: ItemType;
  equipSlot?: EquipSlot | null;
  extraModifiers?: Array<{ targetStat: StatType; value: number; type?: ModifierType }>;
  requirements?: EquipRequirement[];
}

const ITEM_METADATA_OVERRIDES: Record<string, ExtendedItemMeta> = {
  item_raw_sausage: {
    rarity: 'Common',
    weight: 0.4,
    priceSiekance: 6,
    maxStack: 10,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_roasted_sausage: {
    rarity: 'Uncommon',
    weight: 0.35,
    priceSiekance: 14,
    maxStack: 10,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_old_mead: {
    rarity: 'Uncommon',
    weight: 0.8,
    priceSiekance: 20,
    maxStack: 5,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_moon_herbs: {
    rarity: 'Rare',
    weight: 0.15,
    priceSiekance: 25,
    maxStack: 10,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_piolun_herb: {
    rarity: 'Common',
    weight: 0.1,
    priceSiekance: 10,
    maxStack: 10,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_dziurawiec_herb: {
    rarity: 'Common',
    weight: 0.1,
    priceSiekance: 10,
    maxStack: 10,
    itemType: 'Consumable',
    equipSlot: null
  },
  item_dzban_miodu: {
    rarity: 'Uncommon',
    weight: 0.9,
    priceSiekance: 22,
    maxStack: 5,
    itemType: 'Consumable',
    equipSlot: null
  },
  trinket_lunula: {
    rarity: 'Rare',
    weight: 0.2,
    priceSiekance: 85,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring2',
    extraModifiers: [
      { targetStat: StatType.Perception, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.ManaMax, value: 15, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat }
    ]
  },
  trinket_kolowrot: {
    rarity: 'Epic',
    weight: 0.3,
    priceSiekance: 175,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring1',
    extraModifiers: [
      { targetStat: StatType.Strength, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 12, type: ModifierType.Flat },
      { targetStat: StatType.PhysicalDamage, value: 2, type: ModifierType.Flat }
    ]
  },
  trinket_motanka: {
    rarity: 'Uncommon',
    weight: 0.1,
    priceSiekance: 35,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring2',
    extraModifiers: [
      { targetStat: StatType.Resolve, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 8, type: ModifierType.Flat }
    ]
  },
  item_runic_compass: {
    rarity: 'Epic',
    weight: 0.5,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring1',
    extraModifiers: [
      { targetStat: StatType.Perception, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 5, type: ModifierType.Flat }
    ]
  },
  ring_wolf_signet: {
    rarity: 'Rare',
    weight: 0.1,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring1',
    extraModifiers: [
      { targetStat: StatType.Strength, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 10, type: ModifierType.Flat }
    ]
  },
  ring_emerald_seal: {
    rarity: 'Rare',
    weight: 0.1,
    maxStack: 1,
    itemType: 'Trinket',
    equipSlot: 'ring2',
    extraModifiers: [
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.ManaMax, value: 15, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 3, type: ModifierType.Flat }
    ]
  },
  torso_warden_brigandine: {
    rarity: 'Uncommon',
    weight: 6.5,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 12, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat }
    ]
  },
  torso_aethel_plate: {
    rarity: 'Epic',
    weight: 13.0,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 28, type: ModifierType.Flat },
      { targetStat: StatType.Strength, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: -5, type: ModifierType.Flat }
    ],
    requirements: [{ stat: StatType.Strength, minValue: 14 }]
  },
  torso_archmage_robes: {
    rarity: 'Rare',
    weight: 2.4,
    extraModifiers: [
      { targetStat: StatType.ManaMax, value: 30, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: 5, type: ModifierType.Flat }
    ]
  },
  torso_linen_tunic: {
    rarity: 'Common',
    weight: 2.0,
    extraModifiers: [
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: 4, type: ModifierType.Flat }
    ]
  },
  torso_przeszywanica: {
    rarity: 'Common',
    weight: 4.5,
    extraModifiers: [
      { targetStat: StatType.ArmorRating, value: 3, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 10, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: 2, type: ModifierType.Flat }
    ]
  },
  torso_slavic_giezlo: {
    rarity: 'Common',
    weight: 1.6,
    extraModifiers: [
      { targetStat: StatType.ArmorRating, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: 5, type: ModifierType.Flat }
    ]
  },
  helm_szyszak: {
    rarity: 'Rare',
    weight: 2.9,
    extraModifiers: [
      { targetStat: StatType.ArmorRating, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 8, type: ModifierType.Flat }
    ]
  },
  helm_klobuk: {
    rarity: 'Common',
    weight: 0.7,
    extraModifiers: [
      { targetStat: StatType.ArmorRating, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat },
      { targetStat: StatType.Perception, value: 1, type: ModifierType.Flat }
    ]
  },
  helm_dread_plate: {
    rarity: 'Rare',
    weight: 3.8,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 10, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat }
    ]
  },
  helm_shadow_hood: {
    rarity: 'Uncommon',
    weight: 1.1,
    extraModifiers: [
      { targetStat: StatType.Agility, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 4, type: ModifierType.Flat }
    ]
  },
  helm_arcane_circlet: {
    rarity: 'Rare',
    weight: 0.6,
    extraModifiers: [
      { targetStat: StatType.Perception, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.ManaMax, value: 18, type: ModifierType.Flat }
    ]
  },
  cloak_crimson_mantle: {
    rarity: 'Uncommon',
    weight: 1.8,
    extraModifiers: [
      { targetStat: StatType.Resolve, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.HealthMax, value: 8, type: ModifierType.Flat }
    ]
  },
  cloak_steel_pauldrons: {
    rarity: 'Rare',
    weight: 4.2,
    extraModifiers: [{ targetStat: StatType.Strength, value: 2, type: ModifierType.Flat }]
  },
  legs_steel_greaves: {
    rarity: 'Rare',
    weight: 4.5,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 10, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: -2, type: ModifierType.Flat }
    ]
  },
  legs_leather_boots: {
    rarity: 'Common',
    weight: 1.6,
    extraModifiers: [
      { targetStat: StatType.MovementSpeed, value: 6, type: ModifierType.Flat },
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat }
    ]
  },
  legs_lapcie: {
    rarity: 'Common',
    weight: 0.8,
    extraModifiers: [
      { targetStat: StatType.MovementSpeed, value: 5, type: ModifierType.Flat },
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat }
    ]
  },
  weapon_slavic_axe: {
    rarity: 'Uncommon',
    weight: 2.8,
    isTwoHanded: false,
    extraModifiers: [
      { targetStat: StatType.Strength, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.PhysicalDamage, value: 3, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 4, type: ModifierType.Flat }
    ]
  },
  weapon_sunblade_longsword: {
    rarity: 'Rare',
    weight: 3.2,
    isTwoHanded: false,
    extraModifiers: [
      { targetStat: StatType.CriticalStrikeChance, value: 5, type: ModifierType.Flat },
      { targetStat: StatType.Agility, value: 1, type: ModifierType.Flat }
    ]
  },
  weapon_Executioner_axe: {
    rarity: 'Epic',
    weight: 6.4,
    isTwoHanded: true,
    extraModifiers: [
      { targetStat: StatType.Strength, value: 3, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 8, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: -4, type: ModifierType.Flat }
    ],
    requirements: [{ stat: StatType.Strength, minValue: 14 }]
  },
  weapon_astral_staff: {
    rarity: 'Legendary',
    weight: 3.0,
    isTwoHanded: true,
    extraModifiers: [
      { targetStat: StatType.ManaMax, value: 35, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 6, type: ModifierType.Flat }
    ]
  },
  offhand_slavic_shield: {
    rarity: 'Uncommon',
    weight: 3.4,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 14, type: ModifierType.Flat },
      { targetStat: StatType.ArmorRating, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 1, type: ModifierType.Flat }
    ]
  },
  offhand_heraldic_shield: {
    rarity: 'Rare',
    weight: 4.8,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 16, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 2, type: ModifierType.Flat }
    ]
  },
  offhand_torch: {
    rarity: 'Common',
    weight: 1.0,
    extraModifiers: [
      { targetStat: StatType.Perception, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.PhysicalDamage, value: 1, type: ModifierType.Flat }
    ]
  },
  offhand_grimoire: {
    rarity: 'Rare',
    weight: 1.8,
    extraModifiers: [
      { targetStat: StatType.ManaMax, value: 24, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 4, type: ModifierType.Flat }
    ]
  },
  weapon_hunting_bow: {
    rarity: 'Rare',
    weight: 2.2,
    priceSiekance: 290,
    isTwoHanded: true,
    extraModifiers: [
      { targetStat: StatType.Agility, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 6, type: ModifierType.Flat }
    ],
    requirements: [{ stat: StatType.Agility, minValue: 11 }]
  },
  cloak_ranger_quiver: {
    rarity: 'Uncommon',
    weight: 1.4,
    priceSiekance: 160,
    extraModifiers: [
      { targetStat: StatType.Agility, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.Perception, value: 1, type: ModifierType.Flat }
    ]
  },
  torso_slavic_lamellar: {
    rarity: 'Epic',
    weight: 8.5,
    priceSiekance: 480,
    extraModifiers: [
      { targetStat: StatType.HealthMax, value: 24, type: ModifierType.Flat },
      { targetStat: StatType.MovementSpeed, value: -3, type: ModifierType.Flat }
    ],
    requirements: [{ stat: StatType.Strength, minValue: 12 }]
  },
  helm_druid_antlers: {
    rarity: 'Epic',
    weight: 1.6,
    priceSiekance: 390,
    extraModifiers: [
      { targetStat: StatType.ManaMax, value: 28, type: ModifierType.Flat },
      { targetStat: StatType.Resolve, value: 2, type: ModifierType.Flat }
    ]
  },
  helm_ranger_cowl: {
    rarity: 'Rare',
    weight: 0.9,
    priceSiekance: 240,
    extraModifiers: [
      { targetStat: StatType.Perception, value: 2, type: ModifierType.Flat },
      { targetStat: StatType.CriticalStrikeChance, value: 4, type: ModifierType.Flat }
    ]
  }
};

const flyweightDefinitionCache = new Map<string, ItemDefinition>();

export function getItemDefinition(definitionId: string): ItemDefinition | undefined {
  const cached = flyweightDefinitionCache.get(definitionId);
  if (cached) return cached;

  const raw = EQUIPMENT_CATALOG[definitionId];
  if (!raw) return undefined;

  const meta = ITEM_METADATA_OVERRIDES[definitionId];
  const baseModifiers: StatModifier[] = [];

  if (raw.armorBonus) {
    baseModifiers.push({
      targetStat: StatType.ArmorRating,
      value: raw.armorBonus,
      type: ModifierType.Flat,
      sourceId: definitionId
    });
  }
  if (raw.attackBonus) {
    baseModifiers.push({
      targetStat: StatType.PhysicalDamage,
      value: raw.attackBonus,
      type: ModifierType.Flat,
      sourceId: definitionId
    });
  }
  if (raw.loreBonus) {
    baseModifiers.push({
      targetStat: StatType.Intelligence,
      value: raw.loreBonus,
      type: ModifierType.Flat,
      sourceId: definitionId
    });
  }

  if (meta?.extraModifiers) {
    for (const em of meta.extraModifiers) {
      baseModifiers.push({
        targetStat: em.targetStat,
        value: em.value,
        type: em.type ?? ModifierType.Flat,
        sourceId: definitionId
      });
    }
  }

  let itemType: ItemType = 'Armor';
  if (meta?.itemType) {
    itemType = meta.itemType;
  } else if (raw.slot === 'mainHand') {
    itemType = 'Weapon';
  } else if (raw.slot === 'consumable') {
    itemType = 'Consumable';
  } else if (raw.slot === 'relic') {
    itemType = 'Trinket';
  }

  let equipSlot: EquipSlot | null = null;
  if (meta && 'equipSlot' in meta) {
    equipSlot = meta.equipSlot ?? null;
  } else if (raw.slot !== 'consumable' && raw.slot !== 'relic') {
    equipSlot = raw.slot;
  } else if (raw.slot === 'relic') {
    equipSlot = 'ring1';
  }

  let priceSiekance = meta?.priceSiekance ?? raw.priceSiekance;
  if (!priceSiekance || priceSiekance <= 0) {
    const rarity = meta?.rarity ?? 'Common';
    switch (rarity) {
      case 'Legendary':
        priceSiekance = 350;
        break;
      case 'Epic':
        priceSiekance = 150;
        break;
      case 'Rare':
        priceSiekance = 75;
        break;
      case 'Uncommon':
        priceSiekance = itemType === 'Consumable' ? 18 : 35;
        break;
      case 'Common':
      default:
        priceSiekance = itemType === 'Consumable' ? 6 : 14;
        break;
    }
  }

  const def: ItemDefinition = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    itemType,
    equipSlot,
    isTwoHanded: Boolean(meta?.isTwoHanded),
    rarity: meta?.rarity ?? 'Common',
    maxStack: meta?.maxStack ?? (itemType === 'Consumable' ? 5 : 1),
    weight: meta?.weight ?? 2.0,
    priceSiekance,
    baseModifiers,
    requirements: meta?.requirements ?? [],
    visualDef: raw
  };

  flyweightDefinitionCache.set(definitionId, def);
  return def;
}

export function getItemPriceInSiekance(
  target: ItemInstance | ItemDefinition | string
): number {
  let def: ItemDefinition | undefined;
  let count = 1;

  if (typeof target === 'string') {
    def = getItemDefinition(target);
  } else if ('instanceId' in target) {
    def = getItemDefinition(target.definitionId);
    count = target.stackCount || 1;
  } else {
    def = target;
  }

  if (!def) return Math.max(1, 5 * count);
  return Math.max(1, def.priceSiekance * count);
}

let nextInstanceCounter = 1;

/**
 * Advances `nextInstanceCounter` above any numeric suffix found in restored instanceIds
 * so newly created items after loading a save never collide with existing IDs.
 */
export function syncInstanceCounter(instanceIds: Iterable<string>): void {
  let maxSeen = nextInstanceCounter - 1;
  for (const id of instanceIds) {
    const lastUnderscore = id.lastIndexOf('_');
    if (lastUnderscore >= 0) {
      const parsed = Number.parseInt(id.slice(lastUnderscore + 1), 10);
      if (Number.isFinite(parsed) && parsed > maxSeen) {
        maxSeen = parsed;
      }
    }
  }
  if (maxSeen >= nextInstanceCounter) {
    nextInstanceCounter = maxSeen + 1;
  }
}

export function createItemInstance(
  definitionId: string,
  stackCount = 1,
  dynamicModifiers: StatModifier[] = []
): ItemInstance {
  const def = getItemDefinition(definitionId);
  const maxClamp = def ? def.maxStack : 1;
  return {
    instanceId: `inst_${definitionId}_${nextInstanceCounter++}`,
    definitionId,
    stackCount: Math.max(1, Math.min(maxClamp, stackCount)),
    currentDurability: 100,
    maxDurability: 100,
    dynamicModifiers: [...dynamicModifiers]
  };
}

export function getAllItemModifiers(item: ItemInstance): StatModifier[] {
  const def = getItemDefinition(item.definitionId);
  if (!def) return [...item.dynamicModifiers];
  return [
    ...def.baseModifiers.map((m) => ({ ...m, sourceId: item.instanceId })),
    ...item.dynamicModifiers.map((m) => ({ ...m, sourceId: item.instanceId }))
  ];
}

export function getItemStatTotal(item: ItemInstance | null, stat: StatType): number {
  if (!item) return 0;
  const mods = getAllItemModifiers(item).filter((m) => m.targetStat === stat);
  let flat = 0;
  for (const m of mods) {
    if (m.type === ModifierType.Flat) {
      flat += m.value;
    } else if (m.type === ModifierType.PercentAdd) {
      flat += m.value * 100;
    }
  }
  return Number(flat.toFixed(2));
}

export class CharacterStatSheet {
  private baseAttributes: CharacterAttributes;
  private modifiers: StatModifier[] = [];
  private onStatsChangedCallbacks: Array<(sheet: CharacterStatSheet) => void> = [];

  constructor(baseAttributes: CharacterAttributes) {
    this.baseAttributes = { ...baseAttributes };
  }

  public setBaseAttributes(attrs: CharacterAttributes): void {
    this.baseAttributes = { ...attrs };
    this.notifyChanged();
  }

  public getBaseAttributes(): CharacterAttributes {
    return { ...this.baseAttributes };
  }

  public onStatsChanged(cb: (sheet: CharacterStatSheet) => void): () => void {
    this.onStatsChangedCallbacks.push(cb);
    return () => {
      const idx = this.onStatsChangedCallbacks.indexOf(cb);
      if (idx >= 0) this.onStatsChangedCallbacks.splice(idx, 1);
    };
  }

  public addModifier(mod: StatModifier): void {
    this.modifiers.push({ ...mod });
    this.notifyChanged();
  }

  public removeModifiersBySource(sourceId: string): void {
    this.modifiers = this.modifiers.filter((m) => m.sourceId !== sourceId);
    this.notifyChanged();
  }

  public clearAllModifiers(): void {
    this.modifiers = [];
    this.notifyChanged();
  }

  public getModifiers(): ReadonlyArray<StatModifier> {
    return this.modifiers;
  }

  public clone(): CharacterStatSheet {
    const copy = new CharacterStatSheet(this.baseAttributes);
    copy.modifiers = this.modifiers.map((m) => ({ ...m }));
    return copy;
  }

  private computeFormula(baseValue: number, stat: StatType): number {
    let sumFlat = 0;
    let sumPercentAdd = 0;
    let prodPercentMult = 1.0;

    for (const m of this.modifiers) {
      if (m.targetStat !== stat) continue;
      if (m.type === ModifierType.Flat) {
        sumFlat += m.value;
      } else if (m.type === ModifierType.PercentAdd) {
        sumPercentAdd += m.value;
      } else if (m.type === ModifierType.PercentMult) {
        prodPercentMult *= 1.0 + m.value;
      }
    }

    const raw = (baseValue + sumFlat) * (1.0 + sumPercentAdd) * prodPercentMult;
    return Number(raw.toFixed(2));
  }

  public getStatValue(stat: StatType): number {
    switch (stat) {
      case StatType.Strength:
        return this.computeFormula(this.baseAttributes.might, StatType.Strength);
      case StatType.Agility:
        return this.computeFormula(this.baseAttributes.finesse, StatType.Agility);
      case StatType.Resolve:
        return this.computeFormula(this.baseAttributes.resolve, StatType.Resolve);
      case StatType.Intelligence:
        return this.computeFormula(this.baseAttributes.lore, StatType.Intelligence);
      case StatType.Perception:
        return this.computeFormula(this.baseAttributes.perception, StatType.Perception);
      case StatType.ArmorRating:
        return this.computeFormula(0, StatType.ArmorRating);
      case StatType.PhysicalDamage: {
        // Derived: base physical damage scales with Strength above 10 (+1 per 2 Strength)
        const str = this.getStatValue(StatType.Strength);
        const baseDmg = Math.max(1, Math.floor((str - 10) * 0.5));
        return this.computeFormula(baseDmg, StatType.PhysicalDamage);
      }
      case StatType.HealthMax: {
        const res = this.getStatValue(StatType.Resolve);
        const str = this.getStatValue(StatType.Strength);
        const baseHp = 60 + res * 4 + str * 2;
        return this.computeFormula(baseHp, StatType.HealthMax);
      }
      case StatType.ManaMax: {
        const intel = this.getStatValue(StatType.Intelligence);
        const baseMana = 20 + intel * 5;
        return this.computeFormula(baseMana, StatType.ManaMax);
      }
      case StatType.CriticalStrikeChance: {
        const agi = this.getStatValue(StatType.Agility);
        const per = this.getStatValue(StatType.Perception);
        const baseCrit = Math.max(2, Math.round((agi - 10) * 1.2 + (per - 10) * 0.8 + 5));
        return this.computeFormula(baseCrit, StatType.CriticalStrikeChance);
      }
      case StatType.MovementSpeed: {
        return this.computeFormula(100, StatType.MovementSpeed);
      }
    }
  }

  public getEffectiveAttributes(): CharacterAttributes {
    return {
      might: Math.round(this.getStatValue(StatType.Strength)),
      finesse: Math.round(this.getStatValue(StatType.Agility)),
      resolve: Math.round(this.getStatValue(StatType.Resolve)),
      lore: Math.round(this.getStatValue(StatType.Intelligence)),
      perception: Math.round(this.getStatValue(StatType.Perception))
    };
  }

  public getMaxCarryWeight(): number {
    const str = this.getStatValue(StatType.Strength);
    return Number((25 + str * 2.5).toFixed(1));
  }

  private notifyChanged(): void {
    for (const cb of this.onStatsChangedCallbacks) {
      cb(this);
    }
  }
}

export interface InventorySlotEntry {
  index: number;
  item: ItemInstance | null;
}

export class InventoryContainer {
  public readonly capacity: number;
  public maxWeight: number;
  private readonly slots: Array<ItemInstance | null>;

  constructor(capacity = 20, maxWeight = 62.5) {
    this.capacity = capacity;
    this.maxWeight = maxWeight;
    this.slots = new Array<ItemInstance | null>(capacity).fill(null);
  }

  public get currentWeight(): number {
    let sum = 0;
    for (const it of this.slots) {
      if (!it) continue;
      const def = getItemDefinition(it.definitionId);
      sum += (def?.weight ?? 1.0) * it.stackCount;
    }
    return Number(sum.toFixed(2));
  }

  public get isFull(): boolean {
    return this.getOccupiedSlots().length >= this.capacity;
  }

  public getSlots(): ReadonlyArray<ItemInstance | null> {
    return this.slots;
  }

  public getSlot(index: number): ItemInstance | null {
    return this.slots[index] ?? null;
  }

  public getOccupiedSlots(): InventorySlotEntry[] {
    const out: InventorySlotEntry[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i]) {
        out.push({ index: i, item: this.slots[i] });
      }
    }
    return out;
  }

  public clearAllSlots(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i] = null;
    }
  }

  public setSlot(index: number, item: ItemInstance | null): void {
    if (index >= 0 && index < this.capacity) {
      this.slots[index] = item;
    }
  }

  public findByInstanceId(instanceId: string): { index: number; item: ItemInstance } | undefined {
    for (let i = 0; i < this.slots.length; i++) {
      const it = this.slots[i];
      if (it && it.instanceId === instanceId) {
        return { index: i, item: it };
      }
    }
    return undefined;
  }

  public findByDefinitionId(definitionId: string): { index: number; item: ItemInstance } | undefined {
    for (let i = 0; i < this.slots.length; i++) {
      const it = this.slots[i];
      if (it && it.definitionId === definitionId) {
        return { index: i, item: it };
      }
    }
    return undefined;
  }

  public hasDefinitionId(definitionId: string): boolean {
    return Boolean(this.findByDefinitionId(definitionId));
  }

  public tryAddItem(item: ItemInstance, ignoreWeightLimit = false): boolean {
    const def = getItemDefinition(item.definitionId);
    const unitWeight = def?.weight ?? 1.0;
    const addedWeight = unitWeight * item.stackCount;

    if (!ignoreWeightLimit && this.currentWeight + addedWeight > this.maxWeight + 0.001) {
      return false;
    }

    const maxStack = def?.maxStack ?? 1;
    let remaining = item.stackCount;

    // Pre-check total capacity before mutating slots so failed calls never partially mutate
    let existingPartialSpace = 0;
    let emptySlotCount = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const existing = this.slots[i];
      if (existing === null) {
        emptySlotCount++;
      } else if (maxStack > 1 && existing.definitionId === item.definitionId && existing.stackCount < maxStack) {
        existingPartialSpace += maxStack - existing.stackCount;
      }
    }
    if (existingPartialSpace + emptySlotCount * maxStack < remaining) {
      return false;
    }

    // 1. Try merging onto existing partial stacks of the same definitionId
    if (maxStack > 1) {
      for (let i = 0; i < this.slots.length && remaining > 0; i++) {
        const existing = this.slots[i];
        if (existing && existing.definitionId === item.definitionId && existing.stackCount < maxStack) {
          const canAdd = Math.min(remaining, maxStack - existing.stackCount);
          existing.stackCount += canAdd;
          remaining -= canAdd;
        }
      }
    }

    if (remaining === 0) return true;

    // 2. Place remaining into empty slots
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const chunk = Math.min(remaining, maxStack);
        this.slots[i] = {
          ...item,
          instanceId: remaining === item.stackCount ? item.instanceId : createItemInstance(item.definitionId, chunk).instanceId,
          stackCount: chunk
        };
        remaining -= chunk;
      }
    }

    return remaining === 0;
  }

  public removeItem(instanceId: string, count = 1): boolean {
    const found = this.findByInstanceId(instanceId);
    if (!found) return false;

    if (found.item.stackCount > count) {
      found.item.stackCount -= count;
    } else {
      this.slots[found.index] = null;
    }
    return true;
  }

  public removeByDefinitionId(definitionId: string, count = 1): boolean {
    const found = this.findByDefinitionId(definitionId);
    if (!found) return false;
    return this.removeItem(found.item.instanceId, count);
  }

  public splitStack(slotIndex: number, splitCount: number): boolean {
    const slotItem = this.slots[slotIndex];
    if (!slotItem || splitCount <= 0 || splitCount >= slotItem.stackCount) {
      return false;
    }

    const emptyIdx = this.slots.findIndex((s) => s === null);
    if (emptyIdx === -1) return false;

    slotItem.stackCount -= splitCount;
    this.slots[emptyIdx] = createItemInstance(
      slotItem.definitionId,
      splitCount,
      slotItem.dynamicModifiers
    );
    return true;
  }

  public swapSlots(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.slots.length ||
      toIndex < 0 ||
      toIndex >= this.slots.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const a = this.slots[fromIndex];
    const b = this.slots[toIndex];

    // If both slots contain stackable items of the same definitionId, merge them
    if (a && b && a.definitionId === b.definitionId) {
      const def = getItemDefinition(a.definitionId);
      const maxStack = def?.maxStack ?? 1;
      if (maxStack > 1 && b.stackCount < maxStack) {
        const transfer = Math.min(a.stackCount, maxStack - b.stackCount);
        b.stackCount += transfer;
        a.stackCount -= transfer;
        if (a.stackCount <= 0) {
          this.slots[fromIndex] = null;
        }
        return;
      }
    }

    this.slots[fromIndex] = b;
    this.slots[toIndex] = a;
  }

  public sortBy(criterion: 'rarity' | 'type' | 'weight' | 'name'): void {
    const items = this.slots.filter((s): s is ItemInstance => s !== null);
    items.sort((a, b) => {
      const defA = getItemDefinition(a.definitionId);
      const defB = getItemDefinition(b.definitionId);
      if (!defA || !defB) return 0;

      if (criterion === 'rarity') {
        const diff = RARITY_META[defB.rarity].order - RARITY_META[defA.rarity].order;
        if (diff !== 0) return diff;
      } else if (criterion === 'type') {
        const cmp = defA.itemType.localeCompare(defB.itemType);
        if (cmp !== 0) return cmp;
      } else if (criterion === 'weight') {
        const diff = defB.weight * b.stackCount - defA.weight * a.stackCount;
        if (diff !== 0) return diff;
      }
      return defA.name.localeCompare(defB.name, 'pl');
    });

    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i] = items[i] ?? null;
    }
  }
}

export interface EquipOperationResult {
  success: boolean;
  reason?: string;
  slot?: EquipSlot;
  equippedItem?: ItemInstance | null;
  unequippedItems?: ItemInstance[];
}

export class EquipmentManager {
  private readonly inventory: InventoryContainer;
  private readonly statSheet: CharacterStatSheet;
  private readonly equipped: Record<EquipSlot, ItemInstance | null> = {
    head: null,
    torso: null,
    cloak: null,
    legs: null,
    mainHand: null,
    offHand: null,
    ring1: null,
    ring2: null
  };
  private readonly changeListeners: Array<
    (slot: EquipSlot, oldItem: ItemInstance | null, newItem: ItemInstance | null) => void
  > = [];

  constructor(inventory: InventoryContainer, statSheet: CharacterStatSheet) {
    this.inventory = inventory;
    this.statSheet = statSheet;
  }

  public onEquipmentChanged(
    cb: (slot: EquipSlot, oldItem: ItemInstance | null, newItem: ItemInstance | null) => void
  ): () => void {
    this.changeListeners.push(cb);
    return () => {
      const idx = this.changeListeners.indexOf(cb);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    };
  }

  public getEquipped(slot: EquipSlot): ItemInstance | null {
    return this.equipped[slot];
  }

  public getAllEquipped(): Readonly<Record<EquipSlot, ItemInstance | null>> {
    return this.equipped;
  }

  public clearAllEquipped(): void {
    const slots = Object.keys(this.equipped) as EquipSlot[];
    for (const slot of slots) {
      const current = this.equipped[slot];
      if (current) {
        this.statSheet.removeModifiersBySource(current.instanceId);
        this.equipped[slot] = null;
        this.notifyChange(slot, current, null);
      }
    }
  }

  public getEquippedWeight(): number {
    let sum = 0;
    for (const item of Object.values(this.equipped)) {
      if (!item) continue;
      const def = getItemDefinition(item.definitionId);
      sum += def?.weight ?? 0;
    }
    return Number(sum.toFixed(2));
  }

  public checkRequirements(item: ItemInstance): { ok: boolean; missing: EquipRequirement[] } {
    const def = getItemDefinition(item.definitionId);
    if (!def || def.requirements.length === 0) {
      return { ok: true, missing: [] };
    }
    const missing: EquipRequirement[] = [];
    for (const req of def.requirements) {
      if (this.statSheet.getStatValue(req.stat) < req.minValue) {
        missing.push(req);
      }
    }
    return { ok: missing.length === 0, missing };
  }

  public resolveTargetSlot(def: ItemDefinition, preferredSlot?: EquipSlot): EquipSlot | null {
    if (preferredSlot) return preferredSlot;
    if (!def.equipSlot) return null;

    if (def.equipSlot === 'ring1' || def.equipSlot === 'ring2') {
      if (!this.equipped.ring1) return 'ring1';
      if (!this.equipped.ring2) return 'ring2';
      return 'ring1';
    }
    return def.equipSlot;
  }

  public equipDirectInstance(item: ItemInstance, targetSlot?: EquipSlot): void {
    const def = getItemDefinition(item.definitionId);
    if (!def) return;
    const slot = this.resolveTargetSlot(def, targetSlot);
    if (!slot) return;

    const prev = this.equipped[slot];
    if (prev) {
      this.statSheet.removeModifiersBySource(prev.instanceId);
    }

    this.equipped[slot] = item;
    for (const mod of getAllItemModifiers(item)) {
      this.statSheet.addModifier(mod);
    }
    this.notifyChange(slot, prev, item);
  }

  public equipFromInventory(
    instanceId: string,
    preferredSlot?: EquipSlot
  ): EquipOperationResult {
    const found = this.inventory.findByInstanceId(instanceId);
    if (!found) {
      return { success: false, reason: 'Przedmiot nie znajduje się w plecaku.' };
    }

    const candidate = found.item;
    const def = getItemDefinition(candidate.definitionId);
    if (!def || !def.equipSlot) {
      return { success: false, reason: 'Tego przedmiotu nie można założyć w slocie rynsztunku.' };
    }

    const reqCheck = this.checkRequirements(candidate);
    if (!reqCheck.ok) {
      const reqText = reqCheck.missing
        .map((r) => `${STAT_META[r.stat].shortLabel} >= ${r.minValue}`)
        .join(', ');
      return {
        success: false,
        reason: `Niespełnione wymagania przedmiotu (${reqText}).`
      };
    }

    const targetSlot = this.resolveTargetSlot(def, preferredSlot);
    if (!targetSlot) {
      return { success: false, reason: 'Brak pasującego slotu wyposażenia.' };
    }

    // Determine how many items will be unequipped back to the backpack
    let unequipCount = this.equipped[targetSlot] ? 1 : 0;
    const needsUnequipOffhand = targetSlot === 'mainHand' && def.isTwoHanded && Boolean(this.equipped.offHand);
    const needsUnequipTwoHandMain =
      targetSlot === 'offHand' &&
      Boolean(this.equipped.mainHand) &&
      Boolean(getItemDefinition(this.equipped.mainHand!.definitionId)?.isTwoHanded);
    if (needsUnequipOffhand || needsUnequipTwoHandMain) {
      unequipCount++;
    }

    // If candidate is a single-item stack, removing it frees 1 slot; otherwise it stays in backpack
    const freedCandidateSlot = candidate.stackCount <= 1 ? 1 : 0;
    const netSlotsNeeded = unequipCount - freedCandidateSlot;
    if (netSlotsNeeded > 0) {
      let emptySlots = 0;
      const slots = this.inventory.getSlots();
      for (let i = 0; i < slots.length; i++) {
        if (slots[i] === null) emptySlots++;
      }
      if (emptySlots < netSlotsNeeded) {
        return { success: false, reason: 'Brak miejsca w plecaku na zdjęty ekwipunek.' };
      }
    }

    const unequippedItems: ItemInstance[] = [];
    const wasMultiStack = candidate.stackCount > 1;

    // Remove candidate from inventory first
    this.inventory.removeItem(candidate.instanceId, 1);

    // 1. If equipping a Two-Handed weapon in mainHand -> also unequip offHand!
    if (needsUnequipOffhand && this.equipped.offHand) {
      const offItem = this.equipped.offHand;
      this.equipped.offHand = null;
      this.statSheet.removeModifiersBySource(offItem.instanceId);
      this.inventory.tryAddItem(offItem, true);
      unequippedItems.push(offItem);
      this.notifyChange('offHand', offItem, null);
    }

    // 2. If equipping an offHand item while a Two-Handed weapon is in mainHand -> unequip mainHand!
    if (needsUnequipTwoHandMain && this.equipped.mainHand) {
      const twoHandItem = this.equipped.mainHand;
      this.equipped.mainHand = null;
      this.statSheet.removeModifiersBySource(twoHandItem.instanceId);
      this.inventory.tryAddItem(twoHandItem, true);
      unequippedItems.push(twoHandItem);
      this.notifyChange('mainHand', twoHandItem, null);
    }

    // 3. Unequip existing item in targetSlot back to backpack
    const previousInSlot = this.equipped[targetSlot];
    if (previousInSlot) {
      this.equipped[targetSlot] = null;
      this.statSheet.removeModifiersBySource(previousInSlot.instanceId);
      this.inventory.tryAddItem(previousInSlot, true);
      unequippedItems.push(previousInSlot);
    }

    // 4. Equip candidate and register its modifiers (allocate a fresh instanceId if split from a stack)
    const singleEquipped: ItemInstance = wasMultiStack
      ? createItemInstance(candidate.definitionId, 1, candidate.dynamicModifiers)
      : { ...candidate, stackCount: 1 };
    this.equipped[targetSlot] = singleEquipped;
    for (const mod of getAllItemModifiers(singleEquipped)) {
      this.statSheet.addModifier(mod);
    }

    this.notifyChange(targetSlot, previousInSlot, singleEquipped);
    return {
      success: true,
      slot: targetSlot,
      equippedItem: singleEquipped,
      unequippedItems
    };
  }

  public unequipToInventory(slot: EquipSlot): EquipOperationResult {
    const current = this.equipped[slot];
    if (!current) {
      return { success: false, reason: 'Slot jest już pusty.' };
    }

    // Torso and legs require a garment on paperdoll unless replaced, or allow unequipping with fallback visual
    if (!this.inventory.tryAddItem(current, true)) {
      return { success: false, reason: 'Brak wolnego miejsca w plecaku!' };
    }

    this.equipped[slot] = null;
    this.statSheet.removeModifiersBySource(current.instanceId);
    this.notifyChange(slot, current, null);

    return {
      success: true,
      slot,
      equippedItem: null,
      unequippedItems: [current]
    };
  }

  public toVisualLoadout(): CharacterEquipmentLoadout {
    return {
      head: this.equipped.head?.definitionId ?? null,
      torso: this.equipped.torso?.definitionId ?? 'torso_linen_tunic',
      cloak: this.equipped.cloak?.definitionId ?? null,
      legs: this.equipped.legs?.definitionId ?? 'legs_leather_boots',
      mainHand: this.equipped.mainHand?.definitionId ?? null,
      offHand: this.equipped.offHand?.definitionId ?? null
    };
  }

  private notifyChange(
    slot: EquipSlot,
    oldItem: ItemInstance | null,
    newItem: ItemInstance | null
  ): void {
    for (const cb of this.changeListeners) {
      cb(slot, oldItem, newItem);
    }
  }
}

export interface ComparisonStatDelta {
  stat: StatType;
  currentValue: number;
  newValue: number;
  delta: number;
  isUpgrade: boolean;
}

export interface ItemComparisonReport {
  candidate: ItemInstance;
  candidateDef: ItemDefinition;
  targetSlot: EquipSlot | null;
  comparedEquippedItems: ItemInstance[];
  meetsRequirements: boolean;
  missingRequirements: EquipRequirement[];
  directDeltas: ComparisonStatDelta[];
  characterImpacts: ComparisonStatDelta[];
}

const ORDERED_COMPARISON_STATS: ReadonlyArray<StatType> = [
  StatType.ArmorRating,
  StatType.PhysicalDamage,
  StatType.HealthMax,
  StatType.ManaMax,
  StatType.CriticalStrikeChance,
  StatType.MovementSpeed,
  StatType.Strength,
  StatType.Agility,
  StatType.Resolve,
  StatType.Intelligence,
  StatType.Perception
];

export class ItemComparisonEngine {
  public static compareCandidate(
    candidate: ItemInstance,
    equipMgr: EquipmentManager,
    currentSheet: CharacterStatSheet,
    preferredSlot?: EquipSlot
  ): ItemComparisonReport {
    const def = getItemDefinition(candidate.definitionId);
    if (!def) {
      throw new Error(`Unknown ItemDefinition: ${candidate.definitionId}`);
    }

    const reqCheck = equipMgr.checkRequirements(candidate);
    const targetSlot = equipMgr.resolveTargetSlot(def, preferredSlot);

    const comparedEquippedItems: ItemInstance[] = [];
    if (targetSlot) {
      const primaryEquipped = equipMgr.getEquipped(targetSlot);
      if (primaryEquipped) comparedEquippedItems.push(primaryEquipped);

      // If candidate is TwoHanded, it replaces both mainHand and offHand
      if (targetSlot === 'mainHand' && def.isTwoHanded) {
        const offEquipped = equipMgr.getEquipped('offHand');
        if (offEquipped) comparedEquippedItems.push(offEquipped);
      }

      // If candidate is offHand and currently wearing a TwoHanded weapon in mainHand
      if (targetSlot === 'offHand') {
        const mainEquipped = equipMgr.getEquipped('mainHand');
        const mainDef = mainEquipped ? getItemDefinition(mainEquipped.definitionId) : undefined;
        if (mainEquipped && mainDef?.isTwoHanded) {
          comparedEquippedItems.push(mainEquipped);
        }
      }
    }

    // 1. Direct Delta between CandidateItem and ComparedEquippedItems
    const statSet = new Set<StatType>();
    for (const m of getAllItemModifiers(candidate)) {
      statSet.add(m.targetStat);
    }
    for (const eqItem of comparedEquippedItems) {
      for (const m of getAllItemModifiers(eqItem)) {
        statSet.add(m.targetStat);
      }
    }

    const directDeltas: ComparisonStatDelta[] = [];
    for (const stat of ORDERED_COMPARISON_STATS) {
      if (!statSet.has(stat)) continue;
      const currentValue = comparedEquippedItems.reduce(
        (acc, it) => acc + getItemStatTotal(it, stat),
        0
      );
      const newValue = getItemStatTotal(candidate, stat);
      const delta = Number((newValue - currentValue).toFixed(2));
      directDeltas.push({
        stat,
        currentValue,
        newValue,
        delta,
        isUpgrade: delta > 0
      });
    }

    // 2. Character Impact Simulation via TransientStatSheet
    const transientSheet = currentSheet.clone();
    if (targetSlot) {
      for (const eqItem of comparedEquippedItems) {
        transientSheet.removeModifiersBySource(eqItem.instanceId);
      }
      for (const mod of getAllItemModifiers(candidate)) {
        transientSheet.addModifier(mod);
      }
    }

    const characterImpacts: ComparisonStatDelta[] = [];
    for (const stat of ORDERED_COMPARISON_STATS) {
      const currentVal = currentSheet.getStatValue(stat);
      const simulatedVal = transientSheet.getStatValue(stat);
      const delta = Number((simulatedVal - currentVal).toFixed(2));
      if (Math.abs(delta) >= 0.01) {
        characterImpacts.push({
          stat,
          currentValue: currentVal,
          newValue: simulatedVal,
          delta,
          isUpgrade: delta > 0
        });
      }
    }

    return {
      candidate,
      candidateDef: def,
      targetSlot,
      comparedEquippedItems,
      meetsRequirements: reqCheck.ok,
      missingRequirements: reqCheck.missing,
      directDeltas,
      characterImpacts
    };
  }
}
