import { describe, expect, it } from 'vitest';
import { generateTilePbrBuffers } from '../../src/assets/proceduralForge';
import {
  clearTerrainTransitionCache,
  computeReachableTilesBfs,
  computeTileTransitions,
  generateTerrainTransitionPbr,
  getMicroFoliagePlacement,
  getTerrainBlendPriority,
  getWorldGroundColorMod,
  getWorldTileVariant,
  MicroFoliagePlacement,
  TerrainTransitionOverlay
} from '../../src/assets/terrainBlending';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('terrainBlending - Organic Seamless Ground, Path Feathering & Combat-Only Grid', () => {
  it('orders terrain blend priority naturally (grass > soil > dirt > cobble > stone > water)', () => {
    expect(getTerrainBlendPriority('forest_grass')).toBeGreaterThan(
      getTerrainBlendPriority('forest_soil')
    );
    expect(getTerrainBlendPriority('forest_soil')).toBeGreaterThan(
      getTerrainBlendPriority('dirt_path')
    );
    expect(getTerrainBlendPriority('dirt_path')).toBeGreaterThan(
      getTerrainBlendPriority('mossy_cobble')
    );
    expect(getTerrainBlendPriority('mossy_cobble')).toBeGreaterThan(
      getTerrainBlendPriority('dungeon_stone')
    );
    expect(getTerrainBlendPriority('dungeon_stone')).toBeGreaterThan(
      getTerrainBlendPriority('abyss_water')
    );
  });

  it('computes cardinal edge blends and inner corner rounding for dirt_path bordered by forest_grass', () => {
    const transitions = computeTileTransitions(5, 5, 'dirt_path', 0, (nrx, nry) => {
      if ((nrx === 4 && nry === 5) || (nrx === 5 && nry === 4)) {
        return { terrain: 'forest_grass', z: 0 };
      }
      return { terrain: 'dirt_path', z: 0 };
    });

    const slots = transitions.map((t) => `${t.slot}:${t.kind}:${t.terrain}`);
    expect(slots).toContain('edge_tl:edge:forest_grass');
    expect(slots).toContain('edge_tr:edge:forest_grass');
    expect(slots).toContain('corner_t:inner_round:forest_grass');
  });

  it('computes outer diagonal tip when only diagonal neighbor has higher-priority terrain', () => {
    const transitions = computeTileTransitions(5, 5, 'abyss_water', 0, (nrx, nry) => {
      if (nrx === 6 && nry === 6) {
        return { terrain: 'forest_grass', z: 0 };
      }
      return { terrain: 'abyss_water', z: 0 };
    });

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({
      terrain: 'forest_grass',
      slot: 'corner_b',
      kind: 'outer_tip'
    });
  });

  it('does not blend across different elevation levels so 3D cliffs stay crisp', () => {
    const transitions = computeTileTransitions(5, 5, 'dirt_path', 0, () => ({
      terrain: 'forest_grass',
      z: 1
    }));

    expect(transitions).toHaveLength(0);
  });

  it('generates feathered organic transition overlay buffers with opaque edge and transparent center', () => {
    clearTerrainTransitionCache();
    const edgeOverlay = generateTerrainTransitionPbr('forest_grass', 'edge_tl', 'edge', 1);

    expect(edgeOverlay.width).toBe(128);
    expect(edgeOverlay.height).toBe(64);
    expect(edgeOverlay.anchorX).toBe(0.5);
    expect(edgeOverlay.anchorY).toBe(0.5);

    // Center of the tile (64, 32) should remain transparent so underlying dirt path shows cleanly
    const centerAlpha = edgeOverlay.albedoRGBA[(32 * 128 + 64) * 4 + 3];
    expect(centerAlpha).toBe(0);

    // Along the top-left edge (around x=34, y=18), pixels should be visible
    let edgeOpaqueCount = 0;
    for (let y = 8; y < 32; y++) {
      for (let x = 16; x < 64; x++) {
        if (edgeOverlay.albedoRGBA[(y * 128 + x) * 4 + 3] > 120) {
          edgeOpaqueCount++;
        }
      }
    }
    expect(edgeOpaqueCount).toBeGreaterThan(150);
  });

  it('supports backwards-compatible multi-variant tile synthesis without dark diamond borders', () => {
    const defaultGrass = generateTilePbrBuffers('forest_grass', 0);
    const variantGrass = generateTilePbrBuffers('forest_grass', 0, 2);

    expect(defaultGrass.width).toBe(128);
    expect(variantGrass.width).toBe(128);
    expect(defaultGrass.albedoRGBA.length).toBe(variantGrass.albedoRGBA.length);

    // Different variants produce distinct natural pixel patterns
    let diffPixels = 0;
    for (let i = 0; i < defaultGrass.albedoRGBA.length; i += 4) {
      if (defaultGrass.albedoRGBA[i] !== variantGrass.albedoRGBA[i]) {
        diffPixels++;
      }
    }
    expect(diffPixels).toBeGreaterThan(200);
  });

  it('produces deterministic world tile variants, smooth color modulation, and micro-foliage placements', () => {
    const v1 = getWorldTileVariant(12, 18, 12);
    const v2 = getWorldTileVariant(12, 18, 12);
    expect(v1).toBe(v2);
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThan(12);

    const mod = getWorldGroundColorMod(10, 15);
    expect(mod.r).toBeGreaterThan(0.9);
    expect(mod.r).toBeLessThan(1.1);
    expect(mod.g).toBeGreaterThan(0.9);
    expect(mod.g).toBeLessThan(1.1);

    let grassTufts = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const mf = getMicroFoliagePlacement(x, y, 'forest_grass');
        if (mf) {
          grassTufts++;
          expect(mf.variant).toBeGreaterThanOrEqual(0);
          expect(mf.variant).toBeLessThan(4);
        }
      }
    }
    expect(grassTufts).toBeGreaterThan(40);
    expect(grassTufts).toBeLessThan(200);
  });

  it('configures IsoSceneView with organic terrain blending enabled and ground grid disabled outside combat', () => {
    const game = new CrpgGameState();
    const scene = new IsoSceneView(game);
    expect(scene.organicTerrainBlending).toBe(true);
    expect(scene.showGridInExploration).toBe(false);
    expect(game.combatState.active).toBe(false);
  });

  it('computes exact combat AP reachability via BFS respecting walls, cliffs, and diagonal corner-cutting', () => {
    // 7x7 grid, player at (3,3), wall at (4,3) and (3,2), cliff z=2 at (2,3)
    const width = 7;
    const height = 7;
    const blocked = new Set<string>(['4,3', '3,2']);
    const isWalkable = (x: number, y: number) => !blocked.has(`${x},${y}`);
    const getElevation = (x: number, y: number) => (x === 2 && y === 3 ? 2 : 0);

    const reachable = computeReachableTilesBfs(
      width,
      height,
      3,
      3,
      1,
      isWalkable,
      getElevation,
      1
    );

    // Straight South (3,4) is open and reachable in 1 step
    expect(reachable.has(4 * width + 3)).toBe(true);
    // Diagonal (2,4) is blocked in 1 step by cliff corner-cutting at (2,3)
    expect(reachable.has(4 * width + 2)).toBe(false);
    // Blocked wall tiles are not reachable
    expect(reachable.has(3 * width + 4)).toBe(false);
    expect(reachable.has(2 * width + 3)).toBe(false);
    // Diagonal (4,2) is blocked by corner-cutting between walls (4,3) and (3,2)
    expect(reachable.has(2 * width + 4)).toBe(false);
    // High cliff (2,3) at z=2 is not reachable from z=0 (|Δz| = 2 > 1)
    expect(reachable.has(3 * width + 2)).toBe(false);
    // Tile 2 steps away (3,5) is beyond maxSteps=1
    expect(reachable.has(5 * width + 3)).toBe(false);

    // With maxSteps=2, (2,4) becomes reachable cleanly via (3,3) -> (3,4) -> (2,4)
    const reachable2 = computeReachableTilesBfs(
      width,
      height,
      3,
      3,
      2,
      isWalkable,
      getElevation,
      1
    );
    expect(reachable2.has(4 * width + 2)).toBe(true);
  });

  it('keeps micro-foliage offsets inside safe tile interior and reuses out buffers without extra allocations', () => {
    const scratchMod = { r: 0, g: 0, b: 0 };
    const modResult = getWorldGroundColorMod(8, 12, scratchMod);
    expect(modResult).toBe(scratchMod);

    const scratchMf: MicroFoliagePlacement = {
      variant: 0,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      alpha: 1
    };
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const mf = getMicroFoliagePlacement(x, y, 'forest_grass', scratchMf);
        if (mf) {
          expect(mf).toBe(scratchMf);
          expect(Math.abs(mf.offsetX)).toBeLessThanOrEqual(18);
          expect(mf.offsetY).toBeGreaterThanOrEqual(-10);
          expect(mf.offsetY).toBeLessThanOrEqual(2);
        }
      }
    }

    const scratchTrans: TerrainTransitionOverlay[] = [];
    const transRes = computeTileTransitions(
      2,
      2,
      'dirt_path',
      0,
      (nrx, nry) => (nrx === 1 && nry === 2 ? { terrain: 'forest_grass', z: 0 } : null),
      scratchTrans
    );
    expect(transRes).toBe(scratchTrans);
    expect(transRes).toHaveLength(1);
  });

  it('synthesizes non-flat Sobel relief normals on terrain transition overlays', () => {
    clearTerrainTransitionCache();
    const pair = generateTerrainTransitionPbr('forest_grass', 'edge_tl', 'edge', 0);
    const uniqueNx = new Set<number>();
    const uniqueNy = new Set<number>();
    for (let i = 0; i < pair.width * pair.height; i++) {
      const idx = i * 4;
      if (pair.albedoRGBA[idx + 3] > 32) {
        uniqueNx.add(pair.normalMaterialRGBA[idx]);
        uniqueNy.add(pair.normalMaterialRGBA[idx + 1]);
      }
    }
    expect(uniqueNx.size).toBeGreaterThan(3);
    expect(uniqueNy.size).toBeGreaterThan(3);
  });

  it('increments CrpgGameState.mapRevision on map load and door toggle', () => {
    const game = new CrpgGameState('sanctum_dungeon');
    const revInitial = game.mapRevision;

    game.loadMap('forest_clearing');
    expect(game.mapRevision).toBeGreaterThan(revInitial);

    game.loadMap('sanctum_dungeon');
    const revAfterLoad = game.mapRevision;
    const door = game.map.props.find((p) => p.kind === 'door');
    expect(door).toBeDefined();
    if (door) {
      game.togglePropInteraction(door.id);
      expect(game.mapRevision).toBeGreaterThan(revAfterLoad);
    }
  });
});
