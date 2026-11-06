import { describe, expect, it } from 'vitest';
import {
  CameraRotation,
  rotateDirection8,
  rotateFootprint,
  rotateNormalXY,
  toRotatedGrid,
  toWorldGrid
} from '../../src/core/mapRotation';

describe('mapRotation - 4-Way 2.5D Isometric Map & Multi-Tile Rotation', () => {
  const W = 12;
  const H = 10;

  it('keeps coordinates unchanged at rotation 0 (N)', () => {
    expect(toRotatedGrid(3, 7, W, H, 0)).toEqual({ rx: 3, ry: 7 });
    expect(toWorldGrid(3, 7, W, H, 0)).toEqual({ x: 3, y: 7 });
  });

  it('forms a strict bijection between toRotatedGrid and toWorldGrid for all 4 angles', () => {
    const rotations: CameraRotation[] = [0, 1, 2, 3];
    for (const r of rotations) {
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) {
          const { rx, ry } = toRotatedGrid(x, y, W, H, r);
          const back = toWorldGrid(rx, ry, W, H, r);
          expect(back).toEqual({ x, y });
        }
      }
    }
  });

  it('rotates a 2x1 multi-tile object footprint into 1x2 at 90° and recalculates top-back anchor', () => {
    // Object at (2, 3) with size (2, 1) occupies tiles (2,3) and (3,3)
    const fp0 = rotateFootprint(2, 3, 2, 1, 8, 8, 0);
    expect(fp0).toEqual({ rx: 2, ry: 3, width: 2, height: 1 });

    // At 90° CW on an 8x8 map:
    // (2,3) -> (8-1-3, 2) = (4, 2)
    // (3,3) -> (8-1-3, 3) = (4, 3)
    // Bounding box starts at (4, 2) with width 1, height 2
    const fp1 = rotateFootprint(2, 3, 2, 1, 8, 8, 1);
    expect(fp1).toEqual({ rx: 4, ry: 2, width: 1, height: 2 });

    // At 180° on an 8x8 map:
    // (2,3) -> (5, 4), (3,3) -> (4, 4) -> anchor is (4, 4), size 2x1
    const fp2 = rotateFootprint(2, 3, 2, 1, 8, 8, 2);
    expect(fp2).toEqual({ rx: 4, ry: 4, width: 2, height: 1 });
  });

  it('shifts 8-directional facing by 2 steps per 90° camera rotation', () => {
    expect(rotateDirection8(0, 1)).toBe(2);
    expect(rotateDirection8(6, 2)).toBe(2);
    expect(rotateDirection8(1, 3)).toBe(7);
  });

  it('rotates tangent-space XY normal vector to keep lighting coherent across camera rotations', () => {
    const n0 = rotateNormalXY(1, 0, 0);
    expect(n0.nx).toBeCloseTo(1, 5);
    expect(n0.ny).toBeCloseTo(0, 5);

    const n2 = rotateNormalXY(1, 0, 2);
    expect(n2.nx).toBeCloseTo(-1, 5);
    expect(n2.ny).toBeCloseTo(0, 5);
  });
});
