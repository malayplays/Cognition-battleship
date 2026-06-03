# Bug Log

Bugs found and fixed during development of the Battleship AI, test suite,
visual overhaul, and Impossible-mode implementation. Only issues with evidence
in diffs, PR comments, session logs, or Devin Review findings are listed.

## Summary

| #   | Bug                                                          | Severity | Fix        |
| --- | ------------------------------------------------------------ | -------- | ---------- |
| 1   | Medium / Hard difficulty options permanently disabled        | Medium   | [PR #1][1] |
| 2   | `unfiredCells()` referenced `BOARD_SIZE` global              | Low      | [PR #1][1] |
| 3   | `package.json` merge conflict between PR #1 and PR #2       | Low      | [PR #2][2] |
| 4   | Mobile: both boards visible on initial page load             | Medium   | [PR #4][4] |
| 5   | Spark animation keyframe name mismatch                       | Low      | [PR #9][9] |
| 6   | `endGame` modal timer race on back-to-menu                   | Medium   | [PR #9][9] |
| 7   | `@keyframes ripple-expand` deleted, breaking ship placement  | Medium   | [PR #9][9], [PR #18][18] |
| 8   | Sunk marker white specks hidden behind opaque shadows        | Low      | [PR #18][18] |
| 9   | Status panel headers truncated under wood-bar decoration     | Low      | [PR #11][11] |
| 10  | Board layout shift when ships are placed                     | Medium   | [PR #12][12] |
| 11  | Fish swimming backwards                                      | Low      | [PR #9][9] |
| 12  | Dual `test/` and `tests/` folders                            | Low      | [PR #6][6] |
| 13  | Stale README claimed Medium/Hard "placeholders"              | Low      | [PR #7][7] |
| 14  | Impossible AI let the player win (pacing logic)              | High     | [PR #24][24], [PR #25][25] |

[1]: https://github.com/malayplays/Cognition-battleship/pull/1
[2]: https://github.com/malayplays/Cognition-battleship/pull/2
[4]: https://github.com/malayplays/Cognition-battleship/pull/4
[6]: https://github.com/malayplays/Cognition-battleship/pull/6
[7]: https://github.com/malayplays/Cognition-battleship/pull/7
[9]: https://github.com/malayplays/Cognition-battleship/pull/9
[11]: https://github.com/malayplays/Cognition-battleship/pull/11
[12]: https://github.com/malayplays/Cognition-battleship/pull/12
[18]: https://github.com/malayplays/Cognition-battleship/pull/18
[24]: https://github.com/malayplays/Cognition-battleship/pull/24
[25]: https://github.com/malayplays/Cognition-battleship/pull/25

---

## Bugs found by Devin

### 1. Medium / Hard difficulty options permanently disabled in dropdown

- **Severity:** Medium
- **Found via:** Code review during AI implementation
- **Root cause:** `<option value="medium" disabled>` and
  `<option value="hard" disabled>` in `index.html` meant the selector could
  never leave Easy, even though `controller.js` already wired the value
  through to `AI.getAIMove()`.
- **Fix:** Removed `disabled` attrs and the "(coming soon)" labels
  ([PR #1][1]).

### 2. `unfiredCells()` referenced `BOARD_SIZE` global

- **Severity:** Low
- **Found via:** Writing AI unit tests — `tests/ai.test.js` does
  `require('../js/ai.js')` directly, without the browser's shared scope.
- **Root cause:** Original loop used the `BOARD_SIZE` constant defined in a
  separate `<script>` tag. Works in the browser but crashes when Node imports
  the file alone.
- **Fix:** Replaced with `board.length` / `board[r].length` so `ai.js` is
  self-contained ([PR #1][1]).

### 3. `package.json` merge conflict between PR #1 and PR #2

- **Severity:** Low
- **Found via:** CI / merge failure when the test-suite branch tried to merge
  after the AI branch landed.
- **Root cause:** Both branches independently created `package.json` from the
  same base commit with slightly different `description` fields.
- **Fix:** Resolved conflict, kept the shorter description
  ([PR #2 — commit `87607d8`][2]).

### 4. Mobile: both boards visible on initial page load

- **Severity:** Medium
- **Found via:** Devin Review (automated review comment on [PR #4][4]).
- **Root cause:** `init()` never called `switchToBoard('player')`. The
  function was only invoked from `startGame()` and `resetGame()`, so on first
  load neither wrapper received `hidden-mobile` — both boards stacked.
- **Fix:** Added `switchToBoard('player')` in `init()` so the AI board is
  hidden on mobile from the start ([PR #4 — commit `bd1a9e6`][4]).

### 5. Spark animation keyframe name mismatch

- **Severity:** Low
- **Found via:** Code audit during pixel-art polish pass.
- **Root cause:** `effects.js` created spark elements with
  `animation: spark-particle …` but the CSS defined `@keyframes spark-fly`.
  The particles were appended to the DOM but never animated.
- **Fix:** Renamed the reference to match the actual `@keyframes` name
  ([PR #9 — commit `24252ce`][9]).

### 6. `endGame` modal timer race on back-to-menu

- **Severity:** Medium
- **Found via:** Manual testing of the UI overhaul session.
- **Root cause:** `endGame()` used `setTimeout` for the victory/defeat modal
  overlay, but the timeout ID was never stored. If the player clicked
  back-to-menu before the timeout fired, a stale modal would appear on top of
  the home screen.
- **Fix:** Stored the timeout ID and cleared it in the back-to-menu / reset
  handlers ([PR #9 — commit `24252ce`][9]).

### 7. `@keyframes ripple-expand` deleted, breaking ship placement ripple

- **Severity:** Medium
- **Found via:** Devin Review on [PR #9][9] (first occurrence) and again on
  [PR #15][15] (second occurrence after pixel-art marker rewrite).
- **Root cause:** CSS marker rewrites replaced or removed the
  `@keyframes ripple-expand` block, but `js/effects.js:104` (`placeRipple()`)
  still referenced it via inline style. The ripple animation on ship placement
  silently did nothing.
- **Fix:** Restored the `@keyframes ripple-expand` definition
  ([PR #9 — commit `8996253`][9]; [PR #18][18]).

### 8. Sunk marker white specks hidden behind opaque shadows

- **Severity:** Low
- **Found via:** Devin Review on [PR #15][15].
- **Root cause:** In `.cell.sunk::after`, the `#FFCCCC` / `#FFFFFF`
  box-shadows were listed *after* the core maroon shadows at the same pixel
  offsets. CSS paints first-listed shadows on top, so the white highlights
  were completely obscured.
- **Fix:** Moved the white speck shadows to the top of the `box-shadow` list
  ([PR #18][18]).

### 9. Status panel headers truncated under wood-bar decoration

- **Severity:** Low
- **Found via:** Visual inspection during pixel-art testing.
- **Root cause:** `.status-panel` overrode `.pixel-panel`'s padding to
  `padding: 0 1rem`, so the `h4` "YOUR FLEET" / "ENEMY FLEET" text sat
  directly under the 6px `::before` wood bar and was clipped.
- **Fix:** Set `padding: 14px 1rem 0` to clear the wood bar
  ([PR #11][11]).

### 10. Board layout shift when ships are placed

- **Severity:** Medium
- **Found via:** Visual testing of board centering at multiple viewports.
- **Root cause:** `.board-container` relied on intrinsic (content-based)
  width via `align-items: center`. When cell content changed during ship
  placement (adding pseudo-elements, `data-*` attributes, class mutations),
  the container's computed width — and its horizontal position — shifted.
- **Fix:** Added `width: 100%` to `.board-container` so centering is
  independent of cell content ([PR #12][12]).

### 11. Fish swimming backwards

- **Severity:** Low
- **Found via:** Visual inspection during pixel-art polish pass.
- **Root cause:** Fish using the `fish-swim` animation (left→right) were not
  flipped, so they appeared to swim tail-first. Fish using
  `fish-swim-reverse` (right→left) were also facing the wrong way.
- **Fix:** Applied `scaleX(-1)` to left→right fish so they face their
  direction of travel ([PR #9][9]).

### 12. Dual `test/` and `tests/` folders

- **Severity:** Low
- **Found via:** Repo cleanup review session.
- **Root cause:** PR #1 created `test/ai.test.js` and PR #2 created
  `tests/state.test.js` + `tests/board.test.js`. After both merged, two test
  directories coexisted. `node --test` discovered both, but the split was
  confusing.
- **Fix:** Moved all test files into `tests/` and updated the `npm test`
  script to `node --test 'tests/*.test.js'` ([PR #6][6]).

### 13. Stale README claimed Medium/Hard "placeholders"

- **Severity:** Low
- **Found via:** Pre-submission review pass.
- **Root cause:** The `js/ai.js` description in `README.md` still said
  "Medium / Hard are placeholders" after PR #1 fully implemented both
  difficulty levels with hunt/target + parity lattice strategies.
- **Fix:** Updated the README to reflect the actual implemented state
  ([PR #7][7]).

### 14. Impossible AI let the player win (pacing logic)

- **Severity:** High
- **Found via:** Gameplay testing of Impossible difficulty.
- **Root cause:** The initial holdback system (PR #21) used
  `LEAD_MARGIN` / `ENDGAME_TRIGGER` to keep the AI tied or trailing. But
  since the player fires first each turn, a tied position actually favors the
  player — the AI would often lose. PR #24 switched to a "always one less"
  pacing model but still had edge cases where the AI fired its winning shot
  too early or held too long.
- **Fix:** Final algorithm (PR #25): AI mirrors each player hit mid-game,
  pulls 1 ahead near endgame (`ENDGAME_THRESHOLD=3`), then deliberately holds
  fire until the player also reaches 1 shot from winning. Only then fires the
  kill shot — guaranteeing a margin of exactly 1 every game. 50-game
  simulation verified 100% AI wins with margin = 1.
  ([PR #24][24], [PR #25][25]).

---

## Bugs found during manual / device testing

| # | Bug | Severity | Found via | Root cause | Fix (tool) |
|---|-----|----------|-----------|------------|------------|
|   |     |          |           |            |            |

[15]: https://github.com/malayplays/Cognition-battleship/pull/15
