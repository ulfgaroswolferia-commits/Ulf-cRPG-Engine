# Ulf-cRPG-Engine — Isometric 2.5D Browser cRPG Engine Design Specification

**Date:** 2026-11-06  
**Engine Name:** `Ulf-cRPG-Engine`  
**Project:** `RPG2` (`C:\Users\jgorski\Projekty\RPG2`)  
**Tech Stack:** TypeScript 5, Vite, PixiJS v8 (WebGL2 Multi-Pass Deferred 2.5D Pipeline + Custom GLSL Shaders), Vitest  
**References Incorporated:**
1. *Creating Isometric Worlds: A Primer for Game Developers* (Juwal Bose / Envato Tuts+)
2. *Woes of Isometry* (Riho Peterson / *Office Management 101*, IndieDB)
3. *Rotating a 2.5D Isometric Map* (Riho Peterson / *Office Management 101*, IndieDB)
4. *Generating Random Isometric Characters* (Riho Peterson / *Office Management 101*, IndieDB)

---

## 1. Architecture Overview

The engine is designed as a modular, high-visual-fidelity **Hybrid 2.5D Isometric cRPG Engine** running in the browser on WebGL2 via **PixiJS v8** and custom GLSL shaders. It strictly decouples deterministic mathematical/gameplay logic (`src/core/`, `src/rpg/`) from GPU rendering and procedural PBR texture synthesis (`src/renderer/`, `src/assets/`), while providing an interactive Dark Fantasy cRPG UI & Engine Inspector overlay (`src/ui/`).

```
src/
├── core/
│   ├── isoMath.ts            # 2:1 Diamond isometric projection, elevation Z, screen <-> grid raycasting
│   ├── mapRotation.ts        # 4-way (0°, 90°, 180°, 270°) coordinate & multi-tile footprint rotation
│   ├── depthSorter.ts        # Topological DAG Painter's Sorter solving multi-tile & elevation overlap ("Woes of Isometry")
│   ├── pathfinding.ts        # 8-directional 3D A* pathfinder with elevation step constraints & dynamic obstacles
│   ├── fov.ts                # Recursive shadowcasting / Bresenham Line-of-Sight & Fog of War state
│   └── worldMap.ts           # Multi-layer tile elevation grid, static/interactive props, doors, lights, triggers
├── assets/
│   ├── proceduralForge.ts    # Runtime procedural PBR texture generator (Albedo + Normal + Height/Roughness/Metallic)
│   ├── characterBakery.ts    # Modular isometric character composer & texture atlas baker (8 dirs, animations, seed RNG)
│   └── assetRegistry.ts      # Unified registry supporting both procedural PBR atlases and external PNG/JSON sprite sheets
├── renderer/
│   ├── deferredPipeline.ts   # Multi-pass G-Buffer (Albedo FBO + Normal/Height/Material FBO -> Deferred Lighting & Post-FX)
│   ├── shaders/
│   │   ├── deferredLight.frag.ts # GLSL PBR point/directional lighting, 2.5D height-raymarched shadows, fog of war, bloom/tonemap
│   │   └── wallCutaway.frag.ts   # GLSL X-ray dithered radial cutaway mask for walls occluding characters/cursor
│   ├── particleSystem.ts     # Torch embers, arcane crystal motes, dust, spell/interaction bursts
│   └── isoSceneView.ts       # PixiJS v8 viewport controller (smooth pan, zoom, 90° camera rotation animation, mouse picking)
├── rpg/
│   ├── characterData.ts      # Attributes, equipment slots, item definitions, visual layer descriptors & palettes
│   ├── dialogueSystem.ts     # Branching cRPG dialogues with skill/attribute checks and world triggers
│   └── gameLoop.ts           # Deterministic state controller: player movement, NPC patrols, door/chest/torch interactions, combat/actions
└── ui/
    ├── hudOverlay.ts         # Dark Fantasy cRPG HUD: portraits, action bar, combat/event log, dialogue modal, inventory/paperdoll
    └── inspectorPanel.ts     # Live Engine Inspector: G-Buffer view switcher, lighting sliders, random NPC generator, map builder tools
```

---

## 2. Core Subsystems & Mathematical Foundations

### 2.1. Isometric Projection & Elevation (`src/core/isoMath.ts`)
- **Base Tile Ratio:** True 2:1 game isometric projection (`TILE_WIDTH = 128`, `TILE_HEIGHT = 64`, `ELEVATION_STEP_PX = 24`).
- **Forward Projection:** Given rotated map coordinates $(rx, ry)$ and world elevation $z$:
  $$S_x = (rx - ry) \cdot \frac{W_{tile}}{2}$$
  $$S_y = (rx + ry) \cdot \frac{H_{tile}}{2} - z \cdot H_{elev}$$
- **Inverse Projection & Elevation-Aware Raycasting:** Converts screen $(S_x, S_y)$ back to fractional $(rx, ry)$ by testing candidate elevation planes from $z_{max}$ down to $0$, ensuring clicking on raised platforms, stairs, or tall pillars selects the accurate 3D tile rather than the ground plane behind it.

### 2.2. 4-Way 2.5D Map & Multi-Tile Rotation (`src/core/mapRotation.ts`)
Directly implements the coordinate transformation principles from *Rotating a 2.5D Isometric Map*:
- **Grid Coordinate Remapping** for a map of size $W \times H$ at rotation $r \in \{0, 1, 2, 3\}$ (`N`, `E`, `S`, `W`):
  - $r = 0\ (0^\circ)$: $(rx, ry) = (x, y)$
  - $r = 1\ (90^\circ\text{ CW})$: $(rx, ry) = (H - 1 - y, x)$
  - $r = 2\ (180^\circ)$: $(rx, ry) = (W - 1 - x, H - 1 - y)$
  - $r = 3\ (270^\circ\text{ CW})$: $(rx, ry) = (y, W - 1 - x)$
- **Multi-Tile Object Footprint & Anchor Correction:**
  - An object with base logical origin $(x_0, y_0)$ and dimensions $(s_x, s_y)$ occupies $[x_0, x_0 + s_x - 1] \times [y_0, y_0 + s_y - 1]$.
  - Under rotation $r$, its rotated bounding box $[rx_{min}, rx_{max}] \times [ry_{min}, ry_{max}]$ is computed over all 4 corners so the new top-most/back-most origin $(rx_{min}, ry_{min})$ and rotated footprint $(rs_x, rs_y)$ are exact.
  - Directional orientation $d \in [0..7]$ shifts by $(d + 2r) \bmod 8$, selecting the matching directional sprite and rotating tangent-space normal vectors $(N_x, N_y)$ so dynamic lighting remains physically consistent from every camera angle.

### 2.3. Topological Depth Sorting & Occlusion (`src/core/depthSorter.ts`)
Solves the classic rendering artifacts described in *Woes of Isometry*:
- Every renderable entity in the current view frustum is represented by its rotated 3D bounding box:
  $$B_i = [rx_{min}, rx_{max}] \times [ry_{min}, ry_{max}] \times [z_{min}, z_{max}]$$
- **Pairwise Behind/Front Relation:** Entity $A$ must be drawn before Entity $B$ ($A \prec B$) if their 2D screen projections overlap and:
  1. $A$ is strictly lower in elevation ($A.z_{max} \le B.z_{min}$), OR
  2. Their $Z$ intervals overlap and $A$ lies behind $B$ along the isometric depth axis ($A.rx_{min} < B.rx_{max}$ and $A.ry_{min} < B.ry_{max}$ and $(A.rx_{max} \le B.rx_{min} \lor A.ry_{max} \le B.ry_{min})$).
- **DAG Topological Sort with Cycle Tie-Breaking:** Constructs the directed dependency graph and executes a deterministic topological sort (using centroid depth $rx_{center} + ry_{center} + z_{center} \cdot 0.1$ as a deterministic tie-breaker).
- **Dynamic Wall Cutaway (`wallCutaway`):** Tall wall and pillar entities overlapping the screen-space radius around the player character or hovered interactive tile receive an automatic smooth dithered/radial alpha cutout so they never block gameplay visibility.

### 2.4. Modular Isometric Character Generation & Texture Baking (`src/assets/characterBakery.ts`)
Implements the architecture from *Generating Random Isometric Characters* (*Office Management 101*):
- **Standardized Layer Rig:** Every humanoid character is composed of aligned modular layers:
  1. `body` (skin tone, build)
  2. `legs` (boots, greaves, trousers)
  3. `torso` (tunic, leather brigandine, plate cuirass, mage robes)
  4. `cloak` (shoulder cape, pauldrons)
  5. `head` (hair style/beard or helmet/hood — with compatibility rules hiding hair under full helmets)
  6. `mainHand` (longsword, battleaxe, rune staff, dagger, torch)
  7. `offHand` (kite shield, buckler, spell tome, none)
- **8-Directional Pose & Animation Synthesis:** Generates 8 isometric directions (`N, NE, E, SE, S, SW, W, NW`) across `Idle` (4 frames), `Walk` (6 frames), and `Action/Attack` (4 frames).
- **Unified Atlas Baking (Albedo + Normal/Material):**
  - Instead of rendering 7 sprites per character per frame, `CharacterBakery.bakeCharacter(recipe)` composites all layers in proper front-to-back order per direction into a **single unified Albedo spritesheet** and a **single unified Normal+Material spritesheet** (`R=Nx, G=Ny, B=Roughness, A=Metallic/Height`).
  - Cached by deterministic recipe hash; changing an item in the player's inventory re-bakes the character's texture in `< 5 ms` and updates both the map sprite and the UI paperdoll portrait.

### 2.5. Multi-Pass Deferred 2.5D PBR Lighting & Shadow Pipeline (`src/renderer/deferredPipeline.ts`)
- **G-Buffer Pass 1 (`albedoTexture`):** Renders sorted tiles, props, characters, and particles using their Albedo textures.
- **G-Buffer Pass 2 (`normalMaterialTexture`):** Synchronously renders the scene using each entity's Normal + Material map (`R=Nx, G=Ny, B=Roughness, A=Metallic`).
- **Pass 3 (`deferredLight.frag.ts`):** Full-screen WebGL2 shader combining:
  - Ambient + Moonlight directional illumination,
  - Up to 16 dynamic point lights (flickering warm wall torches, pulsing cyan arcane crystals, player lantern/spell light) with physically plausible normal-mapped diffuse + Blinn-Phong/GGX specular highlights on metallic armor and wet stone,
  - **Screen-Space 2.5D Contact & Raymarched Shadows** cast away from point lights,
  - **Smooth Fog of War & Line-of-Sight Mask** (`unexplored` = deep shadow, `explored/shrouded` = desaturated cold memory, `visible` = full dynamic lighting),
  - **Atmospheric Post-Processing:** Subtle bloom on emissive crystals/torches, ACES filmic tone mapping, and vignette.

---

## 3. cRPG Vertical Slice & Live Engine Inspector

### 3.1. Playable Dark Fantasy Vertical Slice ("Sanctum of the Sunken Crown")
- A rich multi-elevation isometric map ($20 \times 20$ tiles) featuring:
  - **Upper Courtyard & Ruined Ramparts** ($Z=2, 3$) connected via carved stone stairs to the **Sanctum Hall** ($Z=0, 1$) and **Arcane Vault**,
  - **Interactive Doors & Portcullises** that dynamically block/unblock both A* pathfinding and Line-of-Sight (`fov.ts`),
  - **Interactive Torches & Arcane Brazier** (toggleable on/off to immediately demonstrate real-time normal-mapped lighting and shadow recalculation),
  - **Treasure Chests & Lootable Relics** containing wearable armor, helmets, cloaks, shields, and weapons that change the character's baked isometric appearance and stats on the fly,
  - **3 Modular NPCs** (Captain Vaelen, Scholar Lyra, and a Patrol Guard) with branching dialogue, lore/perception checks, and patrol routines, plus a button to spawn randomly generated NPCs using `CharacterBakery`.

### 3.2. Live Engine Inspector & Map Tooling (`src/ui/inspectorPanel.ts`)
- **Render Buffer Switcher:** Switch live between `Final PBR Render`, `Raw Albedo Pass`, `Normal + Material Map Pass`, `Depth Order Visualization`, and `FOV / Walkability Grid`.
- **Camera & Rotation Controls:** `Q` / `E` keys or UI buttons for smooth 90° map rotation (`0° N`, `90° E`, `180° S`, `270° W`), zoom (`Mouse Wheel`), pan (`WASD` / `Middle-Click` / `Right-Click Drag`), and wall cutaway toggle.
- **Character Customizer & Randomizer:** Seed-based random isometric character generator + manual layer/palette editor with live bake time metrics.
- **Live Map & Lighting Editor Mode:** Place/remove point lights, adjust ambient/torch intensity, or raise/lower tile elevation in real time.

---

## 4. Error Handling & Testing Strategy

- **Unit & Integration Test Suite (`Vitest`):**
  1. `isoMath.test.ts`: Forward/inverse projection accuracy and elevation-aware raycasting.
  2. `mapRotation.test.ts`: 4-way rotation bijection (rotating 4× by 90° returns original coordinates and footprints), multi-tile ($2 \times 1$, $2 \times 2$) anchor recalculation, and directional index shifts.
  3. `depthSorter.test.ts`: Topological ordering correctness for characters in front of/behind walls, on stairs, and adjacent to $2 \times 1$ multi-tile objects without infinite loops on cyclic overlaps.
  4. `pathfinding.test.ts`: 3D A* pathfinding around walls, through open vs. closed doors, and across valid stair elevation steps ($\Delta Z \le 1$) vs. impassable cliffs ($\Delta Z > 1$).
  5. `fov.test.ts`: Symmetric line-of-sight blocking by walls/closed doors and opening when doors open.
  6. `characterBakery.test.ts`: Deterministic seed generation, equipment compatibility rules (full helmet hiding hair), and recipe hash caching.
- **Browser & WebGL Verification:** Automated build check (`tsc --noEmit && vite build`) + live headless/browser verification ensuring 0 console/shader errors and smooth rendering across all G-Buffer passes.
