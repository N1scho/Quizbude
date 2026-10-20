import { describe, expect, it } from 'vitest';
import { lanAddresses, type Interfaces } from '../../packages/server/src/runtime/network.js';

/**
 * Der Pruefstein ist der echte Rechner, auf dem gespielt wird. Dort liegen
 * neben der Netzwerkkarte ein VPN-Tunnel, Tailscale, VirtualBox und zwei
 * VMware-Netze - und die VirtualBox-Karte heisst "Ethernet 4", die echte
 * "Ethernet 6". Am Namen sind sie nicht zu trennen.
 *
 * Richtig ist 192.168.0.160 auf "Ethernet 6": ueber die laeuft die
 * Standardroute.
 */
const ECHTER_RECHNER: Interfaces = {
  'ExpressVPNOpenVPN WinTUN Adapter': [
    {
      address: '100.64.100.6',
      netmask: '255.255.255.255',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
    },
  ],
  Tailscale: [
    {
      address: '169.254.83.107',
      netmask: '255.255.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: false,
    },
  ],
  'Ethernet 4': [
    {
      address: '192.168.56.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '0a:00:27:00:00:09',
      internal: false,
    },
  ],
  'VMware Network Adapter VMnet1': [
    {
      address: '192.168.159.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:50:56:c0:00:01',
      internal: false,
    },
  ],
  'VMware Network Adapter VMnet8': [
    {
      address: '192.168.91.1',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:50:56:c0:00:08',
      internal: false,
    },
  ],
  'Ethernet 6': [
    {
      address: '192.168.0.160',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '2c:f0:5d:97:fd:74',
      internal: false,
    },
  ],
  'Loopback Pseudo-Interface 1': [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
    },
  ],
};

describe('Die Adresse fuer die Gaeste', () => {
  it('nennt auf dem echten Rechner die Netzwerkkarte zuerst', () => {
    const gefunden = lanAddresses(ECHTER_RECHNER);
    expect(gefunden[0]).toEqual({ iface: 'Ethernet 6', address: '192.168.0.160' });
  });

  it('wirft APIPA, interne Adressen und alles ausserhalb der privaten Bereiche weg', () => {
    const adressen = lanAddresses(ECHTER_RECHNER).map((a) => a.address);
    expect(adressen).not.toContain('169.254.83.107'); // APIPA
    expect(adressen).not.toContain('127.0.0.1'); // intern
    expect(adressen).not.toContain('100.64.100.6'); // kein privater Bereich
  });

  it('verschweigt die uebrigen Kandidaten nicht', () => {
    const adressen = lanAddresses(ECHTER_RECHNER).map((a) => a.address);
    expect(adressen).toEqual(['192.168.0.160', '192.168.56.1', '192.168.159.1', '192.168.91.1']);
  });

  /**
   * Der Kern des schwierigen Falls: nur die MAC trennt die beiden.
   *
   * Eine erste Fassung dieses Tests nahm 192.168.56.1 als virtuelle Karte -
   * und blieb gruen, als die MAC-Regel ausgeschaltet wurde: die .1 im /24
   * allein hatte sie schon hinten angestellt. Der Test band damit den
   * Begleitumstand statt der Ursache. Jetzt sind Name, Bereich, Netzmaske
   * und Endziffer gleich; uebrig bleibt die MAC. Dass 'Adapter A'
   * alphabetisch vorn steht, ist Absicht - ohne die Regel gewaenne sie.
   */
  it('erkennt die virtuelle Karte an ihrer MAC, wenn sonst nichts sie verraet', () => {
    const nurMac: Interfaces = {
      'Adapter A': [
        {
          address: '192.168.3.77',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '0a:00:27:00:00:09',
          internal: false,
        },
      ],
      'Adapter B': [
        {
          address: '192.168.0.160',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '2c:f0:5d:97:fd:74',
          internal: false,
        },
      ],
    };
    expect(lanAddresses(nurMac).map((a) => a.address)).toEqual(['192.168.0.160', '192.168.3.77']);
  });

  /**
   * Dasselbe fuer den Namen: gleiche MAC-Art, gleicher Bereich, gleiche
   * Netzmaske, keine .1. 'Docker Desktop' steht alphabetisch vorn - ohne
   * die Namensregel gewaenne es.
   */
  it('erkennt die virtuelle Karte an ihrem Namen, wenn die MAC harmlos aussieht', () => {
    const nurName: Interfaces = {
      'Docker Desktop': [
        {
          address: '192.168.4.77',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '2c:f0:5d:97:fd:70',
          internal: false,
        },
      ],
      Ethernet: [
        {
          address: '192.168.0.160',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '2c:f0:5d:97:fd:74',
          internal: false,
        },
      ],
    };
    expect(lanAddresses(nurName).map((a) => a.address)).toEqual(['192.168.0.160', '192.168.4.77']);
  });

  it('zieht Funk dem Kabel vor, wenn beide echt sind', () => {
    const beides: Interfaces = {
      Ethernet: [
        { address: '192.168.0.50', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false },
      ],
      WLAN: [
        { address: '192.168.0.51', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:71', internal: false },
      ],
    };
    expect(lanAddresses(beides)[0]?.iface).toBe('WLAN');
  });

  it('stellt 172.16-31 hinten an - dort liegen Docker, WSL und Hyper-V', () => {
    const gemischt: Interfaces = {
      A: [{ address: '172.20.1.5', netmask: '255.255.0.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false }],
      B: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:71', internal: false }],
      C: [{ address: '192.168.1.5', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:72', internal: false }],
    };
    expect(lanAddresses(gemischt).map((a) => a.address)).toEqual(['192.168.1.5', '10.0.0.5', '172.20.1.5']);
  });

  it('laesst IPv6 liegen - die Gaeste tippen IPv4', () => {
    const nurSechs: Interfaces = {
      WLAN: [
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '2c:f0:5d:97:fd:70', internal: false },
      ],
    };
    expect(lanAddresses(nurSechs)).toEqual([]);
  });

  it('kennt auch die alte Schreibweise der Familie als Zahl', () => {
    const alt: Interfaces = {
      WLAN: [{ address: '192.168.2.7', netmask: '255.255.255.0', family: 4, mac: '2c:f0:5d:97:fd:70', internal: false }],
    };
    expect(lanAddresses(alt).map((a) => a.address)).toEqual(['192.168.2.7']);
  });

  /**
   * Der Bereichsfilter allein wuerde 127.0.0.1 ohnehin wegwerfen. Damit
   * der `internal`-Riegel wirklich gebunden ist, liegt hier eine interne
   * Karte mitten im privaten Bereich - so, wie sie in einem Container
   * vorkommt.
   */
  it('wirft interne Karten auch dann weg, wenn ihre Adresse privat ist', () => {
    const innen: Interfaces = {
      lo0: [{ address: '10.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true }],
      WLAN: [
        { address: '10.0.0.50', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false },
      ],
    };
    expect(lanAddresses(innen).map((a) => a.address)).toEqual(['10.0.0.50']);
  });

  /**
   * Ein VPN-Tunnel traegt oft eine ganz gewoehnlich aussehende MAC und
   * einen harmlosen Namen. Verraten wird er von seiner Netzmaske: an einem
   * /32 haengt kein WLAN.
   */
  it('stellt ein /32 hinter ein richtiges Netz', () => {
    const tunnel: Interfaces = {
      'Adapter A': [
        { address: '10.8.0.6', netmask: '255.255.255.255', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false },
      ],
      'Adapter B': [
        { address: '10.0.0.50', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:71', internal: false },
      ],
    };
    expect(lanAddresses(tunnel).map((a) => a.address)).toEqual(['10.0.0.50', '10.8.0.6']);
  });

  /**
   * Host-Only-Netze halten die .1 ihres eigenen Netzes. Auch ohne
   * verraeterische MAC bleibt das ein Grund, sie hinten anzustellen.
   */
  it('stellt die .1 eines /24 hinter eine vergebene Adresse', () => {
    const eigenesTor: Interfaces = {
      'Adapter A': [
        { address: '192.168.5.1', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false },
      ],
      'Adapter B': [
        { address: '192.168.9.77', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:71', internal: false },
      ],
    };
    expect(lanAddresses(eigenesTor).map((a) => a.address)).toEqual(['192.168.9.77', '192.168.5.1']);
  });

  it('kommt mit gar keiner Karte zurecht', () => {
    expect(lanAddresses({})).toEqual([]);
    expect(lanAddresses({ Leer: undefined })).toEqual([]);
  });

  it('reiht bei gleicher Bewertung immer gleich - zwei Laeufe, dieselbe Ansage', () => {
    const gleich: Interfaces = {
      Zebra: [{ address: '192.168.1.9', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:70', internal: false }],
      Alpha: [{ address: '192.168.1.8', netmask: '255.255.255.0', family: 'IPv4', mac: '2c:f0:5d:97:fd:71', internal: false }],
    };
    expect(lanAddresses(gleich).map((a) => a.iface)).toEqual(['Alpha', 'Zebra']);
    expect(lanAddresses(gleich)).toEqual(lanAddresses(gleich));
  });
});
