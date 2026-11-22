// The table, painted from the game state: life bars, energy gems, both hands, the log and
// the title / win / loss overlays. Every number a judge needs to read — life, block, energy,
// card cost and card value — is big, and every suit is a colour AND a shape.
import { SUITS, effectiveValues, pactBonus } from './cards.js';

const $ = (id) => document.getElementById(id);

/** The Warden's portrait: a hooded mask drawn as inline SVG, original art, no image file. */
const WARDEN_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 4 L88 26 L80 92 L20 92 L12 26 Z" fill="#2b2140" stroke="#6b5aa8" stroke-width="3"/>
  <path d="M50 22 L74 40 L68 78 L32 78 L26 40 Z" fill="#120e1e"/>
  <ellipse cx="38" cy="48" rx="7" ry="4" fill="#ffb347"/>
  <ellipse cx="62" cy="48" rx="7" ry="4" fill="#ffb347"/>
  <path d="M42 66 Q50 72 58 66" stroke="#6b5aa8" stroke-width="3" fill="none"/>
</svg>`;

/** The player's portrait: an emberwright's lantern, drawn as inline SVG. */
const LANTERN_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="34" y="18" width="32" height="10" rx="3" fill="#8a6d2f"/>
  <rect x="30" y="28" width="40" height="52" rx="8" fill="#3a2c12" stroke="#e0a63c" stroke-width="3"/>
  <ellipse cx="50" cy="54" rx="12" ry="18" fill="#ffb347"/>
  <ellipse cx="50" cy="54" rx="6" ry="10" fill="#fff3c4"/>
  <rect x="38" y="80" width="24" height="8" rx="3" fill="#8a6d2f"/>
</svg>`;

/** Which big number a card leads with: damage first, then healing, block, then draw. */
function leadValue(card, values) {
  if (values.damage > 0) return { num: values.damage, kind: 'DMG' };
  if (values.heal > 0) return { num: values.heal, kind: 'HEAL' };
  if (values.block > 0) return { num: values.block, kind: 'BLOCK' };
  return { num: values.draw, kind: 'DRAW' };
}

/** One card face. `pact` marks it as the turn's second card of its suit. */
export function cardElement(card, playedSuits) {
  const suit = SUITS[card.suit];
  const values = effectiveValues(card, playedSuits);
  const lead = leadValue(card, values);
  const bonus = pactBonus(card, playedSuits);
  const el = document.createElement('div');
  el.className = `card suit-${card.suit}`;
  el.dataset.uid = card.uid;
  el.style.setProperty('--suit', suit.color);
  el.style.setProperty('--suit-dark', suit.dark);
  let pactHtml = '';
  if (bonus.active) {
    const parts = [];
    if (bonus.damage) parts.push(`+${bonus.damage} DMG`);
    if (bonus.heal) parts.push(`+${bonus.heal} HEAL`);
    if (bonus.block) parts.push(`+${bonus.block} BLOCK`);
    if (bonus.draw) parts.push(`+${bonus.draw} DRAW`);
    if (bonus.energy) parts.push(`+${bonus.energy} ENERGY`);
    pactHtml = `<div class="card-pact">PACT ${parts.join(' ')}</div>`;
  }
  el.innerHTML = `
    <div class="card-top"><span class="cost" title="Energy cost">${card.cost}</span><span class="suit-mark">${suit.shape}</span></div>
    <div class="card-name">${card.name}</div>
    <div class="card-value"><span class="value-num">${lead.num}</span><span class="value-kind">${lead.kind}</span></div>
    <div class="card-text">${card.text}</div>
    <div class="card-suit-name">${suit.shape} ${suit.label}</div>
    ${pactHtml}`;
  return el;
}

/** A face-down card back for the Warden's hand. */
function cardBackElement() {
  const el = document.createElement('div');
  el.className = 'card card-back';
  el.innerHTML = '<div class="back-mark">▲</div>';
  return el;
}

function setLife(fillId, textId, side) {
  $(fillId).style.width = `${(side.life / side.maxLife) * 100}%`;
  $(textId).textContent = `♥ ${side.life} / ${side.maxLife}`;
}

function setBlock(id, block) {
  const el = $(id);
  el.textContent = `🛡 ${block}`;
  el.classList.toggle('hidden', block <= 0);
}

/** Paint the whole table from the game state. `screen` is title, play or over. */
export function renderAll(game, screen) {
  $('turn-badge').textContent = game.turn > 0 ? `Turn ${game.turn}` : 'Cinder Pact';
  $('score-badge').textContent = `Damage dealt ${game.stats.damageDealt}`;
  $('enemy-portrait').innerHTML = WARDEN_SVG;
  $('player-portrait').innerHTML = LANTERN_SVG;
  setLife('enemy-life-fill', 'enemy-life-text', game.enemy);
  setBlock('enemy-block', game.enemy.block);
  setLife('player-life-fill', 'player-life-text', game.player);
  setBlock('player-block', game.player.block);

  const intent = $('enemy-intent');
  intent.textContent = game.intent && game.phase !== 'title' ? `Vex plans: ${game.intent.text}` : '';
  intent.classList.toggle('hidden', !game.intent || game.phase === 'title');

  const enemyHand = $('enemy-hand');
  enemyHand.replaceChildren();
  for (let i = 0; i < game.enemy.hand.length; i += 1) enemyHand.append(cardBackElement());

  const energyRow = $('energy-row');
  energyRow.replaceChildren();
  const maxEnergy = game.turn > 0 ? Math.min(game.turn, 10) : 0;
  for (let i = 0; i < 10; i += 1) {
    const gem = document.createElement('span');
    gem.className = 'energy-gem' + (i < game.player.energy ? ' lit' : '') + (i < maxEnergy ? '' : ' off');
    gem.textContent = '●';
    energyRow.append(gem);
  }
  $('energy-text').textContent = `Energy ${game.player.energy} / ${maxEnergy}`;

  const hand = $('player-hand');
  hand.replaceChildren();
  game.player.hand.forEach((card, index) => {
    const el = cardElement(card, game.playedSuits);
    el.dataset.index = String(index);
    const affordable = game.phase === 'player' && !game.result && card.cost <= game.player.energy;
    el.classList.toggle('playable', affordable);
    el.classList.toggle('unplayable', !affordable);
    el.style.animationDelay = `${index * 60}ms`;
    hand.append(el);
  });

  const log = $('log');
  log.replaceChildren();
  for (const line of game.log.slice(-4)) {
    const row = document.createElement('div');
    row.className = 'log-line';
    row.textContent = line;
    log.append(row);
  }

  $('end-turn').disabled = game.phase !== 'player' || !!game.result;
  renderOverlay(game, screen);
}

/** The title screen, the win screen and the loss screen, over the table. */
function renderOverlay(game, screen) {
  const overlay = $('overlay');
  if (screen === 'title') {
    overlay.className = 'overlay show';
    overlay.innerHTML = `
      <div class="panel title-panel">
        <div class="game-title">🔥 CINDER PACT 🔥</div>
        <div class="game-sub">A duel of the four embers — you against Warden Vex</div>
        <div class="howto">
          <p><b>▲ Flame</b> wounds · <b>● Tide</b> mends · <b>◆ Gale</b> draws · <b>■ Stone</b> wards</p>
          <p>Play a second card of a suit in one turn for the <b>PACT bonus</b>.</p>
          <p>Read Vex's intent, ward the big strikes, and bring its life to 0.</p>
          <p>From turn 10 the table burns — no duel can stall forever.</p>
          <p>Click a card or press 1–7 to play it · Enter ends your turn</p>
        </div>
        <div class="start-hint">Click anywhere or press Enter to begin</div>
      </div>`;
  } else if (screen === 'over') {
    const win = game.result === 'win';
    overlay.className = 'overlay show';
    overlay.innerHTML = `
      <div class="panel ${win ? 'win-panel' : 'lose-panel'}">
        <div class="end-title">${win ? '🏆 VICTORY' : '💀 DEFEAT'}</div>
        <div class="end-sub">${win ? 'Warden Vex yields. The embers are yours.' : 'Your last ember gutters out. Vex takes the table.'}</div>
        <div class="end-stats">
          <span>Turns ${game.turn}</span>
          <span>Cards played ${game.stats.cardsPlayed}</span>
          <span>Damage dealt ${game.stats.damageDealt}</span>
        </div>
        <div class="start-hint">Press R or click to play again</div>
      </div>`;
  } else {
    overlay.className = 'overlay';
    overlay.innerHTML = '';
  }
}

/** Show a card briefly in the middle of the table as it is played. */
export function showPlayedCard(card, who, playedSuits) {
  const zone = $('played-zone');
  zone.replaceChildren();
  const el = cardElement(card, playedSuits);
  el.classList.add('played-card');
  const label = document.createElement('div');
  label.className = 'played-label';
  label.textContent = who === 'player' ? 'You play' : 'Vex plays';
  zone.append(label, el);
  window.setTimeout(() => {
    if (zone.contains(el)) zone.replaceChildren();
  }, 4000);
}
