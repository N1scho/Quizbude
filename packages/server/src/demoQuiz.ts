import {
  createDefaultRegistry,
  loadQuestion,
  type LoadedQuestion,
  type QuestionTypeRegistry,
} from '@quizbude/core';

export interface DemoQuiz {
  readonly title: string;
  readonly questions: readonly LoadedQuestion[];
}

/**
 * Das Demo-Quiz lebt im Prozess (Ruling 4: keine Persistenz).
 * Zwei Fragen genuegen fuer den Durchstich: eine Single-Choice mit vier
 * Optionen und eine Wahr/Falsch-Frage.
 */
export function loadDemoQuiz(registry: QuestionTypeRegistry = createDefaultRegistry()): DemoQuiz {
  const raw = [
    {
      id: 'demo-1',
      type: 'single_choice',
      prompt: 'Welcher Planet ist der Sonne am nächsten?',
      timeLimitMs: 20_000,
      pointsFactor: 1,
      spec: {
        options: [
          { label: 'Merkur' },
          { label: 'Venus' },
          { label: 'Mars' },
          { label: 'Jupiter' },
        ],
        correctIndex: 0,
        explanation: 'Merkur umkreist die Sonne im Mittel in 58 Millionen Kilometern Abstand.',
      },
    },
    {
      id: 'demo-2',
      type: 'true_false',
      prompt: 'Ein Oktopus hat drei Herzen.',
      timeLimitMs: 15_000,
      pointsFactor: 1,
      spec: {
        correct: true,
        explanation: 'Zwei Kiemenherzen pumpen durch die Kiemen, ein Körperherz durch den Rest.',
      },
    },
  ] as const;

  // Autorenzeit: Fragetext UND Spezifikation werden einmal geprueft und
  // normalisiert. Auch das Demo-Quiz geht durch dieselbe Tuer wie spaeter
  // der Editor - sonst haelt die Grenze nur dort, wo jemand an sie denkt.
  const questions: LoadedQuestion[] = raw.map((q) => loadQuestion(q, registry));

  return { title: 'Quizbude — Demorunde', questions };
}
