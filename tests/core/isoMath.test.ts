import { describe, expect, it } from 'vitest';
import {
  ELEVATION_STEP_PX,
  TILE_HEIGHT,
  TILE_WIDTH,
  gridToScreen,
  pickGridTileAtScreen,
  screenToGridFlat
} from '../../src/core/isoMath';

describe('isoMath - 2:1 Isometric Projection & Elevation Raycasting', () => {
  it('projects origin (0,0,0) to screen (0,0)', () => {
    const pt = gridToScreen(0, 0, 0);
    expect(pt.x).toBe(0);
    expect(pt.y).toBe(0);
  });

  it('projects (1,0,0) and (0,1,0) using true 2:1 diamond offsets', () => {
    const right = gridToScreen(1, 0, 0);
    expect(right.x).toBe(TILE_WIDTH / 2);
    expect(right.y).toBe(TILE_HEIGHT / 2);

    const left = gridToScreen(0, 1, 0);
    expect(left.x).toBe(-TILE_WIDTH / 2);
    expect(left.y).toBe(TILE_HEIGHT / 2);
  });

  it('shifts screen Y upward by ELEVATION_STEP_PX per Z unit', () => {
    const base = gridToScreen(3, 2, 0);
    const elevated = gridToScreen(3, 2, 2);
    expect(elevated.x).toBe(base.x);
    expect(elevated.y).toBe(base.y - 2 * ELEVATION_STEP_PX);
  });

  it('inverts flat screen coordinates accurately back to fractional grid coords', () => {
    const s = gridToScreen(4.25, 7.5, 0);
    const g = screenToGridFlat(s.x, s.y, 0);
    expect(g.rx).toBeCloseTo(4.25, 5);
    expect(g.ry).toBeCloseTo(7.5, 5);
  });

  it('picks elevated tile before ground tile behind it via elevation raycasting', () => {
    // Tile (4,4) is elevated to Z=2, while (3,3) is at Z=0.
    // The screen center of (4,4,Z=2) shifts up by 48px, overlapping where (3,3,Z=0) would be on a flat plane!
    const getElevation = (rx: number, ry: number): number => {
      if (rx === 4 && ry === 4) return 2;
      return 0;
    };
    const targetScreen = gridToScreen(4.5, 4.5, 2);
    const picked = pickGridTileAtScreen(targetScreen.x, targetScreen.y, 10, 10, 3, getElevation);
    expect(picked).toEqual({ rx: 4, ry: 4, z: 2 });
  });
});
