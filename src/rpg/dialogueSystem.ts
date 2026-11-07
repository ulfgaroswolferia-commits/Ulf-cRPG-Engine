import { CharacterAttributes } from './characterData';

export interface MerchantWaresItem {
  id: string; // definitionId
  title: string;
  priceSiekance: number;
  description: string;
}

export const MERCHANT_WARES: Record<string, MerchantWaresItem[]> = {
  npc_dobromir: [
    {
      id: 'weapon_Executioner_axe',
      title: 'Topór Runiczny Katowski z Grodu',
      priceSiekance: 460,
      description: 'Potężny dwuręczny oręż zadający druzgocące obrażenia (+6 OBR, 140% przelicznik krytyka).'
    },
    {
      id: 'torso_slavic_lamellar',
      title: 'Słowiańska Zbroja Łuskowa Drużynnika',
      priceSiekance: 440,
      description: 'Elitarny ciężki pancerz z hartowanych żelaznych łusek (+7 Pancerza, +10 HP).'
    },
    {
      id: 'trinket_kolowrot',
      title: 'Złoty Amulet Kołowrotu Swaroga',
      priceSiekance: 590,
      description: 'Legendarny słoneczny talizman przodków (+2 SIŁ, +12 Zdrowia, +2 OBR).'
    },
    {
      id: 'offhand_slavic_shield',
      title: 'Tarcza Deszczułkowa z Kołowrotem',
      priceSiekance: 190,
      description: 'Lekka, zwrotna tarcza lipowa z żelaznym umbem (+3 PANC, +14 HP).'
    },
    {
      id: 'item_dzban_miodu',
      title: 'Dzban Staropolskiego Miodu Żerców',
      priceSiekance: 75,
      description: 'Krzepiący napój przywracający siły i determinację w boju.'
    }
  ],
  npc_bogusz: [
    {
      id: 'weapon_hunting_bow',
      title: 'Kompozytowy Łuk Pradawnego Myśliwego',
      priceSiekance: 290,
      description: 'Cisowy łuk o naciągu ze ścięgien jelenia, niezrównany na dystans (+5 OBR).'
    },
    {
      id: 'cloak_ranger_quiver',
      title: 'Opończa Czatownika z Kołczanem',
      priceSiekance: 310,
      description: 'Kamuflaż leśny i wzmocniony kołczan z brzechwami gęsich piór (+1 Pancerza).'
    },
    {
      id: 'helm_druid_antlers',
      title: 'Wieniec Żercy z Rogami Jelenia',
      priceSiekance: 480,
      description: 'Rytualna korona puszczańska wzmacniająca wiedzę tajemną (+3 WIE) i harmonię z lasem.'
    },
    {
      id: 'item_runic_compass',
      title: 'Astralny Kompas Leśnych Wędrowców',
      priceSiekance: 550,
      description: 'Magiczny artefakt nawigacyjny podnoszący szansę na trafienie krytyczne (+5% KRYT, +2 PER).'
    },
    {
      id: 'item_moon_herbs',
      title: 'Pęczek Ziół Księżycowych z Uroczyska',
      priceSiekance: 80,
      description: 'Zbierane przy pełni leśne zioła o potężnych właściwościach leczniczych.'
    }
  ],
  npc_gniewosz: [
    {
      id: 'torso_aethel_plate',
      title: 'Czarne Płyty Zakonu Aethelgardu',
      priceSiekance: 680,
      description: 'Mistrzowska zbroja płytowa wykradziona z krypt sanktuarium (+9 Pancerza, +15 Zdrowia).'
    },
    {
      id: 'weapon_astral_staff',
      title: 'Kostur Płomienia Pierwszych Archontów',
      priceSiekance: 620,
      description: 'Pradawny runiczny kostur czerpiący moc z eteru (+4 OBR, +3 WIE, +35 Many).'
    },
    {
      id: 'offhand_grimoire',
      title: 'Grimuar Zapomnianych Pieczęci',
      priceSiekance: 440,
      description: 'Starożytna księga zakazanych inkantacji obronnych (+2 WIE, +24 Many, +4% KRYT).'
    },
    {
      id: 'helm_dread_plate',
      title: 'Stalowy Hełm Mrocznego Strażnika',
      priceSiekance: 390,
      description: 'Masywny stalowy czerep z wąską wizjerą (+10 Zdrowia, +2 Determinacji).'
    },
    {
      id: 'ring_wolf_signet',
      title: 'Sygnet Wilczego Szlaku z Krwawym Okiem',
      priceSiekance: 350,
      description: 'Cenny pierścień z rubinem zrabowany z grobowca archonta (+2 FIN, +1 OBR).'
    }
  ]
};

export function getMerchantWares(merchantId: string): MerchantWaresItem[] {
  return MERCHANT_WARES[merchantId] ?? [];
}

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string | null;
  action?: 'sell_duplicates' | 'open_trade';
  requiredAttribute?: {
    stat: keyof CharacterAttributes;
    minValue: number;
  };
  unlocksDoorId?: string;
  grantsItemId?: string;
  logMessage?: string;
}

export interface DialogueNode {
  id: string;
  speakerName: string;
  speakerTitle: string;
  text: string;
  choices: DialogueChoice[];
}

export interface PrzasnyKolapsStep {
  speaker: string;
  role: string;
  line: string;
}

export interface PrzasnyKolapsEntry {
  id: string;
  npcId: string;
  title: string;
  context: string;
  steps: PrzasnyKolapsStep[];
}

export interface PrzasneDialoguesAsset {
  version: string;
  title: string;
  description: string;
  kolapsy: PrzasnyKolapsEntry[];
}

export const DEFAULT_PRZASNE_DIALOGUES_ASSET: PrzasneDialoguesAsset = {
  version: '1.0.0',
  title: 'Księga Przaśnych Kolapsów i Gawęd Pogranicza',
  description:
    'Asset dialogowy z przaśnymi tekstami oraz kolapsami frazeologicznymi (bez żadnych nawiązań do chronionych marek).',
  kolapsy: [
    {
      id: 'kolaps_pala_goryczy',
      npcId: 'npc_gniewko',
      title: 'Pała czy czara goryczy?',
      context:
        'Władca Pogranicza — Król Gniewomir — unosi się gniewem na posłańca po stracie wozu z prowiantem',
      steps: [
        {
          speaker: 'Król Gniewomir',
          role: 'Suweren Pogranicza',
          line: 'Przegiąłeś pałę goryczy!'
        },
        {
          speaker: 'Kanclerz Sulisław',
          role: 'Doradca Dworski',
          line: 'Czarę, królu...'
        },
        {
          speaker: 'Król Gniewomir',
          role: 'Suweren Pogranicza',
          line: 'Jaką kurwa znowu czarę?!'
        },
        {
          speaker: 'Kanclerz Sulisław',
          role: 'Doradca Dworski',
          line: 'Goryczy, królu, goryczy!'
        },
        {
          speaker: 'Król Gniewomir',
          role: 'Suweren Pogranicza',
          line: 'AA tę czarę goryczy, kurwa? Nie łap mnie za słówka, tępy chuju!'
        }
      ]
    },
    {
      id: 'kolaps_skora_z_lasu',
      npcId: 'npc_dobromir',
      title: 'Skóra na niedźwiedziu z lasu',
      context: 'Kupiec Dobromir targuje się o futra przy straganie na rynku pod Światowidem',
      steps: [
        {
          speaker: 'Kupiec Dobromir',
          role: 'Handlarz Bursztynem i Solą',
          line: 'Nie dziel wilka z lasu, póki skóra jeszcze w gawrze siedzi!'
        },
        {
          speaker: 'Wędrowiec',
          role: 'Najemnik z Pogranicza',
          line: 'Skóry na niedźwiedziu, gospodarzu...'
        },
        {
          speaker: 'Kupiec Dobromir',
          role: 'Handlarz Bursztynem i Solą',
          line: 'Jakim kurwa znowu niedźwiedziu?!'
        },
        {
          speaker: 'Wędrowiec',
          role: 'Najemnik z Pogranicza',
          line: 'Nie dzieli się skóry na niedźwiedziu, a z lasu to się wilka nie wywołuje!'
        },
        {
          speaker: 'Kupiec Dobromir',
          role: 'Handlarz Bursztynem i Solą',
          line: 'AA tę skórę na niedźwiedziu, kurwa?! Handlujesz ze mną czy będziesz mi tu gramatykę strugał, mądralo zajebany?!'
        }
      ]
    },
    {
      id: 'kolaps_gwozdz_w_plecy',
      npcId: 'npc_bozydar',
      title: 'Ostatni gwóźdź w plecy',
      context: 'Płatnerz Bożydar klnie przy kowadle na dłużnika, który nie zapłacił za kolczugę',
      steps: [
        {
          speaker: 'Płatnerz Bożydar',
          role: 'Kowal Grodowy',
          line: 'Wbiłeś mi tym długiem ostatni gwóźdź w plecy!'
        },
        {
          speaker: 'Czeladnik',
          role: 'Pomocnik Kowala',
          line: 'Nóż w plecy, mistrzu, albo gwóźdź do trumny...'
        },
        {
          speaker: 'Płatnerz Bożydar',
          role: 'Kowal Grodowy',
          line: 'Jakiej kurwa znowu trumny?!'
        },
        {
          speaker: 'Czeladnik',
          role: 'Pomocnik Kowala',
          line: 'No gwóźdź wbija się do trumny, a w plecy to nóż!'
        },
        {
          speaker: 'Płatnerz Bożydar',
          role: 'Kowal Grodowy',
          line: 'AA ten gwóźdź do trumny, kurwa?! Zaraz ci młotem wbiję jedno i drugie w dupę, jak nie weźmiesz się za miechy!'
        }
      ]
    },
    {
      id: 'kolaps_krew_w_maliny',
      npcId: 'npc_vaelen',
      title: 'Krew w piach czy w maliny?',
      context: 'Kapitan Vaelen komentuje nieudany zwiad przy ognisku na Polanie Wilczego Ognia',
      steps: [
        {
          speaker: 'Kapitan Vaelen',
          role: 'Zwiadowca Pogranicza',
          line: 'Cały nasz zwiad poszedł jak krew w maliny, bo ktoś wpuścił nas w piach!'
        },
        {
          speaker: 'Wędrowiec',
          role: 'Najemnik z Pogranicza',
          line: 'Jak krew w piach, kapitanie...'
        },
        {
          speaker: 'Kapitan Vaelen',
          role: 'Zwiadowca Pogranicza',
          line: 'Jaki kurwa znowu piach?! Tu jest czarnoziem i igliwie!'
        },
        {
          speaker: 'Wędrowiec',
          role: 'Najemnik z Pogranicza',
          line: 'Mówi się: krew w piach, a w maliny to się kogoś wpuszcza!'
        },
        {
          speaker: 'Kapitan Vaelen',
          role: 'Zwiadowca Pogranicza',
          line: 'AA tę krew w piach, kurwa?! Nie filozofuj mi tu przy ognisku, bo zaraz sam pójdziesz w maliny razem z zębami!'
        }
      ]
    }
  ]
};

let loadedPrzasneDialoguesAsset: PrzasneDialoguesAsset = DEFAULT_PRZASNE_DIALOGUES_ASSET;

export function getPrzasneDialoguesAsset(): PrzasneDialoguesAsset {
  return loadedPrzasneDialoguesAsset;
}

export function getPrzasneKolapsyForNpc(npcId: string): PrzasnyKolapsEntry[] {
  return loadedPrzasneDialoguesAsset.kolapsy.filter((k) => k.npcId === npcId);
}

export async function preloadPrzasneDialoguesAsset(
  assetUrl = './assets/dialogues/przasne_teksty.json'
): Promise<PrzasneDialoguesAsset> {
  if (typeof fetch === 'undefined') {
    return loadedPrzasneDialoguesAsset;
  }
  try {
    const res = await fetch(assetUrl);
    if (res.ok) {
      const parsed = (await res.json()) as PrzasneDialoguesAsset;
      if (parsed && Array.isArray(parsed.kolapsy) && parsed.kolapsy.length > 0) {
        loadedPrzasneDialoguesAsset = parsed;
      }
    }
  } catch {
    // Fallback to built-in asset snapshot in headless/offline environments
  }
  return loadedPrzasneDialoguesAsset;
}

export const DIALOGUE_TREES: Record<string, Record<string, DialogueNode>> = {
  npc_gniewko: {
    root: {
      id: 'root',
      speakerName: 'Król Gniewomir',
      speakerTitle: 'Suweren Pogranicza',
      text: 'Znów spóźniony z meldunkiem z traktów?! Przegiąłeś pałę goryczy!',
      choices: [
        {
          id: 'c_gniewko_step1',
          text: 'Czarę, królu...',
          nextNodeId: 'gniewko_jak_czare'
        },
        {
          id: 'c_gniewko_respect',
          text: '[Determinacja 12] Wasza Miłość, szlak z Polany jest już oczyszczony z maruderów.',
          requiredAttribute: { stat: 'resolve', minValue: 12 },
          nextNodeId: 'gniewko_reward',
          grantsItemId: 'ring_wolf_signet',
          logMessage: 'Król Gniewomir nagrodził Cię Sygnetem Wilczego Szlaku.'
        },
        {
          id: 'c_gniewko_leave',
          text: 'Wybacz, panie. Już wracam do obowiązków.',
          nextNodeId: null
        }
      ]
    },
    gniewko_jak_czare: {
      id: 'gniewko_jak_czare',
      speakerName: 'Król Gniewomir',
      speakerTitle: 'Suweren Pogranicza',
      text: 'Jaką kurwa znowu czarę?!',
      choices: [
        {
          id: 'c_gniewko_step2',
          text: 'Goryczy, królu, goryczy!',
          nextNodeId: 'gniewko_explosion'
        },
        {
          id: 'c_gniewko_back',
          text: 'Żadną, Wasza Miłość. Przesłyszało mi się.',
          nextNodeId: null
        }
      ]
    },
    gniewko_explosion: {
      id: 'gniewko_explosion',
      speakerName: 'Król Gniewomir',
      speakerTitle: 'Suweren Pogranicza',
      text: 'AA tę czarę goryczy, kurwa? Nie łap mnie za słówka, tępy chuju!',
      choices: [
        {
          id: 'c_gniewko_end',
          text: 'Tak jest, Wasza Miłość! Już znikam sprzed oblicza.',
          logMessage: 'Przeżyłeś słowny kolaps z Królem Gniewomirem („Pała / czara goryczy”).',
          nextNodeId: null
        }
      ]
    },
    gniewko_reward: {
      id: 'gniewko_reward',
      speakerName: 'Król Gniewomir',
      speakerTitle: 'Suweren Pogranicza',
      text: 'No! Przynajmniej jeden najemnik, co robi swoje, zamiast poprawiać swojego suwerena. Masz tu królewski sygnet z bursztynem!',
      choices: [
        {
          id: 'c_gniewko_thanks',
          text: 'Służba dla Pogranicza to zaszczyt.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_bozydar: {
    root: {
      id: 'root',
      speakerName: 'Płatnerz Bożydar',
      speakerTitle: 'Kowal Grodowy',
      text: 'Widziałeś tego parobka z podgrodzia?! Wziął kutą kolczugę na zeszyt i wbił mi tym długiem ostatni gwóźdź w plecy!',
      choices: [
        {
          id: 'c_bozydar_step1',
          text: 'Nóż w plecy, mistrzu, albo gwóźdź do trumny...',
          nextNodeId: 'bozydar_jaka_trumna'
        },
        {
          id: 'c_bozydar_leave',
          text: 'Nie przeszkadzam przy kowadle, mistrzu.',
          nextNodeId: null
        }
      ]
    },
    bozydar_jaka_trumna: {
      id: 'bozydar_jaka_trumna',
      speakerName: 'Płatnerz Bożydar',
      speakerTitle: 'Kowal Grodowy',
      text: 'Jakiej kurwa znowu trumny?!',
      choices: [
        {
          id: 'c_bozydar_step2',
          text: 'No gwóźdź wbija się do trumny, a w plecy to nóż!',
          nextNodeId: 'bozydar_explosion'
        }
      ]
    },
    bozydar_explosion: {
      id: 'bozydar_explosion',
      speakerName: 'Płatnerz Bożydar',
      speakerTitle: 'Kowal Grodowy',
      text: 'AA ten gwóźdź do trumny, kurwa?! Zaraz ci młotem wbiję jedno i drugie w dupę, jak nie weźmiesz się za miechy!',
      choices: [
        {
          id: 'c_bozydar_done',
          text: 'Spokojnie, Bożydarze, już odchodzę od paleniska.',
          logMessage: 'Płatnerz Bożydar wyjaśnił Ci swoją wersję frazeologii kowalskiej.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_vaelen: {
    root: {
      id: 'root',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'Zatrzymaj się, wędrowcze. Wrota do Skarbca Konklawe na wschodzie pozostają zapieczętowane, a cały nasz zwiad poszedł jak krew w maliny, bo ktoś wpuścił nas w piach!',
      choices: [
        {
          id: 'c_vaelen_kolaps1',
          text: 'Jak krew w piach, kapitanie...',
          nextNodeId: 'vaelen_jaki_piach'
        },
        {
          id: 'c_lore',
          text: '[Wiedza Tajemna 13] Te runy nie zwiastują zagrożenia — stabilizują barierę nad Otchłanią.',
          requiredAttribute: { stat: 'lore', minValue: 13 },
          nextNodeId: 'vaelen_impressed',
          unlocksDoorId: 'door_vault_west',
          logMessage: 'Kapitan Vaelen przekazał Ci klucz i odblokował Zachodnie Wrota Skarbca.'
        },
        {
          id: 'c_ask_vault',
          text: 'Co znajduje się wewnątrz Skarbca Konklawe?',
          nextNodeId: 'vaelen_vault'
        },
        {
          id: 'c_leave',
          text: 'Ruszam dalej na zwiad.',
          nextNodeId: null
        }
      ]
    },
    vaelen_jaki_piach: {
      id: 'vaelen_jaki_piach',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'Jaki kurwa znowu piach?! Tu jest czarnoziem i igliwie!',
      choices: [
        {
          id: 'c_vaelen_kolaps2',
          text: 'Mówi się: krew w piach, a w maliny to się kogoś wpuszcza!',
          nextNodeId: 'vaelen_kolaps_end'
        }
      ]
    },
    vaelen_kolaps_end: {
      id: 'vaelen_kolaps_end',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'AA tę krew w piach, kurwa?! Nie filozofuj mi tu przy ognisku, bo zaraz sam pójdziesz w maliny razem z zębami!',
      choices: [
        {
          id: 'c_vaelen_kolaps_close',
          text: 'Zrozumiałem, kapitanie. Bez odbioru.',
          nextNodeId: null
        }
      ]
    },
    vaelen_impressed: {
      id: 'vaelen_impressed',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'Rzadko spotyka się kogoś, kto potrafi odczytać starożytny glif Aethelgardu. Otworzę dla Ciebie zachodnie wrota Skarbca — weź również ten płaszcz gwardii.',
      choices: [
        {
          id: 'c_accept',
          text: 'Dziękuję, kapitanie. Zbadam relikwiarz.',
          grantsItemId: 'cloak_steel_pauldrons',
          nextNodeId: null
        }
      ]
    },
    vaelen_vault: {
      id: 'vaelen_vault',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'Przechowywano tam Szaty Runiczne oraz Kostur Zatopionej Korony. Możesz spróbować otworzyć wrota bezpośrednio lub porozmawiać z Uczoną Lyrą przy centralnym kręgu.',
      choices: [
        {
          id: 'c_back',
          text: 'Rozumiem. Rozejrzę się po dziedzińcu.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_lyra: {
    root: {
      id: 'root',
      speakerName: 'Uczona Lyra',
      speakerTitle: 'Kronikarka Astralna',
      text: 'Spójrz, jak światło monolitu załamuje się na rzeźbionej posadzce! Gdy obrócisz perspektywę (klawisze Q / E), dostrzeżesz detale ukryte za kolumnami Sanktuarium.',
      choices: [
        {
          id: 'c_perception',
          text: '[Percepcja 12] Pod południowo-wschodnim ołtarzem widać ukrytą inskrypcję.',
          requiredAttribute: { stat: 'perception', minValue: 12 },
          nextNodeId: 'lyra_discovery',
          grantsItemId: 'helm_arcane_circlet',
          logMessage: 'Otrzymano przedmiot: Diadem Gwiaździstego Spojrzenia.'
        },
        {
          id: 'c_bye',
          text: 'Niech gwiazdy sprzyjają Twoim badaniom.',
          nextNodeId: null
        }
      ]
    },
    lyra_discovery: {
      id: 'lyra_discovery',
      speakerName: 'Uczona Lyra',
      speakerTitle: 'Kronikarka Astralna',
      text: 'Niesamowita spostrzegawczość! Weź ten Diadem Gwiaździstego Spojrzenia — po założeniu w ekwipunku od razu zobaczysz go na swojej postaci.',
      choices: [
        {
          id: 'c_thanks',
          text: 'Przyjmuję dar z wdzięcznością.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_dobromir: {
    root: {
      id: 'root',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Sława, wędrowcze! Rozgość się na naszym rynku. Mamy tu sukno, bursztyn i świeżą dziczyznę. Posiadam też rzadkie, kute rynsztunki dla zasłużonych wojów — choć za takie skarby liczę sobie sporo siekańców!',
      choices: [
        {
          id: 'c_dobromir_shop',
          text: '🏪 [Kram] Pokaż swoje najcenniejsze towary na sprzedaż.',
          nextNodeId: 'dobromir_shop'
        },
        {
          id: 'c_dobromir_sell_duplicates',
          text: '💰 [Kupiec] Odkup jednym kliknięciem wszystkie moje zdublowane przedmioty za siekańce!',
          action: 'sell_duplicates',
          nextNodeId: 'dobromir_sold_duplicates'
        },
        {
          id: 'c_dobromir_open_trade',
          text: '🪙 [Handel] Otwórz mój plecak — chcę przejrzeć i sprzedać wybrane towary za siekańce.',
          action: 'open_trade',
          nextNodeId: 'dobromir_trade_opened'
        },
        {
          id: 'c_dobromir_kolaps1',
          text: 'Skóry na niedźwiedziu, gospodarzu...',
          nextNodeId: 'dobromir_jaki_niedzwiedz'
        },
        {
          id: 'c_dobromir_trade',
          text: '[Percepcja 13] Dostrzegam pod ladą kunsztownie kuty sygnet z bursztynem i szmaragdem.',
          requiredAttribute: { stat: 'perception', minValue: 13 },
          nextNodeId: 'dobromir_gift',
          grantsItemId: 'ring_emerald_seal',
          logMessage: 'Kupiec Dobromir podarował Ci Szmaragdową Pieczęć Konklawe za czujne oko.'
        },
        {
          id: 'c_dobromir_village',
          text: 'Opowiedz mi o tej osadzie i okolicznych lasach.',
          nextNodeId: 'dobromir_lore'
        },
        {
          id: 'c_dobromir_bye',
          text: 'Niech handel idzie pomyślnie, Dobromirze.',
          nextNodeId: null
        }
      ]
    },
    dobromir_shop: {
      id: 'dobromir_shop',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Oto moje najcenniejsze towary, przywiezione z książęcych grodów i od mistrzów płatnerskich! Każdy z nich wymaga sporego wysiłku i uzbierania solidnej sakwy siekańców. Wybierz co cię interesuje poniżej:',
      choices: [
        {
          id: 'c_dobromir_shop_back',
          text: 'Wróćmy do innych tematów.',
          nextNodeId: 'root'
        },
        {
          id: 'c_dobromir_shop_bye',
          text: 'Muszę jeszcze dozbierać siekańców. Bywaj!',
          nextNodeId: null
        }
      ]
    },
    dobromir_sold_duplicates: {
      id: 'dobromir_sold_duplicates',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Ubiłem z tobą wyborny targ! Odkupiłem wszystkie twoje zdublowane przedmioty za brzęczące siekańce. Srebro jest już w twojej sakwie!',
      choices: [
        {
          id: 'c_dobromir_sold_dup_back',
          text: 'Pokaż mi jeszcze resztę spraw.',
          nextNodeId: 'root'
        },
        {
          id: 'c_dobromir_sold_dup_bye',
          text: 'Dzięki za uczciwy handel. Bywaj!',
          nextNodeId: null
        }
      ]
    },
    dobromir_trade_opened: {
      id: 'dobromir_trade_opened',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Otwórz śmiało plecak! Przy każdym przedmiocie masz podaną cenę w siekańcach. Kliknij „Sprzedaj”, a natychmiast wypłacę brzęczącą monetę!',
      choices: [
        {
          id: 'c_dobromir_trade_opened_back',
          text: 'Wróćmy do rozmowy.',
          nextNodeId: 'root'
        },
        {
          id: 'c_dobromir_trade_opened_bye',
          text: 'Zajmę się teraz tobołkami. Do zobaczenia.',
          nextNodeId: null
        }
      ]
    },
    dobromir_jaki_niedzwiedz: {
      id: 'dobromir_jaki_niedzwiedz',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Jakim kurwa znowu niedźwiedziu?!',
      choices: [
        {
          id: 'c_dobromir_kolaps2',
          text: 'Nie dzieli się skóry na niedźwiedziu, a z lasu to się wilka nie wywołuje!',
          nextNodeId: 'dobromir_kolaps_end'
        }
      ]
    },
    dobromir_kolaps_end: {
      id: 'dobromir_kolaps_end',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'AA tę skórę na niedźwiedziu, kurwa?! Handlujesz ze mną czy będziesz mi tu gramatykę strugał, mądralo zajebany?!',
      choices: [
        {
          id: 'c_dobromir_kolaps_close',
          text: 'Już dobrze, gospodarzu, pokaż towary.',
          nextNodeId: null
        }
      ]
    },
    dobromir_gift: {
      id: 'dobromir_gift',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Ha! Masz oko prawdziwego znawcy. Ten pierścień zostawił tu kupiec z dalekiego południa. Weź go — w Twoim plecaku od razu porównasz jego statystyki z tym, co nosisz na dłoni!',
      choices: [
        {
          id: 'c_dobromir_thanks',
          text: 'Bóg zapłać, zacny kupcze.',
          nextNodeId: null
        }
      ]
    },
    dobromir_lore: {
      id: 'dobromir_lore',
      speakerName: 'Kupiec Dobromir',
      speakerTitle: 'Starszy Targowiska pod Światowidem',
      text: 'Nasza osada żyje w cieniu Świętego Gaju na północno-zachodnim wzgórzu. Żerca Radogost strzeże tam czterotwarzowego posągu Światowida, a nasze chaty kryte słomianą strzechą dają schronienie wędrowcom z całego szlaku.',
      choices: [
        {
          id: 'c_dobromir_back',
          text: 'Odwiedzę Święty Gaj i obejrzę stragany.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_bogusz: {
    root: {
      id: 'root',
      speakerName: 'Wędrowny Kramarz Bogusz',
      speakerTitle: 'Kupiec Szlaku Puszczańskiego',
      text: 'Niech leśne duchy ci sprzyjają, wędrowcze! Rozstawiłem kram na tym rozstaju przy polanie. Skupię od ciebie każde znalezisko, ale mam też specjalny rynsztunek leśnych mistrzów — rzadkie kompozytowe łuki i artefakty, które wymagają solidnej zapłaty w siekańcach!',
      choices: [
        {
          id: 'c_bogusz_shop',
          text: '🏪 [Kram] Pokaż swoje najcenniejsze towary na sprzedaż.',
          nextNodeId: 'bogusz_shop'
        },
        {
          id: 'c_bogusz_sell_duplicates',
          text: '💰 [Kupiec] Odkup jednym kliknięciem wszystkie moje zdublowane przedmioty za siekańce!',
          action: 'sell_duplicates',
          nextNodeId: 'bogusz_sold_duplicates'
        },
        {
          id: 'c_bogusz_open_trade',
          text: '🪙 [Handel] Chcę przejrzeć plecak i sprzedać wybrane przedmioty za siekańce.',
          action: 'open_trade',
          nextNodeId: 'bogusz_trade_opened'
        },
        {
          id: 'c_bogusz_lore',
          text: 'Jak ci się handluje samotnie na tym leśnym pustkowiu?',
          nextNodeId: 'bogusz_lore'
        },
        {
          id: 'c_bogusz_bye',
          text: 'Muszę ruszać dalej traktem. Bywaj, Boguszu.',
          nextNodeId: null
        }
      ]
    },
    bogusz_shop: {
      id: 'bogusz_shop',
      speakerName: 'Wędrowny Kramarz Bogusz',
      speakerTitle: 'Kupiec Szlaku Puszczańskiego',
      text: 'Te przyrządy i łuki to kunszt leśnych mistrzów. W borze każdy punkt celności i dodatkowy pancerz ratuje życie. Zbieraj siekańce z potworów i skrzyń — z takim sprzętem puszcza będzie twoja! Zobacz ofertę poniżej:',
      choices: [
        {
          id: 'c_bogusz_shop_back',
          text: 'Wróćmy do rozmowy.',
          nextNodeId: 'root'
        },
        {
          id: 'c_bogusz_shop_bye',
          text: 'Idę polować na siekańce. Do zobaczenia!',
          nextNodeId: null
        }
      ]
    },
    bogusz_sold_duplicates: {
      id: 'bogusz_sold_duplicates',
      speakerName: 'Wędrowny Kramarz Bogusz',
      speakerTitle: 'Kupiec Szlaku Puszczańskiego',
      text: 'Znakomity interes! Odkupiłem od ciebie wszystkie nadmiarowe przedmioty. Twoje siekańce są już bezpieczne w sakwie!',
      choices: [
        {
          id: 'c_bogusz_sold_dup_back',
          text: 'Wróćmy do oferty.',
          nextNodeId: 'root'
        },
        {
          id: 'c_bogusz_sold_dup_bye',
          text: 'Dzięki za uczciwy handel. Bywaj!',
          nextNodeId: null
        }
      ]
    },
    bogusz_trade_opened: {
      id: 'bogusz_trade_opened',
      speakerName: 'Wędrowny Kramarz Bogusz',
      speakerTitle: 'Kupiec Szlaku Puszczańskiego',
      text: 'Zajrzyj do tobołka! Każdy fant ma swoją wartość w siekańcach. Sprzedaj co zbędne, a waga twojego rynsztunku od razu spadnie.',
      choices: [
        {
          id: 'c_bogusz_trade_opened_back',
          text: 'Wróćmy do rozmowy.',
          nextNodeId: 'root'
        },
        {
          id: 'c_bogusz_trade_opened_bye',
          text: 'Zaraz przejrzę plecak. Do widzenia.',
          nextNodeId: null
        }
      ]
    },
    bogusz_lore: {
      id: 'bogusz_lore',
      speakerName: 'Wędrowny Kramarz Bogusz',
      speakerTitle: 'Kupiec Szlaku Puszczańskiego',
      text: 'Szlak bywa niebezpieczny, ale wokół ogniska czuwają zwiadowcy pod wodzą kapitana Vaelena. Wojowie chętnie kupują zioła i pieczyste, a mnie nie brakuje siekańców na odkupienie łupów od śmiałków takich jak ty!',
      choices: [
        {
          id: 'c_bogusz_lore_back',
          text: 'Rozumiem. Pokaż mi jeszcze towary.',
          nextNodeId: 'root'
        }
      ]
    }
  },
  npc_gniewosz: {
    root: {
      id: 'root',
      speakerName: 'Paser Gniewosz',
      speakerTitle: 'Handlarz z Mrocznych Katakumb',
      text: 'Sss... Ciszej, mury mają uszy. W tych kryptach strażnicy i duchy nie wybaczają hałasu. Skupuję fanty bez pytań, ale jeśli masz pełną sakwę siekańców, mogę odstąpić ci legendarne płyty Aethelgardu lub astralne kostury wyciągnięte prosto ze skarbca archontów!',
      choices: [
        {
          id: 'c_gniewosz_shop',
          text: '🏪 [Kram] Pokaż swoje najcenniejsze towary na sprzedaż.',
          nextNodeId: 'gniewosz_shop'
        },
        {
          id: 'c_gniewosz_sell_duplicates',
          text: '💰 [Kupiec] Odkup jednym kliknięciem wszystkie moje zdublowane przedmioty za siekańce!',
          action: 'sell_duplicates',
          nextNodeId: 'gniewosz_sold_duplicates'
        },
        {
          id: 'c_gniewosz_open_trade',
          text: '🪙 [Handel] Chcę przejrzeć plecak i sprzedać wybrane przedmioty za siekańce.',
          action: 'open_trade',
          nextNodeId: 'gniewosz_trade_opened'
        },
        {
          id: 'c_gniewosz_lore',
          text: 'Co żywy człowiek robi tak głęboko w lochach sanktuarium?',
          nextNodeId: 'gniewosz_lore'
        },
        {
          id: 'c_gniewosz_bye',
          text: 'Będę miał cię na oku. Żegnaj.',
          nextNodeId: null
        }
      ]
    },
    gniewosz_shop: {
      id: 'gniewosz_shop',
      speakerName: 'Paser Gniewosz',
      speakerTitle: 'Handlarz z Mrocznych Katakumb',
      text: 'Prawdziwe relikwie Pierwszych Archontów i czarne płyty gwardii. Taki sprzęt nie trafia w ręce byle kogo. Ceny są wysokie, bo i ryzyko było śmiertelne. Wybierz co chcesz kupić z oferty poniżej, a siekańce zostaw u mnie:',
      choices: [
        {
          id: 'c_gniewosz_shop_back',
          text: 'Wróćmy do innych spraw.',
          nextNodeId: 'root'
        },
        {
          id: 'c_gniewosz_shop_bye',
          text: 'Zejdę głębiej do lochów po więcej łupów. Żegnaj.',
          nextNodeId: null
        }
      ]
    },
    gniewosz_sold_duplicates: {
      id: 'gniewosz_sold_duplicates',
      speakerName: 'Paser Gniewosz',
      speakerTitle: 'Handlarz z Mrocznych Katakumb',
      text: 'Wszystkie duplikaty zniknęły w moich worach, a brzęczące siekańce wylądowały w twojej kieszeni. Czysty, dyskretny zysk!',
      choices: [
        {
          id: 'c_gniewosz_sold_dup_back',
          text: 'Pokaż co jeszcze masz na myśli.',
          nextNodeId: 'root'
        },
        {
          id: 'c_gniewosz_sold_dup_bye',
          text: 'Dzięki. Pilnuj pleców w tych lochach.',
          nextNodeId: null
        }
      ]
    },
    gniewosz_trade_opened: {
      id: 'gniewosz_trade_opened',
      speakerName: 'Paser Gniewosz',
      speakerTitle: 'Handlarz z Mrocznych Katakumb',
      text: 'Wyjmij fanty. Zapłacę uczciwie za każde ostrze i każdy czerep. W katakumbach srebro jest cenniejsze niż modlitwy kapłanów.',
      choices: [
        {
          id: 'c_gniewosz_trade_opened_back',
          text: 'Wróćmy do rozmowy.',
          nextNodeId: 'root'
        },
        {
          id: 'c_gniewosz_trade_opened_bye',
          text: 'Zaraz przejrzę ekwipunek.',
          nextNodeId: null
        }
      ]
    },
    gniewosz_lore: {
      id: 'gniewosz_lore',
      speakerName: 'Paser Gniewosz',
      speakerTitle: 'Handlarz z Mrocznych Katakumb',
      text: 'Górny dziedziniec należy do rycerzy i zakonu, ale te niższe krypty mają własne prawa. Dopóki płacę siekańcami, nawet strażnicy przymykają oko na moje interesy. Znajdź klucz do skarbca, a obaj będziemy obrzydliwie bogaci.',
      choices: [
        {
          id: 'c_gniewosz_lore_back',
          text: 'Będę pamiętał. Wróćmy do handlu.',
          nextNodeId: 'root'
        }
      ]
    }
  },
  npc_radogost: {
    root: {
      id: 'root',
      speakerName: 'Żerca Radogost',
      speakerTitle: 'Strażnik Świętego Gaju Światowida',
      text: 'Cztery oblicza Światowida patrzą na cztery strony świata, wędrowcze. Nawet gdy obrócisz spojrzenie o 90 stopni, pradawny bóg widzi każdy Twój krok pośród dębów i kurhanów.',
      choices: [
        {
          id: 'c_radogost_blessing',
          text: '[Wiedza Tajemna 13] Znam starą pieśń ofiarną ku czci Peruna i Welesa.',
          requiredAttribute: { stat: 'lore', minValue: 13 },
          nextNodeId: 'radogost_reward',
          grantsItemId: 'weapon_astral_staff',
          logMessage: 'Żerca Radogost pobłogosławił Cię i wręczył Kostur Runiczny Żerców!'
        },
        {
          id: 'c_radogost_leave',
          text: 'Skłonię głowę przed posągiem i ruszę dalej.',
          nextNodeId: null
        }
      ]
    },
    radogost_reward: {
      id: 'radogost_reward',
      speakerName: 'Żerca Radogost',
      speakerTitle: 'Strażnik Świętego Gaju Światowida',
      text: 'Stara krew wciąż pamięta słowa przodków! Przyjmij ten Kostur Runiczny — to broń dwuręczna (2H), która oświetli Ci mrok puszczy.',
      choices: [
        {
          id: 'c_radogost_accept',
          text: 'Sława Bogom, czcigodny Żerco.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_wislawa: {
    root: {
      id: 'root',
      speakerName: 'Zielarka Wisława',
      speakerTitle: 'Uzdrowicielka i Plecionkarka',
      text: 'Bądź pozdrowiony, wędrowcze. Moje wianki i suszone zioła z uroczysk odpędzają nocne mary i gorączkę. Czy potrzebujesz piołunu na żołądek lub ochronnej lalki motanki?',
      choices: [
        {
          id: 'c_wislawa_herbs',
          text: 'Chętnie dowiem się więcej o Twoich ziołach i motankach.',
          nextNodeId: 'wislawa_lore'
        },
        {
          id: 'c_wislawa_gift',
          text: '[Percepcja 12] Zauważam doskonale uwitą lalkę motankę ze świeżym lnem.',
          requiredAttribute: { stat: 'perception', minValue: 12 },
          nextNodeId: 'wislawa_reward',
          grantsItemId: 'trinket_motanka',
          logMessage: 'Zielarka Wisława podarowała Ci Lalkę Motankę z Lnu i Chrustu!'
        },
        {
          id: 'c_wislawa_leave',
          text: 'Niechaj bory obficie rodzą zioła, Wisławo.',
          nextNodeId: null
        }
      ]
    },
    wislawa_lore: {
      id: 'wislawa_lore',
      speakerName: 'Zielarka Wisława',
      speakerTitle: 'Uzdrowicielka i Plecionkarka',
      text: 'Piołun zbieram o zmierzchu, a świętojański dziurawiec w samo południe, gdy słońce stoi najwyżej na nieboskłonie. Motankę zaś mota się z jednego kawałka lnu, nie dotykając jej żelazną igłą, by nie zranić dobrego ducha opiekuńczego.',
      choices: [
        {
          id: 'c_wislawa_back',
          text: 'Dziękuję za mądrość przodków.',
          nextNodeId: null
        }
      ]
    },
    wislawa_reward: {
      id: 'wislawa_reward',
      speakerName: 'Zielarka Wisława',
      speakerTitle: 'Uzdrowicielka i Plecionkarka',
      text: 'Masz bystre oko i czyste serce! Weź tę motankę — noś ją w torbie, a żaden urok i otępienie nie dosięgną Twego umysłu.',
      choices: [
        {
          id: 'c_wislawa_accept',
          text: 'Niech Swaróg Ci sprzyja, Wisławo.',
          nextNodeId: null
        }
      ]
    }
  },
  npc_sambor: {
    root: {
      id: 'root',
      speakerName: 'Kmieć Sambor',
      speakerTitle: 'Gospodarz Spichlerza',
      text: 'Witaj, panie. Ziarno suche w spichlerzu leży, a w kuźni Bożydara topory kują. Ciężkie czasy idą, na uroczyskach wilcy i utopce się panoszą, więc każdy kmieć pod kłobukiem ma głowę na karku.',
      choices: [
        {
          id: 'c_sambor_klobuk',
          text: 'Zacny ten kłobuk, dobrze chroni przed deszczem i chłodem.',
          nextNodeId: 'sambor_gift',
          grantsItemId: 'helm_klobuk',
          logMessage: 'Kmieć Sambor wręczył Ci zapasowy Filcowy Kłobuk Kmiecia!'
        },
        {
          id: 'c_sambor_village',
          text: 'Jak wam się żyje pod opieką żercy Radogosta?',
          nextNodeId: 'sambor_radogost'
        },
        {
          id: 'c_sambor_leave',
          text: 'Oby zbiory były obfite, gospodarzu.',
          nextNodeId: null
        }
      ]
    },
    sambor_gift: {
      id: 'sambor_gift',
      speakerName: 'Kmieć Sambor',
      speakerTitle: 'Gospodarz Spichlerza',
      text: 'Z owczej wełny go ubiłem, deszcz po nim spływa jak po gęsi! Weź zapasowy, w borze przyda się bardziej niż w komorze.',
      choices: [
        {
          id: 'c_sambor_thanks',
          text: 'Dziękuję, Samborze. Będę go nosił z dumą.',
          nextNodeId: null
        }
      ]
    },
    sambor_radogost: {
      id: 'sambor_radogost',
      speakerName: 'Kmieć Sambor',
      speakerTitle: 'Gospodarz Spichlerza',
      text: 'Dziad Radogost z siwą brodą to mądry człek. Ogień na kurhanie podtrzymuje, bogom ofiary z miodu i kołacza składa. Dopóki Światowid na wzgórzu stoi, żaden bies wioski nie spali.',
      choices: [
        {
          id: 'c_sambor_back',
          text: 'Dobrze wiedzieć. Zaglądnę do świętego gaju.',
          nextNodeId: null
        }
      ]
    }
  }
};
