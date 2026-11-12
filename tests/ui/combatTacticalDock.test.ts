import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { HudOverlay } from '../../src/ui/hudOverlay';

describe('Combat Tactical Dock & 1-Turn Auto-Collapsing Aiming Drawer', () => {
  it('docks tactical bar into bottom-hud alongside hero card and combat live log during battle', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile);
    expect(enemy).toBeDefined();
    if (!enemy) return;

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    game.startCombatWithEnemy(enemy.id);
    hud.render();

    // Verify bottom-hud has combat-mode-active class and houses combat-tactical-bar
    expect(fakeRoot.innerHTML).toContain('bottom-hud combat-mode-active');
    expect(fakeRoot.innerHTML).toContain('combat-tactical-bar');
    expect(fakeRoot.innerHTML).toContain('combat-live-log');
    expect(fakeRoot.innerHTML).toContain('hero-card');
  });

  it('automatically collapses aiming drawer after an aimed attack or quick strike is triggered', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile);
    expect(enemy).toBeDefined();
    if (!enemy) return;

    // Move player adjacent
    game.player.tileX = enemy.tileX - 1;
    game.player.tileY = enemy.tileY;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    game.startCombatWithEnemy(enemy.id);

    // Open advanced targeting
    (hud as any).isCombatAdvancedOpen = true;
    hud.render();
    expect(fakeRoot.innerHTML).toContain('combat-veteran-drawer');
    expect(fakeRoot.innerHTML).toContain('PRECYZYJNE CELOWANIE');

    // Perform an attack via hud trigger or click simulation
    (hud as any).executeAttack('aimed_head');

    // Aiming drawer should auto-collapse to false so battlefield is visible
    expect((hud as any).isCombatAdvancedOpen).toBe(false);
  });
});
