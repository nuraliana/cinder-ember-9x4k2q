// The draw pile, the discard pile and the hand: one side's cards. Drawing from an empty
// deck shuffles the discard pile back in, so a duel never stalls on an empty deck.
import { buildDeckList } from './cards.js';
import { shuffle } from './random.js';

/** A fresh shuffled deck of 24 cards. */
export function freshDeck(rng) {
  return shuffle(buildDeckList(), rng);
}

/** No hand ever holds more than 10 cards; cards drawn past that are lost. */
export const MAX_HAND = 10;

/** Move `count` cards from the side's deck into its hand, reshuffling discards when needed. */
export function drawCards(side, count, rng) {
  for (let i = 0; i < count; i += 1) {
    if (side.hand.length >= MAX_HAND) return;
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = shuffle(side.discard, rng);
      side.discard = [];
    }
    side.hand.push(side.deck.pop());
  }
}
