import { describe, expect, it } from 'vitest';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { createItemInstance, getItemPriceInSiekance } from '../../src/rpg/inventorySystem';
import { deserializeGameState, serializeGameState } from '../../src/rpg/saveSystem';
import { getMerchantWares } from '../../src/rpg/dialogueSystem';

describe('Merchant NPCs, Expensive Grind Items & Siekańce Economy', () => {
  it('spawns a designated merchant NPC in EVERY location (slavic_village, forest_clearing, sanctum_dungeon)', () => {
    // 1. Slavic Village -> Kupiec Dobromir
    const villageGame = new CrpgGameState('slavic_village');
    const dobromir = villageGame.npcs.find((n) => n.id === 'npc_dobromir');
    expect(dobromir).toBeDefined();
    expect(dobromir?.recipe.name).toContain('Dobromir');
    expect(dobromir?.dialogueId).toBe('npc_dobromir');
    expect(dobromir?.isMerchant).toBe(true);

    // 2. Forest Clearing -> Wędrowny Kramarz Bogusz
    const forestGame = new CrpgGameState('forest_clearing');
    const bogusz = forestGame.npcs.find((n) => n.id === 'npc_bogusz');
    expect(bogusz).toBeDefined();
    expect(bogusz?.recipe.name).toContain('Bogusz');
    expect(bogusz?.dialogueId).toBe('npc_bogusz');
    expect(bogusz?.tileX).toBe(17);
    expect(bogusz?.tileY).toBe(17);
    expect(bogusz?.isMerchant).toBe(true);

    // 3. Sanctum Dungeon -> Paser Gniewosz
    const sanctumGame = new CrpgGameState('sanctum_dungeon');
    const gniewosz = sanctumGame.npcs.find((n) => n.id === 'npc_gniewosz');
    expect(gniewosz).toBeDefined();
    expect(gniewosz?.recipe.name).toContain('Gniewosz');
    expect(gniewosz?.dialogueId).toBe('npc_gniewosz');
    expect(gniewosz?.tileX).toBe(14);
    expect(gniewosz?.tileY).toBe(7);
    expect(gniewosz?.isMerchant).toBe(true);
  });

  it('strictly FORBIDS selling single items when NOT near a merchant', () => {
    // In Slavic Village, player spawns at (16, 20), whereas Kupiec Dobromir is at (14, 14) (dist ~6.3)
    const game = new CrpgGameState('slavic_village');
    expect(game.isNearMerchant()).toBe(false);

    const testItem = createItemInstance('weapon_hunting_bow', 1);
    game.backpack.tryAddItem(testItem, true);
    const initialSiekance = game.siekance;

    // Trying to sell single item while away from merchant fails
    const singleSell = game.sellItemForSiekance(testItem.instanceId);
    expect(singleSell.success).toBe(false);
    expect(game.siekance).toBe(initialSiekance);
    expect(game.backpack.findByInstanceId(testItem.instanceId)).toBeDefined();
    expect(game.logs.some((l) => l.includes('Sprzedaż możliwa tylko u kupca'))).toBe(true);

    // Walk player up to Kupiec Dobromir (tile 14, 15 - adjacent to stall)
    game.player.tileX = 14;
    game.player.tileY = 15;
    game.player.x = 14.5;
    game.player.y = 15.5;

    expect(game.isNearMerchant()).toBe(true);

    // Selling now succeeds!
    const allowedSell = game.sellItemForSiekance(testItem.instanceId);
    expect(allowedSell.success).toBe(true);
    expect(game.siekance).toBeGreaterThan(initialSiekance);
    expect(game.backpack.findByInstanceId(testItem.instanceId)).toBeUndefined();
  });

  it('strictly restricts duplicate selling to BE ONLY an option in dialogue with a merchant', () => {
    const game = new CrpgGameState('slavic_village');
    game.backpack.clearAllSlots();

    // Walk player up to Dobromir
    game.player.tileX = 14;
    game.player.tileY = 15;
    game.player.x = 14.5;
    game.player.y = 15.5;
    expect(game.isNearMerchant()).toBe(true);

    // Equip Sunblade sword
    game.equipmentManager.equipDirectInstance(createItemInstance('weapon_sunblade_longsword', 1), 'mainHand');

    // Add duplicates of equipped sword to backpack
    const dupeSword1 = createItemInstance('weapon_sunblade_longsword', 1);
    const dupeSword2 = createItemInstance('weapon_sunblade_longsword', 1);
    game.backpack.tryAddItem(dupeSword1, true);
    game.backpack.tryAddItem(dupeSword2, true);

    const bow1 = createItemInstance('weapon_hunting_bow', 1);
    const bow2 = createItemInstance('weapon_hunting_bow', 1);
    game.backpack.tryAddItem(bow1, true);
    game.backpack.tryAddItem(bow2, true);

    const initialSiekance = game.siekance;

    // 1. Without active merchant dialogue, duplicate selling is FORBIDDEN even if standing near merchant!
    expect(game.activeDialogue).toBeNull();
    const rejectedResult = game.sellAllDuplicatesForSiekance();
    expect(rejectedResult.soldCount).toBe(0);
    expect(rejectedResult.earnedTotal).toBe(0);
    expect(game.siekance).toBe(initialSiekance);
    expect(game.logs.some((l) => l.includes('wyłącznie podczas rozmowy z kupcem'))).toBe(true);

    // 2. Now open conversation with Kupiec Dobromir -> duplicate selling is PERMITTED!
    game.startDialogueWithNpc('npc_dobromir');
    expect(game.activeDialogue).not.toBeNull();

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
  });

  it('provides EXPENSIVE high-tier wares at merchants that encourage grinding for siekańce', () => {
    // 1. Check catalogs of all merchants
    const dobromirWares = getMerchantWares('npc_dobromir');
    const boguszWares = getMerchantWares('npc_bogusz');
    const gniewoszWares = getMerchantWares('npc_gniewosz');

    expect(dobromirWares.length).toBeGreaterThanOrEqual(4);
    expect(boguszWares.length).toBeGreaterThanOrEqual(4);
    expect(gniewoszWares.length).toBeGreaterThanOrEqual(4);

    // Verify wares include prestigious items with high costs (e.g. 190 to 680 siekańców)
    const expensiveArmor = gniewoszWares.find((w) => w.id === 'torso_aethel_plate');
    expect(expensiveArmor).toBeDefined();
    expect(expensiveArmor!.priceSiekance).toBe(680);

    const expensiveKolowrot = dobromirWares.find((w) => w.id === 'trinket_kolowrot');
    expect(expensiveKolowrot).toBeDefined();
    expect(expensiveKolowrot!.priceSiekance).toBe(590);

    const expensiveCompass = boguszWares.find((w) => w.id === 'item_runic_compass');
    expect(expensiveCompass).toBeDefined();
    expect(expensiveCompass!.priceSiekance).toBe(550);

    // 2. Test purchasing mechanics: insufficient funds vs successful grind purchase
    const game = new CrpgGameState('slavic_village');
    game.player.tileX = 14;
    game.player.tileY = 15;
    game.player.x = 14.5;
    game.player.y = 15.5;

    // Player starts with modest amount (45 siek.), so buying the 590 siek. amulet must fail
    expect(game.siekance).toBeLessThan(expensiveKolowrot!.priceSiekance);
    const failBuy = game.buyItemFromMerchant('npc_dobromir', 'trinket_kolowrot');
    expect(failBuy.success).toBe(false);
    expect(failBuy.reason).toBe('insufficient_funds');
    expect(game.backpack.hasDefinitionId('trinket_kolowrot')).toBe(false);

    // Player grinds and acquires 650 siekańców
    game.siekance = 650;
    const successBuy = game.buyItemFromMerchant('npc_dobromir', 'trinket_kolowrot');
    expect(successBuy.success).toBe(true);
    expect(game.siekance).toBe(650 - expensiveKolowrot!.priceSiekance);
    expect(game.backpack.hasDefinitionId('trinket_kolowrot')).toBe(true);
  });

  it('executes duplicate selling through merchant dialogue choices for Dobromir, Bogusz and Gniewosz', () => {
    // 1. Dobromir in Slavic Village
    const village = new CrpgGameState('slavic_village');
    village.backpack.clearAllSlots();
    village.player.tileX = 14;
    village.player.tileY = 15;
    village.player.x = 14.5;
    village.player.y = 15.5;

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
    expect(forest.activeDialogue?.node.choices.some((c) => c.nextNodeId === 'bogusz_shop')).toBe(true);

    // 3. Gniewosz in Sanctum Dungeon
    const sanctum = new CrpgGameState('sanctum_dungeon');
    sanctum.startDialogueWithNpc('npc_gniewosz');
    expect(sanctum.activeDialogue).not.toBeNull();
    expect(sanctum.activeDialogue?.node.choices.some((c) => c.action === 'sell_duplicates')).toBe(true);
    expect(sanctum.activeDialogue?.node.choices.some((c) => c.nextNodeId === 'gniewosz_shop')).toBe(true);
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
