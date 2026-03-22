/**
 * Raumschach – Main Controller
 */

(function () {
  const game = new Raumschach.Game();
  let selected = null;
  let legalTargets = [];

  // ── AI state ───────────────────────────────────────────────────
  let aiEnabled = false;
  let ai = new ChessAI.AI('b', 2);

  // ── Multiplayer state ─────────────────────────────────────────
  let multiplayerEnabled = false;

  // ── View state ─────────────────────────────────────────────────
  let activeView = '3d';
  let flatInitialized = false;

  const ViewProxy = {
    updatePieces(board) {
      if (activeView === '3d') BoardRenderer.updatePieces(board);
      else FlatRenderer.updatePieces(board);
    },
    highlightCells(keys, type) {
      if (activeView === '3d') BoardRenderer.highlightCells(keys, type);
      else FlatRenderer.highlightCells(keys, type);
    },
    highlightCheck(x, y, z) {
      if (activeView === '3d') BoardRenderer.highlightCheck(x, y, z);
      else FlatRenderer.highlightCheck(x, y, z);
    },
    clearHighlights() {
      if (activeView === '3d') BoardRenderer.clearHighlights();
      else FlatRenderer.clearHighlights();
    }
  };

  // ── DOM refs ───────────────────────────────────────────────────
  const turnEl = document.getElementById('turn');
  const statusEl = document.getElementById('status');
  const capWhiteEl = document.getElementById('cap-white');
  const capBlackEl = document.getElementById('cap-black');
  const moveLogEl = document.getElementById('move-log');

  function updateUI() {
    if (tutorialMode) return;

    const colorName = game.turn === 'w' ? 'White' : 'Black';
    if (game.gameOver) {
      turnEl.textContent = 'Game Over';
    } else if (multiplayerEnabled) {
      const isYourTurn = Multiplayer.isMyTurn(game.turn);
      turnEl.textContent = isYourTurn ? 'Your turn' : "Opponent's turn";
    } else {
      turnEl.textContent = `${colorName} to move`;
    }

    if (game.gameOver) {
      statusEl.textContent = game.result;
      statusEl.style.color = '#ff6b6b';
    } else if (game.isCheck()) {
      statusEl.textContent = `${colorName} is in check!`;
      statusEl.style.color = '#f7c948';
    } else {
      statusEl.textContent = '';
    }

    capWhiteEl.textContent = 'W lost: ' + game.captured.w
      .map(p => Raumschach.PIECE_SYMBOLS[p.type].w).join(' ');
    capBlackEl.textContent = 'B lost: ' + game.captured.b
      .map(p => Raumschach.PIECE_SYMBOLS[p.type].b).join(' ');
  }

  function addMoveToLog(notation, moveNum) {
    const div = document.createElement('div');
    div.textContent = `${moveNum}. ${notation}`;
    moveLogEl.appendChild(div);
    moveLogEl.scrollTop = moveLogEl.scrollHeight;
  }

  // ── Cell click handler ─────────────────────────────────────────

  function handleCellClick(x, y, z) {
    if (tutorialMode) {
      handleTutorialMove(x, y, z);
      return;
    }
    if (puzzleMode) {
      handlePuzzleMove(x, y, z);
      return;
    }
    if (game.gameOver) return;
    if (aiEnabled && game.turn === ai.color) return; // AI's turn
    if (multiplayerEnabled && !Multiplayer.isMyTurn(game.turn)) return; // Opponent's turn

    const k = Raumschach.key(x, y, z);
    const piece = game.board[k];

    if (selected) {
      const isTarget = legalTargets.some(([tx, ty, tz]) => tx === x && ty === y && tz === z);
      if (isTarget) {
        const moveNum = Math.floor(game.history.length / 2) + 1;
        const from = selected;
        const movingPiece = game.board[Raumschach.key(...from)];
        const targetPiece = game.board[k];

        if (game.makeMove(from, [x, y, z])) {
          const notation = game.getMoveNotation(from, [x, y, z], movingPiece, targetPiece);
          addMoveToLog(notation, moveNum);
          selected = null;
          legalTargets = [];
          ViewProxy.clearHighlights();
          ViewProxy.updatePieces(game.board);

          if (game.isCheck() && !game.gameOver) {
            const kp = findCurrentKing();
            if (kp) ViewProxy.highlightCheck(...kp);
          }

          updateUI();

          if (multiplayerEnabled) {
            // Send move to server (optimistic update — rollback on rejection)
            Multiplayer.submitMove(from, [x, y, z]).catch(err => {
              console.error('Move rejected by server:', err);
              game.undo();
              if (moveLogEl.lastChild) moveLogEl.removeChild(moveLogEl.lastChild);
              ViewProxy.clearHighlights();
              ViewProxy.updatePieces(game.board);
              updateUI();
              statusEl.textContent = 'Move rejected — try again';
              statusEl.style.color = '#ff6b6b';
            });
          } else {
            tryAIMove();
          }
          return;
        }
      }

      if (piece && piece.color === game.turn) {
        selectPiece(x, y, z);
        return;
      }

      selected = null;
      legalTargets = [];
      ViewProxy.clearHighlights();
      return;
    }

    if (piece && piece.color === game.turn) {
      selectPiece(x, y, z);
    }
  }

  function selectPiece(x, y, z) {
    selected = [x, y, z];
    legalTargets = game.getLegalMoves(x, y, z);
    ViewProxy.clearHighlights();
    ViewProxy.highlightCells([[x, y, z]], 'selected');
    ViewProxy.highlightCells(legalTargets, 'move');
  }

  function findCurrentKing() {
    for (const k of Object.keys(game.board)) {
      const p = game.board[k];
      if (p.type === 'K' && p.color === game.turn) {
        return Raumschach.parseKey(k);
      }
    }
    return null;
  }

  // ── Multiplayer: receive opponent's move ───────────────────────

  function applyRemoteMove(payload) {
    const from = payload.from;
    const to = payload.to;
    const moveNum = Math.floor(game.history.length / 2) + 1;

    game.makeMove(from, to);

    addMoveToLog(payload.notation, moveNum);
    selected = null;
    legalTargets = [];
    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);

    if (payload.game_over) {
      game.gameOver = true;
      const resultMap = {
        'white_wins': 'White wins by checkmate!',
        'black_wins': 'Black wins by checkmate!',
        'draw': 'Stalemate — draw!'
      };
      game.result = resultMap[payload.result] || payload.result;
    }

    if (game.isCheck() && !game.gameOver) {
      const kp = findCurrentKing();
      if (kp) ViewProxy.highlightCheck(...kp);
    }

    updateUI();
  }

  function handleGameEvent(type, payload) {
    if (type === 'resign') {
      game.gameOver = true;
      const winner = payload.color === 'w' ? 'Black' : 'White';
      game.result = `${winner} wins by resignation!`;
      updateUI();
    }
  }

  // Expose for multiplayer module callbacks
  window.applyRemoteMove = applyRemoteMove;
  window.handleGameEvent = handleGameEvent;

  // ── AI ─────────────────────────────────────────────────────────

  function tryAIMove() {
    if (!aiEnabled || game.gameOver || game.turn !== ai.color) return;

    statusEl.textContent = 'AI is thinking...';
    statusEl.style.color = '#7fdbca';

    setTimeout(() => {
      const move = ai.getBestMove(game.board);
      if (!move) return;

      const moveNum = Math.floor(game.history.length / 2) + 1;
      const movingPiece = game.board[Raumschach.key(...move.from)];
      const targetPiece = game.board[Raumschach.key(...move.to)];

      if (game.makeMove(move.from, move.to)) {
        const notation = game.getMoveNotation(move.from, move.to, movingPiece, targetPiece);
        addMoveToLog(notation, moveNum);
        selected = null;
        legalTargets = [];
        ViewProxy.clearHighlights();
        ViewProxy.updatePieces(game.board);

        if (game.isCheck() && !game.gameOver) {
          const kp = findCurrentKing();
          if (kp) ViewProxy.highlightCheck(...kp);
        }

        updateUI();
      }
    }, 300);
  }

  // ── Puzzle mode ───────────────────────────────────────────────

  let puzzleMode = false;
  let activePuzzle = null;
  let solvedPuzzles = new Set();
  const puzzleStatusEl = document.getElementById('puzzle-status');
  const puzzleControlsEl = document.getElementById('puzzle-controls');
  const puzzleListEl = document.getElementById('puzzle-list');

  // ── Tutorial mode ─────────────────────────────────────────────
  let tutorialMode = false;
  let tutorialPiecePos = null; // [x,y,z] of placed piece
  const tutorialDescEl = document.getElementById('tutorial-description');
  const tutorialListEl = document.getElementById('tutorial-list');

  // Restore solved state from localStorage
  try {
    const saved = localStorage.getItem('raumschach-solved');
    if (saved) solvedPuzzles = new Set(JSON.parse(saved));
  } catch (e) {}

  function buildPuzzleList() {
    puzzleListEl.innerHTML = '';
    const all = Puzzles.getAll();
    for (const p of all) {
      const card = document.createElement('div');
      card.className = 'puzzle-card' + (solvedPuzzles.has(p.id) ? ' solved' : '');
      card.dataset.id = p.id;
      const stars = p.difficulty === 1 ? '*' : '**';
      card.innerHTML =
        `<span class="puzzle-stars">${stars}</span>` +
        `<div class="puzzle-title">#${p.id}: ${p.title}` +
        (solvedPuzzles.has(p.id) ? '<span class="puzzle-badge">SOLVED</span>' : '') +
        `</div>` +
        `<div class="puzzle-desc">${p.description}</div>`;
      card.addEventListener('click', () => enterPuzzle(p.id));
      puzzleListEl.appendChild(card);
    }
  }

  function enterPuzzle(id) {
    const puzzle = Puzzles.getById(id);
    if (!puzzle) return;

    puzzleMode = true;
    activePuzzle = puzzle;
    selected = null;
    legalTargets = [];

    // Set up the board with puzzle position
    game.reset();
    game.board = Raumschach.cloneBoard(puzzle.board);
    game.turn = puzzle.turn;
    game.history = [];
    game.captured = { w: [], b: [] };
    game.gameOver = false;
    game.result = null;

    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);

    turnEl.textContent = 'Puzzle #' + puzzle.id;
    statusEl.textContent = puzzle.description;
    statusEl.style.color = '#7fdbca';
    puzzleStatusEl.textContent = '';
    puzzleControlsEl.style.display = 'block';
    moveLogEl.innerHTML = '';
    capWhiteEl.textContent = '';
    capBlackEl.textContent = '';

    // Highlight active card
    document.querySelectorAll('.puzzle-card').forEach(c => c.classList.remove('active'));
    const card = puzzleListEl.querySelector(`[data-id="${id}"]`);
    if (card) card.classList.add('active');
  }

  function exitPuzzle() {
    puzzleMode = false;
    activePuzzle = null;
    selected = null;
    legalTargets = [];

    game.reset();
    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);
    updateUI();
    moveLogEl.innerHTML = '';

    puzzleStatusEl.textContent = '';
    puzzleControlsEl.style.display = 'none';
    document.querySelectorAll('.puzzle-card').forEach(c => c.classList.remove('active'));
  }

  function checkPuzzleSolution(from, to) {
    const sol = activePuzzle.solution;
    const matchFrom = from[0]===sol.from[0] && from[1]===sol.from[1] && from[2]===sol.from[2];
    const matchTo = to[0]===sol.to[0] && to[1]===sol.to[1] && to[2]===sol.to[2];
    return matchFrom && matchTo;
  }

  function handlePuzzleMove(x, y, z) {
    const k = Raumschach.key(x, y, z);
    const piece = game.board[k];

    if (selected) {
      const isTarget = legalTargets.some(([tx,ty,tz]) => tx===x && ty===y && tz===z);
      if (isTarget) {
        const from = selected;
        if (checkPuzzleSolution(from, [x, y, z])) {
          // Correct!
          game.makeMove(from, [x, y, z]);
          ViewProxy.clearHighlights();
          ViewProxy.updatePieces(game.board);

          solvedPuzzles.add(activePuzzle.id);
          try { localStorage.setItem('raumschach-solved', JSON.stringify([...solvedPuzzles])); } catch(e) {}

          puzzleStatusEl.textContent = 'Correct! Checkmate!';
          puzzleStatusEl.style.color = '#44ff88';
          statusEl.textContent = 'Puzzle solved!';
          statusEl.style.color = '#44ff88';
          selected = null;
          legalTargets = [];

          buildPuzzleList();
        } else {
          // Wrong move
          puzzleStatusEl.textContent = 'Not the best move. Try again!';
          puzzleStatusEl.style.color = '#ff6b6b';
          selected = null;
          legalTargets = [];
          ViewProxy.clearHighlights();
        }
        return;
      }

      if (piece && piece.color === game.turn) {
        selectPiece(x, y, z);
        return;
      }

      selected = null;
      legalTargets = [];
      ViewProxy.clearHighlights();
      return;
    }

    if (piece && piece.color === game.turn) {
      selectPiece(x, y, z);
    }
  }

  // ── Tutorial functions ─────────────────────────────────────────

  function buildTutorialList() {
    tutorialListEl.innerHTML = '';
    const all = Tutorials.getAll();
    for (const lesson of all) {
      const card = document.createElement('div');
      card.className = 'tutorial-card';
      card.dataset.type = lesson.type;
      card.innerHTML =
        `<span class="tutorial-icon">${lesson.icon}</span>` +
        `<span class="tutorial-name">${lesson.name}</span>`;
      card.addEventListener('click', () => enterTutorialPiece(lesson.type));
      tutorialListEl.appendChild(card);
    }
  }

  function enterTutorialPiece(type) {
    const lesson = Tutorials.getByType(type);
    if (!lesson) return;

    tutorialMode = true;
    selected = null;
    legalTargets = [];

    // Place a single white piece on an empty board
    const board = {};
    const [sx, sy, sz] = lesson.startPos;
    board[Raumschach.key(sx, sy, sz)] = { type: lesson.type, color: 'w' };

    game.reset();
    game.board = board;
    game.turn = 'w';
    game.history = [];
    game.captured = { w: [], b: [] };
    game.gameOver = false;
    game.result = null;

    tutorialPiecePos = lesson.startPos.slice();

    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);

    // Highlight the piece and its moves
    selectPiece(sx, sy, sz);

    turnEl.textContent = lesson.name;
    statusEl.textContent = '';
    tutorialDescEl.textContent = lesson.description;

    // Highlight active card
    document.querySelectorAll('.tutorial-card').forEach(c => c.classList.remove('active'));
    const card = tutorialListEl.querySelector(`[data-type="${type}"]`);
    if (card) card.classList.add('active');
  }

  function handleTutorialMove(x, y, z) {
    const k = Raumschach.key(x, y, z);
    const piece = game.board[k];

    if (selected) {
      const isTarget = legalTargets.some(([tx,ty,tz]) => tx===x && ty===y && tz===z);
      if (isTarget) {
        // Move the piece to the new square
        const from = selected;
        const fromKey = Raumschach.key(...from);
        const movingPiece = game.board[fromKey];

        // Manually move (don't use game.makeMove to avoid turn switching)
        const newBoard = {};
        newBoard[k] = { type: movingPiece.type, color: 'w' };
        game.board = newBoard;
        game.turn = 'w';

        tutorialPiecePos = [x, y, z];

        ViewProxy.clearHighlights();
        ViewProxy.updatePieces(game.board);

        // Re-highlight from new position
        selectPiece(x, y, z);
        return;
      }

      // Clicked the already-selected piece
      if (piece && piece.color === 'w') {
        selectPiece(x, y, z);
        return;
      }

      // Clicked empty space — deselect
      selected = null;
      legalTargets = [];
      ViewProxy.clearHighlights();
      return;
    }

    if (piece && piece.color === 'w') {
      selectPiece(x, y, z);
    }
  }

  // ── Init ───────────────────────────────────────────────────────

  BoardRenderer.init(document.body, handleCellClick);
  BoardRenderer.updatePieces(game.board);
  buildPuzzleList();
  updateUI();

  if (game.isCheck()) {
    const kp = findCurrentKing();
    if (kp) BoardRenderer.highlightCheck(...kp);
  }

  // ── Controls ───────────────────────────────────────────────────

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (puzzleMode) { exitPuzzle(); return; }
    game.reset();
    selected = null;
    legalTargets = [];
    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);
    moveLogEl.innerHTML = '';
    updateUI();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (multiplayerEnabled) return; // No undo in online games
    const undoCount = aiEnabled ? 2 : 1;
    let undone = 0;
    for (let i = 0; i < undoCount; i++) {
      if (game.undo()) {
        undone++;
        if (moveLogEl.lastChild) moveLogEl.removeChild(moveLogEl.lastChild);
      }
    }
    if (undone > 0) {
      selected = null;
      legalTargets = [];
      ViewProxy.clearHighlights();
      ViewProxy.updatePieces(game.board);
      updateUI();
      if (game.isCheck()) {
        const kp = findCurrentKing();
        if (kp) ViewProxy.highlightCheck(...kp);
      }
    }
  });

  // ── Surrender ────────────────────────────────────────────────

  document.getElementById('btn-surrender').addEventListener('click', async () => {
    if (puzzleMode || game.gameOver) return;

    if (multiplayerEnabled) {
      const ag = Multiplayer.getActiveGame();
      if (!ag) return;
      const myColorName = ag.myColor === 'w' ? 'White' : 'Black';
      const opponentName = ag.myColor === 'w' ? 'Black' : 'White';
      if (!confirm(`You (${myColorName}) resign. ${opponentName} wins. Are you sure?`)) return;
      try {
        await Multiplayer.resignGame();
        game.gameOver = true;
        game.result = `${opponentName} wins by resignation!`;
        updateUI();
      } catch (err) {
        console.error('Resign failed:', err);
      }
      return;
    }

    const loser = game.turn === 'w' ? 'White' : 'Black';
    const winner = game.turn === 'w' ? 'Black' : 'White';
    if (!confirm(`${loser} surrenders. ${winner} wins. Are you sure?`)) return;
    game.gameOver = true;
    game.result = `${winner} wins by resignation!`;
    updateUI();
  });

  // ── Export ─────────────────────────────────────────────────────

  document.getElementById('btn-export').addEventListener('click', () => {
    const report = game.exportReport();
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faechess-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Skin selector ──────────────────────────────────────────────

  document.getElementById('skin-select').addEventListener('change', (e) => {
    BoardRenderer.setSkin(e.target.value);
    ViewProxy.updatePieces(game.board);
  });

  // ── View selector ──────────────────────────────────────────────

  document.getElementById('view-select').addEventListener('change', (e) => {
    activeView = e.target.value;
    if (activeView === '2d') {
      if (!flatInitialized) {
        FlatRenderer.init(document.body, handleCellClick);
        flatInitialized = true;
      }
      BoardRenderer.hide();
      FlatRenderer.show();
    } else {
      if (flatInitialized) FlatRenderer.hide();
      BoardRenderer.show();
    }
    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);
    if (selected) {
      ViewProxy.highlightCells([selected], 'selected');
      ViewProxy.highlightCells(legalTargets, 'move');
    }
    if (game.isCheck() && !game.gameOver) {
      const kp = findCurrentKing();
      if (kp) ViewProxy.highlightCheck(...kp);
    }
  });

  // ── Perspective selector (works for both 3D and 2D) ───────────

  document.getElementById('perspective-select').addEventListener('change', (e) => {
    const mode = e.target.value;

    // Multi perspective only works in 2D – auto-switch if needed
    if (mode === 'multi' && activeView === '3d') {
      activeView = '2d';
      document.getElementById('view-select').value = '2d';
      if (!flatInitialized) {
        FlatRenderer.init(document.body, handleCellClick);
        flatInitialized = true;
      }
      BoardRenderer.hide();
      FlatRenderer.setViewMode(mode);
      FlatRenderer.show();
      ViewProxy.clearHighlights();
      ViewProxy.updatePieces(game.board);
    } else if (activeView === '3d') {
      BoardRenderer.setViewMode(mode);
    } else {
      if (flatInitialized) {
        FlatRenderer.setViewMode(mode);
      }
    }

    // Refresh highlights if any are active
    if (selected) {
      ViewProxy.highlightCells([selected], 'selected');
      ViewProxy.highlightCells(legalTargets, 'move');
    }
    if (game.isCheck() && !game.gameOver) {
      const kp = findCurrentKing();
      if (kp) ViewProxy.highlightCheck(...kp);
    }
  });

  // ── Game mode ────────────────────────────────────────────────

  window.setGameMode = function (mode) {
    // Reset game state
    game.reset();
    selected = null;
    legalTargets = [];
    ViewProxy.clearHighlights();
    ViewProxy.updatePieces(game.board);
    moveLogEl.innerHTML = '';

    aiEnabled = false;
    multiplayerEnabled = false;

    if (mode === 'pvai') {
      aiEnabled = true;
      ai = new ChessAI.AI('b', parseInt(document.getElementById('ai-difficulty').value, 10));
    }

    if (mode === 'online') {
      multiplayerEnabled = true;
      Multiplayer.setCallbacks(applyRemoteMove, handleGameEvent);

      // Load board state from active game if reconnecting
      const ag = Multiplayer.getActiveGame();
      if (ag) {
        const colorName = ag.myColor === 'w' ? 'White' : 'Black';
        const badge = document.getElementById('mp-color-badge');
        if (badge) badge.textContent = colorName;
      }
    }

    if (mode === 'puzzles') {
      buildPuzzleList();
    }

    if (mode === 'tutorial') {
      tutorialMode = true;
      buildTutorialList();
      // Show empty board until a piece is selected
      game.board = {};
      ViewProxy.updatePieces(game.board);
      turnEl.textContent = 'Tutorial';
      statusEl.textContent = 'Select a piece to see how it moves';
      statusEl.style.color = '#7fdbca';
      tutorialDescEl.textContent = '';
    } else {
      tutorialMode = false;
      tutorialPiecePos = null;
    }

    puzzleMode = false;
    activePuzzle = null;
    puzzleStatusEl.textContent = '';
    puzzleControlsEl.style.display = 'none';

    updateUI();
  };

  document.getElementById('ai-difficulty').addEventListener('change', (e) => {
    ai = new ChessAI.AI('b', parseInt(e.target.value, 10));
  });

  // ── Server sync (optional, for OpenClaw) ───────────────────────

  let serverUrl = 'http://localhost:3000';
  let serverConnected = false;
  let lastServerVersion = -1;
  const serverInfoEl = document.getElementById('server-info');
  const btnSync = document.getElementById('btn-sync');

  function checkServer() {
    fetch(serverUrl + '/health', { mode: 'cors' })
      .then(r => r.json())
      .then(data => {
        if (!serverConnected) {
          serverConnected = true;
          serverInfoEl.style.color = '#7fdbca';
          serverInfoEl.textContent = 'Connected to ' + serverUrl;
          btnSync.style.display = 'inline-block';
        }
        if (data.version !== undefined && data.version !== lastServerVersion) {
          lastServerVersion = data.version;
        }
      })
      .catch(() => {
        if (serverConnected) {
          serverConnected = false;
          serverInfoEl.style.color = '#666';
          serverInfoEl.textContent = 'Not connected. Run: node server.js';
          btnSync.style.display = 'none';
        }
      });
  }

  btnSync.addEventListener('click', () => {
    fetch(serverUrl + '/reset')
      .then(r => r.json())
      .then(() => {
        serverInfoEl.textContent = 'Synced – server reset.';
        setTimeout(() => {
          serverInfoEl.textContent = 'Connected to ' + serverUrl;
        }, 2000);
      })
      .catch(() => {});
  });

  setInterval(checkServer, 5000);
  checkServer();

  // ── Puzzle controls ──────────────────────────────────────────

  document.getElementById('btn-hint').addEventListener('click', () => {
    if (!activePuzzle) return;
    puzzleStatusEl.textContent = activePuzzle.hint;
    puzzleStatusEl.style.color = '#f7c948';
  });

  document.getElementById('btn-exit-puzzle').addEventListener('click', exitPuzzle);
})();
