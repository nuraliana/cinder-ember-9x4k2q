// Boot and input: clicks and keys drive the duel, the Warden's turn plays out one card at a
// time so its choices can be watched, and every action repaints the table from the state.
//
// ?seed=N fixes the shuffle. ?shot=title|table|win|lose (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { createGame, endPlayerTurn, playPlayerCard, startGame, whyUnplayable } from './state.js';
import { renderAll, showPlayedCard } from './render.js';
import { confetti, floatText, shakeTable, sfx } from './effects.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

/** How long the table waits between the Warden's cards, so each one can be read. */
const ENEMY_CARD_PAUSE = 750;

function runShot(name) {
  const { game, screen } = stageShot(name, seed);
  let painted = 0;
  function paint() {
    renderAll(game, screen);
    if (game.lastPlayed) {
      const lp = game.lastPlayed;
      showPlayedCard(lp.card, lp.who, lp.pact ? [lp.card.suit] : []);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    // Let the deal-in and play-in animations finish before the screenshot.
    else window.setTimeout(() => { window.__shotReady = true; }, 1000);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const game = createGame(seed);
  window.__game = game;
  let screen = 'title';

  function paint() {
    renderAll(game, screen);
  }

  function announceResult() {
    if (game.result === 'win') {
      sfx.win();
      confetti();
    } else if (game.result === 'lose') {
      sfx.lose();
    }
    screen = 'over';
    paint();
  }

  /** Animate one played card's event: numbers float, heavy hits shake the table. */
  function showEvent(event, who) {
    const targetId = who === 'player' ? 'enemy-life-text' : 'player-life-text';
    if (event.damage > 0) {
      floatText(targetId, `-${event.damage}`, 'damage');
      if (event.damage >= 6) shakeTable();
      sfx.hurt();
    }
    if (event.blocked > 0) floatText(targetId, `blocked ${event.blocked}`, 'block');
    if (event.heal > 0) {
      floatText(who === 'player' ? 'player-life-text' : 'enemy-life-text', `+${event.heal}`, 'heal');
      sfx.heal();
    }
    if (event.pact) sfx.pact();
    else if (event.damage === 0 && event.heal === 0) sfx.play();
  }

  function startDuel() {
    startGame(game);
    screen = 'play';
    paint();
  }

  function restart() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(game, fresh);
    window.__game = game;
    screen = 'title';
    paint();
  }

  function playCard(index) {
    if (screen !== 'play') return;
    const card = game.player.hand[index];
    if (!card) return;
    const reason = whyUnplayable(game, card);
    if (reason) return;
    const suitsBefore = game.playedSuits.slice();
    const event = playPlayerCard(game, index);
    if (!event) return;
    showPlayedCard(card, 'player', event.pact ? [...suitsBefore, card.suit] : suitsBefore);
    showEvent(event, 'player');
    paint();
    if (game.result) announceResult();
  }

  /** End the turn, then reveal the Warden's cards one at a time before repainting. */
  function endTurn() {
    if (screen !== 'play' || game.phase !== 'player' || game.result) return;
    const events = endPlayerTurn(game);
    screen = 'play';
    paint();
    let step = 0;
    function nextEnemyCard() {
      if (step >= events.length) {
        paint();
        if (game.result) announceResult();
        return;
      }
      const event = events[step];
      step += 1;
      showPlayedCard(event.card, 'enemy', event.pact ? [event.card.suit] : []);
      showEvent(event, 'enemy');
      paint();
      window.setTimeout(nextEnemyCard, ENEMY_CARD_PAUSE);
    }
    nextEnemyCard();
  }

  document.getElementById('player-hand').addEventListener('click', (ev) => {
    const cardEl = ev.target.closest('.card');
    if (!cardEl || !cardEl.dataset.index) return;
    playCard(Number(cardEl.dataset.index));
  });
  document.getElementById('end-turn').addEventListener('click', endTurn);
  document.getElementById('overlay').addEventListener('click', () => {
    if (screen === 'title') startDuel();
    else if (screen === 'over') restart();
  });

  document.addEventListener('keydown', (ev) => {
    if (screen === 'title' && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      startDuel();
      return;
    }
    if (screen === 'over' && (ev.key === 'r' || ev.key === 'R' || ev.key === 'Enter')) {
      restart();
      return;
    }
    if (screen !== 'play') return;
    if (ev.key >= '1' && ev.key <= '7') playCard(Number(ev.key) - 1);
    else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      endTurn();
    }
  });

  paint();
}

if (shot) runShot(shot);
else runGame();
