/**
 * Gebrandete Primitivtypen. Sie kosten zur Laufzeit nichts und verhindern,
 * dass eine Wanduhrzeit dort landet, wo eine monotone Zeit stehen muss.
 */

/** Millisekunden aus einer MONOTONEN Quelle. Niemals Wanduhr. */
export type MonoMs = number & { readonly __brand: 'MonoMs' };

export type RoomCode = string & { readonly __brand: 'RoomCode' };
export type PlayerId = string & { readonly __brand: 'PlayerId' };

export const asMonoMs = (value: number): MonoMs => value as MonoMs;
export const asRoomCode = (value: string): RoomCode => value as RoomCode;
export const asPlayerId = (value: string): PlayerId => value as PlayerId;

/** Herkunft ab Tag eins im Modell, damit ein zweiter Transport core nicht anfasst. */
export type PlayerOrigin = 'web' | 'discord';

export type Phase =
  | 'LOBBY'
  | 'PREVIEW'
  | 'OPEN'
  | 'REVEAL'
  | 'SCOREBOARD'
  | 'PODIUM'
  | 'FINISHED';

export type EndReason = 'completed' | 'host_ended' | 'timed_out';
