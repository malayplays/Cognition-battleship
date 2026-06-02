// Randomized fleet placement must always yield a legal, non-overlapping fleet.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const game = loadGame();
const { BOARD_SIZE, createSide, randomizeFleet } = game;

function assertLegalFleet(side) {
  // Every ship has exactly `size` cells, all in-bounds.
  for (const ship of side.ships) {
    assert.equal(
      ship.cells.length,
      ship.size,
      `${ship.id} should occupy ${ship.size} cells`,
    );
    for (const [r, c] of ship.cells) {
      assert.ok(
        r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE,
        `${ship.id} cell [${r}, ${c}] is out of bounds`,
      );
    }
    // Cells form a straight, contiguous horizontal or vertical run.
    const rows = ship.cells.map(([r]) => r);
    const cols = ship.cells.map(([, c]) => c);
    const sameRow = rows.every(r => r === rows[0]);
    const sameCol = cols.every(c => c === cols[0]);
    assert.ok(sameRow || sameCol, `${ship.id} is not in a straight line`);
  }

  // No two ships share a cell: 17 distinct occupied cells total.
  const seen = new Set();
  let occupied = 0;
  for (const ship of side.ships) {
    for (const [r, c] of ship.cells) {
      const key = `${r},${c}`;
      assert.ok(!seen.has(key), `cell ${key} is double-occupied`);
      seen.add(key);
      occupied++;
    }
  }
  assert.equal(occupied, 17);

  // The board grid agrees with the ship cell lists.
  let boardOccupied = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (side.board[r][c].ship !== null) boardOccupied++;
    }
  }
  assert.equal(boardOccupied, 17);
}

test('randomizeFleet produces a legal fleet across many runs', () => {
  for (let i = 0; i < 300; i++) {
    const side = createSide();
    randomizeFleet(side);
    assertLegalFleet(side);
  }
});

test('randomizeFleet clears any previous placement before re-rolling', () => {
  const side = createSide();
  randomizeFleet(side);
  randomizeFleet(side); // second roll must not stack ships from the first
  assertLegalFleet(side);
});
