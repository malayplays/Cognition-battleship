// Pure-ish board logic: placement validation, placing ships, firing shots,
// detecting sinks and fleet defeat. No DOM access.

function getShipCells(row, col, size, orientation) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    if (orientation === 'H') cells.push([row, col + i]);
    else cells.push([row + i, col]);
  }
  return cells;
}

function canPlaceShip(board, row, col, size, orientation) {
  const cells = getShipCells(row, col, size, orientation);
  for (const [r, c] of cells) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (board[r][c].ship !== null) return false;
  }
  return true;
}

function placeShip(side, shipIndex, row, col, orientation) {
  const ship = side.ships[shipIndex];
  if (!canPlaceShip(side.board, row, col, ship.size, orientation)) return false;
  const cells = getShipCells(row, col, ship.size, orientation);
  for (const [r, c] of cells) {
    side.board[r][c].ship = ship.id;
  }
  ship.cells = cells;
  ship.orientation = orientation;
  return true;
}

function clearSide(side) {
  side.board = createEmptyBoard();
  side.ships.forEach(s => { s.cells = []; s.hits = 0; s.sunk = false; });
}

function randomizeFleet(side) {
  clearSide(side);
  for (let i = 0; i < side.ships.length; i++) {
    const ship = side.ships[i];
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 500) {
      const orientation = Math.random() < 0.5 ? 'H' : 'V';
      const row = Math.floor(Math.random() * BOARD_SIZE);
      const col = Math.floor(Math.random() * BOARD_SIZE);
      if (canPlaceShip(side.board, row, col, ship.size, orientation)) {
        placeShip(side, i, row, col, orientation);
        placed = true;
      }
      attempts++;
    }
    if (!placed) { // pathological — restart
      return randomizeFleet(side);
    }
  }
}

// Fire at a cell on `targetSide`. Returns:
//   { valid, result: 'hit'|'miss', sunk: shipObj|null, allSunk: bool }
function fireAt(targetSide, row, col) {
  const cell = targetSide.board[row][col];
  if (cell.shot) return { valid: false };
  cell.shot = true;
  if (cell.ship === null) {
    return { valid: true, result: 'miss', sunk: null, allSunk: false };
  }
  const ship = targetSide.ships.find(s => s.id === cell.ship);
  ship.hits++;
  let sunk = null;
  if (ship.hits >= ship.size) {
    ship.sunk = true;
    sunk = ship;
  }
  const allSunk = targetSide.ships.every(s => s.sunk);
  return { valid: true, result: 'hit', sunk, allSunk };
}

function allShipsPlaced(side) {
  return side.ships.every(s => s.cells.length === s.size);
}
