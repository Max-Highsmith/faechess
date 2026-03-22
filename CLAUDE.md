# Fae Chess - Project Notes

## Deployment
- Hosted on Railway, deploys from the `master` branch (not `main`)
- Always push to both `main` and `master`: `git push origin main && git push origin main:master`
- Domain: https://fae-chess.com
- Build: `npm run build` (Vite), Start: `npm start` (Node/Express)
- `public/` is gitignored — Railway builds from source

## Architecture
- Client: Vite + Three.js, source in `src/client/`
- Server: Express, source in `src/server/`
- Shared game logic: `src/shared/game-logic.js`
- Database: Supabase (auth, puzzles, multiplayer)

## Game Modes
- PvP, PvAI, Puzzles, Tutorial, Online (multiplayer)
- Mode visibility controlled by CSS classes: `.mode-pvp`, `.mode-pvai`, `.mode-puzzles`, `.mode-tutorial`, `.mode-online`
- Navigation flow: Landing → Mode Select → Game View

## Key Files
- `src/client/js/app.js` — Bootstrap, module loading, online handlers
- `src/client/js/main.js` — Game loop, UI, click handling, all mode logic
- `src/client/js/game.js` — Re-exports from shared game logic
- `src/client/js/render.js` — 3D board renderer (Three.js)
- `src/client/js/flat-render.js` — 2D board renderer
- `src/client/js/navigation.js` — View routing
- `src/client/js/multiplayer.js` — Online game client
- `src/client/js/tutorial.js` — Piece movement lessons
- `src/client/js/puzzles.js` — Mate-in-1 puzzle data
