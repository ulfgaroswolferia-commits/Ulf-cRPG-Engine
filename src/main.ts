import './styles/main.css';
import { IsoSceneView } from './renderer/isoSceneView';
import { CrpgGameState } from './rpg/gameLoop';
import { HudOverlay } from './ui/hudOverlay';
import { InspectorPanel } from './ui/inspectorPanel';

async function bootstrapEngine(): Promise<void> {
  const viewportContainer = document.getElementById('viewport-container');
  const hudRoot = document.getElementById('hud-root');
  const inspectorRoot = document.getElementById('inspector-root');

  if (!viewportContainer || !hudRoot || !inspectorRoot) {
    throw new Error('Brak kontenerów DOM dla silnika (#viewport-container, #hud-root, #inspector-root).');
  }

  const game = new CrpgGameState();
  let hud: HudOverlay | null = null;
  let inspector: InspectorPanel | null = null;

  const refreshUi = (): void => {
    hud?.render();
    inspector?.render();
  };

  const scene = new IsoSceneView(game, refreshUi);
  await scene.mount(viewportContainer);

  hud = new HudOverlay(hudRoot, game, scene);
  inspector = new InspectorPanel(inspectorRoot, game, scene, refreshUi);

  refreshUi();

  // Periodic lightweight telemetry refresh for FPS counter
  window.setInterval(() => {
    const fpsNodes = document.querySelectorAll('.telemetry-pill strong');
    if (fpsNodes.length >= 1) {
      fpsNodes[0].textContent = String(scene.fps);
    }
  }, 600);
}

bootstrapEngine().catch((err) => {
  console.error('Błąd inicjalizacji silnika izometrycznego cRPG:', err);
});
