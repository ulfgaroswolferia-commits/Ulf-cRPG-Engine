import { describe, expect, it } from 'vitest';
import {
  generatePropPbrBuffers,
  generateTilePbrBuffers
} from '../../src/assets/proceduralForge';

describe('proceduralForge - High-Detail Isometric Tile & Prop PBR Normal/Albedo Synthesis', () => {
  it('synthesizes isometric diamond tile Albedo and Normal+Material buffers with valid normal vectors', () => {
    const stone = generateTilePbrBuffers('dungeon_stone', 2);
    expect(stone.width).toBe(128);
    expect(stone.height).toBeGreaterThanOrEqual(112);
    expect(stone.albedoRGBA.length).toBe(stone.width * stone.height * 4);
    expect(stone.normalMaterialRGBA.length).toBe(stone.width * stone.height * 4);

    // Center of top diamond face (64, 32) must be opaque and have non-zero normal
    const centerIdx = (32 * stone.width + 64) * 4;
    expect(stone.albedoRGBA[centerIdx + 3]).toBe(255);
    expect(stone.normalMaterialRGBA[centerIdx]).toBeGreaterThan(0);
  });

  it('synthesizes rotated footprints for multi-tile props (2x1 and 1x2 runic_altar)', () => {
    const altar2x1 = generatePropPbrBuffers('runic_altar', false, 2, 1);
    const altar1x2 = generatePropPbrBuffers('runic_altar', false, 1, 2);

    expect(altar2x1.width).toBe(192);
    expect(altar1x2.width).toBe(192);
    expect(altar2x1.anchorX).not.toBe(altar1x2.anchorX);
  });
});
