# Bug Log

Bugs found and fixed during development of the Battleship AI, test suite, and UI overhaul.
Only issues with evidence in diffs, PR comments, or test output are listed.

## Bugs found by Devin

| # | Bug | Severity | Found via | Root cause | Fix (PR) |
|---|-----|----------|-----------|------------|----------|
| 1 | Medium / Hard difficulty options permanently disabled in dropdown | Medium | Code review during AI implementation | `<option value="medium" disabled>` and `<option value="hard" disabled>` in `index.html` meant the selector could never leave Easy, even though `controller.js` already wired the value through to `AI.getAIMove()` | Removed `disabled` attrs and the "(coming soon)" labels ([PR #1](https://github.com/malayplays/Cognition-battleship/pull/1)) |
| 2 | `unfiredCells()` referenced `BOARD_SIZE` global — broke standalone `require()` of `ai.js` | Low | Writing AI unit tests (`test/ai.test.js` does `require('../js/ai.js')` directly, without the shared browser scope that provides `BOARD_SIZE` from `state.js`) | Original loop used `BOARD_SIZE` constant defined in a separate `<script>` tag; works in the browser's shared global scope but crashes when Node imports the file alone | Replaced with `board.length` / `board[r].length` so `ai.js` is self-contained ([PR #1](https://github.com/malayplays/Cognition-battleship/pull/1)) |
| 3 | `package.json` merge conflict between PR #1 and PR #2 | Low | CI / merge failure when the test-suite branch tried to merge after the AI branch landed | Both branches independently created `package.json` from the same base commit with slightly different `description` fields (and identical `"test": "node --test"` script) | Resolved conflict, kept the shorter description ([PR #2 — commit `87607d8`](https://github.com/malayplays/Cognition-battleship/pull/2)) |
| 4 | Mobile: both boards visible on initial page load despite single-board toggle | Medium | Devin Review (automated review comment on [PR #4](https://github.com/malayplays/Cognition-battleship/pull/4)) | `init()` never called `switchToBoard('player')`. The function was only invoked from `startGame()` and `resetGame()`, so on first load neither wrapper received the `hidden-mobile` class — both boards stacked while the toggle showed "Your Fleet" active | Added `switchToBoard('player')` in `init()` so the AI board is hidden on mobile from the start ([PR #4 — commit `bd1a9e6`](https://github.com/malayplays/Cognition-battleship/pull/4)) |

## Bugs found by manual / device testing

<!-- Add your own findings below using the same table format. -->

| # | Bug | Severity | Found via | Root cause | Fix (PR) |
|---|-----|----------|-----------|------------|----------|
| | | | | | |
