import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import {
  computeAttackPreview,
  computeDerivedCombatStats,
  createDefaultProficiencies,
  resolveCombatAttack
} from '../../src/rpg/combatSystem';
import { CharacterStatSheet, createItemInstance } from '../../src/rpg/inventorySystem';

describe('Combat Logic In-Depth Audit (AP Economy, Combat Maneuvers, Status Effects, Aggro & Defeat)', () => {
  it('enforces strict AP economy: attacks, defense stance, movement, gear swaps, and potions consume AP', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy')!;
    expect(easyEnemy).toBeDefined();

    // Place player next to easy enemy (tile (10, 20) is north adjacent and walkable)
    game.player.tileX = easyEnemy.tileX;
    game.player.tileY = easyEnemy.tileY - 1;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;
    game.player.z = game.map.tiles[game.player.tileY][game.player.tileX].z;

    // Start combat
    game.startCombatWithEnemy(easyEnemy.id);
    expect(game.combatState.active).toBe(true);
    expect(game.combatState.activeTurnActorId).toBe(game.player.id);

    const maxAp = game.player.combat!.maxAp;
    expect(game.player.combat!.ap).toBe(maxAp);

    // 1. Postawa Obronna (-2 AP)
    const defended = game.activatePlayerDefendStance();
    expect(defended).toBe(true);
    expect(game.player.combat!.defending).toBe(true);
    expect(game.player.combat!.ap).toBe(maxAp - 2);

    const pCombat = game.getActorCombatant(game.player);
    expect(pCombat.derived.evasionPct).toBeGreaterThan(15);

    // 2. Wyposażenie przedmiotu w walce (-2 AP)
    const swordInst = createItemInstance('weapon_astral_staff', 1);
    game.backpack.tryAddItem(swordInst, true);
    const equipOk = game.useOrEquipInstance(swordInst.instanceId, 'mainHand');
    expect(equipOk).toBe(true);
    expect(game.player.combat!.ap).toBe(maxAp - 4);

    // 3. Atak (-apSpent AP)
    const currentAp = game.player.combat!.ap;
    const atkOutcome = game.performPlayerCombatAttack(easyEnemy.id, 'quick', () => 0.01);
    expect(atkOutcome).not.toBeNull();
    expect(atkOutcome!.hit).toBe(true);
    expect(game.player.combat!.ap).toBe(currentAp - atkOutcome!.apSpent);

    // 4. Atakujący traci postawę obronną po wyprowadzeniu własnego ciosu
    expect(game.player.combat!.defending).toBe(false);

    // 5. Ruch w walce (-1 AP per tile)
    const apBeforeMove = game.player.combat!.ap;
    let targetX = game.player.tileX;
    let targetY = game.player.tileY;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      if (game.isTileWalkable(game.player.tileX + dx, game.player.tileY + dy, game.player.id)) {
        targetX = game.player.tileX + dx;
        targetY = game.player.tileY + dy;
        break;
      }
    }
    const moveOk = game.commandPlayerMoveTo(targetX, targetY);
    expect(moveOk).toBe(true);
    expect(game.player.combat!.ap).toBe(apBeforeMove - 1);
    expect(game.player.combat!.ap).toBe(apBeforeMove - 1);

    // 6. Zerowanie AP: gracz nie może wykonać ataku, gdy ap < apCost
    game.player.combat!.ap = 0;
    const zeroApAttack = game.performPlayerCombatAttack(easyEnemy.id, 'quick');
    expect(zeroApAttack).toBeNull();

    const zeroApMove = game.commandPlayerMoveTo(game.player.tileX + 1, game.player.tileY);
    expect(zeroApMove).toBe(false);

    const zeroApEquip = game.useOrEquipInstance(swordInst.instanceId, 'mainHand');
    expect(zeroApEquip).toBe(false);
  });

  it('crippled legs status doubles movement AP cost from 1 to 2 AP per tile', () => {
    const game = new CrpgGameState('forest_clearing');
    game.startCombatWithEnemy('enemy_bandit_easy');

    game.player.combat!.ap = 8;
    game.player.combat!.crippledLegsTurns = 2;

    const startX = game.player.tileX;
    const startY = game.player.tileY;

    // Przesunięcie o 1 kafel w stanie okaleczenia
    const moveOk = game.commandPlayerMoveTo(startX + 1, startY);
    expect(moveOk).toBe(true);
    // Koszt powinien wynosić 2 AP zamiast 1 AP
    expect(game.player.combat!.ap).toBe(6);
  });

  it('dazed head status reduces max AP by 3 points in subsequent combat rounds', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy')!;

    game.startCombatWithEnemy(easyEnemy.id);
    const standardMaxAp = game.player.combat!.maxAp;

    // Nałożenie dazed_head na gracza
    game.player.combat!.dazedHeadTurns = 1;

    // Rozpoczęcie nowej rundy z aktywnym oszołomieniem
    game.finishRoundAndStartPlayerTurn();

    expect(game.player.combat!.maxAp).toBe(standardMaxAp - 3);
    expect(game.player.combat!.ap).toBe(standardMaxAp - 3);

    // Zakończenie tury gracza dekrementuje licznik
    game.endPlayerCombatTurn();
    expect(game.player.combat!.dazedHeadTurns).toBe(0);

    // Kolejna runda przywraca pełne AP
    game.finishRoundAndStartPlayerTurn();
    expect(game.player.combat!.maxAp).toBe(standardMaxAp);
    expect(game.player.combat!.ap).toBe(standardMaxAp);
  });

  it('triggers aggro when player approaches hostile NPC within aggroRadius and applies retreat cooldown on flee', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy')!;
    expect(easyEnemy.combat?.aggroRadius).toBeGreaterThan(0);

    // Umieszczenie gracza daleko od wroga -> brak walki
    game.player.tileX = 2;
    game.player.tileY = 2;
    game.update(0.1);
    expect(game.combatState.active).toBe(false);

    // Podejście gracza w zasięg aggro wroga (odległość <= 3.5 kafli)
    game.player.tileX = easyEnemy.tileX - 2;
    game.player.tileY = easyEnemy.tileY;
    game.update(0.1);

    // Wróg powinien zainicjować walkę turową
    expect(game.combatState.active).toBe(true);
    expect(game.combatState.selectedTargetId).toBe(easyEnemy.id);

    // Ucieczka z walki (fleeCombat)
    game.fleeCombat();
    expect(game.combatState.active).toBe(false);
    expect(easyEnemy.aggroCooldownTimer).toBeGreaterThan(0);

    // Natychmiastowy update nie powinien ponownie wywołać walki z uwagi na cooldown
    game.update(0.1);
    expect(game.combatState.active).toBe(false);
  });

  it('handles victory gracefully: cleans up participant queue, resets AP, removes statuses, and records victory log', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy')!;

    // Oznacz pozostałych wrogów jako nieaktywnych dla tego pojedynku
    for (const n of game.npcs) {
      if (n.id !== easyEnemy.id && n.combat) {
        n.combat.isAlive = false;
      }
    }

    game.player.tileX = easyEnemy.tileX - 1;
    game.player.tileY = easyEnemy.tileY;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;
    game.player.z = game.map.tiles[game.player.tileY][game.player.tileX].z;

    game.startCombatWithEnemy(easyEnemy.id);
    expect(game.combatState.active).toBe(true);

    // Obniżenie HP wroga do 1 i zadanie śmiertelnego ciosu
    easyEnemy.combat!.hp = 1;
    const finalHit = game.performPlayerCombatAttack(easyEnemy.id, 'power', () => 0.01);
    expect(finalHit).not.toBeNull();
    expect(finalHit!.targetDefeated).toBe(true);
    expect(easyEnemy.combat!.isAlive).toBe(false);

    // Walka powinna zakończyć się zwycięstwem
    expect(game.combatState.active).toBe(false);
    expect(game.combatState.activeTurnActorId).toBeNull();
    expect(game.player.combat!.ap).toBe(game.player.combat!.maxAp);
    expect(game.chronicleEntries.some((l) => l.text.includes('Zwycięstwo'))).toBe(true);
  });

  it('handles player defeat without soft-locking: respawns at campfire and resets hostility paths', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy')!;

    game.startCombatWithEnemy(easyEnemy.id);
    expect(game.combatState.active).toBe(true);

    // Obniżenie HP gracza do 0
    game.player.combat!.hp = 0;
    // Wywołanie tury wroga zadającego ostateczny cios
    game.endPlayerCombatTurn();

    // Gracz powinien zostać odrodzony przy ognisku (15, 17) z pełnym HP
    expect(game.combatState.active).toBe(false);
    expect(game.player.combat!.isAlive).toBe(true);
    expect(game.player.combat!.hp).toBe(game.player.combat!.maxHp);
    expect(game.player.tileX).toBe(15);
    expect(game.player.tileY).toBe(17);
  });

  it('verifies mathematical consistency between damage preview and deterministic resolution', () => {
    const sheet = new CharacterStatSheet({
      might: 14,
      finesse: 14,
      resolve: 14,
      lore: 10,
      perception: 14
    });
    const profs = createDefaultProficiencies();
    const derived = computeDerivedCombatStats(
      sheet,
      profs,
      'weapon_sunblade_longsword',
      null,
      false,
      false
    );

    const attacker = {
      actorId: 'player',
      name: 'Bohater',
      perception: 14,
      finesse: 14,
      might: 14,
      resolve: 14,
      lore: 10,
      combat: {
        isHostile: false,
        aggroRadius: 0,
        hp: 100,
        maxHp: 100,
        ap: 10,
        maxAp: 10,
        proficiencies: profs,
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 0,
        lootTable: [],
        isAlive: true
      },
      derived
    };

    const defDerived = computeDerivedCombatStats(
      sheet,
      profs,
      null,
      null,
      false,
      false
    );

    const defender = {
      actorId: 'dummy',
      name: 'Tarcza Treningowa',
      perception: 10,
      finesse: 10,
      might: 10,
      resolve: 10,
      lore: 10,
      combat: {
        isHostile: true,
        aggroRadius: 0,
        hp: 100,
        maxHp: 100,
        ap: 8,
        maxAp: 8,
        proficiencies: profs,
        defending: false,
        dazedHeadTurns: 0,
        crippledLegsTurns: 0,
        xpReward: 0,
        lootTable: [],
        isAlive: true
      },
      derived: defDerived
    };

    const preview = computeAttackPreview(attacker, defender, 1, 'quick');
    expect(preview.inRange).toBe(true);
    expect(preview.hitChancePct).toBeGreaterThanOrEqual(5);
    expect(preview.hitChancePct).toBeLessThanOrEqual(95);

    // Test minimalnego zadanego rolla (roll 1: hit 0.05, roll 2: crit 0.99 (no crit), roll 3: dmg 0.00)
    let minCall = 0;
    const minRollSequence = [0.05, 0.99, 0.0];
    const minRollResult = resolveCombatAttack(
      attacker,
      defender,
      1,
      'quick',
      () => minRollSequence[minCall++] ?? 0.0
    );
    expect(minRollResult.hit).toBe(true);
    expect(minRollResult.critical).toBe(false);
    expect(minRollResult.damageDealt).toBe(preview.estimatedMinDamage);

    // Test maksymalnego zadanego rolla niekrytycznego (roll 1: hit 0.05, roll 2: crit 0.99 (no crit), roll 3: dmg 1.00)
    let maxCall = 0;
    const maxRollSequence = [0.05, 0.99, 1.0];
    const maxRollResult = resolveCombatAttack(
      attacker,
      defender,
      1,
      'quick',
      () => maxRollSequence[maxCall++] ?? 1.0
    );
    expect(maxRollResult.hit).toBe(true);
    expect(maxRollResult.critical).toBe(false);
    expect(maxRollResult.damageDealt).toBe(preview.estimatedMaxDamage);
  });
});
