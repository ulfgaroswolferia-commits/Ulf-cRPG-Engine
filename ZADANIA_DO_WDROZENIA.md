# Przeniesione prompty i specyfikacja wdrożenia (`ulfRPG`)

> Plik przeniesiony z okna projektu `jakubgorski.com` (wszystkie polecenia wysłane po prompcie *„i umieść je pod widokiem wilka z tła, a stopka z adresdem na sam dol”*).

---

## 1. Oryginalne prompty użytkownika (w kolejności chronologicznej)

1. **Prompt 1 (Teksty przaśne i kolapsy słowne ładowane z assetu):**
   > `doczytaj assetowo teksty przaśne ala wiedzmin, pamietaj zastosować kolapsy typu : przegiales pale goryczy - czare królu - jaką kurwa znowu czare? - goryczy królu, goryczy! - AA tę czarę goryczy, kurwa? Nie łap mnie za słówka tępy chuju!`

2. **Prompt 2 (Brak praw autorskich / brak imion i nazw własnych z Wiedźmina):**
   > `omiń całkowicie klimat i imiona z wiedzmina bo nas będą sądzić jeszcze! reszta OK`

3. **Prompt 3 (Grywalna wioska + lokacja z walką jako demo 100% możliwości do `/dist/` oraz pełny edytor poziomów i otoczenia do `/dev/`):**
   > `stworz grywalą wiosję oraz lokację z walką jako demo pokazowe dając maks i 100% z tego co zrobilismy, do /dist/ daj paczke z grywalna wersją a do /dev/ dodatkowo pełny edytor poziomów i otoczenia zgodnie z wytycznymi silnika i assetów`

---

## 2. Gotowy wsad assetu dialogowego (`public/assets/dialogues/przasne_teksty.json`)

Poniższy JSON jest całkowicie wolny od jakichkolwiek nazw własnych, imion, miejsc i cech chronionych prawem autorskim (brak odniesień do Wiedźmina), a jednocześnie realizuje słowiański/pograniczny przaśny humor oraz wielostopniowe **kolapsy frazeologiczne**:

```json
{
  "version": "1.0.0",
  "title": "Księga Przaśnych Kolapsów i Gawęd Pogranicza",
  "description": "Asset dialogowy z przaśnymi tekstami oraz kolapsami frazeologicznymi (bez żadnych nawiązań do chronionych marek).",
  "kolapsy": [
    {
      "id": "kolaps_pala_goryczy",
      "npcId": "npc_gniewko",
      "title": "Pała czy czara goryczy?",
      "context": "Władca Pogranicza — Król Gniewomir — unosi się gniewem na posłańca po stracie wozu z prowiantem",
      "steps": [
        {
          "speaker": "Król Gniewomir",
          "role": "Suweren Pogranicza",
          "line": "Przegiąłeś pałę goryczy!"
        },
        {
          "speaker": "Kanclerz Sulisław",
          "role": "Doradca Dworski",
          "line": "Czarę, królu..."
        },
        {
          "speaker": "Król Gniewomir",
          "role": "Suweren Pogranicza",
          "line": "Jaką kurwa znowu czarę?!"
        },
        {
          "speaker": "Kanclerz Sulisław",
          "role": "Doradca Dworski",
          "line": "Goryczy, królu, goryczy!"
        },
        {
          "speaker": "Król Gniewomir",
          "role": "Suweren Pogranicza",
          "line": "AA tę czarę goryczy, kurwa? Nie łap mnie za słówka, tępy chuju!"
        }
      ]
    },
    {
      "id": "kolaps_skora_z_lasu",
      "npcId": "npc_dobromir",
      "title": "Skóra na niedźwiedziu z lasu",
      "context": "Kupiec Dobromir targuje się o futra przy straganie na rynku pod Światowidem",
      "steps": [
        {
          "speaker": "Kupiec Dobromir",
          "role": "Handlarz Bursztynem i Solą",
          "line": "Nie dziel wilka z lasu, póki skóra jeszcze w gawrze siedzi!"
        },
        {
          "speaker": "Wędrowiec",
          "role": "Najemnik z Pogranicza",
          "line": "Skóry na niedźwiedziu, gospodarzu..."
        },
        {
          "speaker": "Kupiec Dobromir",
          "role": "Handlarz Bursztynem i Solą",
          "line": "Jakim kurwa znowu niedźwiedziu?!"
        },
        {
          "speaker": "Wędrowiec",
          "role": "Najemnik z Pogranicza",
          "line": "Nie dzieli się skóry na niedźwiedziu, a z lasu to się wilka nie wywołuje!"
        },
        {
          "speaker": "Kupiec Dobromir",
          "role": "Handlarz Bursztynem i Solą",
          "line": "AA tę skórę na niedźwiedziu, kurwa?! Handlujesz ze mną czy będziesz mi tu gramatykę strugał, mądralo zajebany?!"
        }
      ]
    },
    {
      "id": "kolaps_gwozdz_w_plecy",
      "npcId": "npc_bozydar",
      "title": "Ostatni gwóźdź w plecy",
      "context": "Płatnerz Bożydar klnie przy kowadle na dłużnika, który nie zapłacił za kolczugę",
      "steps": [
        {
          "speaker": "Płatnerz Bożydar",
          "role": "Kowal Grodowy",
          "line": "Wbiłeś mi tym długiem ostatni gwóźdź w plecy!"
        },
        {
          "speaker": "Czeladnik",
          "role": "Pomocnik Kowala",
          "line": "Nóż w plecy, mistrzu, albo gwóźdź do trumny..."
        },
        {
          "speaker": "Płatnerz Bożydar",
          "role": "Kowal Grodowy",
          "line": "Jakiej kurwa znowu trumny?!"
        },
        {
          "speaker": "Czeladnik",
          "role": "Pomocnik Kowala",
          "line": "No gwóźdź wbija się do trumny, a w plecy to nóż!"
        },
        {
          "speaker": "Płatnerz Bożydar",
          "role": "Kowal Grodowy",
          "line": "AA ten gwóźdź do trumny, kurwa?! Zaraz ci młotem wbiję jedno i drugie w dupę, jak nie weźmiesz się za miechy!"
        }
      ]
    },
    {
      "id": "kolaps_krew_w_maliny",
      "npcId": "npc_vaelen",
      "title": "Krew w piach czy w maliny?",
      "context": "Kapitan Vaelen komentuje nieudany zwiad przy ognisku na Polanie Wilczego Ognia",
      "steps": [
        {
          "speaker": "Kapitan Vaelen",
          "role": "Zwiadowca Pogranicza",
          "line": "Cały nasz zwiad poszedł jak krew w maliny, bo ktoś wpuścił nas w piach!"
        },
        {
          "speaker": "Wędrowiec",
          "role": "Najemnik z Pogranicza",
          "line": "Jak krew w piach, kapitanie..."
        },
        {
          "speaker": "Kapitan Vaelen",
          "role": "Zwiadowca Pogranicza",
          "line": "Jaki kurwa znowu piach?! Tu jest czarnoziem i igliwie!"
        },
        {
          "speaker": "Wędrowiec",
          "role": "Najemnik z Pogranicza",
          "line": "Mówi się: krew w piach, a w maliny to się kogoś wpuszcza!"
        },
        {
          "speaker": "Kapitan Vaelen",
          "role": "Zwiadowca Pogranicza",
          "line": "AA tę krew w piach, kurwa?! Nie filozofuj mi tu przy ognisku, bo zaraz sam pójdziesz w maliny razem z zębami!"
        }
      ]
    }
  ]
}
```

---

## 3. Zakres prac w `C:\laragon\www\ulfRPG`

### A. System przaśnych dialogów i kolapsów (`src/rpg/dialogueSystem.ts`, `src/ui/hudOverlay.ts`)
- Zapisanie pliku `public/assets/dialogues/przasne_teksty.json` i asynchroniczne doczytywanie go przy starcie (`preloadPrzasneDialoguesAsset()`).
- Włączenie wielostopniowych drzewek dialogowych (gdzie gracz krok po kroku poprawia rozmówcę: *„Czarę, królu...”* -> *„Goryczy, królu, goryczy!”*) oraz rozwijanych sekcji typu accordion (`<details class="dialogue-collapse">`) w oknie dialogowym.

### B. Grywalna wioska (`slavic_village`) + lokacja z walką (`forest_clearing`) na 100% możliwości (`src/core/worldMap.ts`, `src/rpg/gameLoop.ts`)
- **Osada Żerców — Targowisko pod Światowidem (`slavic_village`, 32×32):**
  - Chaty kryte strzechą (`slavic_cottage`), kramy kupieckie (`market_stall`), studnia z żurawiem (`slavic_well`), ruszt targowy (`campfire` do pieczenia kiełbasy), chram Światowida na wzgórzu (`slavic_shrine`), plecione płoty (`wattle_fence`), drogowskaz podróży (`travel_signpost`).
  - Postacie NPC: **Król Gniewomir / Suweren Pogranicza** (`npc_gniewko` z kolapsem o *pale/czarze goryczy*), **Kupiec Dobromir** (`npc_dobromir`), **Płatnerz Bożydar** (`npc_bozydar`), **Żerca Radogost** (`npc_radogost`), **Drużynnik Miłosz** (`npc_milosz_patrol`).
- **Polana Wilczego Ognia (`forest_clearing`, 32×32):**
  - Centralne obozowisko z pieczeniem kiełbasy, wzgórze runiczne, ruiny strażnicy z otwieranymi drzwiami i wycinaniem ścian X-Ray, 9 wariantów drzew Glionox, pniaki, krzewy i kwiaty z normal-mapami PBR.
  - Pełny pokaz turowego systemu walki V.A.T.S. / AP z 3 poziomami trudności przeciwników:
    - 🟢 Łatwy (`enemy_bandit_easy` — *Zdziczały Maruder Szlaku*),
    - 🟡 Normalny (`enemy_mercenary_normal` — *Najemny Wiarus z Jaru*),
    - 🔴 Bardzo trudny (`enemy_dread_champion_hard` — *Upadły Czempion Aethelgardu*).

### C. Pełny edytor poziomów i otoczenia w `/dev/` (`src/ui/inspectorPanel.ts`, `src/renderer/isoSceneView.ts`)
- Rozbudowa `InspectorPanel` (aktywowanego w buildzie `npm run build:dev` -> `/dev/` oraz z parametrem `?dev=1`) o kompletny edytor zgodny z wytycznymi silnika i assetów:
  1. **Malowanie terenu (`paint_terrain`):** wszystkie 9 typów `TileTerrainType` (`forest_grass`, `dirt_path`, `forest_soil`, `mossy_cobble`, `dungeon_stone`, `sanctum_marble`, `arcane_inlay`, `stairs_stone`, `abyss_water`) + przełącznik `walkable` i rozmiar pędzla (`1×1`, `3×3`).
  2. **Rzeźbienie wysokości (`raise_elevation`, `lower_elevation`, `flatten_elevation`):** edycja `Z` (`0..4`).
  3. **Katalog obiektów i assetów Glionox / Slavic (`place_prop`, `remove_prop`):**
     - wybór dowolnego `PropKind` (drzewa `0..8`, pniaki `0..8`, krzewy `0..7`, kwiaty `0..31`, chaty słowiańskie, stragany, posąg Światowida, studnia, płoty, mury, kolumny, drzwi, skrzynie, ogniska, namioty),
     - wybór wariantu sprite'a (`variant`) oraz orientacji wielopolowej (`1×1`, `2×1`, `1×2`),
     - narzędzie usuwania obiektów z kafelka (`remove_prop`).
  4. **Edytor oświetlenia PBR (`place_torch_light`, `place_arcane_light`, `remove_light`):** stawianie i usuwanie świateł punktowych, suwak Ambient Light, przełączniki Fog of War, Wall Cutaway X-Ray oraz podgląd buforów G-Buffer (`final`, `albedo`, `normal`, `height`, `lightAccum`).
  5. **Spawner NPC i Przeciwników (`spawn_npc`, `spawn_enemy`):** umieszczanie NPC i wrogów (`easy`, `normal`, `very_hard`) na wskazanym kafelku.
  6. **Eksport / Import / Reset mapy (`export_map_json`, `reset_map`):** eksport zmodyfikowanego poziomu do pliku JSON lub schowka.

### D. Budowanie paczek wynikowych
- `/dist/` — czysta grywalna wersja pokazowa:
  ```bash
  npm run build
  ```
- `/dev/` — wersja z pełnym edytorem poziomów, otoczenia, oświetlenia i diagnostyką G-Buffera:
  ```bash
  npm run build:dev
  ```
