/**
 * Die Buehne im Standardbrowser oeffnen.
 *
 * Nur der Doppelklick-Start will das - wer `npm start` tippt, bekommt
 * nicht ungefragt ein Fenster aufgerissen. Deshalb haengt es an einer
 * Umgebungsvariablen, die nur `quizbude-starten.cmd` setzt.
 *
 * Geoeffnet wird erst, wenn der Server wirklich lauscht, und mit dem Port,
 * den er genommen hat - sonst zeigt der Browser bei belegter 3000 auf das
 * falsche Programm.
 */

export const OPEN_FLAG = 'QUIZBUDE_BUEHNE_OEFFNEN';

export interface BrowserCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export function shouldOpenBrowser(flag: string | undefined): boolean {
  return flag === '1';
}

/**
 * Der Befehl, der dem Betriebssystem seinen eigenen Standardbrowser
 * ueberlaesst. Unter Windows braucht `start` ein leeres erstes Argument -
 * es haelt den Fenstertitel, und ohne es wuerde die URL dafuer gehalten.
 */
export function browserCommand(platform: string, url: string): BrowserCommand {
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] };
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}
