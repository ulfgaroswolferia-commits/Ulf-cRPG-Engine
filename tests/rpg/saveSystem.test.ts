import { beforeEach, describe, expect, it } from 'vitest';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { createItemInstance } from '../../src/rpg/inventorySystem';
import {
  clearSave,
  deserializeGameState,
  hasSavedGame,
  isAutosaveDisabled,
  loadGame,
  saveGame,
  serializeGameState,
  setAutosaveDisabled,
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
    easyEnemy!.isLooted = true;

    saveGame(game, undefined, 'autosave');

    const freshGame = new CrpgGameState('forest_clearing');
    const loaded = loadGame(freshGame, undefined, 'autosave');
    expect(loaded).toBe(true);

    const restoredEnemy = freshGame.npcs.find((n) => n.id === easyEnemy!.id);
    expect(restoredEnemy).toBeDefined();
    expect(restoredEnemy!.combat!.isAlive).toBe(false);
    expect(restoredEnemy!.combat!.hp).toBe(0);
    expect(restoredEnemy!.isLooted).toBe(true);
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

  it('resetToNewGame completely clears progress, restores default starter gear, siekańce, and map', () => {
    const game = new CrpgGameState('forest_clearing');

    // Loot chest/basket
    const lootProp = game.map.props.find((p) => p.kind === 'ground_loot');
    if (lootProp) {
      lootProp.isOpen = true;
      expect(lootProp.isOpen).toBe(true);
    }

    // Mutate state heavily: change attributes, siekance, add items, unequip, move player
    game.siekance = 8500;
    game.player.tileX = 29;
    game.player.tileY = 29;
    game.player.x = 29.5;
    game.player.y = 29.5;
    game.statSheet.setBaseAttributes({ might: 25, finesse: 20, resolve: 18, lore: 12, perception: 19 });
    game.equipmentManager.clearAllEquipped();
    game.backpack.clearAllSlots();
    game.backpack.tryAddItem(createItemInstance('item_old_mead', 10), true);
    game.addLog('Zaawansowany wpis w kronice po 10 godzinach gry.');

    // Now invoke resetToNewGame
    game.resetToNewGame('forest_clearing');

    // Assert: siekańce reset to 45
    expect(game.siekance).toBe(45);

    // Assert: player position reset to (15, 17)
    expect(game.player.tileX).toBe(15);
    expect(game.player.tileY).toBe(17);

    // Assert: starter equipment re-equipped
    const equipped = game.equipmentManager.getAllEquipped();
    expect(equipped.mainHand?.definitionId).toBe('weapon_sunblade_longsword');
    expect(equipped.offHand?.definitionId).toBe('offhand_torch');
    expect(equipped.torso?.definitionId).toBe('torso_warden_brigandine');
    expect(equipped.legs?.definitionId).toBe('legs_leather_boots');
    expect(equipped.ring1?.definitionId).toBe('ring_wolf_signet');

    // Assert: backpack contains only starter items, no mead
    const bagItemIds = game.backpack.getOccupiedSlots().map((s) => s.item?.definitionId);
    expect(bagItemIds).not.toContain('item_old_mead');
    expect(bagItemIds).toContain('torso_linen_tunic');
    expect(bagItemIds).toContain('helm_shadow_hood');
    expect(bagItemIds).toContain('offhand_heraldic_shield');

    // Assert: loot prop is back to pristine unlooted (isOpen is false)
    const resetLootProp = game.map.props.find((p) => p.kind === 'ground_loot');
    expect(resetLootProp?.isOpen).toBe(false);

    // Assert: base attributes are restored to defaults
    expect(game.statSheet.getBaseAttributes().might).toBe(15);
    expect(game.statSheet.getBaseAttributes().finesse).toBe(13);

    // Assert: chronicle logs only contain initial welcome message
    expect(game.logs.length).toBe(1);
    expect(game.logs[0]).toContain('Witaj na Polanie Wilczego Ognia');
  });

  it('suppresses autosave when autosave is disabled, preventing overwrite of clean new game state', () => {
    const game = new CrpgGameState('forest_clearing');
    clearSave('all');
    expect(hasSavedGame('autosave')).toBe(false);

    setAutosaveDisabled(true);
    expect(isAutosaveDisabled()).toBe(true);

    // Attempting autosave while suppressed must fail and NOT write to storage
    const saved = saveGame(game, undefined, 'autosave');
    expect(saved).toBe(false);
    expect(hasSavedGame('autosave')).toBe(false);

    // Re-enabling autosave allows saving normally
    setAutosaveDisabled(false);
    expect(isAutosaveDisabled()).toBe(false);

    const savedAfter = saveGame(game, undefined, 'autosave');
    expect(savedAfter).toBe(true);
    expect(hasSavedGame('autosave')).toBe(true);
  });

  it('HudOverlay.resetSaveAndRestart clears saves, suppresses autosave, and resets in-memory game state', () => {
    const game = new CrpgGameState('forest_clearing');
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene, { devMode: false });

    // Save previous progress
    hud.saveGameDiscreetly();
    expect(hasSavedGame('autosave')).toBe(true);
    expect(hasSavedGame('manual')).toBe(true);

    // Mutate state before restarting
    game.siekance = 9999;

    // Reset save & restart
    hud.resetSaveAndRestart();

    // Autosave should be suppressed
    expect(isAutosaveDisabled()).toBe(true);

    // All saves in storage should be deleted
    expect(hasSavedGame('autosave')).toBe(false);
    expect(hasSavedGame('manual')).toBe(false);

    // In-memory state should be cleanly reset to new game
    expect(game.siekance).toBe(45);
    expect(game.equipmentManager.getAllEquipped().mainHand?.definitionId).toBe('weapon_sunblade_longsword');

    // Clean up
    setAutosaveDisabled(false);
  });

  it('persists and restores combatReports and chronicle entries with report IDs across save and load', () => {
    const game = new CrpgGameState('forest_clearing');
    const reportId = 'rep_test_123';
    game.combatReports[reportId] = {
      id: reportId,
      targetName: 'Bandyta',
      timestamp: Date.now(),
      outcome: 'victory',
      entries: ['Trafienie za 12 obr.', 'Zwycięstwo!']
    };
    game.addLog('Pokonano Bandyta!', 'combat', reportId);

    const serialized = serializeGameState(game);
    expect(serialized.combatReports).toBeDefined();
    expect(serialized.combatReports![reportId]).toBeDefined();
    expect(serialized.chronicleEntries).toBeDefined();
    expect(serialized.chronicleEntries![0].combatReportId).toBe(reportId);

    const restoredGame = new CrpgGameState('forest_clearing');
    deserializeGameState(serialized, restoredGame);

    expect(restoredGame.combatReports[reportId]).toBeDefined();
    expect(restoredGame.combatReports[reportId].outcome).toBe('victory');
    expect(restoredGame.chronicleEntries[0].combatReportId).toBe(reportId);
  });
});
