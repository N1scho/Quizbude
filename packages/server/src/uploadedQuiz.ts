import {
  MAX_QUESTIONS,
  loadQuestion,
  type LoadedQuestion,
  type QuestionTypeRegistry,
} from '@quizbude/core';
import type { QuizPayload } from '@quizbude/protocol';

export interface LoadedQuiz {
  readonly title: string;
  readonly questions: readonly LoadedQuestion[];
}

/**
 * Eine hochgeladene Sammlung wird zu Fragen - durch dieselbe Tuer wie das
 * Demo-Quiz.
 *
 * Die Datei wird in der Buehne gelesen und dort geprueft; hier ankommende
 * Fragen sind trotzdem Fremdeingabe. Geprueft wird deshalb noch einmal,
 * und zwar nicht mit einer zweiten, flacheren Pruefung daneben, sondern
 * mit `loadQuestion` - sonst gilt am Ende die Grenze, an die jemand zuletzt
 * gedacht hat.
 *
 * Wirft bei Unsinn. Der Aufrufer meldet den Text zurueck an die Buehne.
 */
export function loadUploadedQuiz(
  payload: QuizPayload,
  registry: QuestionTypeRegistry,
): LoadedQuiz {
  if (payload.questions.length === 0) {
    throw new Error('Die Sammlung enthaelt keine Frage.');
  }
  if (payload.questions.length > MAX_QUESTIONS) {
    throw new Error(
      `Die Sammlung hat ${payload.questions.length} Fragen, hoechstens ${MAX_QUESTIONS} sind erlaubt.`,
    );
  }
  const questions = payload.questions.map((raw) => loadQuestion(raw, registry));
  const title = payload.title.trim();
  return { title: title === '' ? 'Quizbude' : title, questions };
}
