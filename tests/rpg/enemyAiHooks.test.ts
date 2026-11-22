import { describe, expect, it } from 'vitest';
import type { CombatantSnapshot } from '../../src/rpg/combatSystem';
import {
  ActorEntity,
  CrpgGameState,
  EnemyAiAttackDecision,
  EnemyAiMovePlan
} from '../../src/rpg/gameLoop';

class CustomAiGameState extends CrpgGameState {
  public movePlanCalls = 0;
  public attackChoices = 0;
  public specialExecuted = 0;
  public turnEndedCount = 0;
  public playerTurnStartedCount = 0;
  public maxAttacksAllowed = 1;
  public forceSpecialFirst = false;

  protected override planEnemyCombatMove(
    enemy: ActorEntity,
    eSnap: CombatantSnapshot,
    dist: number
  ): EnemyAiMovePlan | null {
    this.movePlanCalls++;
    return super.planEnemyCombatMove(enemy, eSnap, dist);
  }

  protected override chooseEnemyCombatAttack(
    enemy: ActorEntity,
    eSnap: CombatantSnapshot,
    playerSnap: CombatantSnapshot,
    dist: number,
    attacksThisTurn: number
  ): EnemyAiAttackDecision {
    this.attackChoices++;
    if (attacksThisTurn >= this.maxAttacksAllowed) {
      return { kind: 'stop' };
    }
    if (this.forceSpecialFirst && attacksThisTurn === 0 && enemy.combat && enemy.combat.ap >= 3) {
      return {
        kind: 'special',
        apCost: 3,
        execute: () => {
          this.specialExecuted++;
          this.addCombatLog('⚡ Specjalna akcja testowa!');
        }
      };
    }
    return super.chooseEnemyCombatAttack(enemy, eSnap, playerSnap, dist, attacksThisTurn);
  }

  protected override onEnemyCombatTurnEnded(enemy: ActorEntity, attacksThisTurn: number): void {
    this.turnEndedCount++;
    super.onEnemyCombatTurnEnded(enemy, attacksThisTurn);
  }

  protected override onPlayerCombatTurnStarted(): void {
    this.playerTurnStartedCount++;
  }
}

describe('CrpgGameState enemy AI strategy hooks', () => {
  it('invokes custom move, attack cap, special action, turn end, and player turn start hooks', () => {
    const state = new CustomAiGameState('forest_clearing');
    const enemy = state.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    expect(enemy).toBeDefined();

    // Place enemy right next to player so it can act immediately
    enemy.tileX = state.player.tileX + 1;
    enemy.tileY = state.player.tileY;
    enemy.x = enemy.tileX + 0.5;
    enemy.y = enemy.tileY + 0.5;
    enemy.combat!.maxAp = 8;
    enemy.combat!.ap = 8;

    state.startCombatWithEnemy(enemy.id);
    state.forceSpecialFirst = true;
    state.maxAttacksAllowed = 1;

    state.endPlayerCombatTurn(false);

    expect(state.movePlanCalls).toBeGreaterThanOrEqual(1);
    expect(state.specialExecuted).toBe(1);
    expect(state.turnEndedCount).toBe(1);
    expect(state.playerTurnStartedCount).toBe(1);
    expect(state.combatLogs.some((l) => l.includes('Specjalna akcja testowa'))).toBe(true);
  });
});
