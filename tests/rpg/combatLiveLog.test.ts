import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { HudOverlay } from '../../src/ui/hudOverlay';

describe('Live Combat Log - Dedicated In-Battle Journal Component', () => {
  it('renders combat-live-log during active combat instead of chronicle-log', () => {
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

    // Prior to combat, chronicle-log should be present
    hud.render();
    expect(fakeRoot.innerHTML).toContain('chronicle-log');
    expect(fakeRoot.innerHTML).not.toContain('combat-live-log');

    // Start combat
    game.startCombatWithEnemy(enemy.id);
    game.addCombatLog('🗡️ Trafienie! [Szybki Cios] Zadano 14 obr. celowi Wilk (wytłumiono 3 przez DT/DR, szansa: 72%).');
    game.addCombatLog('💥 KRYTYK! [Silny Cios] Zadano 28 obr. celowi Wilk (wytłumiono 2 przez DT/DR, szansa: 60%) + OGŁUSZENIE!');
    game.addCombatLog('💨 [Szybki Cios] Pudło w Wilk! (Szansa: 50%, rzut: 79%, koszt: -3 AP).');

    hud.render();

    // In active combat, combat-live-log MUST replace chronicle-log in bottom HUD
    expect(fakeRoot.innerHTML).toContain('combat-live-log');
    expect(fakeRoot.innerHTML).toContain('Dziennik Walki');
    expect(fakeRoot.innerHTML).toContain('combat-entry-hit');
    expect(fakeRoot.innerHTML).toContain('combat-entry-crit');
    expect(fakeRoot.innerHTML).toContain('combat-entry-miss');
    expect(fakeRoot.innerHTML).toContain('14 obr.');
    expect(fakeRoot.innerHTML).toContain('KRYTYK');
  });

  it('allows toggling between combat log and general world chronicle during battle', () => {
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

    expect(fakeRoot.innerHTML).toContain('combat-live-log');

    // Toggle to view chronicle tab during battle
    (hud as any).activeBattleLogTab = 'chronicle';
    hud.render();
    expect(fakeRoot.innerHTML).toContain('chronicle-log');

    // Toggle back
    (hud as any).activeBattleLogTab = 'combat';
    hud.render();
    expect(fakeRoot.innerHTML).toContain('combat-live-log');
  });
});
