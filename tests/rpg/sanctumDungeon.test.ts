import { describe, expect, it } from 'vitest';
import { createSanctumWorldMap } from '../../src/core/worldMap';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('Sanctum Dungeon Test Location ("Lochy i Jaskinie Aethelgardu")', () => {
  it('creates a 36x36 multi-zone dungeon crawler map with Upper Caverns, Catacombs, and Inner Sanctum', () => {
    const map = createSanctumWorldMap();
    expect(map.id).toBe('sanctum_dungeon');
    expect(map.width).toBe(36);
    expect(map.height).toBe(36);

    const doors = map.props.filter((p) => p.kind === 'door');
    const chests = map.props.filter((p) => p.kind === 'chest');
    const barrels = map.props.filter((p) => p.kind === 'dungeon_barrel');
    const crates = map.props.filter((p) => p.kind === 'dungeon_crate');
    const tables = map.props.filter((p) => p.kind === 'dungeon_table');
    const supports = map.props.filter((p) => p.kind === 'dungeon_support');
    const pillars = map.props.filter((p) => p.kind === 'pillar');
    const altars = map.props.filter((p) => p.kind === 'runic_altar');
    const sarcophagi = map.props.filter((p) => p.kind === 'sarcophagus');
    const crystals = map.props.filter((p) => p.kind === 'arcane_crystal');
    const signposts = map.props.filter((p) => p.kind === 'travel_signpost');

    expect(doors.length).toBeGreaterThanOrEqual(3);
    expect(chests.length).toBeGreaterThanOrEqual(3);
    expect(barrels.length).toBeGreaterThanOrEqual(4);
    expect(crates.length).toBeGreaterThanOrEqual(3);
    expect(tables.length).toBeGreaterThanOrEqual(2);
    expect(supports.length).toBeGreaterThanOrEqual(6);
    expect(pillars.length).toBeGreaterThanOrEqual(10);
    expect(altars.length).toBeGreaterThanOrEqual(1);
    expect(sarcophagi.length).toBeGreaterThanOrEqual(3);
    expect(crystals.length).toBeGreaterThanOrEqual(3);
    expect(signposts.length).toBeGreaterThanOrEqual(2);
  });

  it('populates enemies with an ascending difficulty progression: 4 easy enemies -> 3 normal enemies -> 1 hard boss', () => {
    const game = new CrpgGameState('sanctum_dungeon');
    expect(game.map.id).toBe('sanctum_dungeon');

    const enemies = game.npcs.filter((n) => n.combat?.isHostile);
    expect(enemies.length).toBe(8);

    // 4 Easy enemies in Upper Caverns
    const easyEnemies = enemies.filter((e) => e.combat?.difficulty === 'easy');
    expect(easyEnemies.length).toBe(4);
    for (const e of easyEnemies) {
      expect(e.combat?.hp).toBeLessThanOrEqual(50);
      expect(e.combat?.difficultyLabel).toContain('ŁATWY');
    }

    // 3 Normal enemies in Middle Catacombs
    const normalEnemies = enemies.filter((e) => e.combat?.difficulty === 'normal');
    expect(normalEnemies.length).toBe(3);
    for (const e of normalEnemies) {
      expect(e.combat?.hp).toBeGreaterThanOrEqual(65);
      expect(e.combat?.hp).toBeLessThanOrEqual(85);
      expect(e.combat?.difficultyLabel).toContain('ŚREDNI');
    }

    // 1 Very Hard Boss in Inner Sanctum
    const boss = enemies.find((e) => e.combat?.difficulty === 'very_hard');
    expect(boss).toBeDefined();
    expect(boss?.id).toBe('dungeon_boss_champion');
    expect(boss?.combat?.hp).toBe(220);
    expect(boss?.combat?.maxHp).toBe(220);
    expect(boss?.combat?.difficultyLabel).toContain('BOSS LOCHÓW');
    expect(boss?.recipe.equipment.mainHand).toBe('weapon_Executioner_axe');

    // Friendly Merchant
    const merchant = game.npcs.find((n) => n.id === 'npc_gniewosz');
    expect(merchant).toBeDefined();
    expect(merchant?.isMerchant).toBe(true);
  });

  it('supports opening and searching dungeon barrels, crates, and chests', () => {
    const game = new CrpgGameState('sanctum_dungeon');

    const barrel = game.map.props.find((p) => p.kind === 'dungeon_barrel');
    expect(barrel).toBeDefined();
    if (barrel) {
      expect(barrel.isOpen).toBeFalsy();
      game.togglePropInteraction(barrel.id);
      expect(barrel.isOpen).toBe(true);
      expect(game.logs[0]).toContain('Przeszukano');
    }

    const crate = game.map.props.find((p) => p.kind === 'dungeon_crate');
    expect(crate).toBeDefined();
    if (crate) {
      expect(crate.isOpen).toBeFalsy();
      game.togglePropInteraction(crate.id);
      expect(crate.isOpen).toBe(true);
      expect(game.logs[0]).toContain('Przeszukano');
    }

    const bossChest = game.map.props.find((p) => p.id === 'chest_sanctum_vault');
    expect(bossChest).toBeDefined();
    if (bossChest) {
      expect(bossChest.isOpen).toBe(false);
      game.togglePropInteraction(bossChest.id);
      expect(bossChest.isOpen).toBe(true);
      expect(game.backpack.hasDefinitionId('weapon_Executioner_axe')).toBe(true);
    }
  });

  it('allows seamless travel between all 3 test maps via travel signposts', () => {
    const game = new CrpgGameState('forest_clearing');
    expect(game.map.id).toBe('forest_clearing');

    // Travel to Dungeon from Polana
    const dungeonSignFromClearing = game.map.props.find((p) => p.id === 'signpost_to_dungeon');
    expect(dungeonSignFromClearing).toBeDefined();
    if (dungeonSignFromClearing) {
      game.togglePropInteraction(dungeonSignFromClearing.id);
      expect(game.map.id).toBe('sanctum_dungeon');
    }

    // Travel back to Slavic Village from Dungeon
    const villageSignFromDungeon = game.map.props.find(
      (p) => p.id === 'signpost_to_slavic_village'
    );
    expect(villageSignFromDungeon).toBeDefined();
    if (villageSignFromDungeon) {
      game.togglePropInteraction(villageSignFromDungeon.id);
      expect(game.map.id).toBe('slavic_village');
    }

    // Travel back to Forest Clearing from Slavic Village
    const clearingSignFromVillage = game.map.props.find(
      (p) => p.id === 'signpost_to_forest_clearing'
    );
    expect(clearingSignFromVillage).toBeDefined();
    if (clearingSignFromVillage) {
      game.togglePropInteraction(clearingSignFromVillage.id);
      expect(game.map.id).toBe('forest_clearing');
    }
  });
});
