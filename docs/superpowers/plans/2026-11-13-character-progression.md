# Character Progression & "Postać" View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete character progression system (XP, levels, attribute allocation, 3-branch Slavic skill tree with passive and active abilities, mana, respec), integrate it with combat, dialogues, and save/load, and add the "Postać" (`[C]`) UI view.

**Architecture:** Isolate progression state, XP math, skill tree definitions, and `CharacterStatSheet` modifier sync in `src/rpg/progressionSystem.ts`. Wire combat passives, mana, and active skills into `combatSystem.ts` and `gameLoop.ts`, add optional `xpReward` to `dialogueSystem.ts`, persist state in `saveSystem.ts` (v2 with v1 fallback), and render the "Postać" drawer and tactical skill buttons in `hudOverlay.ts` + `main.css`.

**Tech Stack:** TypeScript 5.7, Vite 6, Vitest 2.1, PixiJS 8 (scene/HUD callbacks).

**Spec:** `docs/superpowers/specs/2026-11-13-character-progression-design.md`

## Global Constraints
- `xpForNextLevel(level) = Math.round(25 * level + 10 * level * (level - 1))`, max level `20`.
- Each level-up grants `+2` `attributePoints`, `+1` `skillPoints`, full HP & Mana restore.
- Respec costs `25` siekańców, blocked during combat, preserves starting attributes and consumable bonuses.
- All passive skill modifiers on `CharacterStatSheet` use `sourceId: "skill:<id>"`.
- Preserve backward compatibility with `version: 1` saves in `saveSystem.ts`.
- Follow Polish grammatical conventions and existing `.dark-fantasy-frame` / brass-obsidian CSS tokens.

---

### Task 1: Core Progression Module (`src/rpg/progressionSystem.ts`)
**Files:**
- Create: `src/rpg/progressionSystem.ts`
- Test: `tests/rpg/progressionSystem.test.ts`

**Interfaces:**
- Produces: `SkillBranchId`, `SkillNodeDef`, `CharacterProgressionState`, `SKILL_TREE_DEFS`, `SKILL_TREE_BY_ID`, `RESPEC_COST_SIEKANCE`, `MAX_CHARACTER_LEVEL`, `xpForNextLevel`, `createInitialProgressionState`, `grantXpToProgression`, `canAllocateAttribute`, `allocateAttributePoint`, `canUnlockSkill`, `unlockSkillNode`, `syncSkillModifiersOnStatSheet`, `respecProgressionState`, `getSkillRank`.

- [ ] **Step 1: Write failing unit tests in `tests/rpg/progressionSystem.test.ts`** covering XP curve, multi-level-up, max level 20 cap, attribute allocation, skill prerequisites & attribute requirements, `CharacterStatSheet` modifier sync, and respec preserving consumable bonuses.
- [ ] **Step 2: Run `npx vitest run tests/rpg/progressionSystem.test.ts`** and verify RED.
- [ ] **Step 3: Implement `src/rpg/progressionSystem.ts`** with all 15 Slavic skill nodes across `witez`, `zwiadowca`, `zerca` and pure state-transition functions.
- [ ] **Step 4: Run `npx vitest run tests/rpg/progressionSystem.test.ts`** and verify GREEN.

---

### Task 2: Mana & Passive Skill Modifiers in Combat (`src/rpg/combatSystem.ts`, `src/rpg/gameLoop.ts`)
**Files:**
- Modify: `src/rpg/combatSystem.ts`
- Modify: `src/rpg/gameLoop.ts`
- Test: `tests/rpg/combatProgression.test.ts`

**Interfaces:**
- Consumes: `CharacterProgressionState`, `getSkillRank`, `syncSkillModifiersOnStatSheet`.
- Produces: `mana` & `maxMana` on `ActorCombatComponent` and `DerivedCombatStats`; optional `ProgressionCombatBonuses` parameter in `computeDerivedCombatStats`, `computeAttackPreview`, `resolveCombatAttack`.

- [ ] **Step 1: Write failing tests in `tests/rpg/combatProgression.test.ts`** for `maxMana` sync, passive skill combat bonuses (*Mur Tarczowy*, *Koci Krok*, *Pewna Ręka*, *Bystre Oko*, *Żelazny Chwyt*, *Runiczne Wzmocnienie*, *Cień Boru* +1 Max AP), and turn mana regeneration.
- [ ] **Step 2: Run `npx vitest run tests/rpg/combatProgression.test.ts`** and verify RED.
- [ ] **Step 3: Update `combatSystem.ts` and `gameLoop.ts`** (`syncPlayerCombatMax`, `startCombat`, `advanceTurn`, `endCombat`) to wire `mana`/`maxMana` and `ProgressionCombatBonuses`.
- [ ] **Step 4: Run `npx vitest run tests/rpg/combatProgression.test.ts tests/rpg/combatLogicAudit.test.ts tests/rpg/combatSystem.test.ts`** and verify GREEN.

---

### Task 3: Active Combat Skills & XP Rewards (`src/rpg/gameLoop.ts`, `src/rpg/dialogueSystem.ts`)
**Files:**
- Modify: `src/rpg/dialogueSystem.ts`
- Modify: `src/rpg/gameLoop.ts`
- Test: `tests/rpg/combatProgression.test.ts`

**Interfaces:**
- Consumes: `SKILL_TREE_BY_ID`, `grantXpToProgression`, `allocateAttributePoint`, `unlockSkillNode`, `respecProgressionState`.
- Produces: `DialogueChoice.xpReward?: number`, `CrpgGameState.progression`, `CrpgGameState.grantPlayerXp`, `CrpgGameState.allocatePlayerAttribute`, `CrpgGameState.unlockPlayerSkill`, `CrpgGameState.respecPlayerProgression`, `CrpgGameState.performPlayerCombatSkill`, `CrpgGameState.selectedCombatSkillId`.

- [ ] **Step 1: Write failing tests in `tests/rpg/combatProgression.test.ts`** for enemy defeat awarding both proficiency and character XP, dialogue `xpReward` one-time claim, and all 4 active skills (*Rozpłatanie*, *Sokole Oko*, *Gromowładny Znak*, *Tchnienie Mokoszy*) including AP/Mana/cooldowns, *Furia Peruna* crit AP refund, *Cień Boru* first-strike crit, and *Wola Przodków* debuff reduction.
- [ ] **Step 2: Run `npx vitest run tests/rpg/combatProgression.test.ts`** and verify RED.
- [ ] **Step 3: Implement active skills & XP rewards in `dialogueSystem.ts` and `gameLoop.ts`**.
- [ ] **Step 4: Run `npx vitest run tests/rpg/combatProgression.test.ts tests/rpg/gameLoop.test.ts`** and verify GREEN.

---

### Task 4: Save/Load Serialization (`src/rpg/saveSystem.ts`)
**Files:**
- Modify: `src/rpg/saveSystem.ts`
- Test: `tests/rpg/saveSystem.test.ts`

- [ ] **Step 1: Write failing tests in `tests/rpg/saveSystem.test.ts`** for saving/restoring `progression` (level, xp, points, unlockedSkills, claimedDialogueXpIds, mana) and loading a `version: 1` save without `progression` safely.
- [ ] **Step 2: Run `npx vitest run tests/rpg/saveSystem.test.ts`** and verify RED.
- [ ] **Step 3: Update `SerializedGameState`, `serializeGameState`, and `deserializeGameState` in `src/rpg/saveSystem.ts`**.
- [ ] **Step 4: Run `npx vitest run tests/rpg/saveSystem.test.ts`** and verify GREEN.

---

### Task 5: "Postać" View `[C]`, `.hero-card` XP Bar & Combat Skill Bar (`src/ui/hudOverlay.ts`, `src/styles/main.css`)
**Files:**
- Modify: `src/ui/hudOverlay.ts`
- Modify: `src/styles/main.css`
- Test: `tests/ui/characterView.test.ts`

- [ ] **Step 1: Write failing UI tests in `tests/ui/characterView.test.ts`** verifying `hud.toggleCharacter()`, `[C]` hotkey, `Escape` closing, `.hero-card` XP bar & `Postać [C]` button badge, attribute `+` buttons, 3-branch skill tree rendering, respec button, and active skill buttons in combat tactical bar.
- [ ] **Step 2: Run `npx vitest run tests/ui/characterView.test.ts`** and verify RED.
- [ ] **Step 3: Implement `Postać` view, `.hero-card` XP/Mana/button, combat active skill buttons, event bindings, and Slavic brass/obsidian CSS in `hudOverlay.ts` and `main.css`**.
- [ ] **Step 4: Run `npx vitest run tests/ui/characterView.test.ts tests/ui/inventoryUiRevamp.test.ts tests/ui/combatTacticalDock.test.ts`** and verify GREEN.

---

### Task 6: Final Verification & Logic Audit
- [ ] **Step 1: Run `npx tsc --noEmit`**.
- [ ] **Step 2: Run full `npx vitest run` across all test files**.
- [ ] **Step 3: Dispatch a verification/audit subagent** to review the implemented progression math, edge cases (respec + consumables, multi-level-up, mana/AP economy, save/load v1/v2, UI state), and confirm all requirements are met.
