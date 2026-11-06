import { describe, expect, it } from 'vitest';
import { computeFieldOfView, FovGridState } from '../../src/core/fov';

describe('fov - Line of Sight & Fog of War Persistence', () => {
  it('marks tiles within radius as visible when unobstructed, and blocks tiles behind closed doors/walls', () => {
    let doorOpen = false;
    const isOpaque = (x: number, y: number): boolean => {
      // Vertical wall along x = 4, with a door at (4, 4)
      if (x === 4) {
        if (y === 4) return !doorOpen;
        return true;
      }
      return false;
    };

    const fov = new FovGridState(10, 10);
    computeFieldOfView(fov, 2, 4, 6, isOpaque);

    // Origin and door tile itself are visible
    expect(fov.getVisibility(2, 4)).toBe('visible');
    expect(fov.getVisibility(4, 4)).toBe('visible');
    // Tile behind closed door (6, 4) is unexplored
    expect(fov.getVisibility(6, 4)).toBe('unexplored');

    // Now open the door and recompute from (3, 4)
    doorOpen = true;
    computeFieldOfView(fov, 3, 4, 6, isOpaque);
    expect(fov.getVisibility(6, 4)).toBe('visible');

    // Close door again: (6, 4) transitions from 'visible' to 'explored' (shrouded memory)
    doorOpen = false;
    computeFieldOfView(fov, 2, 4, 6, isOpaque);
    expect(fov.getVisibility(6, 4)).toBe('explored');
  });
});
