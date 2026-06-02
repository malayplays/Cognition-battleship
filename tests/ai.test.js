'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AI = require('../js/ai.js');
const { targetCandidates, huntCandidates, openHits } = AI._internals;

const SIZE = 10;

// ---- Test helpers (mirror the real board/fireAt behavior) -------------------

function makeState(size = SIZE) {
  const board = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push({ ship: null, shot: false });
    board.push(row);
  }
  return { player: { board, ships: [] } };
}

function addShip(state, id, cells) {
  state.player.ships.push({
    id, name: id, size: cells.length, cells, hits: 0, sunk: false,
  });
  for (const [r, c] of cells) state.player.board[r][c].ship = id;
}

// Apply a shot the same way board.js#fireAt would.
function fire(state, r, c) {
  const cell = state.player.board[r][c];
  cell.shot = true;
  if (cell.ship) {
    const ship = state.player.ships.find(s => s.id === cell.ship);
    ship.hits++;
    if (ship.hits >= ship.size) ship.sunk = true;
  }
}

function asSet(cells) {
  return new Set(cells.map(([r, c]) => r + ',' + c));
}

// Deterministic RNG (mulberry32) so tie-breaking is reproducible.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- hunt -> target transition ---------------------------------------------

test('hunt-to-target: after a hit, Medium fires an orthogonal neighbor', () => {
  const state = makeState();
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]);
  fire(state, 5, 5); // hit, ship not sunk

  const expected = asSet([[4, 5], [6, 5], [5, 4], [5, 6]]);
  // Drive several times with different RNG seeds: every move must be a neighbor.
  for (let s = 0; s < 25; s++) {
    const move = AI.getAIMove(state, 'medium', seeded(s));
    assert.ok(expected.has(move.row + ',' + move.col),
      `move ${move.row},${move.col} should be an orthogonal neighbor`);
  }
});

test('neighbor queueing: a single open hit yields exactly its 4 in-bounds neighbors', () => {
  const state = makeState();
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]);
  fire(state, 5, 5);

  const cands = targetCandidates(state.player.board, state.player.ships);
  assert.deepEqual(asSet(cands), asSet([[4, 5], [6, 5], [5, 4], [5, 6]]));
});

test('neighbor queueing: out-of-bounds neighbors are excluded (corner hit)', () => {
  const state = makeState();
  addShip(state, 'destroyer', [[0, 0], [0, 1]]);
  fire(state, 0, 0);

  const cands = targetCandidates(state.player.board, state.player.ships);
  assert.deepEqual(asSet(cands), asSet([[1, 0], [0, 1]]));
});

// ---- collinear line extension ----------------------------------------------

test('collinear extension: two horizontal hits extend along the line, both ends', () => {
  const state = makeState();
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]);
  fire(state, 5, 5);
  fire(state, 5, 6); // two collinear open hits

  const cands = targetCandidates(state.player.board, state.player.ships);
  // Only the line ends, NOT the perpendicular neighbors.
  assert.deepEqual(asSet(cands), asSet([[5, 4], [5, 7]]));
});

test('collinear extension: vertical run of three extends past the open end only', () => {
  const state = makeState();
  addShip(state, 'battleship', [[3, 4], [4, 4], [5, 4], [6, 4]]);
  fire(state, 3, 4);
  fire(state, 4, 4);
  fire(state, 5, 4);
  fire(state, 2, 4); // miss above -> top end blocked

  const cands = targetCandidates(state.player.board, state.player.ships);
  assert.deepEqual(asSet(cands), asSet([[6, 4]]));
});

// ---- return to hunting after a sink ----------------------------------------

test('return to hunting: once the ship is sunk, no target candidates remain', () => {
  const state = makeState();
  addShip(state, 'destroyer', [[2, 2], [2, 3]]);
  fire(state, 2, 2);
  fire(state, 2, 3); // sinks it

  assert.equal(openHits(state.player.board, state.player.ships).length, 0);
  assert.deepEqual(targetCandidates(state.player.board, state.player.ships), []);

  // The next move must come from hunting (any un-fired cell), not be forced
  // to a neighbor of the sunk ship.
  const move = AI.getAIMove(state, 'medium', seeded(1));
  assert.equal(state.player.board[move.row][move.col].shot, false);
});

test('return to hunting: a sunk ship does not pollute targeting of a still-open ship', () => {
  const state = makeState();
  addShip(state, 'destroyer', [[0, 0], [0, 1]]);
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]);
  fire(state, 0, 0);
  fire(state, 0, 1); // destroyer sunk
  fire(state, 5, 5); // cruiser open hit

  const cands = targetCandidates(state.player.board, state.player.ships);
  // Only the open cruiser hit drives targeting.
  assert.deepEqual(asSet(cands), asSet([[4, 5], [6, 5], [5, 4], [5, 6]]));
});

// ---- Hard mode parity ------------------------------------------------------

test('Hard parity: hunt candidates are all even-parity cells', () => {
  const board = makeState().player.board;
  const cands = huntCandidates(board, { parity: true });
  assert.ok(cands.length > 0);
  for (const [r, c] of cands) {
    assert.equal((r + c) % 2, 0, `(${r},${c}) should have even parity`);
  }
  // exactly half of a 10x10 board
  assert.equal(cands.length, (SIZE * SIZE) / 2);
});

test('Hard parity: getAIMove hunt shots are always even parity', () => {
  const state = makeState();
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]); // present but un-hit
  for (let s = 0; s < 50; s++) {
    const move = AI.getAIMove(state, 'hard', seeded(s));
    assert.equal((move.row + move.col) % 2, 0);
  }
});

test('Hard parity: targeting ignores parity (will fire an odd-parity neighbor)', () => {
  const state = makeState();
  // Hit at (5,5) [even]; neighbor (5,6) is odd parity but must still be reachable.
  addShip(state, 'cruiser', [[5, 5], [5, 6], [5, 7]]);
  fire(state, 5, 5);
  const cands = targetCandidates(state.player.board, state.player.ships);
  assert.deepEqual(asSet(cands), asSet([[4, 5], [6, 5], [5, 4], [5, 6]]));
  // and getAIMove(hard) returns one of those neighbors (some odd parity)
  const move = AI.getAIMove(state, 'hard', seeded(3));
  assert.ok(asSet([[4, 5], [6, 5], [5, 4], [5, 6]]).has(move.row + ',' + move.col));
});

// ---- never repeat a shot ----------------------------------------------------

function placeStandardFleet(state) {
  // Deterministic, non-overlapping layout.
  addShip(state, 'carrier',    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]);
  addShip(state, 'battleship', [[2, 0], [2, 1], [2, 2], [2, 3]]);
  addShip(state, 'cruiser',    [[4, 5], [4, 6], [4, 7]]);
  addShip(state, 'submarine',  [[6, 1], [7, 1], [8, 1]]);
  addShip(state, 'destroyer',  [[9, 8], [9, 9]]);
}

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`never repeats a shot (${difficulty}) over a full game`, () => {
    const state = makeState();
    placeStandardFleet(state);
    const rng = seeded(1234);
    const fired = new Set();

    let move;
    let guard = 0;
    while ((move = AI.getAIMove(state, difficulty, rng)) !== null) {
      const k = move.row + ',' + move.col;
      assert.equal(state.player.board[move.row][move.col].shot, false,
        `${difficulty}: targeted an already-shot cell ${k}`);
      assert.ok(!fired.has(k), `${difficulty}: repeated shot at ${k}`);
      fired.add(k);
      fire(state, move.row, move.col);
      if (state.player.ships.every(s => s.sunk)) break;
      if (++guard > SIZE * SIZE + 5) {
        assert.fail(`${difficulty}: exceeded max moves without finishing`);
      }
    }
    // Every ship should be sunk and no shot repeated.
    assert.ok(state.player.ships.every(s => s.sunk),
      `${difficulty}: not all ships were sunk`);
  });
}

// ---- Easy behavior unchanged ------------------------------------------------

test('Easy returns an un-fired cell and null when the board is full', () => {
  const state = makeState();
  let move;
  const rng = seeded(7);
  let count = 0;
  while ((move = AI.getAIMove(state, 'easy', rng)) !== null) {
    assert.equal(state.player.board[move.row][move.col].shot, false);
    fire(state, move.row, move.col);
    count++;
  }
  assert.equal(count, SIZE * SIZE);
  assert.equal(AI.getAIMove(state, 'easy', rng), null);
});
