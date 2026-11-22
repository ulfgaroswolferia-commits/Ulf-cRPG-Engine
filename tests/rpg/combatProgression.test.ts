import { describe, expect, it } from 'vitest';
import {
  computeAttackPreview,
  computeDerivedCombatStats,
  resolveCombatAttack,
  type ProgressionCombatBonuses
} from '../../src/rpg/combatSystem';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { StatType } from '../../src/rpg/inventorySystem';
import { DIALOGUE_TREES } from '../../src/rpg/dialogueSystem';

describe('combatProgression integration', () => {
  it('syncs player mana/maxMana and applies passive skill combat bonuses', () => {
    const game = new CrpgGameState('forest_clearing');
    const expectedMana = Math.round(game.statSheet.getStatValue(StatType.ManaMax));
    expect(game.player.combat?.maxMana).toBe(expectedMana);
    expect(game.player.combat?.mana).toBe(expectedMana);

    // Grant 1 level (+1 skill point) and unlock zwiadowca_krok (+5% evasion, +4 sequence)
    game.grantPlayerXp(25);
    const before = game.getActorCombatant(game.player).derived;
    expect(game.unlockPlayerSkill('zwiadowca_krok').ok).toBe(true);
    const after = game.getActorCombatant(game.player).derived;

    expect(after.evasionPct).toBe(before.evasionPct + 5);
    expect(after.sequence).toBe(before.sequence + 4);
  });

  it('applies Mur Tarczowy when defending and Cień Boru +1 Max AP', () => {
    const game = new CrpgGameState('forest_clearing');
    const baseDerived = game.getActorCombatant(game.player).derived;

    const bonuses: ProgressionCombatBonuses = {
      shieldWallRank: 2,
      shadowOfForestRank: 1
    };

    const boosted = computeDerivedCombatStats(
      game.statSheet,
      game.player.combat!.proficiencies,
      game.player.recipe.equipment.mainHand,
      game.player.recipe.equipment.offHand,
      true, // defending
      false,
      0,
      0,
      bonuses
    );

    const plainDefend = computeDerivedCombatStats(
      game.statSheet,
      game.player.combat!.proficiencies,
      game.player.recipe.equipment.mainHand,
      game.player.recipe.equipment.offHand,
      true,
      false,
      0,
      0
    );

    expect(boosted.maxAp).toBe(baseDerived.maxAp + 1);
    expect(boosted.damageThreshold).toBe(plainDefend.damageThreshold + 2);
    expect(boosted.damageResistancePct).toBe(Math.min(75, plainDefend.damageResistancePct + 10));
  });

  it('reduces distance penalty with Bystre Oko and boosts crit damage with Pewna Ręka', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    const pSnap = game.getActorCombatant(game.player);
    const eSnap = game.getActorCombatant(enemy);

    const previewPlain = computeAttackPreview(pSnap, eSnap, 5, 'quick');
    const previewEagle = computeAttackPreview(pSnap, eSnap, 5, 'quick', {
      keenEyeRank: 2
    });

    // At 5 tiles: distPenalty = 16; with keenEyeRank 2: +16 hit and half distPenalty (8) => +24 hit (capped at 95)
    expect(previewEagle.hitChancePct).toBeGreaterThanOrEqual(previewPlain.hitChancePct);

    // Pewna Ręka crit multiplier check
    const plainAttacker = { ...pSnap, combat: { ...pSnap.combat, ap: 20 } };
    const steadyAttacker = { ...pSnap, combat: { ...pSnap.combat, ap: 20 } };
    const def1 = { ...eSnap, combat: { ...eSnap.combat, hp: 500, maxHp: 500 } };
    const def2 = { ...eSnap, combat: { ...eSnap.combat, hp: 500, maxHp: 500 } };

    // rng 0.01 -> guaranteed hit and crit
    const outPlain = resolveCombatAttack(plainAttacker, def1, 1, 'quick', () => 0.01);
    const outSteady = resolveCombatAttack(steadyAttacker, def2, 1, 'quick', () => 0.01, {
      steadyHandRank: 2
    });
    expect(outPlain.critical).toBe(true);
    expect(outSteady.critical).toBe(true);
    expect(outSteady.rawDamage).toBeGreaterThan(outPlain.rawDamage);
  });

  it('awards both weapon proficiency and character XP on enemy defeat', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    enemy.combat!.hp = 1;
    enemy.combat!.xpReward = 25; // exact threshold for level 2

    game.player.tileX = enemy.tileX + 1;
    game.player.tileY = enemy.tileY;

    const outcome = game.performPlayerCombatAttack(enemy.id, 'quick', () => 0.01);
    expect(outcome?.targetDefeated).toBe(true);
    expect(game.progression.level).toBe(2);
    expect(game.progression.attributePoints).toBe(2);
    expect(game.progression.skillPoints).toBe(1);
  });

  it('grants dialogue XP once per choice', () => {
    const game = new CrpgGameState('slavic_village');
    const gniewko = game.npcs.find((n) => n.dialogueId === 'npc_gniewko');
    expect(gniewko).toBeDefined();

    const tree = DIALOGUE_TREES['npc_gniewko'];
    const xpChoice = Object.values(tree)
      .flatMap((n) => n.choices)
      .find((c) => (c.xpReward ?? 0) > 0);
    expect(xpChoice).toBeDefined();

    game.activeDialogue = { actorId: gniewko!.id, node: tree.root };
    game.selectDialogueChoice(xpChoice!);
    const xpAfterFirst = game.progression.xp + (game.progression.level - 1) * 25;
    expect(xpAfterFirst).toBeGreaterThan(0);

    // Re-triggering the same choice does not grant XP again
    game.activeDialogue = { actorId: gniewko!.id, node: tree.root };
    game.selectDialogueChoice(xpChoice!);
    const xpAfterSecond = game.progression.xp + (game.progression.level - 1) * 25;
    expect(xpAfterSecond).toBe(xpAfterFirst);
  });

  it('executes active combat skills (Rozpłatanie, Gromowładny Znak, Tchnienie Mokoszy) with AP, Mana, cooldowns, and Furia Peruna', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    enemy.combat!.hp = 500;
    enemy.combat!.maxHp = 500;
    game.player.tileX = enemy.tileX + 1;
    game.player.tileY = enemy.tileY;

    // Unlock full Witez + Zerca skills via XP
    game.grantPlayerXp(3000);
    game.allocatePlayerAttribute('might');
    game.allocatePlayerAttribute('might'); // 17 SIŁ for Furia Peruna
    game.unlockPlayerSkill('witez_hart');
    game.unlockPlayerSkill('witez_chwyt');
    game.unlockPlayerSkill('witez_rozplatanie');
    game.unlockPlayerSkill('witez_furia');

    game.unlockPlayerSkill('zerca_zapas');
    game.unlockPlayerSkill('zerca_wzmocnienie');
    game.unlockPlayerSkill('zerca_grom');
    game.unlockPlayerSkill('zerca_mokosz');

    game.startCombatWithEnemy(enemy.id);
    const startAp = game.player.combat!.ap;

    // 1. Rozpłatanie (4 AP, cd 2) + Furia Peruna crit (+2 AP refund)
    const cleaveRes = game.performPlayerCombatSkill('witez_rozplatanie', enemy.id, () => 0.01);
    expect(cleaveRes.ok).toBe(true);
    expect(game.progression.activeCooldowns['witez_rozplatanie']).toBe(2);
    expect(game.player.combat!.ap).toBe(startAp - 4 + 2);

    // Cooldown prevents immediate reuse
    const cleaveBlocked = game.performPlayerCombatSkill('witez_rozplatanie', enemy.id, () => 0.01);
    expect(cleaveBlocked.ok).toBe(false);

    // 2. Gromowładny Znak (3 AP, 18 Mana, cd 2)
    const manaBefore = game.player.combat!.mana!;
    const runicRes = game.performPlayerCombatSkill('zerca_grom', enemy.id, () => 0.01);
    expect(runicRes.ok).toBe(true);
    expect(game.player.combat!.mana).toBe(manaBefore - 18);
    expect(enemy.combat!.dazedHeadTurns).toBeGreaterThanOrEqual(1);

    // 3. Tchnienie Mokoszy (2 AP, 20 Mana, cd 3, self heal + cleanse)
    game.player.combat!.hp = 40;
    game.player.combat!.dazedHeadTurns = 1;
    game.player.combat!.crippledLegsTurns = 2;
    const healRes = game.performPlayerCombatSkill('zerca_mokosz', undefined, () => 0.01);
    expect(healRes.ok).toBe(true);
    expect(game.player.combat!.hp).toBeGreaterThan(40);
    expect(game.player.combat!.dazedHeadTurns).toBe(0);
    expect(game.player.combat!.crippledLegsTurns).toBe(0);

    // Next player turn ticks cooldowns down and regenerates mana
    const manaAfterHeal = game.player.combat!.mana!;
    game.finishRoundAndStartPlayerTurn();
    expect(game.progression.activeCooldowns['witez_rozplatanie']).toBe(1);
    expect(game.player.combat!.mana).toBeGreaterThan(manaAfterHeal);
  });

  it('rejects dialogue choices when requiredAttribute is not met and syncs maxAp on respec', () => {
    const game = new CrpgGameState('slavic_village');
    const vaelen = game.npcs.find((n) => n.dialogueId === 'npc_vaelen');
    if (vaelen) {
      const tree = DIALOGUE_TREES['npc_vaelen'];
      const loreChoice = Object.values(tree)
        .flatMap((n) => n.choices)
        .find((c) => c.requiredAttribute?.stat === 'lore');
      if (loreChoice) {
        game.statSheet.setBaseAttributes({
          ...game.statSheet.getBaseAttributes(),
          lore: 8
        });
        game.activeDialogue = { actorId: vaelen.id, node: tree.root };
        game.selectDialogueChoice(loreChoice);
        expect(game.progression.xp).toBe(0);
      }
    }

    // Respec removes Cień Boru +1 Max AP immediately
    const baseMaxAp = game.player.combat!.maxAp;
    game.grantPlayerXp(500);
    game.allocatePlayerAttribute('finesse');
    game.allocatePlayerAttribute('finesse');
    game.allocatePlayerAttribute('finesse'); // 16 FIN
    game.unlockPlayerSkill('zwiadowca_krok');
    game.unlockPlayerSkill('zwiadowca_reka');
    game.unlockPlayerSkill('zwiadowca_sokole');
    game.unlockPlayerSkill('zwiadowca_cien');
    expect(game.player.combat!.maxAp).toBeGreaterThan(baseMaxAp);

    game.siekance = 100;
    const res = game.respecPlayerProgression();
    expect(res.ok).toBe(true);
    expect(game.player.combat!.maxAp).toBe(baseMaxAp);
    expect(game.player.combat!.ap).toBe(baseMaxAp);
  });
});
