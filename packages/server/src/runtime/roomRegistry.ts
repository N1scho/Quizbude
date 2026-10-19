import type { RoomCode } from '@quizbude/protocol';
import type { RoomHandle } from './roomHandle.js';

/** Raeume leben im Prozessspeicher. Ruling 4: keine Persistenz. */
export class RoomRegistry {
  private readonly rooms = new Map<string, RoomHandle>();

  has(code: RoomCode): boolean {
    return this.rooms.has(code);
  }

  byCode(code: RoomCode): RoomHandle | undefined {
    return this.rooms.get(code);
  }

  add(handle: RoomHandle): void {
    this.rooms.set(handle.code, handle);
  }

  remove(code: RoomCode): void {
    this.rooms.get(code)?.dispose();
    this.rooms.delete(code);
  }

  get size(): number {
    return this.rooms.size;
  }
}
