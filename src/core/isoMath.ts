export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;
export const ELEVATION_STEP_PX = 24;

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface RotatedGridPoint {
  rx: number;
  ry: number;
}

export interface PickedTileResult {
  rx: number;
  ry: number;
  z: number;
}

/**
 * Projects rotated isometric grid coordinates (rx, ry) and elevation z
 * into 2D screen space using a 2:1 diamond isometric projection.
 */
export function gridToScreen(rx: number, ry: number, z = 0): ScreenPoint {
  const halfW = TILE_WIDTH * 0.5;
  const halfH = TILE_HEIGHT * 0.5;
  return {
    x: (rx - ry) * halfW,
    y: (rx + ry) * halfH - z * ELEVATION_STEP_PX
  };
}

/**
 * Inverts screen coordinates (sx, sy) back to fractional rotated grid coordinates
 * assuming a plane at fixed elevation z.
 */
export function screenToGridFlat(sx: number, sy: number, z = 0): RotatedGridPoint {
  const halfW = TILE_WIDTH * 0.5;
  const halfH = TILE_HEIGHT * 0.5;
  const adjustedY = sy + z * ELEVATION_STEP_PX;
  const rx = (sx / halfW + adjustedY / halfH) * 0.5;
  const ry = (adjustedY / halfH - sx / halfW) * 0.5;
  return { rx, ry };
}

/**
 * Elevation-aware raycaster for mouse picking on a 2.5D multi-elevation isometric grid.
 * Tests candidate elevation planes from maxElevation down to 0 so raised tiles
 * properly occlude lower tiles behind them.
 */
export function pickGridTileAtScreen(
  sx: number,
  sy: number,
  rotatedWidth: number,
  rotatedHeight: number,
  maxElevation: number,
  getTileElevationAtRotated: (rx: number, ry: number) => number
): PickedTileResult | null {
  for (let testZ = maxElevation; testZ >= 0; testZ--) {
    const frac = screenToGridFlat(sx, sy, testZ);
    const tileRx = Math.floor(frac.rx);
    const tileRy = Math.floor(frac.ry);

    if (tileRx >= 0 && tileRx < rotatedWidth && tileRy >= 0 && tileRy < rotatedHeight) {
      const actualZ = getTileElevationAtRotated(tileRx, tileRy);
      if (actualZ === testZ) {
        return { rx: tileRx, ry: tileRy, z: actualZ };
      }
    }
  }

  // Fallback check if cursor hits the vertical cliff face of a raised tile
  const ground = screenToGridFlat(sx, sy, 0);
  const grx = Math.floor(ground.rx);
  const gry = Math.floor(ground.ry);
  if (grx >= 0 && grx < rotatedWidth && gry >= 0 && gry < rotatedHeight) {
    return {
      rx: grx,
      ry: gry,
      z: getTileElevationAtRotated(grx, gry)
    };
  }

  return null;
}
