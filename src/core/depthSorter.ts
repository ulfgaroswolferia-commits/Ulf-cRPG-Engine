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
let topoScratchCap = 0;
let topoInDegree = new Int32Array(0);
let topoVisited = new Uint8Array(0);
let topoKeys = new Float64Array(0);
const topoAdj: number[][] = [];
const topoHeap: number[] = [];

function compareTopoNodes<T extends DepthBox3D>(i: number, j: number, entities: T[]): number {
  const diff = topoKeys[i] - topoKeys[j];
  if (diff !== 0) return diff;
  return entities[i].id < entities[j].id ? -1 : entities[i].id > entities[j].id ? 1 : 0;
}

function topoHeapPush<T extends DepthBox3D>(node: number, entities: T[]): void {
  let idx = topoHeap.length;
  topoHeap.push(node);
  while (idx > 0) {
    const parentIdx = (idx - 1) >> 1;
    const parent = topoHeap[parentIdx];
    if (compareTopoNodes(node, parent, entities) >= 0) break;
    topoHeap[idx] = parent;
    idx = parentIdx;
  }
  topoHeap[idx] = node;
}

function topoHeapPop<T extends DepthBox3D>(entities: T[]): number {
  const top = topoHeap[0];
  const last = topoHeap.pop()!;
  const len = topoHeap.length;
  if (len > 0) {
    let idx = 0;
    while (true) {
      const left = (idx << 1) + 1;
      if (left >= len) break;
      const right = left + 1;
      let smallest = left;
      if (right < len && compareTopoNodes(topoHeap[right], topoHeap[left], entities) < 0) {
        smallest = right;
      }
      if (compareTopoNodes(last, topoHeap[smallest], entities) <= 0) break;
      topoHeap[idx] = topoHeap[smallest];
      idx = smallest;
    }
    topoHeap[idx] = last;
  }
  return top;
}

export function sortEntitiesTopological<T extends DepthBox3D>(entities: T[]): T[] {
  const n = entities.length;
  if (n <= 1) return [...entities];

  if (n > topoScratchCap) {
    topoScratchCap = n;
    topoInDegree = new Int32Array(n);
    topoVisited = new Uint8Array(n);
    topoKeys = new Float64Array(n);
    while (topoAdj.length < n) topoAdj.push([]);
  }

  for (let i = 0; i < n; i++) {
    topoInDegree[i] = 0;
    topoVisited[i] = 0;
    topoKeys[i] = getCentroidDepthKey(entities[i]);
    topoAdj[i].length = 0;
  }
  topoHeap.length = 0;

  for (let i = 0; i < n; i++) {
    const a = entities[i];
    for (let j = i + 1; j < n; j++) {
      const b = entities[j];
      if (isBehindInIsoSpace(a, b)) {
        topoAdj[i].push(j);
        topoInDegree[j]++;
      } else if (isBehindInIsoSpace(b, a)) {
        topoAdj[j].push(i);
        topoInDegree[i]++;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (topoInDegree[i] === 0) {
      topoHeapPush(i, entities);
    }
  }

  const result: T[] = new Array(n);
  let outIdx = 0;

  while (outIdx < n) {
    let bestIdx = -1;
    while (topoHeap.length > 0) {
      const candidate = topoHeapPop(entities);
      if (!topoVisited[candidate]) {
        bestIdx = candidate;
        break;
      }
    }

    // Cycle fallback: if mutually overlapping boxes form a cycle, break cycle deterministically
    if (bestIdx === -1) {
      for (let i = 0; i < n; i++) {
        if (!topoVisited[i]) {
          if (bestIdx === -1 || compareTopoNodes(i, bestIdx, entities) < 0) {
            bestIdx = i;
          }
        }
      }
    }

    topoVisited[bestIdx] = 1;
    result[outIdx++] = entities[bestIdx];

    const neighbors = topoAdj[bestIdx];
    for (let k = 0; k < neighbors.length; k++) {
      const next = neighbors[k];
      if (!topoVisited[next]) {
        const deg = --topoInDegree[next];
        if (deg === 0) {
          topoHeapPush(next, entities);
        }
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
