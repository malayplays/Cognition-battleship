// Ship placement validation and fleet composition.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const game = loadGame();
const {
  FLEET_SPEC,
  BOARD_SIZE,
  createSide,
  getShipCells,
  canPlaceShip,
  placeShip,
  allShipsPlaced,
} = game;

test('fleet spec is the standard 5/4/3/3/2', () => {
  assert.deepEqual(
    FLEET_SPEC.map(s => s.size),
    [5, 4, 3, 3, 2],
  );
  const side = createSide();
  assert.equal(side.ships.length, 5);
  assert.deepEqual(side.ships.map(s => s.size), [5, 4, 3, 3, 2]);
});

test('getShipCells lays out horizontal and vertical runs', () => {
  assert.deepEqual(getShipCells(2, 3, 3, 'H'), [[2, 3], [2, 4], [2, 5]]);
  assert.deepEqual(getShipCells(2, 3, 3, 'V'), [[2, 3], [3, 3], [4, 3]]);
});

test('accepts a valid horizontal placement', () => {
  const side = createSide();
  assert.equal(canPlaceShip(side.board, 0, 0, 5, 'H'), true);
  assert.equal(placeShip(side, 0, 0, 0, 'H'), true);
  assert.deepEqual(side.ships[0].cells, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]]);
  for (let c = 0; c < 5; c++) {
    assert.equal(side.board[0][c].ship, 'carrier');
  }
});

test('accepts a valid vertical placement', () => {
  const side = createSide();
  assert.equal(canPlaceShip(side.board, 0, 0, 4, 'V'), true);
  assert.equal(placeShip(side, 1, 0, 0, 'V'), true);
  assert.deepEqual(side.ships[1].cells, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  for (let r = 0; r < 4; r++) {
    assert.equal(side.board[r][0].ship, 'battleship');
  }
});

test('rejects a ship that runs off the right edge', () => {
  const side = createSide();
  // Carrier size 5 at col 6 horizontally would need cols 6..10 (10 is off-grid).
  assert.equal(canPlaceShip(side.board, 0, BOARD_SIZE - 4, 5, 'H'), false);
  assert.equal(placeShip(side, 0, 0, BOARD_SIZE - 4, 'H'), false);
  // Nothing should have been written to the board.
  assert.deepEqual(side.ships[0].cells, []);
});

test('rejects a ship that runs off the bottom edge', () => {
  const side = createSide();
  assert.equal(canPlaceShip(side.board, BOARD_SIZE - 4, 0, 5, 'V'), false);
  assert.equal(placeShip(side, 0, BOARD_SIZE - 4, 0, 'V'), false);
});

test('rejects negative coordinates', () => {
  const side = createSide();
  assert.equal(canPlaceShip(side.board, -1, 0, 3, 'H'), false);
  assert.equal(canPlaceShip(side.board, 0, -1, 3, 'V'), false);
});

test('rejects overlapping ships', () => {
  const side = createSide();
  assert.equal(placeShip(side, 0, 0, 0, 'H'), true); // carrier across row 0
  // Battleship vertical through (0,2) would collide with the carrier.
  assert.equal(canPlaceShip(side.board, 0, 2, 4, 'V'), false);
  assert.equal(placeShip(side, 1, 0, 2, 'V'), false);
  assert.deepEqual(side.ships[1].cells, []);
  // A non-overlapping spot still works.
  assert.equal(placeShip(side, 1, 1, 0, 'H'), true);
});

test('a full legal fleet places exactly the 5/4/3/3/2 cells', () => {
  const side = createSide();
  // One ship per row, all starting at col 0 — guaranteed non-overlapping.
  side.ships.forEach((ship, i) => {
    assert.equal(placeShip(side, i, i, 0, 'H'), true);
  });
  assert.equal(allShipsPlaced(side), true);

  const occupied = side.board.flat().filter(cell => cell.ship !== null).length;
  assert.equal(occupied, 5 + 4 + 3 + 3 + 2); // 17

  side.ships.forEach(ship => {
    assert.equal(ship.cells.length, ship.size);
  });
});

test('allShipsPlaced is false until every ship is down', () => {
  const side = createSide();
  assert.equal(allShipsPlaced(side), false);
  for (let i = 0; i < side.ships.length - 1; i++) {
    placeShip(side, i, i, 0, 'H');
  }
  assert.equal(allShipsPlaced(side), false);
  placeShip(side, side.ships.length - 1, side.ships.length - 1, 0, 'H');
  assert.equal(allShipsPlaced(side), true);
});
