/**
 * Was beim Start auf dem Bildschirm steht.
 *
 * Reiner Text aus reinen Angaben - dadurch laesst sich pruefen, dass die
 * Adresse fuer die Gaeste wirklich genannt wird und die Alternativen
 * darunter stehen.
 *
 * Bewusst ohne Umlaute: die Konsole startet unter Windows je nach
 * Codepage, und ein zerschossenes "Buehne" liest sich schlechter als ein
 * ungewohntes.
 */

import { isWeakGuess, type LanAddress } from './network.js';
import { STAGE_HOST } from './startup.js';

export interface BannerFacts {
  readonly port: number;
  readonly addresses: readonly LanAddress[];
  readonly rooms: number;
}

const LINE = '-'.repeat(62);

function playUrl(host: string, port: number): string {
  return `http://${host}:${port}/play/`;
}

export function stageBanner(facts: BannerFacts): readonly string[] {
  const [best, ...rest] = facts.addresses;
  const out: string[] = [
    '',
    LINE,
    '  Die Quizbude ist offen.',
    LINE,
    '',
    '  Buehne auf diesem Bildschirm:',
    `      http://${STAGE_HOST}:${facts.port}/host/`,
    '',
  ];

  if (best === undefined) {
    out.push(
      '  Keine Adresse im lokalen Netz gefunden - ist das WLAN an?',
      '  Ohne sie kommt nur dieser Rechner an das Spiel heran:',
      `      ${playUrl(STAGE_HOST, facts.port)}`,
      '',
    );
  } else {
    // Eine Karte, die die Heuristik selbst fuer virtuell haelt, wird als
    // Vermutung angesagt und nicht als Tatsache. Vorher sah der Fall
    // "nur der Hyper-V-Schalter da" genauso aus wie "echtes WLAN da".
    const unsicher = isWeakGuess(best);
    out.push(
      unsicher
        ? '  Wahrscheinlich tippen die Gaeste das in ihr Handy:'
        : '  Das tippen die Gaeste in ihr Handy:',
      `      ${playUrl(best.address, facts.port)}`,
      `      (Netzwerkkarte: ${best.iface})`,
    );
    if (unsicher) {
      out.push(
        '  Sicher ist das nicht: diese Karte sieht virtuell aus. Ist das',
        '  WLAN an? Kommt kein Handy durch, liegt es meistens daran.',
      );
    }
    out.push('');
    if (rest.length > 0) {
      out.push('  Kommen sie da nicht an, ist es eine von diesen:');
      for (const a of rest) out.push(`      ${playUrl(a.address, facts.port)}   (${a.iface})`);
      out.push('');
    }
  }

  out.push(
    '  Kommt kein Handy durch, hat Windows beim ersten Start den Zugang',
    '  ins Netz verweigert. Dann in der Windows-Firewall Node.js suchen',
    '  und den Haken bei "Privat" setzen - nur "Oeffentlich" reicht fuer',
    '  das Heim-WLAN nicht.',
    '',
    `  Raeume im Speicher: ${facts.rooms}`,
    '  Beenden: dieses Fenster schliessen oder Strg+C.',
    '',
  );
  return out;
}
