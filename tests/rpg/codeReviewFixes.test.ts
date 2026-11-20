import { describe, expect, it } from 'vitest';
import { createSanctumWorldMap } from '../../src/core/worldMap';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { getItemDefinition } from '../../src/rpg/inventorySystem';
import { deserializeGameState, serializeGameState } from '../../src/rpg/saveSystem';
import { determineActionCursor } from '../../src/ui/cursorManager';
import { HudOverlay } from '../../src/ui/hudOverlay';

describe('Code Review Bug Fixes Verification', () => {
  it('defines item_healing_salve in EQUIPMENT_CATALOG and verifies all dungeon loot items exist', () => {
    const salveDef = getItemDefinition('item_healing_salve');
    expect(salveDef).toBeDefined();
    expect(salveDef?.name).toContain('Maść Żywokostowa');

    const dungeon = createSanctumWorldMap();
    for (const prop of dungeon.props) {
      if (prop.lootItems) {
        for (const itemId of prop.lootItems) {
          expect(getItemDefinition(itemId), `Missing item definition for ${itemId}`).toBeDefined();
        }
      }
    }
  });

  it('allows looting sarcophagus props and shows loot cursor when hovered', () => {
    const game = new CrpgGameState('slavic_village');
    const sarcophagus = game.map.props.find((p) => p.id === 'prop_kurhan_sarcophagus');
    expect(sarcophagus).toBeDefined();
    if (!sarcophagus) return;

    const cursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: sarcophagus.x, y: sarcophagus.y, z: sarcophagus.z },
      isTileWalkable: false,
      hoveredNpc: null,
      hoveredProp: {
        id: sarcophagus.id,
        kind: sarcophagus.kind,
        interactive: true,
        isOpen: false,
        lootItems: sarcophagus.lootItems
      },
      activeTool: 'interact'
    });
    expect(cursor).toBe('loot');

    // Position player adjacent to the second tile of the 1x2 sarcophagus (prop.x, prop.y + 2)
    game.player.tileX = sarcophagus.x;
    game.player.tileY = sarcophagus.y + 2;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;

    game.commandInteractWithProp(sarcophagus.id);
    expect(sarcophagus.isOpen).toBe(true);
    expect(game.backpack.hasDefinitionId('torso_aethel_plate')).toBe(true);
  });

  it('unlocks door_watchtower when Captain Vaelen dialogue choice unlocksDoorId is triggered', () => {
    const game = new CrpgGameState('forest_clearing');
    const door = game.map.props.find((p) => p.id === 'door_watchtower');
    expect(door?.isOpen).toBe(false);

    game.startDialogueWithNpc('npc_vaelen');
    const loreChoice = game.activeDialogue?.node.choices.find((c) => c.id === 'c_lore');
    expect(loreChoice).toBeDefined();
    if (loreChoice) {
      game.selectDialogueChoice(loreChoice);
    }
    expect(door?.isOpen).toBe(true);
  });

  it('prevents combat soft-lock when deserializing a save made during an enemy turn', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.combat?.isHostile && n.combat?.isAlive);
    expect(enemy).toBeDefined();
    if (!enemy) return;

    game.startCombatWithEnemy(enemy.id);
    // Simulate mid-enemy turn state
    game.combatState.activeTurnActorId = enemy.id;

    const serialized = serializeGameState(game);
    const reloadedGame = new CrpgGameState('forest_clearing');
    const ok = deserializeGameState(serialized, reloadedGame);

    expect(ok).toBe(true);
    expect(reloadedGame.combatState.active).toBe(true);
    expect(reloadedGame.combatState.activeTurnActorId).toBe(reloadedGame.player.id);
  });

  it('toggles stealth on [C] in HudOverlay without triggering centerCameraOnPlayer', () => {
    const game = new CrpgGameState('forest_clearing');
    let centerCalled = 0;
    const fakeScene = {
      rotation: 0,
      fps: 60,
      lastBakeDurationMs: 0,
      hoveredWorldTile: null,
      activeTool: 'interact',
      editorBrushSize: 1,
      forcedEdgeDirection: null,
      centerCameraOnPlayer: () => {
        centerCalled++;
      },
      getCharacterTextures: () => ({ portraitDataUrl: '' })
    } as any;
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, fakeScene);
    expect(game.isStealthActive).toBe(false);

    hud.handleGlobalKey({ key: 'c' });
    expect(game.isStealthActive).toBe(true);
    expect(centerCalled).toBe(0);
  });
});
