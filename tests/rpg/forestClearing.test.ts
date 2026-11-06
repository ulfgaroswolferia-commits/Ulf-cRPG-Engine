import { describe, expect, it } from 'vitest';
import { createForestClearingMap } from '../../src/core/worldMap';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('Forest Clearing Test Location ("Polana Wilczego Ognia")', () => {
  it('creates a large multi-screen 32x32 forest clearing map with central campfire, exit path, trees, and lootable items', () => {
    const map = createForestClearingMap();
    expect(map.width).toBe(32);
    expect(map.height).toBe(32);

    const campfire = map.props.find((p) => p.kind === 'campfire');
    expect(campfire).toBeDefined();

    const exitTrigger = map.props.find((p) => p.kind === 'exit_path');
    expect(exitTrigger).toBeDefined();

    const sausageLoot = map.props.find(
      (p) => p.kind === 'ground_loot' && p.lootItems?.includes('item_raw_sausage')
    );
    expect(sausageLoot).toBeDefined();
  });

  it('prevents leaving via the exit path and makes the hero say "Jeszcze nie czas iść dalej..."', () => {
    const game = new CrpgGameState('forest_clearing');
    const exitProp = game.map.props.find((p) => p.kind === 'exit_path');
    expect(exitProp).toBeDefined();
    if (!exitProp) return;

    game.togglePropInteraction(exitProp.id);

    expect(game.player.speechBubbleText).toBe('Jeszcze nie czas iść dalej...');
    expect(game.logs[0]).toContain('Jeszcze nie czas iść dalej...');
  });

  it('allows picking up the raw sausage and roasting it on the central campfire into a roasted sausage', () => {
    const game = new CrpgGameState('forest_clearing');
    const sausageProp = game.map.props.find(
      (p) => p.kind === 'ground_loot' && p.lootItems?.includes('item_raw_sausage')
    );
    const campfire = game.map.props.find((p) => p.kind === 'campfire');
    expect(sausageProp).toBeDefined();
    expect(campfire).toBeDefined();
    if (!sausageProp || !campfire) return;

    // Pick up raw sausage from the clearing
    expect(game.inventory.includes('item_raw_sausage')).toBe(false);
    game.togglePropInteraction(sausageProp.id);
    expect(game.inventory.includes('item_raw_sausage')).toBe(true);

    // Interact with campfire -> roasts the raw sausage into item_roasted_sausage
    game.togglePropInteraction(campfire.id);
    expect(game.inventory.includes('item_raw_sausage')).toBe(false);
    expect(game.inventory.includes('item_roasted_sausage')).toBe(true);
  });
});
