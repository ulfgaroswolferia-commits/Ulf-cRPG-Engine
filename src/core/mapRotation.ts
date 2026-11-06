export type CameraRotation = 0 | 1 | 2 | 3; // 0 = N (0°), 1 = E (90° CW), 2 = S (180°), 3 = W (270° CW)
export type Direction8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; // 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW

export interface WorldGridPoint {
  x: number;
  y: number;
}

export interface RotatedGridCoord {
  rx: number;
  ry: number;
}

export interface RotatedFootprint {
  rx: number;
  ry: number;
  width: number;
  height: number;
}

/**
 * Returns the dimensions of the grid after applying camera rotation.
 */
export function getRotatedDimensions(
  worldWidth: number,
  worldHeight: number,
  rotation: CameraRotation
): { width: number; height: number } {
  return rotation % 2 === 0
    ? { width: worldWidth, height: worldHeight }
    : { width: worldHeight, height: worldWidth };
}

/**
 * Converts logical world coordinates (x, y) into rotated camera-space grid coordinates (rx, ry)
 * following the "Rotating a 2.5D Isometric Map" specification.
 */
export function toRotatedGrid(
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
  rotation: CameraRotation
): RotatedGridCoord {
  switch (rotation) {
    case 0:
      return { rx: x, ry: y };
    case 1:
      return { rx: worldHeight - 1 - y, ry: x };
    case 2:
      return { rx: worldWidth - 1 - x, ry: worldHeight - 1 - y };
    case 3:
      return { rx: y, ry: worldWidth - 1 - x };
  }
}

/**
 * Converts rotated camera-space coordinates (rx, ry) back into logical world coordinates (x, y).
 */
export function toWorldGrid(
  rx: number,
  ry: number,
  worldWidth: number,
  worldHeight: number,
  rotation: CameraRotation
): WorldGridPoint {
  switch (rotation) {
    case 0:
      return { x: rx, y: ry };
    case 1:
      return { x: ry, y: worldHeight - 1 - rx };
    case 2:
      return { x: worldWidth - 1 - rx, y: worldHeight - 1 - ry };
    case 3:
      return { x: worldWidth - 1 - ry, y: rx };
  }
}

/**
 * Converts continuous fractional world coordinates (fx, fy) (e.g. smooth character positions
 * where tile center is (x + 0.5, y + 0.5)) into rotated continuous coordinates.
 */
export function toRotatedContinuous(
  fx: number,
  fy: number,
  worldWidth: number,
  worldHeight: number,
  rotation: CameraRotation
): RotatedGridCoord {
  switch (rotation) {
    case 0:
      return { rx: fx, ry: fy };
    case 1:
      return { rx: worldHeight - fy, ry: fx };
    case 2:
      return { rx: worldWidth - fx, ry: worldHeight - fy };
    case 3:
      return { rx: fy, ry: worldWidth - fx };
  }
}

/**
 * Rotates a multi-tile object footprint occupying [x, x + sizeX - 1] x [y, y + sizeY - 1]
 * and computes its new top-most/back-most rotated anchor (rx, ry) and swapped dimensions.
 */
export function rotateFootprint(
  x: number,
  y: number,
  sizeX: number,
  sizeY: number,
  worldWidth: number,
  worldHeight: number,
  rotation: CameraRotation
): RotatedFootprint {
  const corners = [
    toRotatedGrid(x, y, worldWidth, worldHeight, rotation),
    toRotatedGrid(x + sizeX - 1, y, worldWidth, worldHeight, rotation),
    toRotatedGrid(x, y + sizeY - 1, worldWidth, worldHeight, rotation),
    toRotatedGrid(x + sizeX - 1, y + sizeY - 1, worldWidth, worldHeight, rotation)
  ];

  const minRx = Math.min(...corners.map((c) => c.rx));
  const maxRx = Math.max(...corners.map((c) => c.rx));
  const minRy = Math.min(...corners.map((c) => c.ry));
  const maxRy = Math.max(...corners.map((c) => c.ry));

  return {
    rx: minRx,
    ry: minRy,
    width: maxRx - minRx + 1,
    height: maxRy - minRy + 1
  };
}

/**
 * Rotates an 8-way direction index (0..7) by 90° steps matching the camera rotation.
 */
export function rotateDirection8(dir: Direction8, rotation: CameraRotation): Direction8 {
  return (((dir + rotation * 2) % 8 + 8) % 8) as Direction8;
}

/**
 * Rotates a 2D tangent-space normal vector (nx, ny) when the camera rotates
 * so directional and point lighting remain consistent with the world geometry.
 */
export function rotateNormalXY(
  nx: number,
  ny: number,
  rotation: CameraRotation
): { nx: number; ny: number } {
  const angle = (rotation * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    nx: nx * cos - ny * sin,
    ny: nx * sin + ny * cos
  };
}
