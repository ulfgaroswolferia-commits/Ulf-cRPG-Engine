# Ulf-cRPG-Engine — Twórcy, Licencje i Atrybucja Prawna (Credits & Legal Notices)

Niniejszy dokument stanowi kompletne, formalne zestawienie autorów, źródeł oraz licencji wszystkich zasobów (graficznych, dźwiękowych, typograficznych oraz programistycznych) wykorzystanych w grze i silniku **Ulf-cRPG-Engine**.

Wszystkie użyte zasoby podlegają wolnym licencjom (Open Source / Free Cultural Works), umożliwiającym darmowe rozpowszechnianie, uruchamianie, adaptację oraz publikację gry.

---

## 1. Projekt Gry i Silnik (Engine & Game Core)

* **Projekt:** Ulf-cRPG-Engine (2.5D Isometric Slavic cRPG Engine)
* **Autor / Główny Programista:** Jakub Górski (poczta@jakubgorski.com)
* **Licencja:** MIT License
* **Repozytorium:** RPG2 / Ulf-cRPG-Engine

```text
MIT License

Copyright (c) 2026 Jakub Górski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Grafika Otoczenia i Teren (2D Environment Sprites & Tileset)

### Glionox — Top-down Forest Tileset + Demo
* **Autor:** Glionox
* **Źródło:** [https://glionox.itch.io/top-down-forest-tileset](https://glionox.itch.io/top-down-forest-tileset)
* **Katalog w projekcie:** `public/assets/glionox/` (`forest_trees.png`, `forest_stumps.png`, `forest_env.png`, `forest_tileset.png`)
* **Warunki licencyjne:**
  * Dozwolone bezpłatne i komercyjne użycie w projektach gier (*"Use as you want in free and commercial projects"*).
  * Dozwolona dowolna modyfikacja assetów na potrzeby projektu.
  * Uznanie autorstwa (atrybucja) w napisach gry.
  * Zakaz odsprzedaży i redystrybucji surowej paczki z grafikami poza kontekstem gry.

---

## 3. Izometryczne Grafiki Świata i Budynków (OpenGameArt.org)

Zasoby graficzne zoptymalizowane pod rzut izometryczny 2.5D, pobrane z serwisu **OpenGameArt.org** i wykorzystywane w katalogu `public/assets/oga/`:

### A. Izometryczne Chaty z Bali (Isometric Log Cabins)
* **Plik:** `public/assets/oga/oga_cabins.png` (16 wariantów chat, krytych strzechą i gontem)
* **Autorzy / Źródło:** Społeczność OpenGameArt.org (m.in. Surt, Clint Bellanger)
* **Źródło:** [https://opengameart.org/content/isometric-log-cabins](https://opengameart.org/content/isometric-log-cabins)
* **Licencja:** Creative Commons Attribution (CC-BY 3.0 / 4.0) / OGA-BY 3.0 / CC0

### B. Izometryczne Drzewa (Isometric Trees)
* **Plik:** `public/assets/oga/oga_trees.png` (warianty bujne, iglaste oraz uschnięte drzewa bagienne)
* **Autorzy / Źródło:** Yar, Hyptosis, OpenGameArt.org contributors
* **Źródło:** [https://opengameart.org/content/isometric-trees-1](https://opengameart.org/content/isometric-trees-1)
* **Licencja:** CC-BY 3.0 / CC0

### C. Płoty, Palisady i Obiekty Otoczenia (Graveyard Fence & Props)
* **Plik:** `public/assets/oga/oga_props_fence.png` (bramy, płoty żeliwne, latarnie, kamienne studnie, skrzynie)
* **Autorzy / Źródło:** OpenGameArt.org contributors
* **Źródło:** [https://opengameart.org/](https://opengameart.org/)
* **Licencja:** CC-BY 3.0 / CC0 / OGA-BY

### D. Kafelki Terenu, Klify i Zarośla (Updated Grassland Tileset Stylized)
* **Pliki:** `public/assets/oga/oga_terrain_tiles.png`, `public/assets/oga/oga_cliffs_foliage.png`
* **Autorzy / Źródło:** OpenGameArt.org contributors
* **Źródło:** [https://opengameart.org/content/updated-grassland-tileset-stylized](https://opengameart.org/content/updated-grassland-tileset-stylized)
* **Licencja:** CC-BY 3.0 / CC0 / OGA-BY

---

## 3B. Izometryczne Podziemia, Lochy i Jaskinie (Kenney Isometric Dungeon)

Zasoby graficzne modułowych lochów, jaskiń i podziemi izometrycznych:
* **Katalog w projekcie:** `public/assets/dungeon/` (ściany kamienne, bramy, drzwi, kolumny, beczki, skrzynie, podziemne korytarze)
* **Autor:** Kenney (Kenney Vleugels — [https://kenney.nl](https://kenney.nl))
* **Źródło:** [OpenGameArt.org / Isometric Miniature Dungeon](https://opengameart.org/content/isometric-miniature-dungeon) oraz [Kenney.nl](https://kenney.nl)
* **Licencja:** Creative Commons Zero (CC0 1.0 Universal — Public Domain)
* **Warunki licencyjne:** Całkowicie wolne do użytku prywatnego, edukacyjnego i komercyjnego bez wymogu formalnej atrybucji.

---

## 4. Portrety Postaci i Grafika Wektorowa (Procedural & Vector Art)

* **Plik:** `src/assets/slavicPortraits.ts`
* **Wykonanie:** Autorski kod generatora wektorowego SVG z mosiężnymi tłoczonymi ramami w stylu słowiańskiego dark fantasy.
* **Licencja:** MIT License (integralna część projektu).

---

## 5. Typografia i Fonty (Fonts)

W projekcie wykorzystano bezpłatne kroje pisma dystrybuowane przez Google Fonts:

* **Cinzel:** Autor: Natanael Gama — Licencja: [SIL Open Font License 1.1](https://openfontlicense.org/)
* **Inter:** Autor: Rasmus Andersson — Licencja: [SIL Open Font License 1.1](https://openfontlicense.org/)
* **JetBrains Mono:** Autor: JetBrains — Licencja: [Apache 2.0 / SIL Open Font License 1.1](https://openfontlicense.org/)

---

## 6. Biblioteki Programistyczne (Libraries & Frameworks)

* **PixiJS v8** (`pixi.js`):
  * Copyright (c) 2013-2026 Mathew Groves, Chad Engler, PixiJS Community
  * Licencja: MIT License
* **Vite:**
  * Copyright (c) 2019-present Yuxi (Evan) You and Vite contributors
  * Licencja: MIT License
* **TypeScript:**
  * Copyright (c) Microsoft Corporation
  * Licencja: Apache License 2.0
* **Vitest:**
  * Copyright (c) 2021-present Anthony Fu and Vitest contributors
  * Licencja: MIT License

---

## 7. Informacja o Licencji Creative Commons Attribution (CC-BY 3.0)

Wersja skrócona warunków licencji CC-BY 3.0:
* **Wolno:** dzielić się utworem (kopiować, rozpowszechniać w dowolnym medium) oraz adaptować (remiksować, przetwarzać, tworzyć na jego bazie) do dowolnych celów, także komercyjnych.
* **Pod warunkiem:** odpowiedniego uznania autorstwa (atrybucji), podania odnośnika do licencji oraz wskazania, jeśli zostały dokonane zmiany.
* Pełny tekst licencji: [https://creativecommons.org/licenses/by/3.0/legalcode](https://creativecommons.org/licenses/by/3.0/legalcode)
