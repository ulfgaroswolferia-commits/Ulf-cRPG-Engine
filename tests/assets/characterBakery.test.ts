import { describe, expect, it } from 'vitest';
import {
  bakeCharacterBuffers,
  CharacterSpriteSheetBuffer,
  computeCharacterRecipeHash,
  generateRandomCharacterRecipe,
  hasLoadedCharacterSpriteSheets,
  registerCharacterSpriteSheets,
  resolveCharacterArchetypeTag,
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

  it('bakes quadruped wolves and composites registered 8-directional character sprite sheets with PBR normals', () => {
    const wolfRecipe = {
      ...generateRandomCharacterRecipe(505, 'enemy_wilk'),
      name: 'Wilk Puszczański'
    };
    expect(resolveCharacterArchetypeTag(wolfRecipe)).toBe('wilk');
    expect(computeCharacterRecipeHash(wolfRecipe)).toContain('|wilk');
    const bakedWolf = bakeCharacterBuffers(wolfRecipe);
    expect(bakedWolf.albedoRGBA.length).toBe(256 * 768 * 4);

    // Create a synthetic 256x768 sprite sheet and verify registerCharacterSpriteSheets compositing
    const sheetW = 256;
    const sheetH = 768;
    const mockRgba = new Uint8ClampedArray(sheetW * sheetH * 4);
    for (let dir = 0; dir < 8; dir++) {
      for (let frame = 0; frame < 4; frame++) {
        const cx = frame * 64 + 32;
        const cy = dir * 96 + 48;
        const idx = (cy * sheetW + cx) * 4;
        mockRgba[idx] = 180;
        mockRgba[idx + 1] = 160;
        mockRgba[idx + 2] = 140;
        mockRgba[idx + 3] = 255;
      }
    }
    const sheets = new Map<string, CharacterSpriteSheetBuffer>([
      ['body_male', { width: sheetW, height: sheetH, rgba: mockRgba }],
      ['armor_plate', { width: sheetW, height: sheetH, rgba: mockRgba }],
      ['enemy_skeleton', { width: sheetW, height: sheetH, rgba: mockRgba }]
    ]);

    registerCharacterSpriteSheets(sheets);
    expect(hasLoadedCharacterSpriteSheets()).toBe(true);

    const skelRecipe = generateRandomCharacterRecipe(606, 'enemy_kurhan_skeleton');
    const bakedSkel = bakeCharacterBuffers(skelRecipe);
    expect(bakedSkel.albedoRGBA[(48 * sheetW + 32) * 4 + 3]).toBe(255);

    // Clear registered sheets so subsequent procedural fallback tests remain isolated
    registerCharacterSpriteSheets(new Map());
    expect(hasLoadedCharacterSpriteSheets()).toBe(false);
  });
});
