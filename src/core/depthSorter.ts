export interface DepthBox3D {
  id: string;
  rxMin: number;
  rxMax: number;
  ryMin: number;
  ryMax: number;
  zMin: number;
  zMax: number;
  occludesVision?: boolean;
}

const EPSILON = 0.0001;

/**
 * Returns true if entity A must be drawn BEFORE (behind/under) entity B
 * in a 2.5D isometric projection.
 */
export function isBehindInIsoSpace(a: DepthBox3D, b: DepthBox3D): boolean {
  // 1. If A is completely below B in vertical Z elevation, and their XY footprints overlap or A is behind
  const xyOverlap =
    a.rxMin < b.rxMax - EPSILON &&
    b.rxMin < a.rxMax - EPSILON &&
    a.ryMin < b.ryMax - EPSILON &&
    b.ryMin < a.ryMax - EPSILON;

  if (xyOverlap && a.zMax <= b.zMin + EPSILON) {
    return true;
  }

  // 2. If Z intervals overlap (or are close), check isometric front/back relationship
  // In isometric view where camera looks from (+rx, +ry) toward (0, 0),
  // an entity A is behind B if A does not extend in front of B on either axis
  // and is strictly behind B on at least one relevant axis while overlapping the screen diamond corridor.
  const zOverlap = a.zMin < b.zMax - EPSILON && b.zMin < a.zMax - EPSILON;
  if (!zOverlap && a.zMax > b.zMin + EPSILON) {
    return false;
  }

  // Check if A is strictly behind B along the rx axis, ry axis, or both
  const aBehindRx = a.rxMax <= b.rxMin + EPSILON;
  const aBehindRy = a.ryMax <= b.ryMin + EPSILON;

  const aInFrontRx = a.rxMin >= b.rxMax - EPSILON;
  const aInFrontRy = a.ryMin >= b.ryMax - EPSILON;

  if (aInFrontRx || aInFrontRy) {
    return false;
  }

  if (aBehindRx || aBehindRy) {
    return true;
  }

  return false;
}

function getCentroidDepthKey(box: DepthBox3D): number {
  const rxCenter = (box.rxMin + box.rxMax) * 0.5;
  const ryCenter = (box.ryMin + box.ryMax) * 0.5;
  const zCenter = (box.zMin + box.zMax) * 0.5;
  return rxCenter + ryCenter + zCenter * 0.15;
}

/**
 * Topological Painter's Algorithm DAG sorter solving multi-tile and multi-elevation
 * overlap artifacts described in "Woes of Isometry".
 */
export function sortEntitiesTopological<T extends DepthBox3D>(entities: T[]): T[] {
  const n = entities.length;
  if (n <= 1) return [...entities];

  const adj: number[][] = Array.from({ length: n }, () => []);
  const inDegree = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = entities[i];
      const b = entities[j];
      if (isBehindInIsoSpace(a, b)) {
        adj[i].push(j);
        inDegree[j]++;
      } else if (isBehindInIsoSpace(b, a)) {
        adj[j].push(i);
        inDegree[i]++;
      }
    }
  }

  const visited = new Uint8Array(n);
  const result: T[] = [];

  // Deterministic tie-breaker key
  const keys = entities.map(getCentroidDepthKey);

  while (result.length < n) {
    let bestIdx = -1;
    let bestKey = Infinity;

    // Pick available zero-in-degree node with smallest depth key
    for (let i = 0; i < n; i++) {
      if (!visited[i] && inDegree[i] === 0) {
        if (keys[i] < bestKey || (keys[i] === bestKey && entities[i].id < entities[bestIdx]?.id)) {
          bestKey = keys[i];
          bestIdx = i;
        }
      }
    }

    // Cycle fallback: if mutually overlapping boxes form a cycle, break cycle deterministically
    if (bestIdx === -1) {
      for (let i = 0; i < n; i++) {
        if (!visited[i] && keys[i] < bestKey) {
          bestKey = keys[i];
          bestIdx = i;
        }
      }
    }

    visited[bestIdx] = 1;
    result.push(entities[bestIdx]);

    for (const next of adj[bestIdx]) {
      if (!visited[next]) {
        inDegree[next]--;
      }
    }
  }

  return result;
}

/**
 * Determines whether a tall wall/pillar (`wall`) visually occludes `target` (e.g. player character)
 * in isometric screen space and therefore should receive a dynamic X-ray cutaway mask.
 */
export function shouldApplyWallCutaway(wall: DepthBox3D, target: DepthBox3D): boolean {
  if (!wall.occludesVision) return false;
  if (!isBehindInIsoSpace(target, wall)) return false;

  // Check if they are close along the isometric screen X axis ((rx - ry)) and depth axis ((rx + ry))
  const wallIsoX = (wall.rxMin + wall.rxMax - (wall.ryMin + wall.ryMax)) * 0.5;
  const targetIsoX = (target.rxMin + target.rxMax - (target.ryMin + target.ryMax)) * 0.5;

  const wallDepth = (wall.rxMin + wall.rxMax + wall.ryMin + wall.ryMax) * 0.5;
  const targetDepth = (target.rxMin + target.rxMax + target.ryMin + target.ryMax) * 0.5;

  const horizDist = Math.abs(wallIsoX - targetIsoX);
  const depthDiff = wallDepth - targetDepth;

  return horizDist <= 2.2 && depthDiff > 0 && depthDiff <= 4.5 && wall.zMax > target.zMin + 0.5;
}
