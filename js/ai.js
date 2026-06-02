// AI interface: single entry point `getAIMove(state, difficulty)` that
// returns { row, col } for the next shot at the player's board.
// Strategies are isolated so they can be swapped/upgraded freely.
//
// Medium/Hard reconstruct their hunt/target state from the board on every call
// (an "open hit" is a shot cell on a ship that is not yet sunk) rather than
// holding hidden mutable state. This guarantees a shot is never repeated and
// that the AI returns to hunting automatically once a ship sinks.

const AI = (() => {
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const AXES = [[0, 1], [1, 0]]; // horizontal, vertical

  function inBounds(board, r, c) {
    return r >= 0 && r < board.length && c >= 0 && c < board[r].length;
  }

  function unfiredCells(board) {
    const cells = [];
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (!board[r][c].shot) cells.push([r, c]);
      }
    }
    return cells;
  }

  function shipById(ships, id) {
    return ships.find(s => s.id === id) || null;
  }

  // A cell that has been hit (shot, on a ship) whose ship is not yet sunk.
  function isOpenHit(board, ships, r, c) {
    if (!inBounds(board, r, c)) return false;
    const cell = board[r][c];
    if (!cell.shot || !cell.ship) return false;
    const ship = shipById(ships, cell.ship);
    return !!ship && !ship.sunk;
  }

  function openHits(board, ships) {
    const hits = [];
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (isOpenHit(board, ships, r, c)) hits.push([r, c]);
      }
    }
    return hits;
  }

  // Ordered list of candidate target cells derived from the current board.
  // Prefers extending an established line; otherwise queues neighbors of hits.
  function targetCandidates(board, ships) {
    const hits = openHits(board, ships);
    if (hits.length === 0) return [];

    const seen = new Set();
    const line = [];
    const neighbor = [];

    function add(list, r, c) {
      if (!inBounds(board, r, c) || board[r][c].shot) return;
      const k = r + ',' + c;
      if (seen.has(k)) return;
      seen.add(k);
      list.push([r, c]);
    }

    // Line extension: for each pair of collinear adjacent open hits, walk to
    // both ends of the contiguous run and propose the next cell beyond each end.
    for (const [r, c] of hits) {
      for (const [dr, dc] of AXES) {
        if (!isOpenHit(board, ships, r + dr, c + dc)) continue;
        let fr = r, fc = c;
        while (isOpenHit(board, ships, fr + dr, fc + dc)) { fr += dr; fc += dc; }
        add(line, fr + dr, fc + dc);
        let br = r, bc = c;
        while (isOpenHit(board, ships, br - dr, bc - dc)) { br -= dr; bc -= dc; }
        add(line, br - dr, bc - dc);
      }
    }
    if (line.length > 0) return line;

    // No line yet: queue the orthogonal neighbors of each open hit.
    for (const [r, c] of hits) {
      for (const [dr, dc] of ORTHO) add(neighbor, r + dr, c + dc);
    }
    return neighbor;
  }

  // Un-fired cells to hunt from. Hard mode restricts to a parity lattice
  // ((row + col) even) since the smallest ship spans two cells.
  function huntCandidates(board, { parity = false } = {}) {
    const cells = unfiredCells(board);
    if (!parity) return cells;
    const even = cells.filter(([r, c]) => (r + c) % 2 === 0);
    return even.length > 0 ? even : cells; // fall back if parity is exhausted
  }

  function pick(cells, rng) {
    if (cells.length === 0) return null;
    const [row, col] = cells[Math.floor(rng() * cells.length)];
    return { row, col };
  }

  // Easy: pick a uniformly random un-fired cell.
  function easyMove(state, rng) {
    return pick(unfiredCells(state.player.board), rng);
  }

  // Medium/Hard: target known hits first, otherwise hunt.
  function huntTargetMove(state, { parity }, rng) {
    const board = state.player.board;
    const ships = state.player.ships;
    const targets = targetCandidates(board, ships);
    if (targets.length > 0) return pick(targets, rng);
    return pick(huntCandidates(board, { parity }), rng);
  }

  function getAIMove(state, difficulty, rng = Math.random) {
    switch (difficulty) {
      case 'easy':   return easyMove(state, rng);
      case 'medium': return huntTargetMove(state, { parity: false }, rng);
      case 'hard':   return huntTargetMove(state, { parity: true }, rng);
      default:       return easyMove(state, rng);
    }
  }

  const api = { getAIMove };
  // Exposed for unit tests; has no effect on browser usage.
  api._internals = {
    inBounds, unfiredCells, isOpenHit, openHits,
    targetCandidates, huntCandidates, easyMove, huntTargetMove,
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AI;
}
