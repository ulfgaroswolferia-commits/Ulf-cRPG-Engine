import './styles/main.css';
import { IsoSceneView } from './renderer/isoSceneView';
import { preloadPrzasneDialoguesAsset } from './rpg/dialogueSystem';
import { CrpgGameState } from './rpg/gameLoop';
import { clearSave, hasSavedGame, isAutosaveDisabled, loadGame, saveGame } from './rpg/saveSystem';
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

  const skipRestore =
    typeof window !== 'undefined' &&
    window.sessionStorage &&
    window.sessionStorage.getItem('ulf_skip_restore') === '1';

  if (skipRestore) {
    try {
      window.sessionStorage.removeItem('ulf_skip_restore');
    } catch {}
    clearSave('all');
  }

  const shouldRestoreSave =
    !skipRestore &&
    (!isDevMode || new URLSearchParams(window.location.search).get('restore') === '1');

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
    if (!isAutosaveDisabled()) {
      saveGame(game, scene, 'autosave');
    }
  });

  // 2. Immediate persist on F5 keypress before browser triggers page unload
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5' && !isAutosaveDisabled()) {
      saveGame(game, scene, 'autosave');
    }
  });

  // 3. Periodic discreet background autosave every 3.5 seconds
  window.setInterval(() => {
    if (!isAutosaveDisabled()) {
      saveGame(game, scene, 'autosave');
    }
  }, 3500);

  if (isDevMode) {
    // Periodic lightweight telemetry refresh for FPS counter in dev/editor mode
    window.setInterval(() => {
      const fpsEl = document.querySelector<HTMLElement>('[data-telemetry="fps"]') ??
        document.querySelectorAll('.telemetry-pill strong')[0];
      if (fpsEl) {
        fpsEl.textContent = String(scene.fps);
      }
    }, 600);
  }
}

bootstrapEngine().catch((err) => {
  console.error('Błąd inicjalizacji silnika izometrycznego cRPG:', err);
  const viewportContainer = document.getElementById('viewport-container');
  if (viewportContainer) {
    const errBox = document.createElement('div');
    errBox.style.cssText = 'color:#ff6b6b;padding:24px;font-family:monospace;';
    errBox.textContent = `Błąd inicjalizacji silnika: ${String(err)}`;
    viewportContainer.replaceChildren(errBox);
  }
});
