# Wzorzec aktualizacji silnika (`Ulf-cRPG-Engine` → `ostrze`)

Repozytorium gry **`ostrze`** korzysta z silnika **`Ulf-cRPG-Engine`** (rozwijanego w katalogu `RPG2`) jako **git submodule** pod ścieżką `ostrze/engine/` (gałąź `main`). Dzięki temu każdy commit w `ostrze` na stałe przypina dokładną, wypchniętą na GitHub wersję silnika.

> **Złota zasada:** Najpierw wypchnij zmiany silnika z `RPG2` na `origin/main`, a dopiero potem zaktualizuj wskaźnik submodule w `ostrze`. Nie edytuj plików silnika bezpośrednio w `ostrze/engine/`.

---

## 1. Zmiany i publikacja w silniku (`RPG2`)

W katalogu `C:\Users\jgorski\Projekty\RPG2`:

```powershell
# 1. Zweryfikuj build i testy silnika
npm run build
npm test

# 2. Zrób commit zmian silnika
git add -A
git commit -m "feat(...): opis zmian w silniku"

# 3. Wypchnij na GitHub (warunek konieczny przed aktualizacją ostrze!)
git push origin main
```

---

## 2. Aktualizacja silnika w grze (`ostrze`)

W katalogu `C:\Users\jgorski\Projekty\ostrze`:

```powershell
# 1. Pobierz najnowszy commit z origin/main silnika do katalogu engine/
git submodule update --remote engine

# 2. Zweryfikuj build i testy gry z nową wersją silnika
npm run build
npm test

# 3. Zapisz nowy wskaźnik commita silnika w historii ostrze
git add engine
git commit -m "chore: bump Ulf-cRPG-Engine submodule"
git push origin main
```

---

## 3. Świeże klonowanie `ostrze` (nowa maszyna / nowy katalog)

```powershell
git clone --recurse-submodules https://github.com/ulfgaroswolferia-commits/ostrze.git
```

Jeśli repozytorium zostało już sklonowane bez flagi `--recurse-submodules`:

```powershell
git submodule update --init --recursive
```

---

## 4. Przydatne komendy diagnostyczne (w `ostrze`)

- **Sprawdzenie aktualnie przypiętego commita silnika:**
  ```powershell
  git submodule status
  ```
- **Przywrócenie katalogu `engine/` do wersji przypiętej w bieżącym commicie `ostrze` (np. po przełączeniu gałęzi lub `git pull`):**
  ```powershell
  git submodule update --init
  ```
- **Powiązania konfiguracyjne w `ostrze`:**
  - `.gitmodules` — definicja submodule `engine` (`branch = main`)
  - `tsconfig.json` — alias `@ulf/*` → `./engine/src/*`
  - `vite.config.ts` — `publicDir: engine/public`, alias `@ulf` → `engine/src`
  - `vitest.config.ts` — `engine/**` wykluczone z testów gry
