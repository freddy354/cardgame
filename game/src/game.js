// game.js — Three Lanterns: the rules. A pure state machine, no DOM.
// A duel lasts rounds. Each round both sides play one card into each of the
// three rows, the player first and Sable answering in the same row, both
// cards face up. When both sides have made their three plays the round
// resolves: in every row the higher total wins and deals damage equal to the
// difference. A card in the row of its own suit is worth 4 more. Lantern cards
// heal their owner by 4 when played; Tempest cards blow away the strongest
// enemy card on the table when played. A card Tempest tore away leaves its
// slot empty — it earns no replay. First side to 0 lanterns loses.

import {
  buildDeck,
  shuffle,
  mulberry32,
  rowValue,
  cardLabel,
  START_LIFE,
  HAND_SIZE,
  PLAYS_PER_ROUND,
  LANTERN_HEAL,
} from './deck.js';

/** A fresh side: its own shuffled deck, a hand, a discard pile, 30 lanterns. */
function newSide(rng) {
  const deck = shuffle(buildDeck(), rng);
  const side = { life: START_LIFE, deck, hand: [], discard: [] };
  drawUp(side);
  return side;
}

/** Draw until the hand holds HAND_SIZE cards, reshuffling the discard if needed. */
export function drawUp(side, rng) {
  while (side.hand.length < HAND_SIZE) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) return;
      side.deck = shuffle(side.discard.splice(0), rng ?? Math.random);
    }
    side.hand.push(side.deck.pop());
  }
}

/** A new duel. `seed` replays the same shuffle; the game itself is not rigged. */
export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  const state = {
    seed,
    rng,
    round: 1,
    phase: 'title', // title | play | resolve | over
    you: newSide(rng),
    sable: newSide(rng),
    rows: [0, 1, 2].map(() => ({ you: null, sable: null })),
    plays: { you: 0, sable: 0 }, // cards each side has played this round
    playedRows: { you: [false, false, false], sable: [false, false, false] },
    log: [`The duel begins. Sable, the Moth Queen, guards her light.`],
    winner: null,
    damage: null, // the last round's per-row damage, for the table
  };
  return state;
}

/** Begin round one: the title screen gives way to the table. */
export function startGame(state) {
  if (state.phase !== 'title') return;
  state.phase = 'play';
  state.log.push(`Round ${state.round}: play a card into each row.`);
}

/** The rows a side still has empty this round. */
export function openRows(state, who) {
  const out = [];
  for (let i = 0; i < 3; i++) if (!state.playedRows[who][i]) out.push(i);
  return out;
}

/** The strongest enemy card on the table, for Tempest: { row, who, value }. */
export function strongestOnTable(state, enemy) {
  let best = null;
  for (let i = 0; i < 3; i++) {
    const card = state.rows[i][enemy];
    if (card !== null && card.kind === 'number') {
      if (best === null || card.value > best.value) best = { row: i, who: enemy, value: card.value };
    }
  }
  return best;
}

/**
 * Play a card from `who`'s hand into a row. Returns an object describing what
 * happened ({ ok, note }) so the table can narrate it; ok is false when the
 * move is not legal (wrong phase, row taken, no such card).
 */
export function playCard(state, who, handIndex, rowIndex) {
  if (state.phase !== 'play') return { ok: false, note: 'The table is not taking cards now.' };
  const side = state[who];
  const card = side.hand[handIndex];
  if (card === undefined) return { ok: false, note: 'No such card in hand.' };
  if (state.playedRows[who][rowIndex]) return { ok: false, note: 'That row is already taken.' };

  side.hand.splice(handIndex, 1);
  state.rows[rowIndex][who] = card;
  state.playedRows[who][rowIndex] = true;
  let note = `${who === 'you' ? 'You play' : 'Sable plays'} ${cardLabel(card)} into the ${['Ember', 'Tide', 'Gale'][rowIndex]} row.`;

  if (card.kind === 'lantern') {
    const healed = Math.min(LANTERN_HEAL, START_LIFE - side.life);
    side.life += healed;
    note += ` The lanterns burn brighter (+${healed}).`;
  }
  if (card.kind === 'tempest') {
    const enemy = who === 'you' ? 'sable' : 'you';
    const target = strongestOnTable(state, enemy);
    if (target !== null) {
      const gone = state.rows[target.row][target.who];
      state.rows[target.row][target.who] = null;
      state[enemy].discard.push(gone);
      note += ` The storm tears away ${cardLabel(gone)}!`;
    } else {
      note += ` The storm finds nothing to tear away.`;
    }
  }

  state.plays[who] += 1;
  state.log.push(note);
  // The round resolves when both sides have made their three plays — a card
  // Tempest tore away leaves its slot empty, it does not earn a replay — or
  // when a side has no card left to fill an empty row (a safety net).
  const done = state.plays.you >= PLAYS_PER_ROUND && state.plays.sable >= PLAYS_PER_ROUND;
  const youStuck = state.you.hand.length === 0 && state.rows.some((r) => r.you === null);
  const sableStuck = state.sable.hand.length === 0 && state.rows.some((r) => r.sable === null);
  if (done || youStuck || sableStuck) state.phase = 'resolve';
  return { ok: true, note };
}

/** Compare the rows and deal the damage. Called once per round, by the table. */
export function resolveRound(state) {
  if (state.phase !== 'resolve') return { ok: false };
  const names = ['Ember', 'Tide', 'Gale'];
  const damage = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const yours = rowValue(state.rows[i].you, i);
    const hers = rowValue(state.rows[i].sable, i);
    if (yours > hers) {
      damage[i] = yours - hers;
      state.sable.life = Math.max(0, state.sable.life - damage[i]);
      state.log.push(`${names[i]} row: your ${yours} beats her ${hers} — Sable loses ${damage[i]} lanterns.`);
    } else if (hers > yours) {
      damage[i] = -(hers - yours);
      state.you.life = Math.max(0, state.you.life + damage[i]);
      state.log.push(`${names[i]} row: her ${hers} beats your ${yours} — you lose ${-damage[i]} lanterns.`);
    } else {
      state.log.push(`${names[i]} row: ${yours} against ${hers} — the row holds.`);
    }
  }
  state.damage = damage;
  for (let i = 0; i < 3; i++) {
    for (const who of ['you', 'sable']) {
      const card = state.rows[i][who];
      if (card !== null) state[who].discard.push(card);
    }
    state.rows[i] = { you: null, sable: null };
  }
  state.plays = { you: 0, sable: 0 };
  state.playedRows = { you: [false, false, false], sable: [false, false, false] };

  if (state.you.life <= 0 && state.sable.life <= 0) {
    state.winner = state.you.life === state.sable.life ? 'draw' : state.you.life > state.sable.life ? 'you' : 'sable';
  } else if (state.sable.life <= 0) {
    state.winner = 'you';
  } else if (state.you.life <= 0) {
    state.winner = 'sable';
  }

  if (state.winner !== null) {
    state.phase = 'over';
    state.log.push(
      state.winner === 'you'
        ? 'Sable’s last lantern gutters out. The light is yours.'
        : state.winner === 'sable'
          ? 'Your last lantern gutters out. The moths close in.'
          : 'Both lights fade together. A draw, in the dark.',
    );
    return { ok: true, damage };
  }

  state.round += 1;
  drawUp(state.you, state.rng);
  drawUp(state.sable, state.rng);
  state.phase = 'play';
  state.log.push(`Round ${state.round}: play a card into each row.`);
  return { ok: true, damage };
}

/** The row totals right now, for the table: [{ you, sable }] per row. */
export function rowTotals(state) {
  return state.rows.map((row, i) => ({ you: rowValue(row.you, i), sable: rowValue(row.sable, i) }));
}

/** One-line summary of the duel, for the end screen. */
export function summary(state) {
  return {
    rounds: state.round,
    yourLife: state.you.life,
    sableLife: state.sable.life,
    winner: state.winner,
  };
}
