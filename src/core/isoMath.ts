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
 * Computes cRPG-standard edge-panning camera vector from pointer coordinates
 * or an explicitly hovered/pressed edge arrow button.
 *
 * Follows classic isometric cRPG UX (Baldur's Gate, Pillars of Eternity, Pathfinder, Divinity):
 * - Triggers strictly within a tight strip (`marginPx`, typically ~20–28px) along viewport edges.
 * - Never triggers when hovering interactive UI panels/buttons (`isOverUi`).
 * - Uses clean axial edge vectors (N/S/E/W along edges, smooth diagonal in corners)
 *   with a progressive ease-in ramp toward the outer pixel border.
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
    input.isOverUi ||
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

  const m = input.marginPx;
  let panX = 0; // +1 = camera pans West (world moves right), -1 = East
  let panY = 0; // +1 = camera pans North (world moves down), -1 = South

  if (input.pointerX < m) {
    panX = 1 - input.pointerX / m;
  } else if (input.pointerX > input.viewportWidth - m) {
    panX = -(1 - (input.viewportWidth - input.pointerX) / m);
  }

  if (input.pointerY < m) {
    panY = 1 - input.pointerY / m;
  } else if (input.pointerY > input.viewportHeight - m) {
    panY = -(1 - (input.viewportHeight - input.pointerY) / m);
  }

  const edgeProgress = Math.max(Math.abs(panX), Math.abs(panY));
  if (edgeProgress <= 0.001) {
    return { direction: null, offsetDeltaX: 0, offsetDeltaY: 0, strength: 0 };
  }

  // Smooth progressive ramp: gentle engagement at margin boundary, full speed at screen edge
  const smoothRamp = 0.25 + 0.75 * Math.pow(edgeProgress, 1.35);
  const strength = Math.min(1, Math.round(smoothRamp * 10000) / 10000);

  const len = Math.hypot(panX, panY) || 1;
  const offsetDeltaX = (panX / len) * strength;
  const offsetDeltaY = (panY / len) * strength;

  // Map axial/diagonal edge vector to 8-way compass direction
  // Note: panX > 0 means cursor is at West edge, panY > 0 means cursor is at North edge
  const direction = angleToCompassDirection(-panX, -panY);

  return {
    direction,
    offsetDeltaX,
    offsetDeltaY,
    strength
  };
}
