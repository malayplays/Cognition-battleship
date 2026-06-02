// Central game state. All mutations flow through controller/board modules.
// One factory so reset is trivial.

const FLEET_SPEC = [
  { id: 'carrier',    name: 'Carrier',    size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser',    name: 'Cruiser',    size: 3 },
  { id: 'submarine',  name: 'Submarine',  size: 3 },
  { id: 'destroyer',  name: 'Destroyer',  size: 2 },
];

const BOARD_SIZE = 10;

function createEmptyBoard() {
  const grid = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      row.push({ ship: null, shot: false });
    }
    grid.push(row);
  }
  return grid;
}

function createSide() {
  return {
    board: createEmptyBoard(),
    ships: FLEET_SPEC.map(s => ({ ...s, cells: [], hits: 0, sunk: false })),
  };
}

function createInitialState() {
  return {
    phase: 'setup',          // 'setup' | 'playing' | 'over'
    turn: 'player',          // 'player' | 'ai'
    player: createSide(),
    ai: createSide(),
    placement: {
      nextIndex: 0,          // index into player.ships
      orientation: 'H',      // 'H' | 'V'
    },
    difficulty: 'easy',
    winner: null,            // 'player' | 'ai' | null
    log: [],
  };
}
