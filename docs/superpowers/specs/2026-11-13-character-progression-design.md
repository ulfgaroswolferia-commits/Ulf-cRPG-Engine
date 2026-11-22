# Specyfikacja: System Awansu, Rozwoju Postaci i Widok „Postać” (`ulfRPG`)

**Data:** 2026-11-13
**Status:** Zatwierdzona przez użytkownika (Podejście A)

## 1. Cel i Zakres
Dodanie kompletnego, czytelnego i satysfakcjonującego systemu awansu i rozwoju postaci w `ulfRPG`, dopasowanego do słowiańskiej estetyki oraz taktycznego systemu walki turowej:
- Pula XP, poziomy postaci, punkty atrybutów i punkty umiejętności.
- Zasób Many (`mana` / `maxMana`) zintegrowany z istniejącym `StatType.ManaMax`.
- Drzewko umiejętności z 3 słowiańskimi ścieżkami (*Witeź*, *Zwiadowca*, *Żerca Runiczny*, 15 węzłów — pasywnych i aktywnych).
- Integracja zdolności aktywnych z paskiem taktycznym walki oraz logiką `combatSystem.ts` / `gameLoop.ts`.
- Opcja resetu rozwoju (respec) poza walką za `25 siekańców`, z zachowaniem bonusów z eliksirów.
- Dedykowany widok „Postać” (`[C]`) w `HudOverlay`, spójny wizualnie z panelem Ekwipunku (`.dark-fantasy-frame`), oraz pasek XP i przycisk `Postać [C]` na `.hero-card`.
- Pełna serializacja w `saveSystem.ts` z zachowaniem kompatybilności wstecznej dla zapisów `version: 1`.

---

## 2. Architektura Danych i Logiki (`src/rpg/progressionSystem.ts`)

### 2.1. Stan Rozwoju (`CharacterProgressionState`)
```ts
export type SkillBranchId = 'witez' | 'zwiadowca' | 'zerca';

export interface CharacterProgressionState {
  level: number; // start: 1
  xp: number; // XP w ramach bieżącego poziomu (0 .. xpForNextLevel(level)-1)
  attributePoints: number; // nieprzydzielone punkty atrybutów
  skillPoints: number; // nieprzydzielone punkty umiejętności
  spentAttributePoints: CharacterAttributes; // punkty wydane przez gracza (do poprawnego respec)
  unlockedSkills: Record<string, number>; // skillId -> aktualna ranga (1..maxRank)
  claimedDialogueXpIds: string[]; // jednorazowe nagrody XP z dialogów
  activeCooldowns: Record<string, number>; // skillId -> pozostałe tury odnowienia w walce
  firstStrikeReady: boolean; // flaga na początek walki (dla talentu Cień Boru)
  furyApRefundedThisTurn: boolean; // limit 1x/turę dla Furii Peruna
}
```

### 2.2. Krzywa XP i Awans
- **Próg awansu:** `xpForNextLevel(level) = Math.round(25 * level + 10 * level * (level - 1))`
  - Poz. 1 → 2: `25 XP`
  - Poz. 2 → 3: `70 XP`
  - Poz. 3 → 4: `135 XP`
  - Poz. 4 → 5: `220 XP`
  - Maksymalny poziom: `20` (na poziomie 20 XP nie awansuje dalej).
- **Nagrody za każdy awans (`+1` poziom):**
  - `+2` `attributePoints`
  - `+1` `skillPoints`
  - Odnowienie `hp = maxHp` oraz `mana = maxMana`.
  - Zdarzenie do Kroniki / logu: `Awans! Osiągnięto Poziom X (+2 pkt atrybutów, +1 pkt umiejętności).`
- **Źródła XP:**
  - **Walka (`handleEnemyDefeated`):** Nadal zwiększa biegłość używanej broni (`+gain%`, max 150%) oraz wywołuje `grantXp(gain)`.
  - **Dialogi (`DialogueChoice.xpReward?: number`):** Wybory dialogowe z `xpReward > 0` przyznają XP jednorazowo (klucz `${npcId}:${choiceId}` w `claimedDialogueXpIds`).

### 2.3. Przydział Atrybutów i Respec
- `allocateAttribute(stat: keyof CharacterAttributes)`:
  - Wymaga `attributePoints > 0`.
  - Zwiększa `statSheet` base attribute o `+1` oraz `spentAttributePoints[stat] += 1`, zmniejsza `attributePoints -= 1`.
  - Przelicza pochodne statystyki (`syncPlayerCombatMax()`).
- `respecProgression(currentSiekance: number)`:
  - Niedostępne podczas aktywnej walki (`combatState.active`).
  - Koszt: `25` siekańców (`RESPEC_COST_SIEKANCE = 25`).
  - Zwraca sumę `spentAttributePoints` do `attributePoints`, odejmuje `spentAttributePoints` z `statSheet` base attributes (zachowując bazowe atrybuty startowe `15/13/14/14/15` oraz stałe bonusy z eliksirów `consumableEffect`).
  - Zwraca sumę rang z `unlockedSkills` do `skillPoints`, zeruje `unlockedSkills`, usuwa z `statSheet` wszystkie modyfikatory o `sourceId` zaczynającym się od `'skill:'`.

---

## 3. Drzewko Umiejętności (3 Ścieżki, 15 Węzłów)

Każdy węzeł definiuje: `id`, `branch`, `tier (1..4)`, `name`, `maxRank (1 lub 2)`, `kind ('passive' | 'active')`, `prerequisites: string[]`, `requiredAttribute?: { stat: keyof CharacterAttributes; minValue: number }`, `description`, `modifiersPerRank?: StatModifierSpec[]`, oraz dla aktywnych `activeAbility?: ActiveSkillMeta`.

### Ścieżka I: Witeź (`witez`)
1. `witez_hart` (**Hart Ciała**, T1, pasywna, 0/2): `+15/+30 HealthMax`, `+2/+4 ArmorRating`.
2. `witez_chwyt` (**Żelazny Chwyt**, T2, pasywna, 0/2, req: `witez_hart`): `+2/+4 PhysicalDamage`, `+6/+12%` celności w zwarciu (`blades`, `axes_blunt`, `unarmed_shield`).
3. `witez_mur` (**Mur Tarczowy**, T2, pasywna, 0/2, req: `witez_hart`): `+5/+10%` DR% i `+1/+2` DT gdy ma tarczę (`offHand` kiteshield) lub aktywną postawę obronną (`defending`).
4. `witez_rozplatanie` (**Rozpłatanie**, T3, aktywna, 0/1, req: `witez_chwyt` lub `witez_mur`, `4 AP`, cd `2` tury, zasięg broni): Atak bronią z mnożnikiem `1.35x` obrażeń, `+20%` penetracji pancerza; przy trafieniu krytycznym nakłada `dazed_head` na 1 turę.
5. `witez_furia` (**Furia Peruna**, T4, pasywna, 0/1, req: `witez_rozplatanie`, `might >= 17`): `+10% CriticalStrikeChance`; krytyczne trafienie w zwarciu przywraca `+2 AP` (raz na turę).

### Ścieżka II: Zwiadowca (`zwiadowca`)
1. `zwiadowca_krok` (**Koci Krok**, T1, pasywna, 0/2): `+5/+10%` Uniku (`evasionPct`), `+4/+8` Inicjatywy (`sequence`).
2. `zwiadowca_reka` (**Pewna Ręka**, T2, pasywna, 0/2, req: `zwiadowca_krok`): `+5/+10% CriticalStrikeChance`, `+10/+20%` do mnożnika obrażeń krytycznych.
3. `zwiadowca_oko` (**Bystre Oko**, T2, pasywna, 0/2, req: `zwiadowca_krok`): `+8/+16%` celności, zmniejsza karę za dystans o połowę.
4. `zwiadowca_sokole` (**Sokole Oko**, T3, aktywna, 0/1, req: `zwiadowca_reka` lub `zwiadowca_oko`, `4 AP`, cd `2` tury, zasięg broni `+1` dla broni dystansowych): Precyzyjny atak z `+25%` celności i `+30%` szansy na kryta.
5. `zwiadowca_cien` (**Cień Boru**, T4, pasywna, 0/1, req: `zwiadowca_sokole`, `finesse >= 16` lub `perception >= 17`): `+1` Max AP na stałe; pierwszy atak w każdej walce otrzymuje `+35%` szansy na trafienie krytyczne.

### Ścieżka III: Żerca Runiczny (`zerca`)
1. `zerca_zapas` (**Zapas Mocy**, T1, pasywna, 0/2): `+15/+30 ManaMax`, regeneracja `+4/+8` Many na początku tury gracza (poza bazową regeneracją `+4`).
2. `zerca_wzmocnienie` (**Runiczne Wzmocnienie**, T2, pasywna, 0/2, req: `zerca_zapas`): `+3/+6` obrażeń dla kosturów runicznych i zdolności runicznych, `+1/+2` efektywnej `WIE` (`Intelligence`) dla skali kostura.
3. `zerca_wola` (**Wola Przodków**, T2, pasywna, 0/2, req: `zerca_zapas`): `+4/+8%` DR%, skraca czas trwania nowych statusów `dazed_head`/`crippled_legs` nakładanych na gracza o 1 turę (min. 0).
4. `zerca_grom` (**Gromowładny Znak**, T3, aktywna, 0/1, req: `zerca_wzmocnienie`, `3 AP`, `18 Many`, cd `2` tury, zasięg `1–5`): Atak runiczny omijający `50%` DT/DR% celu, zadający `Math.round(14 + 1.8 * lore)` obrażeń (+ bonus z `zerca_wzmocnienie`) i nakładający `dazed_head` na 1 turę (celność `85% + (lore - 10) * 2.5%`).
5. `zerca_mokosz` (**Tchnienie Mokoszy**, T4, aktywna, 0/1, req: `zerca_grom` lub `zerca_wola`, `2 AP`, `20 Many`, cd `3` tury, cel: gracz): Leczy `Math.round(25 + 2.0 * resolve)` HP i usuwa `dazed_head` oraz `crippled_legs`.

---

## 4. Zasób Many i Walka (`combatSystem.ts`, `gameLoop.ts`)
- `ActorCombatComponent` otrzymuje `mana: number` i `maxMana: number` (inicjalizowane z `StatType.ManaMax`, domyślnie `90` dla startowej `lore: 14`).
- `syncPlayerCombatMax()` synchronizuje `maxHp`, `maxAp`, `maxMana` oraz przyrost/ograniczenie aktualnej `mana`.
- Na początku każdej tury gracza w walce: cooldowny zmniejszają się o 1, `furyApRefundedThisTurn = false`, a `mana` regeneruje się o `4 + (rank(zerca_zapas) * 4)` (do `maxMana`). Po zakończeniu walki (zwycięstwo/ucieczka) `mana` odnawia się do `maxMana`, a cooldowny są zerowane.
- `CrpgGameState.performPlayerCombatSkill(skillId, targetNpcId?)` obsługuje zdolności aktywne z pełnym logowaniem do `combatLiveLog` i `combatReport`.

---

## 5. UI: Widok „Postać” (`[C]`) i HUD (`hudOverlay.ts`, `main.css`)
- **`.hero-card`:** Pasek XP (`Poz. X • XP / próg`), wskaźnik Many obok HP/AP oraz przycisk `Postać [C]` z licznikiem/odznaką nieprzydzielonych punktów (`attributePoints + skillPoints > 0`).
- **Szuflada/Panel „Postać” (`isCharacterOpen`, klawisz `C`, `Esc` zamyka):**
  - Dwukolumnowy układ (`.character-workspace`) w stylu `.dark-fantasy-frame`:
    - **Lewa kolumna:** Portret, Poziom + pasek XP, zasoby (`HP`, `Mana`, `AP`), rozdział **5 Atrybutów** (`+` z czytelnym opisem wpływu na pochodne), **Statystyki Bojowe** (`Obrażenia`, `Kryt`, `Unik`, `DT/DR%`, `Inicjatywa`, `Udźwig`), oraz **Biegłości Broni** (4 paski 0–150%).
    - **Prawa kolumna:** **Drzewko Umiejętności** z 3 zakładkami ścieżek (*Witeź*, *Zwiadowca*, *Żerca Runiczny*), układem tierów 1→4 z liniami połączeń, kartą inspektora wybranego/najechanego węzła i przyciskiem **Odblokuj / Ulepsz** oraz **Resetuj rozwój (25 siek.)**.
- **Pasek Taktyczny Walki:** Sekcja przycisków odblokowanych zdolności aktywnych (wyświetla nazwę, koszt AP/Many, cooldown lub status gotowości; kliknięcie wybiera tryb celowania zdolnością lub natychmiast używa `Tchnienia Mokoszy`).

---

## 6. Zapis Gry (`saveSystem.ts`)
- `SerializedGameState.version = 2` z polem `progression?: CharacterProgressionState` oraz `mana`/`maxMana` w `player.combat`.
- Starsze zapisy (`version: 1` lub brak `progression`) ładują się bezbłędnie z domyślnym stanem Poziom 1, `0 XP`, pełną Maną.
