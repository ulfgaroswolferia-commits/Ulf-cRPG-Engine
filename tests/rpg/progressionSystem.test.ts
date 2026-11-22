import { describe, expect, it } from 'vitest';
import {
  CharacterStatSheet,
  ModifierType,
  StatType
} from '../../src/rpg/inventorySystem';
import {
  MAX_CHARACTER_LEVEL,
  RESPEC_COST_SIEKANCE,
  SKILL_TREE_BY_ID,
  SKILL_TREE_DEFS,
  allocateAttributePoint,
  canUnlockSkill,
  createInitialProgressionState,
  getSkillRank,
  grantXpToProgression,
  respecProgressionState,
  syncSkillModifiersOnStatSheet,
  unlockSkillNode,
  xpForNextLevel
} from '../../src/rpg/progressionSystem';

describe('progressionSystem', () => {
  it('computes XP thresholds and handles single and multi-level ups', () => {
    expect(xpForNextLevel(1)).toBe(25);
    expect(xpForNextLevel(2)).toBe(70);
    expect(xpForNextLevel(3)).toBe(135);

    const state = createInitialProgressionState();
    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);

    // 25 + 70 = 95 XP -> reaches level 3 with 0 overflow XP
    const result = grantXpToProgression(state, 95);
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(2);
    expect(state.level).toBe(3);
    expect(state.xp).toBe(0);
    expect(state.attributePoints).toBe(4);
    expect(state.skillPoints).toBe(2);
  });

  it('caps character level at MAX_CHARACTER_LEVEL (20)', () => {
    const state = createInitialProgressionState();
    const res = grantXpToProgression(state, 1_000_000);
    expect(state.level).toBe(MAX_CHARACTER_LEVEL);
    expect(state.xp).toBe(0);
    expect(res.levelsGained).toBe(MAX_CHARACTER_LEVEL - 1);

    const extra = grantXpToProgression(state, 500);
    expect(extra.leveledUp).toBe(false);
    expect(state.level).toBe(MAX_CHARACTER_LEVEL);
  });

  it('allocates attribute points and tracks spentAttributePoints separately', () => {
    const sheet = new CharacterStatSheet({
      might: 15,
      finesse: 13,
      resolve: 14,
      lore: 14,
      perception: 15
    });
    const state = createInitialProgressionState();
    grantXpToProgression(state, 25); // +2 attributePoints

    expect(allocateAttributePoint(state, sheet, 'might')).toBe(true);
    expect(allocateAttributePoint(state, sheet, 'lore')).toBe(true);
    expect(allocateAttributePoint(state, sheet, 'finesse')).toBe(false); // 0 points left

    expect(state.attributePoints).toBe(0);
    expect(state.spentAttributePoints.might).toBe(1);
    expect(state.spentAttributePoints.lore).toBe(1);
    expect(sheet.getBaseAttributes().might).toBe(16);
    expect(sheet.getBaseAttributes().lore).toBe(15);
  });

  it('enforces skill prerequisites, rank caps, and attribute requirements', () => {
    expect(SKILL_TREE_DEFS.length).toBe(15);
    expect(Object.keys(SKILL_TREE_BY_ID).length).toBe(15);

    const sheet = new CharacterStatSheet({
      might: 15,
      finesse: 13,
      resolve: 14,
      lore: 14,
      perception: 15
    });
    const state = createInitialProgressionState();
    state.skillPoints = 6;

    // Cannot unlock Tier 2 before Tier 1
    expect(canUnlockSkill(state, sheet.getEffectiveAttributes(), 'witez_chwyt').ok).toBe(false);

    // Unlock Tier 1 (rank 1 of 2), then Tier 2, then Tier 3
    expect(unlockSkillNode(state, sheet, 'witez_hart').ok).toBe(true);
    expect(getSkillRank(state, 'witez_hart')).toBe(1);
    expect(unlockSkillNode(state, sheet, 'witez_chwyt').ok).toBe(true);
    expect(unlockSkillNode(state, sheet, 'witez_rozplatanie').ok).toBe(true);

    // Tier 4 witez_furia requires might >= 17 (currently 15)
    const blocked = canUnlockSkill(state, sheet.getEffectiveAttributes(), 'witez_furia');
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toContain('SIŁ');

    // Raise might to 17 -> now allowed
    sheet.setBaseAttributes({ ...sheet.getBaseAttributes(), might: 17 });
    expect(unlockSkillNode(state, sheet, 'witez_furia').ok).toBe(true);
    expect(getSkillRank(state, 'witez_furia')).toBe(1);
  });

  it('syncs passive skill modifiers onto CharacterStatSheet with skill: sourceId', () => {
    const sheet = new CharacterStatSheet({
      might: 15,
      finesse: 13,
      resolve: 14,
      lore: 14,
      perception: 15
    });
    const baseHp = sheet.getStatValue(StatType.HealthMax);
    const baseMana = sheet.getStatValue(StatType.ManaMax);

    const state = createInitialProgressionState();
    state.skillPoints = 4;
    unlockSkillNode(state, sheet, 'witez_hart'); // +15 HP, +2 Armor
    unlockSkillNode(state, sheet, 'witez_hart'); // rank 2: +30 HP, +4 Armor
    unlockSkillNode(state, sheet, 'zerca_zapas'); // +15 Mana

    expect(sheet.getStatValue(StatType.HealthMax)).toBe(baseHp + 30);
    expect(sheet.getStatValue(StatType.ArmorRating)).toBe(4);
    expect(sheet.getStatValue(StatType.ManaMax)).toBe(baseMana + 15);

    const skillMods = sheet.getModifiers().filter((m) => m.sourceId.startsWith('skill:'));
    expect(skillMods.length).toBeGreaterThan(0);

    // Re-sync is idempotent
    syncSkillModifiersOnStatSheet(state, sheet);
    expect(sheet.getStatValue(StatType.HealthMax)).toBe(baseHp + 30);
  });

  it('respecs spent attributes and skills while preserving consumable bonuses', () => {
    const sheet = new CharacterStatSheet({
      might: 15,
      finesse: 13,
      resolve: 14,
      lore: 14,
      perception: 15
    });
    const state = createInitialProgressionState();
    state.attributePoints = 2;
    state.skillPoints = 2;

    allocateAttributePoint(state, sheet, 'might'); // spent: 1 -> 16
    unlockSkillNode(state, sheet, 'witez_hart');
    unlockSkillNode(state, sheet, 'witez_hart');

    // Simulate permanent +2 might from an elixir (not tracked in spentAttributePoints)
    const attrs = sheet.getBaseAttributes();
    attrs.might += 2; // now 18
    sheet.setBaseAttributes(attrs);

    // Blocked if not enough siekance or in combat
    expect(respecProgressionState(state, sheet, RESPEC_COST_SIEKANCE - 1, false).ok).toBe(false);
    expect(respecProgressionState(state, sheet, 100, true).ok).toBe(false);

    const res = respecProgressionState(state, sheet, 100, false);
    expect(res.ok).toBe(true);
    expect(res.cost).toBe(RESPEC_COST_SIEKANCE);
    expect(state.attributePoints).toBe(2);
    expect(state.skillPoints).toBe(2);
    expect(state.spentAttributePoints.might).toBe(0);
    expect(Object.keys(state.unlockedSkills).length).toBe(0);
    // Elixir +2 might preserved! (15 + 2 = 17)
    expect(sheet.getBaseAttributes().might).toBe(17);
    expect(sheet.getModifiers().some((m) => m.sourceId.startsWith('skill:'))).toBe(false);

    // Non-skill modifiers (e.g. equipment) remain intact
    sheet.addModifier({
      sourceId: 'item_1',
      targetStat: StatType.ArmorRating,
      type: ModifierType.Flat,
      value: 5
    });
    syncSkillModifiersOnStatSheet(state, sheet);
    expect(sheet.getStatValue(StatType.ArmorRating)).toBe(5);
  });
});
