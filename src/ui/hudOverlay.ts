import { generateRandomCharacterRecipe } from '../assets/characterBakery';
import { getSlavicPortrait } from '../assets/slavicPortraits';
import { CombatAudioEngine } from '../audio/combatAudio';
import { EdgePanDirection } from '../core/isoMath';
import { MapId } from '../core/worldMap';
import { IsoSceneView } from '../renderer/isoSceneView';
import { CharacterAttributes, HairStyle } from '../rpg/characterData';
import {
  ATTACK_MODE_META,
  CombatAttackMode,
  computeAttackPreview,
  getWeaponCombatProfile,
  PROFICIENCY_META,
  WeaponProficiencyCategory
} from '../rpg/combatSystem';
import {
  ATTRIBUTE_LABELS,
  canUnlockSkill,
  getSkillRank,
  MAX_CHARACTER_LEVEL,
  RESPEC_COST_SIEKANCE,
  SKILL_BRANCH_META,
  SKILL_TREE_BY_ID,
  SKILL_TREE_DEFS,
  SkillBranchId,
  xpForNextLevel
} from '../rpg/progressionSystem';
import { getMerchantSpecialty, getMerchantWares, getPrzasneKolapsyForNpc } from '../rpg/dialogueSystem';
import { ChronicleEntry, CrpgGameState, MERCHANT_ACTOR_IDS } from '../rpg/gameLoop';
import {
  clearSave,
  hasSavedGame,
  loadGame,
  saveGame,
  setAutosaveDisabled
} from '../rpg/saveSystem';
import {
  createItemInstance,
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

export type BackpackFilterCategory = 'all' | 'weapons' | 'armor' | 'trinkets' | 'consumables';

export interface HudDevSceneOption {
  id: string;
  label: string;
}

export interface HudHeroMeta {
  level?: number;
  xpPct?: number;
  xpTooltip?: string;
  currencyText?: string;
  pendingLevelUpPts?: number;
}

export interface HudOverlayOptions {
  devMode?: boolean;
  devScenes?: ReadonlyArray<HudDevSceneOption>;
  getActiveDevSceneId?: () => string;
  onSelectDevScene?: (id: string) => void;
  getHeroMeta?: () => HudHeroMeta | null;
  unifiedCharacterSheet?: boolean;
  onOpenCharacterSheet?: (initialTab?: 'stats' | 'gear' | 'journal') => void;
  onOpenCamp?: () => void;
  onSaveGame?: () => void;
  onLoadGame?: () => void;
  hasSave?: () => boolean;
  onOpenSaveKey?: () => void;
  onNewGame?: () => void;
  onToggleAudio?: (muted: boolean) => void;
  onEscapeNoModal?: () => void;
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

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  private readonly options: HudOverlayOptions;
  private isDevSelectorOpen = false;
  private isInventoryOpen: boolean;
  private isCharacterOpen = false;
  private activeSkillBranch: SkillBranchId = 'witez';
  private selectedSkillNodeId = 'witez_hart';
  private isPlaytestInEditor = false;
  private isChronicleExpanded = false;
  private chronicleImportantOnly = false;
  private isCombatAdvancedOpen = false;
  private isFleeConfirmPending = false;
  private isCreditsOpen = false;
  public activeBattleLogTab: 'combat' | 'chronicle' = 'combat';
  public isCombatLogExpanded = false;
  private saveToastActive = false;
  private saveToastTimer: number | null = null;
  private activeFilter: BackpackFilterCategory = 'all';
  private hoveredBagInstanceId: string | null = null;
  private hoveredEquipSlot: EquipSlot | null = null;
  private draggedSlotIndex: number | null = null;
  private activeCombatReportModalId: string | null = null;
  private inspectedItemInstanceId: string | null = null;

  constructor(
    root: HTMLElement,
    game: CrpgGameState,
    scene: IsoSceneView,
    options?: HudOverlayOptions
  ) {
    this.root = root;
    this.game = game;
    this.scene = scene;
    this.options = options ?? {};
    this.devMode = options?.devMode ?? false;
    this.isInventoryOpen = false;
    HudOverlay.activeInstance = this;

    if (typeof window !== 'undefined' && !HudOverlay.windowListenersBound) {
      HudOverlay.windowListenersBound = true;
      window.addEventListener('keydown', (e) => {
        HudOverlay.activeInstance?.handleGlobalKey(e);
      });

      if (typeof document !== 'undefined') {
        document.addEventListener('fullscreenchange', () => {
          HudOverlay.activeInstance?.render();
        });
      }
    }
  }

  public destroy(): void {
    if (this.saveToastTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.saveToastTimer);
      this.saveToastTimer = null;
    }
    if (HudOverlay.activeInstance === this) {
      HudOverlay.activeInstance = null;
    }
  }

  public handleGlobalKey(e: {
    key?: string;
    code?: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    target?: EventTarget | null;
    preventDefault?: () => void;
  }): boolean | void {
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl.tagName) || targetEl.isContentEditable)
    ) {
      return;
    }
    if (e.key === 'Escape' && this.inspectedItemInstanceId) {
      this.inspectedItemInstanceId = null;
      this.render();
      return;
    }
    if (e.key === 'Escape' && this.game.pendingCombatConfirmation) {
      this.game.cancelPendingCombat();
      this.render();
      return;
    }
    if (e.key?.toLowerCase() === 'i' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (this.options.unifiedCharacterSheet && this.options.onOpenCharacterSheet) {
        this.options.onOpenCharacterSheet('gear');
      } else {
        this.toggleInventory();
      }
    } else if (e.key?.toLowerCase() === 'k' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (this.options.onOpenCharacterSheet) {
        this.options.onOpenCharacterSheet('stats');
      } else {
        this.toggleCharacter();
        return true;
      }
    } else if (e.ctrlKey && e.key?.toLowerCase() === 's') {
      e.preventDefault?.();
      if (this.options.onSaveGame) {
        this.options.onSaveGame();
      } else {
        this.saveGameDiscreetly();
      }
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      (e.code === 'Space' || e.key === ' ')
    ) {
      e.preventDefault?.();
      this.isCombatAdvancedOpen = false;
      this.isFleeConfirmPending = false;
      this.game.endPlayerCombatTurn(true);
      this.render();
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      e.key === '1'
    ) {
      this.isFleeConfirmPending = false;
      this.executeQuickStrike('quick');
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      e.key === '2'
    ) {
      this.isFleeConfirmPending = false;
      this.executeQuickStrike('power');
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      e.key === '3'
    ) {
      this.isCombatAdvancedOpen = false;
      this.isFleeConfirmPending = false;
      this.game.activatePlayerDefendStance();
      this.render();
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      (e.key === '4' || e.key === '5' || e.key === '6' || e.key === '7')
    ) {
      const slotIdx = Number(e.key) - 4;
      this.isFleeConfirmPending = false;
      if (this.game.useCombatQuickBeltSlot(slotIdx)) {
        this.isCombatAdvancedOpen = false;
        this.render();
      } else if (slotIdx < 3) {
        const unlockedActive = SKILL_TREE_DEFS.filter(
          (n) => n.kind === 'active' && getSkillRank(this.game.progression, n.id) > 0 && n.activeAbility
        );
        const skill = unlockedActive[slotIdx];
        if (skill) {
          this.game.performPlayerCombatSkill(
            skill.id,
            this.game.combatState.selectedTargetId ?? undefined
          );
          this.render();
        }
      }
    } else if (
      this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive &&
      e.key?.toLowerCase() === 'v'
    ) {
      this.isFleeConfirmPending = false;
      this.toggleCombatAdvanced();
    } else if (
      !this.game.combatState.active &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey &&
      e.key?.toLowerCase() === 'c'
    ) {
      this.game.toggleStealth();
      this.render();
    } else if (e.key?.toLowerCase() === 'm' && !e.ctrlKey && !e.altKey) {
      const audio = CombatAudioEngine.getInstance();
      const nextMuted = !audio.getMuted();
      audio.setMuted(nextMuted);
      this.options.onToggleAudio?.(nextMuted);
      this.render();
    } else if (e.key === 'Escape') {
      if (this.isFleeConfirmPending) {
        this.isFleeConfirmPending = false;
        this.render();
      } else if (this.activeCombatReportModalId) {
        this.activeCombatReportModalId = null;
        this.render();
      } else if (this.isCreditsOpen) {
        this.isCreditsOpen = false;
        this.render();
      } else if (this.isCombatAdvancedOpen) {
        this.isCombatAdvancedOpen = false;
        this.render();
      } else if (this.isChronicleExpanded) {
        this.isChronicleExpanded = false;
        this.render();
      } else if (this.isCharacterOpen) {
        this.isCharacterOpen = false;
        this.render();
        return true;
      } else if (this.game.activeDialogue) {
        this.game.activeDialogue = null;
        this.render();
      } else if (this.isInventoryOpen) {
        this.isInventoryOpen = false;
        this.render();
      } else if (this.options.onEscapeNoModal) {
        this.options.onEscapeNoModal();
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
    setAutosaveDisabled(true);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('ulf_skip_restore', '1');
      }
    } catch {}
    clearSave('all');
    this.game.resetToNewGame('forest_clearing');
    if (this.scene) {
      this.scene.setRotation(0);
      this.scene.zoom = 1.0;
      this.scene.centerCameraOnPlayer();
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    } else {
      this.render();
    }
  }

  public toggleChronicleExpanded(): void {
    this.isChronicleExpanded = !this.isChronicleExpanded;
    this.render();
  }

  public toggleInventory(): void {
    this.isInventoryOpen = !this.isInventoryOpen;
    if (this.isInventoryOpen) {
      this.isCharacterOpen = false;
    }
    this.render();
  }

  public toggleCharacter(): void {
    this.isCharacterOpen = !this.isCharacterOpen;
    if (this.isCharacterOpen) {
      this.isInventoryOpen = false;
    }
    this.render();
  }

  public toggleCombatAdvanced(): void {
    this.isCombatAdvancedOpen = !this.isCombatAdvancedOpen;
    this.render();
  }

  public executeQuickStrike(mode: CombatAttackMode): void {
    if (
      this.game.isSequentialEnemyTurnActive ||
      this.game.combatState.activeTurnActorId !== this.game.player.id
    ) {
      return;
    }
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
    // Auto-collapse aiming drawer on strike for optimal battlefield view
    this.isCombatAdvancedOpen = false;
    this.render();
  }

  public executeAttack(mode?: CombatAttackMode): void {
    const activeMode = mode ?? this.game.combatState.selectedAttackMode;
    this.executeQuickStrike(activeMode);
  }

  public toggleFullscreen(): void {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  private hasBackpackItemForSlot(slot: EquipSlot): boolean {
    return this.game.backpack.getSlots().some((s) => {
      if (!s) return false;
      const def = getItemDefinition(s.definitionId);
      if (!def || !def.equipSlot) return false;
      if (slot === 'ring1' || slot === 'ring2') {
        return def.equipSlot === 'ring1' || def.equipSlot === 'ring2';
      }
      return def.equipSlot === slot;
    });
  }

  private renderPaperdollSlot(slot: EquipSlot): string {
    const slotMeta = EQUIP_SLOT_LABELS[slot];
    const equipped = this.game.equipmentManager.getEquipped(slot);
    const mainHandItem = this.game.equipmentManager.getEquipped('mainHand');
    const mainHandDef = mainHandItem ? getItemDefinition(mainHandItem.definitionId) : undefined;
    const isBlockedByTwoHanded = slot === 'offHand' && Boolean(mainHandDef?.isTwoHanded);

    if (isBlockedByTwoHanded && mainHandDef) {
      const safeMainHandName = escapeHtml(mainHandDef.name);
      return `
        <div class="paperdoll-slot blocked-2h" data-equip-slot="${slot}" title="Zablokowane przez broń dwuręczną: ${safeMainHandName}">
          <div class="pd-slot-icon">🔒</div>
          <div class="pd-slot-info">
            <div class="pd-slot-label">${slotMeta.icon} ${slotMeta.label}</div>
            <div class="pd-slot-name muted">Broń 2H</div>
            <span class="pd-slot-status-badge"></span>
          </div>
        </div>
      `;
    }

    if (!equipped) {
      const canEquipFromBag = this.hasBackpackItemForSlot(slot);
      return `
        <div class="paperdoll-slot empty ${canEquipFromBag ? 'has-candidate-in-bag' : ''}" data-equip-slot="${slot}" title="Pusty slot: ${slotMeta.label}${canEquipFromBag ? ' (Masz pasujący przedmiot w plecaku!)' : ''}">
          <div class="pd-slot-icon">${slotMeta.icon}</div>
          <div class="pd-slot-info">
            <div class="pd-slot-label">${slotMeta.icon} ${slotMeta.label}</div>
            <div class="pd-slot-name muted">${canEquipFromBag ? '<span class="can-equip-hint">✦ Możesz założyć</span>' : 'Pusty slot'}</div>
            <span class="pd-slot-status-badge"></span>
          </div>
          ${canEquipFromBag ? '<span class="pd-available-dot" title="W plecaku czeka przedmiot do tego slotu">✦</span>' : ''}
        </div>
      `;
    }

    const def = getItemDefinition(equipped.definitionId);
    if (!def) return '';
    const swatch = `rgb(${def.visualDef.primaryColor.r}, ${def.visualDef.primaryColor.g}, ${def.visualDef.primaryColor.b})`;
    const trim = `rgb(${def.visualDef.trimColor.r}, ${def.visualDef.trimColor.g}, ${def.visualDef.trimColor.b})`;

    const safeDefName = escapeHtml(def.name);
    return `
      <button
        type="button"
        class="paperdoll-slot occupied rarity-${def.rarity.toLowerCase()}"
        data-equip-slot="${slot}"
        title="Kliknij LPM, aby zdjąć do plecaka: ${safeDefName}"
      >
        <div class="pd-slot-swatch" style="background: linear-gradient(135deg, ${swatch} 60%, ${trim} 100%);">
          <span>${slotMeta.icon}</span>
          ${def.isTwoHanded ? '<span class="pd-2h-tag">2H</span>' : ''}
        </div>
        <div class="pd-slot-info">
          <div class="pd-slot-label">${slotMeta.icon} ${slotMeta.label}</div>
          <div class="pd-slot-name">${safeDefName}</div>
          <span class="pd-slot-status-badge"></span>
        </div>
        <span class="pd-unequip-hint">✕</span>
      </button>
    `;
  }

  private buildCombatActiveSkillsHtml(isPlayerTurn: boolean): string {
    const activeSkills = SKILL_TREE_DEFS.filter(
      (n) => n.kind === 'active' && getSkillRank(this.game.progression, n.id) > 0 && n.activeAbility
    );
    if (activeSkills.length === 0) return '';

    const pc = this.game.player.combat;
    const curAp = pc?.ap ?? 0;
    const curMana = pc?.mana ?? pc?.maxMana ?? 0;
    const wp = this.game.getActorCombatant(this.game.player).derived.weaponProfile;
    const target = this.game.combatState.selectedTargetId
      ? this.game.npcs.find((n) => n.id === this.game.combatState.selectedTargetId)
      : undefined;
    const dist =
      target && target.combat?.isAlive
        ? Math.hypot(target.tileX - this.game.player.tileX, target.tileY - this.game.player.tileY)
        : null;

    return activeSkills
      .map((node, idx) => {
        const ab = node.activeAbility!;
        const cd = this.game.progression.activeCooldowns[node.id] ?? 0;
        const maxRange =
          ab.maxRange ??
          (wp.maxRange > 1.5 ? wp.maxRange + (ab.rangeBonus ?? 0) : wp.maxRange);
        const outOfRange =
          ab.targetType === 'enemy' && dist !== null && (dist < ab.minRange - 0.1 || dist > maxRange + 0.45);
        const notEnoughAp = curAp < ab.apCost;
        const notEnoughMana = curMana < ab.manaCost;
        const disabled = !isPlayerTurn || cd > 0 || notEnoughAp || notEnoughMana || outOfRange;

        const costParts = [`⚡ ${ab.apCost} AP`];
        if (ab.manaCost > 0) costParts.push(`💧 ${ab.manaCost} M`);

        let blockerReason = '';
        if (!isPlayerTurn) blockerReason = 'Poczekaj na swoją turę.';
        else if (cd > 0) blockerReason = `Odnowienie: jeszcze ${cd} t.`;
        else if (notEnoughAp) blockerReason = `Za mało AP (${curAp}/${ab.apCost}).`;
        else if (notEnoughMana) blockerReason = `Za mało Many (${curMana}/${ab.manaCost}).`;
        else if (outOfRange) blockerReason = `Cel poza zasięgiem (${dist!.toFixed(1)}/${maxRange}).`;

        const hotkeyBadge = idx < 3 ? ` <kbd>[${idx + 4}]</kbd>` : '';
        const statusLabel =
          cd > 0 ? `⏳ ${cd} t.` : outOfRange ? '📏 Za daleko' : costParts.join(' • ');

        return `
          <button
            type="button"
            class="combat-skill-btn ${disabled ? 'disabled' : ''}"
            data-combat-skill="${node.id}"
            title="${escapeHtml(blockerReason ? `${blockerReason} — ${node.description}` : node.description)}"
          >
            <span class="cs-icon">${node.icon}</span>
            <span class="cs-name">${escapeHtml(node.name)}${hotkeyBadge}</span>
            <span class="cs-cost">${statusLabel}</span>
          </button>
        `;
      })
      .join('');
  }

  private buildCharacterDrawerHtml(
    portraitDataUrl: string,
    attrs: CharacterAttributes
  ): string {
    if (!this.isCharacterOpen) return '';

    const prog = this.game.progression;
    const pc = this.game.player.combat;
    const snap = this.game.getActorCombatant(this.game.player);
    const derived = snap.derived;
    const isMaxLevel = prog.level >= MAX_CHARACTER_LEVEL;
    const xpNext = xpForNextLevel(prog.level);
    const xpPct = isMaxLevel ? 100 : Math.min(100, Math.round((prog.xp / xpNext) * 100));
    const carryMax = this.game.statSheet.getMaxCarryWeight();
    const carryCur = this.game.backpack.currentWeight;

    const attrKeys: Array<keyof CharacterAttributes> = [
      'might',
      'finesse',
      'resolve',
      'lore',
      'perception'
    ];

    const attrRowsHtml = attrKeys
      .map((key) => {
        const meta = ATTRIBUTE_LABELS[key];
        const val = attrs[key];
        const spent = prog.spentAttributePoints[key] ?? 0;
        return `
          <div class="char-attr-row" data-attr-info="${key}">
            <div class="char-attr-info">
              <span class="char-attr-short">${meta.short}</span>
              <span class="char-attr-name">${meta.name}</span>
              ${spent > 0 ? `<span class="char-attr-spent">+${spent}</span>` : ''}
            </div>
            <div class="char-attr-controls">
              <strong class="char-attr-val">${val}</strong>
              <button
                type="button"
                class="char-attr-plus-btn"
                data-alloc-attr="${key}"
                ${prog.attributePoints <= 0 ? 'disabled' : ''}
              >+</button>
            </div>
          </div>
        `;
      })
      .join('');

    const profEntries = (
      Object.entries(PROFICIENCY_META) as Array<
        [WeaponProficiencyCategory, { label: string; shortLabel: string }]
      >
    )
      .map(([cat, meta]) => {
        const val = pc?.proficiencies[cat] ?? 65;
        const pct = Math.min(100, Math.round((val / 150) * 100));
        return `
          <div class="char-prof-row">
            <div class="char-prof-label"><span>${meta.label}</span><span>${val}%</span></div>
            <div class="char-prof-bar"><div class="char-prof-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      })
      .join('');

    const branchTabsHtml = (Object.keys(SKILL_BRANCH_META) as SkillBranchId[])
      .map((bId) => {
        const b = SKILL_BRANCH_META[bId];
        const spentInBranch = SKILL_TREE_DEFS.filter((n) => n.branch === bId).reduce(
          (s, n) => s + getSkillRank(prog, n.id),
          0
        );
        return `
          <button
            type="button"
            class="skill-branch-tab ${this.activeSkillBranch === bId ? 'active' : ''}"
            data-skill-branch="${bId}"
            style="--branch-accent: ${b.accent}"
          >
            <span>${b.icon} ${b.name}</span>
            <span class="branch-pts-pill">${spentInBranch} pkt</span>
          </button>
        `;
      })
      .join('');

    const branchNodes = SKILL_TREE_DEFS.filter((n) => n.branch === this.activeSkillBranch);
    if (!branchNodes.some((n) => n.id === this.selectedSkillNodeId) && branchNodes[0]) {
      this.selectedSkillNodeId = branchNodes[0].id;
    }

    const tierRoman = ['I', 'II', 'III', 'IV'] as const;
    const nodePos = (node: (typeof branchNodes)[number]): { x: number; y: number } => {
      const y = (node.tier - 1) * 25 + 12.5;
      const x = node.slot === 'left' ? 30 : node.slot === 'right' ? 70 : 50;
      return { x, y };
    };
    const svgLinesHtml = branchNodes
      .flatMap((node) =>
        node.prerequisites.map((preId) => {
          const pre = branchNodes.find((n) => n.id === preId);
          if (!pre) return '';
          const p1 = nodePos(pre);
          const p2 = nodePos(node);
          const preUnlocked = getSkillRank(prog, pre.id) > 0;
          const bothUnlocked = preUnlocked && getSkillRank(prog, node.id) > 0;
          const cls = bothUnlocked ? 'conn-active' : preUnlocked ? 'conn-ready' : 'conn-locked';
          return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="${cls}" />`;
        })
      )
      .join('');

    const tiersHtml = ([1, 2, 3, 4] as const)
      .map((tier) => {
        const nodes = branchNodes.filter((n) => n.tier === tier);
        const nodesHtml = nodes
          .map((node) => {
            const rank = getSkillRank(prog, node.id);
            const unlockCheck = canUnlockSkill(prog, attrs, node.id);
            const stateCls =
              rank >= node.maxRank
                ? 'maxed'
                : rank > 0
                  ? 'unlocked'
                  : unlockCheck.ok
                    ? 'available'
                    : 'locked';
            const selectedCls = this.selectedSkillNodeId === node.id ? 'selected' : '';
            const lockPrefix = stateCls === 'locked' ? '🔒 ' : '';
            return `
              <button
                type="button"
                class="skill-node-card ${stateCls} ${selectedCls} slot-${node.slot}"
                data-skill-node="${node.id}"
              >
                <div class="skill-node-top">
                  <span class="skill-node-icon">${node.icon}</span>
                  <span class="skill-node-rank">${lockPrefix}${rank}/${node.maxRank}</span>
                </div>
                <div class="skill-node-name">${escapeHtml(node.name)}</div>
                <div class="skill-node-kind">${node.kind === 'active' ? 'AKTYWNA' : 'PASYWNA'}</div>
              </button>
            `;
          })
          .join('');
        return `
          <div class="skill-tier-row tier-${tier}">
            <span class="skill-tier-badge" title="Poziom drzewka ${tierRoman[tier - 1]}">${tierRoman[tier - 1]}</span>
            ${nodesHtml}
          </div>
        `;
      })
      .join('');

    const selNode = SKILL_TREE_BY_ID[this.selectedSkillNodeId] ?? branchNodes[0];
    const selRank = selNode ? getSkillRank(prog, selNode.id) : 0;
    const selCheck = selNode ? canUnlockSkill(prog, attrs, selNode.id) : { ok: false };
    const branchMeta = SKILL_BRANCH_META[this.activeSkillBranch];

    const totalSpent =
      Object.values(prog.spentAttributePoints).reduce((s, v) => s + (v || 0), 0) +
      Object.values(prog.unlockedSkills).reduce((s, v) => s + (v || 0), 0);
    const respecBlocker = this.game.combatState.active
      ? 'Niedostępne w trakcie walki'
      : totalSpent === 0
        ? 'Brak przydzielonych punktów'
        : this.game.siekance < RESPEC_COST_SIEKANCE
          ? `Wymaga ${RESPEC_COST_SIEKANCE} siekańców (masz ${this.game.siekance})`
          : '';
    const canRespec = respecBlocker === '';

    return `
      <div class="character-backdrop" data-action="close-character">
      <div class="character-drawer dark-fantasy-frame">
        <div class="drawer-header">
          <div class="drawer-title">
            <span>❖ Karta Postaci — ${escapeHtml(this.game.player.recipe.name)}</span>
            <span class="char-level-pill">Poziom ${prog.level}</span>
            ${
              prog.attributePoints + prog.skillPoints > 0
                ? `<span class="char-points-banner">✨ Atrybuty: <strong>${prog.attributePoints}</strong> • Umiejętności: <strong>${prog.skillPoints}</strong></span>`
                : ''
            }
          </div>
          <div class="drawer-header-actions">
            <button type="button" class="char-close-btn" data-action="close-character" title="Zamknij okno Postaci [Esc]">✕ Zamknij [Esc]</button>
          </div>
        </div>

        <div class="character-workspace">
          <div class="char-left-column">
            <div class="char-identity-card">
              <img src="${portraitDataUrl}" alt="Portret" class="char-drawer-portrait" />
              <div class="char-identity-meta">
                <div class="char-identity-title">${escapeHtml(this.game.player.recipe.title)}</div>
                <div class="char-xp-row">
                  <span>${isMaxLevel ? 'Maksymalny poziom' : `XP: ${prog.xp} / ${xpNext}`}</span>
                  <span>${xpPct}%</span>
                </div>
                <div class="char-xp-bar"><div class="char-xp-fill" style="width:${xpPct}%"></div></div>
                <div class="char-resources-row">
                  <span>❤️ ${pc?.hp ?? derived.maxHp}/${derived.maxHp}</span>
                  <span>💧 ${pc?.mana ?? derived.maxMana}/${derived.maxMana}</span>
                  <span>⚡ ${pc?.ap ?? derived.maxAp}/${derived.maxAp} AP</span>
                </div>
              </div>
            </div>

            <div class="char-section-box">
              <div class="char-section-header">
                <span>Rozdział Atrybutów</span>
                <span class="char-pts-pill ${prog.attributePoints > 0 ? 'has-pts' : ''}">Wolne: ${prog.attributePoints}</span>
              </div>
              <div class="char-attr-list">${attrRowsHtml}</div>
            </div>

            <div class="char-section-box">
              <div class="char-section-header"><span>Statystyki Bojowe</span></div>
              <div class="char-derived-grid">
                <div><span>⚔️ Obrażenia</span><strong>${derived.minDamage}–${derived.maxDamage}</strong></div>
                <div><span>💥 Szansa Kryta</span><strong>${derived.critChancePct}%</strong></div>
                <div><span>🛡️ Pancerz (DT/DR)</span><strong>${derived.damageThreshold} / ${derived.damageResistancePct}%</strong></div>
                <div><span>💨 Unik</span><strong>${derived.evasionPct}%</strong></div>
                <div><span>⚡ Inicjatywa</span><strong>${derived.sequence}</strong></div>
                <div><span>🎒 Udźwig</span><strong>${carryCur.toFixed(1)}/${carryMax} kg</strong></div>
              </div>
            </div>

            <div class="char-section-box">
              <div class="char-section-header"><span>Biegłości Broni</span></div>
              <div class="char-prof-list">${profEntries}</div>
            </div>
          </div>

          <div class="char-right-column">
            <div class="char-section-header">
              <span>Drzewko Umiejętności</span>
              <span class="char-pts-pill ${prog.skillPoints > 0 ? 'has-pts' : ''}">Punkty Umiejętności: ${prog.skillPoints}</span>
            </div>

            <div class="skill-branch-tabs">${branchTabsHtml}</div>
            <div class="skill-branch-subtitle">${branchMeta.icon} ${escapeHtml(branchMeta.subtitle)}</div>

            <div class="skill-tree-canvas">
              <svg class="skill-tree-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svgLinesHtml}</svg>
              ${tiersHtml}
            </div>

            ${
              selNode
                ? `
              <div class="skill-inspector-card">
                <div class="skill-insp-header">
                  <div>
                    <span class="skill-insp-icon">${selNode.icon}</span>
                    <strong>${escapeHtml(selNode.name)}</strong>
                    <span class="skill-insp-badge">${selNode.kind === 'active' ? 'Zdolność Aktywna' : 'Talent Pasywny'}</span>
                  </div>
                  <span class="skill-insp-rank">Ranga ${selRank}/${selNode.maxRank}</span>
                </div>
                <p class="skill-insp-desc">${escapeHtml(selNode.description)}</p>
                <div class="skill-insp-footer">
                  <span class="skill-insp-req">${selCheck.ok ? '✅ Gotowe do odblokowania (koszt: 1 pkt)' : escapeHtml(selCheck.reason ?? '')}</span>
                  <button
                    type="button"
                    class="hud-btn skill-unlock-btn"
                    data-unlock-skill="${selNode.id}"
                    ${!selCheck.ok ? 'disabled' : ''}
                  >
                    ${selRank >= selNode.maxRank ? 'Maks. ranga' : selRank > 0 ? 'Ulepsz (1 pkt)' : 'Odblokuj (1 pkt)'}
                  </button>
                </div>
              </div>
            `
                : ''
            }

            <div class="char-respec-bar">
              <span>💰 Srebro: <strong>${this.game.siekance} siekańców</strong>${respecBlocker ? ` <span class="respec-blocker">(${escapeHtml(respecBlocker)})</span>` : ''}</span>
              <button
                type="button"
                class="hud-btn respec-btn"
                data-action="respec-progression"
                ${!canRespec ? 'disabled' : ''}
                title="${escapeHtml(respecBlocker || 'Zwróć wszystkie przydzielone punkty atrybutów i umiejętności (poza walką)')}"
              >
                🔄 Resetuj rozwój (${RESPEC_COST_SIEKANCE} siek.)
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="skill-hover-tooltip" id="skill-hover-tooltip" role="tooltip" aria-hidden="true"></div>
      </div>
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

  private buildCombatTopBannerHtml(): string {
    if (!this.game.combatState.active) return '';

    const pCombat = this.game.player.combat!;
    const livingEnemies = this.game.npcs.filter(
      (n) => n.combat?.isHostile && n.combat.isAlive
    );
    const selectedEnemy =
      livingEnemies.find((e) => e.id === this.game.combatState.selectedTargetId) ??
      livingEnemies[0];

    if (!selectedEnemy || !selectedEnemy.combat) return '';

    const playerSnap = this.game.getActorCombatant(this.game.player);
    const enemySnap = this.game.getActorCombatant(selectedEnemy);
    const dist = Math.hypot(
      selectedEnemy.tileX - this.game.player.tileX,
      selectedEnemy.tileY - this.game.player.tileY
    );
    const activeMode = this.game.combatState.selectedAttackMode;
    const activePreview = computeAttackPreview(playerSnap, enemySnap, dist, activeMode);

    const enemyHpPct = Math.max(
      0,
      Math.min(100, Math.round((selectedEnemy.combat.hp / selectedEnemy.combat.maxHp) * 100))
    );

    const isPlayerTurn =
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive;
    const actingEnemy = !isPlayerTurn
      ? livingEnemies.find((e) => e.id === this.game.combatState.activeTurnActorId)
      : undefined;
    const enemyTurnLabel = actingEnemy
      ? `TURA PRZECIWNIKA: ${escapeHtml(actingEnemy.recipe.name)}…`
      : 'TURA PRZECIWNIKA…';

    const playerStatuses: string[] = [];
    if (this.game.surpriseBonusPending) playerStatuses.push('<span class="cb-status-tag ambush">Zaskoczenie +25%/+35%</span>');
    if (pCombat.defending) playerStatuses.push('<span class="cb-status-tag defend">Garda +20%</span>');
    if (pCombat.dazedHeadTurns > 0) playerStatuses.push(`<span class="cb-status-tag debuff">Ogłuszony (${pCombat.dazedHeadTurns})</span>`);
    if (pCombat.crippledLegsTurns > 0) playerStatuses.push(`<span class="cb-status-tag debuff">Okaleczony (${pCombat.crippledLegsTurns})</span>`);

    const enemyStatuses: string[] = [];
    if (selectedEnemy.combat.dazedHeadTurns > 0) enemyStatuses.push(`<span class="cb-status-tag debuff">Ogłuszony (${selectedEnemy.combat.dazedHeadTurns})</span>`);
    if (selectedEnemy.combat.crippledLegsTurns > 0) enemyStatuses.push(`<span class="cb-status-tag debuff">Okaleczony (${selectedEnemy.combat.crippledLegsTurns})</span>`);

    const rangeBadgeHtml = activePreview.inRange
      ? `<span class="combat-range-pill in-range" title="Wróg jest w zasięgu Twojej broni (${dist.toFixed(1)} / ${activePreview.maxRange} kafli)">W zasięgu</span>`
      : `<span class="combat-range-pill out-of-range" title="Dystans: ${dist.toFixed(1)} pola (zasięg: ${activePreview.maxRange}). Kliknij atak, aby automatycznie podejść.">${dist.toFixed(1)} pola · podejdź</span>`;

    const enemySwitcherHtml =
      livingEnemies.length > 1
        ? `
          <div class="combat-target-switcher" role="group" aria-label="Wybór celu">
            ${livingEnemies
              .map((e) => {
                const hp = e.combat?.hp ?? 0;
                const maxHp = e.combat?.maxHp ?? 1;
                const diff = e.combat?.difficulty ?? 'normal';
                return `
                  <button
                    type="button"
                    class="target-switch-btn ${e.id === selectedEnemy.id ? 'active' : ''}"
                    data-combat-target="${escapeHtml(e.id)}"
                    aria-pressed="${e.id === selectedEnemy.id ? 'true' : 'false'}"
                    title="Przełącz cel na: ${escapeHtml(e.recipe.name)} (${hp}/${maxHp} HP)"
                  >
                    <span class="diff-dot diff-${diff}"></span>
                    <span class="ts-name">${escapeHtml(e.recipe.name)}</span>
                    <span class="ts-hp">${hp}/${maxHp}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        `
        : '';

    return `
      <div class="combat-top-banner ${isPlayerTurn ? 'player-turn' : 'enemy-turn'}" role="status" aria-live="polite">
        <div class="combat-top-main">
          <div class="combat-turn-group">
            <span class="combat-round-pill">RUNDA ${this.game.combatState.round}</span>
            <span class="combat-turn-owner ${isPlayerTurn ? 'is-player' : 'is-enemy'}">
              ${isPlayerTurn ? 'TWOJA TURA' : enemyTurnLabel}
            </span>
            ${playerStatuses.join('')}
          </div>

          <span class="combat-top-divider" aria-hidden="true"></span>

          <div class="combat-target-inline">
            <div class="target-identity">
              <span class="diff-dot diff-${selectedEnemy.combat.difficulty ?? 'normal'}" title="${escapeHtml(selectedEnemy.combat.difficultyLabel ?? 'Wróg')}"></span>
              <strong class="target-name">${escapeHtml(selectedEnemy.recipe.name)}</strong>
              ${enemyStatuses.join('')}
            </div>
            <div class="target-hp-track" title="Życie celu: ${selectedEnemy.combat.hp} / ${selectedEnemy.combat.maxHp} HP">
              <div class="target-hp-fill" style="width:${enemyHpPct}%;"></div>
              <span class="target-hp-text">${selectedEnemy.combat.hp} / ${selectedEnemy.combat.maxHp} HP</span>
            </div>
            ${rangeBadgeHtml}
          </div>
        </div>
        ${enemySwitcherHtml}
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
      return `<span class="ap-orb ${filled ? 'filled' : 'empty'} ${willSpend ? 'preview-spend' : ''}" title="Punkt Akcji ${idx + 1}/${pCombat.maxAp}"></span>`;
    }).join('');

    const aimedModes: ReadonlyArray<{
      mode: CombatAttackMode;
      badge: string;
    }> = [
      { mode: 'aimed_head', badge: 'Ogłuszenie · -3 AP wroga (-24% celn.)' },
      { mode: 'aimed_torso', badge: 'Przebicie · +20% penetracji pancerza' },
      { mode: 'aimed_legs', badge: 'Okaleczenie · 2× koszt ruchu wroga' }
    ];

    const armorPenPct = Math.round(playerSnap.derived.weaponProfile.armorPenetrationRatio * 100);
    const isPlayerTurn =
      this.game.combatState.activeTurnActorId === this.game.player.id &&
      !this.game.isSequentialEnemyTurnActive;
    const actingEnemy = !isPlayerTurn
      ? livingEnemies.find((e) => e.id === this.game.combatState.activeTurnActorId)
      : undefined;
    const enemyTurnLabel = actingEnemy
      ? `TURA PRZECIWNIKA: ${escapeHtml(actingEnemy.recipe.name)}…`
      : 'TURA PRZECIWNIKA…';
    const lowApReadyToEnd = isPlayerTurn && pCombat.ap < 2;

    const beltSlots = this.game.getCombatQuickBeltSlots?.() ?? [];
    const hasAnyBeltSlots = beltSlots.some((s) => s !== null);
    const beltHtml = hasAnyBeltSlots
      ? `
        <div class="combat-quick-belt" role="group" aria-label="Pas szybkiego użycia">
          ${[0, 1, 2, 3]
            .map((slotIdx) => {
              const slot = beltSlots[slotIdx] ?? null;
              const hotkey = slotIdx + 4;
              if (!slot) {
                return `
                  <div class="belt-slot-card empty" aria-label="Pusty slot pasa ${hotkey}">
                    <span class="bs-key"><kbd>${hotkey}</kbd></span>
                    <span class="bs-empty-label">Pusty slot</span>
                  </div>
                `;
              }
              const enabled = isPlayerTurn && slot.canUse && pCombat.ap >= slot.apCost;
              const tooltip = enabled
                ? `${slot.name} (${slot.summary}) · ${slot.apCost} AP [${hotkey}]`
                : `${slot.name}: ${slot.disabledReason ?? (pCombat.ap < slot.apCost ? `wymaga ${slot.apCost} AP` : 'niedostępne teraz')}`;
              return `
                <button
                  type="button"
                  class="belt-slot-card cat-${slot.category} ${!enabled ? 'disabled' : ''}"
                  data-belt-slot="${slotIdx}"
                  ${!enabled ? 'disabled' : ''}
                  title="${escapeHtml(tooltip)}"
                >
                  <div class="bs-top">
                    <span class="bs-name"><kbd>${hotkey}</kbd> ${escapeHtml(slot.name)}</span>
                    <span class="bs-qty">×${slot.qty}</span>
                  </div>
                  <div class="bs-bottom">
                    <span class="bs-summary">${escapeHtml(slot.summary)}</span>
                    <span class="bs-ap">${slot.apCost} AP</span>
                  </div>
                </button>
              `;
            })
            .join('')}
        </div>
      `
      : '';

    const curMana = pCombat.mana ?? pCombat.maxMana ?? 0;
    const wp = playerSnap.derived.weaponProfile;
    const canAffordAnyActiveSkill = SKILL_TREE_DEFS.some((n) => {
      if (n.kind !== 'active' || !n.activeAbility || getSkillRank(this.game.progression, n.id) <= 0) {
        return false;
      }
      const ab = n.activeAbility;
      const cd = this.game.progression.activeCooldowns[n.id] ?? 0;
      if (cd > 0 || pCombat.ap < ab.apCost || curMana < ab.manaCost) return false;
      if (ab.targetType === 'self') return true;
      const maxRange = ab.maxRange ?? (wp.maxRange > 1.5 ? wp.maxRange + (ab.rangeBonus ?? 0) : wp.maxRange);
      return dist >= ab.minRange - 0.1 && dist <= maxRange + 0.45;
    });
    const canAffordAnyAction =
      quickPreview.hasEnoughAp ||
      powerPreview.hasEnoughAp ||
      (!pCombat.defending && pCombat.ap >= 2) ||
      canAffordAnyActiveSkill;
    const shouldHighlightEndTurn = isPlayerTurn && (pCombat.ap <= 0 || !canAffordAnyAction);

    return `
      <div class="combat-tactical-bar ${this.isCombatAdvancedOpen ? 'veteran-open' : ''} ${isPlayerTurn ? 'player-turn' : 'enemy-turn'}">
        ${beltHtml}
        <div class="combat-ap-bar" title="Punkty Akcji (AP) określają liczbę akcji w turze. Ruch o 1 pole = 1 AP.">
          <div class="ap-bar-left">
            <span class="ap-label">AP <strong>${pCombat.ap}/${pCombat.maxAp}</strong></span>
            <div class="ap-orbs-row">${apOrbsHtml}</div>
          </div>
          <div class="ap-bar-right">
            <span class="combat-weapon-label">${escapeHtml(playerSnap.derived.weaponProfile.label)}</span>
            <span class="ap-hint">1 pole = 1 AP</span>
          </div>
        </div>

        <div class="combat-primary-deck">
          <div class="combat-quick-strikes">
            <button
              type="button"
              class="quick-strike-card strike-quick ${activeMode === 'quick' ? 'selected' : ''} ${!isPlayerTurn || !quickPreview.hasEnoughAp ? 'disabled' : ''}"
              data-quick-strike="quick"
              ${!isPlayerTurn || !quickPreview.hasEnoughAp ? 'disabled' : ''}
              title="Szybki Cios [1]: pewny, oszczędny atak (${quickPreview.apCost} AP)"
            >
              <div class="qs-header">
                <span class="qs-title"><kbd>1</kbd> Szybki Cios</span>
                <span class="qs-ap">${quickPreview.apCost} AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit" title="Szansa trafienia"><strong>${quickPreview.hitChancePct}%</strong></span>
                <span class="qs-dmg" title="Szacowane obrażenia"><strong>${quickPreview.estimatedMinDamage}–${quickPreview.estimatedMaxDamage}</strong> obr.</span>
              </div>
              <div class="qs-caption">${quickPreview.inRange ? 'Celny atak' : 'Podejdź i uderz'}</div>
            </button>

            <button
              type="button"
              class="quick-strike-card strike-power ${activeMode === 'power' ? 'selected' : ''} ${!isPlayerTurn || !powerPreview.hasEnoughAp ? 'disabled' : ''}"
              data-quick-strike="power"
              ${!isPlayerTurn || !powerPreview.hasEnoughAp ? 'disabled' : ''}
              title="Silny Cios [2]: +38% obrażeń, łatwiej przebija pancerz (${powerPreview.apCost} AP)"
            >
              <div class="qs-header">
                <span class="qs-title"><kbd>2</kbd> Silny Cios</span>
                <span class="qs-ap">${powerPreview.apCost} AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit" title="Szansa trafienia"><strong>${powerPreview.hitChancePct}%</strong></span>
                <span class="qs-dmg" title="Szacowane obrażenia"><strong>${powerPreview.estimatedMinDamage}–${powerPreview.estimatedMaxDamage}</strong> obr.</span>
              </div>
              <div class="qs-caption">${powerPreview.inRange ? '+38% obrażeń' : 'Podejdź i uderz'}</div>
            </button>

            <button
              type="button"
              class="quick-strike-card strike-defend ${!isPlayerTurn || pCombat.ap < 2 || pCombat.defending ? 'disabled' : ''} ${pCombat.defending ? 'active-stance' : ''}"
              data-combat-action="defend"
              ${!isPlayerTurn || pCombat.ap < 2 || pCombat.defending ? 'disabled' : ''}
              title="Obrona [3]: +20% Uniku i +2 Pancerza do następnej tury (2 AP)"
            >
              <div class="qs-header">
                <span class="qs-title"><kbd>3</kbd> Obrona</span>
                <span class="qs-ap">2 AP</span>
              </div>
              <div class="qs-metrics">
                <span class="qs-hit">${pCombat.defending ? '<strong>Aktywna</strong>' : '<strong>+20%</strong> unik'}</span>
                <span class="qs-dmg"><strong>+2</strong> panc.</span>
              </div>
              <div class="qs-caption">${pCombat.defending ? 'Garda podniesiona' : 'Postawa obronna'}</div>
            </button>
          </div>

          <button
            type="button"
            class="combat-util-btn expert-toggle ${this.isCombatAdvancedOpen ? 'active' : ''}"
            data-action="toggle-combat-advanced"
            aria-expanded="${this.isCombatAdvancedOpen ? 'true' : 'false'}"
            ${!isPlayerTurn ? 'disabled' : ''}
            title="Precyzyjne celowanie w części ciała i parametry pancerza DT/DR [V]"
          >
            <span class="et-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            </span>
            <span class="et-label">Celuj <kbd>V</kbd></span>
          </button>

          <div class="combat-turn-controls">
            <button
              type="button"
              class="combat-exec-btn end-turn ${!isPlayerTurn ? 'disabled' : ''} ${lowApReadyToEnd ? 'pulse-ready' : ''} ${shouldHighlightEndTurn ? 'end-turn-ready' : ''}"
              data-combat-action="end-turn"
              ${!isPlayerTurn ? 'disabled' : ''}
              title="Zakończ turę i odnów punkty AP [Spacja]"
            >
              <span>Koniec Tury</span>
              <kbd>Spacja</kbd>
            </button>

            <button
              type="button"
              class="combat-exec-btn flee ${this.isFleeConfirmPending ? 'confirming' : ''} ${!isPlayerTurn ? 'disabled' : ''}"
              data-combat-action="flee"
              ${!isPlayerTurn ? 'disabled' : ''}
              title="${this.isFleeConfirmPending ? 'Kliknij ponownie, aby potwierdzić wycofanie się z walki' : 'Wycofaj się taktycznie z walki'}"
            >
              ${this.isFleeConfirmPending ? 'Na pewno?' : 'Odwrót'}
            </button>
          </div>
        </div>
        <div class="combat-active-skills-row">
          ${this.buildCombatActiveSkillsHtml(isPlayerTurn)}
        </div>

        ${
          this.isCombatAdvancedOpen
            ? `
          <div class="combat-veteran-panel combat-veteran-drawer">
            <div class="veteran-header-strip">
              <span class="veteran-title">PRECYZYJNE CELOWANIE</span>
              <span class="veteran-telemetry" title="Parametry pancerza celu i Twojej broni">
                Cel: DT <strong>${enemySnap.derived.damageThreshold}</strong> · DR <strong>${enemySnap.derived.damageResistancePct}%</strong> · Unik <strong>${enemySnap.derived.evasionPct}%</strong>
                <span class="vt-sep">|</span>
                Penetracja <strong>${armorPenPct}%</strong> · Biegłość <strong>${playerSnap.derived.activeProficiency}%</strong>
              </span>
            </div>

            <div class="combat-modes-row">
              ${aimedModes
                .map(({ mode, badge }) => {
                  const meta = ATTACK_MODE_META[mode];
                  const prev = computeAttackPreview(playerSnap, enemySnap, dist, mode);
                  const isSelected = mode === activeMode;
                  const canUse = isPlayerTurn && prev.hasEnoughAp;
                  return `
                    <button
                      type="button"
                      class="combat-mode-btn veteran-aim-card ${isSelected ? 'active' : ''} ${!canUse ? 'no-ap' : ''}"
                      data-attack-mode="${mode}"
                      data-quick-strike="${mode}"
                      ${!canUse ? 'disabled' : ''}
                      title="${meta.description} (1 klik = natychmiastowy atak)"
                    >
                      <div class="cm-top">
                        <span>${meta.label}</span>
                        <span class="cm-ap">${prev.apCost} AP</span>
                      </div>
                      <div class="cm-stats">
                        <span class="cm-hit"><strong>${prev.hitChancePct}%</strong> traf.</span>
                        <span class="cm-dmg"><strong>${prev.estimatedMinDamage}–${prev.estimatedMaxDamage}</strong> obr.</span>
                        <span class="cm-crit"><strong>${prev.critChancePct}%</strong> kryt</span>
                      </div>
                      <div class="cm-effect-badge">${badge}</div>
                    </button>
                  `;
                })
                .join('')}
            </div>

            <div class="veteran-footer-row">
              <span class="veteran-tip">
                Kliknij kartę powyżej, aby od razu uderzyć. Wysoki pancerz (DT ${enemySnap.derived.damageThreshold}): <strong>Korpus</strong> lub <strong>Silny Cios</strong> · Bossowie: <strong>Głowa</strong> (-3 AP).
              </span>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private buildCombatLiveLogHtml(): string {
    const logs = this.game.combatLogs;

    const entriesHtml = logs.length === 0
      ? '<div class="combat-log-empty">Wybierz atak [1/2], Obronę [3] lub kliknij wroga.</div>'
      : logs
          .slice(0, this.isCombatLogExpanded ? 50 : 12)
          .map((entry, idx) => {
            const isCrit = entry.includes('KRYTYK');
            const isHit = !isCrit && (entry.includes('Trafienie') || entry.includes('Zadano') || entry.includes('trafia'));
            const isMiss = entry.includes('Pudło') || entry.includes('Unik');
            const isDefend = entry.includes('Obronną') || entry.includes('Garda');
            const isVictory = entry.includes('Pokonano') || entry.includes('zakończona zwycięstwem');
            const isStatus = entry.includes('OGŁUSZENIE') || entry.includes('OKALECZENIE');

            let entryClass = 'combat-entry-info';
            let badge = '';

            if (isCrit) {
              entryClass = 'combat-entry-crit';
              badge = '<span class="c-badge c-badge-crit">KRYTYK</span>';
            } else if (isHit) {
              entryClass = 'combat-entry-hit';
              badge = '<span class="c-badge c-badge-hit">TRAFIENIE</span>';
            } else if (isMiss) {
              entryClass = 'combat-entry-miss';
              badge = '<span class="c-badge c-badge-miss">PUDŁO</span>';
            } else if (isDefend) {
              entryClass = 'combat-entry-defend';
              badge = '<span class="c-badge c-badge-defend">GARDA</span>';
            } else if (isVictory) {
              entryClass = 'combat-entry-victory';
              badge = '<span class="c-badge c-badge-victory">ZWYCIĘSTWO</span>';
            }

            const statusPill = isStatus
              ? '<span class="c-badge c-badge-status">STATUS</span>'
              : '';

            const isNewest = idx === 0 ? 'combat-entry-newest' : '';

            return `
              <div class="combat-log-row ${entryClass} ${isNewest}">
                ${badge || statusPill ? `<div class="c-row-header">${badge}${statusPill}</div>` : ''}
                <div class="c-row-text">${escapeHtml(entry)}</div>
              </div>
            `;
          })
          .join('');

    return `
      <div class="combat-live-log ${this.isCombatLogExpanded ? 'expanded' : ''}">
        <div class="combat-log-header">
          <div class="combat-log-tabs" role="tablist" aria-label="Zakładki dziennika">
            <button type="button" class="combat-tab-btn active" role="tab" aria-selected="true" data-action="set-battle-tab-combat">⚔️ Walka (${logs.length})</button>
            <button type="button" class="combat-tab-btn" role="tab" aria-selected="false" data-action="set-battle-tab-chronicle" title="Przełącz na Kronikę Świata">📜 Kronika</button>
          </div>
          <button type="button" class="combat-log-expand-btn" data-action="toggle-combat-log-expanded" aria-expanded="${this.isCombatLogExpanded ? 'true' : 'false'}" aria-label="${this.isCombatLogExpanded ? 'Zwiń dziennik walki' : 'Rozwiń dziennik walki'}" title="Rozwiń/zwiń wysokość dziennika walki">
            ${this.isCombatLogExpanded ? '▼' : '▲'}
          </button>
        </div>
        <div class="combat-log-entries">
          ${entriesHtml}
        </div>
      </div>
    `;
  }

  private buildItemDetailsModalHtml(): string {
    if (!this.inspectedItemInstanceId) return '';
    const found = this.game.backpack.findByInstanceId(this.inspectedItemInstanceId);
    if (!found) return '';
    const item = found.item;
    const def = getItemDefinition(item.definitionId);
    if (!def) return '';

    const rarity = RARITY_META[def.rarity];
    const itemPrice = getItemPriceInSiekance(item);
    const slotLabel = def.equipSlot ? EQUIP_SLOT_LABELS[def.equipSlot].label : 'Przedmiot';
    const modifiers = getAllItemModifiers(item);
    const weaponProfile =
      def.itemType === 'Weapon' && def.equipSlot === 'mainHand'
        ? getWeaponCombatProfile(def.id, null)
        : null;

    const report = ItemComparisonEngine.compareCandidate(
      item,
      this.game.equipmentManager,
      this.game.statSheet
    );

    const modsHtml =
      modifiers.length > 0
        ? modifiers
            .map((m) => {
              const meta = STAT_META[m.targetStat];
              const sign = m.value >= 0 ? '+' : '';
              return `<div class="item-detail-mod-row"><span>${meta.icon} ${meta.label}</span><strong>${sign}${m.value}</strong></div>`;
            })
            .join('')
        : '<div class="item-detail-empty">Brak stałych premii do statystyk.</div>';

    const deltasHtml =
      report.directDeltas.length > 0
        ? report.directDeltas
            .map((d) => {
              const meta = STAT_META[d.stat];
              return `<span class="compact-delta-item">${meta.icon} ${meta.label}: ${formatDeltaBadge(d.stat, d.delta)}</span>`;
            })
            .join('')
        : '<span class="comp-no-delta">Brak zmian względem założonego ekwipunku</span>';

    const reqHtml =
      def.requirements.length > 0
        ? `<div class="item-detail-section">
            <div class="item-detail-section-title">Wymagania</div>
            <div class="item-detail-reqs">
              ${def.requirements
                .map((r) => {
                  const cur = Math.round(this.game.statSheet.getStatValue(r.stat));
                  const ok = cur >= r.minValue;
                  return `<span class="item-detail-req ${ok ? 'ok' : 'fail'}">${STAT_META[r.stat].label}: ${cur}/${r.minValue}</span>`;
                })
                .join('')}
            </div>
          </div>`
        : '';

    return `
      <div class="item-details-backdrop" data-action="close-item-details">
        <div class="item-details-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
          <div class="item-details-header">
            <div>
              <div class="item-details-name" style="color:${rarity.colorHex}">${escapeHtml(def.name)}</div>
              <div class="item-details-sub">
                <span class="comp-rarity-badge" style="color:${rarity.colorHex}; border-color:${rarity.colorHex}55;">★ ${rarity.label.toUpperCase()}</span>
                <span>${escapeHtml(slotLabel)}${def.isTwoHanded ? ' • 2H (Dwuręczna)' : ''}</span>
              </div>
            </div>
            <button type="button" class="combat-report-close-btn" data-action="close-item-details" title="Zamknij (Esc)">✕</button>
          </div>

          <div class="item-details-meta-strip">
            <span>⚖️ Waga: <strong>${def.weight.toFixed(1)} kg</strong></span>
            <span>💰 Wartość: <strong>${itemPrice} siek.</strong></span>
            <span>🛡️ Wytrzymałość: <strong>${item.currentDurability}/${item.maxDurability}</strong></span>
          </div>

          ${
            def.description
              ? `<div class="item-details-desc">${escapeHtml(def.description)}</div>`
              : ''
          }

          ${
            weaponProfile
              ? `<div class="item-detail-section">
                  <div class="item-detail-section-title">Parametry bojowe broni</div>
                  <div class="item-detail-weapon-grid">
                    <span>${weaponProfile.icon} Zasięg: <strong>${weaponProfile.minRange}–${weaponProfile.maxRange} kafelków</strong></span>
                    <span>⚡ Koszt bazowy: <strong>${weaponProfile.baseApCost} AP</strong></span>
                    <span>🛡️ Penetracja pancerza: <strong>${Math.round(weaponProfile.armorPenetrationRatio * 100)}%</strong></span>
                    <span>🎯 Celność: <strong>+${weaponProfile.accuracyBonus}%</strong> • Kryt: <strong>+${weaponProfile.critBonus}%</strong></span>
                  </div>
                </div>`
              : ''
          }

          <div class="item-detail-section">
            <div class="item-detail-section-title">Premie i modyfikatory</div>
            <div class="item-detail-mods-list">${modsHtml}</div>
          </div>

          ${reqHtml}

          <div class="item-detail-section">
            <div class="item-detail-section-title">Porównanie z obecnym ekwipunkiem</div>
            <div class="comp-deltas-grid">${deltasHtml}</div>
          </div>

          <div class="item-details-footer">
            <button type="button" class="hud-btn" data-action="equip-inspected-item" data-instance-id="${escapeHtml(item.instanceId)}">⚔️ Załóż</button>
            <button type="button" class="hud-btn" data-action="close-item-details">Zamknij</button>
          </div>
        </div>
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

      const rarity = RARITY_META[def.rarity];
      const itemPrice = getItemPriceInSiekance(hoveredBagItem);

      if (def.itemType === 'Consumable') {
        const eff = def.visualDef.consumableEffect;
        return `
          <div class="comp-detailed-card">
            <div class="comp-detailed-header">
              <span class="comp-slot-pill">🧪 PROWIANT / UŻYTKOWE</span>
              <div class="comp-header-meta">
                <span class="comp-weight-pill">⚖️ ${(def.weight * hoveredBagItem.stackCount).toFixed(1)} kg</span>
                <span class="comp-price-pill">💰 ${itemPrice} siek.</span>
              </div>
            </div>
            <div class="comp-title-block">
              <div class="comp-candidate-name" style="color:${rarity.colorHex}">
                ${escapeHtml(def.name)}${hoveredBagItem.stackCount > 1 ? ` (×${hoveredBagItem.stackCount})` : ''}
              </div>
              <div class="comp-rarity-row">
                <span class="comp-rarity-badge" style="color:${rarity.colorHex}; border-color:${rarity.colorHex}55;">
                  ★ ${rarity.label.toUpperCase()}
                </span>
                <span class="comp-type-label">• Przedmiot konsumpcyjny</span>
              </div>
            </div>
            ${def.description ? `
              <div class="comp-desc-block">
                <span class="comp-quote-mark">“</span>
                <span class="comp-quote-text">${escapeHtml(def.description)}</span>
              </div>
            ` : ''}
            <div class="comp-deltas-section">
              <div class="comp-section-title">Działanie po spożyciu / użyciu:</div>
              <div class="comp-deltas-grid">
                ${eff?.healHp ? `<span class="stat-delta-pill delta-up">❤️ +${eff.healHp} HP</span>` : ''}
                ${eff?.might ? `<span class="stat-delta-pill delta-up">▲ +${eff.might} Siła</span>` : ''}
                ${eff?.resolve ? `<span class="stat-delta-pill delta-up">▲ +${eff.resolve} Determinacja</span>` : ''}
                ${eff?.perception ? `<span class="stat-delta-pill delta-up">▲ +${eff.perception} Percepcja</span>` : ''}
                ${eff?.lore ? `<span class="stat-delta-pill delta-up">▲ +${eff.lore} Wiedza</span>` : ''}
              </div>
            </div>
            <div class="comp-action-hint">
              <span>💡 Kliknij LPM, aby użyć / skonsumować</span>
            </div>
          </div>
        `;
      }

      const report = ItemComparisonEngine.compareCandidate(
        hoveredBagItem,
        this.game.equipmentManager,
        this.game.statSheet
      );
      const targetSlot = report.targetSlot;
      const slotLabel = targetSlot ? EQUIP_SLOT_LABELS[targetSlot].label : 'Brak slotu';
      const currentEquipped = targetSlot ? this.game.equipmentManager.getEquipped(targetSlot) : null;
      const currentDef = currentEquipped ? getItemDefinition(currentEquipped.definitionId) : null;
      const currentRarity = currentDef ? RARITY_META[currentDef.rarity] : null;

      const reqHtml = report.meetsRequirements
        ? ''
        : `<div class="comp-req-alert">⚠️ Wymagania cech: ${report.missingRequirements
            .map((r) => `${STAT_META[r.stat].label} ≥ ${r.minValue}`)
            .join(', ')}</div>`;

      const twoHandedWarn = def.isTwoHanded && this.game.equipmentManager.getEquipped('offHand')
        ? `<div class="comp-2h-alert">⚠️ Broń dwuręczna (2H) — załóżenie zdejmie przedmiot/tarczę z drugiej ręki!</div>`
        : '';

      const deltasHtml =
        report.directDeltas.length > 0
          ? report.directDeltas
              .map((d) => {
                const meta = STAT_META[d.stat];
                return `<span class="compact-delta-item">${meta.icon} ${meta.label}: ${formatDeltaBadge(d.stat, d.delta)}</span>`;
              })
              .join('')
          : `<span class="comp-no-delta">Brak bezpośrednich zmian bazowych parametrów</span>`;

      return `
        <div class="comp-detailed-card">
          <div class="comp-detailed-header">
            <div class="comp-header-badges">
              <span class="comp-slot-pill">SLOT: ${slotLabel.toUpperCase()}</span>
              ${def.isTwoHanded ? '<span class="comp-2h-pill">BROŃ 2H (DWURĘCZNA)</span>' : ''}
            </div>
            <div class="comp-header-meta">
              <span class="comp-weight-pill">⚖️ ${def.weight.toFixed(1)} kg</span>
              <span class="comp-price-pill">💰 ${itemPrice} siek.</span>
            </div>
          </div>

          <div class="comp-title-block">
            <div class="comp-candidate-name" style="color:${rarity.colorHex}">
              ${escapeHtml(def.name)}
            </div>
            <div class="comp-rarity-row">
              <span class="comp-rarity-badge" style="color:${rarity.colorHex}; border-color:${rarity.colorHex}55;">
                ★ ${rarity.label.toUpperCase()}
              </span>
              <span class="comp-type-label">• ${def.itemType === 'Weapon' ? 'Oręż bojowy' : def.itemType === 'Armor' ? 'Element pancerza' : def.itemType === 'Trinket' ? 'Biżuteria / Talizman' : def.itemType}</span>
            </div>
          </div>

          ${def.description ? `
            <div class="comp-desc-block">
              <span class="comp-quote-mark">“</span>
              <span class="comp-quote-text">${escapeHtml(def.description)}</span>
            </div>
          ` : ''}

          <div class="comp-equipped-status">
            <span class="comp-status-label">Obecnie w tym slocie:</span>
            ${
              currentDef
                ? `<div class="comp-equipped-item">
                    <span class="comp-eq-bullet">⚔️</span>
                    <strong style="color:${currentRarity!.colorHex}">${escapeHtml(currentDef.name)}</strong>
                  </div>`
                : '<div class="comp-empty-slot-text">✨ Pusty slot (brak rynsztunku — zyskasz pełnię tych statystyk!)</div>'
            }
          </div>

          <div class="comp-deltas-section">
            <div class="comp-section-title">Wpływ na statystyki rynsztunku:</div>
            <div class="comp-deltas-grid">${deltasHtml}</div>
          </div>

          ${(reqHtml || twoHandedWarn) ? `
            <div class="comp-warnings-section">
              ${reqHtml}
              ${twoHandedWarn}
            </div>
          ` : ''}

          <div class="comp-action-hint">
            <span>💡 Kliknij LPM, aby ${currentDef ? 'założyć i zamienić' : 'założyć do wolnego slotu'}</span>
          </div>
        </div>
      `;
    }

    if (hoveredSlot) {
      const eqItem = this.game.equipmentManager.getEquipped(hoveredSlot);
      const slotMeta = EQUIP_SLOT_LABELS[hoveredSlot];
      if (!eqItem) {
        return `
          <div class="comp-card-idle">
            <div class="comp-idle-crest">${slotMeta.icon}</div>
            <div class="comp-idle-title">Slot: ${slotMeta.label}</div>
            <div class="comp-idle-desc">Ten slot na postaci jest pusty. Wybierz oręż lub pancerz z plecaka, aby go wyekwipować.</div>
          </div>
        `;
      }
      const def = getItemDefinition(eqItem.definitionId);
      if (!def) return '';
      const rarity = RARITY_META[def.rarity];
      const mods = getAllItemModifiers(eqItem);
      return `
        <div class="comp-detailed-card">
          <div class="comp-detailed-header">
            <span class="comp-slot-pill">ZAŁOŻONO: ${slotMeta.label.toUpperCase()}</span>
            ${def.isTwoHanded ? '<span class="comp-2h-pill">BROŃ 2H</span>' : ''}
            <div class="comp-header-meta">
              <span class="comp-weight-pill">⚖️ ${def.weight.toFixed(1)} kg</span>
              <span class="comp-price-pill">💰 ${getItemPriceInSiekance(eqItem)} siek.</span>
            </div>
          </div>
          <div class="comp-title-block">
            <div class="comp-candidate-name" style="color:${rarity.colorHex}">${escapeHtml(def.name)}</div>
            <div class="comp-rarity-row">
              <span class="comp-rarity-badge" style="color:${rarity.colorHex}; border-color:${rarity.colorHex}55;">
                ★ ${rarity.label.toUpperCase()}
              </span>
              <span class="comp-type-label">• ${def.itemType}</span>
            </div>
          </div>
          ${def.description ? `
            <div class="comp-desc-block">
              <span class="comp-quote-mark">“</span>
              <span class="comp-quote-text">${escapeHtml(def.description)}</span>
            </div>
          ` : ''}
          <div class="comp-deltas-section">
            <div class="comp-section-title">Aktywne bonusy tego wyposażenia:</div>
            <div class="comp-deltas-grid">
              ${mods.map((m) => `<span class="stat-delta-pill delta-up">${STAT_META[m.targetStat].icon} +${m.value}${STAT_META[m.targetStat].isPercent ? '%' : ''} ${STAT_META[m.targetStat].label}</span>`).join('')}
            </div>
          </div>
          <div class="comp-action-hint">
            <span>💡 Kliknij LPM, aby zdjąć do plecaka</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="comp-card-idle">
        <div class="comp-idle-crest">📜</div>
        <div class="comp-idle-title">Karta Wyposażenia & Porównanie</div>
        <div class="comp-idle-desc">Najedź kursorem na oręż, pancerz lub prowiant w plecaku, aby przeanalizować pełny opis fabularny, różnice statystyk oraz wpływ na postać.</div>
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

    // Dynamic high-visibility highlight for target paperdoll slot and 2H block
    let targetSlot: EquipSlot | null = null;
    let is2H = false;
    if (bagItem) {
      const def = getItemDefinition(bagItem.definitionId);
      if (def?.equipSlot) {
        targetSlot = def.equipSlot;
        is2H = Boolean(def.isTwoHanded);
      }
    }

    this.root.querySelectorAll<HTMLElement>('.paperdoll-slot').forEach((el) => {
      const slot = el.dataset.equipSlot as EquipSlot | undefined;
      const isTarget = Boolean(targetSlot && slot === targetSlot);
      const isBlockedBy2H = Boolean(targetSlot && is2H && slot === 'offHand');

      el.classList.toggle('compare-target', isTarget);
      el.classList.toggle('compare-blocked-by-2h', isBlockedBy2H);

      const badge = el.querySelector<HTMLElement>('.pd-slot-status-badge');
      if (badge) {
        if (isTarget) {
          const isOccupied = el.classList.contains('occupied');
          if (!isOccupied) {
            badge.textContent = '✨ WOLNY SLOT – ZAŁÓŻ';
            badge.className = 'pd-slot-status-badge visible empty';
          } else {
            badge.textContent = '';
            badge.className = 'pd-slot-status-badge';
          }
        } else if (isBlockedBy2H) {
          badge.textContent = '⚠️ ZABLOKUJE 2H';
          badge.className = 'pd-slot-status-badge visible blocked';
        } else {
          badge.textContent = '';
          badge.className = 'pd-slot-status-badge';
        }
      }
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
                  📜 Przaśny Kolaps Słowny: <strong>${escapeHtml(kol.title)}</strong>
                  <span class="dialogue-collapse-hint">(Rozwiń pełny zapis z assetu)</span>
                </summary>
                <div class="dialogue-collapse-content">
                  <div class="dialogue-collapse-context">${escapeHtml(kol.context)}</div>
                  <div class="dialogue-collapse-steps">
                    ${kol.steps
                      .map(
                        (s) => `
                      <div class="dialogue-collapse-step">
                        <span class="collapse-speaker">${escapeHtml(s.speaker)} <small>(${escapeHtml(s.role)})</small>:</span>
                        <span class="collapse-line">„${escapeHtml(s.line)}”</span>
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

    const isMerchantDialogue =
      MERCHANT_ACTOR_IDS.includes(activeActorId) || getMerchantWares(activeActorId).length > 0;
    const merchantWares = isMerchantDialogue ? getMerchantWares(activeActorId) : [];
    const merchantSpecialty = isMerchantDialogue ? getMerchantSpecialty(activeActorId) : null;

    const merchantShopHtml =
      isMerchantDialogue && merchantWares.length > 0
        ? `
        <div class="merchant-shop-panel">
          <div class="merchant-shop-header">
            <span class="merchant-shop-title">${escapeHtml(merchantSpecialty?.shopTitle ?? '💎 Towary kupca (za siekańce)')}:</span>
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

                const wareCompHtml = (() => {
                  if (!def?.equipSlot) return '';
                  const candidate = createItemInstance(ware.id, 1);
                  const rep = ItemComparisonEngine.compareCandidate(
                    candidate,
                    this.game.equipmentManager,
                    this.game.statSheet
                  );
                  const equippedInSlot = this.game.equipmentManager.getEquipped(def.equipSlot);
                  const equippedDef = equippedInSlot
                    ? getItemDefinition(equippedInSlot.definitionId)
                    : null;
                  const deltaBadges =
                    rep.directDeltas.length > 0
                      ? rep.directDeltas
                          .slice(0, 4)
                          .map((d) => `${STAT_META[d.stat].icon} ${formatDeltaBadge(d.stat, d.delta)}`)
                          .join(' ')
                      : '<span class="comp-no-delta">= Tyle samo co założony</span>';
                  const eqHint = equippedDef
                    ? `<span class="ware-equipped-ref">vs ${escapeHtml(equippedDef.name)}</span>`
                    : `<span class="ware-equipped-ref">Wolny slot</span>`;
                  return `<div class="ware-comp-row">${deltaBadges} ${eqHint}</div>`;
                })();

                return `
                <div class="merchant-ware-card ${canAfford ? 'can-afford' : 'too-expensive'}">
                  <div class="ware-swatch" style="background: linear-gradient(135deg, ${swatch} 55%, ${trim} 100%);">
                    <span class="slot-badge">${def?.equipSlot?.toUpperCase().slice(0, 3) ?? 'PRZ'}</span>
                  </div>
                  <div class="ware-info">
                    <div class="ware-name" style="color: ${rarity.colorHex}">${escapeHtml(ware.title)}</div>
                    <div class="ware-desc">${escapeHtml(ware.description)}</div>
                    ${wareCompHtml}
                  </div>
                  <div class="ware-buy-action">
                    <span class="ware-price ${canAfford ? 'afford' : 'costly'}">💰 ${ware.priceSiekance} siek.</span>
                    <button
                      type="button"
                      class="btn-buy-ware ${canAfford ? '' : 'disabled'}"
                      data-buy-item-id="${escapeHtml(ware.id)}"
                      data-merchant-id="${escapeHtml(activeActorId)}"
                      ${canAfford ? '' : 'disabled'}
                      title="${escapeHtml(canAfford ? `Kup ${ware.title} za ${ware.priceSiekance} siekańców` : `Brakuje Ci ${ware.priceSiekance - this.game.siekance} siekańców (wymaga grindu!)`)}"
                    >
                      ${canAfford ? 'Kup' : 'Za drogo'}
                    </button>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
          <div class="merchant-bag-section">
            <div class="merchant-bag-header">
              <span class="merchant-bag-title">🎒 Twój plecak — załóż z plecaka lub sprzedaj za siekańce (założonego ekwipunku nie można sprzedać)</span>
            </div>
            <div class="merchant-bag-list">
              ${(() => {
                const bagItems = this.game.backpack.getSlots().filter((s): s is ItemInstance => Boolean(s));
                if (bagItems.length === 0) {
                  return '<div class="merchant-bag-empty">Plecak jest pusty.</div>';
                }
                return bagItems
                  .map((item) => {
                    const def = getItemDefinition(item.definitionId);
                    if (!def) return '';
                    const rarity = RARITY_META[def.rarity];
                    const sellPrice = getItemPriceInSiekance(item);
                    const stackText = item.stackCount > 1 ? ` ×${item.stackCount}` : '';
                    let compBadges = '';
                    if (def.equipSlot) {
                      const rep = ItemComparisonEngine.compareCandidate(
                        item,
                        this.game.equipmentManager,
                        this.game.statSheet
                      );
                      compBadges =
                        rep.directDeltas.length > 0
                          ? rep.directDeltas
                              .slice(0, 3)
                              .map((d) => `${STAT_META[d.stat].icon} ${formatDeltaBadge(d.stat, d.delta)}`)
                              .join(' ')
                          : '<span class="comp-no-delta">= Bez zmian</span>';
                    }
                    const equipBtn = def.equipSlot
                      ? `<button type="button" class="btn-merchant-equip" data-action="merchant-equip-item" data-instance-id="${escapeHtml(item.instanceId)}" title="Załóż z plecaka (stary przedmiot trafi do plecaka)">🛡️ Załóż</button>`
                      : '';
                    return `
                      <div class="merchant-bag-row">
                        <div class="merchant-bag-item-info">
                          <span class="merchant-bag-item-name" style="color: ${rarity.colorHex}">${escapeHtml(def.name)}${stackText}</span>
                          ${compBadges ? `<span class="merchant-bag-comp">${compBadges}</span>` : ''}
                        </div>
                        <div class="merchant-bag-actions">
                          ${equipBtn}
                          <button type="button" class="btn-merchant-sell" data-action="merchant-sell-item" data-instance-id="${escapeHtml(item.instanceId)}" title="Sprzedaj za ${sellPrice} siekańców">💰 +${sellPrice}</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('');
              })()}
            </div>
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
                <img src="${activeSpeakerPortrait}" alt="${escapeHtml(this.game.activeDialogue.node.speakerName)}" class="dialogue-portrait-img" />
                <div class="portrait-name-ribbon">${escapeHtml(this.game.activeDialogue.node.speakerName.split(' ')[0])}</div>
              </div>
            </div>
            <div class="dialogue-content-col">
              <div class="dialogue-header">
                <div class="dialogue-header-info">
                  <span class="dialogue-speaker">${escapeHtml(this.game.activeDialogue.node.speakerName)}</span>
                  <span class="dialogue-title">${escapeHtml(this.game.activeDialogue.node.speakerTitle)}</span>
                </div>
                <button type="button" class="dialogue-close-btn" data-action="close-dialogue" title="Anuluj rozmowę [Esc]">✕ Zamknij [Esc]</button>
              </div>
              <div class="dialogue-body-wrap">
                <p class="dialogue-body">„${escapeHtml(this.game.activeDialogue.node.text)}”</p>
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
                        <span class="choice-text">${escapeHtml(c.text)}</span>
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

    const countAll = occupiedCount;
    let countWeapons = 0;
    let countArmor = 0;
    let countTrinkets = 0;
    let countConsumables = 0;
    for (let i = 0; i < allSlots.length; i++) {
      const s = allSlots[i];
      if (!s) continue;
      const d = getItemDefinition(s.definitionId);
      if (!d) continue;
      if (d.itemType === 'Weapon' || d.equipSlot === 'mainHand' || d.equipSlot === 'offHand') {
        countWeapons++;
      }
      if (d.itemType === 'Armor' && d.equipSlot !== 'ring1' && d.equipSlot !== 'ring2') {
        countArmor++;
      }
      if (d.itemType === 'Trinket' || d.equipSlot === 'ring1' || d.equipSlot === 'ring2') {
        countTrinkets++;
      }
      if (d.itemType === 'Consumable') {
        countConsumables++;
      }
    }

    const filterTabs = [
      { id: 'all' as const, label: `Wszystko (${countAll})`, icon: '🎒' },
      { id: 'weapons' as const, label: `Broń (${countWeapons})`, icon: '⚔️' },
      { id: 'armor' as const, label: `Pancerz (${countArmor})`, icon: '🛡️' },
      { id: 'trinkets' as const, label: `Biżuteria (${countTrinkets})`, icon: '💍' },
      { id: 'consumables' as const, label: `Prowiant (${countConsumables})`, icon: '🧪' }
    ];

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

            <!-- Compact comparison card under character panel -->
            <div id="live-comparison-box" class="live-comparison-box">
              ${this.buildLiveComparisonHtml(null, null)}
            </div>
          </div>

          <!-- RIGHT COLUMN: Streamlined Backpack List/Grid -->
          <div class="backpack-column">
            <div class="backpack-toolbar">
              <div class="filter-tabs">
                ${filterTabs
                  .map(
                    (tab) => `
                  <button
                    type="button"
                    class="filter-tab-btn ${this.activeFilter === tab.id ? 'active' : ''}"
                    data-bag-filter="${tab.id}"
                    title="${tab.label}"
                  ><span class="filter-icon">${tab.icon}</span> ${tab.label}</button>
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
                    (this.activeFilter === 'weapons' &&
                      (def.itemType === 'Weapon' || def.equipSlot === 'mainHand' || def.equipSlot === 'offHand')) ||
                    (this.activeFilter === 'armor' &&
                      def.itemType === 'Armor' &&
                      def.equipSlot !== 'ring1' &&
                      def.equipSlot !== 'ring2') ||
                    (this.activeFilter === 'trinkets' &&
                      (def.itemType === 'Trinket' || def.equipSlot === 'ring1' || def.equipSlot === 'ring2')) ||
                    (this.activeFilter === 'consumables' && def.itemType === 'Consumable');

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

                  const safeItemName = escapeHtml(def.name);
                  return `
                    <div
                      class="backpack-slot occupied rarity-${def.rarity.toLowerCase()} ${isNetUpgrade ? 'is-upgrade' : ''}"
                      draggable="true"
                      data-slot-index="${slotIdx}"
                      data-bag-instance-id="${slotItem.instanceId}"
                      data-equip-id="${def.id}"
                      title="Kliknij LPM, aby: ${actionLabel} (${safeItemName}) • Kliknij 'Sprzedaj', aby zbyć za ${itemPrice} siekańców"
                    >
                      <div class="item-swatch" style="background: linear-gradient(135deg, ${swatch} 60%, ${trim} 100%);">
                        <span class="slot-badge">${def.isTwoHanded ? '2H' : (def.equipSlot ?? 'BAG').toUpperCase().slice(0, 3)}</span>
                        ${slotItem.stackCount > 1 ? `<span class="stack-count-badge">×${slotItem.stackCount}</span>` : ''}
                      </div>
                      <div class="bag-item-title-wrap">
                        <div class="item-name" style="color:${rarity.colorHex}">${safeItemName}</div>
                        <div class="bag-item-sub">
                          <span>${primaryDeltaText || rarity.label}</span>
                          <span>• ${(def.weight * slotItem.stackCount).toFixed(1)} kg</span>
                          <span class="item-price-tag" title="Cena skupu u kupca w siekańcach">💰 ${itemPrice} siek.</span>
                        </div>
                      </div>
                      <div class="bag-item-actions">
                        <span class="equip-state">${actionLabel}</span>
                        ${
                          def.itemType === 'Weapon' || def.itemType === 'Armor'
                            ? `<button type="button" class="bag-inspect-btn" data-action="inspect-item" data-instance-id="${slotItem.instanceId}" title="Zobacz pełne szczegóły przedmiotu">👁️ Zobacz</button>`
                            : ''
                        }
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

    const defaultDevScenes: ReadonlyArray<HudDevSceneOption> = [
      { id: 'forest_clearing', label: 'Polana Wilczego Ognia' },
      { id: 'slavic_village', label: 'Słowiańska Osada' },
      { id: 'sanctum_dungeon', label: 'Lochy i Jaskinie' }
    ];
    const devScenes = this.options.devScenes && this.options.devScenes.length > 0
      ? this.options.devScenes
      : defaultDevScenes;
    const activeDevSceneId = this.options.getActiveDevSceneId
      ? this.options.getActiveDevSceneId()
      : this.game.map.id;

    const devSelectorHtml = `
      <div class="dev-switcher-wrap ${this.isDevSelectorOpen ? 'open' : ''}">
        <button
          type="button"
          class="dev-toggle-btn ${this.isDevSelectorOpen ? 'active' : ''}"
          data-action="toggle-dev-selector"
          aria-expanded="${this.isDevSelectorOpen ? 'true' : 'false'}"
          title="DEV: teleportuj do dowolnej lokacji bez uruchamiania jej wydarzeń; postać i stan świata pozostają bez zmian"
        >
          dev
        </button>
        ${
          this.isDevSelectorOpen
            ? `
          <select class="dev-scene-select" data-action="dev-scene-select" aria-label="Wybierz lokację developerską">
            ${devScenes
              .map(
                (sc) =>
                  `<option value="${escapeHtml(sc.id)}" ${sc.id === activeDevSceneId ? 'selected' : ''}>${escapeHtml(sc.label)}</option>`
              )
              .join('')}
          </select>
        `
            : ''
        }
      </div>
    `;

    const isFullscreen =
      typeof document !== 'undefined' && Boolean(document.fullscreenElement);

    const fullscreenBtnHtml = `
      <button
        type="button"
        class="fullscreen-top-btn ${isFullscreen ? 'active' : ''}"
        data-action="toggle-fullscreen"
        title="${isFullscreen ? 'Zamknij pełny ekran (F11)' : 'Pełny ekran (F11)'}"
      >
        ⛶
      </button>
    `;

    const discreetSaveBtnHtml = `
      <button
        type="button"
        class="discrete-save-btn ${this.saveToastActive ? 'saved' : ''}"
        data-action="save-game"
        title="Zapisz stan gry [Ctrl+S]"
      >
        ${this.saveToastActive ? '✓' : '💾'}
      </button>
    `;

    const discreetLoadBtnHtml =
      this.options.onLoadGame && (this.options.hasSave?.() ?? true)
        ? `
      <button
        type="button"
        class="discrete-save-btn"
        data-action="load-game"
        title="Wczytaj zapisany stan gry"
      >
        📂
      </button>
    `
        : '';

    const discreetKeyBtnHtml = this.options.onOpenSaveKey
      ? `
      <button
        type="button"
        class="discrete-save-btn"
        data-action="open-save-key"
        title="Klucz rozgrywki (eksport / import zapisu)"
      >
        🔑
      </button>
    `
      : '';

    const discreetCreditsBtnHtml = `
      <button
        type="button"
        class="discrete-credits-btn"
        data-action="toggle-credits"
        title="Twórcy i licencje (Credits)"
      >
        ⓘ
      </button>
    `;

    const isMuted = CombatAudioEngine.getInstance().getMuted();
    const audioBtnHtml = `
      <button
        type="button"
        class="discrete-audio-btn ${isMuted ? 'muted' : ''}"
        data-action="toggle-audio"
        title="${isMuted ? 'Włącz dźwięk [M]' : 'Wycisz dźwięk [M]'}"
      >
        ${isMuted ? '🔇' : '🔊'}
      </button>
    `;

    const telemetryOrControlsHtml = this.devMode
      ? `
        <div class="telemetry-badges">
          <button type="button" class="compass-angle-btn" data-action="spawn-npc" title="Dodaj losowego NPC na mapę">➕ NPC</button>
          <button type="button" class="compass-angle-btn" data-action="clear-map" title="Wyczyść obiekty">🧹</button>
          <button type="button" class="compass-angle-btn ${this.isPlaytestInEditor ? 'active' : ''}" data-action="toggle-editor-playtest" title="Przełącz Edytor / Test rozgrywki">
            ${this.isPlaytestInEditor ? '🛠️ Edytor' : '🎮 Test'}
          </button>
          ${audioBtnHtml}
          ${discreetSaveBtnHtml}
          <span class="telemetry-pill">FPS <strong>${this.scene.fps}</strong> · Bake: <strong>${this.scene.lastBakeDurationMs} ms</strong></span>
          ${fullscreenBtnHtml}
        </div>
      `
      : `
        <div class="telemetry-badges">
          ${audioBtnHtml}
          ${discreetSaveBtnHtml}
          ${discreetLoadBtnHtml}
          ${discreetKeyBtnHtml}
          <button
            type="button"
            class="discrete-reset-btn"
            data-action="reset-save"
            title="Nowa gra od początku"
          >
            🔄
          </button>
          ${discreetCreditsBtnHtml}
          ${fullscreenBtnHtml}
        </div>
      `;

    const chronicleList: ChronicleEntry[] = this.game.chronicleEntries.length > 0
      ? this.game.chronicleEntries
      : this.game.logs.map((text, idx) => ({
          id: 'fb_' + idx,
          text,
          severity: 'info' as const,
          timestamp: Date.now() - idx * 1000
        }));

    const filteredChronicleList = this.chronicleImportantOnly
      ? chronicleList.filter((e) => e.severity === 'important' || e.severity === 'critical')
      : chronicleList;

    const visibleEntries = this.isChronicleExpanded
      ? filteredChronicleList
      : filteredChronicleList.slice(0, 16);

    const isRecentLog = Date.now() - this.game.lastLogTimestamp < 2200;
    const pulseClass = isRecentLog ? `pulse-${this.game.lastLogSeverity}` : '';

    let headerBadge = '';
    if (isRecentLog && this.game.lastLogSeverity === 'important') {
      headerBadge = '<span class="chronicle-header-badge important">⭐ Ważne wydarzenie!</span>';
    } else if (isRecentLog && this.game.lastLogSeverity === 'critical') {
      headerBadge = '<span class="chronicle-header-badge critical">⚠️ Zagrożenie!</span>';
    } else if (isRecentLog && this.game.lastLogSeverity === 'combat') {
      headerBadge = '<span class="chronicle-header-badge combat">⚔️ Starcie!</span>';
    }

    const hTile = this.scene.hoveredWorldTile;
    const hoverCoordText = hTile
      ? `📍 Kafel: (${hTile.x}, ${hTile.y}) • Wysokość Z=${hTile.z} • Teren: ${escapeHtml(String(this.game.map.tiles[hTile.y]?.[hTile.x]?.terrain ?? '—'))}`
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
        <div class="editor-last-log">📝 ${escapeHtml(this.game.logs[0] ?? 'Gotowy do edycji poziomu.')}</div>
      </div>
    `
        : `
      ${dialogueHtml}
      ${inventoryDrawerHtml}
      ${this.buildCharacterDrawerHtml(charTex.portraitDataUrl, attrs)}
      ${this.buildCombatTopBannerHtml()}

      <div class="bottom-hud ${this.game.combatState.active ? 'combat-mode-active' : ''}">
        ${(() => {
          const heroMeta = this.options.getHeroMeta?.() ?? null;
          const hpCur = player.combat?.hp ?? 0;
          const hpMax = Math.max(1, player.combat?.maxHp ?? 1);
          const hpPct = Math.max(0, Math.min(100, Math.round((hpCur / hpMax) * 100)));
          const apCur = player.combat?.ap ?? 0;
          const apMax = Math.max(1, player.combat?.maxAp ?? 1);
          const prog = this.game.progression;
          const xpNext = xpForNextLevel(prog.level);
          const progXpPct = prog.level >= MAX_CHARACTER_LEVEL ? 100 : Math.min(100, Math.round((prog.xp / xpNext) * 100));
          const manaCur = player.combat?.mana ?? player.combat?.maxMana ?? 90;
          const manaMax = player.combat?.maxMana ?? 90;
          const effectiveLevel = heroMeta?.level ?? prog.level;
          const levelPill = `<span class="hero-lvl-pill">Poz. ${effectiveLevel}</span>`;
          const currencyText = heroMeta?.currencyText ?? `${this.game.siekance} siek.`;
          const pendingPts = heroMeta?.pendingLevelUpPts ?? (prog.attributePoints + prog.skillPoints);
          const xpPctVal = heroMeta?.xpPct !== undefined ? heroMeta.xpPct : progXpPct;
          const xpTooltipVal = heroMeta?.xpTooltip ?? `Doświadczenie: ${prog.level >= MAX_CHARACTER_LEVEL ? 'MAX' : `${prog.xp}/${xpNext} XP`}`;
          const xpBarHtml = `<div class="hero-xp-track" title="${escapeHtml(xpTooltipVal)}"><div class="hero-xp-fill" style="width:${Math.max(0, Math.min(100, xpPctVal))}%;"></div></div>`;
          const charSheetBtnHtml = this.options.onOpenCharacterSheet
            ? `<button type="button" class="hud-btn ${pendingPts > 0 ? 'is-levelup' : ''}" data-action="open-char-sheet" title="Karta postaci, ekwipunek, talenty i dziennik [I / K]">
                ${pendingPts > 0 ? `⬆️ Awans (+${pendingPts})` : this.options.unifiedCharacterSheet ? '📜 Postać [I]' : '📜 Postać'}
              </button>`
            : `<button type="button" class="hud-btn ${this.isCharacterOpen ? 'active' : ''}" data-action="toggle-character" title="${
                pendingPts > 0
                  ? `Masz ${prog.attributePoints} pkt atrybutów i ${prog.skillPoints} pkt umiejętności do wydania! [K]`
                  : 'Otwórz Kartę Postaci i Drzewko Umiejętności (Klawisz K)'
              }">
                🧬 Postać [K]${pendingPts > 0 ? ` <span class="unspent-points-badge">${pendingPts}</span>` : ''}
              </button>`;
          const backpackBtnHtml = this.options.unifiedCharacterSheet
            ? ''
            : `<button type="button" class="hud-btn ${this.isInventoryOpen ? 'active' : ''}" data-action="toggle-inventory" title="Plecak [I]">
                🎒 Plecak (${occupiedCount}/${this.game.backpack.capacity})
              </button>`;
          const campBtnHtml = this.options.onOpenCamp
            ? `<button type="button" class="hud-btn" data-action="open-camp" title="Obóz: alchemia, ostrzenie, gotowanie, odpoczynek">🔥 Obóz</button>`
            : `<button type="button" class="hud-btn" data-action="use-campfire" title="Podejdź do ogniska">🔥 ${hasRawSausage ? 'Upiecz!' : 'Ognisko'}</button>`;

          return `
        <div class="hero-card">
          <div class="portrait-frame" title="Kliknij dwukrotnie, aby wycentrować kamerę na bohaterze [F / Home]">
            <img src="${charTex.portraitDataUrl}" alt="Portret Bohatera" class="hero-portrait-img" />
            <span class="armor-badge" title="Pancerz / Obrażenia">🛡️ ${totalArmor} · ⚔️ ${totalAttack}</span>
          </div>
          <div class="hero-details">
            <div class="hero-header-row">
              <span class="hero-name">${escapeHtml(player.recipe.name)}</span>
              <div class="hero-meta-pills">
                ${levelPill}
                <span class="hero-purse-pill" title="Sakiewka">🪙 ${escapeHtml(currencyText)}</span>
              </div>
            </div>
            <div class="hero-vitals-row">
              <div class="hero-combat-hp-track ${hpPct <= 30 ? 'is-low' : ''}" title="Zdrowie: ${hpCur} / ${hpMax} HP">
                <div class="hero-combat-hp-fill" style="width:${hpPct}%;"></div>
                <span class="hero-combat-hp-text">${hpCur} / ${hpMax} HP</span>
              </div>
              <span class="hero-ap-pill" title="Mana: ${manaCur}/${manaMax}">💧 ${manaCur}/${manaMax}</span>
              <span class="hero-ap-pill" title="Punkty Akcji">⚡ ${apCur}/${apMax}</span>
            </div>
            ${xpBarHtml}
            <div class="quick-actions">
              ${charSheetBtnHtml}
              ${backpackBtnHtml}
              <button type="button" class="hud-btn ${this.game.isStealthActive ? 'active stealth-active' : ''}" data-action="toggle-stealth" title="Skradanie [C]">
                ${this.game.isStealthActive ? '👁️ Skryty [C]' : 'Skradanie [C]'}
              </button>
              ${campBtnHtml}
              <button type="button" class="hud-btn hud-btn-icon" data-action="center-camera" title="Wycentruj kamerę na bohaterze [F / Home]">
                🎯
              </button>
              ${
                this.devMode
                  ? `<button type="button" class="hud-btn" data-action="spawn-npc">➕ NPC</button>`
                  : ''
              }
            </div>
          </div>
        </div>`;
        })()}

        ${this.game.combatState.active ? '<div class="combat-unified-dock">' : ''}
        ${this.buildCombatOverlayHtml()}

        ${
          this.game.combatState.active && this.activeBattleLogTab === 'combat'
            ? this.buildCombatLiveLogHtml()
            : `
        <div class="chronicle-log ${this.isChronicleExpanded ? 'expanded' : ''} ${pulseClass}">
          <div class="log-header">
            ${
              this.game.combatState.active
                ? `
                <div class="combat-log-tabs">
                  <button type="button" class="combat-tab-btn" data-action="set-battle-tab-combat" title="Przełącz na widok Walki">⚔️ Walka (${this.game.combatLogs.length})</button>
                  <button type="button" class="combat-tab-btn active" data-action="set-battle-tab-chronicle">📜 Kronika (${this.game.chronicleEntries.length})</button>
                </div>
                `
                : `<span class="log-header-title">📜 Kronika (${this.game.chronicleEntries.length})${headerBadge}</span>`
            }
            <div class="log-header-controls">
              <button
                type="button"
                class="chronicle-filter-pill ${this.chronicleImportantOnly ? 'active' : ''}"
                data-action="toggle-chronicle-important-filter"
                title="Subtelny filtr: pokaż tylko ważne wydarzenia i zagrożenia"
              >⭐ Ważne</button>
              ${
                this.isChronicleExpanded
                  ? `<button type="button" class="chronicle-close-x-btn" data-action="toggle-chronicle" title="Zwiń Kronikę (Esc)">✕</button>`
                  : `<button type="button" class="chronicle-toggle-btn expand-btn" data-action="toggle-chronicle" title="Rozwiń Kronikę Wydarzeń na całą wysokość ekranu">▲ Rozwiń</button>`
              }
            </div>
          </div>
          <div class="log-entries">
            ${visibleEntries.length === 0
              ? `<div class="log-line log-severity-info"><span class="log-bullet">•</span> <span class="log-line-text">${this.chronicleImportantOnly ? 'Brak ważnych wydarzeń w kronice.' : 'Kronika wydarzeń jest pusta.'}</span></div>`
              : visibleEntries
                  .map((entry, idx) => {
                    const isNewest = idx === 0 && isRecentLog;
                    const isImportant = entry.severity === 'important';
                    const isCritical = entry.severity === 'critical';
                    const isCombat = entry.severity === 'combat';

                    const bulletIcon = isImportant
                      ? '⭐'
                      : isCritical
                        ? '⚠️'
                        : isCombat
                          ? '⚔️'
                          : '•';
                    const bulletClass = isImportant
                      ? 'log-bullet log-bullet-important'
                      : isCritical
                        ? 'log-bullet log-bullet-critical'
                        : isCombat
                          ? 'log-bullet log-bullet-combat'
                          : 'log-bullet';

                    const badgeHtml = isImportant
                      ? '<span class="log-badge-important">WAŻNE</span>'
                      : isCritical
                        ? '<span class="log-badge-critical">ALARM</span>'
                        : '';

                    const reportBtn = entry.combatReportId
                      ? `<button type="button" class="combat-report-tag-btn" data-action="view-combat-report" data-report-id="${entry.combatReportId}" title="Zobacz szczegółowy raport z tego starcia">📜 Raport</button>`
                      : '';

                    const newestClass = isNewest
                      ? (isImportant ? 'log-newest log-newest-important' : 'log-newest')
                      : '';

                    return `<div class="log-line log-severity-${entry.severity} ${newestClass}">
                      <span class="${bulletClass}">${bulletIcon}</span>
                      <span class="log-line-text">${badgeHtml}${escapeHtml(entry.text)}</span>
                      ${reportBtn}
                    </div>`;
                  })
                  .join('')
            }
          </div>
          ${
            this.isChronicleExpanded
              ? `
              <div class="chronicle-footer">
                <span class="chronicle-footer-hint">📜 Wpisów: ${this.game.chronicleEntries.length} • [Esc] zamyka</span>
                <button type="button" class="chronicle-collapse-btn-bottom collapse-red" data-action="toggle-chronicle" title="Zwiń Kronikę Wydarzeń">
                  ▼ Zwiń
                </button>
              </div>`
              : ''
          }
        </div>
        `
        }
        ${this.game.combatState.active ? '</div>' : ''}
      </div>
    `;

    let combatReportModalHtml = '';
    if (this.activeCombatReportModalId && this.game.combatReports[this.activeCombatReportModalId]) {
      const rep = this.game.combatReports[this.activeCombatReportModalId];
      const outcomeBadge = rep.outcome === 'victory'
        ? '<span class="report-badge victory">🏆 Zwycięstwo</span>'
        : rep.outcome === 'defeat'
          ? '<span class="report-badge defeat">💀 Porażka</span>'
          : rep.outcome === 'fled'
            ? '<span class="report-badge fled">🏃 Ucieczka</span>'
            : '<span class="report-badge in-progress">⚔️ W toku</span>';

      combatReportModalHtml = `
        <div class="combat-report-modal-backdrop" data-action="close-combat-report">
          <div class="combat-report-modal-dialog">
            <div class="combat-report-header">
              <div class="combat-report-title-area">
                <span class="combat-report-icon">📜</span>
                <div>
                  <h3 class="combat-report-title">Raport z walki: ${escapeHtml(rep.targetName)}</h3>
                  <div class="combat-report-subtitle">Szczegółowy rejestr starcia turowego, rzutów kością i obrażeń</div>
                </div>
              </div>
              <div class="combat-report-header-right">
                ${outcomeBadge}
                <button type="button" class="combat-report-close-btn" data-action="close-combat-report" title="Zamknij raport (Esc)">✕</button>
              </div>
            </div>
            <div class="combat-report-body">
              ${rep.entries.length > 0
                ? rep.entries
                    .map((e) => `<div class="combat-report-row"><span class="report-bullet">•</span><span class="report-text">${escapeHtml(e)}</span></div>`)
                    .join('')
                : '<div class="combat-report-empty">Brak szczegółowych wpisów dla tego starcia.</div>'
              }
            </div>
            <div class="combat-report-footer">
              <span class="combat-report-count">Liczba zdarzeń w walce: ${rep.entries.length}</span>
              <button type="button" class="hud-btn" data-action="close-combat-report">Zamknij</button>
            </div>
          </div>
        </div>
      `;
    }

    const pendingConfirm = this.game.pendingCombatConfirmation;
    const combatConfirmModalHtml = pendingConfirm
      ? `
        <div class="combat-confirm-backdrop">
          <div class="combat-confirm-modal" role="dialog" aria-modal="true">
            <div class="combat-confirm-title">⚔️ Rozpocząć walkę?</div>
            <div class="combat-confirm-body">
              Czy na pewno chcesz zaatakować: <strong>${escapeHtml(pendingConfirm.npcName)}</strong>
              <span class="combat-confirm-tag">(${escapeHtml(pendingConfirm.difficultyLabel)})</span>?
            </div>
            <div class="combat-confirm-actions">
              <button type="button" class="btn-combat-confirm-fight" data-action="confirm-combat">⚔️ Walcz</button>
              <button type="button" class="btn-combat-confirm-leave" data-action="cancel-combat">🚶 Odejdź</button>
            </div>
          </div>
        </div>
      `
      : '';

    const preservedScrollSelectors = [
      '.credits-modal-body',
      '.character-drawer',
      '.combat-report-body',
      '.dialogue-modal',
      '.inventory-drawer'
    ];
    const preservedScrollTops = new Map<string, number>();
    for (const sel of preservedScrollSelectors) {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (el && el.scrollTop > 0) {
        preservedScrollTops.set(sel, el.scrollTop);
      }
    }

    this.root.innerHTML = `
      ${this.buildItemDetailsModalHtml()}
      ${combatConfirmModalHtml}
      ${combatReportModalHtml}
      ${edgeOverlayHtml}
      <div class="top-bar">
        <div class="brand-block">
          <span class="brand-crest">${this.devMode ? '🛠️' : '❖'}</span>
          <div>
            <div class="world-title">${this.devMode ? `EDYTOR POZIOMÓW <span style="opacity:0.75;font-weight:500;">— ${escapeHtml(this.game.map.name)} (${this.game.map.width}×${this.game.map.height})</span>` : escapeHtml(this.game.map.name)}</div>
            <div class="world-subtitle">${this.devMode ? 'Tryb projektowania mapy: maluj teren LPM, stawiaj obiekty Glionox/Slavic, zmieniaj wysokość Z i eksportuj JSON' : escapeHtml(this.game.map.subtitle)}</div>
          </div>
        </div>

        <div class="camera-compass-bar">
          <button type="button" class="compass-btn" data-action="rot-ccw" title="Obróć kamerę o -90° [Q]">⟲ Q</button>
          <button type="button" class="compass-angle-btn active" data-rot="0" title="Kierunek kamery (kliknij, aby zresetować na Północ)">
            ${(['N', 'E', 'S', 'W'] as const)[this.scene.rotation] ?? 'N'}
          </button>
          <button type="button" class="compass-btn" data-action="rot-cw" title="Obróć kamerę o +90° [E]">E ⟳</button>
          ${this.devMode ? devSelectorHtml : ''}
        </div>

        ${telemetryOrControlsHtml}
      </div>

      ${bottomAreaHtml}
      ${this.renderCreditsModalHtml()}
    `;

    for (const [sel, top] of preservedScrollTops) {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (el) el.scrollTop = top;
    }

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
        } else if (action === 'toggle-credits') {
          this.isCreditsOpen = !this.isCreditsOpen;
          this.render();
        } else if (action === 'toggle-audio') {
          const audio = CombatAudioEngine.getInstance();
          const nextMuted = !audio.getMuted();
          audio.setMuted(nextMuted);
          this.options.onToggleAudio?.(nextMuted);
          this.render();
        } else if (action === 'close-credits') {
          this.isCreditsOpen = false;
          this.render();
        } else if (action === 'confirm-combat') {
          this.game.confirmPendingCombat();
          this.render();
        } else if (action === 'cancel-combat') {
          this.game.cancelPendingCombat();
          this.render();
        } else if (action === 'inspect-item') {
          const instId = btn.dataset.instanceId;
          if (instId) {
            this.inspectedItemInstanceId = instId;
            this.render();
          }
        } else if (action === 'close-item-details') {
          this.inspectedItemInstanceId = null;
          this.render();
        } else if (action === 'equip-inspected-item') {
          const instId = btn.dataset.instanceId;
          if (instId && this.game.useOrEquipInstance(instId)) {
            this.inspectedItemInstanceId = null;
            this.hoveredBagInstanceId = null;
            this.render();
          }
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
          this.toggleInventory();
          this.hoveredBagInstanceId = null;
          this.hoveredEquipSlot = null;
        } else if (action === 'toggle-character') {
          this.toggleCharacter();
        } else if (action === 'close-character') {
          this.isCharacterOpen = false;
          this.render();
        } else if (action === 'close-dialogue') {
          this.game.activeDialogue = null;
          this.render();
        } else if (action === 'respec-progression') {
          this.game.respecPlayerProgression();
          this.render();
        } else if (action === 'toggle-chronicle') {
          this.toggleChronicleExpanded();
        } else if (action === 'toggle-chronicle-important-filter') {
          this.chronicleImportantOnly = !this.chronicleImportantOnly;
          this.render();
        } else if (action === 'merchant-equip-item') {
          const instId = btn.dataset.instanceId;
          if (instId) {
            this.game.useOrEquipInstance(instId);
            this.render();
          }
        } else if (action === 'merchant-sell-item') {
          const instId = btn.dataset.instanceId;
          if (instId) {
            this.game.sellItemForSiekance(instId);
            this.render();
          }
        } else if (action === 'set-battle-tab-chronicle') {
          this.activeBattleLogTab = 'chronicle';
          this.render();
        } else if (action === 'set-battle-tab-combat') {
          this.activeBattleLogTab = 'combat';
          this.render();
        } else if (action === 'toggle-combat-log-expanded') {
          this.isCombatLogExpanded = !this.isCombatLogExpanded;
          this.render();
        } else if (action === 'view-combat-report') {
          const repId = btn.getAttribute('data-report-id');
          if (repId) {
            this.activeCombatReportModalId = repId;
            this.render();
          }
        } else if (action === 'close-combat-report') {
          this.activeCombatReportModalId = null;
          this.render();
        } else if (action === 'toggle-stealth') {
          this.game.toggleStealth();
          this.render();
        } else if (action === 'toggle-combat-advanced') {
          this.toggleCombatAdvanced();
        } else if (action === 'toggle-fullscreen') {
          this.toggleFullscreen();
        } else if (action === 'toggle-dev-selector') {
          this.isDevSelectorOpen = !this.isDevSelectorOpen;
          this.render();
        } else if (action === 'open-char-sheet') {
          this.options.onOpenCharacterSheet?.();
        } else if (action === 'open-camp') {
          this.options.onOpenCamp?.();
        } else if (action === 'save-game') {
          if (this.options.onSaveGame) {
            this.options.onSaveGame();
          } else {
            this.saveGameDiscreetly();
          }
        } else if (action === 'load-game') {
          this.options.onLoadGame?.();
        } else if (action === 'open-save-key') {
          this.options.onOpenSaveKey?.();
        } else if (action === 'reset-save') {
          const ok = typeof window !== 'undefined'
            ? window.confirm('Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.')
            : true;
          if (ok) {
            if (this.options.onNewGame) {
              this.options.onNewGame();
            } else {
              this.resetSaveAndRestart();
            }
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
          if (typeof this.scene.resetCameraToDefault === 'function') {
            this.scene.resetCameraToDefault();
          } else {
            this.scene.centerCameraOnPlayer();
          }
        }
      });
    });

    this.root.querySelector<HTMLElement>('.portrait-frame')?.addEventListener('dblclick', () => {
      this.scene.centerCameraOnPlayer();
    });

    const devSelect = this.root.querySelector<HTMLSelectElement>('[data-action="dev-scene-select"]');
    devSelect?.addEventListener('change', () => {
      const selectedId = devSelect.value;
      this.isDevSelectorOpen = false;
      if (this.options.onSelectDevScene) {
        this.options.onSelectDevScene(selectedId);
      } else {
        this.game.loadMap(selectedId as MapId);
        this.scene.centerCameraOnPlayer();
      }
      this.render();
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

    this.root.querySelectorAll<HTMLElement>('[data-belt-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotIdx = Number(btn.dataset.beltSlot);
        if (!Number.isNaN(slotIdx)) {
          this.isFleeConfirmPending = false;
          if (this.game.useCombatQuickBeltSlot(slotIdx)) {
            this.isCombatAdvancedOpen = false;
            this.render();
          }
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
        if (
          this.game.isSequentialEnemyTurnActive ||
          this.game.combatState.activeTurnActorId !== this.game.player.id
        ) {
          return;
        }
        const act = btn.dataset.combatAction;
        if (act === 'attack') {
          const targetId = this.game.combatState.selectedTargetId;
          if (targetId) {
            this.isCombatAdvancedOpen = false;
            this.isFleeConfirmPending = false;
            this.game.commandAttackEnemy(targetId);
          }
        } else if (act === 'defend') {
          this.isCombatAdvancedOpen = false;
          this.isFleeConfirmPending = false;
          this.game.activatePlayerDefendStance();
        } else if (act === 'end-turn') {
          this.isCombatAdvancedOpen = false;
          this.isFleeConfirmPending = false;
          this.game.endPlayerCombatTurn(true);
        } else if (act === 'flee') {
          if (!this.isFleeConfirmPending) {
            this.isFleeConfirmPending = true;
          } else {
            this.isFleeConfirmPending = false;
            this.isCombatAdvancedOpen = false;
            this.game.fleeCombat();
          }
        }
        this.render();
      });
    });

    const modalBackdropConfigs: Array<{ backdrop: string; scrollBody: string }> = [
      { backdrop: '.credits-modal-backdrop', scrollBody: '.credits-modal-body' },
      { backdrop: '.character-backdrop', scrollBody: '.character-drawer' },
      { backdrop: '.combat-report-modal-backdrop', scrollBody: '.combat-report-body' },
      { backdrop: '.dialogue-backdrop', scrollBody: '.dialogue-modal' },
      { backdrop: '.combat-confirm-backdrop', scrollBody: '.combat-confirm-modal' },
      { backdrop: '.item-details-backdrop', scrollBody: '.item-details-modal' }
    ];
    for (const cfg of modalBackdropConfigs) {
      const backdropEl = this.root.querySelector<HTMLElement>(cfg.backdrop);
      if (!backdropEl) continue;
      const scrollEl = backdropEl.querySelector<HTMLElement>(cfg.scrollBody);
      const isolateEvent = (e: Event): void => {
        e.stopPropagation();
      };
      backdropEl.addEventListener('pointerdown', isolateEvent);
      backdropEl.addEventListener('mousedown', isolateEvent);
      backdropEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      backdropEl.addEventListener(
        'wheel',
        (e) => {
          e.stopPropagation();
          if (scrollEl && !scrollEl.contains(e.target as Node)) {
            e.preventDefault();
            scrollEl.scrollTop += e.deltaY;
          }
        },
        { passive: false }
      );
    }
    this.root.querySelector('.credits-modal-window')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    this.root.querySelector('.combat-report-modal-dialog')?.addEventListener('click', (e) => {
      e.stopPropagation();
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
          if ((e.target as HTMLElement)?.closest('.bag-sell-btn, .bag-inspect-btn')) {
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
        slotEl.addEventListener('dragend', () => {
          this.draggedSlotIndex = null;
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

    this.root.querySelectorAll<HTMLElement>('[data-alloc-attr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stat = btn.dataset.allocAttr as keyof CharacterAttributes | undefined;
        if (stat) {
          this.game.allocatePlayerAttribute(stat);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-skill-branch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const branch = btn.dataset.skillBranch as SkillBranchId | undefined;
        if (branch) {
          this.activeSkillBranch = branch;
          const first = SKILL_TREE_DEFS.find((n) => n.branch === branch);
          if (first) this.selectedSkillNodeId = first.id;
          this.render();
        }
      });
    });

    const charDrawer = this.root.querySelector<HTMLElement>('.character-drawer');
    if (charDrawer) {
      charDrawer.addEventListener('click', (e) => e.stopPropagation());
    }

    const skillTooltipEl = this.root.querySelector<HTMLElement>('#skill-hover-tooltip');
    const positionCharacterTooltip = (anchor: HTMLElement): void => {
      if (!skillTooltipEl) return;
      skillTooltipEl.classList.add('visible');
      skillTooltipEl.setAttribute('aria-hidden', 'false');

      const rect = anchor.getBoundingClientRect();
      const ttWidth = 300;
      const ttHeight = skillTooltipEl.offsetHeight || 190;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

      let left = rect.right + 12;
      if (left + ttWidth > vw - 12) {
        left = Math.max(12, rect.left - ttWidth - 12);
      }
      let top = rect.top + rect.height / 2 - ttHeight / 2;
      if (top + ttHeight > vh - 12) {
        top = vh - ttHeight - 12;
      }
      if (top < 12) {
        top = 12;
      }
      skillTooltipEl.style.left = `${Math.round(left)}px`;
      skillTooltipEl.style.top = `${Math.round(top)}px`;
    };

    const showSkillTooltip = (anchor: HTMLElement, nodeId: string): void => {
      if (!skillTooltipEl) return;
      const node = SKILL_TREE_BY_ID[nodeId];
      if (!node) return;
      const prog = this.game.progression;
      const attrs = this.game.statSheet.getEffectiveAttributes();
      const rank = getSkillRank(prog, node.id);
      const unlockCheck = canUnlockSkill(prog, attrs, node.id);
      const costRow = node.activeAbility
        ? `
          <div class="skill-tt-costs">
            <span>⚡ ${node.activeAbility.apCost} PA</span>
            <span>💧 ${node.activeAbility.manaCost} Many</span>
            <span>⏳ ${node.activeAbility.cooldownTurns} t. odn.</span>
          </div>
        `
        : '';
      const statusText =
        rank >= node.maxRank
          ? '<span class="skill-tt-status maxed">✓ Maksymalna ranga</span>'
          : unlockCheck.ok
            ? '<span class="skill-tt-status ready">✅ Gotowe do odblokowania (Dwuklik)</span>'
            : `<span class="skill-tt-status locked">🔒 ${escapeHtml(unlockCheck.reason ?? 'Wymagania niespełnione')}</span>`;

      skillTooltipEl.innerHTML = `
        <div class="skill-tt-header">
          <span class="skill-tt-icon">${node.icon}</span>
          <div class="skill-tt-titles">
            <div class="skill-tt-name">${escapeHtml(node.name)}</div>
            <div class="skill-tt-meta">
              <span class="skill-tt-kind ${node.kind}">${node.kind === 'active' ? 'Zdolność Aktywna' : 'Talent Pasywny'}</span>
              <span class="skill-tt-rank">Ranga ${rank}/${node.maxRank}</span>
            </div>
          </div>
        </div>
        <div class="skill-tt-summary">${escapeHtml(node.summary)}</div>
        <p class="skill-tt-desc">${escapeHtml(node.description)}</p>
        ${costRow}
        <div class="skill-tt-footer">${statusText}</div>
      `;
      positionCharacterTooltip(anchor);
    };

    const showAttrTooltip = (anchor: HTMLElement, attrKey: keyof CharacterAttributes): void => {
      if (!skillTooltipEl) return;
      const meta = ATTRIBUTE_LABELS[attrKey];
      if (!meta) return;
      const prog = this.game.progression;
      const attrs = this.game.statSheet.getEffectiveAttributes();
      const val = attrs[attrKey];
      const spent = prog.spentAttributePoints[attrKey] ?? 0;

      skillTooltipEl.innerHTML = `
        <div class="skill-tt-header">
          <span class="skill-tt-icon skill-tt-icon-text">${escapeHtml(meta.short)}</span>
          <div class="skill-tt-titles">
            <div class="skill-tt-name">${escapeHtml(meta.name)}</div>
            <div class="skill-tt-meta">
              <span class="skill-tt-kind passive">Atrybut Główny</span>
              <span class="skill-tt-rank">Wartość: ${val}${spent > 0 ? ` (+${spent})` : ''}</span>
            </div>
          </div>
        </div>
        <div class="skill-tt-summary">Wpływ na statystyki bohatera:</div>
        <p class="skill-tt-desc">${escapeHtml(meta.effectHint)}</p>
        <div class="skill-tt-footer">${
          prog.attributePoints > 0
            ? `<span class="skill-tt-status ready">✅ Kliknij +, aby przydzielić 1 pkt (wolne: ${prog.attributePoints})</span>`
            : '<span class="skill-tt-status locked">Brak wolnych punktów atrybutów</span>'
        }</div>
      `;
      positionCharacterTooltip(anchor);
    };

    const hideSkillTooltip = (): void => {
      if (!skillTooltipEl) return;
      skillTooltipEl.classList.remove('visible');
      skillTooltipEl.setAttribute('aria-hidden', 'true');
    };

    this.root.querySelectorAll<HTMLElement>('[data-attr-info]').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        const attrKey = row.dataset.attrInfo as keyof CharacterAttributes | undefined;
        if (attrKey) showAttrTooltip(row, attrKey);
      });
      row.addEventListener('mouseleave', hideSkillTooltip);
    });

    this.root.querySelectorAll<HTMLElement>('[data-skill-node]').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        const nodeId = btn.dataset.skillNode;
        if (nodeId) showSkillTooltip(btn, nodeId);
      });
      btn.addEventListener('focus', () => {
        const nodeId = btn.dataset.skillNode;
        if (nodeId) showSkillTooltip(btn, nodeId);
      });
      btn.addEventListener('mouseleave', hideSkillTooltip);
      btn.addEventListener('blur', hideSkillTooltip);
      btn.addEventListener('click', () => {
        const nodeId = btn.dataset.skillNode;
        if (nodeId) {
          this.selectedSkillNodeId = nodeId;
          this.render();
        }
      });
      btn.addEventListener('dblclick', () => {
        const nodeId = btn.dataset.skillNode;
        if (nodeId) {
          this.selectedSkillNodeId = nodeId;
          this.game.unlockPlayerSkill(nodeId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-unlock-skill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nodeId = btn.dataset.unlockSkill;
        if (nodeId) {
          this.game.unlockPlayerSkill(nodeId);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-combat-skill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skillId = btn.dataset.combatSkill;
        if (!skillId) return;
        const targetId = this.game.combatState.selectedTargetId ?? undefined;
        this.game.performPlayerCombatSkill(skillId, targetId);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-choice-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.choiceIdx);
        const choice = this.game.activeDialogue?.node.choices[idx];
        if (choice) {
          if (choice.action === 'open_trade') {
            this.isInventoryOpen = true;
            this.isCharacterOpen = false;
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

  private renderCreditsModalHtml(): string {
    if (!this.isCreditsOpen) return '';

    return `
      <div class="credits-modal-backdrop" data-action="close-credits" role="dialog" aria-modal="true" aria-label="Twórcy i licencje">
        <div class="credits-modal-window">
          <div class="credits-modal-header">
            <div class="credits-modal-title">
              <span class="credits-crest">❖</span>
              <div>
                <h2>Twórcy, Licencje i Wymogi Formalne</h2>
                <div class="credits-subtitle">Voided: na przekór gwiazdom (Ostrze 2.5D) — Credits &amp; Legal Notices</div>
              </div>
            </div>
            <button type="button" class="credits-close-btn" data-action="close-credits" title="Zamknij (Klawisz Esc)">✕ Zamknij [Esc]</button>
          </div>

          <div class="credits-modal-body" tabindex="0">
            <div class="credits-section-box credits-authors-hero">
              <div class="credits-section-title">⚔️ Twórcy Gry — „Voided: na przekór gwiazdom” (Ostrze 2.5D)</div>
              <ul class="credits-list">
                <li>
                  <strong>Pomysł świata i gry, fabuła, dialogi, mechanika i pierwowzór terminalowy:</strong>
                  <strong>Daniel „Twiist” Antonik</strong>
                </li>
                <li>
                  <strong>Realizacja wersji 2.5D, port, oprawa oraz silnik Ulf-cRPG-Engine:</strong>
                  <strong>Jakub „Ulfgaros” Górski</strong>
                </li>
              </ul>
              <p style="margin-top: 6px; font-size: 12px; opacity: 0.88;">
                Wersja 2.5D jest autorskim portem terminalowej gry RPG „Voided: na przekór gwiazdom” na izometryczny silnik Ulf-cRPG-Engine z oświetleniem Deferred Normal-Mapped PBR.
              </p>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">📜 Licencje Gry i Silnika (Wymogi Prawne)</div>
              <ul class="credits-list">
                <li>
                  <strong>Treść gry (fabuła, dialogi, świat, opisy, mapy — „Voided: na przekór gwiazdom”):</strong>
                  Copyright © 2026 Daniel Twiist Antonik — Licencja
                  <em><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pl" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a></em>
                  (Uznanie autorstwa – Użycie niekomercyjne – Na tych samych warunkach 4.0; zmodyfikowano i zaadaptowano do wersji 2.5D).
                </li>
                <li>
                  <strong>Oryginalny kod CLI („ostrze”):</strong> Copyright © 2026 Daniel Twiist Antonik — Licencja <em>MIT License</em>.
                </li>
                <li>
                  <strong>Silnik Ulf-cRPG-Engine i kod portu 2.5D:</strong> Copyright © 2026 Jakub Górski — Licencja <em>MIT License</em>.
                </li>
              </ul>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">🏰 Izometryczne Modele Postaci, Podziemi i Obiektów Świata</div>
              <ul class="credits-list">
                <li>
                  <strong>Izometryczne Modele Postaci i Bestiariusza 8-Kierunkowe (Flare RPG Fantasycore):</strong>
                  Clint Bellanger &amp; Flare Team (Justin Jacobs, Stefan Beller, Thane Brimhall, Blarumyrran —
                  <a href="https://github.com/flareteam/flare-game" target="_blank" rel="noopener noreferrer">flare-game</a> / OpenGameArt.org) — Licencja <em>CC-BY-SA 3.0 / CC-BY 3.0</em>
                </li>
                <li>
                  <strong>Izometryczne Podziemia i Lochy (Isometric Miniature Dungeon):</strong>
                  Kenney Vleugels (<a href="https://kenney.nl" target="_blank" rel="noopener noreferrer">kenney.nl</a>) — Licencja <em>CC0 1.0 Public Domain</em>
                </li>
                <li>
                  <strong>Izometryczne Chaty z Bali (Log Cabins):</strong> Surt, Clint Bellanger (OpenGameArt.org) — Licencja <em>CC-BY 3.0 / OGA-BY 3.0 / CC0</em>
                </li>
                <li>
                  <strong>Izometryczne Drzewa (Isometric Trees):</strong> Yar, Hyptosis (OpenGameArt.org) — Licencja <em>CC-BY 3.0 / CC0</em>
                </li>
                <li>
                  <strong>Płoty, Latarnie, Studnia, Kafelki Terenu i Klify:</strong> OpenGameArt.org contributors — Licencja <em>CC-BY 3.0 / OGA-BY / CC0</em>
                </li>
              </ul>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">🌲 Grafika Otoczenia i Teren (2D)</div>
              <p><strong>Top-down Forest Tileset</strong> — Zestaw kafelków i obiektów leśnych (drzewa, pnie, poszycie, dekoracje).</p>
              <div class="credits-meta-row">
                <span>Autor: <strong>Glionox</strong> (<a href="https://glionox.itch.io/top-down-forest-tileset" target="_blank" rel="noopener noreferrer">itch.io</a>)</span>
                <span>Licencja: <strong>Free &amp; Commercial Projects (z atrybucją)</strong></span>
              </div>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">🔊 Efekty Dźwiękowe Walki (OpenGameArt.org)</div>
              <ul class="credits-list">
                <li>
                  <strong>RPG Sound Pack:</strong> artisticdude (OpenGameArt.org) — Licencja <em>CC0 1.0 Public Domain</em>
                </li>
                <li>
                  <strong>37 Hits &amp; Punches:</strong> Independent.nu / qubodup (OpenGameArt.org) — Licencja <em>CC0 1.0 Public Domain</em>
                </li>
              </ul>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">🔤 Typografia i Fonty (Google Fonts)</div>
              <div class="credits-meta-row">
                <span><strong>Cinzel</strong> (Natanael Gama) — <em>SIL OFL 1.1</em></span>
                <span><strong>MedievalSharp</strong> (Wojciech Kalinowski) — <em>SIL OFL 1.1</em></span>
                <span><strong>Uncial Antiqua</strong> (Astigmatic) — <em>SIL OFL 1.1</em></span>
                <span><strong>Inter</strong> (Rasmus Andersson) — <em>SIL OFL 1.1</em></span>
                <span><strong>JetBrains Mono</strong> (JetBrains) — <em>Apache 2.0 / SIL OFL 1.1</em></span>
              </div>
            </div>

            <div class="credits-section-box">
              <div class="credits-section-title">⚙️ Biblioteki i Środowisko Uruchomieniowe</div>
              <div class="credits-meta-row">
                <span><strong>PixiJS v8</strong> — Mathew Groves, Chad Engler &amp; PixiJS Community (<em>MIT License</em>)</span>
                <span><strong>Vite</strong> — Evan You &amp; contributors (<em>MIT License</em>)</span>
                <span><strong>TypeScript</strong> — Microsoft (<em>Apache 2.0</em>)</span>
                <span><strong>Vitest</strong> — Anthony Fu &amp; contributors (<em>MIT License</em>)</span>
              </div>
            </div>

            <div class="credits-legal-badge">
              ✓ Spełniono wymogi licencji Creative Commons (CC BY-NC-SA 4.0, CC-BY-SA 3.0, CC-BY 3.0, CC0), SIL Open Font License, Apache 2.0 oraz MIT.
              Pełne teksty licencji znajdują się w plikach <code>CREDITS.md</code> i <code>LICENSE-TRESC.md</code>.
            </div>
          </div>

          <div class="credits-modal-footer">
            <button type="button" class="credits-ack-btn" data-action="close-credits">Zamknij</button>
          </div>
        </div>
      </div>
    `;
  }
}
