import {
  step,
  type Effect,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type TimerToken,
} from '@quizbude/core';
import type { MonoMs, RoomCode } from '@quizbude/protocol';
import { nowMono } from './clock.js';
import { Scheduler } from './scheduler.js';

export type EffectSink = (effect: Effect) => void;

/**
 * Haelt den GameState, serialisiert Eingaben und fuehrt Effekte aus.
 * Der einzige veraenderliche Halter im ganzen System.
 */
export class RoomHandle {
  private current: GameState;
  private readonly scheduler: Scheduler;
  private running = false;
  private readonly queue: { event: GameEvent; at: MonoMs }[] = [];

  constructor(
    readonly code: RoomCode,
    initial: GameState,
    private readonly deps: EngineDeps,
    private readonly sink: EffectSink,
  ) {
    this.current = initial;
    this.scheduler = new Scheduler((token) => {
      this.dispatch({ kind: 'TimerFired', token });
    });
  }

  get state(): GameState {
    return this.current;
  }

  /** step() darf nie reentrant laufen: Effekte koennen neue Eingaben ausloesen. */
  dispatch(event: GameEvent, at: MonoMs = nowMono()): void {
    this.queue.push({ event, at });
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next === undefined) break;
        const result = step(this.current, { event: next.event, at: next.at }, this.deps);
        this.current = result.state;
        for (const effect of result.effects) this.apply(effect);
      }
    } finally {
      this.running = false;
    }
  }

  private apply(effect: Effect): void {
    switch (effect.kind) {
      case 'scheduleTimer':
        this.scheduler.schedule(effect.token, effect.atMono);
        return;
      case 'cancelTimer':
        this.scheduler.cancel(effect.token);
        return;
      default:
        this.sink(effect);
    }
  }

  cancelTimer(token: TimerToken): void {
    this.scheduler.cancel(token);
  }

  dispose(): void {
    this.scheduler.clear();
  }
}
