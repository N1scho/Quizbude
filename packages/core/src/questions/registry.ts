import type { AnyQuestionTypeHandler } from './handler.js';
import { singleChoiceHandler } from './singleChoice.js';
import { trueFalseHandler } from './trueFalse.js';

export interface QuestionTypeRegistry {
  get(type: string): AnyQuestionTypeHandler;
  has(type: string): boolean;
  register(handler: AnyQuestionTypeHandler): void;
}

export function createRegistry(handlers: readonly AnyQuestionTypeHandler[] = []): QuestionTypeRegistry {
  const map = new Map<string, AnyQuestionTypeHandler>();
  for (const h of handlers) map.set(h.type, h);
  return {
    get(type: string): AnyQuestionTypeHandler {
      const h = map.get(type);
      if (h === undefined) throw new Error(`Unbekannter Fragetyp: ${type}`);
      return h;
    },
    has(type: string): boolean {
      return map.has(type);
    },
    register(handler: AnyQuestionTypeHandler): void {
      map.set(handler.type, handler);
    },
  };
}

/**
 * Der einzige Ort, an dem ein neuer Fragetyp eingetragen wird.
 * Ein Praezisionstyp (Schieberegler) kaeme hier als eine Zeile hinzu.
 */
export function createDefaultRegistry(): QuestionTypeRegistry {
  return createRegistry([singleChoiceHandler, trueFalseHandler]);
}
