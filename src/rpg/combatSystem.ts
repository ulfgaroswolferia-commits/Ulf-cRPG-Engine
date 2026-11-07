import { EQUIPMENT_CATALOG } from './characterData';
import { CharacterStatSheet, StatType } from './inventorySystem';

export type WeaponProficiencyCategory =
  | 'blades'
  | 'axes_blunt'
  | 'runic_staffs'
  | 'unarmed_shield';

export type WeaponProficiencySet = Record<WeaponProficiencyCategory, number>;

export type EnemyDifficultyTier = 'easy' | 'normal' | 'very_hard';

export type CombatAttackMode =
  | 'quick'
  | 'power'
  | 'aimed_head'
  | 'aimed_torso'
  | 'aimed_legs';

export type CombatStatusEffect = 'dazed_head' | 'crippled_legs';

export interface WeaponCombatProfile {
  category: WeaponProficiencyCategory;
  label: string;
  shortLabel: string;
  icon: string;
  minRange: number;
  maxRange: number;
  baseApCost: number;
  armorPenetrationRatio: number; // 0.0 .. 0.85
  accuracyBonus: number;
  critBonus: number;
}

export interface AttackModeMetadata {
  id: CombatAttackMode;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  apDelta: number;
  hitMod: number;
  damageMult: number;
  critMod: number;
  armorPenBonus: number;
  statusOnHit?: CombatStatusEffect;
}

export const PROFICIENCY_META: Record<
  WeaponProficiencyCategory,
  { label: string; shortLabel: string; icon: string; desc: string }
> = {
  blades: {
    label: 'Ostrza i Miecze',
    shortLabel: 'Ostrza',
    icon: '🗡️',
    desc: 'Wysoka celność (+12% Hit), zbalansowany koszt AP (4 AP) i premia do parowania.'
  },
  axes_blunt: {
    label: 'Topory i Broń Ciężka (2H)',
    shortLabel: 'Topory 2H',
    icon: '🪓',
    desc: 'Potężne przebicie pancerza (ignoruje 55% DT i DR wroga!), koszt bazowy 5 AP.'
  },
  runic_staffs: {
    label: 'Kostury i Magia Runiczna',
    shortLabel: 'Kostury',
    icon: '✨',
    desc: 'Atak dystansowy (zasięg do 5 kafli), obrażenia skalowane z Wiedzą Tajemną, omija 65% pancerza.'
  },
  unarmed_shield: {
    label: 'Walka Wręcz i Tarczą',
    shortLabel: 'Wręcz',
    icon: '🥊',
    desc: 'Błyskawiczne uderzenia za 3 AP, dobre w zwarciu.'
  }
};

export const ATTACK_MODE_META: Record<CombatAttackMode, AttackModeMetadata> = {
  quick: {
    id: 'quick',
    label: 'Szybki Atak',
    shortLabel: 'Szybki',
    icon: '⚔️',
    description: 'Standardowe uderzenie o wysokiej celności (+5% Hit, 100% obrażeń).',
    apDelta: 0,
    hitMod: 5,
    damageMult: 1.0,
    critMod: 0,
    armorPenBonus: 0
  },
  power: {
    id: 'power',
    label: 'Potężny Zamach',
    shortLabel: 'Mocny (+1 AP)',
    icon: '💥',
    description: 'Ciężkie uderzenie zza głowy (-10% Hit, +38% obrażeń, +25% przebicia pancerza).',
    apDelta: 1,
    hitMod: -10,
    damageMult: 1.38,
    critMod: 8,
    armorPenBonus: 0.25
  },
  aimed_torso: {
    id: 'aimed_torso',
    label: 'Celowany: Korpus',
    shortLabel: '🎯 Korpus (+1 AP)',
    icon: '🎯',
    description: 'Precyzyjne pchnięcie w szczeliny zbroi (-10% Hit, +25% obrażeń, +15% Krytyk).',
    apDelta: 1,
    hitMod: -10,
    damageMult: 1.25,
    critMod: 15,
    armorPenBonus: 0.2
  },
  aimed_head: {
    id: 'aimed_head',
    label: 'Celowany: Głowa',
    shortLabel: '💀 Głowa (+1 AP)',
    icon: '💀',
    description: 'Ryzykowny cios w głowę (-24% Hit, +65% obrażeń, +35% Krytyk, zamroczenie -3 AP).',
    apDelta: 1,
    hitMod: -24,
    damageMult: 1.65,
    critMod: 35,
    armorPenBonus: 0.35,
    statusOnHit: 'dazed_head'
  },
  aimed_legs: {
    id: 'aimed_legs',
    label: 'Celowany: Nogi',
    shortLabel: '🦵 Nogi (+1 AP)',
    icon: '🦵',
    description: 'Podcięcie ścięgien (-15% Hit, +15% obrażeń, okalecza ruch wroga: 2 AP za kafel!).',
    apDelta: 1,
    hitMod: -15,
    damageMult: 1.15,
    critMod: 15,
    armorPenBonus: 0.15,
    statusOnHit: 'crippled_legs'
  }
};

export interface DerivedCombatStats {
  maxHp: number;
  maxAp: number;
  sequence: number;
  evasionPct: number;
  damageThreshold: number; // DT (flat damage reduction before DR)
  damageResistancePct: number; // DR % (percentage reduction)
  minDamage: number;
  maxDamage: number;
  critChancePct: number;
  activeProficiency: number;
  weaponProfile: WeaponCombatProfile;
}

export interface ActorCombatComponent {
  isHostile: boolean;
  difficulty?: EnemyDifficultyTier;
  difficultyLabel?: string;
  aggroRadius: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  proficiencies: WeaponProficiencySet;
  defending: boolean;
  dazedHeadTurns: number;
  crippledLegsTurns: number;
  xpReward: number;
  lootTable: string[];
  isAlive: boolean;
  customArmorBonus?: number;
  customDamageBonus?: number;
}

export interface CombatantSnapshot {
  actorId: string;
  name: string;
  perception: number;
  finesse: number;
  might: number;
  resolve: number;
  lore: number;
  combat: ActorCombatComponent;
  derived: DerivedCombatStats;
}

export interface AttackPreviewReport {
  mode: CombatAttackMode;
  apCost: number;
  hasEnoughAp: boolean;
  inRange: boolean;
  distanceTiles: number;
  maxRange: number;
  hitChancePct: number;
  critChancePct: number;
  estimatedMinDamage: number;
  estimatedMaxDamage: number;
  effectiveArmorPenPct: number;
  targetDtAfterPen: number;
  targetDrAfterPenPct: number;
}

export interface CombatAttackOutcome {
  attackerId: string;
  defenderId: string;
  mode: CombatAttackMode;
  apSpent: number;
  hit: boolean;
  hitChancePct: number;
  rollPct: number;
  critical: boolean;
  rawDamage: number;
  mitigatedByArmor: number;
  damageDealt: number;
  appliedStatus: CombatStatusEffect | null;
  targetDefeated: boolean;
}

export interface FloatingCombatText {
  id: string;
  x: number;
  y: number;
  z: number;
  text: string;
  colorHex: number;
  elapsed: number;
  duration: number;
}

export interface TurnBasedCombatSession {
  active: boolean;
  round: number;
  participantIds: string[];
  activeTurnActorId: string | null;
  selectedAttackMode: CombatAttackMode;
  selectedTargetId: string | null;
  floatingTexts: FloatingCombatText[];
}

export function createDefaultProficiencies(
  overrides?: Partial<WeaponProficiencySet>
): WeaponProficiencySet {
  return {
    blades: 78,
    axes_blunt: 72,
    runic_staffs: 74,
    unarmed_shield: 65,
    ...overrides
  };
}

export function getWeaponCombatProfile(
  mainHandId: string | null,
  offHandId: string | null
): WeaponCombatProfile {
  const mainDef = mainHandId ? EQUIPMENT_CATALOG[mainHandId] : undefined;
  const offDef = offHandId ? EQUIPMENT_CATALOG[offHandId] : undefined;
  const hasShield = offDef?.visualStyle === 'kiteshield';

  if (!mainDef) {
    return {
      category: 'unarmed_shield',
      label: hasShield ? 'Uderzenie Tarczą i Pięścią' : 'Walka Wręcz',
      shortLabel: 'Wręcz',
      icon: '🥊',
      minRange: 1,
      maxRange: 1,
      baseApCost: 3,
      armorPenetrationRatio: 0.05,
      accuracyBonus: 8,
      critBonus: 3
    };
  }

  if (mainDef.visualStyle === 'battleaxe') {
    return {
      category: 'axes_blunt',
      label: mainDef.name,
      shortLabel: 'Topór 2H',
      icon: '🪓',
      minRange: 1,
      maxRange: 1,
      baseApCost: 5,
      armorPenetrationRatio: 0.55,
      accuracyBonus: 2,
      critBonus: 10
    };
  }

  if (mainDef.visualStyle === 'runestaff') {
    return {
      category: 'runic_staffs',
      label: mainDef.name,
      shortLabel: 'Kostur Runiczny',
      icon: '✨',
      minRange: 1,
      maxRange: 5,
      baseApCost: 4,
      armorPenetrationRatio: 0.65,
      accuracyBonus: 10,
      critBonus: 8
    };
  }

  return {
    category: 'blades',
    label: mainDef.name,
    shortLabel: 'Ostrze 1H',
    icon: '🗡️',
    minRange: 1,
    maxRange: 1,
    baseApCost: 4,
    armorPenetrationRatio: 0.15,
    accuracyBonus: 12,
    critBonus: 5
  };
}

export function computeDerivedCombatStats(
  statSheet: CharacterStatSheet,
  proficiencies: WeaponProficiencySet,
  mainHandId: string | null,
  offHandId: string | null,
  defending = false,
  dazed = false,
  customArmorBonus = 0,
  customDamageBonus = 0
): DerivedCombatStats {
  const weaponProfile = getWeaponCombatProfile(mainHandId, offHandId);
  const offDef = offHandId ? EQUIPMENT_CATALOG[offHandId] : undefined;
  const hasShield = offDef?.visualStyle === 'kiteshield';

  const maxHp = Math.round(statSheet.getStatValue(StatType.HealthMax));
  const str = statSheet.getStatValue(StatType.Strength);
  const agi = statSheet.getStatValue(StatType.Agility);
  const res = statSheet.getStatValue(StatType.Resolve);
  const lore = statSheet.getStatValue(StatType.Intelligence);
  const per = statSheet.getStatValue(StatType.Perception);

  const armor = statSheet.getStatValue(StatType.ArmorRating) + customArmorBonus;
  const basePhysDmg = statSheet.getStatValue(StatType.PhysicalDamage) + customDamageBonus;

  // Fallout SPECIAL Action Points: 5 + floor(Agility / 2)
  const maxAp = Math.max(4, 5 + Math.floor(agi / 2) - (dazed ? 3 : 0));
  const sequence = Math.round(2 * per + agi);

  const evasionPct = Math.min(
    65,
    Math.round(agi * 1.8 + (hasShield ? 8 : 0) + (defending ? 20 : 0))
  );

  // Fallout DT (Damage Threshold) + DR% (Damage Resistance)
  const damageThreshold = Math.max(0, Math.floor(armor / 5.5) + (defending ? 2 : 0));
  const damageResistancePct = Math.min(
    75,
    Math.max(0, Math.round(armor * 1.25 + res * 0.6 + (defending ? 15 : 0)))
  );

  // Staffs channel Arcane Lore into damage in addition to base weapon power
  const staffLoreBonus =
    weaponProfile.category === 'runic_staffs' ? Math.max(0, (lore - 8) * 1.6) : 0;
  const twoHandedStrBonus =
    weaponProfile.category === 'axes_blunt' ? Math.max(0, (str - 10) * 1.4) : 0;

  const avgDamage = Math.max(4, basePhysDmg + staffLoreBonus + twoHandedStrBonus);
  const minDamage = Math.max(2, Math.round(avgDamage * 0.82));
  const maxDamage = Math.max(minDamage + 2, Math.round(avgDamage * 1.22));

  const critChancePct = Math.min(
    95,
    Math.round(statSheet.getStatValue(StatType.CriticalStrikeChance) + weaponProfile.critBonus)
  );

  const activeProficiency = proficiencies[weaponProfile.category] ?? 65;

  return {
    maxHp,
    maxAp,
    sequence,
    evasionPct,
    damageThreshold,
    damageResistancePct,
    minDamage,
    maxDamage,
    critChancePct,
    activeProficiency,
    weaponProfile
  };
}

export function computeAttackPreview(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  distanceTiles: number,
  mode: CombatAttackMode
): AttackPreviewReport {
  const modeMeta = ATTACK_MODE_META[mode];
  const wp = attacker.derived.weaponProfile;
  const apCost = Math.max(2, wp.baseApCost + modeMeta.apDelta);
  const hasEnoughAp = attacker.combat.ap >= apCost;
  const inRange = distanceTiles <= wp.maxRange + 0.45;

  const distPenalty = distanceTiles > 1.5 ? Math.round((distanceTiles - 1) * 4) : 0;
  const rawHit =
    attacker.derived.activeProficiency +
    (attacker.perception - 10) * 3.5 +
    wp.accuracyBonus +
    modeMeta.hitMod -
    defender.derived.evasionPct -
    distPenalty;

  const hitChancePct = Math.max(5, Math.min(95, Math.round(rawHit)));
  const critChancePct = Math.max(
    5,
    Math.min(95, Math.round(attacker.derived.critChancePct + modeMeta.critMod))
  );

  const effectivePenRatio = Math.min(0.9, wp.armorPenetrationRatio + modeMeta.armorPenBonus);
  const targetDtAfterPen = Math.max(
    0,
    Math.round(defender.derived.damageThreshold * (1 - effectivePenRatio))
  );
  const targetDrAfterPenPct = Math.max(
    0,
    Math.round(defender.derived.damageResistancePct * (1 - effectivePenRatio))
  );

  const applyMitigation = (raw: number): number => {
    const scaled = raw * modeMeta.damageMult;
    const afterDt = Math.max(1, scaled - targetDtAfterPen);
    const afterDr = afterDt * (1 - targetDrAfterPenPct / 100);
    return Math.max(1, Math.round(afterDr));
  };

  return {
    mode,
    apCost,
    hasEnoughAp,
    inRange,
    distanceTiles: Number(distanceTiles.toFixed(1)),
    maxRange: wp.maxRange,
    hitChancePct,
    critChancePct,
    estimatedMinDamage: applyMitigation(attacker.derived.minDamage),
    estimatedMaxDamage: applyMitigation(attacker.derived.maxDamage),
    effectiveArmorPenPct: Math.round(effectivePenRatio * 100),
    targetDtAfterPen,
    targetDrAfterPenPct
  };
}

export function resolveCombatAttack(
  attacker: CombatantSnapshot,
  defender: CombatantSnapshot,
  distanceTiles: number,
  mode: CombatAttackMode,
  rng: () => number = Math.random
): CombatAttackOutcome {
  const preview = computeAttackPreview(attacker, defender, distanceTiles, mode);
  const modeMeta = ATTACK_MODE_META[mode];

  attacker.combat.ap = Math.max(0, attacker.combat.ap - preview.apCost);
  attacker.combat.defending = false;

  const rollPct = Math.round(rng() * 100);
  const hit = rollPct <= preview.hitChancePct;

  if (!hit) {
    return {
      attackerId: attacker.actorId,
      defenderId: defender.actorId,
      mode,
      apSpent: preview.apCost,
      hit: false,
      hitChancePct: preview.hitChancePct,
      rollPct,
      critical: false,
      rawDamage: 0,
      mitigatedByArmor: 0,
      damageDealt: 0,
      appliedStatus: null,
      targetDefeated: false
    };
  }

  const critRoll = Math.round(rng() * 100);
  const critical = critRoll <= preview.critChancePct;

  const dmgSpan = Math.max(0, attacker.derived.maxDamage - attacker.derived.minDamage);
  const baseRoll = attacker.derived.minDamage + rng() * dmgSpan;
  const critMultiplier = critical ? (mode === 'aimed_head' ? 1.85 : 1.55) : 1.0;
  const rawDamage = Math.max(2, Math.round(baseRoll * modeMeta.damageMult * critMultiplier));

  // Critical hits bypass an additional 50% of remaining DT/DR (Fallout armor-piercing crit)
  const dt = critical ? Math.floor(preview.targetDtAfterPen * 0.5) : preview.targetDtAfterPen;
  const drPct = critical ? Math.floor(preview.targetDrAfterPenPct * 0.5) : preview.targetDrAfterPenPct;

  const afterDt = Math.max(1, rawDamage - dt);
  const damageDealt = Math.max(1, Math.round(afterDt * (1 - drPct / 100)));
  const mitigatedByArmor = Math.max(0, rawDamage - damageDealt);

  defender.combat.hp = Math.max(0, defender.combat.hp - damageDealt);

  let appliedStatus: CombatStatusEffect | null = null;
  if (modeMeta.statusOnHit) {
    const statusChance = critical ? 100 : 65;
    if (rng() * 100 <= statusChance) {
      appliedStatus = modeMeta.statusOnHit;
      if (appliedStatus === 'dazed_head') {
        defender.combat.dazedHeadTurns = Math.max(defender.combat.dazedHeadTurns, 1);
      } else if (appliedStatus === 'crippled_legs') {
        defender.combat.crippledLegsTurns = Math.max(defender.combat.crippledLegsTurns, 2);
      }
    }
  }

  const targetDefeated = defender.combat.hp <= 0;
  if (targetDefeated) {
    defender.combat.isAlive = false;
  }

  return {
    attackerId: attacker.actorId,
    defenderId: defender.actorId,
    mode,
    apSpent: preview.apCost,
    hit: true,
    hitChancePct: preview.hitChancePct,
    rollPct,
    critical,
    rawDamage,
    mitigatedByArmor,
    damageDealt,
    appliedStatus,
    targetDefeated
  };
}
