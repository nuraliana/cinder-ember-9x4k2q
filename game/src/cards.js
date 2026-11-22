// Card definitions for Cinder Pact. Every card is one object: a suit, an energy cost and an
// effect. Suits are told apart by colour AND shape, never by text alone:
//   Flame ▲ red — damage · Tide ● blue — healing · Gale ◆ green — drawing · Stone ■ amber — block.
// The deck holds two copies of each of the twelve cards (24 cards).
export const SUITS = {
  flame: { key: 'flame', label: 'Flame', color: '#e5484d', dark: '#8f1d22', shape: '▲' },
  tide: { key: 'tide', label: 'Tide', color: '#3e9bff', dark: '#0b3d7a', shape: '●' },
  gale: { key: 'gale', label: 'Gale', color: '#46b96b', dark: '#14532a', shape: '◆' },
  stone: { key: 'stone', label: 'Stone', color: '#e0a63c', dark: '#6b4a08', shape: '■' },
};

export const CARD_DEFS = [
  { id: 'spark-bite', name: 'Spark Bite', suit: 'flame', cost: 1, damage: 3, text: 'Deal 3 damage.' },
  { id: 'ember-lash', name: 'Ember Lash', suit: 'flame', cost: 2, damage: 5, text: 'Deal 5 damage.' },
  { id: 'inferno', name: 'Inferno', suit: 'flame', cost: 4, damage: 9, text: 'Deal 9 damage.' },
  { id: 'cool-draught', name: 'Cool Draught', suit: 'tide', cost: 1, heal: 4, text: 'Restore 4 life.' },
  { id: 'deep-well', name: 'Deep Well', suit: 'tide', cost: 2, heal: 7, draw: 1, text: 'Restore 7 life. Draw 1 card.' },
  { id: 'tide-surge', name: 'Tide Surge', suit: 'tide', cost: 3, heal: 5, damage: 3, text: 'Restore 5 life. Deal 3 damage.' },
  { id: 'swift-page', name: 'Swift Page', suit: 'gale', cost: 0, draw: 2, text: 'Draw 2 cards.' },
  { id: 'windfall', name: 'Windfall', suit: 'gale', cost: 1, draw: 2, energy: 1, text: 'Draw 2 cards. Gain 1 energy.' },
  { id: 'storm-call', name: 'Storm Call', suit: 'gale', cost: 3, damage: 4, draw: 1, text: 'Deal 4 damage. Draw 1 card.' },
  { id: 'pebble-ward', name: 'Pebble Ward', suit: 'stone', cost: 1, block: 5, text: 'Gain 5 block.' },
  { id: 'granite-wall', name: 'Granite Wall', suit: 'stone', cost: 2, block: 9, text: 'Gain 9 block.' },
  { id: 'quake-stomp', name: 'Quake Stomp', suit: 'stone', cost: 3, block: 6, damage: 4, text: 'Gain 6 block. Deal 4 damage.' },
];

/** Two copies of every card, each with its own uid. */
export function buildDeckList() {
  const list = [];
  for (const def of CARD_DEFS) {
    list.push({ ...def, uid: `${def.id}-a` });
    list.push({ ...def, uid: `${def.id}-b` });
  }
  return list;
}

/**
 * The Pact bonus: the second (and later) card of a suit played in one turn is stronger —
 * +2 damage, +3 healing, +4 block, +1 card drawn, +1 energy. This is the decision at the
 * heart of every hand: match suits for the bonus, or spend the energy elsewhere.
 */
export function pactBonus(card, playedSuits) {
  if (!playedSuits.includes(card.suit)) return { damage: 0, heal: 0, block: 0, draw: 0, energy: 0, active: false };
  return {
    damage: card.damage ? 2 : 0,
    heal: card.heal ? 3 : 0,
    block: card.block ? 4 : 0,
    draw: card.draw ? 1 : 0,
    energy: card.energy ? 1 : 0,
    active: true,
  };
}

/** The card's numbers with its Pact bonus applied. */
export function effectiveValues(card, playedSuits) {
  const bonus = pactBonus(card, playedSuits);
  return {
    damage: (card.damage ?? 0) + bonus.damage,
    heal: (card.heal ?? 0) + bonus.heal,
    block: (card.block ?? 0) + bonus.block,
    draw: (card.draw ?? 0) + bonus.draw,
    energy: (card.energy ?? 0) + bonus.energy,
    pact: bonus.active,
  };
}
