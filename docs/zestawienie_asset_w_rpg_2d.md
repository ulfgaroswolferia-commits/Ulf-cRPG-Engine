# Zestawienie Darmowych Assetów: Słowiańskie Fantasy RPG 2D (Rzut Izometryczny)

Dokument stanowi bazę do analizy i planowania warstwy graficznej gry RPG w rzucie izometrycznym (2.5D / dimetrycznym) z naciskiem na motywy słowiańskie, wczesnośredniowieczne i folk.

---

## 1. Postacie: Grywalne (PC) oraz Niezależne (NPC)

### Flare RPG Project
* **Źródło:** OpenGameArt.org / Flare Engine repository
* **Format:** Arkusze sprite'ów 2D (prerenderowane 3D $\to$ 2D).
* **Animacje:** Pełne 8 kierunków (idle, walk, run, attack, cast, die/hurt).
* **Styl:** Surowe, stonowane średniowiecze (tuniki, proste zbroje lamelkowe, kolczugi, kłobuki, topory, tarcze migdałowe i okrągłe).
* **Przydatność:** Doskonała baza pod woja, łowcę, prostego zbrojnego czy wędrowca.
* **Licencje:** CC-BY-SA 3.0 / GPL 3.0 (wymaga weryfikacji per paczka).

### SR0_Games – Isometric Character Sprite Sheet
* **Źródło:** itch.io
* **Format:** Sprite sheet 8-kierunkowy.
* **Animacje:** Idle, walk, attack.
* **Styl:** Prosty, czytelny pixel art / stylizowany rzut izometryczny.
* **Przydatność:** Baza pod neutralnych mieszkańców wiosek i żołnierzy; łatwa do modyfikacji piksel po pikselu (palette swap, dodanie krajki/haftu).
* **Licencja:** CC0 (Public Domain).

### Universal LPC Character Generator (Zastosowanie hybrydowe)
* **Źródło:** Liberated Pixel Cup (LPC) / OpenGameArt
* **Format:** Modularne sprite'y (ubrania, zarosty, włosy nakładane warstwowo).
* **Styl:** Klasyczny pixel art 16/32-bit.
* **Zalety:** Ogromny wybór słowiańsko wyglądających elementów: lniane koszule z przewiązaniem, łapcie, futrzane kamizelki, gęste brody, warkocze, wianki.
* **Ograniczenie:** Rzut domyślny to top-down 3/4. Wymaga adaptacji kąta kamery lub wykorzystania głównie do statycznych NPC i dialogów.
* **Licencja:** CC-BY-SA / GNU GPL.

---

## 2. Elementy Świata, Bestiariusz i Przedmioty Folklorystyczne

| Kategoria | Rekomendowane źródła | Kluczowe elementy |
| :--- | :--- | :--- |
| **Budownictwo i Otoczenie** | Gorjana Kalevska (itch.io), OpenGameArt (`slavic`, `medieval village`) | Chaty zrębowe (bale), dachy kryte strzechą, piece chlebowe, płoty z chrustu, drewniane pale i kapliczki. |
| **Bestiariusz** | Redshrike / Stephen Challener (OpenGameArt) | Wilki, dziki, biesy, lesze (leśne duchy), utopce/wodniki, szkielety w resztkach uzbrojenia. |
| **Przedmioty i UI** | Moonfern Assets (itch.io), Pixel Curse | Ikony ziół (piołun, dziurawiec), amulety (lunule, kołowroty), lalki motanki, wianki, gliniane dzbany. |

---

## 3. Różnicowanie Stylu: Jak przekształcić ogólne średniowiecze w słowiański folk?

1. **Paleta barw:**
   * Naturalne, ziemiste tony: surowy len, brązy, mchy, zieleń iglasta.
   * Kontrastujące akcenty rytualne: biel i czerwień (tradycyjne słowiańskie hafty i krajki).
2. **Atrybuty postaci:**
   * *NPC wieśniacy:* Łapcie (obuwie z łyka), zapaski, lniane giezła przewiązane sznurem, kłobuki filcowe.
   * *Żercy / Wołchwowie:* Długie siwe brody, kije z rzeźbionymi głowami bóstw, motanki, wieńce ziołowe.
   * *Wojowie:* Szyszaki, topory z wąsatym żeleźcem, okrągłe tarcze drewniane z okuciem, kaftany pikowane.

---

## 4. Rekomendowany Pipeline: Prerender 3D do 2D (Alternatywa dla braku assetów)

W przypadku braku konkretnych animacji NPC w 8 kierunkach, najszybszą i najbardziej spójną metodą w branży indie jest renderowanie modeli 3D do sprite sheetów 2D:

1. **Pobranie modelu:** Darmowe bazy CC0/CC-BY (np. Mixamo, Sketchfab) pod hasłami: *medieval peasant*, *slavic warrior*, *viking*.
2. **Animacja:** Wykorzystanie standardowych rigów i animacji z Mixamo (idle, walk, attack).
3. **Ustawienie sceny w Blenderze:**
   * Kamera: **Orthographic**.
   * Kąt izometryczny (dimetria 2:1): Rotacja $X = 60^\circ$ (lub $54.736^\circ$ dla klasycznej izometrii), $Z = 45^\circ$.
4. **Automatyzacja:** Skrypt generujący 8 rzutów kamery (co $45^\circ$ obrotu osi $Z$) renderujący do klatek `.png` w docelowej rozdzielczości (np. $64 \times 64$ lub $128 \times 128$).
5. **Post-processing:** Skalowanie z filtrem najbliższego sąsiada (Nearest Neighbor) lub shader pixel artu dla uzyskania retro estetyki.