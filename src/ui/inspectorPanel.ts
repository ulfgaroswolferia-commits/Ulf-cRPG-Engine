import { RenderBufferMode } from '../renderer/deferredPipeline';
import { InspectorToolMode, IsoSceneView } from '../renderer/isoSceneView';
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
  { id: 'raise_elevation', label: '⛰️ Podnieś Wysokość Kafla (Z + 1)' },
  { id: 'lower_elevation', label: '🕳️ Obniż Wysokość Kafla (Z - 1)' },
  { id: 'place_torch_light', label: '🔥 Dodaj Światło Pochodni (PBR)' },
  { id: 'place_arcane_light', label: '💎 Dodaj Światło Eteryczne (PBR)' }
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
          ⚙️ Inspektor Silnika 2.5D
        </button>
      `;
      this.root.querySelector('#expand-inspector')?.addEventListener('click', () => {
        this.collapsed = false;
        this.render();
      });
      return;
    }

    this.root.innerHTML = `
      <aside class="inspector-card">
        <div class="inspector-header">
          <div>
            <h2>Inspektor Silnika 2.5D</h2>
            <span class="inspector-sub">G-Buffer, Sortowanie DAG & Edytor Świata</span>
          </div>
          <button class="btn-icon" id="collapse-inspector" title="Zwiń panel">–</button>
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
        </div>

        <div class="inspector-section">
          <div class="section-title">Narzędzie Kursora (Live Map Editor)</div>
          <div class="tool-list">
            ${EDITOR_TOOLS.map(
              (t) => `
              <button class="tool-btn ${this.scene.activeTool === t.id ? 'active' : ''}" data-tool="${t.id}">
                ${t.label}
              </button>
            `
            ).join('')}
          </div>
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

    const ambientSlider = this.root.querySelector<HTMLInputElement>('#ambient-slider');
    if (ambientSlider) {
      ambientSlider.addEventListener('input', () => {
        this.game.ambientLightIntensity = Number(ambientSlider.value) / 100;
        this.render();
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
  }
}
