import { describe, expect, it } from 'vitest';
import { createSlavicVillageMap } from '../../src/core/worldMap';
import {
  getPrzasneKolapsyForNpc,
  preloadPrzasneDialoguesAsset
} from '../../src/rpg/dialogueSystem';
import { CrpgGameState } from '../../src/rpg/gameLoop';
import { IsoSceneView } from '../../src/renderer/isoSceneView';
import { HudOverlay } from '../../src/ui/hudOverlay';
import { bakeCharacterBuffers } from '../../src/assets/characterBakery';

describe('Slavic Settlement & Marketplace ("Osada Żerców i Targowisko")', () => {
  it('creates a 32x32 Slavic settlement map with cottages, market stalls, shrine of Światowid, well, and wattle fences', () => {
    const map = createSlavicVillageMap();
    expect(map.id).toBe('slavic_village');
    expect(map.width).toBe(32);
    expect(map.height).toBe(32);

    const cottages = map.props.filter((p) => p.kind === 'slavic_cottage');
    const stalls = map.props.filter((p) => p.kind === 'market_stall');
    const shrines = map.props.filter((p) => p.kind === 'slavic_shrine');
    const wells = map.props.filter((p) => p.kind === 'slavic_well');
    const fences = map.props.filter((p) => p.kind === 'wattle_fence');

    expect(cottages.length).toBe(12);
    expect(stalls.length).toBeGreaterThanOrEqual(3);
    expect(shrines.length).toBeGreaterThanOrEqual(1);
    expect(wells.length).toBeGreaterThanOrEqual(1);
    expect(fences.length).toBeGreaterThanOrEqual(12);

    // Verify showcase features: Ancestral Kurhan & Burial Mound, Watchtowers, Pier and Lights
    const sarcophagus = map.props.filter((p) => p.kind === 'sarcophagus');
    const arcaneCrystal = map.props.filter((p) => p.kind === 'arcane_crystal');
    const watchtowers = map.props.filter((p) => p.kind === 'watchtower');
    const graveyardFences = map.props.filter((p) => p.kind === 'graveyard_fence');
    const deadTrees = map.props.filter((p) => p.kind === 'dead_tree');
    const cliffs = map.props.filter((p) => p.kind === 'rock_cliff');

    expect(sarcophagus.length).toBeGreaterThanOrEqual(1);
    expect(arcaneCrystal.length).toBeGreaterThanOrEqual(1);
    expect(watchtowers.length).toBeGreaterThanOrEqual(3); // 2 gate watchtowers + 1 kurhan spire
    expect(graveyardFences.length).toBeGreaterThanOrEqual(10);
    expect(deadTrees.length).toBeGreaterThanOrEqual(4);
    expect(cliffs.length).toBeGreaterThanOrEqual(5);
    expect(map.lights.length).toBeGreaterThanOrEqual(18); // 12 cottages + campfire + shrine + kurhan + lanterns
  });

  it('spawns Slavic NPCs (Król Gniewomir, Kupiec Dobromir, Płatnerz Bożydar, Żerca Radogost) and supports interacting with market stalls, well, and Światowid shrine', () => {
    const game = new CrpgGameState('slavic_village');
    expect(game.map.id).toBe('slavic_village');

    const king = game.npcs.find((n) => n.id === 'npc_gniewko');
    const merchant = game.npcs.find((n) => n.id === 'npc_dobromir');
    const blacksmith = game.npcs.find((n) => n.id === 'npc_bozydar');
    const priest = game.npcs.find((n) => n.id === 'npc_radogost');
    expect(king).toBeDefined();
    expect(merchant).toBeDefined();
    expect(blacksmith).toBeDefined();
    expect(priest).toBeDefined();

    // Start dialogue with Merchant Dobromir
    game.startDialogueWithNpc('npc_dobromir');
    expect(game.activeDialogue).not.toBeNull();
    expect(game.activeDialogue?.node.speakerName).toContain('Dobromir');

    // Interact with the village well
    const well = game.map.props.find((p) => p.kind === 'slavic_well');
    expect(well).toBeDefined();
    if (well) {
      game.togglePropInteraction(well.id);
      expect(game.player.speechBubbleText).toContain('woda');
    }

    // Interact with a market stall carrying merchant wares
    const stallWithGoods = game.map.props.find(
      (p) => p.kind === 'market_stall' && p.lootItems && p.lootItems.length > 0
    );
    expect(stallWithGoods).toBeDefined();
    if (stallWithGoods) {
      game.togglePropInteraction(stallWithGoods.id);
      expect(stallWithGoods.isOpen).toBe(true);
    }
  });

  it('loads earthy verbal-collapse dialogues from asset (free of Witcher copyright) and walks through the "pała / czara goryczy" collapse with Król Gniewomir', async () => {
    const asset = await preloadPrzasneDialoguesAsset();
    expect(asset.kolapsy.length).toBeGreaterThanOrEqual(4);

    const serialized = JSON.stringify(asset).toLowerCase();
    expect(serialized).not.toContain('geralt');
    expect(serialized).not.toContain('foltest');
    expect(serialized).not.toContain('wiedźmin');
    expect(serialized).not.toContain('temeri');

    const gniewkoKolapsy = getPrzasneKolapsyForNpc('npc_gniewko');
    expect(gniewkoKolapsy.length).toBeGreaterThanOrEqual(1);
    expect(gniewkoKolapsy[0].id).toBe('kolaps_pala_goryczy');

    const game = new CrpgGameState('slavic_village');
    game.startDialogueWithNpc('npc_gniewko');
    expect(game.activeDialogue?.node.text).toContain('Przegiąłeś pałę goryczy');

    // Step 1: "Czarę, królu..."
    const step1Choice = game.activeDialogue?.node.choices.find((c) =>
      c.text.includes('Czarę, królu')
    );
    expect(step1Choice).toBeDefined();
    if (step1Choice) {
      game.selectDialogueChoice(step1Choice);
    }
    expect(game.activeDialogue?.node.text).toContain('Jaką kurwa znowu czarę?!');

    // Step 2: "Goryczy, królu, goryczy!"
    const step2Choice = game.activeDialogue?.node.choices.find((c) =>
      c.text.includes('Goryczy, królu, goryczy!')
    );
    expect(step2Choice).toBeDefined();
    if (step2Choice) {
      game.selectDialogueChoice(step2Choice);
    }
    expect(game.activeDialogue?.node.text).toContain(
      'AA tę czarę goryczy, kurwa? Nie łap mnie za słówka, tępy chuju!'
    );

    // Check HudOverlay renders collapsible <details class="dialogue-collapse">
    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;
    const hud = new HudOverlay(fakeRoot, game, scene, { devMode: false });
    hud.render();
    expect(fakeRoot.innerHTML).toContain('class="dialogue-collapse"');
    expect(fakeRoot.innerHTML).toContain('Pała czy czara goryczy?');
  });

  it('allows traveling between forest_clearing and slavic_village via the travel_signpost prop', () => {
    const game = new CrpgGameState('forest_clearing');
    const signpost = game.map.props.find((p) => p.kind === 'travel_signpost');
    expect(signpost).toBeDefined();
    if (!signpost) return;

    game.togglePropInteraction(signpost.id);
    expect(game.map.id).toBe('slavic_village');

    const returnSignpost = game.map.props.find((p) => p.kind === 'travel_signpost');
    expect(returnSignpost).toBeDefined();
    if (!returnSignpost) return;

    game.togglePropInteraction(returnSignpost.id);
    expect(game.map.id).toBe('forest_clearing');
  });

  it('spawns Slavic Bestiary (Leszy, Utopiec, Woj Mogił) and authentic folkloric items in stalls, kurhan and drops', () => {
    const villageGame = new CrpgGameState('slavic_village');
    const skeletonWoj = villageGame.npcs.find((n) => n.id === 'enemy_kurhan_skeleton');
    expect(skeletonWoj).toBeDefined();
    expect(skeletonWoj?.combat?.isHostile).toBe(true);
    expect(skeletonWoj?.combat?.lootTable).toContain('weapon_slavic_axe');
    expect(skeletonWoj?.combat?.lootTable).toContain('trinket_kolowrot');

    // Market stalls contain Slavic items from docs/zestawienie_asset_w_rpg_2d.md
    const smithStall = villageGame.map.props.find((p) => p.id === 'stall_smith_bozydar');
    expect(smithStall?.lootItems).toContain('weapon_slavic_axe');
    expect(smithStall?.lootItems).toContain('offhand_slavic_shield');
    expect(smithStall?.lootItems).toContain('helm_szyszak');
    expect(smithStall?.lootItems).toContain('torso_przeszywanica');
    expect(smithStall?.lootItems).toContain('legs_lapcie');

    const herbalistStall = villageGame.map.props.find((p) => p.id === 'stall_herbalist_wislawa');
    expect(herbalistStall?.lootItems).toContain('item_piolun_herb');
    expect(herbalistStall?.lootItems).toContain('item_dziurawiec_herb');
    expect(herbalistStall?.lootItems).toContain('trinket_motanka');

    const kurhanSarcophagus = villageGame.map.props.find((p) => p.id === 'prop_kurhan_sarcophagus');
    expect(kurhanSarcophagus?.lootItems).toContain('trinket_kolowrot');
    expect(kurhanSarcophagus?.lootItems).toContain('trinket_lunula');

    // Forest Clearing bestiary: Leszy and Utopiec
    const forestGame = new CrpgGameState('forest_clearing');
    const leszy = forestGame.npcs.find((n) => n.id === 'enemy_leszy');
    const utopiec = forestGame.npcs.find((n) => n.id === 'enemy_utopiec');
    expect(leszy).toBeDefined();
    expect(leszy?.combat?.isHostile).toBe(true);
    expect(leszy?.combat?.lootTable).toContain('trinket_motanka');

    expect(utopiec).toBeDefined();
    expect(utopiec?.combat?.isHostile).toBe(true);
    expect(utopiec?.combat?.lootTable).toContain('item_dziurawiec_herb');
    expect(utopiec?.combat?.lootTable).toContain('trinket_lunula');
  });

  it('implements Section 1 Slavic PC/NPC visuals (elder beard, wreath braids, parted hair, kłobuk, giezło z krajką)', () => {
    const game = new CrpgGameState('slavic_village');

    // 1. Radogost with elder beard
    const radogost = game.npcs.find((n) => n.id === 'npc_radogost');
    expect(radogost).toBeDefined();
    expect(radogost?.recipe.hairStyle).toBe('elder_beard');
    expect(radogost?.recipe.equipment.torso).toBe('torso_slavic_giezlo');
    expect(radogost?.recipe.equipment.legs).toBe('legs_lapcie');

    // 2. Wisława with flower wreath and braids
    const wislawa = game.npcs.find((n) => n.id === 'npc_wislawa');
    expect(wislawa).toBeDefined();
    expect(wislawa?.recipe.hairStyle).toBe('wreath_braids');
    expect(wislawa?.recipe.equipment.torso).toBe('torso_slavic_giezlo');

    // 3. Sambor with felt kłobuk and parted hair
    const sambor = game.npcs.find((n) => n.id === 'npc_sambor');
    expect(sambor).toBeDefined();
    expect(sambor?.recipe.hairStyle).toBe('slavic_parted');
    expect(sambor?.recipe.equipment.head).toBe('helm_klobuk');
    expect(sambor?.recipe.equipment.torso).toBe('torso_slavic_giezlo');

    // Test dialogue interactions for new Slavic villagers
    game.startDialogueWithNpc('npc_wislawa');
    expect(game.activeDialogue?.node.speakerName).toBe('Zielarka Wisława');
    expect(game.activeDialogue?.node.text).toContain('wianki');

    game.startDialogueWithNpc('npc_sambor');
    expect(game.activeDialogue?.node.speakerName).toBe('Kmieć Sambor');
    expect(game.activeDialogue?.node.text).toContain('kłobukiem');

    // Verify bakery buffers bake cleanly for all new Slavic hairstyles and equipment
    const bakedRadogost = bakeCharacterBuffers(radogost!.recipe);
    expect(bakedRadogost.albedoRGBA.length).toBeGreaterThan(0);
    expect(bakedRadogost.normalMaterialRGBA.length).toBeGreaterThan(0);

    const bakedWisława = bakeCharacterBuffers(wislawa!.recipe);
    expect(bakedWisława.albedoRGBA.length).toBeGreaterThan(0);

    const bakedSambor = bakeCharacterBuffers(sambor!.recipe);
    expect(bakedSambor.albedoRGBA.length).toBeGreaterThan(0);
  });
});
