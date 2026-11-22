// The duel itself, as pure logic with no DOM in it: creating a game, starting turns, playing
// cards, running the Warden's turn and deciding the winner. The renderer and the screenshot
// stager both drive this same code, so a staged scene is a real game state.
import { effectiveValues } from './cards.js';
import { drawCards, freshDeck } from './deck.js';
import { createRandom } from './random.js';
import { chooseEnemyPlays, describeIntent } from './ai.js';

export const MAX_LIFE = 30;
export const HAND_SIZE = 5;
export const MAX_ENERGY = 10;

function newSide(deck) {
  return { life: MAX_LIFE, maxLife: MAX_LIFE, block: 0, energy: 0, hand: [], deck, discard: [] };
}

/** A fresh duel. Nothing is drawn yet; startGame deals the opening hands. */
export function createGame(seed) {
  const rng = createRandom(seed);
  return {
    seed,
    rng,
    turn: 0,
    phase: 'title', // title | player | enemy | over
    result: null, // null | 'win' | 'lose'
    player: newSide(freshDeck(rng)),
    enemy: newSide(freshDeck(rng)),
    playedSuits: [], // suits the player has played this turn (for the Pact bonus)
    intent: null, // what the Warden will do on its next turn, shown to the player
    log: [],
    stats: { cardsPlayed: 0, damageDealt: 0, damageTaken: 0, turnsTaken: 0 },
  };
}

function addLog(game, message) {
  game.log.push(message);
  if (game.log.length > 40) game.log.shift();
}

/** Energy for a turn number: 1 on turn 1, growing to 10. */
export function energyForTurn(turn) {
  return Math.min(Math.max(turn, 1), MAX_ENERGY);
}

/** Deal the opening hands and show the Warden's first intent. */
export function startGame(game) {
  game.turn = 1;
  game.phase = 'player';
  game.player.energy = energyForTurn(1);
  drawCards(game.player, HAND_SIZE, game.rng);
  drawCards(game.enemy, HAND_SIZE, game.rng);
  game.intent = planIntent(game, energyForTurn(1));
  addLog(game, 'The duel begins. Warden Vex watches from across the table.');
}

/** The Warden's plan for its next turn, from the hand it holds right now. */
function planIntent(game, energy) {
  const plan = chooseEnemyPlays(game.enemy.hand, energy, game.enemy, game.player);
  return { plays: plan.plays, text: describeIntent(plan) };
}

/** Block soaks damage first; whatever is left hits life. Returns the life damage taken. */
function dealDamage(target, amount) {
  const soaked = Math.min(target.block, amount);
  target.block -= soaked;
  const lifeDamage = amount - soaked;
  target.life = Math.max(0, target.life - lifeDamage);
  return lifeDamage;
}

/**
 * Apply one card's effects. `side` is who plays it. Returns an event the renderer animates:
 * the card, its Pact bonus, and each number that changed.
 */
export function applyCard(game, side, card) {
  const actor = game[side];
  const foe = side === 'player' ? game.enemy : game.player;
  const values = effectiveValues(card, side === 'player' ? game.playedSuits : game.enemySuits ?? []);
  const event = { card, pact: values.pact, damage: 0, heal: 0, block: 0, draw: 0, energy: 0 };
  if (values.damage > 0) {
    event.damage = dealDamage(foe, values.damage);
    event.blocked = values.damage - event.damage;
    if (side === 'player') game.stats.damageDealt += event.damage;
    else game.stats.damageTaken += event.damage;
  }
  if (values.heal > 0) {
    const missing = actor.maxLife - actor.life;
    event.heal = Math.min(values.heal, missing);
    actor.life += event.heal;
  }
  if (values.block > 0) {
    actor.block += values.block;
    event.block = values.block;
  }
  if (values.draw > 0) {
    const before = actor.hand.length;
    drawCards(actor, values.draw, game.rng);
    event.draw = actor.hand.length - before;
  }
  if (values.energy > 0) {
    actor.energy += values.energy;
    event.energy = values.energy;
  }
  return event;
}

/** The player plays the card at `handIndex`. Returns its event, or null when it cannot be played. */
export function playPlayerCard(game, handIndex) {
  if (game.phase !== 'player' || game.result) return null;
  const card = game.player.hand[handIndex];
  if (!card || card.cost > game.player.energy) return null;
  game.player.energy -= card.cost;
  game.player.hand.splice(handIndex, 1);
  game.player.discard.push(card);
  game.stats.cardsPlayed += 1;
  // The Pact counts suits played BEFORE this card: apply first, then record the suit.
  const event = applyCard(game, 'player', card);
  game.playedSuits.push(card.suit);
  game.lastPlayed = { card, who: 'player', pact: event.pact };
  addLog(game, `You play ${card.name}${event.pact ? ' — PACT!' : ''}.`);
  checkEnd(game);
  return event;
}

/** The cheapest readable reason a card cannot be played right now, or null when it can. */
export function whyUnplayable(game, card) {
  if (game.phase !== 'player' || game.result) return 'not your turn';
  if (card.cost > game.player.energy) return 'not enough energy';
  return null;
}

/** The player ends the turn: the Warden acts, then a new player turn begins. */
export function endPlayerTurn(game) {
  if (game.phase !== 'player' || game.result) return [];
  game.stats.turnsTaken += 1;
  // runEnemyTurn already opens the next player turn when the duel goes on.
  return runEnemyTurn(game);
}

/** The Warden plays its planned cards, then draws back up and plans its next intent. */
export function runEnemyTurn(game) {
  game.phase = 'enemy';
  game.enemy.block = 0;
  game.enemy.energy = energyForTurn(game.turn);
  game.enemySuits = [];
  const events = [];
  const plan = game.intent ?? planIntent(game, game.enemy.energy);
  for (const planned of plan.plays) {
    const index = game.enemy.hand.findIndex((c) => c.uid === planned.uid);
    if (index < 0) continue;
    const card = game.enemy.hand[index];
    if (card.cost > game.enemy.energy) continue;
    game.enemy.energy -= card.cost;
    game.enemy.hand.splice(index, 1);
    game.enemy.discard.push(card);
    // The Pact counts suits played BEFORE this card: apply first, then record the suit.
    const event = applyCard(game, 'enemy', card);
    game.enemySuits.push(card.suit);
    game.lastPlayed = { card, who: 'enemy', pact: event.pact };
    event.enemyCard = true;
    events.push(event);
    addLog(game, `Vex plays ${card.name}${event.pact ? ' — PACT!' : ''}.`);
    if (checkEnd(game)) break;
  }
  game.enemySuits = [];
  if (game.result) return events;
  drawCards(game.enemy, HAND_SIZE - game.enemy.hand.length, game.rng);
  game.turn += 1;
  startPlayerTurn(game);
  return events;
}

/** A new player turn: energy refills, block fades, a fresh hand is drawn, intent is shown. */
function startPlayerTurn(game) {
  game.phase = 'player';
  game.player.block = 0;
  game.player.energy = energyForTurn(game.turn);
  game.playedSuits = [];
  // From turn 10 the table itself burns: both sides take growing damage, so no duel
  // can stall forever on healing and wards. Block does not soak it — it is the table.
  if (game.turn >= 10) {
    const burn = game.turn - 9;
    game.player.life = Math.max(0, game.player.life - burn);
    game.enemy.life = Math.max(0, game.enemy.life - burn);
    addLog(game, `The table burns — both sides take ${burn} damage.`);
    if (checkEnd(game)) return;
  }
  drawCards(game.player, HAND_SIZE - game.player.hand.length, game.rng);
  game.intent = planIntent(game, energyForTurn(game.turn));
  addLog(game, `Turn ${game.turn} — ${game.player.energy} energy.`);
}

/** Decide the winner. Returns true when the duel is over. */
export function checkEnd(game) {
  if (game.enemy.life <= 0) {
    game.result = 'win';
    game.phase = 'over';
    addLog(game, 'Warden Vex yields. The embers are yours.');
    return true;
  }
  if (game.player.life <= 0) {
    game.result = 'lose';
    game.phase = 'over';
    addLog(game, 'Your last ember gutters out. Vex takes the table.');
    return true;
  }
  return false;
}
