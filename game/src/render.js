// render.js — draws the table: title, hands, rows, lanterns and the log.
// DOM only; the rules live in game.js. Every card is a div with a readable
// value and suit, and the suits are small inline SVGs, so the game needs no
// image files at all.

import { SUITS, ROWS, cardLabel, rowValue } from './deck.js';
import { rowTotals } from './game.js';

const ROW_NAMES = ['Ember', 'Tide', 'Gale'];

/** The six suit and special glyphs, as inline SVG paths on a 24x24 grid. */
const GLYPHS = {
  ember: '<path d="M12 2c1 4-4 6-4 10a4 4 0 0 0 8 0c0-2-1-3-1-3s3 1 3 4a6 6 0 0 1-12 0C6 8 12 6 12 2z" fill="currentColor"/>',
  tide: '<path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z" fill="currentColor"/>',
  gale: '<path d="M3 8h9a3 3 0 1 0-3-3M3 12h13a3 3 0 1 1-3 3M3 16h6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  stone: '<path d="M12 4l7 6-4 10H9l-4-10z" fill="currentColor"/>',
  lantern: '<rect x="9" y="3" width="6" height="3" rx="1" fill="currentColor"/><path d="M7 6h10l-1 13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="currentColor"/><circle cx="12" cy="13" r="3" fill="#ffe9a8"/>',
  tempest: '<path d="M13 2L5 13h5l-1 9 8-11h-5z" fill="currentColor"/>',
};

/** An inline SVG glyph, 22px, in the card's own colour. */
export function glyph(kind, suit) {
  const key = kind === 'number' ? suit : kind;
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${GLYPHS[key] ?? ''}</svg>`;
}

/** A lantern meter: filled flames for life left, dim ones for life lost. */
export function lanternMeter(life, max = 30) {
  const lit = Math.max(0, life);
  let flames = '';
  for (let i = 0; i < max; i++) {
    flames += `<span class="flame ${i < lit ? 'lit' : 'out'}" title="${i < lit ? 'a lantern burns' : 'a lantern is out'}">✦</span>`;
  }
  return `<div class="lanterns" aria-label="${lit} of ${max} lanterns">${flames}</div>`;
}

/** One card face. `faceDown` shows the moth back instead of the card. */
export function cardHtml(card, { selected = false, faceDown = false, playable = false } = {}) {
  if (faceDown) {
    return `<div class="card back" title="Sable's card"><span class="moth">🦋</span><span class="back-name">Sable</span></div>`;
  }
  const suit = card.suit !== null ? SUITS[card.suit] : null;
  const cls = card.kind === 'number' ? `suit-${card.suit}` : `kind-${card.kind}`;
  const big = card.kind === 'number' ? String(card.value) : card.kind === 'lantern' ? '+4' : '✕';
  const name = cardLabel(card);
  const sub = card.kind === 'number' ? suit.name : card.kind === 'lantern' ? 'Heal 4 lanterns' : 'Destroy their best card';
  return `<div class="card ${cls}${selected ? ' selected' : ''}${playable ? ' playable' : ''}" data-card="${card.id}" title="${name} — ${sub}">
    <span class="card-corner">${glyph(card.kind, card.suit)}</span>
    <span class="card-value">${big}</span>
    <span class="card-name">${name}</span>
    <span class="card-sub">${sub}</span>
  </div>`;
}

/** A row of the table: the two cards, their totals, and the row's name. */
function rowHtml(state, i, selectedRow) {
  const row = state.rows[i];
  const totals = rowTotals(state)[i];
  const name = ROW_NAMES[i];
  const doubled = (card) => card !== null && card.kind === 'number' && card.suit === ROWS[i];
  const slot = (card, who) => {
    if (card === null) return `<div class="slot empty" data-row="${i}" data-who="${who}"><span>empty</span></div>`;
    const mark = doubled(card) ? '<span class="doubled">+4 own suit</span>' : '';
    return `<div class="slot filled" data-row="${i}" data-who="${who}">${cardHtml(card)}${mark}</div>`;
  };
  return `<section class="row${selectedRow === i ? ' selected-row' : ''}" data-row="${i}">
    <div class="row-head"><h3>${name} row</h3><span class="row-total">you ${totals.you} · Sable ${totals.sable}</span></div>
    <div class="row-cards">
      <div class="side-label">Sable</div>
      ${slot(row.sable, 'sable')}
      <div class="side-label">You</div>
      ${slot(row.you, 'you')}
    </div>
  </section>`;
}

/** The whole table for `phase` play or resolve. `ui` carries the selection. */
export function tableHtml(state, ui) {
  const rows = [0, 1, 2].map((i) => rowHtml(state, i, ui.selectedRow)).join('');
  const hand = state.you.hand
    .map((card, index) => {
      const sel = ui.selectedCard === index;
      return `<button class="hand-card${sel ? ' selected' : ''}" data-hand="${index}" aria-label="Play ${cardLabel(card)}">${cardHtml(card, { selected: sel, playable: true })}</button>`;
    })
    .join('');
  const sableBacks = state.sable.hand.map(() => `<div class="card back small"><span class="moth">🦋</span></div>`).join('');
  const resolveButton =
    state.phase === 'resolve'
      ? `<button class="primary" data-action="resolve">Reveal the rows — resolve round ${state.round}</button>`
      : `<p class="hint">Pick a card, then a row. Keys: 1–5 pick a card, Q/W/E pick a row, Enter plays, Esc cancels.</p>`;
  const lastDamage =
    state.damage !== null
      ? `<p class="damage-note">Last round: ${state.damage.map((d, i) => `${ROW_NAMES[i]} ${d > 0 ? `+${d} to Sable` : d < 0 ? `${-d} to you` : 'held'}`).join(' · ')}</p>`
      : '';
  const log = state.log.slice(-6).map((line) => `<li>${line}</li>`).join('');
  return `
  <header class="duel-head">
    <div class="duellist sable">
      <h2>Sable, the Moth Queen</h2>
      ${lanternMeter(state.sable.life)}
      <p class="life-num">${state.sable.life} lanterns · ${state.sable.hand.length} cards in hand</p>
    </div>
    <div class="round-badge"><span>Round ${state.round}</span></div>
    <div class="duellist you">
      <h2>You, the Lantern Keeper</h2>
      ${lanternMeter(state.you.life)}
      <p class="life-num">${state.you.life} lanterns · ${state.you.hand.length} cards in hand</p>
    </div>
  </header>
  <div class="sable-hand" aria-label="Sable's hand, face down">${sableBacks}</div>
  <main class="rows">${rows}</main>
  <section class="hand" aria-label="Your hand">${hand}</section>
  <div class="actions">${resolveButton}</div>
  ${lastDamage}
  <aside class="log"><h3>The tale so far</h3><ul>${log}</ul></aside>`;
}

/** The title screen: the name, the stakes, and how to play. */
export function titleHtml() {
  return `
  <section class="screen title">
    <p class="eyebrow">A duel of light and moths</p>
    <h1>Three Lanterns</h1>
    <p class="tagline">Sable, the Moth Queen, wants your light. You guard 30 lanterns. She guards 30 of her own.</p>
    <div class="rules">
      <p>Each round, play one card into each of the three rows — Ember, Tide, Gale. A card in the row of its own suit is worth <strong>+4</strong>.</p>
      <p>When the rows are full, each row is compared: the higher total wins and deals damage equal to the difference.</p>
      <p><strong>Lantern</strong> cards heal 4 lanterns. <strong>Tempest</strong> cards blow away your enemy's strongest card on the table. <strong>Stone</strong> cards match no row, but they never miss.</p>
      <p>First to 0 lanterns loses. Play with mouse or keys: <strong>1–5</strong> pick a card, <strong>Q/W/E</strong> pick a row, <strong>Enter</strong> plays, <strong>Esc</strong> cancels.</p>
    </div>
    <button class="primary big" data-action="start">Begin the duel</button>
  </section>`;
}

/** The end screen: victory, defeat, or a draw in the dark. */
export function endHtml(state) {
  const s = { rounds: state.round, yourLife: state.you.life, sableLife: state.sable.life, winner: state.winner };
  const heading = s.winner === 'you' ? 'VICTORY' : s.winner === 'sable' ? 'DEFEAT' : 'A DRAW IN THE DARK';
  const text =
    s.winner === 'you'
      ? 'Sable’s last lantern gutters out. The moths scatter, and the light is yours — all thirty lanterns burning steady.'
      : s.winner === 'sable'
        ? 'Your last lantern gutters out. The moths close in, soft as snowfall, and the dark takes the table.'
        : 'Both lights fade together. Neither keeper yields, and neither keeps the dawn.';
  const lastLog = state.log.slice(-4).map((line) => `<li>${line}</li>`).join('');
  return `
  <section class="screen end ${s.winner === 'you' ? 'won' : 'lost'}">
    <p class="eyebrow">The duel is over</p>
    <h1>${heading}</h1>
    <p class="tagline">${text}</p>
    <p class="score">After ${s.rounds} round${s.rounds === 1 ? '' : 's'} — you: ${s.yourLife} lanterns · Sable: ${s.sableLife} lanterns</p>
    <ul class="log end-log">${lastLog}</ul>
    <button class="primary big" data-action="again">Play again</button>
  </section>`;
}
