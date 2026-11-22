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

  it('synthesizes Slavic settlement & marketplace PBR props (slavic_cottage, market_stall, slavic_shrine, slavic_well, wattle_fence)', () => {
    const cottage = generatePropPbrBuffers('slavic_cottage', true, 2, 1, 0);
    expect(cottage.width).toBe(192);
    expect(cottage.height).toBeGreaterThanOrEqual(160);
    // Ensure non-transparent pixels exist in the rendered thatched cottage
    let cottageOpaquePixels = 0;
    for (let i = 3; i < cottage.albedoRGBA.length; i += 4) {
      if (cottage.albedoRGBA[i] > 0) cottageOpaquePixels++;
    }
    expect(cottageOpaquePixels).toBeGreaterThan(1500);

    const stall = generatePropPbrBuffers('market_stall', false, 2, 1, 1);
    expect(stall.width).toBe(192);
    let stallOpaquePixels = 0;
    for (let i = 3; i < stall.albedoRGBA.length; i += 4) {
      if (stall.albedoRGBA[i] > 0) stallOpaquePixels++;
    }
    expect(stallOpaquePixels).toBeGreaterThan(1000);

    const shrine = generatePropPbrBuffers('slavic_shrine', true, 1, 1, 0);
    const well = generatePropPbrBuffers('slavic_well', false, 1, 1, 0);
    const fence = generatePropPbrBuffers('wattle_fence', false, 1, 1, 0);

    expect(shrine.width).toBe(128);
    expect(well.width).toBe(128);
    expect(fence.width).toBe(128);
  });

  it('synthesizes Isometric Game Kit & OpenGameArt props (watchtower, graveyard_fence, dead_tree, rock_cliff)', () => {
    const tower0 = generatePropPbrBuffers('watchtower', true, 1, 1, 0);
    const tower1 = generatePropPbrBuffers('watchtower', true, 1, 1, 1);
    const tower2 = generatePropPbrBuffers('watchtower', true, 1, 1, 2);
    const gFence = generatePropPbrBuffers('graveyard_fence', false, 1, 1, 0);
    const deadTree = generatePropPbrBuffers('dead_tree', false, 1, 1, 0);
    const cliff = generatePropPbrBuffers('rock_cliff', false, 1, 1, 0);

    for (const buf of [tower0, tower1, tower2, gFence, deadTree, cliff]) {
      expect(buf.width).toBeGreaterThanOrEqual(128);
      expect(buf.height).toBeGreaterThanOrEqual(128);
      let opaque = 0;
      for (let i = 3; i < buf.albedoRGBA.length; i += 4) {
        if (buf.albedoRGBA[i] > 16) opaque++;
      }
      expect(opaque).toBeGreaterThan(250);
    }
  });

  it('synthesizes a readable crimson school banner with opaque fabric pixels', () => {
    const banner = generatePropPbrBuffers('school_banner', false, 1, 1, 0);
    let crimsonPixels = 0;

    for (let i = 0; i < banner.albedoRGBA.length; i += 4) {
      const [red, green, blue, alpha] = banner.albedoRGBA.slice(i, i + 4);
      if (alpha > 128 && red > 70 && red > green * 1.5 && red > blue * 1.3) {
        crimsonPixels++;
      }
    }

    expect(crimsonPixels).toBeGreaterThan(100);
  });

  it('synthesizes a brown wooden wheel with enough opaque pixels to read at map scale', () => {
    const wheelKind = 'watermill_wheel' as Parameters<typeof generatePropPbrBuffers>[0];
    const wheel = generatePropPbrBuffers(wheelKind, false, 1, 1, 0);
    let woodenPixels = 0;

    for (let i = 0; i < wheel.albedoRGBA.length; i += 4) {
      const [red, green, blue, alpha] = wheel.albedoRGBA.slice(i, i + 4);
      if (alpha > 200 && red > green * 1.15 && green > blue * 1.15 && red > 45) woodenPixels++;
    }

    expect(woodenPixels).toBeGreaterThan(400);
  });

  it('synthesizes a small, opaque black crow silhouette for the ruins', () => {
    const crowKind = 'perched_crow' as Parameters<typeof generatePropPbrBuffers>[0];
    const crow = generatePropPbrBuffers(crowKind, false, 1, 1, 0);
    let darkPixels = 0;

    for (let i = 0; i < crow.albedoRGBA.length; i += 4) {
      const [red, green, blue, alpha] = crow.albedoRGBA.slice(i, i + 4);
      if (alpha > 200 && red < 70 && green < 75 && blue < 85) darkPixels++;
    }

    expect(darkPixels).toBeGreaterThan(180);
  });

  it('synthesizes Kenney CC0 dungeon props (dungeon_column, dungeon_barrel, dungeon_crate, dungeon_table, dungeon_support, chest)', () => {
    const col = generatePropPbrBuffers('dungeon_column', false, 1, 1, 0);
    const barrel = generatePropPbrBuffers('dungeon_barrel', false, 1, 1, 0);
    const crate = generatePropPbrBuffers('dungeon_crate', false, 1, 1, 0);
    const table = generatePropPbrBuffers('dungeon_table', false, 1, 1, 0);
    const support = generatePropPbrBuffers('dungeon_support', false, 1, 1, 0);
    const chest0 = generatePropPbrBuffers('chest', false, 1, 1, 0);
    const chestOpen = generatePropPbrBuffers('chest', true, 1, 1, 0);
    const chestKenney = generatePropPbrBuffers('chest', false, 1, 1, 3);

    for (const buf of [col, barrel, crate, table, support, chest0, chestOpen, chestKenney]) {
      expect(buf.width).toBeGreaterThanOrEqual(128);
      expect(buf.height).toBeGreaterThanOrEqual(128);
      let opaque = 0;
      for (let i = 3; i < buf.albedoRGBA.length; i += 4) {
        if (buf.albedoRGBA[i] > 16) opaque++;
      }
      expect(opaque).toBeGreaterThan(150);
    }
  });
});
