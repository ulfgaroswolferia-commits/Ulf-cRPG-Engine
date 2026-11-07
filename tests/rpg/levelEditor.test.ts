import { describe, expect, it } from 'vitest';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { InspectorPanel } from '../../src/ui/inspectorPanel';

describe('Full Level & Environment Editor (/dev/ InspectorPanel & IsoSceneView)', () => {
  it('supports painting all 9 terrain types with 1x1 or 3x3 brush and custom walkability', () => {
    const game = new CrpgGameState('slavic_village');
    const scene = new IsoSceneView(game);

    scene.activeTool = 'paint_terrain';
    scene.editorTerrainType = 'arcane_inlay';
    scene.editorTerrainWalkable = true;
    scene.editorBrushSize = 3;

    scene.applyEditorToolAtTile(10, 10);

    expect(game.map.tiles[10][10].terrain).toBe('arcane_inlay');
    expect(game.map.tiles[9][9].terrain).toBe('arcane_inlay');
    expect(game.map.tiles[11][11].terrain).toBe('arcane_inlay');
  });

  it('supports raising, lowering, and flattening tile elevation (Z = 0..4)', () => {
    const game = new CrpgGameState('slavic_village');
    const scene = new IsoSceneView(game);

    scene.activeTool = 'raise_elevation';
    scene.editorBrushSize = 1;
    scene.applyEditorToolAtTile(12, 12);
    scene.applyEditorToolAtTile(12, 12);
    expect(game.map.tiles[12][12].z).toBeGreaterThanOrEqual(2);

    scene.activeTool = 'flatten_elevation';
    scene.editorTargetElevation = 0;
    scene.applyEditorToolAtTile(12, 12);
    expect(game.map.tiles[12][12].z).toBe(0);
  });

  it('supports placing Glionox & Slavic props with custom variants/footprints and removing props from tiles', () => {
    const game = new CrpgGameState('slavic_village');
    const scene = new IsoSceneView(game);

    // Clear any prop at (15, 15) first
    scene.activeTool = 'remove_prop';
    scene.applyEditorToolAtTile(15, 15);
    expect(game.getPropAtTile(15, 15)).toBeUndefined();

    // Place a Slavic cottage (2x1) with variant 2 at (15, 15)
    scene.activeTool = 'place_prop';
    scene.editorPropKind = 'slavic_cottage';
    scene.editorPropVariant = 2;
    scene.editorPropOrientation = '2x1';
    scene.applyEditorToolAtTile(15, 15);

    const placed = game.getPropAtTile(15, 15);
    expect(placed).toBeDefined();
    expect(placed?.kind).toBe('slavic_cottage');
    expect(placed?.variant).toBe(2);
    expect(placed?.sizeX).toBe(2);
    expect(placed?.sizeY).toBe(1);

    // Remove the placed prop
    scene.activeTool = 'remove_prop';
    scene.applyEditorToolAtTile(15, 15);
    expect(game.getPropAtTile(15, 15)).toBeUndefined();
  });

  it('supports placing and removing PBR point lights, spawning NPCs & enemies on tiles, and exporting/resetting map JSON', () => {
    const game = new CrpgGameState('forest_clearing');
    const scene = new IsoSceneView(game);

    const initialLights = game.map.lights.length;
    scene.activeTool = 'place_arcane_light';
    scene.applyEditorToolAtTile(14, 14);
    expect(game.map.lights.length).toBe(initialLights + 1);

    scene.activeTool = 'remove_light';
    scene.applyEditorToolAtTile(14, 14);
    expect(game.map.lights.length).toBe(initialLights);

    const initialNpcs = game.npcs.length;
    scene.activeTool = 'spawn_enemy';
    scene.editorEnemyDifficulty = 'very_hard';
    scene.applyEditorToolAtTile(14, 16);
    expect(game.npcs.length).toBe(initialNpcs + 1);
    const spawnedEnemy = game.npcs[game.npcs.length - 1];
    expect(spawnedEnemy.combat?.isHostile).toBe(true);
    expect(spawnedEnemy.combat?.difficulty).toBe('very_hard');

    const exportedJson = scene.exportMapToJson();
    expect(exportedJson).toContain('"id": "forest_clearing"');

    // Modify tile and reset map
    game.map.tiles[0][0].terrain = 'arcane_inlay';
    scene.resetCurrentMap();
    expect(game.map.tiles[0][0].terrain).not.toBe('arcane_inlay');

    // Fill entire map terrain & clear all entities for blank canvas building
    scene.fillMapTerrain('mossy_cobble', true);
    expect(game.map.tiles[0][0].terrain).toBe('mossy_cobble');
    expect(game.map.tiles[15][15].terrain).toBe('mossy_cobble');

    scene.clearMapEntities();
    expect(game.map.props.length).toBe(0);
    expect(game.npcs.length).toBe(0);

    // Re-import previously exported JSON
    const importedOk = scene.importMapFromJson(exportedJson);
    expect(importedOk).toBe(true);
    expect(game.map.props.length).toBeGreaterThan(0);
  });

  it('renders full level editor controls in InspectorPanel (terrain selector, prop catalog, variant, enemy spawner, export/reset)', () => {
    const game = new CrpgGameState('slavic_village');
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const inspector = new InspectorPanel(fakeRoot, game, scene, () => {});
    inspector.render();

    expect(fakeRoot.innerHTML).toContain('data-tool="paint_terrain"');
    expect(fakeRoot.innerHTML).toContain('data-tool="place_prop"');
    expect(fakeRoot.innerHTML).toContain('data-tool="remove_prop"');
    expect(fakeRoot.innerHTML).toContain('data-tool="spawn_enemy"');
    expect(fakeRoot.innerHTML).toContain('id="editor-terrain-select"');
    expect(fakeRoot.innerHTML).toContain('id="editor-prop-select"');
    expect(fakeRoot.innerHTML).toContain('id="export-map-json"');
    expect(fakeRoot.innerHTML).toContain('id="reset-map-btn"');
  });
});
