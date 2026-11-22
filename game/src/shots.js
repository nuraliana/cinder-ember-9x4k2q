// The screenshot scenes behind ?shot=title|table|win|lose. Each one plays the real rules
// forward from a fresh game, so every frame is what a short duel really looks like — and the
// same seed always gives the same frame.
import { CARD_DEFS } from './cards.js';
import { createGame, endPlayerTurn, playPlayerCard, runEnemyTurn, startGame } from './state.js';

function cloneCard(id) {
  const def = CARD_DEFS.find((c) => c.id === id);
  return { ...def, uid: `${def.id}-shot` };
}

/** The player's best affordable card, by raw effect, for the autopilot. */
function bestPlayableIndex(game) {
  let best = -1;
  let bestScore = 0;
  game.player.hand.forEach((card, index) => {
    if (card.cost > game.player.energy) return;
    const score = (card.damage ?? 0) + (card.block ?? 0) + (card.heal ?? 0) * 0.8 + (card.draw ?? 0) * 2 + (card.energy ?? 0) * 2;
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

/** Three full rounds of greedy play, stopping at the start of the player's fourth turn. */
function stageTable(seed) {
  const game = createGame(seed);
  startGame(game);
  for (let round = 0; round < 3 && !game.result; round += 1) {
    let guard = 0;
    while (guard++ < 12 && !game.result) {
      const index = bestPlayableIndex(game);
      if (index < 0) break;
      playPlayerCard(game, index);
    }
    if (!game.result) endPlayerTurn(game);
  }
  return { game, screen: game.result ? 'over' : 'play' };
}

/** A lethal Inferno in hand against a Warden on 4 life: the winning frame. */
function stageWin(seed) {
  const game = createGame(seed);
  startGame(game);
  game.enemy.life = 4;
  game.enemy.block = 0;
  game.player.hand = [cloneCard('inferno'), cloneCard('spark-bite'), cloneCard('pebble-ward')];
  game.player.energy = 4;
  const index = game.player.hand.findIndex((c) => c.id === 'inferno');
  playPlayerCard(game, index);
  return { game, screen: 'over' };
}

/** A Warden holding a lethal Inferno against a player on 3 life: the losing frame. */
function stageLose(seed) {
  const game = createGame(seed);
  startGame(game);
  game.player.life = 3;
  game.player.block = 0;
  // Turn 4, so the Warden has the 4 energy its Inferno costs, and the player its 4.
  game.turn = 4;
  game.player.energy = 4;
  game.enemy.hand = [cloneCard('inferno')];
  game.intent = { plays: game.enemy.hand.slice(), text: 'Strike 9' };
  runEnemyTurn(game);
  return { game, screen: 'over' };
}

/**
 * Set up the named scene and return the game plus the screen to draw over it.
 * Any other name is the title screen.
 */
export function stageShot(name, seed) {
  if (name === 'table') return stageTable(seed);
  if (name === 'win') return stageWin(seed);
  if (name === 'lose') return stageLose(seed);
  const game = createGame(seed);
  return { game, screen: 'title' };
}
