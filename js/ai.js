// AI interface: single entry point `getAIMove(state, difficulty)` that
// returns { row, col } for the next shot at the player's board.
// Strategies are isolated so they can be swapped/upgraded freely.
//
// Medium/Hard reconstruct their hunt/target state from the board on every call
// (an "open hit" is a shot cell on a ship that is not yet sunk) rather than
// holding hidden mutable state. This guarantees a shot is never repeated and
// that the AI returns to hunting automatically once a ship sinks.

const AI = (() => {
  // ─── Impossible-mode tunable constants ───
  // The AI stays tied with the player most of the game, then pulls 1 ahead in
  // the endgame to guarantee it finishes first. Final margin = 1 shot.
  const PACE_OFFSET = 0;          // 0 = stay tied mid-game
  const ENDGAME_THRESHOLD = 3;    // when playerShotsToWin <= this, AI goes 1 ahead

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

  // ─── Impossible mode ───────────────────────────────────────────────────────
  // The AI knows exactly where every player ship cell is. It sandbags until the
  // endgame, then goes lethal and finishes the player off.

  // Count remaining un-hit cells on a side's ships (shots-to-win for the opponent).
  function shotsToWin(side) {
    let count = 0;
    for (const ship of side.ships) {
      if (!ship.sunk) count += (ship.size - ship.hits);
    }
    return count;
  }

  // All player ship cells that haven't been shot yet (cheat knowledge).
  function unhitPlayerShipCells(state) {
    const cells = [];
    const board = state.player.board;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (board[r][c].ship && !board[r][c].shot) cells.push([r, c]);
      }
    }
    return cells;
  }

  // Pick a believable deliberate miss: an empty (water) cell chosen using the
  // hunt heuristic / parity pattern so it looks like normal play.
  function believableMiss(state, rng) {
    const board = state.player.board;
    // Prefer parity-lattice cells to mimic hard-mode hunt behavior
    const water = [];
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        if (!board[r][c].shot && !board[r][c].ship) water.push([r, c]);
      }
    }
    if (water.length === 0) return null; // no water left (shouldn't happen)
    const parity = water.filter(([r, c]) => (r + c) % 2 === 0);
    const pool = parity.length > 0 ? parity : water;
    const [row, col] = pool[Math.floor(rng() * pool.length)];
    return { row, col };
  }

  // Human-like cheat hit: finishes partially-damaged ships before starting new
  // ones. Uses targetCandidates (line extension / neighbor exploration) filtered
  // to guaranteed ship cells, so the pattern looks like a skilled human player.
  function smartCheatHit(state, rng) {
    const board = state.player.board;
    const ships = state.player.ships;

    // 1. If there are open hits, continue targeting that ship (human-like).
    const targets = targetCandidates(board, ships);
    if (targets.length > 0) {
      // Filter target candidates to only ship cells (guaranteed hit).
      const shipTargets = targets.filter(([r, c]) => board[r][c].ship && !board[r][c].shot);
      if (shipTargets.length > 0) return pick(shipTargets, rng);
    }

    // 2. No open hits or no adjacent ship cells — start a new ship.
    const cells = unhitPlayerShipCells(state);
    if (cells.length === 0) return null;
    return pick(cells, rng);
  }

  function impossibleMove(state, rng) {
    const aiShotsToWin = shotsToWin(state.player);   // what AI still needs
    const playerShotsToWin = shotsToWin(state.ai);   // what player still needs

    // Endgame: when player is close to winning, AI pulls 1 ahead to guarantee
    // it finishes first. Mid-game: stay tied (mirror player hits).
    const target = playerShotsToWin <= ENDGAME_THRESHOLD
      ? playerShotsToWin - 1   // 1 ahead → guarantees AI fires kill shot first
      : playerShotsToWin - PACE_OFFSET;  // tied mid-game

    // KILL SHOT: fire only when BOTH sides need exactly 1 hit.
    // The player just hit (dropped from 2→1 this turn), so the AI fires now.
    // This guarantees margin = exactly 1 every game.
    if (aiShotsToWin === 1 && playerShotsToWin <= 1) {
      return smartCheatHit(state, rng);
    }

    // If AI is at 1 but player still needs >1, hold fire (wait for player to
    // catch up to 1 so the finish is exactly 1 shot apart).
    if (aiShotsToWin === 1 && playerShotsToWin > 1) {
      return believableMiss(state, rng);
    }

    // AI is behind target → guaranteed hit (catch up / pull ahead).
    if (aiShotsToWin > target) {
      return smartCheatHit(state, rng) || believableMiss(state, rng);
    }

    // AI is at or ahead of target → miss to maintain pacing.
    return believableMiss(state, rng) || smartCheatHit(state, rng);
  }

  function getAIMove(state, difficulty, rng = Math.random) {
    switch (difficulty) {
      case 'easy':       return easyMove(state, rng);
      case 'medium':     return huntTargetMove(state, { parity: false }, rng);
      case 'hard':       return huntTargetMove(state, { parity: true }, rng);
      case 'impossible': return impossibleMove(state, rng);
      default:           return easyMove(state, rng);
    }
  }

  const api = { getAIMove };
  // Exposed for unit tests; has no effect on browser usage.
  api._internals = {
    inBounds, unfiredCells, isOpenHit, openHits,
    targetCandidates, huntCandidates, easyMove, huntTargetMove,
    shotsToWin, unhitPlayerShipCells, believableMiss, smartCheatHit, impossibleMove,
  };
  return api;
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AI;
}
