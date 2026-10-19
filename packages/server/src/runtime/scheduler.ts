import type { TimerToken } from '@quizbude/core';
import type { MonoMs } from '@quizbude/protocol';
import { nowMono } from './clock.js';

/**
 * TimerToken auf setTimeout. Timer sind Hinweise, die Uhr ist die Wahrheit -
 * deshalb darf ein Timer zu spaet kommen, ohne dass etwas kaputtgeht.
 */
export class Scheduler {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly onFire: (token: TimerToken) => void) {}

  private static key(token: TimerToken): string {
    return `${token.kind}:${token.gen}`;
  }

  schedule(token: TimerToken, atMono: MonoMs): void {
    this.cancel(token);
    const delay = Math.max(0, atMono - nowMono());
    const handle = setTimeout(() => {
      this.timers.delete(Scheduler.key(token));
      this.onFire(token);
    }, delay);
    this.timers.set(Scheduler.key(token), handle);
  }

  cancel(token: TimerToken): void {
    const key = Scheduler.key(token);
    const handle = this.timers.get(key);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.timers.delete(key);
    }
  }

  clear(): void {
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
  }
}
