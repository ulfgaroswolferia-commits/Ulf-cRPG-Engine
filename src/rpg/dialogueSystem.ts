import { CharacterAttributes } from './characterData';

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string | null;
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
      text: 'Sława, wędrowcze! Rozgość się na naszym rynku. Mamy tu sukno, bursztyn i świeżą dziczyznę. Tylko pamiętaj: nie dziel wilka z lasu, póki skóra jeszcze w gawrze siedzi!',
      choices: [
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
  }
};
