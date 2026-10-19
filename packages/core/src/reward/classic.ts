import type { RewardLayer } from './layer.js';

/**
 * Die Identitaetsschicht. Sie tut nichts - ihr Zweck ist, dass die Naht
 * ab Tag eins existiert und von einem Test beruehrt wird.
 */
export const classicRewardLayer: RewardLayer<null> = {
  id: 'classic',
  init: () => null,
  onRound: () => ({ state: null, view: { kind: 'classic' } }),
  finalRanking: () => null,
};
