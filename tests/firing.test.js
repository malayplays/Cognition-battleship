// Hit/miss resolution, double-fire protection, sink and win detection.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const game = loadGame();
const { createSide, placeShip, fireAt } = game;

// A small deterministic board: carrier (5) across row 0, destroyer (2) down col 9.
function makeSide() {
  const side = createSide();
  placeShip(side, 0, 0, 0, 'H'); // carrier  -> [0,0]..[0,4]
  placeShip(side, 4, 0, 9, 'V'); // destroyer -> [0,9],[1,9]
  return side;
}

// A complete, legal fleet: each ship laid horizontally on its own row from col 0.
function makeFullSide() {
  const side = createSide();
  side.ships.forEach((ship, i) => placeShip(side, i, i, 0, 'H'));
  return side;
}

test('a miss marks the cell as shot and reports a miss', () => {
  const side = makeSide();
  const res = fireAt(side, 5, 5);
  assert.equal(res.valid, true);
  assert.equal(res.result, 'miss');
  assert.equal(res.sunk, null);
  assert.equal(res.allSunk, false);
  assert.equal(side.board[5][5].shot, true);
});

test('a hit marks the right cell and increments only that ship', () => {
  const side = makeSide();
  const res = fireAt(side, 0, 0);
  assert.equal(res.valid, true);
  assert.equal(res.result, 'hit');
  assert.equal(side.board[0][0].shot, true);
  const carrier = side.ships.find(s => s.id === 'carrier');
  assert.equal(carrier.hits, 1);
  assert.equal(carrier.sunk, false);
  // Other ships untouched.
  assert.equal(side.ships.find(s => s.id === 'destroyer').hits, 0);
});

test('firing the same cell twice is rejected and changes nothing', () => {
  const side = makeSide();
  const first = fireAt(side, 0, 0);
  assert.equal(first.valid, true);
  const carrierHitsAfterFirst = side.ships.find(s => s.id === 'carrier').hits;

  const second = fireAt(side, 0, 0);
  assert.equal(second.valid, false);
  // No double counting of hits.
  assert.equal(side.ships.find(s => s.id === 'carrier').hits, carrierHitsAfterFirst);

  // Re-firing a missed cell is likewise rejected.
  fireAt(side, 7, 7);
  assert.equal(fireAt(side, 7, 7).valid, false);
});

test('a ship is sunk only when all its cells are hit', () => {
  const side = makeSide();
  // Destroyer occupies [0,9] and [1,9].
  let res = fireAt(side, 0, 9);
  assert.equal(res.result, 'hit');
  assert.equal(res.sunk, null, 'not sunk after a single hit');
  assert.equal(side.ships.find(s => s.id === 'destroyer').sunk, false);

  res = fireAt(side, 1, 9);
  assert.equal(res.result, 'hit');
  assert.ok(res.sunk, 'sunk after the final cell is hit');
  assert.equal(res.sunk.id, 'destroyer');
  assert.equal(side.ships.find(s => s.id === 'destroyer').sunk, true);
});

test('partial damage across ships never reports a sink', () => {
  const side = makeSide();
  fireAt(side, 0, 0); // carrier 1/5
  fireAt(side, 0, 1); // carrier 2/5
  const res = fireAt(side, 0, 9); // destroyer 1/2
  assert.equal(res.sunk, null);
  assert.equal(res.allSunk, false);
});

test('allSunk (win) is true only once every ship in the fleet is sunk', () => {
  const side = makeFullSide();
  const ships = side.ships;
  const lastShip = ships[ships.length - 1];

  // Fire at every ship cell in order. allSunk must stay false until the very
  // last cell of the very last ship is hit.
  let finalResult = null;
  ships.forEach((ship, shipIdx) => {
    ship.cells.forEach(([r, c], cellIdx) => {
      const res = fireAt(side, r, c);
      assert.equal(res.result, 'hit');
      const isFinalCell =
        shipIdx === ships.length - 1 && cellIdx === ship.cells.length - 1;
      if (isFinalCell) {
        finalResult = res;
      } else {
        assert.equal(
          res.allSunk,
          false,
          `win declared early after sinking ${ship.id}`,
        );
      }
    });
  });

  assert.ok(finalResult, 'expected to hit a final cell');
  assert.equal(finalResult.allSunk, true);
  assert.equal(finalResult.sunk.id, lastShip.id);
  assert.equal(side.ships.every(s => s.sunk), true);
});

test('win detection ignores misses and only tracks sunk ships', () => {
  const side = makeSide();
  // A scattering of misses must never trigger a win.
  for (const [r, c] of [[3, 3], [4, 4], [5, 5], [6, 6]]) {
    const res = fireAt(side, r, c);
    assert.equal(res.result, 'miss');
    assert.equal(res.allSunk, false);
  }
});
