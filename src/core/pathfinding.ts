import { Direction8, WorldGridPoint } from './mapRotation';

export interface NavGridQuery {
  width: number;
  height: number;
  isWalkable: (x: number, y: number) => boolean;
  getElevation: (x: number, y: number) => number;
  maxStepElevation?: number;
}

export interface PathStepNode {
  x: number;
  y: number;
  z: number;
  direction: Direction8;
}

const NEIGHBORS_8: ReadonlyArray<{ dx: number; dy: number; cost: number; dir: Direction8 }> = [
  { dx: 0, dy: -1, cost: 1.0, dir: 0 }, // N
  { dx: 1, dy: -1, cost: 1.4142, dir: 1 }, // NE
  { dx: 1, dy: 0, cost: 1.0, dir: 2 }, // E
  { dx: 1, dy: 1, cost: 1.4142, dir: 3 }, // SE
  { dx: 0, dy: 1, cost: 1.0, dir: 4 }, // S
  { dx: -1, dy: 1, cost: 1.4142, dir: 5 }, // SW
  { dx: -1, dy: 0, cost: 1.0, dir: 6 }, // W
  { dx: -1, dy: -1, cost: 1.4142, dir: 7 } // NW
];

export function deltaToDirection8(dx: number, dy: number): Direction8 {
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (const n of NEIGHBORS_8) {
    if (n.dx === sx && n.dy === sy) return n.dir;
  }
  return 4;
}

function octileHeuristic(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x1 - x2);
  const dy = Math.abs(y1 - y2);
  return dx + dy + (1.4142 - 2) * Math.min(dx, dy);
}

/**
 * 8-directional 3D A* pathfinder respecting elevation steps (stairs/ramps vs cliffs)
 * and preventing diagonal corner-cutting around walls.
 */
export function findPathAStar3D(
  grid: NavGridQuery,
  start: WorldGridPoint,
  goal: WorldGridPoint
): PathStepNode[] {
  const { width, height } = grid;
  const maxStepZ = grid.maxStepElevation ?? 1;

  if (
    start.x < 0 ||
    start.x >= width ||
    start.y < 0 ||
    start.y >= height ||
    goal.x < 0 ||
    goal.x >= width ||
    goal.y < 0 ||
    goal.y >= height
  ) {
    return [];
  }

  if (!grid.isWalkable(goal.x, goal.y)) {
    return [];
  }

  const key = (x: number, y: number): number => y * width + x;
  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);

  if (startKey === goalKey) {
    return [
      {
        x: start.x,
        y: start.y,
        z: grid.getElevation(start.x, start.y),
        direction: 4
      }
    ];
  }

  const gScore = new Float64Array(width * height).fill(Infinity);
  const fScore = new Float64Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const cameDir = new Uint8Array(width * height).fill(4);
  const closed = new Uint8Array(width * height);

  gScore[startKey] = 0;
  fScore[startKey] = octileHeuristic(start.x, start.y, goal.x, goal.y);

  const openSet: number[] = [startKey];

  while (openSet.length > 0) {
    let bestIdx = 0;
    let current = openSet[0];
    for (let i = 1; i < openSet.length; i++) {
      if (fScore[openSet[i]] < fScore[current]) {
        current = openSet[i];
        bestIdx = i;
      }
    }

    const last = openSet.pop()!;
    if (bestIdx < openSet.length) {
      openSet[bestIdx] = last;
    }

    if (current === goalKey) {
      const path: PathStepNode[] = [];
      let curr = current;
      while (curr !== -1) {
        const cx = curr % width;
        const cy = Math.floor(curr / width);
        path.push({
          x: cx,
          y: cy,
          z: grid.getElevation(cx, cy),
          direction: cameDir[curr] as Direction8
        });
        curr = cameFrom[curr];
      }
      path.reverse();
      return path;
    }

    closed[current] = 1;
    const cx = current % width;
    const cy = Math.floor(current / width);
    const cz = grid.getElevation(cx, cy);

    for (const n of NEIGHBORS_8) {
      const nx = cx + n.dx;
      const ny = cy + n.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nKey = key(nx, ny);
      if (closed[nKey]) continue;
      if (!grid.isWalkable(nx, ny)) continue;

      const nz = grid.getElevation(nx, ny);
      if (Math.abs(nz - cz) > maxStepZ) continue;

      // Prevent diagonal corner cutting around walls or steep cliffs
      if (n.dx !== 0 && n.dy !== 0) {
        const side1Walkable =
          grid.isWalkable(cx + n.dx, cy) &&
          Math.abs(grid.getElevation(cx + n.dx, cy) - cz) <= maxStepZ;
        const side2Walkable =
          grid.isWalkable(cx, cy + n.dy) &&
          Math.abs(grid.getElevation(cx, cy + n.dy) - cz) <= maxStepZ;
        if (!side1Walkable || !side2Walkable) continue;
      }

      const stepPenalty = Math.abs(nz - cz) * 0.35;
      const tentativeG = gScore[current] + n.cost + stepPenalty;

      if (tentativeG < gScore[nKey]) {
        cameFrom[nKey] = current;
        cameDir[nKey] = n.dir;
        gScore[nKey] = tentativeG;
        fScore[nKey] = tentativeG + octileHeuristic(nx, ny, goal.x, goal.y);
        if (!openSet.includes(nKey)) {
          openSet.push(nKey);
        }
      }
    }
  }

  return [];
}
