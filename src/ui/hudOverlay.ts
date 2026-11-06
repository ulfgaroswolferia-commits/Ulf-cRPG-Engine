import { generateRandomCharacterRecipe } from '../assets/characterBakery';
import { IsoSceneView } from '../renderer/isoSceneView';
import { EQUIPMENT_CATALOG, HairStyle } from '../rpg/characterData';
import { CrpgGameState } from '../rpg/gameLoop';

const HAIR_OPTIONS: ReadonlyArray<{ id: HairStyle; label: string }> = [
  { id: 'noble_crest', label: 'Szlachecki Grzebień' },
  { id: 'short_crop', label: 'Krótkie Cięcie' },
  { id: 'long_braids', label: 'Długie Warkocze' },
  { id: 'tonsure', label: 'Tonsura Mnicha' },
  { id: 'none', label: 'Brak (Ogolenie)' }
];

export class HudOverlay {
  private readonly root: HTMLElement;
  private readonly game: CrpgGameState;
  private readonly scene: IsoSceneView;
  private isInventoryOpen = true;

  constructor(root: HTMLElement, game: CrpgGameState, scene: IsoSceneView) {
    this.root = root;
    this.game = game;
    this.scene = scene;
  }

  public render(): void {
    const player = this.game.player;
    const charTex = this.scene.getCharacterTextures(player);
    const eq = player.recipe.equipment;
    const attrs = player.recipe.attributes;

    const equippedItems = [
      eq.head ? EQUIPMENT_CATALOG[eq.head] : null,
      EQUIPMENT_CATALOG[eq.torso],
      eq.cloak ? EQUIPMENT_CATALOG[eq.cloak] : null,
      EQUIPMENT_CATALOG[eq.legs],
      eq.mainHand ? EQUIPMENT_CATALOG[eq.mainHand] : null,
      eq.offHand ? EQUIPMENT_CATALOG[eq.offHand] : null
    ].filter(Boolean);

    const totalArmor = equippedItems.reduce((acc, it) => acc + (it?.armorBonus ?? 0), 0);
    const totalAttack = equippedItems.reduce((acc, it) => acc + (it?.attackBonus ?? 0), 0);

    const dialogueHtml = this.game.activeDialogue
      ? `
      <div class="dialogue-backdrop">
        <div class="dialogue-modal">
          <div class="dialogue-header">
            <span class="dialogue-speaker">${this.game.activeDialogue.node.speakerName}</span>
            <span class="dialogue-title">${this.game.activeDialogue.node.speakerTitle}</span>
          </div>
          <p class="dialogue-body">„${this.game.activeDialogue.node.text}”</p>
          <div class="dialogue-choices">
            ${this.game.activeDialogue.node.choices
              .map((c, idx) => {
                const req = c.requiredAttribute;
                const currentStat = req ? attrs[req.stat] : 99;
                const canPick = !req || currentStat >= req.minValue;
                return `
                  <button class="dialogue-choice-btn ${canPick ? '' : 'disabled'}" data-choice-idx="${idx}" ${canPick ? '' : 'disabled'}>
                    <span class="choice-index">${idx + 1}.</span>
                    <span>${c.text}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `
      : '';

    const inventoryDrawerHtml = this.isInventoryOpen
      ? `
      <div class="inventory-drawer">
        <div class="panel-header">
          <div>
            <h3>Kuźnia Postaci & Ekwipunek (Paperdoll)</h3>
            <span class="panel-sub">Modularne warstwy wypiekane w locie do tekstur Albedo + Normal (${charTex.bakeDurationMs} ms)</span>
          </div>
          <button class="btn-icon" data-action="toggle-inventory" title="Zamknij panel">✕</button>
        </div>

        <div class="character-customizer-row">
          <label class="custom-select-label">
            Fryzura bazowa:
            <select id="hair-style-select" class="dark-select">
              ${HAIR_OPTIONS.map(
                (h) =>
                  `<option value="${h.id}" ${player.recipe.hairStyle === h.id ? 'selected' : ''}>${h.label}</option>`
              ).join('')}
            </select>
          </label>
          <button class="action-pill" data-action="randomize-hero">🎲 Losuj wygląd bohatera</button>
        </div>

        <div class="inventory-grid">
          ${this.game.inventory
            .map((itemId) => {
              const item = EQUIPMENT_CATALOG[itemId];
              if (!item) return '';
              const isEquipped = Object.values(eq).includes(itemId);
              const swatch = `rgb(${item.primaryColor.r}, ${item.primaryColor.g}, ${item.primaryColor.b})`;
              const trim = `rgb(${item.trimColor.r}, ${item.trimColor.g}, ${item.trimColor.b})`;
              return `
                <button class="item-card ${isEquipped ? 'equipped' : ''}" data-equip-id="${item.id}">
                  <div class="item-swatch" style="background: linear-gradient(135deg, ${swatch} 60%, ${trim} 100%);">
                    <span class="slot-badge">${item.slot.toUpperCase()}</span>
                  </div>
                  <div class="item-meta">
                    <div class="item-name">${item.name}</div>
                    <div class="item-stats">
                      ${item.armorBonus ? `🛡️ +${item.armorBonus} Pancerz ` : ''}
                      ${item.attackBonus ? `⚔️ +${item.attackBonus} Atak ` : ''}
                      ${item.loreBonus ? `✨ +${item.loreBonus} Wiedza ` : ''}
                      <span class="pbr-tag">M:${Math.round(item.metallic * 100)}% R:${Math.round(item.roughness * 100)}%</span>
                    </div>
                  </div>
                  <span class="equip-state">${isEquipped ? 'ZAŁOŻONO' : 'ZAŁÓŻ'}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `
      : '';

    this.root.innerHTML = `
      <div class="top-bar">
        <div class="brand-block">
          <span class="brand-crest">❖</span>
          <div>
            <div class="world-title">Ulf-cRPG-Engine <span style="opacity:0.65;font-weight:500;">— ${this.game.map.name}</span></div>
            <div class="world-subtitle">${this.game.map.subtitle}</div>
          </div>
        </div>

        <div class="camera-compass-bar">
          <button class="compass-btn" data-action="rot-ccw" title="Obróć kamerę o -90° (Klawisz Q)">⟲ Q</button>
          ${(['N (0°)', 'E (90°)', 'S (180°)', 'W (270°)'] as const)
            .map(
              (label, idx) => `
              <button class="compass-angle-btn ${this.scene.rotation === idx ? 'active' : ''}" data-rot="${idx}">
                ${label}
              </button>
            `
            )
            .join('')}
          <button class="compass-btn" data-action="rot-cw" title="Obróć kamerę o +90° (Klawisz E)">E ⟳</button>
        </div>

        <div class="telemetry-badges">
          <span class="telemetry-pill">FPS: <strong>${this.scene.fps}</strong></span>
          <span class="telemetry-pill">Bake: <strong>${this.scene.lastBakeDurationMs} ms</strong></span>
          <span class="telemetry-pill">NPC: <strong>${this.game.npcs.length}</strong></span>
        </div>
      </div>

      ${dialogueHtml}
      ${inventoryDrawerHtml}

      <div class="bottom-hud">
        <div class="hero-card">
          <div class="portrait-frame">
            <img src="${charTex.portraitDataUrl}" alt="Portret Bohatera" class="hero-portrait-img" />
            <span class="armor-badge" title="Całkowity Pancerz / Atak">🛡️ ${totalArmor} | ⚔️ ${totalAttack}</span>
          </div>
          <div class="hero-details">
            <div class="hero-name">${player.recipe.name}</div>
            <div class="hero-title">${player.recipe.title}</div>
            <div class="attr-row">
              <span title="Siła">SIŁ <strong>${attrs.might}</strong></span>
              <span title="Finezja">FIN <strong>${attrs.finesse}</strong></span>
              <span title="Determinacja">DET <strong>${attrs.resolve}</strong></span>
              <span title="Wiedza Tajemna">WIE <strong>${attrs.lore}</strong></span>
              <span title="Percepcja">PER <strong>${attrs.perception}</strong></span>
            </div>
            <div class="quick-actions">
              <button class="hud-btn ${this.isInventoryOpen ? 'active' : ''}" data-action="toggle-inventory">
                🎒 Ekwipunek & Wygląd (${this.game.inventory.length})
              </button>
              <button class="hud-btn" data-action="spawn-npc">
                ➕ Generuj Losowego NPC
              </button>
              <button class="hud-btn" data-action="center-camera">
                🎯 Kamera na Bohatera
              </button>
            </div>
          </div>
        </div>

        <div class="chronicle-log">
          <div class="log-header">Kronika Wydarzeń</div>
          <div class="log-entries">
            ${this.game.logs
              .slice(0, 6)
              .map((entry) => `<div class="log-line">• ${entry}</div>`)
              .join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'rot-ccw') {
          this.scene.rotateCamera(-1);
        } else if (action === 'rot-cw') {
          this.scene.rotateCamera(1);
        } else if (action === 'toggle-inventory') {
          this.isInventoryOpen = !this.isInventoryOpen;
          this.render();
        } else if (action === 'randomize-hero') {
          const newSeed = Math.floor(Math.random() * 90000) + 100;
          const rand = generateRandomCharacterRecipe(newSeed, this.game.player.id);
          rand.name = this.game.player.recipe.name;
          rand.title = this.game.player.recipe.title;
          rand.attributes = { ...this.game.player.recipe.attributes };
          this.game.player.recipe = rand;
          this.game.addLog(`Wylosowano nowy zestaw modularny bohatera (seed #${newSeed}).`);
          this.render();
        } else if (action === 'spawn-npc') {
          this.game.spawnRandomNpc();
          this.render();
        } else if (action === 'center-camera') {
          this.scene.cameraOffsetX = this.scene.app.screen.width * 0.5;
          this.scene.cameraOffsetY = 150;
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-rot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rot = Number(btn.dataset.rot) as 0 | 1 | 2 | 3;
        this.scene.setRotation(rot);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-equip-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.equipId;
        if (itemId) {
          this.game.equipInventoryItem(itemId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-choice-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.choiceIdx);
        const choice = this.game.activeDialogue?.node.choices[idx];
        if (choice) {
          this.game.selectDialogueChoice(choice);
          this.render();
        }
      });
    });

    const hairSelect = this.root.querySelector<HTMLSelectElement>('#hair-style-select');
    if (hairSelect) {
      hairSelect.addEventListener('change', () => {
        this.game.player.recipe = {
          ...this.game.player.recipe,
          hairStyle: hairSelect.value as HairStyle
        };
        this.game.addLog(`Zmieniono fryzurę bohatera na: ${hairSelect.value}.`);
        this.render();
      });
    }
  }
}
