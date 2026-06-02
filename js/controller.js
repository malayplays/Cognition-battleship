// Game controller: owns state, wires DOM events, drives the turn loop.

const Controller = (() => {
  let state = createInitialState();

  function init() {
    Render.buildBoardDOM('player-board');
    Render.buildBoardDOM('ai-board');
    bindEvents();
    // AI fleet placed at startup so a quick Randomize on player side is enough.
    randomizeFleet(state.ai);
    switchToBoard('player');
    refreshAll();
  }

  function bindEvents() {
    document.getElementById('player-board').addEventListener('click', onPlayerBoardClick);
    document.getElementById('player-board').addEventListener('mouseover', onPlayerBoardHover);
    document.getElementById('player-board').addEventListener('mouseleave', () => Render.clearPreview());
    document.getElementById('ai-board').addEventListener('click', onEnemyBoardClick);

    // Touch: show placement preview on touch move/start (tap equivalent of hover)
    document.getElementById('player-board').addEventListener('touchstart', onPlayerBoardTouch, { passive: true });
    document.getElementById('player-board').addEventListener('touchmove', onPlayerBoardTouch, { passive: true });
    document.getElementById('player-board').addEventListener('touchend', () => Render.clearPreview());

    document.getElementById('rotate-btn').addEventListener('click', () => {
      state.placement.orientation = state.placement.orientation === 'H' ? 'V' : 'H';
      Render.setRotateLabel(state.placement.orientation);
    });
    document.getElementById('randomize-btn').addEventListener('click', () => {
      randomizeFleet(state.player);
      state.placement.nextIndex = state.player.ships.length;
      refreshAll();
    });
    document.getElementById('clear-btn').addEventListener('click', () => {
      clearSide(state.player);
      state.placement.nextIndex = 0;
      refreshAll();
    });
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('play-again-btn').addEventListener('click', resetGame);
    document.getElementById('difficulty').addEventListener('change', e => {
      state.difficulty = e.target.value;
    });

    // Mobile board toggle
    initBoardToggle();
  }

  function onPlayerBoardClick(e) {
    if (state.phase !== 'setup') return;
    const cell = e.target.closest('.cell');
    if (!cell || cell.classList.contains('label')) return;
    const row = +cell.dataset.row;
    const col = +cell.dataset.col;
    const idx = state.placement.nextIndex;
    if (idx >= state.player.ships.length) return;
    const ship = state.player.ships[idx];
    if (placeShip(state.player, idx, row, col, state.placement.orientation)) {
      state.placement.nextIndex++;
      Render.clearPreview();
      refreshAll();
    }
  }

  function onPlayerBoardHover(e) {
    if (state.phase !== 'setup') return;
    const cell = e.target.closest('.cell');
    if (!cell || cell.classList.contains('label')) return;
    if (state.placement.nextIndex >= state.player.ships.length) return;
    Render.showPreview(state, +cell.dataset.row, +cell.dataset.col);
  }

  function onEnemyBoardClick(e) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;
    const cell = e.target.closest('.cell');
    if (!cell || cell.classList.contains('label')) return;
    const row = +cell.dataset.row;
    const col = +cell.dataset.col;
    const result = fireAt(state.ai, row, col);
    if (!result.valid) return;
    Render.log(state, `You fired at ${COL_LABELS[col]}${row + 1}: ${result.result.toUpperCase()}.`);
    if (result.sunk) Render.log(state, `You sank the enemy ${result.sunk.name}!`);
    Render.renderBoard('ai-board', state.ai, { revealShips: false });
    if (result.allSunk) return endGame('player');
    state.turn = 'ai';
    Render.setEnemyPlayable(false);
    Render.renderTurnIndicator(state);
    setTimeout(aiTurn, 500);
  }

  function aiTurn() {
    if (state.phase !== 'playing') return;
    const move = AI.getAIMove(state, state.difficulty);
    if (!move) return;
    const result = fireAt(state.player, move.row, move.col);
    if (!result.valid) { // shouldn't happen for the random AI
      return setTimeout(aiTurn, 0);
    }
    Render.log(state, `Enemy fired at ${COL_LABELS[move.col]}${move.row + 1}: ${result.result.toUpperCase()}.`);
    if (result.sunk) Render.log(state, `The enemy sank your ${result.sunk.name}!`);
    Render.renderBoard('player-board', state.player, { revealShips: true });
    if (result.allSunk) return endGame('ai');
    state.turn = 'player';
    Render.setEnemyPlayable(true);
    Render.renderTurnIndicator(state);
  }

  function startGame() {
    if (!allShipsPlaced(state.player)) return;
    state.phase = 'playing';
    state.turn = 'player';
    Render.setSetupPanelVisible(false);
    Render.clearPreview();
    Render.setEnemyPlayable(true);
    Render.renderTurnIndicator(state);
    Render.log(state, 'Battle begins. You fire first.');
    switchToBoard('ai');
  }

  function endGame(winner) {
    state.phase = 'over';
    state.winner = winner;
    Render.setEnemyPlayable(false);
    Render.renderTurnIndicator(state);
    // Reveal AI ships on loss/win for closure.
    Render.renderBoard('ai-board', state.ai, { revealShips: true });
    Render.showEndModal(state);
  }

  function resetGame() {
    state = createInitialState();
    randomizeFleet(state.ai);
    Render.hideEndModal();
    Render.clearLog();
    Render.setSetupPanelVisible(true);
    Render.setRotateLabel(state.placement.orientation);
    document.getElementById('difficulty').value = state.difficulty;
    switchToBoard('player');
    refreshAll();
  }

  function onPlayerBoardTouch(e) {
    if (state.phase !== 'setup') return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const cell = el.closest('.cell');
    if (!cell || cell.classList.contains('label')) return;
    if (state.placement.nextIndex >= state.player.ships.length) return;
    Render.showPreview(state, +cell.dataset.row, +cell.dataset.col);
  }

  function initBoardToggle() {
    const toggle = document.getElementById('board-toggle');
    if (!toggle) return;
    const buttons = toggle.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('player-wrapper').classList.toggle('hidden-mobile', target !== 'player');
        document.getElementById('ai-wrapper').classList.toggle('hidden-mobile', target !== 'ai');
      });
    });
  }

  function switchToBoard(target) {
    const toggle = document.getElementById('board-toggle');
    if (!toggle || getComputedStyle(toggle).display === 'none') return;
    toggle.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.target === target);
    });
    document.getElementById('player-wrapper').classList.toggle('hidden-mobile', target !== 'player');
    document.getElementById('ai-wrapper').classList.toggle('hidden-mobile', target !== 'ai');
  }

  function refreshAll() {
    Render.renderBoard('player-board', state.player, { revealShips: true });
    Render.renderBoard('ai-board', state.ai, {
      revealShips: state.phase === 'over',
    });
    Render.renderFleetList(state);
    Render.renderTurnIndicator(state);
    Render.setStartEnabled(state.phase === 'setup' && allShipsPlaced(state.player));
    Render.setEnemyPlayable(state.phase === 'playing' && state.turn === 'player');
  }

  return { init };
})();
