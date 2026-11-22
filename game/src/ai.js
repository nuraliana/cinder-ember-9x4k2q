// Warden Vex, the opponent: a greedy planner that picks up to three cards a turn from the
// hand it holds. It values damage most, healing when hurt, block when threatened, and the
// Pact bonus when a second card of a suit is in reach — so its choices can be read from the
// intent it shows, and countered with a ward before a big strike lands.
import { effectiveValues } from './cards.js';

const MAX_PLAYS = 5;

/** Score one card in the Warden's hand, with the Pact bonus counted when it applies. */
function scoreCard(card, self, foe, suitsPlayed) {
  const values = effectiveValues(card, suitsPlayed);
  let score = 0;
  score += values.damage * 1.0;
  if (values.damage > 0 && values.damage >= foe.life - foe.block) score += 100; // lethal
  if (values.heal > 0) score += self.life < 15 ? values.heal * 1.2 : values.heal * 0.3;
  if (values.block > 0) score += values.block * (self.life < 12 ? 1.0 : 0.6);
  score += values.draw * 1.5;
  score += values.energy * 2.0;
  if (card.cost > 0) score /= 1 + card.cost * 0.08; // a small tax for expensive cards
  return score;
}

/**
 * Pick the Warden's plays for a turn: greedily take the best affordable card, up to three,
 * counting the Pact bonus for a suit already chosen.
 */
export function chooseEnemyPlays(hand, energy, self, foe) {
  const plays = [];
  const suitsPlayed = [];
  let remaining = energy;
  while (plays.length < MAX_PLAYS) {
    let best = null;
    let bestScore = 0;
    for (const card of hand) {
      if (plays.includes(card) || card.cost > remaining) continue;
      const score = scoreCard(card, self, foe, suitsPlayed);
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    if (!best) break;
    plays.push(best);
    suitsPlayed.push(best.suit);
    remaining -= best.cost;
  }
  return { plays, totals: totalValues(plays) };
}

/** The summed numbers of a plan, with Pact bonuses, for the intent line. */
function totalValues(plays) {
  const suits = [];
  const totals = { damage: 0, heal: 0, block: 0, draw: 0 };
  for (const card of plays) {
    const values = effectiveValues(card, suits);
    totals.damage += values.damage;
    totals.heal += values.heal;
    totals.block += values.block;
    totals.draw += values.draw;
    suits.push(card.suit);
  }
  return totals;
}

/** The intent line the player reads before the Warden acts, e.g. "Strike 8 · Ward 5". */
export function describeIntent(plan) {
  const parts = [];
  if (plan.totals.damage > 0) parts.push(`Strike ${plan.totals.damage}`);
  if (plan.totals.block > 0) parts.push(`Ward ${plan.totals.block}`);
  if (plan.totals.heal > 0) parts.push(`Mend ${plan.totals.heal}`);
  if (plan.totals.draw > 0) parts.push(`Draw ${plan.totals.draw}`);
  return parts.length > 0 ? parts.join(' · ') : 'Bides its time';
}
