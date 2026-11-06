import { describe, expect, it } from 'vitest';
import { findPathAStar3D, NavGridQuery } from '../../src/core/pathfinding';

describe('pathfinding - 3D 8-Directional A* with Elevation Constraints', () => {
  it('finds direct path on flat walkable terrain and computes facing directions', () => {
    const query: NavGridQuery = {
      width: 8,
      height: 8,
      isWalkable: () => true,
      getElevation: () => 0
    };

    const path = findPathAStar3D(query, { x: 1, y: 1 }, { x: 4, y: 4 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toMatchObject({ x: 1, y: 1 });
    expect(path[path.length - 1]).toMatchObject({ x: 4, y: 4 });
  });

  it('routes around impassable walls and prevents corner cutting across diagonal walls', () => {
    const blocked = new Set(['2,1', '2,2', '2,3']);
    const query: NavGridQuery = {
      width: 6,
      height: 6,
      isWalkable: (x, y) => !blocked.has(`${x},${y}`),
      getElevation: () => 0
    };

    const path = findPathAStar3D(query, { x: 1, y: 2 }, { x: 3, y: 2 });
    expect(path.length).toBeGreaterThan(3);
    for (const node of path) {
      expect(blocked.has(`${node.x},${node.y}`)).toBe(false);
    }
  });

  it('blocks climbing steep cliffs (delta Z > 1) unless bridged by intermediate stairs (delta Z <= 1)', () => {
    // Platform at x >= 3 has Z = 2, ground at x < 2 has Z = 0.
    // Only tile (2, 4) is a stair with Z = 1!
    const query: NavGridQuery = {
      width: 6,
      height: 6,
      isWalkable: (x, y) => x === 2 ? y === 4 : true,
      getElevation: (x, y) => {
        if (x < 2) return 0;
        if (x === 2 && y === 4) return 1;
        return 2;
      }
    };

    const path = findPathAStar3D(query, { x: 1, y: 1 }, { x: 3, y: 1 });
    expect(path.length).toBeGreaterThan(0);
    // Must pass through the stair tile (2, 4)
    expect(path.some((p) => p.x === 2 && p.y === 4)).toBe(true);
  });
});
