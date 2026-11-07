import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { createItemInstance, getItemPriceInSiekance } from '../../src/rpg/inventorySystem';
import { deserializeGameState, serializeGameState } from '../../src/rpg/saveSystem';

describe('Merchant NPCs & Siekańce Hacksilver Economy (Every Location + Single-Click Duplicate Selling)', () => {
  it('spawns a designated merchant NPC in EVERY location (slavic_village, forest_clearing, sanctum_dungeon)', () => {
    // 1. Slavic Village -> Kupiec Dobromir
    const villageGame = new CrpgGameState('slavic_village');
    const dobromir = villageGame.npcs.find((n) => n.id === 'npc_dobromir');
    expect(dobromir).toBeDefined();
    expect(dobromir?.recipe.name).toContain('Dobromir');
    expect(dobromir?.dialogueId).toBe('npc_dobromir');

    // 2. Forest Clearing -> Wędrowny Kramarz Bogusz
    const forestGame = new CrpgGameState('forest_clearing');
    const bogusz = forestGame.npcs.find((n) => n.id === 'npc_bogusz');
    expect(bogusz).toBeDefined();
    expect(bogusz?.recipe.name).toContain('Bogusz');
    expect(bogusz?.dialogueId).toBe('npc_bogusz');
    expect(bogusz?.tileX).toBe(17);
    expect(bogusz?.tileY).toBe(17);

    // 3. Sanctum Dungeon -> Paser Gniewosz
    const sanctumGame = new CrpgGameState('sanctum_dungeon');
    const gniewosz = sanctumGame.npcs.find((n) => n.id === 'npc_gniewosz');
    expect(gniewosz).toBeDefined();
    expect(gniewosz?.recipe.name).toContain('Gniewosz');
    expect(gniewosz?.dialogueId).toBe('npc_gniewosz');
    expect(gniewosz?.tileX).toBe(14);
    expect(gniewosz?.tileY).toBe(7);
  });

  it('allows selling any item from backpack for siekańce, crediting wallet and freeing inventory weight', () => {
    const game = new CrpgGameState('forest_clearing');
    const initialSiekance = game.siekance;
    const sausage = createItemInstance('item_roasted_sausage', 2);
    const expectedPrice = getItemPriceInSiekance(sausage);
    expect(expectedPrice).toBeGreaterThan(0);

    game.backpack.tryAddItem(sausage, true);
    const weightBefore = game.backpack.currentWeight;

    const sellResult = game.sellItemForSiekance(sausage.instanceId);
    expect(sellResult.success).toBe(true);
    expect(sellResult.earned).toBe(expectedPrice);
    expect(game.siekance).toBe(initialSiekance + expectedPrice);
    expect(game.backpack.findByInstanceId(sausage.instanceId)).toBeUndefined();
    expect(game.backpack.currentWeight).toBeLessThan(weightBefore);
  });

  it('sells all duplicate items with a single action, keeping equipped items and first unequipped copies', () => {
    const game = new CrpgGameState('slavic_village');
    // Clear backpack so we control exactly what is tested
    game.backpack.clearAllSlots();
    const initialSiekance = game.siekance;

    // Equip Sunblade sword
    game.equipmentManager.equipDirectInstance(createItemInstance('weapon_sunblade_longsword', 1), 'mainHand');

    // Add duplicates of equipped sword to backpack (should both be sold)
    const dupeSword1 = createItemInstance('weapon_sunblade_longsword', 1);
    const dupeSword2 = createItemInstance('weapon_sunblade_longsword', 1);
    game.backpack.tryAddItem(dupeSword1, true);
    game.backpack.tryAddItem(dupeSword2, true);

    // Add unequipped items: 2 distinct instances of hunting bow (1st should be kept, 2nd sold)
    const bow1 = createItemInstance('weapon_hunting_bow', 1);
    const bow2 = createItemInstance('weapon_hunting_bow', 1);
    game.backpack.tryAddItem(bow1, true);
    game.backpack.tryAddItem(bow2, true);

    // Add single unique item (should be kept)
    const uniqueGrimoire = createItemInstance('offhand_grimoire', 1);
    game.backpack.tryAddItem(uniqueGrimoire, true);

    const priceSword = getItemPriceInSiekance('weapon_sunblade_longsword');
    const priceBow = getItemPriceInSiekance('weapon_hunting_bow');
    const expectedEarnings = priceSword * 2 + priceBow;

    const result = game.sellAllDuplicatesForSiekance();

    expect(result.soldCount).toBe(3); // 2 swords + 1 bow
    expect(result.earnedTotal).toBe(expectedEarnings);
    expect(game.siekance).toBe(initialSiekance + expectedEarnings);

    // Equipped sword is still equipped!
    expect(game.equipmentManager.getEquipped('mainHand')?.definitionId).toBe('weapon_sunblade_longsword');

    // Duplicate swords removed from backpack
    expect(game.backpack.findByInstanceId(dupeSword1.instanceId)).toBeUndefined();
    expect(game.backpack.findByInstanceId(dupeSword2.instanceId)).toBeUndefined();

    // First bow preserved, second sold
    expect(game.backpack.findByInstanceId(bow1.instanceId)).toBeDefined();
    expect(game.backpack.findByInstanceId(bow2.instanceId)).toBeUndefined();

    // Unique grimoire preserved
    expect(game.backpack.findByInstanceId(uniqueGrimoire.instanceId)).toBeDefined();

    // Selling again when no duplicates exist results in 0 sold
    const emptyResult = game.sellAllDuplicatesForSiekance();
    expect(emptyResult.soldCount).toBe(0);
    expect(emptyResult.earnedTotal).toBe(0);
  });

  it('executes duplicate selling through merchant dialogue choices for Dobromir, Bogusz and Gniewosz', () => {
    // 1. Dobromir in Slavic Village
    const village = new CrpgGameState('slavic_village');
    village.backpack.clearAllSlots();
    // Add two duplicate axes (neither equipped)
    const axe1 = createItemInstance('weapon_Executioner_axe', 1);
    const axe2 = createItemInstance('weapon_Executioner_axe', 1);
    village.backpack.tryAddItem(axe1, true);
    village.backpack.tryAddItem(axe2, true);

    village.startDialogueWithNpc('npc_dobromir');
    expect(village.activeDialogue).not.toBeNull();

    const sellChoice = village.activeDialogue?.node.choices.find(
      (c) => c.action === 'sell_duplicates'
    );
    expect(sellChoice).toBeDefined();

    if (sellChoice) {
      village.selectDialogueChoice(sellChoice);
      expect(village.lastDuplicateSaleResult?.soldCount).toBe(1);
      expect(village.activeDialogue?.node.text).toContain('Ubiłem z tobą wyborny interes');
    }

    // 2. Bogusz in Forest Clearing
    const forest = new CrpgGameState('forest_clearing');
    forest.startDialogueWithNpc('npc_bogusz');
    expect(forest.activeDialogue).not.toBeNull();
    expect(forest.activeDialogue?.node.choices.some((c) => c.action === 'sell_duplicates')).toBe(true);

    // 3. Gniewosz in Sanctum Dungeon
    const sanctum = new CrpgGameState('sanctum_dungeon');
    sanctum.startDialogueWithNpc('npc_gniewosz');
    expect(sanctum.activeDialogue).not.toBeNull();
    expect(sanctum.activeDialogue?.node.choices.some((c) => c.action === 'sell_duplicates')).toBe(true);
  });

  it('preserves siekańce wallet balance through serialization and deserialization', () => {
    const game = new CrpgGameState('forest_clearing');
    game.siekance = 375;

    const serialized = serializeGameState(game);
    expect(serialized.siekance).toBe(375);

    const loadedGame = new CrpgGameState('forest_clearing');
    deserializeGameState(serialized, loadedGame);
    expect(loadedGame.siekance).toBe(375);
  });
});
