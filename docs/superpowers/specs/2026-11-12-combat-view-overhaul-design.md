# Specyfikacja Projektowa: Nowy Widok Walki i Dziennika Bojowego (Combat View Overhaul)

**Data:** 2026-11-12  
**Status:** Zatwierdzony do implementacji  
**Ścieżka:** Architectural (Superpowers Brainstorming)

---

## 1. Cel i Diagnoza Problemu
Dotychczasowy widok walki (`.combat-tactical-bar`) unosił się na wysokości `bottom: 138px` na środku ekranu. Po rozwinięciu panelu zaawansowanego celowania anatomicznego (`.combat-veteran-panel`), okno rozrastało się mocno w pionie i zasłaniało walczące postacie, kafelki pola bitwy oraz animacje i napisy pływające (floating combat text). Ponadto podczas walki w prawym dolnym rogu wyświetlała się ogólna kronika świata, a szczegółowe rzuty kością i kalkulacje DT/DR były ukryte lub mało czytelne.

### Główne Założenia Nowego Rozwiązania:
1. **Odsłonięcie pola bitwy**: Cały interfejs walki zostaje przyklejony do dołu ekranu jako integralny dolny panel taktyczny.
2. **Zaawansowane Celowanie Anatomiczne na 1 akcję/turę**: Wysuwka taktyczna umieszczona tuż nad belką akcji z wyraźnym przyciskiem zachęcającym do użycia. Po wybraniu uderzenia lub zakończeniu tury panel automatycznie się zwija, odsłaniając animację ciosu.
3. **Dedykowany Dziennik Walki (Live Combat Log)**: W trakcie starcia zajmuje miejsce w prawym dolnym rogu (zastępując ogólną kronikę). Zapewnia natychmiastowy wgląd w każdy atak, obrażenia, absorpcję pancerza DT/DR, uniki i statusy z wyrazistym kodowaniem kolorystycznym.
4. **Płynne przejście po walce**: Po zakończeniu walki interfejs automatycznie wraca do widoku eksploracji, a do Kroniki Wydarzeń trafia wpis podsumowujący z przyciskiem `📜 Raport`.

---

## 2. Architektura Interfejsu i Układ Elementów

### 2.1 Struktura DOM (`.bottom-hud.combat-mode-active`)
W trybie walki (`game.combatState.active === true`), dolna belka HUD reorganizuje się w układ 3-strefowy:

```
+-------------------------------------------------------------------------------------------------------+
|  [POLE BITWY - W 100% WIDOCZNE I ODSŁONIĘTE DLA POSTACI, ANIMACJI I KAMERY]                          |
|                                                                                                       |
|                       [WYSUWKA CELOWANIA ANATOMICZNEGO - TYLKO GDY [V] AKTYWNE]                       |
|                       +-------------------------------------------------------+                       |
|                       |  GŁOWA (Ogłuszenie) | KORPUS (Penetracja) | NOGI (Spowolnienie) |              |
|                       +-------------------------------------------------------+                       |
+-------------------------------------------------------------------------------------------------------+
| HERO CARD            | COMBAT TACTICAL DOCK (Środek/Lewo)       | LIVE COMBAT LOG (Prawo)             |
| - Portret            | - Runda & Kto ma turę                    | - Tytuł: ⚔️ Dziennik Walki (Cel)    |
| - Pancerz & Atak     | - Cel: HP, Pasek, Przełączanie wrogów   | - Wpisy z kolorowaniem:             |
| - HP & AP            | - Pasek AP (Orbiki) & Dystans            |   * 💥 KRYTYK (złoto/czerwień)      |
| - Szybkie akcje      | - [1] Szybki Cios | [2] Silny Cios       |   * 🗡️ Trafienie (obrażenia, DT/DR) |
|                      | - [3] Obrona (+Garda)                    |   * 💨 Pudło / Unik (szaro-błękit)  |
|                      | - 🎯 Celowanie [V] (Przycisk ze złotem)  |   * 💫 Statusy (ogłuszenie itp.)    |
|                      | - [Spacja] Koniec Tury | [Odwrót]        |   * 🏆 Pokonano wroga               |
+-------------------------------------------------------------------------------------------------------+
```

### 2.2 Wysuwka Zaawansowanego Celowania (Auto-Collapse Drawer)
- Przycisk aktywacyjny: `.combat-aim-toggle-btn` z ikoną `🎯 Celowanie Anatomiczne [V]` i złotym wyróżnikiem.
- Po kliknięciu lub wciśnięciu klawisza `V`: wysuwa się kompaktowy panel (3 karty: Głowa, Korpus, Nogi) zadokowany tuż nad belką bojową.
- **Auto-zwijanie**: Wykonanie ataku celowanego natychmiast przestawia `this.isCombatAdvancedOpen = false` i renderuje widok, dzięki czemu gracz od razu widzi efekt ataku na mapie.

### 2.3 Dedykowany Dziennik Walki (Live Combat Log)
- Zastępuje `.chronicle-log` na czas trwania walki.
- Posiada opcję przełączenia na kronikę świata (mała zakładka u góry), lecz domyślnie pokazuje bieżące wydarzenia starcia.
- Każdy wpis w dzienniku posiada dedykowaną klasę:
  - `.combat-entry-crit` — złota ramka, ikona 💥, wyraźna liczba obrażeń.
  - `.combat-entry-hit` — ikona 🗡️, liczba obrażeń, informacja o pochłonięciu przez DT/DR.
  - `.combat-entry-miss` — ikona 💨, szansa procentowa i rzut kością.
  - `.combat-entry-status` — ikona 💫/🩸, nałożony debuff.
  - `.combat-entry-defend` — ikona 🛡️, wejście w gardę.
  - `.combat-entry-victory` — ikona 🏆, nagroda i XP.

---

## 3. Zmiany w Kodzie i Plikach

1. **`src/ui/hudOverlay.ts`**:
   - Warunkowe renderowanie: w trybie walki zamiast standardowej kroniki renderowany jest `buildCombatLiveLogHtml()`.
   - Modyfikacja `buildCombatOverlayHtml()`: belka taktyczna zostaje zakotwiczona w dolnym panelu (`bottom-hud`), a wysuwka celowania anatomicznego posiada auto-collapse po kliknięciu uderzenia.
   - Obsługa klawisza `V`, `1`, `2`, `3`, `Spacja` z zachowaniem auto-zwijania celowania.
2. **`src/styles/main.css`**:
   - Nowy layout flex dla `.bottom-hud.combat-mode-active`.
   - Style dla `.combat-tactical-bar` w dolnym doku (kompaktowa wysokość, brak zasłaniania środka ekranu).
   - Style dla wysuwki `.combat-veteran-drawer`.
   - Style dla `.combat-live-log` i klas wpisów (`.combat-entry-*`).
3. **`tests/rpg/combatSystem.test.ts` / `tests/ui/`**:
   - Testy sprawdzające obecność Dziennika Walki w trakcie aktywnej walki oraz auto-zwijanie panelu celowania.

---

## 4. Weryfikacja i Kryteria Akceptacji
- [ ] Środek ekranu w trakcie walki jest w 100% odsłonięty — widać postać gracza i przeciwników.
- [ ] Otwarcie zaawansowanego celowania ([V]) pokazuje estetyczną wysuwkę tuż nad belką, która po wykonaniu ataku natychmiast się zwija na tę turę.
- [ ] Po prawej stronie w trakcie walki działa czytelny Dziennik Walki z kolorowaniem ciosów, uników, krytyków i redukcji DT/DR.
- [ ] Po zakończeniu walki interfejs wraca płynnie do standardowej Kroniki Wydarzeń z zarejestrowanym raportem z walki.
- [ ] Wszystkie istniejące i nowe testy jednostkowe (`npm test`) przechodzą pomyślnie.
