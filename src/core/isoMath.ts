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

export type EdgePanDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface EdgePanInput {
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  marginPx: number;
  enabled: boolean;
  isPointerInside: boolean;
  isOverUi: boolean;
  forcedDirection: EdgePanDirection | null;
}

export interface EdgePanResult {
  direction: EdgePanDirection | null;
  offsetDeltaX: number;
  offsetDeltaY: number;
  strength: number;
}

const DIRECTION_VECTORS: Record<EdgePanDirection, { dx: number; dy: number }> = {
  N: { dx: 0, dy: 1 },
  NE: { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 },
  E: { dx: -1, dy: 0 },
  SE: { dx: -Math.SQRT1_2, dy: -Math.SQRT1_2 },
  S: { dx: 0, dy: -1 },
  SW: { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 },
  W: { dx: 1, dy: 0 },
  NW: { dx: Math.SQRT1_2, dy: Math.SQRT1_2 }
};

function angleToCompassDirection(nx: number, ny: number): EdgePanDirection {
  const deg = (Math.atan2(ny, nx) * 180) / Math.PI; // -180..180 (0 = E, -90 = N, 90 = S, ±180 = W)
  if (deg >= -22.5 && deg < 22.5) return 'E';
  if (deg >= 22.5 && deg < 67.5) return 'SE';
  if (deg >= 67.5 && deg < 112.5) return 'S';
  if (deg >= 112.5 && deg < 157.5) return 'SW';
  if (deg >= -67.5 && deg < -22.5) return 'NE';
  if (deg >= -112.5 && deg < -67.5) return 'N';
  if (deg >= -157.5 && deg < -112.5) return 'NW';
  return 'W';
}

/**
 * Computes progressive camera 360-degree circular ring & edge-panning vector
 * from pointer coordinates or an explicitly hovered/pressed edge arrow button.
 */
export function computeEdgePanState(input: EdgePanInput): EdgePanResult {
  if (input.forcedDirection) {
    const vec = DIRECTION_VECTORS[input.forcedDirection];
    return {
      direction: input.forcedDirection,
      offsetDeltaX: vec.dx,
      offsetDeltaY: vec.dy,
      strength: 1
    };
  }

  if (
    !input.enabled ||
    !input.isPointerInside ||
    input.viewportWidth <= 0 ||
    input.viewportHeight <= 0 ||
    input.marginPx <= 0
  ) {
    return { direction: null, offsetDeltaX: 0, offsetDeltaY: 0, strength: 0 };
  }

  if (
    input.pointerX < 0 ||
    input.pointerX > input.viewportWidth ||
    input.pointerY < 0 ||
    input.pointerY > input.viewportHeight
  ) {
    return { direction: null, offsetDeltaX: 0, offsetDeltaY: 0, strength: 0 };
  }

  const outerRimPx = Math.min(28, input.marginPx * 0.45);
  const inOuterRim =
    input.pointerX <= outerRimPx ||
    input.pointerX >= input.viewportWidth - outerRimPx ||
    input.pointerY <= outerRimPx ||
    input.pointerY >= input.viewportHeight - outerRimPx;

  if (input.isOverUi && !inOuterRim) {
    return { direction: null, offsetDeltaX: 0, offsetDeltaY: 0, strength: 0 };
  }

  const cx = input.viewportWidth * 0.5;
  const cy = input.viewportHeight * 0.5;
  const nx = (input.pointerX - cx) / Math.max(1, cx); // -1 (West) .. +1 (East)
  const ny = (input.pointerY - cy) / Math.max(1, cy); // -1 (North) .. +1 (South)
  const radialDist = Math.hypot(nx, ny);

  const m = input.marginPx;
  let edgeProgressX = 0;
  let edgeProgressY = 0;

  if (input.pointerX < m) {
    edgeProgressX = 1 - input.pointerX / m;
  } else if (input.pointerX > input.viewportWidth - m) {
    edgeProgressX = 1 - (input.viewportWidth - input.pointerX) / m;
  }

  if (input.pointerY < m) {
    edgeProgressY = 1 - input.pointerY / m;
  } else if (input.pointerY > input.viewportHeight - m) {
    edgeProgressY = 1 - (input.viewportHeight - input.pointerY) / m;
  }

  const edgeProgress = Math.max(edgeProgressX, edgeProgressY);

  // Elliptical / circular ring threshold around the entire screen
  const minHalfDim = Math.min(cx, cy);
  const ringThreshold = Math.max(0.68, 1 - (m * 1.45) / Math.max(1, minHalfDim));
  const radialProgress =
    radialDist > ringThreshold
      ? Math.min(1, (radialDist - ringThreshold) / Math.max(0.12, 1.08 - ringThreshold))
      : 0;

  const combinedProgress = Math.max(edgeProgress, radialProgress);
  if (combinedProgress <= 0.001 || radialDist <= 0.001) {
    return { direction: null, offsetDeltaX: 0, offsetDeltaY: 0, strength: 0 };
  }

  // Smooth progressive ramp (gentle at inner ring boundary, full speed at outer edge)
  const smoothRamp = 0.22 + 0.78 * Math.pow(combinedProgress, 1.25);
  const strength = Math.min(1, Number(smoothRamp.toFixed(4)));

  // Continuous 360-degree radial camera movement vector toward cursor
  const unitX = -nx / radialDist;
  const unitY = -ny / radialDist;
  const offsetDeltaX = unitX * strength;
  const offsetDeltaY = unitY * strength;
  const direction = angleToCompassDirection(nx, ny);

  return {
    direction,
    offsetDeltaX,
    offsetDeltaY,
    strength
  };
}
