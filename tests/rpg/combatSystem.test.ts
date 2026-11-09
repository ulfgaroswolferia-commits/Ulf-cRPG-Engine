import { describe, expect, it } from 'vitest';
import {
  ATTACK_MODE_META,
  computeAttackPreview,
  computeDerivedCombatStats,
  createDefaultProficiencies,
  getWeaponCombatProfile,
  resolveCombatAttack
} from '../../src/rpg/combatSystem';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CharacterStatSheet } from '../../src/rpg/inventorySystem';
import { HudOverlay } from '../../src/ui/hudOverlay';

describe('Turn-Based Combat System (SPECIAL AP, DT/DR, Weapon Proficiencies, Aimed Shots & 3 Enemies)', () => {
  it('computes Fallout SPECIAL-style Action Points (AP), Sequence, Evasion, DT, and DR from attributes and gear', () => {
    const sheet = new CharacterStatSheet({
      might: 15,
      finesse: 14, // Max AP = 5 + floor(14 / 2) = 12 AP
      resolve: 14,
      lore: 14,
      perception: 15
    });
    const profs = createDefaultProficiencies();
    const derived = computeDerivedCombatStats(
      sheet,
      profs,
      'weapon_sunblade_longsword',
      'offhand_heraldic_shield',
      false,
      false
    );

    expect(derived.maxAp).toBe(12);
    expect(derived.sequence).toBe(2 * 15 + 14);
    expect(derived.activeProficiency).toBe(profs.blades);
    expect(derived.weaponProfile.category).toBe('blades');

    // Defensive stance increases Evasion, DT, and DR
    const defendingDerived = computeDerivedCombatStats(
      sheet,
      profs,
      'weapon_sunblade_longsword',
      'offhand_heraldic_shield',
      true,
      false
    );
    expect(defendingDerived.evasionPct).toBeGreaterThan(derived.evasionPct);
    expect(defendingDerived.damageThreshold).toBeGreaterThan(derived.damageThreshold);
    expect(defendingDerived.damageResistancePct).toBeGreaterThan(derived.damageResistancePct);
  });

  it('distinguishes weapon proficiencies and armor penetration between blades, 2H axes, and ranged runic staffs', () => {
    const sword = getWeaponCombatProfile('weapon_sunblade_longsword', 'offhand_torch');
    const axe2h = getWeaponCombatProfile('weapon_Executioner_axe', null);
    const staff = getWeaponCombatProfile('weapon_astral_staff', null);

    expect(sword.category).toBe('blades');
    expect(sword.maxRange).toBe(1);

    expect(axe2h.category).toBe('axes_blunt');
    expect(axe2h.armorPenetrationRatio).toBeGreaterThanOrEqual(0.5);

    expect(staff.category).toBe('runic_staffs');
    expect(staff.maxRange).toBeGreaterThanOrEqual(4);
  });

  it('calculates Hit Chance (5%..95%) and resolves Aimed Shots (Head/Legs/Torso) with DT/DR mitigation and status effects', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy');
    const hardEnemy = game.npcs.find((n) => n.id === 'enemy_dread_champion_hard');
    expect(easyEnemy).toBeDefined();
    expect(hardEnemy).toBeDefined();
    if (!easyEnemy || !hardEnemy) return;

    const playerCombat = game.getActorCombatant(game.player);
    const easyCombat = game.getActorCombatant(easyEnemy);
    const hardCombat = game.getActorCombatant(hardEnemy);

    // Quick attack vs Aimed Head shot preview
    const quickPreview = computeAttackPreview(playerCombat, easyCombat, 1, 'quick');
    const headPreview = computeAttackPreview(playerCombat, easyCombat, 1, 'aimed_head');

    expect(quickPreview.inRange).toBe(true);
    expect(quickPreview.hitChancePct).toBeGreaterThan(headPreview.hitChancePct);
    expect(headPreview.critChancePct).toBeGreaterThan(quickPreview.critChancePct);
    expect(headPreview.apCost).toBe(
      playerCombat.derived.weaponProfile.baseApCost + ATTACK_MODE_META.aimed_head.apDelta
    );

    // Hard enemy has much higher DT/DR so quick sword strike deals less than against easy enemy
    const quickVsHard = computeAttackPreview(playerCombat, hardCombat, 1, 'quick');
    expect(quickVsHard.estimatedMaxDamage).toBeLessThan(quickPreview.estimatedMaxDamage);

    // Deterministic hit + crit with aimed_legs cripples target's legs
    const legResult = resolveCombatAttack(playerCombat, easyCombat, 1, 'aimed_legs', () => 0.01);
    expect(legResult.hit).toBe(true);
    expect(legResult.critical).toBe(true);
    expect(legResult.damageDealt).toBeGreaterThan(0);
    expect(legResult.appliedStatus).toBe('crippled_legs');
  });

  it('spawns 3 distinct enemies on the test zone (Easy, Normal, Very Hard) and runs turn-based combat rounds with AP', () => {
    const game = new CrpgGameState('forest_clearing');

    const easy = game.npcs.find((n) => n.id === 'enemy_bandit_easy');
    const normal = game.npcs.find((n) => n.id === 'enemy_mercenary_normal');
    const hard = game.npcs.find((n) => n.id === 'enemy_dread_champion_hard');

    expect(easy).toBeDefined();
    expect(normal).toBeDefined();
    expect(hard).toBeDefined();

    expect(easy?.combat?.difficulty).toBe('easy');
    expect(normal?.combat?.difficulty).toBe('normal');
    expect(hard?.combat?.difficulty).toBe('very_hard');

    // Verify HP progression: Easy < Normal < Very Hard
    expect(easy!.combat!.maxHp).toBeLessThan(normal!.combat!.maxHp);
    expect(normal!.combat!.maxHp).toBeLessThan(hard!.combat!.maxHp);

    // Place player adjacent to the Easy enemy and initiate combat
    game.player.tileX = easy!.tileX - 1;
    game.player.tileY = easy!.tileY;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;

    const started = game.startCombatWithEnemy(easy!.id);
    expect(started).toBe(true);
    expect(game.combatState.active).toBe(true);

    const initialEnemyHp = easy!.combat!.hp;
    const initialPlayerAp = game.player.combat!.ap;
    expect(initialPlayerAp).toBeGreaterThanOrEqual(8);

    // Perform a player attack in turn-based combat (force deterministic hit)
    const atkRes = game.performPlayerCombatAttack(easy!.id, 'quick', () => 0.05);
    expect(atkRes).not.toBeNull();
    expect(easy!.combat!.hp).toBeLessThan(initialEnemyHp);
    expect(game.player.combat!.ap).toBeLessThan(initialPlayerAp);

    // End player turn -> enemy AI executes its turn and returns control to player for round 2
    game.endPlayerCombatTurn();
    expect(game.combatState.round).toBeGreaterThanOrEqual(2);
    expect(game.combatState.activeTurnActorId).toBe(game.player.id);

    // Verify intuitive beginner combat HUD + collapsible veteran anatomical targeting panel
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;
    const hud = new HudOverlay(fakeRoot, game, scene, { devMode: false });
    hud.render();

    expect(fakeRoot.innerHTML).toContain('data-quick-strike="quick"');
    expect(fakeRoot.innerHTML).toContain('data-quick-strike="power"');
    expect(fakeRoot.innerHTML).toContain('data-action="toggle-combat-advanced"');
    expect(fakeRoot.innerHTML).not.toContain('combat-veteran-panel');

    hud.toggleCombatAdvanced();
    expect(fakeRoot.innerHTML).toContain('combat-veteran-panel');
    expect(fakeRoot.innerHTML).toContain('aimed_head');
    expect(fakeRoot.innerHTML).toContain('aimed_legs');

    const apBeforeStrike = game.player.combat!.ap;
    hud.executeQuickStrike('power');
    expect(game.combatState.selectedAttackMode).toBe('power');
    expect(game.player.combat!.ap).toBeLessThan(apBeforeStrike);
  });

  it('triggers attack animation, recoil, damage flash, and allows corpse looting when an enemy is defeated', () => {
    const game = new CrpgGameState('forest_clearing');
    const easy = game.npcs.find((n) => n.id === 'enemy_bandit_easy');
    expect(easy).toBeDefined();
    if (!easy) return;

    game.player.tileX = easy.tileX - 1;
    game.player.tileY = easy.tileY;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;

    let combatEventFired = false;
    game.onCombatAttackResolved = (evt) => {
      combatEventFired = true;
      expect(evt.attacker.id).toBe(game.player.id);
      expect(evt.target.id).toBe(easy.id);
    };

    // Attack easy enemy
    const res = game.performPlayerCombatAttack(easy.id, 'quick', () => 0.01);
    expect(res).not.toBeNull();
    expect(combatEventFired).toBe(true);

    // Verify visual animation timers were set
    expect(game.player.attackAnimTimer).toBeGreaterThan(0);
    expect(easy.hitRecoilTimer).toBeGreaterThan(0);
    expect(easy.damageFlashTimer).toBeGreaterThan(0);

    // Update game loop by dt -> timers count down
    game.update(0.1);
    expect(game.player.attackAnimTimer).toBeLessThan(0.22);
    expect(easy.hitRecoilTimer).toBeLessThan(0.18);
    expect(easy.damageFlashTimer).toBeLessThan(0.20);

    // Simulate killing the enemy
    easy.combat!.hp = 1;
    const killRes = game.performPlayerCombatAttack(easy.id, 'power', () => 0.01);
    expect(killRes?.targetDefeated).toBe(true);
    expect(easy.combat!.isAlive).toBe(false);

    // Verify corpse can be looted
    expect(easy.isLooted).toBeFalsy();
    const looted = game.commandLootCorpse(easy.id);
    expect(looted).toBe(true);
    expect(easy.isLooted).toBe(true);

    // Second loot attempt fails
    const secondLoot = game.commandLootCorpse(easy.id);
    expect(secondLoot).toBe(false);
  });
});
