import { describe, expect, it } from 'vitest';
import {
  ActionCursorType,
  determineActionCursor,
  getCursorCss
} from '../../src/ui/cursorManager';

describe('cursorManager - Contextual cRPG Action Mouse Cursors', () => {
  it('returns valid CSS cursor strings with data URIs for all action types', () => {
    const types: ActionCursorType[] = [
      'default',
      'move',
      'blocked',
      'talk',
      'attack',
      'loot',
      'interact'
    ];

    for (const t of types) {
      const css = getCursorCss(t);
      expect(css).toContain('url("data:image/svg+xml');
      expect(css).toMatch(/,\s*(auto|crosshair|pointer|default|not-allowed)$/);
    }
  });

  it('selects attack cursor when hovering an alive hostile NPC', () => {
    const cursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 10, y: 12, z: 0 },
      isTileWalkable: true,
      hoveredNpc: {
        id: 'wolf_1',
        isAlive: true,
        isHostile: true
      },
      hoveredProp: null,
      activeTool: 'interact'
    });

    expect(cursor).toBe('attack');
  });

  it('selects talk cursor when hovering an alive friendly or story NPC', () => {
    const cursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 5, y: 7, z: 0 },
      isTileWalkable: true,
      hoveredNpc: {
        id: 'npc_herbalist',
        isAlive: true,
        isHostile: false,
        hasDialogue: true
      },
      hoveredProp: null,
      activeTool: 'interact'
    });

    expect(cursor).toBe('talk');
  });

  it('selects loot cursor when hovering an unlooted dead corpse', () => {
    const cursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 5, y: 7, z: 0 },
      isTileWalkable: true,
      hoveredNpc: {
        id: 'dead_brigand',
        isAlive: false,
        isHostile: false,
        isLooted: false
      },
      hoveredProp: null,
      activeTool: 'interact'
    });

    expect(cursor).toBe('loot');
  });

  it('selects loot cursor when hovering loot containers or ground loot', () => {
    const cursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 8, y: 9, z: 0 },
      isTileWalkable: true,
      hoveredNpc: null,
      hoveredProp: {
        id: 'loot_pouch',
        kind: 'ground_loot',
        interactive: true,
        isOpen: false
      },
      activeTool: 'interact'
    });

    expect(cursor).toBe('loot');
  });

  it('selects interact cursor when hovering doors, exits, portals, or fixtures', () => {
    const doorCursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 14, y: 16, z: 0 },
      isTileWalkable: false,
      hoveredNpc: null,
      hoveredProp: {
        id: 'wooden_door',
        kind: 'door',
        interactive: true,
        isOpen: false
      },
      activeTool: 'interact'
    });
    expect(doorCursor).toBe('interact');

    const exitCursor = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 2, y: 3, z: 0 },
      isTileWalkable: true,
      hoveredNpc: null,
      hoveredProp: {
        id: 'portal_exit',
        kind: 'exit_path',
        interactive: true
      },
      activeTool: 'interact'
    });
    expect(exitCursor).toBe('interact');
  });

  it('selects move cursor on empty walkable ground, and blocked on unwalkable tiles', () => {
    const walkable = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 10, y: 10, z: 0 },
      isTileWalkable: true,
      hoveredNpc: null,
      hoveredProp: null,
      activeTool: 'interact'
    });
    expect(walkable).toBe('move');

    const blocked = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 0, y: 0, z: 0 },
      isTileWalkable: false,
      hoveredNpc: null,
      hoveredProp: null,
      activeTool: 'interact'
    });
    expect(blocked).toBe('blocked');
  });

  it('returns default cursor when not hovering any tile or when in level editor mode', () => {
    const noTile = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: null,
      isTileWalkable: false,
      hoveredNpc: null,
      hoveredProp: null,
      activeTool: 'interact'
    });
    expect(noTile).toBe('default');

    const editorPaint = determineActionCursor({
      hasActiveEdgePan: false,
      hoveredWorldTile: { x: 5, y: 5, z: 0 },
      isTileWalkable: true,
      hoveredNpc: null,
      hoveredProp: null,
      activeTool: 'paint_terrain'
    });
    expect(editorPaint).toBe('default');
  });
});
