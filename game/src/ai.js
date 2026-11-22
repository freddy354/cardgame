// ai.js — Sable, the Moth Queen. She answers the card you just played into a
// row, and she can see it: she takes the row when she can win it cheaply,
// dodges a row you already own, heals when her light runs low, and spends a
// Tempest on a card of yours worth tearing away. She is sharp, not perfect:
// when nothing in her hand wins a row she spends her weakest card, and she
// never plans further than the row in front of her.

import { rowValue, cardLabel } from './deck.js';
import { openRows, strongestOnTable } from './game.js';

/**
 * Pick the hand index Sable plays into `rowIndex`, answering `yourCard` (the
 * card the player just played there, or null when the row is empty for the
 * player). Returns -1 when her hand is empty.
 */
export function chooseCard(state, rowIndex, yourCard) {
  const hand = state.sable.hand;
  if (hand.length === 0) return -1;

  const byIndex = (kind) => hand.findIndex((c) => c.kind === kind);
  const numbers = hand.map((card, index) => ({ card, index })).filter((e) => e.card.kind === 'number');

  // Her light runs low: a Lantern is worth more than any row.
  if (state.sable.life <= 10) {
    const lantern = byIndex('lantern');
    if (lantern !== -1) return lantern;
  }

  // Your strongest card on the table is worth a storm, when she holds one.
  const threat = strongestOnTable(state, 'you');
  if (threat !== null && threat.value >= 7) {
    const tempest = byIndex('tempest');
    if (tempest !== -1) return tempest;
  }

  // No number cards left: spend a Lantern while it still heals, else a Tempest.
  if (numbers.length === 0) {
    if (state.sable.life < 30) {
      const lantern = byIndex('lantern');
      if (lantern !== -1) return lantern;
    }
    return 0;
  }

  const yours = rowValue(yourCard, rowIndex);
  // Otherwise, weigh every card by the row's net outcome: damage she deals
  // minus damage she takes. Winning by a little beats tying, tying beats
  // losing by a little, and losing by a little beats losing by a lot; among
  // equal outcomes she spends the cheaper card.
  let best = -1;
  let bestNet = -Infinity;
  let bestCost = Infinity;
  hand.forEach((card, index) => {
    const hers = rowValue(card, rowIndex);
    const net = (hers > yours ? hers - yours : 0) - (hers < yours ? yours - hers : 0);
    const cost = card.kind === 'number' ? card.value : 0;
    if (net > bestNet || (net === bestNet && cost < bestCost)) {
      best = index;
      bestNet = net;
      bestCost = cost;
    }
  });
  // Sharp, not perfect: one time in seven she misreads the row and spends
  // her weakest number card instead. The seeded rng keeps it deterministic.
  if (numbers.length > 0 && state.rng !== undefined && state.rng() < 1 / 7) {
    numbers.sort((a, b) => rowValue(a.card, rowIndex) - rowValue(b.card, rowIndex));
    return numbers[0].index;
  }
  return best;
}

/** A one-line account of Sable's choice, for the table's log. */
export function describeChoice(state, rowIndex, handIndex) {
  const card = state.sable.hand[handIndex];
  if (card === undefined) return 'Sable has no card to answer with.';
  return `Sable answers with ${cardLabel(card)} (${rowValue(card, rowIndex)} in the row).`;
}

/**
 * The beginner the sim plays as: honest and simple. Heal when hurt, storm a
 * big threat, otherwise put the best card into the row where it counts most.
 * The sim uses this to show the duel is winnable, not to play perfectly.
 */
export function beginnerPick(state, rowIndex) {
  const hand = state.you.hand;
  if (hand.length === 0) return -1;
  if (state.you.life <= 12) {
    const lantern = hand.findIndex((c) => c.kind === 'lantern');
    if (lantern !== -1) return lantern;
  }
  const threat = strongestOnTable(state, 'sable');
  if (threat !== null && threat.value >= 7) {
    const tempest = hand.findIndex((c) => c.kind === 'tempest');
    if (tempest !== -1) return tempest;
  }
  const numbers = hand.map((card, index) => ({ card, index })).filter((e) => e.card.kind === 'number');
  if (numbers.length > 0) {
    numbers.sort((a, b) => rowValue(b.card, rowIndex) - rowValue(a.card, rowIndex));
    return numbers[0].index;
  }
  return 0;
}

/** The rows Sable can still answer in, for the sim's round loop. */