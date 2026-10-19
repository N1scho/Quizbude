import { asMonoMs, type MonoMs } from '@quizbude/protocol';

/**
 * Die monotone Uhr. Sie springt nicht bei Zeitsynchronisation, Sommerzeit
 * oder manueller Korrektur - deshalb haengt jede Wertung an ihr und nicht
 * an Date.now().
 */
const START = process.hrtime.bigint();

export function nowMono(): MonoMs {
  return asMonoMs(Number(process.hrtime.bigint() - START) / 1e6);
}

/** Was die Clients als gemeinsame Uhr sehen. Identisch mit der monotonen Uhr. */
export function serverTimeMs(): number {
  return nowMono();
}
