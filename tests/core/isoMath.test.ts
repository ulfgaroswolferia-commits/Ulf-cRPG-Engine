import { describe, expect, it } from 'vitest';
import {
  ELEVATION_STEP_PX,
  TILE_HEIGHT,
  TILE_WIDTH,
  computeEdgePanState,
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

  it('returns inactive edge pan when pointer is in the center of the screen', () => {
    const res = computeEdgePanState({
      pointerX: 640,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 48,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    });
    expect(res.direction).toBeNull();
    expect(res.offsetDeltaX).toBe(0);
    expect(res.offsetDeltaY).toBe(0);
    expect(res.strength).toBe(0);
  });

  it('computes progressive edge pan near cardinal edges and diagonal corners', () => {
    // Near left edge (W): cameraOffsetX should increase (> 0)
    const westHalf = computeEdgePanState({
      pointerX: 24,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 48,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    });
    const westEdge = computeEdgePanState({
      pointerX: 2,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 48,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    });
    expect(westHalf.direction).toBe('W');
    expect(westHalf.offsetDeltaX).toBeGreaterThan(0);
    expect(westEdge.offsetDeltaX).toBeGreaterThan(westHalf.offsetDeltaX);

    // Top-right corner (NE): cameraOffsetX < 0, cameraOffsetY > 0
    const northEast = computeEdgePanState({
      pointerX: 1272,
      pointerY: 6,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 48,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    });
    expect(northEast.direction).toBe('NE');
    expect(northEast.offsetDeltaX).toBeLessThan(0);
    expect(northEast.offsetDeltaY).toBeGreaterThan(0);
  });

  it('suppresses automatic edge pan when hovering UI panels in inner margin, but allows outer-rim edge pan and forced arrows', () => {
    // Inner margin (x = 36, marginPx = 56): blocked when over UI panel so panel buttons remain clickable
    const blockedByUiInner = computeEdgePanState({
      pointerX: 36,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 56,
      enabled: true,
      isPointerInside: true,
      isOverUi: true,
      forcedDirection: null
    });
    expect(blockedByUiInner.direction).toBeNull();
    expect(blockedByUiInner.offsetDeltaX).toBe(0);

    // Outer rim (x = 12, marginPx = 56): pans even if a side panel extends near the border
    const outerRimOverUi = computeEdgePanState({
      pointerX: 12,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 56,
      enabled: true,
      isPointerInside: true,
      isOverUi: true,
      forcedDirection: null
    });
    expect(outerRimOverUi.direction).toBe('W');
    expect(outerRimOverUi.offsetDeltaX).toBeGreaterThan(0);

    const forcedArrow = computeEdgePanState({
      pointerX: 8,
      pointerY: 360,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 56,
      enabled: false,
      isPointerInside: true,
      isOverUi: true,
      forcedDirection: 'SE'
    });
    expect(forcedArrow.direction).toBe('SE');
    expect(forcedArrow.offsetDeltaX).toBeLessThan(0);
    expect(forcedArrow.offsetDeltaY).toBeLessThan(0);
    expect(forcedArrow.strength).toBe(1);
  });

  it('activates smooth 360-degree circular ring panning around the entire screen perimeter', () => {
    // A point in the upper-left circular ring sector (e.g. x=150, y=105 on 1280x720)
    // is outside the old 48px rectangular strip (150 > 48 and 105 > 48),
    // but lies in the outer elliptical ring of the screen!
    const ringNW = computeEdgePanState({
      pointerX: 150,
      pointerY: 105,
      viewportWidth: 1280,
      viewportHeight: 720,
      marginPx: 90,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    });
    expect(ringNW.direction).toBe('NW');
    expect(ringNW.offsetDeltaX).toBeGreaterThan(0);
    expect(ringNW.offsetDeltaY).toBeGreaterThan(0);
    expect(ringNW.strength).toBeGreaterThan(0);
  });
});
