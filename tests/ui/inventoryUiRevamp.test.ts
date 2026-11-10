import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { HudOverlay, BackpackFilterCategory } from '../../src/ui/hudOverlay';
import { createItemInstance } from '../../src/rpg/inventorySystem';

describe('Inventory UI Revamp - Categories & Paperdoll Slot Highlights', () => {
  it('renders all 5 revamped intuitive category tabs with icons and live counts', () => {
    const game = new CrpgGameState('forest_clearing');
    // Add distinct items to backpack
    game.backpack.tryAddItem(createItemInstance('weapon_slavic_axe', 1));
    game.backpack.tryAddItem(createItemInstance('torso_warden_brigandine', 1));
    game.backpack.tryAddItem(createItemInstance('trinket_lunula', 1));
    game.backpack.tryAddItem(createItemInstance('item_roasted_sausage', 2));

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.toggleInventory();

    // Check tabs
    expect(fakeRoot.innerHTML).toContain('data-bag-filter="all"');
    expect(fakeRoot.innerHTML).toContain('data-bag-filter="weapons"');
    expect(fakeRoot.innerHTML).toContain('data-bag-filter="armor"');
    expect(fakeRoot.innerHTML).toContain('data-bag-filter="trinkets"');
    expect(fakeRoot.innerHTML).toContain('data-bag-filter="consumables"');

    expect(fakeRoot.innerHTML).toContain('Broń');
    expect(fakeRoot.innerHTML).toContain('Pancerz');
    expect(fakeRoot.innerHTML).toContain('Biżuteria');
    expect(fakeRoot.innerHTML).toContain('Prowiant');
  });

  it('renders paperdoll slots with pd-slot-status-badge element for dynamic hovering highlight and marks empty slots when candidate exists in bag', () => {
    const game = new CrpgGameState('forest_clearing');
    // Unequip helmet and add helmet to backpack
    game.equipmentManager.unequipToInventory('head');
    game.backpack.tryAddItem(createItemInstance('helm_szyszak', 1));

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.toggleInventory();

    expect(fakeRoot.innerHTML).toContain('pd-slot-status-badge');
    expect(fakeRoot.innerHTML).toContain('has-candidate-in-bag');
    expect(fakeRoot.innerHTML).toContain('Możesz założyć');
  });

  it('renders detailed comparison card with full item name and description without clipping', () => {
    const game = new CrpgGameState('forest_clearing');
    const staff = createItemInstance('weapon_astral_staff', 1);
    game.backpack.tryAddItem(staff);

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.toggleInventory();

    // Access buildLiveComparisonHtml via any casting for unit testing
    const compHtml = (hud as any).buildLiveComparisonHtml(staff, null);
    expect(compHtml).toContain('Kostur Runiczny Zatopionej Korony');
    expect(compHtml).toContain('Zwieńczony świecącym kryształem eterycznym');
    expect(compHtml).toContain('comp-detailed-card');
    expect(compHtml).toContain('comp-desc-block');
  });
});
