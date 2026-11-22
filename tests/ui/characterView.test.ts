import { describe, expect, it } from 'vitest';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { HudOverlay } from '../../src/ui/hudOverlay';

function makeFakeRoot(): HTMLElement {
  return {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null
  } as unknown as HTMLElement;
}

describe('Character ("Postać") View & Progression HUD', () => {
  it('renders XP bar, Mana, and Postać [C] button with unspent points badge on hero-card', () => {
    const game = new CrpgGameState('forest_clearing');
    game.grantPlayerXp(25); // Level 2 (+2 attr pts, +1 skill pt = 3 unspent)
    const scene = new IsoSceneView(game);
    const fakeRoot = makeFakeRoot();
    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.render();

    expect(fakeRoot.innerHTML).toContain('data-action="toggle-character"');
    expect(fakeRoot.innerHTML).toContain('Postać [C]');
    expect(fakeRoot.innerHTML).toContain('Poz. 2');
    expect(fakeRoot.innerHTML).toContain('Mana');
    expect(fakeRoot.innerHTML).toContain('unspent-points-badge');
  });

  it('opens and closes Postać view via toggleCharacter, C key, and Escape', () => {
    const game = new CrpgGameState('forest_clearing');
    const scene = new IsoSceneView(game);
    const fakeRoot = makeFakeRoot();
    const hud = new HudOverlay(fakeRoot, game, scene);

    expect(fakeRoot.innerHTML).not.toContain('character-drawer');

    // Open with 'c'
    const handledOpen = hud.handleGlobalKey({
      key: 'c',
      target: null,
      preventDefault: () => {}
    } as unknown as KeyboardEvent);
    expect(handledOpen).toBe(true);
    expect(fakeRoot.innerHTML).toContain('character-backdrop');
    expect(fakeRoot.innerHTML).toContain('character-drawer');
    expect(fakeRoot.innerHTML).toContain('skill-tree-svg');
    expect(fakeRoot.innerHTML).toContain('Rozdział Atrybutów');
    expect(fakeRoot.innerHTML).toContain('Drzewko Umiejętności');
    expect(fakeRoot.innerHTML).toContain('Witeź');
    expect(fakeRoot.innerHTML).toContain('Zwiadowca');
    expect(fakeRoot.innerHTML).toContain('Żerca Runiczny');
    expect(fakeRoot.innerHTML).toContain('data-action="respec-progression"');

    // Close with Escape
    const handledEsc = hud.handleGlobalKey({
      key: 'Escape',
      target: null,
      preventDefault: () => {}
    } as unknown as KeyboardEvent);
    expect(handledEsc).toBe(true);
    expect(fakeRoot.innerHTML).not.toContain('character-drawer');
  });

  it('renders attribute allocation buttons and skill tree nodes', () => {
    const game = new CrpgGameState('forest_clearing');
    game.grantPlayerXp(25);
    const scene = new IsoSceneView(game);
    const fakeRoot = makeFakeRoot();
    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.toggleCharacter();

    expect(fakeRoot.innerHTML).toContain('data-alloc-attr="might"');
    expect(fakeRoot.innerHTML).toContain('data-alloc-attr="finesse"');
    expect(fakeRoot.innerHTML).toContain('data-alloc-attr="resolve"');
    expect(fakeRoot.innerHTML).toContain('data-alloc-attr="lore"');
    expect(fakeRoot.innerHTML).toContain('data-alloc-attr="perception"');
    expect(fakeRoot.innerHTML).toContain('data-skill-node="witez_hart"');
    expect(fakeRoot.innerHTML).toContain('Hart Ciała');
  });

  it('renders unlocked active skills in the combat tactical bar', () => {
    const game = new CrpgGameState('forest_clearing');
    game.grantPlayerXp(500);
    game.unlockPlayerSkill('witez_hart');
    game.unlockPlayerSkill('witez_chwyt');
    game.unlockPlayerSkill('witez_rozplatanie');

    const enemy = game.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive)!;
    game.startCombatWithEnemy(enemy.id);

    const scene = new IsoSceneView(game);
    const fakeRoot = makeFakeRoot();
    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.render();

    expect(fakeRoot.innerHTML).toContain('data-combat-skill="witez_rozplatanie"');
    expect(fakeRoot.innerHTML).toContain('Rozpłatanie');
  });
});
