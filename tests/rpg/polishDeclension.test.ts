import { describe, expect, it } from 'vitest';
import {
  accusative,
  dative,
  declinePolish,
  genitive,
  instrumental
} from '../../src/rpg/polishDeclension';

describe('polishDeclension Engine (Grammatical cases for Polish RPG entities)', () => {
  it('correctly declines standard archetype names (e.g. Bandyta, Wilk, Bies)', () => {
    // Bandyta
    expect(declinePolish('Bandyta', 'mianownik')).toBe('Bandyta');
    expect(genitive('Bandyta')).toBe('Bandyty');
    expect(dative('Bandyta')).toBe('Bandycie');
    expect(accusative('Bandyta')).toBe('Bandytę');
    expect(instrumental('Bandyta')).toBe('Bandytą');

    // Wilk
    expect(accusative('Wilk')).toBe('Wilka');
    expect(genitive('Wilk')).toBe('Wilka');
    expect(instrumental('Wilk')).toBe('Wilkiem');
    expect(dative('Wilk')).toBe('Wilkowi');

    // Pradawny Bies
    expect(accusative('Pradawny Bies')).toBe('Pradawnego Biesa');
    expect(genitive('Pradawny Bies')).toBe('Pradawnego Biesa');
    expect(instrumental('Pradawny Bies')).toBe('Pradawnym Biesem');
    expect(dative('Pradawny Bies')).toBe('Pradawnemu Biesowi');
  });

  it('correctly declines all handcrafted enemies across world maps', () => {
    // Zdziczały Maruder Szlaku
    expect(accusative('Zdziczały Maruder Szlaku')).toBe('Zdziczałego Marudera Szlaku');
    expect(genitive('Zdziczały Maruder Szlaku')).toBe('Zdziczałego Marudera Szlaku');
    expect(instrumental('Zdziczały Maruder Szlaku')).toBe('Zdziczałym Maruderem Szlaku');
    expect(dative('Zdziczały Maruder Szlaku')).toBe('Zdziczałemu Maruderowi Szlaku');

    // Najemny Wiarus z Jaru
    expect(accusative('Najemny Wiarus z Jaru')).toBe('Najemnego Wiarusa z Jaru');
    expect(genitive('Najemny Wiarus z Jaru')).toBe('Najemnego Wiarusa z Jaru');
    expect(instrumental('Najemny Wiarus z Jaru')).toBe('Najemnym Wiarusem z Jaru');

    // Upadły Czempion Aethelgardu
    expect(accusative('Upadły Czempion Aethelgardu')).toBe('Upadłego Czempiona Aethelgardu');
    expect(instrumental('Upadły Czempion Aethelgardu')).toBe('Upadłym Czempionem Aethelgardu');

    // Utopiec Moczarowy
    expect(accusative('Utopiec Moczarowy')).toBe('Utopca Moczarowego');
    expect(genitive('Utopiec Moczarowy')).toBe('Utopca Moczarowego');
    expect(instrumental('Utopiec Moczarowy')).toBe('Utopcem Moczarowym');

    // Leszy — Duch Puszczy
    expect(accusative('Leszy — Duch Puszczy')).toBe('Leszego — Ducha Puszczy');
    expect(instrumental('Leszy — Duch Puszczy')).toBe('Leszym — Duchem Puszczy');

    // Sanctum dungeon enemies
    expect(accusative('Jaskiniowy Łupieżca')).toBe('Jaskiniowego Łupieżcę');
    expect(instrumental('Jaskiniowy Łupieżca')).toBe('Jaskiniowym Łupieżcą');
    expect(accusative('Kłusownik z Głębin')).toBe('Kłusownika z Głębin');
    expect(accusative('Zdziczały Szczurołap')).toBe('Zdziczałego Szczurołapa');
    expect(accusative('Nowicjusz Kultu Cieni')).toBe('Nowicjusza Kultu Cieni');
    expect(accusative('Zbrojny Strażnik Krypt')).toBe('Zbrojnego Strażnika Krypt');
    expect(accusative('Fanatyczny Tarczownik Cieni')).toBe('Fanatycznego Tarczownika Cieni');
    expect(accusative('Mroczny Guślarz Katakumb')).toBe('Mrocznego Guślarza Katakumb');
    expect(accusative('Mroczny Czempion Zatopionej Korony')).toBe('Mrocznego Czempiona Zatopionej Korony');
    expect(instrumental('Mroczny Czempion Zatopionej Korony')).toBe('Mrocznym Czempionem Zatopionej Korony');
  });

  it('correctly declines friendly NPCs', () => {
    expect(accusative('Kupiec Dobromir')).toBe('Kupca Dobromira');
    expect(instrumental('Płatnerz Bożydar')).toBe('Płatnerzem Bożydarem');
    expect(accusative('Żerca Radogost')).toBe('Żercę Radogosta');
    expect(accusative('Zielarka Wisława')).toBe('Zielarkę Wisławę');
    expect(instrumental('Zielarka Wisława')).toBe('Zielarką Wisławą');
  });

  it('correctly declines dynamic/unknown phrases using fallback morphological engine', () => {
    // Dynamic enemy with adjective and noun
    expect(accusative('Krwawy Rozbójnik')).toBe('Krwawego Rozbójnika');
    expect(instrumental('Krwawy Rozbójnik')).toBe('Krwawym Rozbójnikiem');

    // Dynamic enemy with prepositional phrase
    expect(accusative('Dziki Łowca z Puszczy')).toBe('Dzikiego Łowcę z Puszczy');
    expect(instrumental('Dziki Łowca z Puszczy')).toBe('Dzikim Łowcą z Puszczy');

    // Dynamic enemy ending in -ec (mobile e)
    expect(accusative('Młody Strzelec')).toBe('Młodego Strzelca');
    expect(dative('Młody Strzelec')).toBe('Młodemu Strzelcowi');
  });
});
