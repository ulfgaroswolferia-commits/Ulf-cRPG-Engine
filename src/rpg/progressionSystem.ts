import { CharacterAttributes } from './characterData';
import { CharacterStatSheet, ModifierType, StatType } from './inventorySystem';

export type SkillBranchId = 'witez' | 'zwiadowca' | 'zerca';

export interface SkillStatModifierSpec {
  targetStat: StatType;
  type: ModifierType;
  valuePerRank: number;
}

export interface ActiveSkillMeta {
  apCost: number;
  manaCost: number;
  cooldownTurns: number;
  targetType: 'enemy' | 'self';
  minRange: number;
  maxRange?: number; // undefined = weapon range (+ rangeBonus)
  rangeBonus?: number;
  damageMult?: number;
  hitBonus?: number;
  critBonus?: number;
  armorPenBonus?: number;
  isRunicBurst?: boolean;
}

export interface SkillAttributeRequirement {
  stat: keyof CharacterAttributes;
  minValue: number;
}

export interface SkillNodeDef {
  id: string;
  branch: SkillBranchId;
  tier: 1 | 2 | 3 | 4;
  slot: 'center' | 'left' | 'right';
  name: string;
  icon: string;
  maxRank: 1 | 2;
  kind: 'passive' | 'active';
  prerequisites: string[];
  requiredAttribute?: SkillAttributeRequirement;
  requiredAnyAttribute?: SkillAttributeRequirement[];
  summary: string;
  description: string;
  modifiersPerRank?: SkillStatModifierSpec[];
  activeAbility?: ActiveSkillMeta;
}

export interface CharacterProgressionState {
  level: number;
  xp: number;
  attributePoints: number;
  skillPoints: number;
  spentAttributePoints: CharacterAttributes;
  unlockedSkills: Record<string, number>;
  claimedDialogueXpIds: string[];
  activeCooldowns: Record<string, number>;
  firstStrikeReady: boolean;
  furyApRefundedThisTurn: boolean;
}

export interface XpGrantResult {
  xpAdded: number;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
}

export interface SkillUnlockCheck {
  ok: boolean;
  reason?: string;
}

export const MAX_CHARACTER_LEVEL = 20;
export const ATTRIBUTE_POINTS_PER_LEVEL = 2;
export const SKILL_POINTS_PER_LEVEL = 1;
export const RESPEC_COST_SIEKANCE = 25;

export const ATTRIBUTE_LABELS: Record<
  keyof CharacterAttributes,
  { short: string; name: string; effectHint: string }
> = {
  might: {
    short: 'SIŁ',
    name: 'Siła',
    effectHint: '+2 Max HP, +0.5 Obr. fiz. (co 2 pkt), +2.5 kg udźwigu, bonus do toporów'
  },
  finesse: {
    short: 'FIN',
    name: 'Finezyjność',
    effectHint: '+1 Max AP (co 2 pkt), +1.8% uniku, +1.2% kryta, +1 inicjatywy'
  },
  resolve: {
    short: 'DET',
    name: 'Determinacja',
    effectHint: '+4 Max HP, +0.6% odporności (DR%), wzmacnia Tchnienie Mokoszy'
  },
  lore: {
    short: 'WIE',
    name: 'Wiedza',
    effectHint: '+5 Max Many, +1.6 obr. kosturów runicznych, wzmacnia znaki runiczne'
  },
  perception: {
    short: 'PER',
    name: 'Percepcja',
    effectHint: '+3.5% celności, +0.8% kryta, +2 inicjatywy'
  }
};

export const SKILL_BRANCH_META: Record<
  SkillBranchId,
  { id: SkillBranchId; name: string; subtitle: string; icon: string; accent: string }
> = {
  witez: {
    id: 'witez',
    name: 'Witeź',
    subtitle: 'Siła, stal i mur tarczowy',
    icon: '⚔️',
    accent: '#e08d58'
  },
  zwiadowca: {
    id: 'zwiadowca',
    name: 'Zwiadowca',
    subtitle: 'Zwinność, łuk i śmiertelny kryt',
    icon: '🏹',
    accent: '#6fd18e'
  },
  zerca: {
    id: 'zerca',
    name: 'Żerca Runiczny',
    subtitle: 'Mana, runy i łaska Mokoszy',
    icon: 'ᛉ',
    accent: '#6dc8ff'
  }
};

export const SKILL_TREE_DEFS: SkillNodeDef[] = [
  // === ŚCIEŻKA I: WITEŹ ===
  {
    id: 'witez_hart',
    branch: 'witez',
    tier: 1,
    slot: 'center',
    name: 'Hart Ciała',
    icon: '🛡️',
    maxRank: 2,
    kind: 'passive',
    prerequisites: [],
    summary: '+15/+30 Max HP, +2/+4 Pancerz',
    description: 'Zahartowane w boju ciało lepiej znosi ciosy. Każda ranga zwiększa Maks. HP o 15 i Pancerz o 2.',
    modifiersPerRank: [
      { targetStat: StatType.HealthMax, type: ModifierType.Flat, valuePerRank: 15 },
      { targetStat: StatType.ArmorRating, type: ModifierType.Flat, valuePerRank: 2 }
    ]
  },
  {
    id: 'witez_chwyt',
    branch: 'witez',
    tier: 2,
    slot: 'left',
    name: 'Żelazny Chwyt',
    icon: '🪓',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['witez_hart'],
    summary: '+2/+4 Obr. Fizyczne, +6/+12% celności w zwarciu',
    description: 'Pewne prowadzenie ostrza i topora. Zwiększa Obrażenia Fizyczne o +2 i celność w zwarciu o +6% na rangę.',
    modifiersPerRank: [
      { targetStat: StatType.PhysicalDamage, type: ModifierType.Flat, valuePerRank: 2 }
    ]
  },
  {
    id: 'witez_mur',
    branch: 'witez',
    tier: 2,
    slot: 'right',
    name: 'Mur Tarczowy',
    icon: '🔰',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['witez_hart'],
    summary: '+5/+10% DR% i +1/+2 DT (z tarczą lub w obronie)',
    description: 'Mistrzowska garda tarczą. Gdy dzierżysz tarczę lub przyjmujesz postawę obronną, zyskujesz +5% DR% i +1 DT na rangę.',
    modifiersPerRank: []
  },
  {
    id: 'witez_rozplatanie',
    branch: 'witez',
    tier: 3,
    slot: 'center',
    name: 'Rozpłatanie',
    icon: '💥',
    maxRank: 1,
    kind: 'active',
    prerequisites: ['witez_chwyt', 'witez_mur'],
    summary: 'Aktywna (4 AP, odn. 2 t.): 135% obr., +10% kryta, +20% pen. pancerza',
    description: 'Potężne cięcie rozrywające zbroję. Zadaje 135% obrażeń broni z +10% szansy na kryta i +20% penetracją pancerza; kryt oszałamia cel.',
    activeAbility: {
      apCost: 4,
      manaCost: 0,
      cooldownTurns: 2,
      targetType: 'enemy',
      minRange: 1,
      damageMult: 1.35,
      hitBonus: 0,
      critBonus: 10,
      armorPenBonus: 0.2
    }
  },
  {
    id: 'witez_furia',
    branch: 'witez',
    tier: 4,
    slot: 'center',
    name: 'Furia Peruna',
    icon: '⚡',
    maxRank: 1,
    kind: 'passive',
    prerequisites: ['witez_rozplatanie'],
    requiredAttribute: { stat: 'might', minValue: 17 },
    summary: '+10% Kryt; kryt w zwarciu zwraca +2 AP (raz/turę)',
    description: 'Gniew gromowładnego napędza ramię. +10% szansy na kryta oraz zwrot +2 AP przy pierwszym krycie w zwarciu na turę.',
    modifiersPerRank: [
      { targetStat: StatType.CriticalStrikeChance, type: ModifierType.Flat, valuePerRank: 10 }
    ]
  },

  // === ŚCIEŻKA II: ZWIADOWCA ===
  {
    id: 'zwiadowca_krok',
    branch: 'zwiadowca',
    tier: 1,
    slot: 'center',
    name: 'Koci Krok',
    icon: '🐾',
    maxRank: 2,
    kind: 'passive',
    prerequisites: [],
    summary: '+5/+10% Unik, +4/+8 Inicjatywa',
    description: 'Zwinne uniki i szybka reakcja na zagrożenie. +5% Uniku i +4 Inicjatywy na rangę.',
    modifiersPerRank: []
  },
  {
    id: 'zwiadowca_reka',
    branch: 'zwiadowca',
    tier: 2,
    slot: 'left',
    name: 'Pewna Ręka',
    icon: '🎯',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['zwiadowca_krok'],
    summary: '+5/+10% Kryt, +10/+20% obr. krytycznych',
    description: 'Ciosy wymierzone w słabe punkty pancerza. +5% Szansy na Kryta i +10% premii obrażeń krytycznych na rangę.',
    modifiersPerRank: [
      { targetStat: StatType.CriticalStrikeChance, type: ModifierType.Flat, valuePerRank: 5 }
    ]
  },
  {
    id: 'zwiadowca_oko',
    branch: 'zwiadowca',
    tier: 2,
    slot: 'right',
    name: 'Bystre Oko',
    icon: '👁️',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['zwiadowca_krok'],
    summary: '+8/+16% Celność, połowa kary za dystans',
    description: 'Wzrok wyostrzony w borach. Zwiększa celność o +8% na rangę i zmniejsza o połowę karę za odległość.',
    modifiersPerRank: []
  },
  {
    id: 'zwiadowca_sokole',
    branch: 'zwiadowca',
    tier: 3,
    slot: 'center',
    name: 'Sokole Oko',
    icon: '🦅',
    maxRank: 1,
    kind: 'active',
    prerequisites: ['zwiadowca_reka', 'zwiadowca_oko'],
    summary: 'Aktywna (4 AP, odn. 2 t.): 115% obr., +25% celności, +30% kryta, +10% pen., +1 zas. (broń dystansowa)',
    description: 'Skupiony strzał lub pchnięcie o śmiertelnej precyzji (+15% obrażeń, +25% celności, +30% kryta, +10% penetracji pancerza oraz +1 pola zasięgu dla broni dystansowych).',
    activeAbility: {
      apCost: 4,
      manaCost: 0,
      cooldownTurns: 2,
      targetType: 'enemy',
      minRange: 1,
      rangeBonus: 1,
      damageMult: 1.15,
      hitBonus: 25,
      critBonus: 30,
      armorPenBonus: 0.1
    }
  },
  {
    id: 'zwiadowca_cien',
    branch: 'zwiadowca',
    tier: 4,
    slot: 'center',
    name: 'Cień Boru',
    icon: '🌑',
    maxRank: 1,
    kind: 'passive',
    prerequisites: ['zwiadowca_sokole'],
    requiredAnyAttribute: [
      { stat: 'finesse', minValue: 16 },
      { stat: 'perception', minValue: 17 }
    ],
    summary: '+1 Max AP na stałe; pierwszy atak w walce +35% kryta',
    description: 'Nieuchwytny drapieżca. Zyskujesz +1 Maks. AP na stałe oraz +35% szansy na kryta przy pierwszym ataku w każdej walce.',
    modifiersPerRank: []
  },

  // === ŚCIEŻKA III: ŻERCA RUNICZNY ===
  {
    id: 'zerca_zapas',
    branch: 'zerca',
    tier: 1,
    slot: 'center',
    name: 'Zapas Mocy',
    icon: '💧',
    maxRank: 2,
    kind: 'passive',
    prerequisites: [],
    summary: '+15/+30 Max Mana, +4/+8 regen. Many/turę',
    description: 'Głębsza więź z nurtem mocy. Zwiększa Maks. Manę o 15 i regenerację Many na początku tury o +4 na rangę.',
    modifiersPerRank: [
      { targetStat: StatType.ManaMax, type: ModifierType.Flat, valuePerRank: 15 }
    ]
  },
  {
    id: 'zerca_wzmocnienie',
    branch: 'zerca',
    tier: 2,
    slot: 'left',
    name: 'Runiczne Wzmocnienie',
    icon: '🪄',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['zerca_zapas'],
    summary: '+3/+6 obr. kosturów i run, +1/+2 efektywnej WIE do kostura',
    description: 'Wyryte znaki potęgują zaklęcia. Kostury i zdolności runiczne zadają +3 obr. na rangę oraz liczą +1 WIE więcej.',
    modifiersPerRank: []
  },
  {
    id: 'zerca_wola',
    branch: 'zerca',
    tier: 2,
    slot: 'right',
    name: 'Wola Przodków',
    icon: '🕯️',
    maxRank: 2,
    kind: 'passive',
    prerequisites: ['zerca_zapas'],
    summary: '+4/+8% DR%, skraca okaleczenie o 1/2 t., 50%/100% odporności na ogłuszenie',
    description: 'Duchowa tarcza przodków chroni ciało i umysł. +4% DR% na rangę, skraca czas okaleczenia nóg o 1/2 tury oraz daje 50%/100% szansy na odparcie ogłuszenia.',
    modifiersPerRank: []
  },
  {
    id: 'zerca_grom',
    branch: 'zerca',
    tier: 3,
    slot: 'center',
    name: 'Gromowładny Znak',
    icon: '🌩️',
    maxRank: 1,
    kind: 'active',
    prerequisites: ['zerca_wzmocnienie'],
    summary: 'Aktywna (3 AP, 18 Many, odn. 2 t., zas. 1–5): runa omija 50% pancerza + ogłuszenie',
    description: 'Wyładowanie runiczne (celność z WIE) zadające 14 + 1.8×WIE obrażeń, omijające dokładnie 50% pancerza i nakładające Oszołomienie na 1 turę.',
    activeAbility: {
      apCost: 3,
      manaCost: 18,
      cooldownTurns: 2,
      targetType: 'enemy',
      minRange: 1,
      maxRange: 5,
      armorPenBonus: 0.5,
      isRunicBurst: true
    }
  },
  {
    id: 'zerca_mokosz',
    branch: 'zerca',
    tier: 4,
    slot: 'center',
    name: 'Tchnienie Mokoszy',
    icon: '🌿',
    maxRank: 1,
    kind: 'active',
    prerequisites: ['zerca_grom', 'zerca_wola'],
    summary: 'Aktywna (2 AP, 20 Many, odn. 3 t.): leczy 25 + 2×DET HP i usuwa statusy',
    description: 'Błogosławieństwo Matki Ziemi. Przywraca 25 + 2.0×DET HP i natychmiast oczyszcza z oszołomienia oraz okaleczenia.',
    activeAbility: {
      apCost: 2,
      manaCost: 20,
      cooldownTurns: 3,
      targetType: 'self',
      minRange: 0,
      maxRange: 0
    }
  }
];

export const SKILL_TREE_BY_ID: Record<string, SkillNodeDef> = Object.fromEntries(
  SKILL_TREE_DEFS.map((node) => [node.id, node])
);

export function xpForNextLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.round(25 * safeLevel + 10 * safeLevel * (safeLevel - 1));
}

export function createInitialProgressionState(): CharacterProgressionState {
  return {
    level: 1,
    xp: 0,
    attributePoints: 0,
    skillPoints: 0,
    spentAttributePoints: {
      might: 0,
      finesse: 0,
      resolve: 0,
      lore: 0,
      perception: 0
    },
    unlockedSkills: {},
    claimedDialogueXpIds: [],
    activeCooldowns: {},
    firstStrikeReady: true,
    furyApRefundedThisTurn: false
  };
}

export function getSkillRank(state: CharacterProgressionState, skillId: string): number {
  return state.unlockedSkills[skillId] ?? 0;
}

export function grantXpToProgression(
  state: CharacterProgressionState,
  amount: number
): XpGrantResult {
  const cleanAmount = Math.max(0, Math.floor(amount));
  if (cleanAmount <= 0 || state.level >= MAX_CHARACTER_LEVEL) {
    return {
      xpAdded: 0,
      leveledUp: false,
      levelsGained: 0,
      newLevel: state.level
    };
  }

  state.xp += cleanAmount;
  let levelsGained = 0;

  while (state.level < MAX_CHARACTER_LEVEL) {
    const threshold = xpForNextLevel(state.level);
    if (state.xp < threshold) break;
    state.xp -= threshold;
    state.level += 1;
    state.attributePoints += ATTRIBUTE_POINTS_PER_LEVEL;
    state.skillPoints += SKILL_POINTS_PER_LEVEL;
    levelsGained += 1;
  }

  if (state.level >= MAX_CHARACTER_LEVEL) {
    state.xp = 0;
  }

  return {
    xpAdded: cleanAmount,
    leveledUp: levelsGained > 0,
    levelsGained,
    newLevel: state.level
  };
}

export function canAllocateAttribute(state: CharacterProgressionState): boolean {
  return state.attributePoints > 0;
}

export function allocateAttributePoint(
  state: CharacterProgressionState,
  statSheet: CharacterStatSheet,
  stat: keyof CharacterAttributes
): boolean {
  if (!canAllocateAttribute(state)) return false;

  const base = statSheet.getBaseAttributes();
  base[stat] += 1;
  statSheet.setBaseAttributes(base);

  state.spentAttributePoints[stat] = (state.spentAttributePoints[stat] ?? 0) + 1;
  state.attributePoints -= 1;
  return true;
}

export function canUnlockSkill(
  state: CharacterProgressionState,
  effectiveAttributes: CharacterAttributes,
  skillId: string
): SkillUnlockCheck {
  const def = SKILL_TREE_BY_ID[skillId];
  if (!def) {
    return { ok: false, reason: 'Nieznana umiejętność.' };
  }

  const currentRank = getSkillRank(state, skillId);
  if (currentRank >= def.maxRank) {
    return { ok: false, reason: 'Osiągnięto maksymalną rangę.' };
  }

  if (state.skillPoints <= 0) {
    return { ok: false, reason: 'Brak punktów umiejętności.' };
  }

  // Prerequisites: at least ONE prerequisite in the list must have rank >= 1 (OR-branching at Tier 3/4)
  if (def.prerequisites.length > 0 && currentRank === 0) {
    const hasPrereq = def.prerequisites.some((preId) => getSkillRank(state, preId) > 0);
    if (!hasPrereq) {
      const names = def.prerequisites
        .map((id) => SKILL_TREE_BY_ID[id]?.name ?? id)
        .join(' lub ');
      return { ok: false, reason: `Wymaga: ${names}` };
    }
  }

  if (def.requiredAttribute) {
    const { stat, minValue } = def.requiredAttribute;
    if ((effectiveAttributes[stat] ?? 0) < minValue) {
      return {
        ok: false,
        reason: `Wymaga ${ATTRIBUTE_LABELS[stat].short} ≥ ${minValue}`
      };
    }
  }

  if (def.requiredAnyAttribute && def.requiredAnyAttribute.length > 0) {
    const anyMet = def.requiredAnyAttribute.some(
      (req) => (effectiveAttributes[req.stat] ?? 0) >= req.minValue
    );
    if (!anyMet) {
      const labels = def.requiredAnyAttribute
        .map((req) => `${ATTRIBUTE_LABELS[req.stat].short} ≥ ${req.minValue}`)
        .join(' lub ');
      return { ok: false, reason: `Wymaga: ${labels}` };
    }
  }

  return { ok: true };
}

export function syncSkillModifiersOnStatSheet(
  state: CharacterProgressionState,
  statSheet: CharacterStatSheet
): void {
  // Remove existing skill:* modifiers cleanly
  const existingSources = new Set(
    statSheet
      .getModifiers()
      .map((m) => m.sourceId)
      .filter((src) => src.startsWith('skill:'))
  );
  for (const src of existingSources) {
    statSheet.removeModifiersBySource(src);
  }

  // Re-add active passive modifiers per unlocked rank
  for (const [skillId, rank] of Object.entries(state.unlockedSkills)) {
    if (!rank || rank <= 0) continue;
    const def = SKILL_TREE_BY_ID[skillId];
    if (!def?.modifiersPerRank?.length) continue;

    def.modifiersPerRank.forEach((spec) => {
      statSheet.addModifier({
        sourceId: `skill:${skillId}`,
        targetStat: spec.targetStat,
        type: spec.type,
        value: spec.valuePerRank * rank
      });
    });
  }
}

export function unlockSkillNode(
  state: CharacterProgressionState,
  statSheet: CharacterStatSheet,
  skillId: string
): SkillUnlockCheck {
  const check = canUnlockSkill(state, statSheet.getEffectiveAttributes(), skillId);
  if (!check.ok) return check;

  state.unlockedSkills[skillId] = getSkillRank(state, skillId) + 1;
  state.skillPoints -= 1;
  syncSkillModifiersOnStatSheet(state, statSheet);
  return { ok: true };
}

export function respecProgressionState(
  state: CharacterProgressionState,
  statSheet: CharacterStatSheet,
  currentSiekance: number,
  inCombat: boolean
): { ok: boolean; cost: number; reason?: string } {
  if (inCombat) {
    return { ok: false, cost: 0, reason: 'Nie można resetować rozwoju podczas walki.' };
  }

  const totalSpentAttrs = Object.values(state.spentAttributePoints).reduce(
    (sum, val) => sum + (val || 0),
    0
  );
  const totalSpentSkills = Object.values(state.unlockedSkills).reduce(
    (sum, val) => sum + (val || 0),
    0
  );

  if (totalSpentAttrs === 0 && totalSpentSkills === 0) {
    return { ok: false, cost: 0, reason: 'Brak przydzielonych punktów do zresetowania.' };
  }

  if (currentSiekance < RESPEC_COST_SIEKANCE) {
    return {
      ok: false,
      cost: 0,
      reason: `Wymaga ${RESPEC_COST_SIEKANCE} siekańców.`
    };
  }

  // Refund attribute points while preserving starting values and consumable bonuses
  const base = statSheet.getBaseAttributes();
  let actualRefundedAttrs = 0;
  (Object.keys(state.spentAttributePoints) as Array<keyof CharacterAttributes>).forEach((stat) => {
    const spent = state.spentAttributePoints[stat] ?? 0;
    if (spent > 0) {
      const safeRefund = Math.min(spent, Math.max(0, base[stat] - 1));
      base[stat] -= safeRefund;
      actualRefundedAttrs += safeRefund;
      state.spentAttributePoints[stat] = 0;
    }
  });
  statSheet.setBaseAttributes(base);

  state.attributePoints += actualRefundedAttrs;
  state.skillPoints += totalSpentSkills;
  state.unlockedSkills = {};
  state.activeCooldowns = {};

  syncSkillModifiersOnStatSheet(state, statSheet);

  return { ok: true, cost: RESPEC_COST_SIEKANCE };
}
