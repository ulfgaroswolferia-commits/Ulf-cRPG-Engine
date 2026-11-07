import { generateRandomCharacterRecipe } from '../assets/characterBakery';
import { getSlavicPortrait } from '../assets/slavicPortraits';
import { EdgePanDirection } from '../core/isoMath';
import { MapId } from '../core/worldMap';
import { IsoSceneView } from '../renderer/isoSceneView';
import { HairStyle } from '../rpg/characterData';
import {
  ATTACK_MODE_META,
  CombatAttackMode,
  computeAttackPreview,
  PROFICIENCY_META,
  WeaponProficiencyCategory
} from '../rpg/combatSystem';
import { getMerchantWares, getPrzasneKolapsyForNpc } from '../rpg/dialogueSystem';
import { CrpgGameState } from '../rpg/gameLoop';
import {
  clearSave,
  hasSavedGame,
  loadGame,
  saveGame
} from '../rpg/saveSystem';
import {
  EQUIP_SLOT_LABELS,
  EquipSlot,
  getAllItemModifiers,
  getItemDefinition,
  getItemPriceInSiekance,
  ItemComparisonEngine,
  ItemComparisonReport,
  ItemInstance,
  RARITY_META,
  STAT_META,
  StatType
} from '../rpg/inventorySystem';

const HAIR_OPTIONS: ReadonlyArray<{ id: HairStyle; label: string }> = [
  { id: 'noble_crest', label: 'Szlachecki Grzebień' },
  { id: 'short_crop', label: 'Krótkie Cięcie' },
  { id: 'long_braids', label: 'Długie Warkocze' },
  { id: 'tonsure', label: 'Tonsura Mnicha' },
  { id: 'slavic_parted', label: 'Przedziałek Słowiański' },
  { id: 'elder_beard', label: 'Siwa Broda Żercy' },
  { id: 'wreath_braids', label: 'Wianek i Warkocze' },
  { id: 'none', label: 'Brak (Ogolenie)' }
];

const EDGE_ARROW_DEFS: ReadonlyArray<{
  dir: EdgePanDirection;
  glyph: string;
  label: string;
}> = [
  { dir: 'N', glyph: '▲', label: 'Przesuń ekran na Północ (Góra)' },
  { dir: 'S', glyph: '▼', label: 'Przesuń ekran na Południe (Dół)' },
  { dir: 'W', glyph: '◀', label: 'Przesuń ekran na Zachód (Lewo)' },
  { dir: 'E', glyph: '▶', label: 'Przesuń ekran na Wschód (Prawo)' },
  { dir: 'NW', glyph: '◤', label: 'Przesuń ekran po skosie (Góra-Lewo)' },
  { dir: 'NE', glyph: '◥', label: 'Przesuń ekran po skosie (Góra-Prawo)' },
  { dir: 'SW', glyph: '◣', label: 'Przesuń ekran po skosie (Dół-Lewo)' },
  { dir: 'SE', glyph: '◢', label: 'Przesuń ekran po skosie (Dół-Prawo)' }
];

export type BackpackFilterCategory = 'all' | 'gear' | 'trinket' | 'consumable';

export interface HudOverlayOptions {
  devMode?: boolean;
}

const LEFT_PAPERDOLL_SLOTS: ReadonlyArray<EquipSlot> = ['head', 'cloak', 'torso', 'legs'];
const RIGHT_PAPERDOLL_SLOTS: ReadonlyArray<EquipSlot> = ['mainHand', 'offHand', 'ring1', 'ring2'];

const SHEET_DISPLAY_STATS: ReadonlyArray<StatType> = [
  StatType.ArmorRating,
  StatType.PhysicalDamage,
  StatType.HealthMax,
  StatType.ManaMax,
  StatType.CriticalStrikeChance,
  StatType.MovementSpeed,
  StatType.Strength,
  StatType.Agility,
  StatType.Resolve,
  StatType.Intelligence,
  StatType.Perception
];

function formatStatVal(stat: StatType, val: number): string {
  const isPct = STAT_META[stat].isPercent;
  const rounded = Math.round(val * 10) / 10;
  return `${rounded}${isPct ? '%' : ''}`;
}

function formatDeltaBadge(stat: StatType, delta: number): string {
  if (Math.abs(delta) < 0.01) return '<span class="delta-neutral">—</span>';
  const isPct = STAT_META[stat].isPercent;
  const sign = delta > 0 ? '+' : '';
  const arrow = delta > 0 ? '▲' : '▼';
  const cls = delta > 0 ? 'delta-up' : 'delta-down';
  const rounded = Math.round(delta * 10) / 10;
  return `<span class="stat-delta-pill ${cls}">${arrow} ${sign}${rounded}${isPct ? '%' : ''}</span>`;
}

export class HudOverlay {
  private static activeInstance: HudOverlay | null = null;
  private static windowListenersBound = false;

  private readonly root: HTMLElement;
  private readonly game: CrpgGameState;
  private readonly scene: IsoSceneView;
  private readonly devMode: boolean;
  private isInventoryOpen: boolean;
  private isPlaytestInEditor = false;
  private isChronicleExpanded = false;
  private isCombatAdvancedOpen = false;
  private saveToastActive = false;
  private saveToastTimer: number | null = null;
  private activeFilter: BackpackFilterCategory = 'all';
  private hoveredBagInstanceId: string | null = null;
  private hoveredEquipSlot: EquipSlot | null = null;
  private draggedSlotIndex: number | null = null;

  constructor(
    root: HTMLElement,
    game: CrpgGameState,
    scene: IsoSceneView,
    options?: HudOverlayOptions
  ) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.devMode = options?.devMode ?? false;
    this.isInventoryOpen = false;
    HudOverlay.activeInstance = this;

    if (typeof window !== 'undefined' && !HudOverlay.windowListenersBound) {
      HudOverlay.windowListenersBound = true;
      window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });

      window.addEventListener('keydown', (e) => {
        const inst = HudOverlay.activeInstance;
        if (!inst) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
        if (e.key.toLowerCase() === 'i') {
          inst.isInventoryOpen = !inst.isInventoryOpen;
          inst.render();
        } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          inst.saveGameDiscreetly();
        } else if (e.key === 'F5') {
          // Immediately persist state before browser executes refresh
          saveGame(inst.game, inst.scene, 'autosave');
        } else if (inst.game.combatState.active && e.code === 'Space') {
          e.preventDefault();
          inst.game.endPlayerCombatTurn();
          inst.render();
        } else if (inst.game.combatState.active && e.key === '1') {
          inst.executeQuickStrike('quick');
        } else if (inst.game.combatState.active && e.key === '2') {
          inst.executeQuickStrike('power');
        } else if (inst.game.combatState.active && e.key === '3') {
          inst.game.activatePlayerDefendStance();
          inst.render();
        } else if (inst.game.combatState.active && e.key.toLowerCase() === 'v') {
          inst.toggleCombatAdvanced();
        } else if (e.key === 'Escape') {
          if (inst.isCombatAdvancedOpen) {
            inst.isCombatAdvancedOpen = false;
            inst.render();
          } else if (inst.isChronicleExpanded) {
            inst.isChronicleExpanded = false;
            inst.render();
          } else if (inst.isInventoryOpen) {
            inst.isInventoryOpen = false;
            inst.render();
          }
        }
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('fullscreenchange', () => {
          HudOverlay.activeInstance?.render();
        });
      }
    }
  }

  public saveGameDiscreetly(): void {
    saveGame(this.game, this.scene, 'manual');
    saveGame(this.game, this.scene, 'autosave');
    this.game.addLog('• 💾 Zapisano stan gry.');
    this.saveToastActive = true;
    this.render();
    if (typeof window !== 'undefined') {
      if (this.saveToastTimer !== null) {
        window.clearTimeout(this.saveToastTimer);
      }
      this.saveToastTimer = window.setTimeout(() => {
        this.saveToastActive = false;
        this.saveToastTimer = null;
        this.render();
      }, 1600);
    }
  }

  public resetSaveAndRestart(): void {
    clearSave('all');
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.game.loadMap('forest_clearing');
      this.render();
    }
  }

  public toggleChronicleExpanded(): void {
    this.isChronicleExpanded = !this.isChronicleExpanded;
    this.render();
  }

  public toggleInventory(): void {
    this.isInventoryOpen = !this.isInventoryOpen;
    this.render();
  }

  public toggleCombatAdvanced(): void {
    this.isCombatAdvancedOpen = !this.isCombatAdvancedOpen;
    this.render();
  }

  public executeQuickStrike(mode: CombatAttackMode): void {
    this.game.combatState.selectedAttackMode = mode;
    const livingEnemies = this.game.npcs.filter(
      (n) => n.combat?.isHostile && n.combat.isAlive
    );
    const targetId =
      this.game.combatState.selectedTargetId ?? livingEnemies[0]?.id ?? null;
    if (targetId) {
      this.game.combatState.selectedTargetId = targetId;
      this.game.commandAttackEnemy(targetId);
    }
    this.render();
  }

  public toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private renderPaperdollSlot(slot: EquipSlot): string {
    const slotMeta = EQUIP_SLOT_LABELS[slot];
    const equipped = this.game.equipmentManager.getEquipped(slot);
    const mainHandItem = this.game.equipmentManager.getEquipped('mainHand');
    const mainHandDef = mainHandItem ? getItemDefinition(mainHandItem.definitionId) : undefined;
    const isBlockedByTwoHanded = slot === 'offHand' && Boolean(mainHandDef?.isTwoHanded);

    if (isBlockedByTwoHanded && mainHandDef) {
      return `
        <div class="paperdoll-slot blocked-2h" data-equip-slot="${slot}" title="Zablokowane przez broń dwuręczną: ${mainHandDef.name}">
          <div class="pd-slot-icon">🔒</div>
          <div class="pd-slot-info">
            <div class="pd-slot-label">${slotMeta.label}</div>
            <div class="pd-slot-name muted">Broń 2H</div>
          </div>
        </div>
      `;
    }

    if (!equipped) {
      return `
        <div class="paperdoll-slot empty" data-equip-slot="${slot}" title="Pusty slot: ${slotMeta.label}">
          <div class="pd-slot-icon">${slotMeta.icon}</div>
          <div class="pd-slot-info">
            <div class="pd-slot-label">${slotMeta.label}</div>
            <div class="pd-slot-name muted">Pusty</div>
          </div>
        </div>
      `;
    }

    const def = getItemDefinition(equipped.definitionId);
    if (!def) return '';
    const swatch = `rgb(${def.visualDef.primaryColor.r}, ${def.visualDef.primaryColor.g}, ${def.visualDef.primaryColor.b})`;
    const trim = `rgb(${def.visualDef.trimColor.r}, ${def.visualDef.trimColor.g}, ${def.visualDef.trimColor.b})`;

    return `
      <button
        type="button"
        class="paperdoll-slot occupied rarity-${def.rarity.toLowerCase()}"
        data-equip-slot="${slot}"
        title="Kliknij LPM, aby zdjąć do plecaka: ${def.name}"
      >
        <div class="pd-slot-swatch" style="background: linear-gradient(135deg, ${swatch} 60%, ${trim} 100%);">
          <span>${slotMeta.icon}</span>
          ${def.isTwoHanded ? '<span class="pd-2h-tag">2H</span>' : ''}
        </div>
        <div class="pd-slot-info">
          <div class="pd-slot-label">${slotMeta.label}</div>
          <div class="pd-slot-name">${def.name}</div>
        </div>
        <span class="pd-unequip-hint">✕</span>
      </button>
    `;
  }

  private buildCharacterStatSheetHtml(report: ItemComparisonReport | null): string {
    const sheet = this.game.statSheet;
    const impactMap = new Map<StatType, number>();
    if (report) {
      for (const imp of report.characterImpacts) {
        impactMap.set(imp.stat, imp.delta);
      }
    }

    const keyStats: ReadonlyArray<StatType> = [
      StatType.ArmorRating,
      StatType.PhysicalDamage,
      StatType.HealthMax,
      StatType.CriticalStrikeChance
    ];

    return `
      <div class="compact-stat-strip">
        ${keyStats
          .map((stat) => {
            const meta = STAT_META[stat];
            const curVal = sheet.getStatValue(stat);
            const delta = impactMap.get(stat) ?? 0;
            const hasDelta = Math.abs(delta) >= 0.01;
            return `
              <div class="compact-stat-pill ${hasDelta ? (delta > 0 ? 'row-upgrade' : 'row-downgrade') : ''}" title="${meta.label}">
                <span class="cs-label">${meta.icon} ${meta.shortLabel}</span>
                <span class="cs-val">
                  <strong>${formatStatVal(stat, curVal)}</strong>
                  ${hasDelta ? formatDeltaBadge(stat, delta) : ''}
                </span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private buildCombatOverlayHtml(): string {
    if (!this.game.combatState.active) return '';

    const playerSnap = this.game.getActorCombatant(this.game.player);
    const pCombat = this.game.player.combat!;
    const livingEnemies = this.game.npcs.filter(
      (n) => n.combat?.isHostile && n.combat.isAlive
    );

    const selectedEnemy =
      livingEnemies.find((e) => e.id === this.game.combatState.selectedTargetId) ??
      livingEnemies[0];

    if (!selectedEnemy || !selectedEnemy.combat) return '';

    const enemySnap = this.game.getActorCombatant(selectedEnemy);
    const dist = Math.hypot(
      selectedEnemy.tileX - this.game.player.tileX,
      selectedEnemy.tileY - this.game.player.tileY
    );
    const activeMode = this.game.combatState.selectedAttackMode;
    const activePreview = computeAttackPreview(playerSnap, enemySnap, dist, activeMode);
    const quickPreview = computeAttackPreview(playerSnap, enemySnap, dist, 'quick');
    const powerPreview = computeAttackPreview(playerSnap, enemySnap, dist, 'power');

    const apOrbsHtml = Array.from({ length: pCombat.maxAp }, (_, idx) => {
      const filled = idx < pCombat.ap;
      const willSpend =
        filled && idx >= pCombat.ap - activePreview.apCost && activePreview.hasEnoughAp;
      return `<span class="ap-orb ${filled ? 'filled' : 'empty'} ${willSpend ? 'preview-spend' : ''}" title="Punkt Akcji #${idx + 1}"></span>`;
    }).join('');

    const aimedModes: ReadonlyArray<{
      mode: CombatAttackMode;
      badge: string;
    }> = [
      { mode: 'aimed_head', badge: '💫 Ogłuszenie (-2 AP, -20% Celności)' },
      { mode: 'aimed_torso', badge: '🗡️ Przebicie Pancerza (+20% Penetracji)' },
      { mode: 'aimed_legs', badge: '🩸 Okaleczenie (2× koszt ruchu wroga)' }
    ];

    const enemyHpPct = Math.max(
      0,
      Math.min(100, Math.round((selectedEnemy.combat.hp / selectedEnemy.combat.maxHp) * 100))
    );

    const rangeBadgeHtml = activePreview.inRange
      ? `<span class="combat-range-pill in-range" title="Wróg jest w zasięgu Twojej broni (${dist.toFixed(1)} / ${activePreview.maxRange} kafli)">✓ W zasięgu ciosu</span>`
      : `<span class="combat-range-pill out-of-range" title="Dystans: ${dist.toFixed(1)} kafli (zasięg broni: ${activePreview.maxRange}). Kliknij dowolny atak, a bohater sam podejdzie!">👣 Za daleko (${dist.toFixed(1)} kafli) — kliknij atak, aby podejść</span>`;

    const armorPenPct = Math.round(playerSnap.derived.weaponProfile.armorPenetrationRatio * 100);

    return `
      <div class="combat-tactical-bar ${this.isCombatAdvancedOpen ? 'veteran-open' : ''}">
        <div class="combat-bar-top">
          <div class="combat-turn-banner">
            <span class="combat-round-pill">⚔️ RUNDA ${this.game.combatState.round}</span>
            <span class="combat-turn-owner">TWOJA KOLEJ • ${playerSnap.derived.weaponProfile.icon} ${playerSnap.derived.weaponProfile.label}</span>
            ${rangeBadgeHtml}
          </div>

          <div class="combat-ap-strip" title="Punkty Akcji (AP) określają, ile czynności możesz wykonać w tej turze. Ruch o 1 pole = 1 AP.">
            <div class="ap-strip-header">
              <span class="ap-label">⚡ ENERGIA W TURZE: <strong>${pCombat.ap} / ${pCombat.maxAp} AP</strong></span>
              <span class="ap-hint">1 krok = 1 AP</span>
            </div>
            <div class="ap-orbs-row">${apOrbsHtml}</div>
          </div>

          <div class="combat-target-card">
            <div class="target-card-top">
              <div class="target-identity">
                <span class="target-diff-badge diff-${selectedEnemy.combat.difficulty ?? 'normal'}">${selectedEnemy.combat.difficultyLabel ?? 'WRÓG'}</span>
                <strong>${selectedEnemy.recipe.name}</strong>
              </div>
              ${
                livingEnemies.length > 1
                  ? `<div class="target-switch-row">
                      ${livingEnemies
                        .map(
                          (e) => `
                        <button type="button" class="target-switch-btn ${e.id === selectedEnemy.id ? 'active' : ''}" data-combat-target="${e.id}" title="Przełącz cel na: ${e.recipe.name}">
                          ${e.combat?.difficulty === 'easy' ? '🟢' : e.combat?.difficulty === 'normal' ? '🟡' : '🔴'} ${e.recipe.name.split(' ')[0]} (${e.combat?.hp} HP)
                        </button>
                      `
                        )
                        .join('')}
                    </div>`
                  : ''
              }
            </div>
            <div class="target-hp-track">
              <div class="target-hp-fill" style="width:${enemyHpPct}%;"></div>
              <span class="target-hp-text">❤️ ${selectedEnemy.combat.hp} / ${selectedEnemy.combat.maxHp} HP (${enemyHpPct}%)</span>
            </div>
          </div>
        </div>

        <!-- WIDOK PODSTAWOWY: Czytelne przyciski 1-klikowe dla każdego gracza -->
        <div class="combat-primary-deck">
          <div class="combat-quick-strikes">
            <button
              type="button"
              class="quick-strike-card strike-quick ${activeMode === 'quick' ? 'selected' : ''} ${!quickPreview.hasEnoughAp ? 'disabled' : ''}"
              data-quick-strike="quick"
              title="Kliknij (lub wciśnij [1]), aby od razu wykonać Szybki Cios (albo podejść do wroga)"
            >
              <div class="qs-header">
                <span class="qs-title">⚔️ Szybki Cios <kbd>[1]</kbd></span>
                <span class="qs-ap">⚡ ${quickPreview.apCost} AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit" title="Szansa na trafienie">🎯 <strong>${quickPreview.hitChancePct}%</strong> trafienia</span>
                <span class="qs-dmg" title="Szacowane obrażenia">🩸 <strong>${quickPreview.estimatedMinDamage}–${quickPreview.estimatedMaxDamage}</strong> obr.</span>
              </div>
              <div class="qs-caption">${quickPreview.inRange ? 'Pewny, celny atak podstawowy (1 klik)' : '👣 Kliknij, aby podejść do wroga'}</div>
            </button>

            <button
              type="button"
              class="quick-strike-card strike-power ${activeMode === 'power' ? 'selected' : ''} ${!powerPreview.hasEnoughAp ? 'disabled' : ''}"
              data-quick-strike="power"
              title="Kliknij (lub wciśnij [2]), aby od razu wykonać Silny Cios (+38% obrażeń, łatwiej przebija pancerz)"
            >
              <div class="qs-header">
                <span class="qs-title">💥 Silny Cios <kbd>[2]</kbd></span>
                <span class="qs-ap">⚡ ${powerPreview.apCost} AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit" title="Szansa na trafienie">🎯 <strong>${powerPreview.hitChancePct}%</strong> trafienia</span>
                <span class="qs-dmg" title="Szacowane obrażenia">🩸 <strong>${powerPreview.estimatedMinDamage}–${powerPreview.estimatedMaxDamage}</strong> obr.</span>
              </div>
              <div class="qs-caption">${powerPreview.inRange ? 'Mocne uderzenie (+38% obrażeń)' : '👣 Kliknij, aby podejść do wroga'}</div>
            </button>

            <button
              type="button"
              class="quick-strike-card strike-defend ${pCombat.ap < 2 || pCombat.defending ? 'disabled' : ''} ${pCombat.defending ? 'active-stance' : ''}"
              data-combat-action="defend"
              title="Przyjmij postawę obronną [Klawisz 3]: +20% Uniku i ochrona przed ciosami do następnej tury"
            >
              <div class="qs-header">
                <span class="qs-title">🛡️ Obrona <kbd>[3]</kbd></span>
                <span class="qs-ap">⚡ 2 AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit">${pCombat.defending ? '✓ Garda Aktywna' : '+20% Szansy Uniku'}</span>
                <span class="qs-dmg">+2 Pancerza</span>
              </div>
              <div class="qs-caption">Zwiększa obronę na turę wroga</div>
            </button>
          </div>

          <div class="combat-utility-controls">
            <button
              type="button"
              class="combat-util-btn expert-toggle ${this.isCombatAdvancedOpen ? 'active' : ''}"
              data-action="toggle-combat-advanced"
              title="Pokaż/ukryj precyzyjne celowanie w części ciała oraz szczegółowe przeliczniki pancerza DT/DR [Klawisz V]"
            >
              🎯 Tryb Eksperta (Celowanie) <kbd>[V]</kbd> ${this.isCombatAdvancedOpen ? '▲' : '▼'}
            </button>

            <div class="combat-turn-btns">
              <button
                type="button"
                class="combat-exec-btn end-turn"
                data-combat-action="end-turn"
                title="Zakończ swoją turę i odnów punkty AP w kolejnej rundzie (Klawisz Spacja)"
              >
                ⏭️ Koniec Tury <kbd>[Spacja]</kbd>
              </button>

              <button
                type="button"
                class="combat-exec-btn flee"
                data-combat-action="flee"
                title="Wycofaj się taktycznie z walki"
              >
                🏃 Odwrót
              </button>
            </div>
          </div>
        </div>

        <!-- TRYB EKSPERTA: Rozwijany panel celowania anatomicznego dla wyjadacza -->
        ${
          this.isCombatAdvancedOpen
            ? `
          <div class="combat-veteran-panel">
            <div class="veteran-header-strip">
              <span class="veteran-title">🎯 PRECYZYJNE CELOWANIE ANATOMICZNE — Kliknij część ciała, aby od razu uderzyć</span>
              <span class="veteran-telemetry" title="Szczegółowe parametry bojowe celu i Twojej broni">
                Wróg: 🛡️ DT <strong>${enemySnap.derived.damageThreshold}</strong> (Próg) • DR <strong>${enemySnap.derived.damageResistancePct}%</strong> (Redukcja) • Unik <strong>${enemySnap.derived.evasionPct}%</strong>
                &nbsp;|&nbsp;
                Twoja broń: Penetracja Pancerza <strong>${armorPenPct}%</strong> • Biegłość <strong>${playerSnap.derived.activeProficiency}%</strong>
              </span>
            </div>

            <div class="combat-modes-row">
              ${aimedModes
                .map(({ mode, badge }) => {
                  const meta = ATTACK_MODE_META[mode];
                  const prev = computeAttackPreview(playerSnap, enemySnap, dist, mode);
                  const isSelected = mode === activeMode;
                  return `
                    <button
                      type="button"
                      class="combat-mode-btn veteran-aim-card ${isSelected ? 'active' : ''} ${!prev.hasEnoughAp ? 'no-ap' : ''}"
                      data-attack-mode="${mode}"
                      data-quick-strike="${mode}"
                      title="${meta.description} (Kliknij, aby zaatakować)"
                    >
                      <div class="cm-top">
                        <span>${meta.icon} ${meta.label}</span>
                        <span class="cm-ap">⚡ ${prev.apCost} AP</span>
                      </div>
                      <div class="cm-stats">
                        <span class="cm-hit">🎯 Trafienie: <strong>${prev.hitChancePct}%</strong></span>
                        <span class="cm-dmg">⚔️ Obr: <strong>${prev.estimatedMinDamage}–${prev.estimatedMaxDamage}</strong></span>
                        <span class="cm-crit">💥 Kryt: <strong>${prev.critChancePct}%</strong></span>
                      </div>
                      <div class="cm-effect-badge">${badge}</div>
                    </button>
                  `;
                })
                .join('')}
            </div>

            <div class="veteran-footer-row">
              <span class="veteran-tip">
                💡 <strong>Wskazówka taktyczna:</strong> Jeśli wróg ma wysoki pancerz (DT ${enemySnap.derived.damageThreshold}), użyj <em>Silnego Ciosu</em> lub <em>Celowania w Korpus</em>. Przeciwko groźnym bossom celuj w <em>Głowę</em> (Ogłuszenie odbiera wrogowi 2 AP).
              </span>
              <button
                type="button"
                class="combat-exec-btn primary ${!activePreview.hasEnoughAp ? 'disabled' : ''}"
                data-combat-action="attack"
                title="Wykonaj aktualnie zaznaczony tryb ataku (${ATTACK_MODE_META[activeMode].label})"
              >
                ${
                  activePreview.inRange
                    ? `⚔️ Wykonaj: ${ATTACK_MODE_META[activeMode].label} (${activePreview.hitChancePct}% • ${activePreview.apCost} AP)`
                    : `👣 Podejdź i wykonaj: ${ATTACK_MODE_META[activeMode].label}`
                }
              </button>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private buildLiveComparisonHtml(
    hoveredBagItem: ItemInstance | null,
    hoveredSlot: EquipSlot | null
  ): string {
    if (hoveredBagItem) {
      const def = getItemDefinition(hoveredBagItem.definitionId);
      if (!def) return '';

      if (def.itemType === 'Consumable') {
        const rarity = RARITY_META[def.rarity];
        const eff = def.visualDef.consumableEffect;
        return `
          <div class="compact-comp-bar">
            <div class="compact-comp-main">
              <strong style="color:${rarity.colorHex}">${def.name}${hoveredBagItem.stackCount > 1 ? ` (×${hoveredBagItem.stackCount})` : ''}</strong>
              <span class="compact-comp-desc">${def.description}</span>
            </div>
            <div class="compact-comp-pills">
              ${eff?.might ? `<span class="stat-delta-pill delta-up">▲ +${eff.might} SIŁ</span>` : ''}
              ${eff?.resolve ? `<span class="stat-delta-pill delta-up">▲ +${eff.resolve} DET</span>` : ''}
              ${eff?.perception ? `<span class="stat-delta-pill delta-up">▲ +${eff.perception} PER</span>` : ''}
              ${eff?.lore ? `<span class="stat-delta-pill delta-up">▲ +${eff.lore} WIE</span>` : ''}
              <span class="comp-weight">⚖️ ${(def.weight * hoveredBagItem.stackCount).toFixed(1)} kg</span>
            </div>
          </div>
        `;
      }

      const report = ItemComparisonEngine.compareCandidate(
        hoveredBagItem,
        this.game.equipmentManager,
        this.game.statSheet
      );
      const rarity = RARITY_META[def.rarity];
      const slotLabel = report.targetSlot ? EQUIP_SLOT_LABELS[report.targetSlot].label : 'Brak';
      const reqHtml = report.meetsRequirements
        ? ''
        : `<span class="req-badge req-fail">Wymaga: ${report.missingRequirements
            .map((r) => `${STAT_META[r.stat].shortLabel} ≥ ${r.minValue}`)
            .join(', ')}</span>`;

      const deltasHtml =
        report.directDeltas.length > 0
          ? report.directDeltas
              .slice(0, 4)
              .map((d) => {
                const meta = STAT_META[d.stat];
                return `<span class="compact-delta-item">${meta.icon} ${meta.shortLabel} ${formatDeltaBadge(d.stat, d.delta)}</span>`;
              })
              .join('')
          : `<span class="muted">Bez zmian statystyk</span>`;

      return `
        <div class="compact-comp-bar">
          <div class="compact-comp-main">
            <strong style="color:${rarity.colorHex}">${def.name}</strong>
            <span class="comp-badge">(${slotLabel}${def.isTwoHanded ? ' • 2H' : ''})</span>
            ${reqHtml}
            <span class="compact-comp-desc">${def.description}</span>
          </div>
          <div class="compact-comp-pills">
            ${deltasHtml}
            <span class="comp-weight">⚖️ ${def.weight.toFixed(1)} kg</span>
          </div>
        </div>
      `;
    }

    if (hoveredSlot) {
      const eqItem = this.game.equipmentManager.getEquipped(hoveredSlot);
      const slotMeta = EQUIP_SLOT_LABELS[hoveredSlot];
      if (!eqItem) {
        return `
          <div class="comparison-empty-hint">
            <span>${slotMeta.icon} <strong>${slotMeta.label}</strong> — Pusty slot. Kliknij przedmiot w plecaku, aby założyć.</span>
          </div>
        `;
      }
      const def = getItemDefinition(eqItem.definitionId);
      if (!def) return '';
      const rarity = RARITY_META[def.rarity];
      const mods = getAllItemModifiers(eqItem);
      return `
        <div class="compact-comp-bar">
          <div class="compact-comp-main">
            <strong style="color:${rarity.colorHex}">${def.name}</strong>
            <span class="comp-badge">(Założono: ${slotMeta.label} • Kliknij LPM, aby zdjąć)</span>
          </div>
          <div class="compact-comp-pills">
            ${mods
              .map(
                (m) =>
                  `<span class="stat-delta-pill delta-up">${STAT_META[m.targetStat].icon} +${m.value}${STAT_META[m.targetStat].isPercent ? '%' : ''} ${STAT_META[m.targetStat].shortLabel}</span>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="comparison-empty-hint">
        <span>💡 <strong>LPM na przedmiocie</strong> = Załóż / Użyj / Zdejmij • Najedź kursorem, aby porównać statystyki.</span>
      </div>
    `;
  }

  private refreshLiveComparisonDom(): void {
    const compBox = this.root.querySelector<HTMLElement>('#live-comparison-box');
    const statSheetContainer = this.root.querySelector<HTMLElement>('#character-stat-sheet-panel');
    if (!compBox || !statSheetContainer) return;

    const bagFound = this.hoveredBagInstanceId
      ? this.game.backpack.findByInstanceId(this.hoveredBagInstanceId)
      : undefined;
    const bagItem = bagFound?.item ?? null;

    let report: ItemComparisonReport | null = null;
    if (bagItem) {
      const def = getItemDefinition(bagItem.definitionId);
      if (def && def.equipSlot) {
        report = ItemComparisonEngine.compareCandidate(
          bagItem,
          this.game.equipmentManager,
          this.game.statSheet
        );
      }
    }

    compBox.innerHTML = this.buildLiveComparisonHtml(bagItem, this.hoveredEquipSlot);
    statSheetContainer.innerHTML = this.buildCharacterStatSheetHtml(report);

    // Highlight target paperdoll slot when hovering a backpack item
    this.root.querySelectorAll<HTMLElement>('.paperdoll-slot').forEach((el) => {
      const slot = el.dataset.equipSlot as EquipSlot | undefined;
      el.classList.toggle('compare-target', Boolean(report && slot === report.targetSlot));
    });
  }

  public render(): void {
    const player = this.game.player;
    const charTex = this.scene.getCharacterTextures(player);
    const attrs = this.game.statSheet.getEffectiveAttributes();
    const totalArmor = Math.round(this.game.statSheet.getStatValue(StatType.ArmorRating));
    const totalAttack = Math.round(this.game.statSheet.getStatValue(StatType.PhysicalDamage));
    const hasRawSausage = this.game.backpack.hasDefinitionId('item_raw_sausage');

    const bagWeight = this.game.backpack.currentWeight;
    const eqWeight = this.game.equipmentManager.getEquippedWeight();
    const totalWeight = Number((bagWeight + eqWeight).toFixed(1));
    const maxWeight = this.game.backpack.maxWeight;
    const weightPct = Math.min(100, Math.round((totalWeight / Math.max(1, maxWeight)) * 100));

    const allSlots = this.game.backpack.getSlots();
    const occupiedCount = this.game.backpack.getOccupiedSlots().length;

    const activeNpcKolapsy = this.game.activeDialogue
      ? getPrzasneKolapsyForNpc(this.game.activeDialogue.actorId)
      : [];

    const kolapsyAccordionHtml =
      activeNpcKolapsy.length > 0
        ? `
          <div class="dialogue-kolapsy-wrap">
            ${activeNpcKolapsy
              .map(
                (kol) => `
              <details class="dialogue-collapse">
                <summary class="dialogue-collapse-summary">
                  📜 Przaśny Kolaps Słowny: <strong>${kol.title}</strong>
                  <span class="dialogue-collapse-hint">(Rozwiń pełny zapis z assetu)</span>
                </summary>
                <div class="dialogue-collapse-content">
                  <div class="dialogue-collapse-context">${kol.context}</div>
                  <div class="dialogue-collapse-steps">
                    ${kol.steps
                      .map(
                        (s) => `
                      <div class="dialogue-collapse-step">
                        <span class="collapse-speaker">${s.speaker} <small>(${s.role})</small>:</span>
                        <span class="collapse-line">„${s.line}”</span>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </details>
            `
              )
              .join('')}
          </div>
        `
        : '';

    const activeActorId = this.game.activeDialogue?.actorId ?? '';
    const activeSpeakerPortrait = this.game.activeDialogue
      ? getSlavicPortrait(activeActorId)
      : '';

    const isMerchantDialogue = ['npc_dobromir', 'npc_bogusz', 'npc_gniewosz'].includes(activeActorId);
    const merchantWares = isMerchantDialogue ? getMerchantWares(activeActorId) : [];

    const merchantShopHtml =
      isMerchantDialogue && merchantWares.length > 0
        ? `
        <div class="merchant-shop-panel">
          <div class="merchant-shop-header">
            <span class="merchant-shop-title">💎 Drogocenne towary kupca (Wymagają grindu i siekańców):</span>
            <span class="merchant-shop-wallet">Twój trzos: 💰 <strong>${this.game.siekance}</strong> siek.</span>
          </div>
          <div class="merchant-wares-list">
            ${merchantWares
              .map((ware) => {
                const def = getItemDefinition(ware.id);
                const rarity = def ? RARITY_META[def.rarity] : { label: 'Rzadki', colorHex: '#ffd700' };
                const canAfford = this.game.siekance >= ware.priceSiekance;
                const swatch = def
                  ? `rgb(${def.visualDef.primaryColor.r}, ${def.visualDef.primaryColor.g}, ${def.visualDef.primaryColor.b})`
                  : '#555';
                const trim = def
                  ? `rgb(${def.visualDef.trimColor.r}, ${def.visualDef.trimColor.g}, ${def.visualDef.trimColor.b})`
                  : '#999';

                return `
                <div class="merchant-ware-card ${canAfford ? 'can-afford' : 'too-expensive'}">
                  <div class="ware-swatch" style="background: linear-gradient(135deg, ${swatch} 55%, ${trim} 100%);">
                    <span class="slot-badge">${def?.equipSlot?.toUpperCase().slice(0, 3) ?? 'PRZ'}</span>
                  </div>
                  <div class="ware-info">
                    <div class="ware-name" style="color: ${rarity.colorHex}">${ware.title}</div>
                    <div class="ware-desc">${ware.description}</div>
                  </div>
                  <div class="ware-buy-action">
                    <span class="ware-price ${canAfford ? 'afford' : 'costly'}">💰 ${ware.priceSiekance} siek.</span>
                    <button
                      type="button"
                      class="btn-buy-ware ${canAfford ? '' : 'disabled'}"
                      data-buy-item-id="${ware.id}"
                      data-merchant-id="${activeActorId}"
                      ${canAfford ? '' : 'disabled'}
                      title="${canAfford ? `Kup ${ware.title} za ${ware.priceSiekance} siekańców` : `Brakuje Ci ${ware.priceSiekance - this.game.siekance} siekańców (wymaga grindu!)`}"
                    >
                      ${canAfford ? 'Kup' : 'Za drogo'}
                    </button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
      `
        : '';

    const dialogueHtml = this.game.activeDialogue
      ? `
      <div class="dialogue-backdrop">
        <div class="dialogue-modal dark-fantasy-frame">
          <div class="dialogue-inner">
            <div class="dialogue-portrait-col">
              <div class="dialogue-portrait-box">
                <img src="${activeSpeakerPortrait}" alt="${this.game.activeDialogue.node.speakerName}" class="dialogue-portrait-img" />
                <div class="portrait-name-ribbon">${this.game.activeDialogue.node.speakerName.split(' ')[0]}</div>
              </div>
            </div>
            <div class="dialogue-content-col">
              <div class="dialogue-header">
                <span class="dialogue-speaker">${this.game.activeDialogue.node.speakerName}</span>
                <span class="dialogue-title">${this.game.activeDialogue.node.speakerTitle}</span>
              </div>
              <div class="dialogue-body-wrap">
                <p class="dialogue-body">„${this.game.activeDialogue.node.text}”</p>
                ${kolapsyAccordionHtml}
                ${merchantShopHtml}
              </div>
              <div class="dialogue-choices">
                ${this.game.activeDialogue.node.choices
                  .map((c, idx) => {
                    const req = c.requiredAttribute;
                    const currentStat = req ? attrs[req.stat] : 99;
                    const canPick = !req || currentStat >= req.minValue;
                    return `
                      <button class="dialogue-choice-btn ${canPick ? '' : 'disabled'}" data-choice-idx="${idx}" ${canPick ? '' : 'disabled'}>
                        <span class="choice-index">${idx + 1}.</span>
                        <span class="choice-text">${c.text}</span>
                      </button>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    `
      : '';

    let emptyRenderedCount = 0;

    const isNearMerchant = this.game.isNearMerchant();
    const inventoryDrawerHtml = this.isInventoryOpen
      ? `
      <div class="inventory-drawer" data-layout="compact-backpack">
        <div class="panel-header">
          <div class="compact-header-left">
            <h3>🎒 Plecak (${occupiedCount}/${this.game.backpack.capacity})</h3>
            <div class="siekance-wallet-badge" title="Twój trzos: Słowiańskie Siekańce (waluta handlowa)">
              <span class="wallet-icon">💰</span>
              <strong class="wallet-val">${this.game.siekance}</strong>
              <span class="wallet-label">siekańców</span>
            </div>
            <div class="weight-meter" title="Udźwig całkowity (Plecak + Założony rynsztunek)">
              <span class="weight-pill-text">⚖️ ${totalWeight} / ${maxWeight} kg</span>
              <div class="weight-bar-track">
                <div class="weight-bar-fill ${weightPct > 85 ? 'heavy' : ''}" style="width: ${weightPct}%;"></div>
              </div>
            </div>
          </div>
          <div class="compact-header-right">
            <button type="button" class="sort-btn" data-bag-sort="rarity" title="Uporządkuj przedmioty w plecaku">⇅ Uporządkuj</button>
            <button class="btn-icon" data-action="toggle-inventory" title="Zamknij plecak (I lub Esc)">✕</button>
          </div>
        </div>

        <div class="inventory-workspace">
          <!-- LEFT COLUMN: Compact Paperdoll + 4 Key Stats -->
          <div class="paperdoll-column">
            <div class="paperdoll-stage">
              <div class="paperdoll-slots-col">
                ${LEFT_PAPERDOLL_SLOTS.map((s) => this.renderPaperdollSlot(s)).join('')}
              </div>

              <div class="paperdoll-center-avatar">
                <div class="paperdoll-avatar-frame">
                  <img src="${charTex.portraitDataUrl}" alt="Sylwetka Bohatera" class="paperdoll-avatar-img" />
                </div>
              </div>

              <div class="paperdoll-slots-col">
                ${RIGHT_PAPERDOLL_SLOTS.map((s) => this.renderPaperdollSlot(s)).join('')}
              </div>
            </div>

            <div id="character-stat-sheet-panel" class="stat-sheet-box">
              ${this.buildCharacterStatSheetHtml(null)}
            </div>
          </div>

          <!-- RIGHT COLUMN: Streamlined Backpack List/Grid -->
          <div class="backpack-column">
            <div class="backpack-toolbar">
              <div class="filter-tabs">
                ${(
                  [
                    { id: 'all', label: `Wszystkie (${occupiedCount})` },
                    { id: 'gear', label: '⚔️ Ekwipunek' },
                    { id: 'consumable', label: '🍖 Użytkowe' }
                  ] as const
                )
                  .map(
                    (tab) => `
                  <button
                    type="button"
                    class="filter-tab-btn ${this.activeFilter === tab.id ? 'active' : ''}"
                    data-bag-filter="${tab.id}"
                  >${tab.label}</button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="backpack-grid">
              ${allSlots
                .map((slotItem, slotIdx) => {
                  if (!slotItem) {
                    if (this.activeFilter !== 'all' || emptyRenderedCount >= 4) {
                      return '';
                    }
                    emptyRenderedCount++;
                    return `
                      <div
                        class="backpack-slot empty"
                        data-slot-index="${slotIdx}"
                        title="Wolne miejsce w plecaku #${slotIdx + 1}"
                      >
                        <span class="empty-slot-num">+ Wolny slot</span>
                      </div>
                    `;
                  }

                  const def = getItemDefinition(slotItem.definitionId);
                  if (!def) return '';

                  const matchesFilter =
                    this.activeFilter === 'all' ||
                    (this.activeFilter === 'gear' &&
                      (def.itemType === 'Weapon' || def.itemType === 'Armor' || def.itemType === 'Trinket')) ||
                    (this.activeFilter === 'consumable' && def.itemType === 'Consumable');

                  if (!matchesFilter) {
                    return '';
                  }

                  const rarity = RARITY_META[def.rarity];
                  const swatch = `rgb(${def.visualDef.primaryColor.r}, ${def.visualDef.primaryColor.g}, ${def.visualDef.primaryColor.b})`;
                  const trim = `rgb(${def.visualDef.trimColor.r}, ${def.visualDef.trimColor.g}, ${def.visualDef.trimColor.b})`;

                  let isNetUpgrade = false;
                  let primaryDeltaText = '';
                  if (def.equipSlot) {
                    const cmp = ItemComparisonEngine.compareCandidate(
                      slotItem,
                      this.game.equipmentManager,
                      this.game.statSheet
                    );
                    const upCount = cmp.directDeltas.filter((d) => d.delta > 0).length;
                    const downCount = cmp.directDeltas.filter((d) => d.delta < 0).length;
                    isNetUpgrade = upCount > downCount && cmp.meetsRequirements;
                    const topDelta = cmp.directDeltas[0];
                    if (topDelta && Math.abs(topDelta.delta) >= 0.1) {
                      const sign = topDelta.delta > 0 ? '+' : '';
                      primaryDeltaText = `${STAT_META[topDelta.stat].icon} ${sign}${topDelta.delta}`;
                    }
                  }

                  let actionLabel = 'Załóż';
                  if (def.id === 'item_raw_sausage') {
                    actionLabel = '🔥 Upiecz';
                  } else if (def.itemType === 'Consumable') {
                    actionLabel = '🍖 Użyj';
                  }

                  const itemPrice = getItemPriceInSiekance(slotItem);

                  return `
                    <div
                      class="backpack-slot occupied rarity-${def.rarity.toLowerCase()} ${isNetUpgrade ? 'is-upgrade' : ''}"
                      draggable="true"
                      data-slot-index="${slotIdx}"
                      data-bag-instance-id="${slotItem.instanceId}"
                      data-equip-id="${def.id}"
                      title="Kliknij LPM, aby: ${actionLabel} (${def.name}) • Kliknij 'Sprzedaj', aby zbyć za ${itemPrice} siekańców"
                    >
                      <div class="item-swatch" style="background: linear-gradient(135deg, ${swatch} 60%, ${trim} 100%);">
                        <span class="slot-badge">${def.isTwoHanded ? '2H' : (def.equipSlot ?? 'BAG').toUpperCase().slice(0, 3)}</span>
                        ${slotItem.stackCount > 1 ? `<span class="stack-count-badge">×${slotItem.stackCount}</span>` : ''}
                      </div>
                      <div class="bag-item-title-wrap">
                        <div class="item-name" style="color:${rarity.colorHex}">${def.name}</div>
                        <div class="bag-item-sub">
                          <span>${primaryDeltaText || rarity.label}</span>
                          <span>• ${(def.weight * slotItem.stackCount).toFixed(1)} kg</span>
                          <span class="item-price-tag" title="Cena skupu u kupca w siekańcach">💰 ${itemPrice} siek.</span>
                        </div>
                      </div>
                      <div class="bag-item-actions">
                        <span class="equip-state">${actionLabel}</span>
                        ${
                          isNearMerchant
                            ? `<button type="button" class="bag-sell-btn" data-action="sell-single" data-instance-id="${slotItem.instanceId}" title="Sprzedaj kupcowi za ${itemPrice} siekańców">💰 Sprzedaj</button>`
                            : ''
                        }
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>

        <!-- BOTTOM COMPACT ITEM INFO / COMPARISON BAR -->
        <div id="live-comparison-box" class="live-comparison-box">
          ${this.buildLiveComparisonHtml(null, null)}
        </div>
      </div>
    `
      : '';

    const edgeOverlayHtml = `
      <div class="edge-pan-overlay" aria-label="Strzałki przesuwania ekranu na krańcach">
        ${EDGE_ARROW_DEFS.map(
          (a) => `
          <button
            type="button"
            class="edge-pan-arrow edge-dir-${a.dir.toLowerCase()} ${this.scene.activeEdgeDirection === a.dir ? 'active' : ''}"
            data-edge-dir="${a.dir}"
            title="${a.label}"
          >
            <span class="edge-arrow-glyph">${a.glyph}</span>
          </button>
        `
        ).join('')}
      </div>
    `;

    const mapSwitcherHtml = `
          <button class="compass-angle-btn ${this.game.map.id === 'forest_clearing' ? 'active' : ''}" data-map-id="forest_clearing" title="Lokacja leśna 32×32: Polana Wilczego Ognia">
            🌲 Polana
          </button>
          <button class="compass-angle-btn ${this.game.map.id === 'slavic_village' ? 'active' : ''}" data-map-id="slavic_village" title="Słowiańska Osada i Targowisko 32×32: Chaty, Kramy, Studnia i Posąg Światowida">
            🏘️ Słowiańska Osada
          </button>
          ${
            this.devMode
              ? `<button class="compass-angle-btn ${this.game.map.id === 'sanctum_dungeon' ? 'active' : ''}" data-map-id="sanctum_dungeon" title="Lokacja lochów 20×20: Sanktuarium Korony">
            🏰 Sanktuarium
          </button>`
              : ''
          }
          <span style="opacity:0.3;margin:0 4px;">|</span>
      `;

    const isFullscreen =
      typeof document !== 'undefined' && Boolean(document.fullscreenElement);

    const fullscreenBtnHtml = `
      <button
        type="button"
        class="fullscreen-top-btn ${isFullscreen ? 'active' : ''}"
        data-action="toggle-fullscreen"
        title="Przełącz grę w tryb pełnoekranowy (F11 / Pełny ekran)"
      >
        ⛶ ${isFullscreen ? 'Zamknij pełny ekran' : 'Pełny ekran'}
      </button>
    `;

    const discreetSaveBtnHtml = `
      <button
        type="button"
        class="discrete-save-btn ${this.saveToastActive ? 'saved' : ''}"
        data-action="save-game"
        title="Dyskretny zapis stanu gry (gra zapisuje się też automatycznie na F5 i przy wyjściu) [Ctrl+S]"
      >
        ${this.saveToastActive ? '✓ Zapisano' : '💾 Zapisz'}
      </button>
    `;

    const telemetryOrControlsHtml = this.devMode
      ? `
        <div class="telemetry-badges">
          <button type="button" class="compass-angle-btn" data-action="spawn-npc" title="Dodaj losowego NPC na mapę">➕ NPC</button>
          <button type="button" class="compass-angle-btn" data-action="clear-map" title="Wyczyść wszystkie obiekty i NPC (czysta makieta)">🧹 Czysta Mapa</button>
          <button type="button" class="compass-angle-btn ${this.isPlaytestInEditor ? 'active' : ''}" data-action="toggle-editor-playtest" title="Przełącz między czystym Edytorem Poziomu a testowaniem rozgrywki cRPG">
            ${this.isPlaytestInEditor ? '🛠️ Wróć do Edytora' : '🎮 Testuj Rozgrywkę'}
          </button>
          ${discreetSaveBtnHtml}
          <span class="telemetry-pill">FPS: <strong>${this.scene.fps}</strong></span>
          <span class="telemetry-pill">Bake: <strong>${this.scene.lastBakeDurationMs} ms</strong></span>
          <span class="telemetry-pill">Obiekty: <strong>${this.game.map.props.length}</strong></span>
          ${fullscreenBtnHtml}
        </div>
      `
      : `
        <div class="telemetry-badges">
          <span class="telemetry-pill">LPM: <strong>Ruch</strong> • I: <strong>Plecak</strong></span>
          ${discreetSaveBtnHtml}
          <button
            type="button"
            class="discrete-reset-btn"
            data-action="reset-save"
            title="Rozpocznij nową grę od początku (kasuje zapis)"
          >
            🔄 Nowa gra
          </button>
          ${fullscreenBtnHtml}
        </div>
      `;

    const visibleLogs = this.isChronicleExpanded
      ? this.game.logs
      : this.game.logs.slice(0, 6);

    const hTile = this.scene.hoveredWorldTile;
    const hoverCoordText = hTile
      ? `📍 Kafel: (${hTile.x}, ${hTile.y}) • Wysokość Z=${hTile.z} • Teren: ${this.game.map.tiles[hTile.y]?.[hTile.x]?.terrain ?? '—'}`
      : '📍 Najedź kursorem na siatkę mapy, aby edytować kafel';

    const bottomAreaHtml =
      this.devMode && !this.isPlaytestInEditor
        ? `
      <div class="editor-status-bar">
        <div class="editor-status-row">
          <span class="editor-coord-pill">${hoverCoordText}</span>
          <span class="editor-tool-pill">🛠️ Aktywne narzędzie: <strong>${this.scene.activeTool}</strong> (Pędzel ${this.scene.editorBrushSize}×${this.scene.editorBrushSize})</span>
          <span class="editor-shortcuts-pill">LPM / Przeciągnij = Maluj/Stawiaj • PPM = Przesuń kamerę • Rolka = Zoom • [R] = Obróć obiekt • [Q/E] = Obrót 90°</span>
        </div>
        <div class="editor-last-log">📝 ${this.game.logs[0] ?? 'Gotowy do edycji poziomu.'}</div>
      </div>
    `
        : `
      ${dialogueHtml}
      ${inventoryDrawerHtml}
      ${this.buildCombatOverlayHtml()}

      <div class="bottom-hud">
        <div class="hero-card">
          <div class="portrait-frame">
            <img src="${charTex.portraitDataUrl}" alt="Portret Bohatera" class="hero-portrait-img" />
            <span class="armor-badge" title="Całkowity Pancerz / Obrażenia">🛡️ ${totalArmor} | ⚔️ ${totalAttack}</span>
          </div>
          <div class="hero-details">
            <div class="hero-name">${player.recipe.name} <span class="hero-hp-ap-pill">❤️ ${player.combat?.hp ?? 215}/${player.combat?.maxHp ?? 215} • ⚡ ${player.combat?.ap ?? 11}/${player.combat?.maxAp ?? 11} AP</span></div>
            <div class="hero-title">${player.recipe.title}</div>
            <div class="attr-row">
              <span title="Siła">SIŁ <strong>${attrs.might}</strong></span>
              <span title="Finezja">FIN <strong>${attrs.finesse}</strong></span>
              <span title="Determinacja">DET <strong>${attrs.resolve}</strong></span>
              <span title="Wiedza Tajemna">WIE <strong>${attrs.lore}</strong></span>
              <span title="Percepcja">PER <strong>${attrs.perception}</strong></span>
            </div>
            <div class="quick-actions">
              <button class="hud-btn ${this.isInventoryOpen ? 'active' : ''}" data-action="toggle-inventory" title="Otwórz Plecak (Klawisz I)">
                🎒 Plecak (${occupiedCount}/${this.game.backpack.capacity})
              </button>
              <button class="hud-btn" data-action="use-campfire" title="Podejdź do ogniska i upiecz kiełbasę">
                🔥 ${hasRawSausage ? 'Upiecz Kiełbasę!' : 'Ognisko'}
              </button>
              <button class="hud-btn" data-action="center-camera" title="Wycentruj kamerę na bohaterze">
                🎯 Kamera
              </button>
              ${
                this.devMode
                  ? `
              <button class="hud-btn" data-action="spawn-npc">
                ➕ Losowy NPC
              </button>
              `
                  : ''
              }
            </div>
          </div>
        </div>

        <div class="chronicle-log ${this.isChronicleExpanded ? 'expanded' : ''}">
          <div class="log-header">
            <span>Kronika Wydarzeń (${this.game.logs.length})</span>
            ${
              this.isChronicleExpanded
                ? `<button type="button" class="chronicle-toggle-btn collapse-red" data-action="toggle-chronicle" title="Zwiń Kronikę Wydarzeń">Zwiń</button>`
                : `<button type="button" class="chronicle-toggle-btn expand-btn" data-action="toggle-chronicle" title="Rozwiń Kronikę Wydarzeń na całą wysokość ekranu">Rozwiń</button>`
            }
          </div>
          <div class="log-entries">
            ${visibleLogs
              .map((entry) => `<div class="log-line">• ${entry}</div>`)
              .join('')}
          </div>
        </div>
      </div>
    `;

    this.root.innerHTML = `
      ${edgeOverlayHtml}
      <div class="top-bar">
        <div class="brand-block">
          <span class="brand-crest">${this.devMode ? '🛠️' : '❖'}</span>
          <div>
            <div class="world-title">${this.devMode ? `EDYTOR POZIOMÓW <span style="opacity:0.75;font-weight:500;">— ${this.game.map.name} (${this.game.map.width}×${this.game.map.height})</span>` : this.game.map.name}</div>
            <div class="world-subtitle">${this.devMode ? 'Tryb projektowania mapy: maluj teren LPM, stawiaj obiekty Glionox/Slavic, zmieniaj wysokość Z i eksportuj JSON' : 'Otoczona puszczą polana obozowa — Zbierz ekwipunek, upiecz kiełbasę na ognisku i porozmawiaj z towarzyszami'}</div>
          </div>
        </div>

        <div class="camera-compass-bar">
          ${mapSwitcherHtml}
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

        ${telemetryOrControlsHtml}
      </div>

      ${bottomAreaHtml}
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
        } else if (action === 'sell-duplicates') {
          this.game.sellAllDuplicatesForSiekance();
          this.render();
        } else if (action === 'sell-single') {
          const instId = btn.dataset.instanceId;
          if (instId) {
            this.game.sellItemForSiekance(instId);
            this.hoveredBagInstanceId = null;
            this.render();
          }
        } else if (action === 'toggle-inventory') {
          this.isInventoryOpen = !this.isInventoryOpen;
          this.hoveredBagInstanceId = null;
          this.hoveredEquipSlot = null;
          this.render();
        } else if (action === 'toggle-chronicle') {
          this.toggleChronicleExpanded();
        } else if (action === 'toggle-combat-advanced') {
          this.toggleCombatAdvanced();
        } else if (action === 'toggle-fullscreen') {
          this.toggleFullscreen();
        } else if (action === 'save-game') {
          this.saveGameDiscreetly();
        } else if (action === 'reset-save') {
          const ok = typeof window !== 'undefined'
            ? window.confirm('Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.')
            : true;
          if (ok) {
            this.resetSaveAndRestart();
          }
        } else if (action === 'randomize-hero') {
          const newSeed = Math.floor(Math.random() * 90000) + 100;
          const rand = generateRandomCharacterRecipe(newSeed, this.game.player.id);
          this.game.player.recipe = {
            ...this.game.player.recipe,
            seed: newSeed,
            skinTone: rand.skinTone,
            hairColor: rand.hairColor,
            hairStyle: rand.hairStyle
          };
          this.game.addLog(`Wylosowano nowe cechy wyglądu bohatera (seed #${newSeed}).`);
          this.render();
        } else if (action === 'use-campfire') {
          const cf = this.game.map.props.find((p) => p.kind === 'campfire');
          if (cf) {
            this.game.commandInteractWithProp(cf.id);
            this.render();
          }
        } else if (action === 'try-exit') {
          const exitProp = this.game.map.props.find((p) => p.kind === 'exit_path');
          if (exitProp) {
            this.game.commandInteractWithProp(exitProp.id);
            this.render();
          }
        } else if (action === 'use-well') {
          const wellProp = this.game.map.props.find((p) => p.kind === 'slavic_well');
          if (wellProp) {
            this.game.commandInteractWithProp(wellProp.id);
            this.render();
          }
        } else if (action === 'use-shrine') {
          const shrineProp = this.game.map.props.find((p) => p.kind === 'slavic_shrine');
          if (shrineProp) {
            this.game.commandInteractWithProp(shrineProp.id);
            this.render();
          }
        } else if (action === 'spawn-npc') {
          this.game.spawnRandomNpc();
          this.render();
        } else if (action === 'clear-map') {
          this.scene.clearMapEntities();
          this.render();
        } else if (action === 'toggle-editor-playtest') {
          this.isPlaytestInEditor = !this.isPlaytestInEditor;
          this.scene.activeTool = this.isPlaytestInEditor ? 'interact' : 'paint_terrain';
          this.render();
        } else if (action === 'center-camera') {
          this.scene.centerCameraOnPlayer();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-map-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mapId = btn.dataset.mapId as MapId;
        this.game.loadMap(mapId);
        this.scene.centerCameraOnPlayer();
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-engage-enemy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const enemyId = btn.dataset.engageEnemy;
        if (enemyId) {
          this.game.commandAttackEnemy(enemyId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-talk-npc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const npcId = btn.dataset.talkNpc;
        if (npcId) {
          this.game.commandTalkToNpc(npcId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-quick-strike]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.quickStrike as CombatAttackMode | undefined;
        if (mode) {
          this.executeQuickStrike(mode);
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-attack-mode]').forEach((btn) => {
      if (btn.hasAttribute('data-quick-strike')) return;
      btn.addEventListener('click', () => {
        const mode = btn.dataset.attackMode as CombatAttackMode | undefined;
        if (mode) {
          this.game.combatState.selectedAttackMode = mode;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-combat-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.combatTarget;
        if (targetId) {
          this.game.combatState.selectedTargetId = targetId;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-combat-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.combatAction;
        if (act === 'attack') {
          const targetId = this.game.combatState.selectedTargetId;
          if (targetId) {
            this.game.commandAttackEnemy(targetId);
          }
        } else if (act === 'defend') {
          this.game.activatePlayerDefendStance();
        } else if (act === 'end-turn') {
          this.game.endPlayerCombatTurn();
        } else if (act === 'flee') {
          this.game.fleeCombat();
        }
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-rot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rot = Number(btn.dataset.rot) as 0 | 1 | 2 | 3;
        this.scene.setRotation(rot);
      });
    });

    // Paperdoll equipped slot interactions (hover to inspect, click to unequip)
    this.root.querySelectorAll<HTMLElement>('[data-equip-slot]').forEach((slotEl) => {
      const slot = slotEl.dataset.equipSlot as EquipSlot | undefined;
      if (!slot) return;

      slotEl.addEventListener('mouseenter', () => {
        this.hoveredEquipSlot = slot;
        this.hoveredBagInstanceId = null;
        this.refreshLiveComparisonDom();
      });

      slotEl.addEventListener('mouseleave', () => {
        if (this.hoveredEquipSlot === slot) {
          this.hoveredEquipSlot = null;
          this.refreshLiveComparisonDom();
        }
      });

      slotEl.addEventListener('click', () => {
        if (this.game.unequipSlotToBackpack(slot)) {
          this.hoveredEquipSlot = null;
          this.render();
        }
      });
    });

    // Backpack filter tabs
    this.root.querySelectorAll<HTMLElement>('[data-bag-filter]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        this.activeFilter = (tabBtn.dataset.bagFilter as BackpackFilterCategory) || 'all';
        this.render();
      });
    });

    // Backpack sort buttons
    this.root.querySelectorAll<HTMLElement>('[data-bag-sort]').forEach((sortBtn) => {
      sortBtn.addEventListener('click', () => {
        const crit = sortBtn.dataset.bagSort as 'rarity' | 'type' | 'weight' | undefined;
        if (crit) {
          this.game.backpack.sortBy(crit);
          this.render();
        }
      });
    });

    // Split stack buttons
    this.root.querySelectorAll<HTMLElement>('[data-split-slot]').forEach((splitBtn) => {
      splitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(splitBtn.dataset.splitSlot);
        const slotItem = this.game.backpack.getSlot(idx);
        if (slotItem && slotItem.stackCount > 1) {
          const half = Math.max(1, Math.floor(slotItem.stackCount / 2));
          if (this.game.backpack.splitStack(idx, half)) {
            this.game.addLog(`Podzielono stos przedmiotu na dwie części.`);
            this.render();
          }
        }
      });
    });

    // Backpack slots: hover for Live Comparison, click to equip/use, drag & drop to swap slots
    this.root.querySelectorAll<HTMLElement>('.backpack-slot').forEach((slotEl) => {
      const slotIdx = Number(slotEl.dataset.slotIndex);
      const instanceId = slotEl.dataset.bagInstanceId;

      if (instanceId) {
        slotEl.addEventListener('mouseenter', () => {
          this.hoveredBagInstanceId = instanceId;
          this.hoveredEquipSlot = null;
          this.refreshLiveComparisonDom();
        });

        slotEl.addEventListener('mouseleave', () => {
          if (this.hoveredBagInstanceId === instanceId) {
            this.hoveredBagInstanceId = null;
            this.refreshLiveComparisonDom();
          }
        });

        slotEl.addEventListener('click', (e) => {
          if ((e.target as HTMLElement)?.closest('.bag-sell-btn')) {
            return;
          }
          if (this.game.useOrEquipInstance(instanceId)) {
            this.hoveredBagInstanceId = null;
            this.render();
          }
        });

        slotEl.addEventListener('dragstart', () => {
          this.draggedSlotIndex = slotIdx;
        });
      }

      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        slotEl.classList.add('drag-over');
      });

      slotEl.addEventListener('dragleave', () => {
        slotEl.classList.remove('drag-over');
      });

      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        if (this.draggedSlotIndex !== null && this.draggedSlotIndex !== slotIdx) {
          this.game.backpack.swapSlots(this.draggedSlotIndex, slotIdx);
          this.draggedSlotIndex = null;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('.btn-buy-ware').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.buyItemId;
        const merchantId = btn.dataset.merchantId;
        if (itemId && merchantId) {
          this.game.buyItemFromMerchant(merchantId, itemId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-choice-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.choiceIdx);
        const choice = this.game.activeDialogue?.node.choices[idx];
        if (choice) {
          if (choice.action === 'open_trade') {
            this.isInventoryOpen = true;
          }
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

    this.root.querySelectorAll<HTMLElement>('[data-edge-dir]').forEach((arrowBtn) => {
      const dir = arrowBtn.dataset.edgeDir as EdgePanDirection | undefined;
      if (!dir) return;

      const activate = (e: Event): void => {
        e.stopPropagation();
        this.scene.setForcedEdgeDirection(dir);
      };

      const deactivate = (): void => {
        if (this.scene.forcedEdgeDirection === dir) {
          this.scene.setForcedEdgeDirection(null);
        }
      };

      arrowBtn.addEventListener('pointerenter', activate);
      arrowBtn.addEventListener('mouseenter', activate);
      arrowBtn.addEventListener('pointerdown', activate);
      arrowBtn.addEventListener('mousedown', activate);
      arrowBtn.addEventListener('pointerleave', deactivate);
      arrowBtn.addEventListener('mouseleave', deactivate);
      arrowBtn.addEventListener('pointerup', deactivate);
      arrowBtn.addEventListener('mouseup', deactivate);
      arrowBtn.addEventListener('pointercancel', deactivate);
    });
  }
}
