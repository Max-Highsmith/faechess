/**
 * Raumschach HTTP API Server for OpenClaw Integration
 *
 * Usage: node server.js [port]
 * Default port: 3000
 *
 * Endpoints:
 *   GET  /state  - Current game state with legal moves
 *   POST /move   - Make a move: {"from":[x,y,z],"to":[x,y,z]}
 *   GET  /reset  - Reset the game
 *   GET  /undo   - Undo last move
 *   GET  /health - Health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load game logic
const gameSource = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
eval(gameSource.replace('const Raumschach', 'global.Raumschach'));

const game = new Raumschach.Game();
const PORT = parseInt(process.argv[2]) || 3000;
let stateVersion = 0;

function getFullState() {
  const allMoves = {};
  for (const k of Object.keys(game.board)) {
    const piece = game.board[k];
    if (piece.color === game.turn) {
      const [x, y, z] = Raumschach.parseKey(k);
      const moves = game.getLegalMoves(x, y, z);
      if (moves.length > 0) {
        const notation = Raumschach.coordToNotation(x, y, z);
        allMoves[notation] = moves.map(([mx,my,mz]) => Raumschach.coordToNotation(mx,my,mz));
      }
    }
  }

  return {
    board: formatBoard(),
    turn: game.turn === 'w' ? 'white' : 'black',
    legalMoves: allMoves,
    gameOver: game.gameOver,
    result: game.result,
    check: game.isCheck(),
    moveCount: game.history.length,
    stateVersion,
    lastMove: game.history.length > 0 ? game.getLastMoveNotation() : null
  };
}

function formatBoard() {
  const pieces = {};
  for (const k of Object.keys(game.board)) {
    const [x, y, z] = Raumschach.parseKey(k);
    const p = game.board[k];
    const notation = Raumschach.coordToNotation(x, y, z);
    const colorName = p.color === 'w' ? 'white' : 'black';
    pieces[notation] = { type: Raumschach.PIECE_NAMES[p.type], color: colorName, code: p.type };
  }
  return pieces;
}

function parseNotation(n) {
  // e.g. "a1A" → [0, 0, 0]
  const x = n.charCodeAt(0) - 97;
  const y = parseInt(n[1]) - 1;
  const z = n.charCodeAt(2) - 65;
  return [x, y, z];
}

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200); res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/state') {
    res.writeHead(200);
    res.end(JSON.stringify(getFullState(), null, 2));
  }
  else if (req.method === 'GET' && url.pathname === '/reset') {
    game.reset();
    stateVersion++;
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, state: getFullState() }, null, 2));
  }
  else if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', version: stateVersion }));
  }
  else if (req.method === 'GET' && url.pathname === '/undo') {
    const success = game.undo();
    if (success) stateVersion++;
    res.writeHead(success ? 200 : 400);
    res.end(JSON.stringify({ success, state: getFullState() }, null, 2));
  }
  else if (req.method === 'POST' && url.pathname === '/move') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        let from, to;

        // Accept either array coords or notation strings
        if (typeof data.from === 'string') {
          from = parseNotation(data.from);
          to = parseNotation(data.to);
        } else if (Array.isArray(data.from)) {
          from = data.from;
          to = data.to;
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Use {from:"a1A", to:"a2A"} or {from:[0,0,0], to:[0,1,0]}' }));
          return;
        }

        if (from.length !== 3 || to.length !== 3) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Coordinates must have 3 values [x,y,z]' }));
          return;
        }

        const success = game.makeMove(from, to);
        if (success) {
          stateVersion++;
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, state: getFullState() }, null, 2));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: 'Illegal move',
            hint: 'Check /state for legalMoves'
          }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message }));
      }
    });
  }
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found. Endpoints: /state, /move, /reset, /undo, /health' }));
  }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`\n  Raumschach API Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Running on http://localhost:${PORT}\n`);
  console.log(`  Endpoints:`);
  console.log(`    GET  /state  - Current board, legal moves, turn`);
  console.log(`    POST /move   - {"from":"a2A","to":"a3A"}`);
  console.log(`    GET  /reset  - New game`);
  console.log(`    GET  /undo   - Undo last move`);
  console.log(`    GET  /health - Health check\n`);
});
