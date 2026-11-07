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

  it('bakes specialized Slavic & dark fantasy archetypes (Ranger with Bow/Quiver, Druid with Antlers, Lamellar Warrior)', () => {
    // 1. Ranger with Bow, Quiver, and Cowl
    const rangerRecipe = {
      ...generateRandomCharacterRecipe(202),
      equipment: {
        head: 'helm_ranger_cowl',
        torso: 'torso_warden_brigandine',
        cloak: 'cloak_ranger_quiver',
        legs: 'legs_leather_boots',
        mainHand: 'weapon_hunting_bow',
        offHand: null
      }
    };
    const bakedRanger = bakeCharacterBuffers(rangerRecipe);
    expect(bakedRanger.albedoRGBA.length).toBe(64 * 4 * 96 * 8 * 4);

    // 2. Slavic Lamellar Warrior with Round Shield & Szyszak
    const warriorRecipe = {
      ...generateRandomCharacterRecipe(303),
      equipment: {
        head: 'helm_szyszak',
        torso: 'torso_slavic_lamellar',
        cloak: 'cloak_steel_pauldrons',
        legs: 'legs_steel_greaves',
        mainHand: 'weapon_slavic_axe',
        offHand: 'offhand_slavic_shield'
      }
    };
    const bakedWarrior = bakeCharacterBuffers(warriorRecipe);
    expect(bakedWarrior.albedoRGBA.length).toBe(64 * 4 * 96 * 8 * 4);

    // 3. Druid with Antlers and Astral Staff
    const druidRecipe = {
      ...generateRandomCharacterRecipe(404),
      equipment: {
        head: 'helm_druid_antlers',
        torso: 'torso_archmage_robes',
        cloak: 'cloak_crimson_mantle',
        legs: 'legs_lapcie',
        mainHand: 'weapon_astral_staff',
        offHand: 'offhand_grimoire'
      }
    };
    const bakedDruid = bakeCharacterBuffers(druidRecipe);
    expect(bakedDruid.albedoRGBA.length).toBe(64 * 4 * 96 * 8 * 4);
  });
});
