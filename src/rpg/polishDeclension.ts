/**
 * Polish Grammatical Declension Engine (Odmiana przez przypadki w języku polskim)
 *
 * Provides accurate declension for RPG entities (enemies, NPCs, items, titles)
 * across all grammatical cases:
 * - Mianownik (Nominative): Kto? Co? (np. Bandyta, Zdziczały Maruder Szlaku)
 * - Dopełniacz (Genitive): Kogo? Czego? (np. Bandyty, Uniknąłeś ataku Bandyty, Ciało Bandyty)
 * - Celownik (Dative): Komu? Czemu? (np. Bandycie, Zadano obrażenia: Bandycie)
 * - Biernik (Accusative): Kogo? Co? (np. Bandytę, Pokonano Bandytę, Pudło w Bandytę)
 * - Narzędnik (Instrumental): Z kim? Nad kim? (np. Bandytą, Zwycięstwo nad Bandytą, Walka z Bandytą)
 * - Miejscownik (Locative): O kim? O czym?
 */

export type PolishCase =
  | 'mianownik'
  | 'dopelniacz'
  | 'celownik'
  | 'biernik'
  | 'narzednik'
  | 'miejscownik';

interface DeclensionForms {
  mianownik: string;
  dopelniacz: string;
  celownik: string;
  biernik: string;
  narzednik: string;
  miejscownik: string;
}

/**
 * Handcrafted, fully verified dictionary for all known NPCs, enemies, and key RPG terms.
 */
const KNOWN_ENTITIES: Record<string, DeclensionForms> = {
  // Common enemy archetypes
  Bandyta: {
    mianownik: 'Bandyta',
    dopelniacz: 'Bandyty',
    celownik: 'Bandycie',
    biernik: 'Bandytę',
    narzednik: 'Bandytą',
    miejscownik: 'Bandycie'
  },
  'Zdziczały Bandyta': {
    mianownik: 'Zdziczały Bandyta',
    dopelniacz: 'Zdziczałego Bandyty',
    celownik: 'Zdziczałemu Bandycie',
    biernik: 'Zdziczałego Bandytę',
    narzednik: 'Zdziczałym Bandytą',
    miejscownik: 'Zdziczałym Bandycie'
  },
  Wilk: {
    mianownik: 'Wilk',
    dopelniacz: 'Wilka',
    celownik: 'Wilkowi',
    biernik: 'Wilka',
    narzednik: 'Wilkiem',
    miejscownik: 'Wilku'
  },
  'Wilk cmentarny': {
    mianownik: 'Wilk cmentarny',
    dopelniacz: 'Wilka cmentarnego',
    celownik: 'Wilkowi cmentarnemu',
    biernik: 'Wilka cmentarnego',
    narzednik: 'Wilkiem cmentarnym',
    miejscownik: 'Wilku cmentarnym'
  },
  'Pradawny Bies': {
    mianownik: 'Pradawny Bies',
    dopelniacz: 'Pradawnego Biesa',
    celownik: 'Pradawnemu Biesowi',
    biernik: 'Pradawnego Biesa',
    narzednik: 'Pradawnym Biesem',
    miejscownik: 'Pradawnym Biesie'
  },
  Bies: {
    mianownik: 'Bies',
    dopelniacz: 'Biesa',
    celownik: 'Biesowi',
    biernik: 'Biesa',
    narzednik: 'Biesem',
    miejscownik: 'Biesie'
  },
  Potwór: {
    mianownik: 'Potwór',
    dopelniacz: 'Potwora',
    celownik: 'Potworowi',
    biernik: 'Potwora',
    narzednik: 'Potworem',
    miejscownik: 'Potworze'
  },
  Przeciwnik: {
    mianownik: 'Przeciwnik',
    dopelniacz: 'Przeciwnika',
    celownik: 'Przeciwnikowi',
    biernik: 'Przeciwnika',
    narzednik: 'Przeciwnikiem',
    miejscownik: 'Przeciwniku'
  },
  Wróg: {
    mianownik: 'Wróg',
    dopelniacz: 'Wroga',
    celownik: 'Wrogowi',
    biernik: 'Wroga',
    narzednik: 'Wrogiem',
    miejscownik: 'Wrogu'
  },

  // Handcrafted Forest Clearing & World Enemies
  'Zdziczały Maruder Szlaku': {
    mianownik: 'Zdziczały Maruder Szlaku',
    dopelniacz: 'Zdziczałego Marudera Szlaku',
    celownik: 'Zdziczałemu Maruderowi Szlaku',
    biernik: 'Zdziczałego Marudera Szlaku',
    narzednik: 'Zdziczałym Maruderem Szlaku',
    miejscownik: 'Zdziczałym Maruderze Szlaku'
  },
  'Najemny Wiarus z Jaru': {
    mianownik: 'Najemny Wiarus z Jaru',
    dopelniacz: 'Najemnego Wiarusa z Jaru',
    celownik: 'Najemnemu Wiarusowi z Jaru',
    biernik: 'Najemnego Wiarusa z Jaru',
    narzednik: 'Najemnym Wiarusem z Jaru',
    miejscownik: 'Najemnym Wiarusie z Jaru'
  },
  'Upadły Czempion Aethelgardu': {
    mianownik: 'Upadły Czempion Aethelgardu',
    dopelniacz: 'Upadłego Czempiona Aethelgardu',
    celownik: 'Upadłemu Czempionowi Aethelgardu',
    biernik: 'Upadłego Czempiona Aethelgardu',
    narzednik: 'Upadłym Czempionem Aethelgardu',
    miejscownik: 'Upadłym Czempionie Aethelgardu'
  },
  'Upadły Czempion Pogranicza': {
    mianownik: 'Upadły Czempion Pogranicza',
    dopelniacz: 'Upadłego Czempiona Pogranicza',
    celownik: 'Upadłemu Czempionowi Pogranicza',
    biernik: 'Upadłego Czempiona Pogranicza',
    narzednik: 'Upadłym Czempionem Pogranicza',
    miejscownik: 'Upadłym Czempionie Pogranicza'
  },
  'Leszy — Duch Puszczy': {
    mianownik: 'Leszy — Duch Puszczy',
    dopelniacz: 'Leszego — Ducha Puszczy',
    celownik: 'Leszemu — Duchowi Puszczy',
    biernik: 'Leszego — Ducha Puszczy',
    narzednik: 'Leszym — Duchem Puszczy',
    miejscownik: 'Leszym — Duchu Puszczy'
  },
  Leszy: {
    mianownik: 'Leszy',
    dopelniacz: 'Leszego',
    celownik: 'Leszemu',
    biernik: 'Leszego',
    narzednik: 'Leszym',
    miejscownik: 'Leszym'
  },
  'Utopiec Moczarowy': {
    mianownik: 'Utopiec Moczarowy',
    dopelniacz: 'Utopca Moczarowego',
    celownik: 'Utopcowi Moczarowemu',
    biernik: 'Utopca Moczarowego',
    narzednik: 'Utopcem Moczarowym',
    miejscownik: 'Utopcu Moczarowym'
  },
  Utopiec: {
    mianownik: 'Utopiec',
    dopelniacz: 'Utopca',
    celownik: 'Utopcowi',
    biernik: 'Utopca',
    narzednik: 'Utopcem',
    miejscownik: 'Utopcu'
  },
  'Zardzewiały Woj Mogił': {
    mianownik: 'Zardzewiały Woj Mogił',
    dopelniacz: 'Zardzewiałego Woja Mogił',
    celownik: 'Zardzewiałemu Wojowi Mogił',
    biernik: 'Zardzewiałego Woja Mogił',
    narzednik: 'Zardzewiałym Wojem Mogił',
    miejscownik: 'Zardzewiałym Woju Mogił'
  },

  // Sanctum Dungeon Enemies & Boss
  'Jaskiniowy Łupieżca': {
    mianownik: 'Jaskiniowy Łupieżca',
    dopelniacz: 'Jaskiniowego Łupieżcy',
    celownik: 'Jaskiniowemu Łupieżcy',
    biernik: 'Jaskiniowego Łupieżcę',
    narzednik: 'Jaskiniowym Łupieżcą',
    miejscownik: 'Jaskiniowym Łupieżcy'
  },
  'Kłusownik z Głębin': {
    mianownik: 'Kłusownik z Głębin',
    dopelniacz: 'Kłusownika z Głębin',
    celownik: 'Kłusownikowi z Głębin',
    biernik: 'Kłusownika z Głębin',
    narzednik: 'Kłusownikiem z Głębin',
    miejscownik: 'Kłusowniku z Głębin'
  },
  'Zdziczały Szczurołap': {
    mianownik: 'Zdziczały Szczurołap',
    dopelniacz: 'Zdziczałego Szczurołapa',
    celownik: 'Zdziczałemu Szczurołapowi',
    biernik: 'Zdziczałego Szczurołapa',
    narzednik: 'Zdziczałym Szczurołapem',
    miejscownik: 'Zdziczałym Szczurołapie'
  },
  'Nowicjusz Kultu Cieni': {
    mianownik: 'Nowicjusz Kultu Cieni',
    dopelniacz: 'Nowicjusza Kultu Cieni',
    celownik: 'Nowicjuszowi Kultu Cieni',
    biernik: 'Nowicjusza Kultu Cieni',
    narzednik: 'Nowicjuszem Kultu Cieni',
    miejscownik: 'Nowicjuszu Kultu Cieni'
  },
  'Zbrojny Strażnik Krypt': {
    mianownik: 'Zbrojny Strażnik Krypt',
    dopelniacz: 'Zbrojnego Strażnika Krypt',
    celownik: 'Zbrojnemu Strażnikowi Krypt',
    biernik: 'Zbrojnego Strażnika Krypt',
    narzednik: 'Zbrojnym Strażnikiem Krypt',
    miejscownik: 'Zbrojnym Strażniku Krypt'
  },
  'Fanatyczny Tarczownik Cieni': {
    mianownik: 'Fanatyczny Tarczownik Cieni',
    dopelniacz: 'Fanatycznego Tarczownika Cieni',
    celownik: 'Fanatycznemu Tarczownikowi Cieni',
    biernik: 'Fanatycznego Tarczownika Cieni',
    narzednik: 'Fanatycznym Tarczownikiem Cieni',
    miejscownik: 'Fanatycznym Tarczowniku Cieni'
  },
  'Mroczny Guślarz Katakumb': {
    mianownik: 'Mroczny Guślarz Katakumb',
    dopelniacz: 'Mrocznego Guślarza Katakumb',
    celownik: 'Mrocznemu Guślarzowi Katakumb',
    biernik: 'Mrocznego Guślarza Katakumb',
    narzednik: 'Mrocznym Guślarzem Katakumb',
    miejscownik: 'Mrocznym Guślarzu Katakumb'
  },
  'Mroczny Czempion Zatopionej Korony': {
    mianownik: 'Mroczny Czempion Zatopionej Korony',
    dopelniacz: 'Mrocznego Czempiona Zatopionej Korony',
    celownik: 'Mrocznemu Czempionowi Zatopionej Korony',
    biernik: 'Mrocznego Czempiona Zatopionej Korony',
    narzednik: 'Mrocznym Czempionem Zatopionej Korony',
    miejscownik: 'Mrocznym Czempionie Zatopionej Korony'
  },

  // NPCs & Companions
  'Król Gniewomir': {
    mianownik: 'Król Gniewomir',
    dopelniacz: 'Króla Gniewomira',
    celownik: 'Królowi Gniewomirowi',
    biernik: 'Króla Gniewomira',
    narzednik: 'Królem Gniewomirem',
    miejscownik: 'Królu Gniewomirze'
  },
  'Kupiec Dobromir': {
    mianownik: 'Kupiec Dobromir',
    dopelniacz: 'Kupca Dobromira',
    celownik: 'Kupcowi Dobromirowi',
    biernik: 'Kupca Dobromira',
    narzednik: 'Kupcem Dobromirem',
    miejscownik: 'Kupcu Dobromirze'
  },
  'Płatnerz Bożydar': {
    mianownik: 'Płatnerz Bożydar',
    dopelniacz: 'Płatnerza Bożydara',
    celownik: 'Płatnerzowi Bożydarowi',
    biernik: 'Płatnerza Bożydara',
    narzednik: 'Płatnerzem Bożydarem',
    miejscownik: 'Płatnerzu Bożydarze'
  },
  'Żerca Radogost': {
    mianownik: 'Żerca Radogost',
    dopelniacz: 'Żercy Radogosta',
    celownik: 'Żercy Radogostowi',
    biernik: 'Żercę Radogosta',
    narzednik: 'Żercą Radogostem',
    miejscownik: 'Żercy Radogoście'
  },
  'Zielarka Wisława': {
    mianownik: 'Zielarka Wisława',
    dopelniacz: 'Zielarki Wisławy',
    celownik: 'Zielarce Wisławie',
    biernik: 'Zielarkę Wisławę',
    narzednik: 'Zielarką Wisławą',
    miejscownik: 'Zielarce Wisławie'
  },
  'Kmieć Sambor': {
    mianownik: 'Kmieć Sambor',
    dopelniacz: 'Kmiecia Sambora',
    celownik: 'Kmieciowi Samborowi',
    biernik: 'Kmiecia Sambora',
    narzednik: 'Kmieciem Samborem',
    miejscownik: 'Kmieciu Samborze'
  },
  'Drużynnik Miłosz': {
    mianownik: 'Drużynnik Miłosz',
    dopelniacz: 'Drużynnika Miłosza',
    celownik: 'Drużynnikowi Miłoszowi',
    biernik: 'Drużynnika Miłosza',
    narzednik: 'Drużynnikiem Miłoszem',
    miejscownik: 'Drużynniku Miłoszu'
  },
  'Kapitan Vaelen': {
    mianownik: 'Kapitan Vaelen',
    dopelniacz: 'Kapitana Vaelena',
    celownik: 'Kapitanowi Vaelenowi',
    biernik: 'Kapitana Vaelena',
    narzednik: 'Kapitanem Vaelenem',
    miejscownik: 'Kapitanie Vaelenie'
  },
  'Uczona Lyra': {
    mianownik: 'Uczona Lyra',
    dopelniacz: 'Uczonej Lyry',
    celownik: 'Uczonej Lyrze',
    biernik: 'Uczoną Lyrę',
    narzednik: 'Uczoną Lyrą',
    miejscownik: 'Uczonej Lyrze'
  },
  'Wędrowny Kramarz Bogusz': {
    mianownik: 'Wędrowny Kramarz Bogusz',
    dopelniacz: 'Wędrownego Kramarza Bogusza',
    celownik: 'Wędrownemu Kramarzowi Boguszowi',
    biernik: 'Wędrownego Kramarza Bogusza',
    narzednik: 'Wędrownym Kramarzem Boguszem',
    miejscownik: 'Wędrownym Kramarzu Boguszu'
  },
  'Tropiciel Aldric': {
    mianownik: 'Tropiciel Aldric',
    dopelniacz: 'Tropiciela Aldrica',
    celownik: 'Tropicielowi Aldricowi',
    biernik: 'Tropiciela Aldrica',
    narzednik: 'Tropicielem Aldricem',
    miejscownik: 'Tropicielu Aldricu'
  },
  'Paser Gniewosz': {
    mianownik: 'Paser Gniewosz',
    dopelniacz: 'Pasera Gniewosza',
    celownik: 'Paserowi Gniewoszowi',
    biernik: 'Pasera Gniewosza',
    narzednik: 'Paserem Gniewoszem',
    miejscownik: 'Paserze Gniewoszu'
  },
  'Kaelen Vane': {
    mianownik: 'Kaelen Vane',
    dopelniacz: "Kaelena Vane'a",
    celownik: "Kaelenowi Vane'owi",
    biernik: "Kaelena Vane'a",
    narzednik: "Kaelenem Vane'em",
    miejscownik: "Kaelenie Vane'em"
  }
};

/**
 * Normalizes string keys for lookup (trimmed, handles extra spaces).
 */
function normalizeKey(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Declines a single masculine adjective ending in -y or -i.
 */
function declineMasculineAdjective(word: string, targetCase: PolishCase): string {
  if (word.endsWith('y')) {
    const stem = word.slice(0, -1);
    switch (targetCase) {
      case 'dopelniacz':
      case 'biernik':
        return `${stem}ego`;
      case 'celownik':
        return `${stem}emu`;
      case 'narzednik':
      case 'miejscownik':
        return `${stem}ym`;
      default:
        return word;
    }
  }
  if (word.endsWith('i')) {
    const stem = word.slice(0, -1);
    switch (targetCase) {
      case 'dopelniacz':
      case 'biernik':
        return `${stem}iego`;
      case 'celownik':
        return `${stem}iemu`;
      case 'narzednik':
      case 'miejscownik':
        return `${stem}im`;
      default:
        return word;
    }
  }
  return word;
}

/**
 * Declines a single animate masculine or feminine noun using Polish phonotactics.
 */
function declineNoun(word: string, targetCase: PolishCase): string {
  if (targetCase === 'mianownik') return word;

  // Words ending in -a (masculine or feminine: Bandyta, Rozbójnik-no, Łupieżca, Lyra)
  if (word.endsWith('a')) {
    const stem = word.slice(0, -1);
    const lastChar = stem.slice(-1).toLowerCase();
    const lastTwo = stem.slice(-2).toLowerCase();

    switch (targetCase) {
      case 'dopelniacz':
        if (['k', 'g'].includes(lastChar)) return `${stem}i`;
        return `${stem}y`;
      case 'celownik':
      case 'miejscownik':
        if (lastTwo === 'cz' || lastTwo === 'sz' || lastTwo === 'rz' || lastChar === 'c' || lastChar === 'ż') {
          return `${stem}y`;
        }
        if (lastChar === 't') {
          return `${stem.slice(0, -1)}cie`;
        }
        if (lastChar === 'd') {
          return `${stem.slice(0, -1)}dzie`;
        }
        if (lastChar === 'r') {
          return `${stem.slice(0, -1)}rze`;
        }
        return `${stem}e`;
      case 'biernik':
        return `${stem}ę`;
      case 'narzednik':
        return `${stem}ą`;
    }
  }

  // Nouns ending in -ec with mobile e (Utopiec, Kupiec, Strzelec)
  if (word.endsWith('ec') && word.length > 3) {
    const stem = `${word.slice(0, -2)}c`;
    switch (targetCase) {
      case 'dopelniacz':
      case 'biernik':
        return `${stem}a`;
      case 'celownik':
        return `${stem}owi`;
      case 'narzednik':
        return `${stem}em`;
      case 'miejscownik':
        return `${stem}u`;
    }
  }

  // Animate masculine nouns ending in consonant (Wiarus, Czempion, Wilk, Bies, Maruder)
  switch (targetCase) {
    case 'dopelniacz':
    case 'biernik':
      return `${word}a`;
    case 'celownik':
      return `${word}owi`;
    case 'narzednik':
      if (word.endsWith('k') || word.endsWith('g')) {
        return `${word}iem`;
      }
      return `${word}em`;
    case 'miejscownik':
      if (word.endsWith('k') || word.endsWith('g') || word.endsWith('ch')) {
        return `${word}u`;
      }
      return `${word}ie`;
    default:
      return word;
  }
}

/**
 * Declines an arbitrary phrase (e.g. "Zdziczały Rozbójnik", "Stary Wilk z Lasu").
 * Splits into tokens, preserves prepositional phrases (np. "z Jaru", "Szlaku", "z Głębin"),
 * and declines leading adjectives and core noun.
 */
function declineArbitraryPhrase(phrase: string, targetCase: PolishCase): string {
  if (targetCase === 'mianownik') return phrase;

  // Handle dash or em-dash compounds (e.g. "Leszy — Duch Puszczy")
  if (phrase.includes(' — ')) {
    const [left, right] = phrase.split(' — ');
    return `${declineArbitraryPhrase(left, targetCase)} — ${declineArbitraryPhrase(right, targetCase)}`;
  }
  if (phrase.includes(' - ')) {
    const [left, right] = phrase.split(' - ');
    return `${declineArbitraryPhrase(left, targetCase)} - ${declineArbitraryPhrase(right, targetCase)}`;
  }

  const tokens = phrase.split(' ');
  if (tokens.length === 1) {
    return declineNoun(tokens[0], targetCase);
  }

  const prepIndex = tokens.findIndex((t) =>
    ['z', 'ze', 'w', 'we', 'od', 'do', 'dla', 'nad', 'pod'].includes(t.toLowerCase())
  );

  const mainTokens = prepIndex === -1 ? tokens : tokens.slice(0, prepIndex);
  const tailTokens = prepIndex === -1 ? [] : tokens.slice(prepIndex);

  // If the last token of mainTokens looks like a genitive modifier (e.g. "Szlaku", "Krypt", "Cieni", "Katakumb")
  // and we have multiple tokens, treat only the head as subject to declension.
  const isGenitiveTail =
    mainTokens.length >= 2 &&
    ['szlaku', 'krypt', 'cieni', 'katakumb', 'pogórza', 'mogił', 'lasu'].includes(
      mainTokens[mainTokens.length - 1].toLowerCase()
    );

  const activeTokens = isGenitiveTail ? mainTokens.slice(0, -1) : mainTokens;
  const modifierToken = isGenitiveTail ? [mainTokens[mainTokens.length - 1]] : [];

  const declinedActive = activeTokens.map((t, idx) => {
    // If it's not the last word of the active chunk, treat as adjective if it ends with -y or -i
    if (idx < activeTokens.length - 1) {
      if (t.endsWith('y') || t.endsWith('i')) {
        return declineMasculineAdjective(t, targetCase);
      }
    }
    // If last active token
    if (idx === activeTokens.length - 1) {
      if (t.endsWith('y') || t.endsWith('i')) {
        // e.g. "Leszy", "Moczarowy"
        return declineMasculineAdjective(t, targetCase);
      }
      return declineNoun(t, targetCase);
    }
    return t;
  });

  return [...declinedActive, ...modifierToken, ...tailTokens].join(' ');
}

/**
 * Declines any character name, enemy title, or Polish noun phrase into the requested grammatical case.
 *
 * @example
 * declinePolish('Bandyta', 'biernik') // => "Bandytę"
 * declinePolish('Zdziczały Maruder Szlaku', 'biernik') // => "Zdziczałego Marudera Szlaku"
 * declinePolish('Pradawny Bies', 'narzednik') // => "Pradawnym Biesem"
 * declinePolish('Utopiec Moczarowy', 'dopelniacz') // => "Utopca Moczarowego"
 */
export function declinePolish(name: string, targetCase: PolishCase): string {
  if (!name || targetCase === 'mianownik') return name;

  const key = normalizeKey(name);
  const known = KNOWN_ENTITIES[key];
  if (known) {
    return known[targetCase];
  }

  // Fallback to morphological engine
  return declineArbitraryPhrase(name, targetCase);
}

/**
 * Shortcut for Biernik (Accusative: Kogo? Co?)
 * e.g. "Pokonano Bandytę", "Pudło w Bandytę"
 */
export function accusative(name: string): string {
  return declinePolish(name, 'biernik');
}

/**
 * Shortcut for Dopełniacz (Genitive: Kogo? Czego?)
 * e.g. "Uniknąłeś ataku Bandyty", "Ciało Bandyty"
 */
export function genitive(name: string): string {
  return declinePolish(name, 'dopelniacz');
}

/**
 * Shortcut for Celownik (Dative: Komu? Czemu?)
 * e.g. "Zadano obrażenia: Bandycie"
 */
export function dative(name: string): string {
  return declinePolish(name, 'celownik');
}

/**
 * Shortcut for Narzędnik (Instrumental: Z kim? Nad kim?)
 * e.g. "Zwycięstwo nad Bandytą", "Walka z Bandytą"
 */
export function instrumental(name: string): string {
  return declinePolish(name, 'narzednik');
}
