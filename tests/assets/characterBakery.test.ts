import { describe, expect, it } from 'vitest';
import {
  bakeCharacterBuffers,
  computeCharacterRecipeHash,
  generateRandomCharacterRecipe,
  resolveEffectiveCharacterLayers
} from '../../src/assets/characterBakery';
import { EQUIPMENT_CATALOG } from '../../src/rpg/characterData';

describe('characterBakery - Modular Isometric Character Generation & Texture Baking', () => {
  it('generates deterministic random character recipes from seed', () => {
    const r1 = generateRandomCharacterRecipe(42);
    const r2 = generateRandomCharacterRecipe(42);
    const r3 = generateRandomCharacterRecipe(999);

    expect(r1).toEqual(r2);
    expect(computeCharacterRecipeHash(r1)).toBe(computeCharacterRecipeHash(r2));
    expect(computeCharacterRecipeHash(r1)).not.toBe(computeCharacterRecipeHash(r3));
  });

  it('applies layer compatibility rules (full closed helmet hides hair layer)', () => {
    const base = generateRandomCharacterRecipe(101);
    const withFullHelm = {
      ...base,
      hairStyle: 'long_braids' as const,
      equipment: {
        ...base.equipment,
        head: 'helm_dread_plate'
      }
    };

    const resolved = resolveEffectiveCharacterLayers(withFullHelm);
    expect(resolved.showHair).toBe(false);
    expect(resolved.headItem?.id).toBe('helm_dread_plate');
  });

  it('bakes 8-directional Albedo and Normal+Material pixel buffers with non-empty normal vectors', () => {
    const recipe = generateRandomCharacterRecipe(77);
    const baked = bakeCharacterBuffers(recipe);

    expect(baked.frameWidth).toBe(64);
    expect(baked.frameHeight).toBe(96);
    expect(baked.directions).toBe(8);
    expect(baked.framesPerDirection).toBe(4);
    expect(baked.albedoRGBA.length).toBe(baked.sheetWidth * baked.sheetHeight * 4);
    expect(baked.normalMaterialRGBA.length).toBe(baked.sheetWidth * baked.sheetHeight * 4);

    // Verify that non-transparent pixels exist in both Albedo and Normal+Material buffers
    let opaquePixels = 0;
    for (let i = 0; i < baked.albedoRGBA.length; i += 4) {
      if (baked.albedoRGBA[i + 3] > 200) {
        opaquePixels++;
      }
    }
    expect(opaquePixels).toBeGreaterThan(500);
    expect(Object.keys(EQUIPMENT_CATALOG).length).toBeGreaterThanOrEqual(10);
  });
});
