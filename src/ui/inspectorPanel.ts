import { PropKind, TileTerrainType } from '../core/worldMap';
import { RenderBufferMode } from '../renderer/deferredPipeline';
import {
  EditorPropOrientation,
  InspectorToolMode,
  IsoSceneView
} from '../renderer/isoSceneView';
import { EnemyDifficultyTier } from '../rpg/combatSystem';
import { CrpgGameState } from '../rpg/gameLoop';

const BUFFER_MODES: ReadonlyArray<{ id: RenderBufferMode; label: string; desc: string }> = [
  {
    id: 'final_pbr',
    label: '1. Final PBR 2.5D Render',
    desc: 'Pełne oświetlenie Normal-Map, cienie rzucane, cząsteczki i Mgła Wojny'
  },
  {
    id: 'albedo_only',
    label: '2. Raw Albedo Pass',
    desc: 'Czysty bufor koloru bazowego (Diffuse) bez cieniowania dynamicznego'
  },
  {
    id: 'normal_map',
    label: '3. Normal + Material Map',
    desc: 'Wektory normalne (R=Nx, G=Ny) oraz chropowatość/metaliczność (B/A)'
  },
  {
    id: 'depth_dag',
    label: '4. Topological Depth DAG',
    desc: 'Wizualizacja kolejności rysowania Painter DAG (rozwiązanie Woes of Isometry)'
  },
  {
    id: 'walkability_fov',
    label: '5. 3D NavGrid & LOS',
    desc: 'Siatka kolizji A* 3D oraz widoczność Line-of-Sight'
  }
];

const EDITOR_TOOLS: ReadonlyArray<{ id: InspectorToolMode; label: string }> = [
  { id: 'interact', label: '🖱️ Rozgrywka cRPG (Ruch / Interakcja)' },
  { id: 'paint_terrain', label: '🎨 Maluj Teren (9 Biomów PBR)' },
  { id: 'raise_elevation', label: '⛰️ Podnieś Wysokość Kafla (Z + 1)' },
  { id: 'lower_elevation', label: '🕳️ Obniż Wysokość Kafla (Z - 1)' },
  { id: 'flatten_elevation', label: '📏 Wyrównaj Wysokość do Z' },
  { id: 'place_prop', label: '🌲 Postaw Obiekt (Glionox / Slavic / Dungeon)' },
  { id: 'remove_prop', label: '🗑️ Usuń Obiekt z Kafla' },
  { id: 'place_torch_light', label: '🔥 Dodaj Światło Pochodni (PBR)' },
  { id: 'place_arcane_light', label: '💎 Dodaj Światło Eteryczne (PBR)' },
  { id: 'remove_light', label: '🌑 Usuń Źródło Światła PBR' },
  { id: 'spawn_npc', label: '🧑 Postaw NPC na Kaflu' },
  { id: 'spawn_enemy', label: '⚔️ Postaw Wroga (Łatwy / Normalny / Boss)' }
];

const TERRAIN_OPTIONS: ReadonlyArray<{ id: TileTerrainType; label: string }> = [
  { id: 'forest_grass', label: '🌿 Trawa Leśna (Glionox Forest Grass)' },
  { id: 'dirt_path', label: '🛤️ Trakt Ziemny (Dirt Path)' },
  { id: 'forest_soil', label: '🍂 Ściółka i Czarnoziem (Forest Soil)' },
  { id: 'mossy_cobble', label: '🪨Omszały Bruk Grodowy (Mossy Cobble)' },
  { id: 'dungeon_stone', label: '🧱 Kamień Lochów (Dungeon Stone)' },
  { id: 'sanctum_marble', label: '🏛️ Marmur Sanktuarium (Sanctum Marble)' },
  { id: 'arcane_inlay', label: '✨ Runiczny Krąg (Arcane Inlay)' },
  { id: 'stairs_stone', label: '🪜 Kamienne Stopnie (Stairs Stone)' },
  { id: 'abyss_water', label: '🌊 Głęboka Woda / Strumień (Nieprzechodnia)' }
];

const PROP_OPTIONS: ReadonlyArray<{ id: PropKind; label: string; maxVariants: number }> = [
  { id: 'pine_tree', label: '🌲 Drzewo Leśne OGA & Glionox (Warianty 0..18)', maxVariants: 19 },
  { id: 'ancient_oak', label: '🌳 Prastary Dąb OGA & Glionox (Warianty 0..18)', maxVariants: 19 },
  { id: 'dead_tree', label: '🥀 Uschnięte Drzewo Moczaru OGA (Warianty 0..9)', maxVariants: 10 },
  { id: 'tree_stump', label: '🪵 Pniak Leśny Glionox (Warianty 0..8)', maxVariants: 9 },
  { id: 'berry_bush', label: '🫐 Krzew Leśny OGA & Glionox (Warianty 0..15)', maxVariants: 16 },
  { id: 'wildflower_patch', label: '🌼 Kwiaty i Trawy OGA & Glionox (Warianty 0..39)', maxVariants: 40 },
  { id: 'slavic_cottage', label: '🏠 Słowiańska Chata / Dwór OGA (Warianty 0..15, 2×1 / 1×2)', maxVariants: 16 },
  { id: 'watchtower', label: '🏰 Kamienna Baszta Strażnicza Game Kit (Warianty 0..2)', maxVariants: 3 },
  { id: 'rock_cliff', label: '🪨 Skalna Skarpa / Głaz OGA (Warianty 0..7)', maxVariants: 8 },
  { id: 'market_stall', label: '🎪 Kram Kupiecki z Suknem (2×1 / 1×2)', maxVariants: 3 },
  { id: 'slavic_shrine', label: '🗿 Posąg Światowida (Czterotwarzowy Idol)', maxVariants: 1 },
  { id: 'slavic_well', label: '💧 Studnia Grodowa z Żurawiem & Daszkiem OGA', maxVariants: 1 },
  { id: 'wattle_fence', label: '🚧 Pleciony Płot Wiklinowy / Drewniany OGA', maxVariants: 4 },
  { id: 'graveyard_fence', label: '⚰️ Kute Ogrodzenie Cmentarne / Brama OGA (0..15)', maxVariants: 16 },
  { id: 'travel_signpost', label: '🪧 Drogowskaz Podróży / Kapliczka OGA (0..1)', maxVariants: 2 },
  { id: 'campfire', label: '🔥 Ognisko Obozowe (Pieczenie Kiełbasy + PBR)', maxVariants: 1 },
  { id: 'ranger_tent', label: '⛺ Namiot Zwiadowców (2×1 / 1×2)', maxVariants: 1 },
  { id: 'fallen_log', label: '🪵 Powalony Pień (1×2 / 2×1)', maxVariants: 1 },
  { id: 'wall_block', label: '🧱 Mur Kamienny (Wall Cutaway X-Ray)', maxVariants: 1 },
  { id: 'pillar', label: '🏛️ Kolumna Rzeźbiona & Obelisk OGA (0..8)', maxVariants: 9 },
  { id: 'door', label: '🚪 Wrota Interaktywne (Otwierane)', maxVariants: 1 },
  { id: 'torch_sconce', label: '🕯️ Pochodnia / Latarnia Słupowa OGA (0..1)', maxVariants: 2 },
  { id: 'arcane_crystal', label: '💎 Monolit Astralny (+Światło PBR)', maxVariants: 1 },
  { id: 'chest', label: '🧰 Okuta Skrzynia & Skrzynie Drewniane OGA (0..3)', maxVariants: 4 },
  { id: 'runic_altar', label: '⛩️ Ołtarz Runiczny (2×1)', maxVariants: 1 },
  { id: 'sarcophagus', label: '⚰️ Sarkofag Królewski (1×2)', maxVariants: 1 },
  { id: 'dungeon_barrel', label: '🛢️ Beczka Lochów Kenney CC0 (Warianty 0..1)', maxVariants: 2 },
  { id: 'dungeon_crate', label: '📦 Skrzynia Drewniana Lochów Kenney CC0 (Warianty 0..1)', maxVariants: 2 },
  { id: 'dungeon_table', label: '🪵 Okrągły Stół z Ławami Kenney CC0 (Wariant 0)', maxVariants: 1 },
  { id: 'dungeon_support', label: '⛏️ Drewniana Podpora Kopalniana Kenney CC0 (Wariant 0)', maxVariants: 1 },
  { id: 'dungeon_column', label: '🏛️ Kamienna Kolumna Lochów Kenney CC0 (Wariant 0)', maxVariants: 1 }
];

export class InspectorPanel {
  private readonly root: HTMLElement;
  private readonly game: CrpgGameState;
  private readonly scene: IsoSceneView;
  private readonly onStateChange: () => void;
  private collapsed = false;

  constructor(
    root: HTMLElement,
    game: CrpgGameState,
    scene: IsoSceneView,
    onStateChange: () => void
  ) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.onStateChange = onStateChange;
  }

  public render(): void {
    if (this.collapsed) {
      this.root.innerHTML = `
        <button class="inspector-expand-btn" id="expand-inspector">
          ⚙️ Ulf-cRPG-Engine Inspector & Level Editor
        </button>
      `;
      this.root.querySelector('#expand-inspector')?.addEventListener('click', () => {
        this.collapsed = false;
        this.render();
      });
      return;
    }

    const activePropMeta =
      PROP_OPTIONS.find((p) => p.id === this.scene.editorPropKind) ?? PROP_OPTIONS[0];

    this.root.innerHTML = `
      <aside class="inspector-card">
        <div class="inspector-header">
          <div>
            <h2>🛠️ Edytor Poziomów (Level Editor)</h2>
            <span class="inspector-sub">Projektowanie mapy ${this.game.map.width}×${this.game.map.height}, Teren, Obiekty Glionox/Slavic & JSON</span>
          </div>
          <button class="btn-icon" id="collapse-inspector" title="Zwiń panel edytora">–</button>
        </div>

        <div class="inspector-section">
          <div class="section-title">1. Narzędzie Kursora (Kliknij lub Przeciągnij LPM na Mapie)</div>
          <div class="tool-list editor-tool-grid">
            ${EDITOR_TOOLS.map(
              (t) => `
              <button class="tool-btn ${this.scene.activeTool === t.id ? 'active' : ''}" data-tool="${t.id}">
                ${t.label}
              </button>
            `
            ).join('')}
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">2. Pędzel Terenu i Wysokości (Z)</div>

          <label class="Inspector-slider-row">
            <span>Wybierz teren (9 biomów PBR):</span>
            <select id="editor-terrain-select" class="dark-select">
              ${TERRAIN_OPTIONS.map(
                (t) =>
                  `<option value="${t.id}" ${this.scene.editorTerrainType === t.id ? 'selected' : ''}>${t.label}</option>`
              ).join('')}
            </select>
          </label>

          <div class="quick-chip-grid" style="margin: 6px 0;">
            ${TERRAIN_OPTIONS.map(
              (t) => `
              <button type="button" class="quick-chip-btn ${this.scene.editorTerrainType === t.id && this.scene.activeTool === 'paint_terrain' ? 'active' : ''}" data-quick-terrain="${t.id}" title="${t.label}">
                ${t.label.split('(')[0].trim()}
              </button>
            `
            ).join('')}
          </div>

          <div style="display:flex; gap:8px; align-items:center; margin: 6px 0;">
            <label class="inspector-checkbox" style="margin:0; flex:1;">
              <input type="checkbox" id="editor-terrain-walkable" ${this.scene.editorTerrainWalkable ? 'checked' : ''} />
              <span>Kafel przechodni (Walkable)</span>
            </label>
            <select id="editor-brush-size" class="dark-select" title="Rozmiar pędzla terenu i wysokości">
              <option value="1" ${this.scene.editorBrushSize === 1 ? 'selected' : ''}>Pędzel 1×1</option>
              <option value="3" ${this.scene.editorBrushSize === 3 ? 'selected' : ''}>Pędzel 3×3</option>
            </select>
          </div>

          <label class="Inspector-slider-row">
            <span>Docelowa wysokość wyrównania (Z): <strong>${this.scene.editorTargetElevation}</strong></span>
            <input type="range" id="editor-target-z" min="0" max="4" step="1" value="${this.scene.editorTargetElevation}" />
          </label>

          <div style="display:flex; gap:6px; margin-top:6px;">
            <button type="button" class="tool-btn" id="fill-terrain-btn" style="flex:1; text-align:center;" title="Wypełnij całą siatkę mapy wybranym terenem">
              🪣 Wypełnij Całą Mapę
            </button>
            <button type="button" class="tool-btn" id="flatten-all-btn" style="flex:1; text-align:center;" title="Wyrównaj wysokość wszystkich kafli do Z=0">
              📏 Spłaszcz Mapę (Z=0)
            </button>
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">3. Katalog Obiektów i Spawner Postaci</div>

          <label class="Inspector-slider-row">
            <span>Obiekt do postawienia:</span>
            <select id="editor-prop-select" class="dark-select">
              ${PROP_OPTIONS.map(
                (p) =>
                  `<option value="${p.id}" ${this.scene.editorPropKind === p.id ? 'selected' : ''}>${p.label}</option>`
              ).join('')}
            </select>
          </label>

          <div style="display:flex; gap:8px; align-items:center; margin: 6px 0;">
            <label class="Inspector-slider-row" style="margin:0; flex:1;">
              <span>Wariant (#0..${Math.max(0, activePropMeta.maxVariants - 1)}): <strong>${this.scene.editorPropVariant}</strong></span>
              <input type="range" id="editor-prop-variant" min="0" max="${Math.max(0, activePropMeta.maxVariants - 1)}" step="1" value="${Math.min(this.scene.editorPropVariant, Math.max(0, activePropMeta.maxVariants - 1))}" />
            </label>
            <select id="editor-prop-orientation" class="dark-select" title="Orientacja obiektu wielopolowego (Klawisz R)">
              <option value="1x1" ${this.scene.editorPropOrientation === '1x1' ? 'selected' : ''}>1×1</option>
              <option value="2x1" ${this.scene.editorPropOrientation === '2x1' ? 'selected' : ''}>2×1</option>
              <option value="1x2" ${this.scene.editorPropOrientation === '1x2' ? 'selected' : ''}>1×2</option>
            </select>
          </div>

          <label class="Inspector-slider-row" style="margin-top:6px;">
            <span>Trudność spawnowanego wroga:</span>
            <select id="editor-enemy-diff" class="dark-select">
              <option value="easy" ${this.scene.editorEnemyDifficulty === 'easy' ? 'selected' : ''}>🟢 Łatwy (Maruder Szlaku)</option>
              <option value="normal" ${this.scene.editorEnemyDifficulty === 'normal' ? 'selected' : ''}>🟡 Normalny (Najemny Wiarus)</option>
              <option value="very_hard" ${this.scene.editorEnemyDifficulty === 'very_hard' ? 'selected' : ''}>🔴 Bardzo Trudny (Upadły Czempion)</option>
            </select>
          </label>

          <div style="display:flex; gap:6px; margin-top:8px;">
            <button type="button" class="tool-btn" id="clear-entities-btn" style="flex:1; text-align:center;" title="Usuń wszystkie obiekty, światła i NPC z mapy">
              🧹 Wyczyść Obiekty i NPC
            </button>
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">4. Zapis / Wczytanie Mapy (JSON)</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="tool-btn" id="export-map-json" style="flex:1; text-align:center;">
              💾 Eksportuj JSON
            </button>
            <button type="button" class="tool-btn" id="import-map-json" style="flex:1; text-align:center;">
              📂 Wczytaj JSON
            </button>
            <button type="button" class="tool-btn" id="reset-map-btn" style="flex:1; text-align:center;">
              🔄 Resetuj Mapę
            </button>
            <input type="file" id="import-map-file-input" accept=".json,application/json" style="display:none;" />
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">Potok Renderowania (G-Buffer Pass)</div>
          <div class="buffer-mode-list">
            ${BUFFER_MODES.map(
              (m) => `
              <button class="buffer-btn ${this.scene.bufferMode === m.id ? 'active' : ''}" data-buffer="${m.id}">
                <div class="buffer-btn-title">${m.label}</div>
                <div class="buffer-btn-desc">${m.desc}</div>
              </button>
            `
            ).join('')}
          </div>
        </div>

        <div class="inspector-section">
          <div class="section-title">Parametry Oświetlenia & Izometrii</div>
          <label class="Inspector-slider-row">
            <span>Światło Otoczenia (Ambient): <strong>${Math.round(this.game.ambientLightIntensity * 100)}%</strong></span>
            <input type="range" id="ambient-slider" min="10" max="100" value="${Math.round(this.game.ambientLightIntensity * 100)}" />
          </label>

          <label class="inspector-checkbox">
            <input type="checkbox" id="toggle-fow" ${this.game.fogOfWarEnabled ? 'checked' : ''} />
            <span>Mgła Wojny & Line-of-Sight (Bresenham)</span>
          </label>

          <label class="inspector-checkbox">
            <input type="checkbox" id="toggle-cutaway" ${this.game.wallCutawayEnabled ? 'checked' : ''} />
            <span>X-Ray Prześwitywanie Ścian (Wall Cutaway)</span>
          </label>

          <label class="inspector-checkbox">
            <input type="checkbox" id="toggle-edge-pan" ${this.scene.edgePanEnabled ? 'checked' : ''} />
            <span>Czułość na Krańce Ekranu (Edge Panning)</span>
          </label>

          <label class="Inspector-slider-row" style="margin-top: 8px; margin-bottom: 0;">
            <span>Prędkość Krawędzi (Edge Speed): <strong>${this.scene.edgePanSpeed} px/s</strong></span>
            <input type="range" id="edge-speed-slider" min="200" max="900" step="20" value="${this.scene.edgePanSpeed}" />
          </label>
        </div>
      </aside>
    `;

    this.root.querySelector('#collapse-inspector')?.addEventListener('click', () => {
      this.collapsed = true;
      this.render();
    });

    this.root.querySelectorAll<HTMLElement>('[data-buffer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.buffer as RenderBufferMode;
        this.scene.bufferMode = mode;
        this.game.addLog(`Przełączono bufor renderowania na: ${mode}.`);
        this.onStateChange();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool as InspectorToolMode;
        this.scene.activeTool = tool;
        this.onStateChange();
      });
    });

    const terrainSelect = this.root.querySelector<HTMLSelectElement>('#editor-terrain-select');
    if (terrainSelect) {
      terrainSelect.addEventListener('change', () => {
        this.scene.editorTerrainType = terrainSelect.value as TileTerrainType;
        this.scene.activeTool = 'paint_terrain';
        this.render();
      });
    }

    const walkableCheck = this.root.querySelector<HTMLInputElement>('#editor-terrain-walkable');
    if (walkableCheck) {
      walkableCheck.addEventListener('change', () => {
        this.scene.editorTerrainWalkable = walkableCheck.checked;
      });
    }

    const brushSelect = this.root.querySelector<HTMLSelectElement>('#editor-brush-size');
    if (brushSelect) {
      brushSelect.addEventListener('change', () => {
        this.scene.editorBrushSize = Number(brushSelect.value) === 3 ? 3 : 1;
        this.render();
      });
    }

    const targetZSlider = this.root.querySelector<HTMLInputElement>('#editor-target-z');
    if (targetZSlider) {
      targetZSlider.addEventListener('input', () => {
        this.scene.editorTargetElevation = Number(targetZSlider.value);
        this.scene.activeTool = 'flatten_elevation';
        const label = targetZSlider.closest('label')?.querySelector('strong');
        if (label) label.textContent = String(this.scene.editorTargetElevation);
      });
    }

    const propSelect = this.root.querySelector<HTMLSelectElement>('#editor-prop-select');
    if (propSelect) {
      propSelect.addEventListener('change', () => {
        this.scene.editorPropKind = propSelect.value as PropKind;
        this.scene.editorPropVariant = 0;
        this.scene.activeTool = 'place_prop';
        if (
          ['slavic_cottage', 'market_stall', 'ranger_tent', 'runic_altar'].includes(
            this.scene.editorPropKind
          )
        ) {
          this.scene.editorPropOrientation = '2x1';
        } else if (['sarcophagus', 'fallen_log'].includes(this.scene.editorPropKind)) {
          this.scene.editorPropOrientation = '1x2';
        } else {
          this.scene.editorPropOrientation = '1x1';
        }
        this.render();
      });
    }

    const propVariantSlider = this.root.querySelector<HTMLInputElement>('#editor-prop-variant');
    if (propVariantSlider) {
      propVariantSlider.addEventListener('input', () => {
        this.scene.editorPropVariant = Number(propVariantSlider.value);
        this.scene.activeTool = 'place_prop';
        const label = propVariantSlider.closest('label')?.querySelector('strong');
        if (label) label.textContent = String(this.scene.editorPropVariant);
      });
    }

    const propOrientSelect = this.root.querySelector<HTMLSelectElement>('#editor-prop-orientation');
    if (propOrientSelect) {
      propOrientSelect.addEventListener('change', () => {
        this.scene.editorPropOrientation = propOrientSelect.value as EditorPropOrientation;
        this.scene.activeTool = 'place_prop';
        this.render();
      });
    }

    const enemyDiffSelect = this.root.querySelector<HTMLSelectElement>('#editor-enemy-diff');
    if (enemyDiffSelect) {
      enemyDiffSelect.addEventListener('change', () => {
        this.scene.editorEnemyDifficulty = enemyDiffSelect.value as EnemyDifficultyTier;
        this.scene.activeTool = 'spawn_enemy';
        this.render();
      });
    }

    const exportBtn = this.root.querySelector<HTMLButtonElement>('#export-map-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = this.scene.exportMapToJson();
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(json).catch(() => {});
        }
        if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.game.map.id}_edited.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
        this.game.addLog(`[Edytor] Wyeksportowano mapę „${this.game.map.id}” do pliku JSON.`);
        this.onStateChange();
      });
    }

    const resetBtn = this.root.querySelector<HTMLButtonElement>('#reset-map-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.scene.resetCurrentMap();
      });
    }

    this.root.querySelectorAll<HTMLElement>('[data-quick-terrain]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const terr = chip.dataset.quickTerrain as TileTerrainType | undefined;
        if (terr) {
          this.scene.editorTerrainType = terr;
          this.scene.activeTool = 'paint_terrain';
          this.onStateChange();
        }
      });
    });

    const fillTerrainBtn = this.root.querySelector<HTMLButtonElement>('#fill-terrain-btn');
    if (fillTerrainBtn) {
      fillTerrainBtn.addEventListener('click', () => {
        this.scene.fillMapTerrain();
      });
    }

    const flattenAllBtn = this.root.querySelector<HTMLButtonElement>('#flatten-all-btn');
    if (flattenAllBtn) {
      flattenAllBtn.addEventListener('click', () => {
        this.scene.flattenAllMapElevation(0);
      });
    }

    const clearEntitiesBtn = this.root.querySelector<HTMLButtonElement>('#clear-entities-btn');
    if (clearEntitiesBtn) {
      clearEntitiesBtn.addEventListener('click', () => {
        this.scene.clearMapEntities();
      });
    }

    const importBtn = this.root.querySelector<HTMLButtonElement>('#import-map-json');
    const importInput = this.root.querySelector<HTMLInputElement>('#import-map-file-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });
      importInput.addEventListener('change', () => {
        const file = importInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            this.scene.importMapFromJson(reader.result);
          }
        };
        reader.readAsText(file);
      });
    }

    const ambientSlider = this.root.querySelector<HTMLInputElement>('#ambient-slider');
    if (ambientSlider) {
      ambientSlider.addEventListener('input', () => {
        this.game.ambientLightIntensity = Number(ambientSlider.value) / 100;
        const label = ambientSlider.closest('label')?.querySelector('strong');
        if (label) label.textContent = `${ambientSlider.value}%`;
      });
    }

    const fowCheck = this.root.querySelector<HTMLInputElement>('#toggle-fow');
    if (fowCheck) {
      fowCheck.addEventListener('change', () => {
        this.game.fogOfWarEnabled = fowCheck.checked;
        this.game.recomputeFov();
        this.onStateChange();
      });
    }

    const cutawayCheck = this.root.querySelector<HTMLInputElement>('#toggle-cutaway');
    if (cutawayCheck) {
      cutawayCheck.addEventListener('change', () => {
        this.game.wallCutawayEnabled = cutawayCheck.checked;
        this.onStateChange();
      });
    }

    const edgePanCheck = this.root.querySelector<HTMLInputElement>('#toggle-edge-pan');
    if (edgePanCheck) {
      edgePanCheck.addEventListener('change', () => {
        this.scene.edgePanEnabled = edgePanCheck.checked;
        this.onStateChange();
      });
    }

    const edgeSpeedSlider = this.root.querySelector<HTMLInputElement>('#edge-speed-slider');
    if (edgeSpeedSlider) {
      edgeSpeedSlider.addEventListener('input', () => {
        this.scene.edgePanSpeed = Number(edgeSpeedSlider.value);
        const label = edgeSpeedSlider.closest('label')?.querySelector('strong');
        if (label) label.textContent = `${this.scene.edgePanSpeed} px/s`;
      });
    }
  }
}
