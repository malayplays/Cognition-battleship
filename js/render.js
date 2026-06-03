// Rendering: all DOM updates live here. No game logic.

const COL_LABELS = ['A','B','C','D','E','F','G','H','I','J'];

const Render = (() => {
  // ── Cell-reference cache ────────────────────────────────────────────
  // Indexed as _cellCache[containerId][r][c]. Populated once by
  // buildBoardDOM so that every subsequent lookup is O(1) instead of a
  // full querySelector traversal.
  const _cellCache = {};

  // ── Previous-state snapshots for dirty checking ────────────────────
  // Keyed by containerId. Each entry stores the last-rendered classKey
  // per cell so renderBoard can skip cells that haven't changed.
  const _prevState = {};

  function buildBoardDOM(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    // Top-left corner
    frag.appendChild(makeLabelCell(''));
    // Column labels
    for (let c = 0; c < BOARD_SIZE; c++) {
      frag.appendChild(makeLabelCell(COL_LABELS[c]));
    }
    // Init cache grid
    const grid = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      frag.appendChild(makeLabelCell(String(r + 1)));
      const row = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        frag.appendChild(cell);
        row.push(cell);
      }
      grid.push(row);
    }
    container.appendChild(frag);
    _cellCache[containerId] = grid;
    _prevState[containerId] = null; // force full render on first pass
  }

  function makeLabelCell(text) {
    const el = document.createElement('div');
    el.className = 'cell label';
    el.textContent = text;
    return el;
  }

  function cellEl(containerId, r, c) {
    const grid = _cellCache[containerId];
    return grid ? grid[r][c] : null;
  }

  // Build a lightweight key that captures the visual state of a cell so
  // we can skip DOM work when nothing changed.
  function cellStateKey(cell, ship, isEnemy, revealShips) {
    if (cell.shot && cell.ship) {
      return ship && ship.sunk ? 'K' : 'H';
    }
    if (cell.shot) return 'M';
    if (cell.ship && revealShips) return 'S';
    if (isEnemy && cell.ship && ship && ship.sunk) return 'R';
    return '';
  }

  function renderBoard(containerId, side, { revealShips }) {
    const isEnemy = containerId === 'ai-board';
    const grid = _cellCache[containerId];
    if (!grid) return;

    // Build a Map of shipId → ship once to avoid repeated .find() calls
    const shipMap = new Map();
    for (let i = 0; i < side.ships.length; i++) {
      shipMap.set(side.ships[i].id, side.ships[i]);
    }

    // Allocate / reuse previous-state snapshot
    let prev = _prevState[containerId];
    const snap = prev || new Array(BOARD_SIZE * BOARD_SIZE);

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const el = grid[r][c];
        const cell = side.board[r][c];
        const ship = cell.ship ? shipMap.get(cell.ship) : null;
        const key = cellStateKey(cell, ship, isEnemy, revealShips);
        const idx = r * BOARD_SIZE + c;

        // Skip if nothing changed for this cell
        if (prev && snap[idx] === key) {
          // But still preserve transient animation classes
          continue;
        }
        snap[idx] = key;

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
        let child = el.lastElementChild;
        while (child) {
          const prev_child = child.previousElementSibling;
          const cn = child.className;
          if (cn === 'smoke-puff' || cn === 'splash-drop' || cn === 'wreckage-piece' || cn === 'ship-wave') {
            el.removeChild(child);
          }
          child = prev_child;
        }

        if (key === 'K') {
          el.classList.add('sunk');
          addWrackageDetails(el);
          if (ship) setShipCellData(el, ship, r, c);
        } else if (key === 'H') {
          el.classList.add('hit');
          addSmokeDetails(el);
        } else if (key === 'M') {
          el.classList.add('miss');
          addSplashDetails(el);
        } else if (key === 'S') {
          el.classList.add('ship');
          if (ship) setShipCellData(el, ship, r, c);
        } else if (key === 'R') {
          el.classList.add('sunk-revealed');
          if (ship) setShipCellData(el, ship, r, c);
        }

        if (wasHitNew) el.classList.add('hit-new');
        if (wasSunkNew) el.classList.add('sunk-new');
        if (wasMissNew) el.classList.add('miss-new');
      }
    }
    _prevState[containerId] = snap;
    renderShipOverlays(containerId, side, { revealShips });
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

  // Ship sprite paths (high-res "1" variants)
  const SHIP_SPRITES = {
    carrier:    'assets/ships/carrier1.png',
    battleship: 'assets/ships/battleship1.png',
    cruiser:    'assets/ships/cruiser1.png',
    submarine:  'assets/ships/submarine1.png',
    destroyer:  'assets/ships/destroyer1.png'
  };

  // Pre-decode sprite images so the browser doesn't re-decode on each overlay rebuild
  const _spriteImages = {};
  for (const [id, src] of Object.entries(SHIP_SPRITES)) {
    const img = new Image();
    img.src = src;
    img.decoding = 'async';
    _spriteImages[id] = img;
  }

  // Track last overlay state to skip redundant rebuilds
  const _overlayKeys = {};

  // Render each placed ship as a single continuous overlay spanning its full footprint
  function renderShipOverlays(containerId, side, { revealShips }) {
    // Build a key representing current overlay state to skip redundant rebuilds
    let overlayKey = revealShips ? '1' : '0';
    for (let i = 0; i < side.ships.length; i++) {
      const s = side.ships[i];
      overlayKey += s.cells.length >= 2 ? (s.sunk ? 'K' : (revealShips ? 'V' : '_')) : '_';
      if (s.cells.length) overlayKey += s.cells[0][0] + ',' + s.cells[0][1];
    }
    if (_overlayKeys[containerId] === overlayKey) return;
    _overlayKeys[containerId] = overlayKey;

    const container = document.getElementById(containerId);
    let layer = container.querySelector('.ship-overlay-layer');
    if (layer) layer.remove();

    const hasVisibleShips = side.ships.some(ship =>
      ship.cells.length >= 2 && (revealShips || ship.sunk)
    );
    if (!hasVisibleShips) return;

    layer = document.createElement('div');
    layer.className = 'ship-overlay-layer';

    side.ships.forEach(ship => {
      if (ship.cells.length < 2) return;
      if (!revealShips && !ship.sunk) return;

      const orient = ship.cells[0][0] === ship.cells[1][0] ? 'H' : 'V';
      const startRow = Math.min(...ship.cells.map(([r]) => r));
      const startCol = Math.min(...ship.cells.map(([, c]) => c));

      const overlay = document.createElement('div');
      overlay.className = 'ship-overlay ship-' + ship.id + ' ship-orient-' + orient;

      if (orient === 'H') {
        overlay.style.gridRow = String(startRow + 2);
        overlay.style.gridColumn = (startCol + 2) + ' / span ' + ship.cells.length;
      } else {
        overlay.style.gridRow = (startRow + 2) + ' / span ' + ship.cells.length;
        overlay.style.gridColumn = String(startCol + 2);
      }

      if (ship.sunk) {
        overlay.classList.add('ship-sunk-overlay');
      }

      // Add sprite image (clone pre-loaded Image to avoid re-decode)
      const cachedImg = _spriteImages[ship.id];
      if (cachedImg) {
        const img = cachedImg.cloneNode(false);
        img.className = 'ship-sprite';
        img.alt = ship.id;
        img.draggable = false;

        if (orient === 'V') {
          // Pre-rotation width = 89% of the vertical footprint span
          const len = ship.cells.length;
          img.style.width = 'calc(0.89 * (' + len + ' * var(--cell-size) + ' + (len - 1) + ' * 1px))';
        }

        overlay.appendChild(img);
      }

      layer.appendChild(overlay);
    });

    container.appendChild(layer);
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

  function _setPlayable(containerId, playable) {
    const grid = _cellCache[containerId];
    if (!grid) return;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        grid[r][c].classList.toggle('playable', playable);
      }
    }
  }

  function setEnemyPlayable(playable) {
    _setPlayable('ai-board', playable);
  }

  function setPlayerPlayable(playable) {
    _setPlayable('player-board', playable);
  }

  let _fleetListEl = null;
  function renderFleetList(state) {
    if (!_fleetListEl) _fleetListEl = document.getElementById('fleet-list');
    const ul = _fleetListEl;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < state.player.ships.length; i++) {
      const s = state.player.ships[i];
      const li = document.createElement('li');
      li.textContent = `${s.name} (${s.size})`;
      if (s.cells.length === s.size) li.classList.add('placed');
      else if (i === state.placement.nextIndex) li.classList.add('current');
      frag.appendChild(li);
    }
    ul.textContent = ''; // faster than innerHTML = ''
    ul.appendChild(frag);
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
    document.getElementById('message-log').textContent = '';
  }

  // Invalidate dirty-tracking caches (call on game reset)
  function invalidateCaches() {
    _prevState['player-board'] = null;
    _prevState['ai-board'] = null;
    _overlayKeys['player-board'] = null;
    _overlayKeys['ai-board'] = null;
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
    const grid = _cellCache['player-board'];
    if (!grid) return;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const el = grid[r][c];
        if (el.classList.contains('preview') || el.classList.contains('preview-invalid')) {
          el.classList.remove('preview', 'preview-invalid');
        }
      }
    }
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
    const frag = document.createDocumentFragment();
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
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
      frag.appendChild(icon);
    }
    container.textContent = '';
    container.appendChild(frag);
  }

  // Screen management
  let _screens = null;
  function showScreen(screenId) {
    if (!_screens) _screens = document.querySelectorAll('.screen');
    for (let i = 0; i < _screens.length; i++) {
      _screens[i].classList.remove('active');
    }
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  }

  return {
    buildBoardDOM, renderBoard, renderFleetList, renderTurnIndicator,
    setEnemyPlayable, setPlayerPlayable, log, clearLog, invalidateCaches,
    showPreview, clearPreview, showEndModal, hideEndModal,
    setRotateLabel, setSetupPanelVisible, setStartEnabled,
    markNewShot, renderFleetStatus, showScreen,
    _cellEl: cellEl,
  };
})();
