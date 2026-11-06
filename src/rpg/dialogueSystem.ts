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

export const DIALOGUE_TREES: Record<string, Record<string, DialogueNode>> = {
  npc_vaelen: {
    root: {
      id: 'root',
      speakerName: 'Kapitan Vaelen',
      speakerTitle: 'Dowódca Straży Dziedzińca',
      text: 'Zatrzymaj się, wędrowcze. Wrota do Skarbca Konklawe na wschodzie pozostają zapieczętowane od nocy, gdy runy w centralnym kręgu zaczęły pulsować błękitnym ogniem.',
      choices: [
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
  }
};
