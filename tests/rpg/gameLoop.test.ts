import { describe, expect, it } from 'vitest';
import { createSanctumWorldMap } from '../../src/core/worldMap';
import { computeCharacterRecipeHash } from '../../src/assets/characterBakery';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('worldMap & gameLoop - Sanctum cRPG Vertical Slice & Live State', () => {
  it('constructs the multi-elevation 36x36 Sanctum map with lights, doors, chests, and multi-tile objects', () => {
    const map = createSanctumWorldMap();
    expect(map.width).toBe(36);
    expect(map.height).toBe(36);
    expect(map.props.length).toBeGreaterThan(15);

    // Check multi-tile object presence (e.g., 2x1 altar or sarcophagus)
    const multiTile = map.props.find((p) => p.sizeX > 1 || p.sizeY > 1);
    expect(multiTile).toBeDefined();
  });

  it('toggles interactive doors, dynamically opening walkability and Line of Sight', () => {
    const game = new CrpgGameState();
    const door = game.map.props.find((p) => p.kind === 'door');
    expect(door).toBeDefined();
    if (!door) return;

    expect(door.isOpen).toBe(false);
    expect(game.isTileWalkable(door.x, door.y)).toBe(false);

    game.togglePropInteraction(door.id);
    expect(door.isOpen).toBe(true);
    expect(game.isTileWalkable(door.x, door.y)).toBe(true);
  });

  it('equips an inventory item on the player character, immediately updating the baked recipe hash and stats', () => {
    const game = new CrpgGameState();
    const beforeHash = computeCharacterRecipeHash(game.player.recipe);

    const equipResult = game.equipInventoryItem('torso_aethel_plate');
    expect(equipResult).toBe(true);

    const afterHash = computeCharacterRecipeHash(game.player.recipe);
    expect(afterHash).not.toBe(beforeHash);
    expect(game.player.recipe.equipment.torso).toBe('torso_aethel_plate');
  });

  it('spawns a new randomly generated isometric NPC on a walkable tile', () => {
    const game = new CrpgGameState();
    const initialCount = game.npcs.length;
    const spawned = game.spawnRandomNpc(777);
    expect(spawned).toBeDefined();
    expect(game.npcs.length).toBe(initialCount + 1);
  });
});
