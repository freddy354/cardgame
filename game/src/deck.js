// deck.js — Three Lanterns: the cards, the suits, and a seeded shuffle.
// Pure data, no DOM. A deck is 40 cards: four suits (values 2-9) plus four
// Lanterns and four Tempests. Each duellist shuffles a deck of their own.

export const SUITS = {
  ember: { name: 'Ember', row: 0, color: '#e4572e', soft: '#f6c9b8' },
  tide: { name: 'Tide', row: 1, color: '#2e86e4', soft: '#bcd9f7' },
  gale: { name: 'Gale', row: 2, color: '#2fae7d', soft: '#bdeeda' },
  stone: { name: 'Stone', row: -1, color: '#9a8a76', soft: '#e3dccf' },
};

/** The three rows of the table, in order: Ember, Tide, Gale. Stone has no row. */
export const ROWS = ['ember', 'tide', 'gale'];

export const START_LIFE = 30;
export const HAND_SIZE = 5;
export const PLAYS_PER_ROUND = 3;
export const LANTERN_HEAL = 4;

/** A small deterministic PRNG (mulberry32) so a seed replays the same game. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A card: { id, kind, suit, value }. Specials have suit null and value 0. */
export function makeCard(id, kind, suit, value) {
  return { id, kind, suit, value };
}

/** A fresh 40-card deck, unshuffled: suits 2-9, then the specials. */
export function buildDeck() {
  const cards = [];
  let id = 0;
  for (const suit of Object.keys(SUITS)) {
    for (let value = 2; value <= 9; value++) {
      cards.push(makeCard(id++, 'number', suit, value));
    }
  }
  for (let i = 0; i < 4; i++) cards.push(makeCard(id++, 'lantern', null, 0));
  for (let i = 0; i < 4; i++) cards.push(makeCard(id++, 'tempest', null, 0));
  return cards;
}

/** Fisher-Yates shuffle, in place, driven by the caller's rng. */
export function shuffle(cards, rng) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** A card's label for the table and the log, e.g. "Ember 7" or "Lantern". */
export function cardLabel(card) {
  if (card === null || card === undefined) return '—';
  if (card.kind === 'lantern') return 'Lantern';
  if (card.kind === 'tempest') return 'Tempest';
  return `${SUITS[card.suit].name} ${card.value}`;
}

/** What a card is worth in a row: its value, plus 4 when it matches the row. */
export function rowValue(card, rowIndex) {
  if (card === null || card === undefined) return 0;
  if (card.kind !== 'number') return 0;
  const matched = card.suit === ROWS[rowIndex];
  return matched ? card.value + 4 : card.value;
}
