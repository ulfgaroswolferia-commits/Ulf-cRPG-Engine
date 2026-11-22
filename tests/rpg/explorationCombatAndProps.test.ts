import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCustomPropSprites,
  registerCustomPropSprite,
  resolveCustomPropSprite
} from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('Exploration combat initiation & custom painterly prop registry', () => {
  afterEach(() => {
    clearCustomPropSprites();
  });

  it('resolves custom prop sprites by exact id, idPrefix, and kind', () => {
    registerCustomPropSprite({ id: 'brzezina_dwor_szkoly', url: '/assets/props/brzezina_dwor.png', targetWidthPx: 260 });
    registerCustomPropSprite({ idPrefix: 'trakt_woz_', url: '/assets/props/trakt_woz.png' });
    registerCustomPropSprite({ kind: 'ancient_oak', url: '/assets/props/drzewo_brzoza.png' });

    expect(resolveCustomPropSprite({ id: 'brzezina_dwor_szkoly', kind: 'slavic_cottage' })?.url).toBe(
      '/assets/props/brzezina_dwor.png'
    );
    expect(resolveCustomPropSprite({ id: 'trakt_woz_1', kind: 'dungeon_crate' })?.url).toBe(
      '/assets/props/trakt_woz.png'
    );
    expect(resolveCustomPropSprite({ id: 'tree_9', kind: 'ancient_oak' })?.url).toBe(
      '/assets/props/drzewo_brzoza.png'
    );
    expect(resolveCustomPropSprite({ id: 'crate_1', kind: 'dungeon_crate' })).toBeNull();
  });

  it('initiates combat from exploration on hostile NPCs with surprise flag and protects friendlies', () => {
    const game = new CrpgGameState('forest_clearing');
    expect(game.enemyCombatMoveSpeed).toBeGreaterThan(3.5);
    expect(game.enemyCombatPauseScale).toBeLessThan(1.0);

    const friendly = game.npcs.find((n) => !n.combat?.isHostile);
    if (friendly) {
      expect(game.commandAttackEnemyFromExploration(friendly.id)).toBe(false);
    }

    const hostile = game.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive);
    if (hostile) {
      hostile.tileX = game.player.tileX + 1;
      hostile.tileY = game.player.tileY;
      hostile.x = hostile.tileX + 0.5;
      hostile.y = hostile.tileY + 0.5;
      game.isStealthActive = true;

      const started = game.commandAttackEnemyFromExploration(hostile.id);
      expect(started).toBe(true);
      expect(game.combatState.active).toBe(true);
    }
  });
});
