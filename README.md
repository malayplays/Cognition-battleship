# Battleship

Single-page Battleship game vs. an AI opponent. Vanilla HTML/CSS/JS, no build step, deploys straight to GitHub Pages.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy to GitHub Pages

Push to `main` and enable Pages on the repo (Settings → Pages → Branch: `main`, Folder: `/`).

## Structure

- `index.html` — markup
- `styles.css` — styling
- `js/state.js` — central game state + fleet spec
- `js/board.js` — board / ship / firing logic
- `js/ai.js` — AI interface; Easy = random. Medium / Hard are placeholders.
- `js/render.js` — DOM rendering
- `js/controller.js` — event wiring + turn loop
- `js/main.js` — bootstrap

## AI

`AI.getAIMove(state, difficulty)` is the single entry point. Swap or extend strategies inside `js/ai.js` without touching the rest of the game.
