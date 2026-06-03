// AI "thinking" delay — makes the computer opponent feel human.
// All timing constants are grouped at the top for easy tuning.

const Thinking = (() => {
  // ─── Timing Constants ────────────────────────────────────────────────
  const DEFAULT_BASE_MIN_MS = 1500;          // First move / no history: random in [1500, 2500]
  const DEFAULT_BASE_MAX_MS = 2500;
  const ROLLING_WINDOW = 3;                  // Average over last N player moves

  const JITTER_MIN_FACTOR = 0.7;             // Multiply base by random in [0.7, 1.3]
  const JITTER_MAX_FACTOR = 1.3;

  const CLAMP_MIN_MS = 500;                  // Never shorter than this
  const CLAMP_MAX_MS = 4500;                 // Never longer than this

  // Hard-mode "obvious move" overrides
  const CONFIRMED_LINE_MIN_MS = 400;         // 2+ collinear hits, clear next cell
  const CONFIRMED_LINE_MAX_MS = 900;
  const CONFIRMED_LINE_JITTER = 0.15;        // ±15%

  const SINGLE_HIT_MIN_MS = 800;             // One open hit, firing adjacent
  const SINGLE_HIT_MAX_MS = 1600;
  const SINGLE_HIT_JITTER = 0.20;            // ±20%

  // ─── State ───────────────────────────────────────────────────────────
  let playerMoveDurations = [];              // Rolling buffer of last N durations (ms)
  let turnStartTime = null;                  // Timestamp when player's turn began
  let thinkTimer = null;                     // Active setTimeout handle

  // ─── Player Pace Tracking ────────────────────────────────────────────
  function startPlayerTimer() {
    turnStartTime = performance.now();
  }

  function recordPlayerMove() {
    if (turnStartTime === null) return;
    const duration = performance.now() - turnStartTime;
    turnStartTime = null;
    playerMoveDurations.push(duration);
    if (playerMoveDurations.length > ROLLING_WINDOW) {
      playerMoveDurations.shift();
    }
  }

  function getBaseDelay() {
    if (playerMoveDurations.length === 0) {
      // No history: random default
      return DEFAULT_BASE_MIN_MS + Math.random() * (DEFAULT_BASE_MAX_MS - DEFAULT_BASE_MIN_MS);
    }
    const sum = playerMoveDurations.reduce((a, b) => a + b, 0);
    return sum / playerMoveDurations.length;
  }

  // ─── Jitter ──────────────────────────────────────────────────────────
  function applyJitter(base, deviation) {
    const factor = 1 + (Math.random() * 2 - 1) * deviation;
    return base * factor;
  }

  // ─── Hard-Mode Obviousness Classification ────────────────────────────
  // Returns 'confirmed_line' | 'single_hit' | 'hunt'
  function classifyMove(state) {
    const board = state.player.board;
    const ships = state.player.ships;
    const internals = AI._internals;

    const hits = internals.openHits(board, ships);
    if (hits.length === 0) return 'hunt';

    // Check for collinear extension (2+ adjacent open hits along an axis)
    const AXES = [[0, 1], [1, 0]];
    for (const [r, c] of hits) {
      for (const [dr, dc] of AXES) {
        if (internals.isOpenHit(board, ships, r + dr, c + dc)) {
          return 'confirmed_line';
        }
      }
    }

    // Has open hits but no confirmed line
    return 'single_hit';
  }

  // ─── Compute Final Delay ─────────────────────────────────────────────
  function computeDelay(state, difficulty) {
    let delay;

    if (difficulty === 'hard') {
      const moveType = classifyMove(state);

      if (moveType === 'confirmed_line') {
        const base = CONFIRMED_LINE_MIN_MS + Math.random() * (CONFIRMED_LINE_MAX_MS - CONFIRMED_LINE_MIN_MS);
        delay = applyJitter(base, CONFIRMED_LINE_JITTER);
      } else if (moveType === 'single_hit') {
        const base = SINGLE_HIT_MIN_MS + Math.random() * (SINGLE_HIT_MAX_MS - SINGLE_HIT_MIN_MS);
        delay = applyJitter(base, SINGLE_HIT_JITTER);
      } else {
        // Hunt mode: use full mirrored base + normal deviation
        delay = applyJitter(getBaseDelay(), (JITTER_MAX_FACTOR - 1));
      }
    } else {
      // Easy/Normal: always use mirrored base + jitter
      delay = applyJitter(getBaseDelay(), (JITTER_MAX_FACTOR - 1));
    }

    // Clamp
    return Math.max(CLAMP_MIN_MS, Math.min(CLAMP_MAX_MS, delay));
  }

  // ─── Schedule AI Move ────────────────────────────────────────────────
  function scheduleAIMove(state, difficulty, callback) {
    cancelPending();
    const delay = computeDelay(state, difficulty);
    thinkTimer = setTimeout(() => {
      thinkTimer = null;
      callback();
    }, delay);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────
  function cancelPending() {
    if (thinkTimer !== null) {
      clearTimeout(thinkTimer);
      thinkTimer = null;
    }
  }

  function reset() {
    cancelPending();
    playerMoveDurations = [];
    turnStartTime = null;
  }

  return {
    startPlayerTimer,
    recordPlayerMove,
    scheduleAIMove,
    cancelPending,
    reset,
  };
})();
