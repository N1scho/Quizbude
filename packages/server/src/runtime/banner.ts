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

import type { LanAddress } from './network.js';

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
    `      http://localhost:${facts.port}/host/`,
    '',
  ];

  if (best === undefined) {
    out.push(
      '  Keine Adresse im lokalen Netz gefunden - ist das WLAN an?',
      '  Ohne sie kommt nur dieser Rechner an das Spiel heran:',
      `      ${playUrl('localhost', facts.port)}`,
      '',
    );
  } else {
    out.push(
      '  Das tippen die Gaeste in ihr Handy:',
      `      ${playUrl(best.address, facts.port)}`,
      `      (Netzwerkkarte: ${best.iface})`,
      '',
    );
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
    '  Beenden mit Strg+C.',
    '',
  );
  return out;
}
