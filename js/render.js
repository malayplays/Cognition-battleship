// Rendering: all DOM updates live here. No game logic.

const COL_LABELS = ['A','B','C','D','E','F','G','H','I','J'];

const Render = (() => {
  function buildBoardDOM(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    // Top-left corner
    container.appendChild(makeLabelCell(''));
    // Column labels
    for (let c = 0; c < BOARD_SIZE; c++) {
      container.appendChild(makeLabelCell(COL_LABELS[c]));
    }
    for (let r = 0; r < BOARD_SIZE; r++) {
      container.appendChild(makeLabelCell(String(r + 1)));
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        container.appendChild(cell);
      }
    }
  }

  function makeLabelCell(text) {
    const el = document.createElement('div');
    el.className = 'cell label';
    el.textContent = text;
    return el;
  }

  function cellEl(containerId, r, c) {
    return document.querySelector(
      `#${containerId} .cell[data-row="${r}"][data-col="${c}"]`
    );
  }

  function renderBoard(containerId, side, { revealShips }) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const el = cellEl(containerId, r, c);
        if (!el) continue;
        el.className = 'cell';
        const cell = side.board[r][c];
        const shipId = cell.ship;
        const ship = shipId ? side.ships.find(s => s.id === shipId) : null;

        if (cell.shot && shipId) {
          if (ship && ship.sunk) el.classList.add('sunk');
          else el.classList.add('hit');
        } else if (cell.shot) {
          el.classList.add('miss');
        } else if (shipId && revealShips) {
          el.classList.add('ship');
        }
      }
    }
  }

  function setEnemyPlayable(playable) {
    document.querySelectorAll('#ai-board .cell:not(.label)').forEach(el => {
      el.classList.toggle('playable', playable);
    });
  }

  function setPlayerPlayable(playable) {
    document.querySelectorAll('#player-board .cell:not(.label)').forEach(el => {
      el.classList.toggle('playable', playable);
    });
  }

  function renderFleetList(state) {
    const ul = document.getElementById('fleet-list');
    ul.innerHTML = '';
    state.player.ships.forEach((s, i) => {
      const li = document.createElement('li');
      li.textContent = `${s.name} (${s.size})`;
      if (s.cells.length === s.size) li.classList.add('placed');
      else if (i === state.placement.nextIndex) li.classList.add('current');
      ul.appendChild(li);
    });
  }

  function renderTurnIndicator(state) {
    const el = document.getElementById('turn-indicator');
    if (state.phase === 'setup') el.textContent = 'Setup phase — place your fleet';
    else if (state.phase === 'playing') {
      el.textContent = state.turn === 'player' ? 'Your turn — fire!' : 'Enemy is firing…';
    } else if (state.phase === 'over') {
      el.textContent = state.winner === 'player' ? 'Victory!' : 'Defeat.';
    }
  }

  function log(state, message) {
    state.log.push(message);
    const el = document.getElementById('message-log');
    const div = document.createElement('div');
    div.textContent = message;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() {
    document.getElementById('message-log').innerHTML = '';
  }

  function showPreview(state, row, col) {
    clearPreview();
    const ship = state.player.ships[state.placement.nextIndex];
    if (!ship) return;
    const cells = getShipCells(row, col, ship.size, state.placement.orientation);
    const valid = canPlaceShip(state.player.board, row, col, ship.size, state.placement.orientation);
    for (const [r, c] of cells) {
      const el = cellEl('player-board', r, c);
      if (!el) continue;
      el.classList.add(valid ? 'preview' : 'preview-invalid');
    }
  }

  function clearPreview() {
    document.querySelectorAll('#player-board .cell.preview, #player-board .cell.preview-invalid')
      .forEach(el => el.classList.remove('preview', 'preview-invalid'));
  }

  function showEndModal(state) {
    document.getElementById('end-title').textContent =
      state.winner === 'player' ? 'You Win!' : 'You Lose';
    document.getElementById('end-message').textContent =
      state.winner === 'player'
        ? 'You sank the entire enemy fleet.'
        : 'Your fleet has been destroyed.';
    document.getElementById('end-modal').classList.remove('hidden');
  }

  function hideEndModal() {
    document.getElementById('end-modal').classList.add('hidden');
  }

  function setRotateLabel(orientation) {
    document.getElementById('rotate-btn').textContent =
      `Rotate: ${orientation === 'H' ? 'Horizontal' : 'Vertical'}`;
  }

  function setSetupPanelVisible(visible) {
    document.getElementById('setup-panel').classList.toggle('hidden', !visible);
  }

  function setStartEnabled(enabled) {
    document.getElementById('start-btn').disabled = !enabled;
  }

  return {
    buildBoardDOM, renderBoard, renderFleetList, renderTurnIndicator,
    setEnemyPlayable, setPlayerPlayable, log, clearLog,
    showPreview, clearPreview, showEndModal, hideEndModal,
    setRotateLabel, setSetupPanelVisible, setStartEnabled,
  };
})();
