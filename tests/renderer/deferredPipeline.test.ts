import { describe, expect, it } from 'vitest';
import {
  ENGINE_NAME,
  evaluateDeferredPbrLightAtPoint
} from '../../src/renderer/deferredPipeline';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { CrpgGameState } from '../../src/rpg/gameLoop';

describe('deferredPipeline - Ulf-cRPG-Engine Normal-Mapped 2.5D Point & Directional PBR Lighting', () => {
  it('exposes official engine identifier Ulf-cRPG-Engine', () => {
    expect(ENGINE_NAME).toBe('Ulf-cRPG-Engine');
  });

  it('boosts illumination when surface normal faces the point light source vs facing away', () => {
    const light = {
      screenX: 100,
      screenY: 100,
      zHeightPx: 48,
      r: 1.0,
      g: 0.7,
      b: 0.3,
      intensity: 1.5,
      radiusPx: 260
    };

    // Pixel at (160, 100): light is to the LEFT (-X direction from pixel)
    const facingLight = evaluateDeferredPbrLightAtPoint(
      160,
      100,
      { nx: -0.8, ny: 0, roughness: 0.3, metallic: 0.8 },
      [light],
      0.25
    );

    const facingAway = evaluateDeferredPbrLightAtPoint(
      160,
      100,
      { nx: 0.8, ny: 0, roughness: 0.3, metallic: 0.8 },
      [light],
      0.25
    );

    expect(facingLight.r).toBeGreaterThan(facingAway.r);
    expect(facingLight.specular).toBeGreaterThan(facingAway.specular);
  });

  it('pans IsoSceneView camera when pointer approaches screen edges or when an edge arrow is activated', () => {
    const game = new CrpgGameState();
    const scene = new IsoSceneView(game);
    const initialX = scene.cameraOffsetX;
    const initialY = scene.cameraOffsetY;

    // Simulate pointer near the Eastern (right) edge of a 1280x720 viewport
    scene.updateEdgePanPointerState(1275, 360, true, false);
    scene.stepCameraEdgePan(0.1, 1280, 720);

    expect(scene.activeEdgeDirection).toBe('E');
    expect(scene.cameraOffsetX).toBeLessThan(initialX);
    expect(scene.cameraOffsetY).toBe(initialY);

    // Simulate pressing/hovering the North-West ('NW') HUD edge arrow button
    const afterEastX = scene.cameraOffsetX;
    scene.setForcedEdgeDirection('NW');
    scene.stepCameraEdgePan(0.1, 1280, 720);

    expect(scene.activeEdgeDirection).toBe('NW');
    expect(scene.cameraOffsetX).toBeGreaterThan(afterEastX);
    expect(scene.cameraOffsetY).toBeGreaterThan(initialY);
  });
});
