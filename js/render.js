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
    const isEnemy = containerId === 'ai-board';
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const el = cellEl(containerId, r, c);
        if (!el) continue;
        // Preserve hit-new/sunk-new/miss-new temporarily for animation
        const wasHitNew = el.classList.contains('hit-new');
        const wasSunkNew = el.classList.contains('sunk-new');
        const wasMissNew = el.classList.contains('miss-new');
        el.className = 'cell';
        // Clear data attributes
        delete el.dataset.shipType;
        delete el.dataset.shipPos;
        delete el.dataset.shipOrient;
        delete el.dataset.shipIdx;
        delete el.dataset.shipLen;
        // Remove dynamic children (smoke, splash, wreckage)
        el.querySelectorAll('.smoke-puff, .splash-drop, .wreckage-piece, .ship-wave').forEach(c => c.remove());

        const cell = side.board[r][c];
        const shipId = cell.ship;
        const ship = shipId ? side.ships.find(s => s.id === shipId) : null;

        if (cell.shot && shipId) {
          if (ship && ship.sunk) {
            el.classList.add('sunk');
            addWrackageDetails(el);
            if (ship) setShipCellData(el, ship, r, c);
          } else {
            el.classList.add('hit');
            addSmokeDetails(el);
          }
        } else if (cell.shot) {
          el.classList.add('miss');
          addSplashDetails(el);
        } else if (shipId && revealShips) {
          el.classList.add('ship');
          if (ship) setShipCellData(el, ship, r, c);
        } else if (isEnemy && shipId && ship && ship.sunk) {
          el.classList.add('sunk-revealed');
          if (ship) setShipCellData(el, ship, r, c);
        }

        if (wasHitNew) el.classList.add('hit-new');
        if (wasSunkNew) el.classList.add('sunk-new');
        if (wasMissNew) el.classList.add('miss-new');
      }
    }
  }

  // Set ship type, position (bow/mid/stern), orientation, index, length data on cell
  function setShipCellData(el, ship, r, c) {
    el.dataset.shipType = ship.id;
    el.dataset.shipLen = ship.cells.length;
    if (ship.cells.length >= 2) {
      const orient = ship.cells[0][0] === ship.cells[1][0] ? 'H' : 'V';
      el.dataset.shipOrient = orient;
      const idx = ship.cells.findIndex(([sr, sc]) => sr === r && sc === c);
      el.dataset.shipIdx = idx;
      if (idx === 0) el.dataset.shipPos = 'bow';
      else if (idx === ship.cells.length - 1) el.dataset.shipPos = 'stern';
    }
  }

  // Add smoke puff elements to hit cells
  function addSmokeDetails(el) {
    for (let i = 0; i < 2; i++) {
      const puff = document.createElement('div');
      puff.className = 'smoke-puff';
      el.appendChild(puff);
    }
  }

  // Add splash droplet elements to miss cells
  function addSplashDetails(el) {
    for (let i = 0; i < 3; i++) {
      const drop = document.createElement('div');
      drop.className = 'splash-drop';
      el.appendChild(drop);
    }
  }

  // Add wreckage debris to sunk cells
  function addWrackageDetails(el) {
    for (let i = 0; i < 2; i++) {
      const piece = document.createElement('div');
      piece.className = 'wreckage-piece';
      el.appendChild(piece);
    }
  }

  // Mark a cell as newly hit/sunk for animations, auto-remove after delay
  function markNewShot(containerId, r, c, type) {
    const el = cellEl(containerId, r, c);
    if (!el) return;
    const cls = type === 'sunk' ? 'sunk-new' : type === 'hit' ? 'hit-new' : type === 'miss' ? 'miss-new' : '';
    if (cls) {
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 1500);
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
    if (state.phase === 'setup') {
      el.textContent = 'Setup Phase -- Place Your Fleet';
      el.style.color = '';
    } else if (state.phase === 'playing') {
      if (state.turn === 'player') {
        el.textContent = 'Your Turn -- Fire!';
        el.style.color = 'var(--accent)';
      } else {
        el.textContent = 'Enemy Firing...';
        el.style.color = 'var(--hit)';
      }
    } else if (state.phase === 'over') {
      if (state.winner === 'player') {
        el.textContent = 'Victory!';
        el.style.color = 'var(--accent)';
      } else {
        el.textContent = 'Defeat...';
        el.style.color = 'var(--sunk)';
      }
    }
  }

  function log(state, message, type) {
    state.log.push(message);
    const el = document.getElementById('message-log');
    const div = document.createElement('div');
    div.textContent = message;
    if (type) div.classList.add('log-' + type);
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
    const decoration = document.getElementById('end-decoration');
    const title = document.getElementById('end-title');
    const msg = document.getElementById('end-message');

    if (state.winner === 'player') {
      decoration.textContent = '\u2693\uFE0F';
      title.textContent = 'Victory!';
      title.style.color = 'var(--accent)';
      msg.textContent = 'You sank the entire enemy fleet!';
    } else {
      decoration.textContent = '\uD83D\uDCA5';
      title.textContent = 'Defeat';
      title.style.color = 'var(--sunk)';
      msg.textContent = 'Your fleet has been destroyed.';
    }

    // Stats
    const stats = document.getElementById('end-stats');
    const playerSunk = state.ai.ships.filter(s => s.sunk).length;
    const aiSunk = state.player.ships.filter(s => s.sunk).length;
    stats.innerHTML = `Ships Sunk: ${playerSunk}/5 | Ships Lost: ${aiSunk}/5`;

    document.getElementById('end-modal').classList.remove('hidden');
  }

  function hideEndModal() {
    document.getElementById('end-modal').classList.add('hidden');
  }

  function setRotateLabel(orientation) {
    const btn = document.getElementById('rotate-btn');
    btn.innerHTML = `<span class="btn-icon">\u21BA</span> ${orientation === 'H' ? 'Horizontal' : 'Vertical'}`;
  }

  function setSetupPanelVisible(visible) {
    document.getElementById('setup-panel').classList.toggle('hidden', !visible);
  }

  function setStartEnabled(enabled) {
    document.getElementById('start-btn').disabled = !enabled;
  }

  // Fleet status icons (ship health display)
  function renderFleetStatus(state) {
    renderSideFleetStatus('player-fleet-status', state.player.ships);
    renderSideFleetStatus('ai-fleet-status', state.ai.ships, state.phase !== 'over');
  }

  function renderSideFleetStatus(containerId, ships, hideUnsunk) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    ships.forEach(s => {
      const icon = document.createElement('span');
      icon.className = 'fleet-status-icon';
      if (s.sunk) {
        icon.classList.add('sunk-status');
        icon.textContent = s.name.charAt(0);
      } else if (s.hits > 0) {
        icon.classList.add('hit-status');
        icon.textContent = s.name.charAt(0);
      } else {
        icon.textContent = hideUnsunk ? '?' : s.name.charAt(0);
      }
      icon.title = s.sunk ? `${s.name} - SUNK` : s.hits > 0 ? `${s.name} - HIT (${s.hits}/${s.size})` : s.name;
      container.appendChild(icon);
    });
  }

  // Screen management
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  }

  return {
    buildBoardDOM, renderBoard, renderFleetList, renderTurnIndicator,
    setEnemyPlayable, setPlayerPlayable, log, clearLog,
    showPreview, clearPreview, showEndModal, hideEndModal,
    setRotateLabel, setSetupPanelVisible, setStartEnabled,
    markNewShot, renderFleetStatus, showScreen,
  };
})();
