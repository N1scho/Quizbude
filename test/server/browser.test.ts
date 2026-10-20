import { describe, expect, it } from 'vitest';
import { browserCommand, shouldOpenBrowser } from '../../packages/server/src/runtime/browser.js';

describe('Die Buehne im Browser oeffnen', () => {
  it('oeffnet nur, wenn der Doppelklick-Start es verlangt', () => {
    expect(shouldOpenBrowser('1')).toBe(true);
    expect(shouldOpenBrowser(undefined)).toBe(false);
    expect(shouldOpenBrowser('')).toBe(false);
    expect(shouldOpenBrowser('0')).toBe(false);
    expect(shouldOpenBrowser('ja')).toBe(false);
  });

  /**
   * `start` haelt sein erstes Argument fuer den Fenstertitel. Ohne das
   * leere Argument davor verschwindet die URL im Titel und es oeffnet
   * sich nichts.
   */
  it('gibt unter Windows den leeren Fenstertitel vor der URL mit', () => {
    const b = browserCommand('win32', 'http://localhost:3000/host/');
    expect(b.command).toBe('cmd');
    expect(b.args).toEqual(['/c', 'start', '', 'http://localhost:3000/host/']);
  });

  it('kennt auch macOS und Linux', () => {
    expect(browserCommand('darwin', 'http://x/')).toEqual({ command: 'open', args: ['http://x/'] });
    expect(browserCommand('linux', 'http://x/')).toEqual({ command: 'xdg-open', args: ['http://x/'] });
  });
});
