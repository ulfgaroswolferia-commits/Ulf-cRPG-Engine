export type TileVisibility = 'unexplored' | 'explored' | 'visible';

export class FovGridState {
  public readonly width: number;
  public readonly height: number;
  private readonly state: Uint8Array; // 0 = unexplored, 1 = explored, 2 = visible

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.state = new Uint8Array(width * height);
  }

  public beginFrame(): void {
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] === 2) {
        this.state[i] = 1; // downgrade previously visible to explored shroud
      }
    }
  }

  public revealAll(): void {
    this.state.fill(2);
  }

  public markVisible(x: number, y: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.state[y * this.width + x] = 2;
  }

  public getVisibility(x: number, y: number): TileVisibility {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 'unexplored';
    const v = this.state[y * this.width + x];
    if (v === 2) return 'visible';
    if (v === 1) return 'explored';
    return 'unexplored';
  }

  public getLightFactor(x: number, y: number): number {
    const vis = this.getVisibility(x, y);
    if (vis === 'visible') return 1.0;
    if (vis === 'explored') return 0.32;
    return 0.06;
  }
}

/**
 * Supercover Bresenham + radial Line-of-Sight calculation that updates `FovGridState`.
 * Opaque walls and closed doors are themselves visible when hit, but block sight beyond them.
 */
export function hasLineOfSight(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  isOpaque: (x: number, y: number) => boolean
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (cx !== x1 || cy !== y1) {
    if ((cx !== x0 || cy !== y0) && isOpaque(cx, cy)) {
      return false;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return true;
}

export function computeFieldOfView(
  fov: FovGridState,
  originX: number,
  originY: number,
  radius: number,
  isOpaque: (x: number, y: number) => boolean
): void {
  fov.beginFrame();
  fov.markVisible(originX, originY);

  const rSq = radius * radius;
  const minX = Math.max(0, Math.floor(originX - radius));
  const maxX = Math.min(fov.width - 1, Math.ceil(originX + radius));
  const minY = Math.max(0, Math.floor(originY - radius));
  const maxY = Math.min(fov.height - 1, Math.ceil(originY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - originX;
      const dy = y - originY;
      if (dx * dx + dy * dy <= rSq) {
        if (hasLineOfSight(originX, originY, x, y, isOpaque)) {
          fov.markVisible(x, y);
        }
      }
    }
  }
}
