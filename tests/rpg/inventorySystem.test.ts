import { describe, expect, it } from 'vitest';
import {
  CharacterStatSheet,
  createItemInstance,
  EquipmentManager,
  InventoryContainer,
  ItemComparisonEngine,
  ModifierType,
  StatModifier,
  StatType
} from '../../src/rpg/inventorySystem';
import { CharacterAttributes } from '../../src/rpg/characterData';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { HudOverlay } from '../../src/ui/hudOverlay';

const BASE_ATTRS: CharacterAttributes = {
  might: 15,
  finesse: 13,
  resolve: 14,
  lore: 14,
  perception: 15
};

describe('cRPG Inventory, Equipment & Live Comparison Engine (architektura_systemu_ekwipunku_crpg.md)', () => {
  it('computes FinalStat using (Base + sum(Flat)) * (1 + sum(PercentAdd)) * prod(1 + PercentMult)', () => {
    const sheet = new CharacterStatSheet(BASE_ATTRS);
    const mods: StatModifier[] = [
      { targetStat: StatType.ArmorRating, value: 10, type: ModifierType.Flat, sourceId: 'item_a' },
      { targetStat: StatType.ArmorRating, value: 5, type: ModifierType.Flat, sourceId: 'item_b' },
      { targetStat: StatType.ArmorRating, value: 0.10, type: ModifierType.PercentAdd, sourceId: 'buff_1' },
      { targetStat: StatType.ArmorRating, value: 0.05, type: ModifierType.PercentAdd, sourceId: 'buff_2' },
      { targetStat: StatType.ArmorRating, value: 0.20, type: ModifierType.PercentMult, sourceId: 'perk_1' }
    ];
    for (const m of mods) sheet.addModifier(m);

    // Base ArmorRating is 0 -> (0 + 15) * (1 + 0.15) * (1 + 0.20) = 15 * 1.15 * 1.2 = 20.7
    expect(sheet.getStatValue(StatType.ArmorRating)).toBeCloseTo(20.7, 3);
  });

  it('stacks consumable ItemInstances up to maxStack, splits stacks, swaps slots, and enforces weight limits', () => {
    const bag = new InventoryContainer(12, 30.0);

    const herbs1 = createItemInstance('item_moon_herbs', 2);
    const herbs2 = createItemInstance('item_moon_herbs', 2);
    expect(bag.tryAddItem(herbs1)).toBe(true);
    expect(bag.tryAddItem(herbs2)).toBe(true);

    // Should stack into slot 0 (total 4, since maxStack for herbs is >= 5)
    const occupied = bag.getOccupiedSlots();
    expect(occupied.length).toBe(1);
    expect(occupied[0].item?.stackCount).toBe(4);

    // Split stack of 4 into 2 and 2
    expect(bag.splitStack(0, 2)).toBe(true);
    expect(bag.getSlot(0)?.stackCount).toBe(2);
    expect(bag.getSlot(1)?.stackCount).toBe(2);

    // Swap slot 0 with slot 3
    bag.swapSlots(0, 3);
    expect(bag.getSlot(0)).toBeNull();
    expect(bag.getSlot(3)?.stackCount).toBe(2);
  });

  it('automatically unequips OffHand into InventoryContainer when equipping a TwoHanded weapon (Battleaxe or Staff)', () => {
    const bag = new InventoryContainer(20, 80.0);
    const stats = new CharacterStatSheet(BASE_ATTRS);
    const equipMgr = new EquipmentManager(bag, stats);

    const sword = createItemInstance('weapon_sunblade_longsword', 1);
    const shield = createItemInstance('offhand_heraldic_shield', 1);
    const greataxe = createItemInstance('weapon_Executioner_axe', 1);

    bag.tryAddItem(sword);
    bag.tryAddItem(shield);
    bag.tryAddItem(greataxe);

    expect(equipMgr.equipFromInventory(sword.instanceId).success).toBe(true);
    expect(equipMgr.equipFromInventory(shield.instanceId).success).toBe(true);
    expect(equipMgr.getEquipped('mainHand')?.definitionId).toBe('weapon_sunblade_longsword');
    expect(equipMgr.getEquipped('offHand')?.definitionId).toBe('offhand_heraldic_shield');

    // Equip TwoHanded battleaxe -> both sword and shield should return to backpack!
    const res = equipMgr.equipFromInventory(greataxe.instanceId);
    expect(res.success).toBe(true);
    expect(equipMgr.getEquipped('mainHand')?.definitionId).toBe('weapon_Executioner_axe');
    expect(equipMgr.getEquipped('offHand')).toBeNull();
    expect(bag.findByDefinitionId('weapon_sunblade_longsword')).toBeDefined();
    expect(bag.findByDefinitionId('offhand_heraldic_shield')).toBeDefined();
  });

  it('computes Direct Delta and Character Impact Delta in ItemComparisonEngine (including TwoHanded vs MainHand+OffHand)', () => {
    const bag = new InventoryContainer(20, 80.0);
    const stats = new CharacterStatSheet(BASE_ATTRS);
    const equipMgr = new EquipmentManager(bag, stats);

    const brigandine = createItemInstance('torso_warden_brigandine', 1);
    const plate = createItemInstance('torso_aethel_plate', 1);
    bag.tryAddItem(brigandine);
    bag.tryAddItem(plate);

    equipMgr.equipFromInventory(brigandine.instanceId);

    const report = ItemComparisonEngine.compareCandidate(plate, equipMgr, stats);
    const armorDelta = report.directDeltas.find((d) => d.stat === StatType.ArmorRating);
    expect(armorDelta).toBeDefined();
    expect(armorDelta?.currentValue).toBe(4);
    expect(armorDelta?.newValue).toBe(8);
    expect(armorDelta?.delta).toBe(4);
    expect(armorDelta?.isUpgrade).toBe(true);

    const charArmorImpact = report.characterImpacts.find((d) => d.stat === StatType.ArmorRating);
    expect(charArmorImpact?.delta).toBeGreaterThan(0);
  });

  it('renders Paperdoll equipment slots, 20-slot Backpack grid, carry weight bar, and Live Comparison panel in HudOverlay', () => {
    const game = new CrpgGameState('forest_clearing');
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene, { devMode: false });
    hud.toggleInventory();

    expect(fakeRoot.innerHTML).toContain('paperdoll-slot');
    expect(fakeRoot.innerHTML).toContain('backpack-grid');
    expect(fakeRoot.innerHTML).toContain('weight-meter');
    expect(fakeRoot.innerHTML).toContain('live-comparison-box');
    expect(fakeRoot.innerHTML).toContain('compact-backpack');
    expect(fakeRoot.innerHTML).toContain('compact-stat-strip');
  });
});
