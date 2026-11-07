import { beforeEach, describe, expect, it } from 'vitest';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { createItemInstance } from '../../src/rpg/inventorySystem';
import {
  clearSave,
  deserializeGameState,
  hasSavedGame,
  loadGame,
  saveGame,
  serializeGameState,
  STORAGE_KEY_AUTOSAVE,
  STORAGE_KEY_MANUAL
} from '../../src/rpg/saveSystem';
import { HudOverlay } from '../../src/ui/hudOverlay';

describe('cRPG Save & Auto-Persist System (F5 / Refresh Protection & Discreet Save)', () => {
  beforeEach(() => {
    // Clear storage before each test
    clearSave('all');
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('serializes all essential game state into a portable JSON structure', () => {
    const game = new CrpgGameState('forest_clearing');
    game.player.tileX = 18;
    game.player.tileY = 22;
    game.player.x = 18.5;
    game.player.y = 22.5;
    game.backpack.tryAddItem(createItemInstance('item_old_mead', 3), true);

    const serialized = serializeGameState(game);

    expect(serialized.mapId).toBe('forest_clearing');
    expect(serialized.player.tileX).toBe(18);
    expect(serialized.player.tileY).toBe(22);
    expect(serialized.backpack.some((s) => s.item?.definitionId === 'item_old_mead')).toBe(true);
    expect(serialized.equipment.mainHand?.definitionId).toBe('weapon_sunblade_longsword');
    expect(serialized.mapProps.length).toBeGreaterThan(0);
    expect(serialized.timestamp).toBeGreaterThan(0);
  });

  it('deserializes and fully restores game state: player position, inventory, equipment, props, and logs', () => {
    const originalGame = new CrpgGameState('forest_clearing');
    // Pick up sausage and interact with campfire
    const sausageProp = originalGame.map.props.find(
      (p) => p.kind === 'ground_loot' && p.lootItems?.includes('item_raw_sausage')
    );
    expect(sausageProp).toBeDefined();
    originalGame.togglePropInteraction(sausageProp!.id);
    expect(sausageProp!.isOpen).toBe(true);

    const campfire = originalGame.map.props.find((p) => p.kind === 'campfire');
    expect(campfire).toBeDefined();
    originalGame.togglePropInteraction(campfire!.id);
    expect(campfire!.isOpen).toBe(true);

    originalGame.player.tileX = 20;
    originalGame.player.tileY = 25;
    originalGame.player.x = 20.5;
    originalGame.player.y = 25.5;
    originalGame.addLog('Testowy wpis w kronice wydarzeń przed zapisem.');

    const snapshot = serializeGameState(originalGame);

    // Create a brand new game state (as if browser refreshed on F5)
    const freshGame = new CrpgGameState('slavic_village');
    expect(freshGame.map.id).toBe('slavic_village');

    const restored = deserializeGameState(snapshot, freshGame);
    expect(restored).toBe(true);

    expect(freshGame.map.id).toBe('forest_clearing');
    expect(freshGame.player.tileX).toBe(20);
    expect(freshGame.player.tileY).toBe(25);
    expect(freshGame.inventory.includes('item_roasted_sausage')).toBe(true);
    expect(freshGame.logs).toContain('Testowy wpis w kronice wydarzeń przed zapisem.');

    const restoredCampfire = freshGame.map.props.find((p) => p.kind === 'campfire');
    expect(restoredCampfire?.isOpen).toBe(true);
  });

  it('preserves defeated enemy state across saves and reloads', () => {
    const game = new CrpgGameState('forest_clearing');
    const easyEnemy = game.npcs.find((n) => n.combat?.isHostile && n.combat.difficulty === 'easy');
    expect(easyEnemy).toBeDefined();

    // Defeat enemy
    easyEnemy!.combat!.hp = 0;
    easyEnemy!.combat!.isAlive = false;

    saveGame(game, undefined, 'autosave');

    const freshGame = new CrpgGameState('forest_clearing');
    const loaded = loadGame(freshGame, undefined, 'autosave');
    expect(loaded).toBe(true);

    const restoredEnemy = freshGame.npcs.find((n) => n.id === easyEnemy!.id);
    expect(restoredEnemy).toBeDefined();
    expect(restoredEnemy!.combat!.isAlive).toBe(false);
    expect(restoredEnemy!.combat!.hp).toBe(0);
  });

  it('saves to localStorage (manual & autosave) and checks save presence', () => {
    const game = new CrpgGameState('forest_clearing');
    expect(hasSavedGame('autosave')).toBe(false);
    expect(hasSavedGame('manual')).toBe(false);

    saveGame(game, undefined, 'autosave');
    expect(hasSavedGame('autosave')).toBe(true);

    saveGame(game, undefined, 'manual');
    expect(hasSavedGame('manual')).toBe(true);

    clearSave('autosave');
    expect(hasSavedGame('autosave')).toBe(false);
    expect(hasSavedGame('manual')).toBe(true);

    clearSave('all');
    expect(hasSavedGame('manual')).toBe(false);
  });

  it('renders discreet save button and handles manual save in HudOverlay', () => {
    const game = new CrpgGameState('forest_clearing');
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene, { devMode: false });
    hud.render();

    expect(fakeRoot.innerHTML).toContain('data-action="save-game"');
    expect(fakeRoot.innerHTML).toContain('Zapisz');

    // Trigger save action through HudOverlay
    hud.saveGameDiscreetly();
    expect(hasSavedGame('manual')).toBe(true);
    expect(hasSavedGame('autosave')).toBe(true);
    expect(game.logs[0]).toContain('Zapisano stan gry');
  });
});
