# Specyfikacja Techniczna: System Ekwipunku i Porównywania Przedmiotów (cRPG)

Niniejszy dokument stanowi specyfikację architektury silnika ekwipunku, statystyk postaci oraz modułu porównywania przedmiotów (Item Comparison Tooltip) dla gry z gatunku cRPG. Zaprojektowany z myślą o modularności, wzorcach architektonicznych (Flyweight, Event-Driven, Data-Oriented) i łatwej integracji w środowiskach takich jak Unity, Godot, Unreal Engine lub custom engine w C#/C++/TypeScript.

---

## 1. Architektura Danych Przedmiotów (Data Modeling)

Zastosowanie wzorca **Flyweight** w celu separacji niezmiennych danych definicji przedmiotu od jego unikalnej instancji w świecie/ekwipunku gracza.

### 1.1. Definicja Statyczna (`ItemDefinition`)
Niezmienna konfiguracja (np. ScriptableObject w Unity, Resource w Godot lub JSON):
* `id` (`string` / `Guid`): Unikalny identyfikator bazy danych (np. `wpn_iron_longsword_01`).
* `name` (`string`): Nazwa wyświetlana.
* `description` (`string`): Opis fabularny/mechaniczny.
* `itemType` (`ItemType`): Enum (`Weapon`, `Armor`, `Consumable`, `Trinket`, `Quest`).
* `equipSlot` (`EquipSlot`): Domyślny slot (`MainHand`, `OffHand`, `TwoHanded`, `Chest`, `Head`, `Ring`, `None`).
* `rarity` (`ItemRarity`): Enum (`Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`).
* `maxStack` (`int`): 1 dla wyposażenia, >1 dla przedmiotów zużywalnych/surowców.
* `weight` (`float`): Udźwig pojedynczej sztuki.
* `baseModifiers` (`List<StatModifier>`): Domyślne wartości bojowe i cechy.
* `requirements` (`List<EquipRequirement>`): Wymagania (np. `Attribute.Strength >= 14`, `Level >= 3`).

### 1.2. Instancja Dynamiczna (`ItemInstance`)
Obiekt istniejący w pamięci gry i serializowany do pliku zapisu stanu (SaveGame):
* `instanceId` (`Guid` / `ulong`): Unikalny identyfikator konkretnego egzemplarza.
* `definitionId` (`string`): Referencja do `ItemDefinition`.
* `stackCount` (`int`): Aktualna liczba w slocie.
* `currentDurability` (`float`): Opcjonalna wytrzymałość sprzętu.
* `dynamicModifiers` (`List<StatModifier>`): Dodatkowe statystyki z afiksów, enchantingu, klejnotów (Gems).

---

## 2. System Statystyk i Kalkulacji Modyfikatorów

### 2.1. Typy modyfikatorów
Aby uniknąć niejednoznaczności kolejności obliczeń, modyfikatory dzielimy na 3 ścisłe kategorie:
1. **Flat:** Dodaje stałą wartość (np. $+15$ obrażeń, $+5$ pancerza).
2. **PercentAdd:** Procent addytywny sumowany z innymi tego samego typu (np. $+10\%$ siły, $+5\%$ siły daje łącznie $+15\%$ do bazowej).
3. **PercentMult:** Mnożnik końcowy nakładany iloczynowo (np. klątwy lub unikalne perki: $\times 0.8$ lub $\times 1.2$).

### 2.2. Wzór Matematyczny
Dla danej statystyki $S$ wartość końcowa wyliczana jest ze wzoru:

$$\text{FinalStat} = \left( \text{Base} + \sum \text{Flat} \right) \times \left(1 + \sum \text{PercentAdd} \right) \times \prod (1 + \text{PercentMult})$$

### 2.3. Struktura `StatModifier`
```csharp
public enum StatType
{
    HealthMax,
    ManaMax,
    PhysicalDamage,
    ArmorRating,
    Strength,
    Agility,
    Intelligence,
    CriticalStrikeChance,
    MovementSpeed
}

public enum ModifierType
{
    Flat = 100,
    PercentAdd = 200,
    PercentMult = 300
}

public struct StatModifier
{
    public StatType TargetStat;
    public float Value;
    public ModifierType Type;
    public object Source; // Referencja do ItemInstance lub BuffID (ułatwia czyszczenie)
}
```

---

## 3. Kontenery: Plecak i Zarządzanie Ekwipunkiem

### 3.1. `InventoryContainer` (Plecak / Skrytka)
* Przechowuje kolekcję slotów: `List<InventorySlot>`.
* Obsługuje limity pojemności: maksymalna liczba slotów (grid/lista) oraz limit udźwigu (`CurrentWeight <= MaxWeight`).
* Podstawowe operacje:
  * `bool TryAddItem(ItemInstance item)`
  * `bool RemoveItem(Guid instanceId, int count)`
  * `void SplitStack(int slotIndex, int splitCount)`
  * `void SwapSlots(int fromIndex, int toIndex)`

### 3.2. `EquipmentManager` (Założony rynsztunek)
* Przechowuje słownik `Dictionary<EquipSlot, ItemInstance>`.
* Obsługa przypadków specjalnych:
  * **Broń dwuręczna (`TwoHanded`):** Założenie w `MainHand` automatycznie blokuje lub przenosi przedmiot z `OffHand` z powrotem do plecaka.
  * **Podwójne sloty (np. Pierścienie: `Ring1`, `Ring2`):** Obsługa wyboru slotu do zamiany (domyślnie na pusty lub na słabszy z pary).

---

## 4. Silnik Porównywania Przedmiotów (Item Comparison Engine)

Tooltip porównawczy analizuje dwa poziomy:
1. **Direct Delta:** Bezpośrednia różnica statystyk przedmiotu wskazanego kursorem (`CandidateItem`) względem założonego (`EquippedItem`).
2. **Character Impact Delta:** Wpływ wymiany na ogólne statystyki bojowe postaci (w tym statystyki pochodne, np. $\text{Siła} \to \text{Obrażenia} + \text{Udźwig}$).

### 4.1. Algorytm wyliczania delty bezpośredniej

```text
Dla każdego statType w Unii(CandidateItem.Stats, EquippedItem.Stats):
    CandidateVal = Suma(CandidateItem.Modifiers(statType))
    EquippedVal = Suma(EquippedItem.Modifiers(statType))
    Delta = CandidateVal - EquippedVal
    Zwróć wpis: { statType, EquippedVal, CandidateVal, Delta }
```

### 4.2. Algorytm symulacji wpływu na postać (Stat Simulation)
1. Klonowanie aktualnego stanu modyfikatorów postaci do obiektu `TransientStatSheet`.
2. Usunięcie z `TransientStatSheet` wszystkich modyfikatorów, których źródłem jest `EquippedItem`.
3. Wstrzyknięcie modyfikatorów pochodzących z `CandidateItem`.
4. Przeliczenie wszystkich statystyk pochodnych.
5. Obliczenie różnic w statystykach globalnych:
   $$\Delta_{\text{Postać}} = \text{Wartość}_{\text{Symulowana}} - \text{Wartość}_{\text{Bieżąca}}$$

---

## 5. Przepływ Danych i Architektura Zdarzeniowa

Aby zachować zasadę pojedynczej odpowiedzialności (SRP), UI nie modyfikuje bezpośrednio stanu postaci ani ekwipunku:

```
[UI Tooltip Hover]
       │
       ▼
[ComparisonService.Compare(slot, candidateItem)]
  ├── Pobiera EquippedItem z EquipmentManager
  ├── Symuluje CharacterStatSheet
  └── Generuje ComparisonResultDTO
       │
       ▼
[UI Tooltip Renderer] (Wyświetla kolory: zielony dla upgrade, czerwony dla downgrade)


[UI Equip Click]
       │
       ▼
[EquipmentManager.Equip(candidateItem, targetSlot)]
  ├── Sprawdza EquipRequirement
  ├── Dokonuje zamiany w slotach
  └── Wywołuje zdarzenie: OnEquipmentChanged(slot, oldItem, newItem)
       │
       ▼
[CharacterStatController]
  ├── Obsługuje OnEquipmentChanged
  ├── Rejestruje nowe modyfikatory, usuwa stare
  ├── Przelicza FinalStats
  └── Wywołuje zdarzenie: OnStatsChanged(updatedStatsMap)
       │
       ▼
[UI Character Sheet / HUD] (Odświeżenie pasków życia, DPS, pancerza)
```

---

## 6. Referencyjna Implementacja w C# (Core Services)

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class ComparisonResult
{
    public StatType Type { get; set; }
    public float CurrentValue { get; set; }
    public float NewValue { get; set; }
    public float Delta => NewValue - CurrentValue;
    public bool IsUpgrade => Delta > 0;
}

public static class ItemComparisonEngine
{
    public static List<ComparisonResult> GenerateComparison(ItemInstance equipped, ItemInstance candidate)
    {
        var results = new List<ComparisonResult>();
        var statTypes = new HashSet<StatType>();

        if (equipped != null)
            statTypes.UnionWith(equipped.GetAllModifiers().Select(m => m.TargetStat));
        if (candidate != null)
            statTypes.UnionWith(candidate.GetAllModifiers().Select(m => m.TargetStat));

        foreach (var stat in statTypes)
        {
            float currentSum = equipped?.GetTotalStatValue(stat) ?? 0f;
            float newSum = candidate?.GetTotalStatValue(stat) ?? 0f;

            results.Add(new ComparisonResult
            {
                Type = stat,
                CurrentValue = currentSum,
                NewValue = newSum
            });
        }

        return results;
    }
}
```

---

## 7. Wskazówki Implementacyjne dla Agentów CLI (Dev Checklist)

Podczas implementacji kolejnych modułów za pomocą agentów AI w CLI, realizuj zadania w następującej kolejności:
- [ ] **Krok 1:** Zbudowanie niezależnych struktur `StatModifier` oraz kontenera `CharacterStat` z formułą obliczeń.
- [ ] **Krok 2:** Utworzenie bazy danych `ItemDefinition` i klasy runtime `ItemInstance`.
- [ ] **Krok 3:** Implementacja kontenerów `InventoryContainer` i `EquipmentManager` z logiką ograniczeń dwuręcznych.
- [ ] **Krok 4:** Implementacja `ItemComparisonEngine` zwracającego czyste obiekty DTO dla UI.
- [ ] **Krok 5:** Spięcie zdarzeń (`event Action`) pomiędzy zmianami ekwipunku a przeliczaniem arkusza postaci.