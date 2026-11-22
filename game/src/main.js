// main.js — wires Three Lanterns together: screens, mouse + keyboard input,
// the turn flow (you play, Sable answers in the same row, the round resolves),
// and the deterministic ?shot= states the screenshots are taken from.
//   ?shot=title — the title screen
//   ?shot=play  — mid-duel, two rows played, seed 1 unless &seed=N is given
//   ?shot=win   — a genuine victory, reached by autoplaying a seeded duel
//   ?shot=loss  — a genuine defeat, reached the same way

import { createGame, startGame, playCard, resolveRound, openRows } from './game.js';
import { chooseCard } from './ai.js';
import { beginnerPick } from './ai.js';
import { tableHtml, titleHtml, endHtml } from './render.js';
import { playTone, setMuted, isMuted } from './sound.js';

const app = document.getElementById('app');
const ui = { selectedCard: null, selectedRow: null };
let state = createGame(1);
let shot = null;

function params() {
  return new URLSearchParams(window.location.search);
}

function render() {
  if (state.phase === 'title') app.innerHTML = titleHtml();
  else if (state.phase === 'over') app.innerHTML = endHtml(state);
  else app.innerHTML = tableHtml(state, ui);
  wire();
}

/** Attach the table's buttons after every render. */
function wire() {
  app.querySelectorAll('[data-action="start"]').forEach((b) =>
    b.addEventListener('click', () => {
      playTone('start');
      startGame(state);
      render();
    }),
  );
  app.querySelectorAll('[data-action="again"]').forEach((b) =>
    b.addEventListener('click', () => {
      state = createGame(state.seed);
      ui.selectedCard = null;
      ui.selectedRow = null;
      playTone('start');
      render();
    }),
  );
  app.querySelectorAll('[data-action="resolve"]').forEach((b) =>
    b.addEventListener('click', () => {
      playTone('resolve');
      resolveRound(state);
      render();
    }),
  );
  app.querySelectorAll('[data-hand]').forEach((b) =>
    b.addEventListener('click', () => {
      const index = Number(b.dataset.hand);
      ui.selectedCard = ui.selectedCard === index ? null : index;
      playTone('select');
      render();
    }),
  );
  app.querySelectorAll('.row').forEach((row) =>
    row.addEventListener('click', () => {
      const index = Number(row.dataset.row);
      if (ui.selectedCard !== null) tryPlay(ui.selectedCard, index);
      else {
        ui.selectedRow = ui.selectedRow === index ? null : index;
        render();
      }
    }),
  );
  app.querySelectorAll('[data-action="mute"]').forEach((b) =>
    b.addEventListener('click', () => {
      setMuted(!isMuted());
      render();
    }),
  );
}

/** Play the selected card into a row, then let Sable answer in the same row. */
function tryPlay(handIndex, rowIndex) {
  const before = state.rows[rowIndex].you;
  const result = playCard(state, 'you', handIndex, rowIndex);
  if (!result.ok) {
    playTone('bad');
    ui.selectedCard = null;
    ui.selectedRow = null;
    render();
    return;
  }
  playTone('play');
  ui.selectedCard = null;
  ui.selectedRow = null;
  // Sable answers in the same row, at once, face up.
  if (state.phase === 'play' && state.rows[rowIndex].sable === null) {
    const answer = chooseCard(state, rowIndex, state.rows[rowIndex].you);
    if (answer !== -1) {
      const sableResult = playCard(state, 'sable', answer, rowIndex);
      if (sableResult.ok) playTone('answer');
    }
  }
  render();
}

document.addEventListener('keydown', (event) => {
  if (state.phase === 'title' && (event.key === 'Enter' || event.key === ' ')) {
    startGame(state);
    render();
    return;
  }
  if (state.phase === 'over' && event.key === 'Enter') {
    state = createGame(state.seed);
    render();
    return;
  }
  if (state.phase !== 'play') return;
  if (event.key >= '1' && event.key <= '5') {
    const index = Number(event.key) - 1;
    if (index < state.you.hand.length) {
      ui.selectedCard = ui.selectedCard === index ? null : index;
      playTone('select');
      render();
    }
    return;
  }
  const rowKeys = { q: 0, w: 1, e: 2 };
  if (event.key.toLowerCase() in rowKeys) {
    const row = rowKeys[event.key.toLowerCase()];
    if (ui.selectedCard !== null) tryPlay(ui.selectedCard, row);
    else {
      ui.selectedRow = ui.selectedRow === row ? null : row;
      render();
    }
    return;
  }
  if (event.key === 'Enter' && ui.selectedCard !== null && ui.selectedRow !== null) {
    tryPlay(ui.selectedCard, ui.selectedRow);
    return;
  }
  if (event.key === 'Escape') {
    ui.selectedCard = null;
    ui.selectedRow = null;
    render();
  }
});

/**
 * Play a whole duel with both sides on policy, seeded: the beginner for the
 * player, Sable for Sable. Used by the win/loss screenshots so the end screen
 * is a state a real duel reached, and by nothing else.
 */
function autoplay(seed, maxRounds = 80) {
  const duel = createGame(seed);
  startGame(duel);
  while (duel.phase !== 'over' && duel.round <= maxRounds) {
    if (duel.phase === 'resolve') {
      resolveRound(duel);
      continue;
    }
    for (const row of openRows(duel, 'you')) {
      if (duel.phase !== 'play') break;
      const pick = beginnerPick(duel, row);
      if (pick === -1) break;
      playCard(duel, 'you', pick, row);
      if (duel.phase === 'play' && duel.rows[row].sable === null) {
        const answer = chooseCard(duel, row, duel.rows[row].you);
        if (answer !== -1) playCard(duel, 'sable', answer, row);
      }
    }
    // The loop above filled every row it could. If the phase is still play,
    // somebody is stuck (a hand emptied by Tempest): resolve as the round
    // stands rather than spin.
    if (duel.phase === 'play') {
      duel.phase = 'resolve';
      resolveRound(duel);
    }
  }
  return duel;
}

/** Build the state a screenshot asks for, deterministically from its seed. */
function shotState(name, seed) {
  if (name === 'play') {
    const duel = createGame(seed);
    startGame(duel);
    // Two rows played, the third open: the middle of a duel.
    for (const row of [0, 1]) {
      const pick = beginnerPick(duel, row);
      playCard(duel, 'you', pick, row);
      const answer = chooseCard(duel, row, duel.rows[row].you);
      if (answer !== -1) playCard(duel, 'sable', answer, row);
    }
    return duel;
  }
  if (name === 'win' || name === 'loss') {
    // Autoplay seeded duels until one ends the way the shot asks.
    for (let s = seed; s < seed + 40; s++) {
      const duel = autoplay(s);
      if (duel.winner === 'you' && name === 'win') return duel;
      if (duel.winner === 'sable' && name === 'loss') return duel;
    }
    return autoplay(seed);
  }
  return createGame(seed);
}

function init() {
  const query = params();
  shot = query.get('shot');
  const seed = Number(query.get('seed') ?? '1') || 1;
  state = shotState(shot, seed);
  if (shot === 'title' || shot === null) state.phase = 'title';
  render();
}

init();
