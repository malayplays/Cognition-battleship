// AI interface: single entry point `getAIMove(state, difficulty)` that
// returns { row, col } for the next shot at the player's board.
// Strategies are isolated so they can be swapped/upgraded freely.

const AI = (() => {
  function unfiredCells(board) {
    const cells = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!board[r][c].shot) cells.push([r, c]);
      }
    }
    return cells;
  }

  // Easy: pick a uniformly random un-fired cell.
  function easyMove(state) {
    const cells = unfiredCells(state.player.board);
    if (cells.length === 0) return null;
    const [row, col] = cells[Math.floor(Math.random() * cells.length)];
    return { row, col };
  }

  // PLACEHOLDER — Medium: hunt/target heuristic (not yet implemented).
  function mediumMove(state) {
    console.warn('Medium AI not implemented; falling back to easy.');
    return easyMove(state);
  }

  // PLACEHOLDER — Hard: probability-density model (not yet implemented).
  function hardMove(state) {
    console.warn('Hard AI not implemented; falling back to easy.');
    return easyMove(state);
  }

  function getAIMove(state, difficulty) {
    switch (difficulty) {
      case 'easy':   return easyMove(state);
      case 'medium': return mediumMove(state);
      case 'hard':   return hardMove(state);
      default:       return easyMove(state);
    }
  }

  return { getAIMove };
})();
