import './styles/main.css';
import { IsoSceneView } from './renderer/isoSceneView';
import { preloadPrzasneDialoguesAsset } from './rpg/dialogueSystem';
import { CrpgGameState } from './rpg/gameLoop';
import { hasSavedGame, loadGame, saveGame } from './rpg/saveSystem';
import { HudOverlay } from './ui/hudOverlay';
import { InspectorPanel } from './ui/inspectorPanel';

async function bootstrapEngine(): Promise<void> {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  await preloadPrzasneDialoguesAsset();
  const viewportContainer = document.getElementById('viewport-container');
  const hudRoot = document.getElementById('hud-root');
  const inspectorRoot = document.getElementById('inspector-root');

  if (!viewportContainer || !hudRoot || !inspectorRoot) {
    throw new Error('Brak kontenerów DOM dla silnika (#viewport-container, #hud-root, #inspector-root).');
  }

  const viteMode = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE;
  const isDevMode =
    viteMode === 'editor' ||
    new URLSearchParams(window.location.search).get('dev') === '1';

  const game = new CrpgGameState();
  let hud: HudOverlay | null = null;
  let inspector: InspectorPanel | null = null;

  const refreshUi = (): void => {
    hud?.render();
    inspector?.render();
  };

  const scene = new IsoSceneView(game, refreshUi);
  if (isDevMode) {
    game.fogOfWarEnabled = false;
    game.ambientLightIntensity = 0.85;
    scene.activeTool = 'paint_terrain';
    document.body.classList.add('editor-workspace-mode');
  }
  await scene.mount(viewportContainer);

  const shouldRestoreSave =
    !isDevMode || new URLSearchParams(window.location.search).get('restore') === '1';

  // Restore game state from autosave if present (prevents reset on F5 / browser reload)
  if (shouldRestoreSave && hasSavedGame('autosave')) {
    loadGame(game, scene, 'autosave');
  }

  hud = new HudOverlay(hudRoot, game, scene, { devMode: isDevMode });
  if (isDevMode) {
    inspector = new InspectorPanel(inspectorRoot, game, scene, refreshUi);
  } else {
    inspectorRoot.innerHTML = '';
  }

  refreshUi();

  // 1. Immediately persist on beforeunload (when pressing F5, closing tab, or navigating)
  window.addEventListener('beforeunload', () => {
    saveGame(game, scene, 'autosave');
  });

  // 2. Immediate persist on F5 keypress before browser triggers page unload
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
      saveGame(game, scene, 'autosave');
    }
  });

  // 3. Periodic discreet background autosave every 3.5 seconds
  window.setInterval(() => {
    saveGame(game, scene, 'autosave');
  }, 3500);

  if (isDevMode) {
    // Periodic lightweight telemetry refresh for FPS counter in dev/editor mode
    window.setInterval(() => {
      const fpsNodes = document.querySelectorAll('.telemetry-pill strong');
      if (fpsNodes.length >= 1) {
        fpsNodes[0].textContent = String(scene.fps);
      }
    }, 600);
  }
}

bootstrapEngine().catch((err) => {
  console.error('Błąd inicjalizacji silnika izometrycznego cRPG:', err);
  const viewportContainer = document.getElementById('viewport-container');
  if (viewportContainer) {
    viewportContainer.innerHTML = `<div style="color:#ff6b6b;padding:24px;font-family:monospace;">Błąd inicjalizacji silnika: ${String(err)}</div>`;
  }
});
