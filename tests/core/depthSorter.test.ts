import { describe, expect, it } from 'vitest';
import {
  DepthBox3D,
  shouldApplyWallCutaway,
  sortEntitiesTopological
} from '../../src/core/depthSorter';

describe('depthSorter - Topological Painter DAG & Wall Cutaway ("Woes of Isometry")', () => {
  it('orders single-tile entities from back (smaller rx+ry) to front (larger rx+ry)', () => {
    const front: DepthBox3D = {
      id: 'front',
      rxMin: 5,
      rxMax: 6,
      ryMin: 5,
      ryMax: 6,
      zMin: 0,
      zMax: 2
    };
    const back: DepthBox3D = {
      id: 'back',
      rxMin: 2,
      rxMax: 3,
      ryMin: 2,
      ryMax: 3,
      zMin: 0,
      zMax: 2
    };

    const sorted = sortEntitiesTopological([front, back]);
    expect(sorted.map((e) => e.id)).toEqual(['back', 'front']);
  });

  it('correctly sorts a character standing in front of or behind a 3x1 multi-tile wall/table', () => {
    // Long table occupying rx: [2..5], ry: [4..5]
    const longTable: DepthBox3D = {
      id: 'table_3x1',
      rxMin: 2,
      rxMax: 5,
      ryMin: 4,
      ryMax: 5,
      zMin: 0,
      zMax: 1.5
    };
    // Character behind the right end of the table: rx: [4.2..4.8], ry: [3.1..3.7]
    // Notice rx+ry for character is ~7.5, while table's origin rx+ry is 2+4=6!
    // Naive origin sorting (6 < 7.5) would draw the character AFTER (in front of) the table, which is a classic "Woes of Isometry" bug!
    const charBehindRightEnd: DepthBox3D = {
      id: 'char_behind',
      rxMin: 4.2,
      rxMax: 4.8,
      ryMin: 3.1,
      ryMax: 3.7,
      zMin: 0,
      zMax: 2
    };
    // Character in front of the left end of the table: rx: [2.2..2.8], ry: [5.1..5.7]
    const charInFrontLeftEnd: DepthBox3D = {
      id: 'char_front',
      rxMin: 2.2,
      rxMax: 2.8,
      ryMin: 5.1,
      ryMax: 5.7,
      zMin: 0,
      zMax: 2
    };

    const sorted = sortEntitiesTopological([charInFrontLeftEnd, longTable, charBehindRightEnd]);
    expect(sorted.map((e) => e.id)).toEqual(['char_behind', 'table_3x1', 'char_front']);
  });

  it('draws lower Z floor/platform before character standing on top of it', () => {
    const characterOnPlatform: DepthBox3D = {
      id: 'hero',
      rxMin: 4.2,
      rxMax: 4.8,
      ryMin: 4.2,
      ryMax: 4.8,
      zMin: 2,
      zMax: 4
    };
    const raisedPlatform: DepthBox3D = {
      id: 'platform',
      rxMin: 4,
      rxMax: 5,
      ryMin: 4,
      ryMax: 5,
      zMin: 0,
      zMax: 2
    };

    const sorted = sortEntitiesTopological([characterOnPlatform, raisedPlatform]);
    expect(sorted.map((e) => e.id)).toEqual(['platform', 'hero']);
  });

  it('detects when a tall wall in front of the player should trigger X-ray cutaway', () => {
    const tallWall: DepthBox3D = {
      id: 'wall_front',
      rxMin: 5,
      rxMax: 6,
      ryMin: 5,
      ryMax: 6,
      zMin: 0,
      zMax: 3,
      occludesVision: true
    };
    const playerBehind: DepthBox3D = {
      id: 'player',
      rxMin: 4.2,
      rxMax: 4.8,
      ryMin: 4.2,
      ryMax: 4.8,
      zMin: 0,
      zMax: 2
    };

    expect(shouldApplyWallCutaway(tallWall, playerBehind)).toBe(true);
    // If player is in front of the wall, wall should NOT be cut away
    expect(shouldApplyWallCutaway(playerBehind, tallWall)).toBe(false);
  });
});
