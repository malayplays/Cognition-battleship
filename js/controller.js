// Game controller: owns state, wires DOM events, drives the turn loop.

const Controller = (() => {
  let state = createInitialState();
  let endModalTimer = null;

  function init() {
    Render.buildBoardDOM('player-board');
    Render.buildBoardDOM('ai-board');
    bindHomeEvents();
    bindEvents();
    randomizeFleet(state.ai);
    switchToBoard('player');
    Effects.setBgPhase('menu');
    refreshAll();
  }

  function bindHomeEvents() {
    document.getElementById('home-play-btn').addEventListener('click', () => {
      Render.showScreen('game-screen');
      Effects.setBgPhase('setup');
    });

    document.getElementById('home-howto-btn').addEventListener('click', () => {
      document.getElementById('howto-modal').classList.remove('hidden');
    });
    document.getElementById('howto-close-btn').addEventListener('click', () => {
      document.getElementById('howto-modal').classList.add('hidden');
    });

    document.getElementById('home-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('settings-close-btn').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('game-settings-btn').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
    });

    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
      if (endModalTimer) { clearTimeout(endModalTimer); endModalTimer = null; }
      Render.showScreen('home-screen');
      Effects.setBgPhase('menu');
    });

    document.getElementById('end-menu-btn').addEventListener('click', () => {
      resetGame();
      Render.showScreen('home-screen');
      Effects.setBgPhase('menu');
    });

    // Close modals by clicking backdrop
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    });
  }

  function bindEvents() {
    document.getElementById('player-board').addEventListener('click', onPlayerBoardClick);
    document.getElementById('player-board').addEventListener('mouseover', onPlayerBoardHover);
    document.getElementById('player-board').addEventListener('mouseleave', () => Render.clearPreview());
    document.getElementById('ai-board').addEventListener('click', onEnemyBoardClick);

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
      // Ripple effect on placed cells
      const cells = getShipCells(row, col, ship.size, state.placement.orientation);
      cells.forEach(([r, c]) => {
        const el = document.querySelector(`#player-board .cell[data-row="${r}"][data-col="${c}"]`);
        if (el) Effects.placeRipple(el);
      });
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

    // Determine log type
    const logType = result.result === 'hit' ? (result.sunk ? 'sunk' : 'hit') : 'miss';

    Render.log(state, `You fired at ${COL_LABELS[col]}${row + 1}: ${result.result.toUpperCase()}.`, logType);

    // Attack result text
    if (result.result === 'hit') {
      Effects.showAttackResult('Direct Hit!', 'hit');
      Effects.screenShake('light');
      const hitEl = document.querySelector(`#ai-board .cell[data-row="${row}"][data-col="${col}"]`);
      Effects.sparks(hitEl);
      Render.markNewShot('ai-board', row, col, 'hit');
    } else {
      Effects.showAttackResult('Miss!', 'miss');
      Render.markNewShot('ai-board', row, col, 'miss');
    }

    if (result.sunk) {
      Render.log(state, `You sank the enemy ${result.sunk.name}!`, 'sunk');
      setTimeout(() => {
        Effects.showBanner(`${result.sunk.name} Sunk!`);
        Effects.screenShake('medium');
      }, 400);
      // Mark all cells of sunk ship
      result.sunk.cells.forEach(([r, c]) => {
        Render.markNewShot('ai-board', r, c, 'sunk');
      });
    }

    Render.renderBoard('ai-board', state.ai, { revealShips: false });
    Render.renderFleetStatus(state);

    if (result.allSunk) return endGame('player');

    state.turn = 'ai';
    Render.setEnemyPlayable(false);
    Render.renderTurnIndicator(state);

    // Check for late-battle phase change
    updateBgForBattle();

    setTimeout(aiTurn, 600);
  }

  function aiTurn() {
    if (state.phase !== 'playing') return;
    const move = AI.getAIMove(state, state.difficulty);
    if (!move) return;
    const result = fireAt(state.player, move.row, move.col);
    if (!result.valid) {
      return setTimeout(aiTurn, 0);
    }

    const logType = result.result === 'hit' ? (result.sunk ? 'sunk' : 'hit') : 'miss';
    Render.log(state, `Enemy fired at ${COL_LABELS[move.col]}${move.row + 1}: ${result.result.toUpperCase()}.`, logType);

    if (result.result === 'hit') {
      Effects.screenShake('medium');
      const hitEl = document.querySelector(`#player-board .cell[data-row="${move.row}"][data-col="${move.col}"]`);
      Effects.sparks(hitEl);
      Render.markNewShot('player-board', move.row, move.col, 'hit');
    } else {
      Render.markNewShot('player-board', move.row, move.col, 'miss');
    }

    if (result.sunk) {
      Render.log(state, `The enemy sank your ${result.sunk.name}!`, 'sunk');
      setTimeout(() => {
        Effects.showBanner(`Your ${result.sunk.name} Sunk!`);
        Effects.screenShake('heavy');
      }, 300);
      result.sunk.cells.forEach(([r, c]) => {
        Render.markNewShot('player-board', r, c, 'sunk');
      });
    }

    Render.renderBoard('player-board', state.player, { revealShips: true });
    Render.renderFleetStatus(state);

    if (result.allSunk) return endGame('ai');
    state.turn = 'player';
    Render.setEnemyPlayable(true);
    Render.renderTurnIndicator(state);

    updateBgForBattle();
  }

  function updateBgForBattle() {
    const totalShips = 10; // 5 per side
    const sunkCount = state.player.ships.filter(s => s.sunk).length +
                      state.ai.ships.filter(s => s.sunk).length;
    if (sunkCount >= 6) {
      Effects.setBgPhase('late');
    }
  }

  function startGame() {
    if (!allShipsPlaced(state.player)) return;
    state.phase = 'playing';
    state.turn = 'player';
    Render.setSetupPanelVisible(false);
    Render.clearPreview();
    Render.setEnemyPlayable(true);
    Render.renderTurnIndicator(state);
    Render.renderFleetStatus(state);
    Render.log(state, 'Battle begins. You fire first!', 'hit');
    switchToBoard('ai');
    Effects.setBgPhase('battle');
  }

  function endGame(winner) {
    state.phase = 'over';
    state.winner = winner;
    Render.setEnemyPlayable(false);
    Render.renderTurnIndicator(state);
    Render.renderBoard('ai-board', state.ai, { revealShips: true });
    Render.renderFleetStatus(state);

    if (winner === 'player') {
      Effects.setBgPhase('victory');
      Effects.confetti(50);
    } else {
      Effects.setBgPhase('defeat');
    }

    endModalTimer = setTimeout(() => { endModalTimer = null; Render.showEndModal(state); }, 800);
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
    Effects.setBgPhase('setup');
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
    Render.renderFleetStatus(state);
  }

  return { init };
})();
