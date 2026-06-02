// Test harness: loads the game's pure logic modules without a browser.
//
// The game is plain <script>-tag JS where every file shares one global scope
// (no module system, no build step). To exercise that logic from Node we
// concatenate the DOM-free modules into a single function body — the same
// shared-scope arrangement the browser gives them — and return the symbols the
// tests need. Using `new Function` (rather than `vm`) keeps everything in the
// host realm, so arrays/objects the game creates share the test's prototypes
// and `assert.deepStrictEqual` works. The source files are never modified.

const fs = require('fs');
const path = require('path');

// Only the modules with no DOM dependencies. render.js / controller.js /
// main.js touch `document`, so they are intentionally excluded.
const SOURCE_FILES = ['js/state.js', 'js/board.js', 'js/ai.js'];

const EXPORTED_SYMBOLS = [
  'FLEET_SPEC',
  'BOARD_SIZE',
  'createEmptyBoard',
  'createSide',
  'createInitialState',
  'getShipCells',
  'canPlaceShip',
  'placeShip',
  'clearSide',
  'randomizeFleet',
  'fireAt',
  'allShipsPlaced',
  'AI',
];

function loadGame() {
  const root = path.join(__dirname, '..');
  let src = '';
  for (const file of SOURCE_FILES) {
    src += fs.readFileSync(path.join(root, file), 'utf8') + '\n';
  }
  // Returned from the same function scope, so it can read the `const`/`function`
  // declarations above. console/Math come from the host realm's globals.
  src += `return { ${EXPORTED_SYMBOLS.join(', ')} };\n`;

  // eslint-disable-next-line no-new-func
  const factory = new Function(src);
  return factory();
}

module.exports = { loadGame };
