import { describe, expect, it } from 'vitest';
import {
  ENGINE_NAME,
  evaluateDeferredPbrLightAtPoint
} from '../../src/renderer/deferredPipeline';

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
});
