/**
 * Welche Adresse tippt der Gast in sein Handy?
 *
 * `localhost` ist fuer Gaeste wertlos - es zeigt auf ihr eigenes Telefon.
 * Gebraucht wird die Adresse dieses Rechners im WLAN. Neben der echten
 * Netzwerkkarte liegen auf einem gewachsenen Windows aber oft ein halbes
 * Dutzend weitere: VPN, VirtualBox, VMware, Hyper-V, WSL, Docker.
 *
 * Der Name allein reicht nicht. Auf dem Zielrechner heisst die
 * VirtualBox-Karte schlicht "Ethernet 4" und die echte "Ethernet 6" - am
 * Namen sind sie nicht zu unterscheiden. Verraten wird die virtuelle Karte
 * erst von ihrer MAC-Adresse (`0a:00:27:...`, lokal vergeben) und davon,
 * dass sie die `.1` ihres eigenen Netzes haelt.
 *
 * Deshalb wird hier nicht entschieden, sondern gereiht: der
 * wahrscheinlichste Kandidat kommt zuerst, die uebrigen bleiben sichtbar.
 * Liegt die Vermutung daneben, liest ein Mensch die naechste Zeile.
 */

/** Ein Eintrag in der Form, die `os.networkInterfaces()` liefert. */
export interface InterfaceEntry {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
  readonly mac?: string;
  readonly netmask?: string;
}

/** Die Struktur, die `os.networkInterfaces()` zurueckgibt. */
export type Interfaces = Readonly<Record<string, readonly InterfaceEntry[] | undefined>>;

export interface LanAddress {
  readonly iface: string;
  readonly address: string;
}

/** Namen, die eine virtuelle Karte oder einen Tunnel ankuendigen. */
const VIRTUAL_NAME_MARKERS: readonly string[] = [
  'vethernet',
  'hyper-v',
  'wsl',
  'virtualbox',
  'vmware',
  'vmnet',
  'docker',
  'vpn',
  'tailscale',
  'zerotier',
  'wireguard',
  'openvpn',
  'wintun',
  'tap-',
  'tunnel',
  'bluetooth',
  'loopback',
  'virtual',
  'npcap',
  'hamachi',
];

/** Namen, die nach Funk klingen - deutsche und englische Windows-Fassung. */
const WIRELESS_NAME_MARKERS: readonly string[] = ['wi-fi', 'wifi', 'wlan', 'wireless', 'drahtlos'];

/**
 * MAC-Praefixe bekannter virtueller Karten. Die Liste ist nicht
 * vollstaendig - sie muss es nicht sein, denn daneben greift die Regel
 * ueber das Bit fuer lokal vergebene Adressen.
 */
const VIRTUAL_MAC_PREFIXES: readonly string[] = [
  '0a:00:27', // VirtualBox Host-Only
  '08:00:27', // VirtualBox Gast
  '00:50:56', // VMware
  '00:0c:29', // VMware
  '00:05:69', // VMware
  '00:1c:14', // VMware
  '00:15:5d', // Hyper-V, WSL
  '00:03:ff', // Microsoft virtuell
  '02:42', //    Docker
  '00:16:3e', // Xen
];

function isIPv4(entry: InterfaceEntry): boolean {
  return entry.family === 'IPv4' || entry.family === 4;
}

/** Die vier Zahlen einer IPv4-Adresse - oder null, wenn es keine ist. */
function octets(address: string): readonly [number, number, number, number] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : -1));
  const [a = -1, b = -1, c = -1, d = -1] = nums;
  if (a < 0 || b < 0 || c < 0 || d < 0) return null;
  if (a > 255 || b > 255 || c > 255 || d > 255) return null;
  return [a, b, c, d];
}

/**
 * Die drei privaten Bereiche, nach Wahrscheinlichkeit gereiht.
 * 172.16-31 steht zuletzt: dort liegen Docker, WSL und Hyper-V.
 * -1 heisst: kein privater Bereich, kommt nicht in Frage.
 */
function rangeScore(o: readonly [number, number, number, number]): number {
  const [a, b] = o;
  if (a === 192 && b === 168) return 2;
  if (a === 10) return 1;
  if (a === 172 && b >= 16 && b <= 31) return 0;
  return -1;
}

function hasMarker(name: string, markers: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

/**
 * Eine MAC gilt als virtuell, wenn sie leer ist (Tunnel haben keine),
 * einem bekannten Praefix folgt, oder wenn im ersten Byte das Bit fuer
 * "lokal vergeben" gesetzt ist - echte Hardware traegt eine bei der IEEE
 * gekaufte Kennung ohne dieses Bit.
 */
function isVirtualMac(mac: string | undefined): boolean {
  if (mac === undefined || mac === '') return false;
  const lower = mac.toLowerCase();
  if (/^0{2}(:0{2}){5}$/.test(lower)) return true;
  if (VIRTUAL_MAC_PREFIXES.some((p) => lower.startsWith(p))) return true;
  const first = lower.split(':')[0];
  if (first === undefined || !/^[0-9a-f]{2}$/.test(first)) return false;
  return (Number.parseInt(first, 16) & 0b10) !== 0;
}

/** /31 und /32 sind Punkt-zu-Punkt - daran haengt kein WLAN. */
function isPointToPoint(netmask: string | undefined): boolean {
  return netmask === '255.255.255.255' || netmask === '255.255.255.254';
}

/** Ein /24, dessen Adresse auf .1 endet: so sieht ein Host-Only-Netz aus. */
function looksLikeOwnGateway(
  o: readonly [number, number, number, number],
  netmask: string | undefined,
): boolean {
  return o[3] === 1 && netmask === '255.255.255.0';
}

function scoreOf(iface: string, entry: InterfaceEntry, o: readonly [number, number, number, number]): number {
  let score = rangeScore(o);
  if (hasMarker(iface, VIRTUAL_NAME_MARKERS)) score -= 8;
  if (isVirtualMac(entry.mac)) score -= 8;
  if (isPointToPoint(entry.netmask)) score -= 4;
  if (looksLikeOwnGateway(o, entry.netmask)) score -= 1;
  if (hasMarker(iface, WIRELESS_NAME_MARKERS)) score += 2;
  return score;
}

/**
 * Alle Adressen, unter denen dieser Rechner im lokalen Netz erreichbar
 * ist - der wahrscheinlichste Kandidat zuerst.
 *
 * Draussen bleiben: interne Adressen, alles ausser IPv4 und alles
 * ausserhalb der privaten Bereiche. APIPA (169.254.x.x) faellt damit von
 * selbst weg - ein eigener Riegel dafuer waere eine Zeile, die kein Test
 * rot bekommen kann. Die Reihung ist bei gleicher Bewertung stabil, damit
 * zwei Laeufe dasselbe sagen.
 */
export function lanAddresses(interfaces: Interfaces): LanAddress[] {
  const found: { iface: string; address: string; score: number }[] = [];
  for (const [iface, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.internal) continue;
      if (!isIPv4(entry)) continue;
      const o = octets(entry.address);
      if (o === null) continue;
      if (rangeScore(o) < 0) continue;
      found.push({ iface, address: entry.address, score: scoreOf(iface, entry, o) });
    }
  }
  found.sort((x, y) => {
    if (x.score !== y.score) return y.score - x.score;
    if (x.iface !== y.iface) return x.iface < y.iface ? -1 : 1;
    return x.address < y.address ? -1 : x.address > y.address ? 1 : 0;
  });
  return found.map(({ iface, address }) => ({ iface, address }));
}
