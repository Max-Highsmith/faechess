/**
 * Torus Chess – Main Controller
 */

(function () {
  const TG = window.TorusGameModule;
  const game = new TG.TorusGame();
  let selected = null;
  let legalTargets = [];

  // ── AI state ───────────────────────────────────────────────────
  let aiEnabled = false;
  let ai = new window.TorusAIModule.TorusAI('b', 2);

  // ── Multiplayer state ─────────────────────────────────────────
  let multiplayerEnabled = false;
  const Multiplayer = window.Multiplayer;
  const ChessClock = window.ChessClock;

  // ── Puzzle state ──────────────────────────────────────────────
  let puzzleMode = false;
  let activePuzzle = null;
  let solvedTorusPuzzles = new Set();

  try {
    const saved = localStorage.getItem('torus-solved');
    if (saved) solvedTorusPuzzles = new Set(JSON.parse(saved));
  } catch (e) {}

  let rendererInitialized = false;
  let renderer3dInitialized = false;
  let activeView = '2d'; // '2d' or '3d'

  // ── View proxy — routes to whichever renderer is active ────────
  const V = {
    updatePieces(board) {
      if (activeView === '3d') Torus3DRenderer.updatePieces(board);
      else TorusRenderer.updatePieces(board);
    },
    highlightCells(keys, type) {
      if (activeView === '3d') Torus3DRenderer.highlightCells(keys, type);
      else TorusRenderer.highlightCells(keys, type);
    },
    highlightCheck(x, y) {
      if (activeView === '3d') Torus3DRenderer.highlightCheck(x, y);
      else TorusRenderer.highlightCheck(x, y);
    },
    clearHighlights() {
      if (activeView === '3d') Torus3DRenderer.clearHighlights();
      else TorusRenderer.clearHighlights();
    },
    highlightLastMove(from, to) {
      if (activeView === '3d') Torus3DRenderer.highlightLastMove(from, to);
      else TorusRenderer.highlightLastMove(from, to);
    },
    clearLastMove() {
      if (activeView === '3d') Torus3DRenderer.clearLastMove();
      else TorusRenderer.clearLastMove();
    }
  };

  // ── Promotion modal ──────────────────────────────────────────
  const promotionModal = document.getElementById('torus-promotion-modal');
  const promotionBtns = promotionModal ? promotionModal.querySelectorAll('.promotion-btn') : [];

  function showPromotionModal(color) {
    if (!promotionModal) return Promise.resolve('Q');
    const icons = promotionModal.querySelectorAll('.promotion-icon');
    if (icons[0]) icons[0].textContent = color === 'w' ? '\u2655' : '\u265B';
    if (icons[1]) icons[1].textContent = color === 'w' ? '\u2656' : '\u265C';
    if (icons[2]) icons[2].textContent = color === 'w' ? '\u2657' : '\u265D';
    if (icons[3]) icons[3].textContent = color === 'w' ? '\u2658' : '\u265E';

    return new Promise(resolve => {
      function handler(e) {
        const piece = e.currentTarget.dataset.piece;
        promotionBtns.forEach(b => b.removeEventListener('click', handler));
        promotionModal.classList.add('hidden');
        resolve(piece);
      }
      promotionBtns.forEach(b => b.addEventListener('click', handler));
      promotionModal.classList.remove('hidden');
    });
  }

  // ── DOM refs ───────────────────────────────────────────────────
  const turnEl = document.getElementById('torus-turn');
  const statusEl = document.getElementById('torus-status');
  const capWhiteEl = document.getElementById('torus-cap-white');
  const capBlackEl = document.getElementById('torus-cap-black');
  const moveLogEl = document.getElementById('torus-move-log');

  // Puzzle DOM refs
  const puzzleStatusEl = document.getElementById('torus-puzzle-status');
  const puzzleControlsEl = document.getElementById('torus-puzzle-controls');
  const puzzleListEl = document.getElementById('torus-puzzle-list');

  function updateUI() {
    if (!turnEl) return;
    const colorName = game.turn === 'w' ? 'White' : 'Black';
    if (game.gameOver) {
      turnEl.textContent = 'Game Over';
    } else if (puzzleMode && activePuzzle) {
      turnEl.textContent = 'Puzzle #' + activePuzzle.id;
    } else {
      turnEl.textContent = `${colorName} to move`;
    }

    if (game.gameOver) {
      statusEl.textContent = game.result;
      statusEl.style.color = '#ff6b6b';
    } else if (game.isCheck()) {
      statusEl.textContent = `${colorName} is in check!`;
      statusEl.style.color = '#f7c948';
    } else if (!puzzleMode) {
      statusEl.textContent = '';
    }

    if (capWhiteEl) {
      capWhiteEl.textContent = 'W lost: ' + game.captured.w
        .map(p => TG.PIECE_SYMBOLS[p.type].w).join(' ');
    }
    if (capBlackEl) {
      capBlackEl.textContent = 'B lost: ' + game.captured.b
        .map(p => TG.PIECE_SYMBOLS[p.type].b).join(' ');
    }
  }

  function addMoveToLog(notation, moveNum) {
    if (!moveLogEl) return;
    const div = document.createElement('div');
    div.textContent = `${moveNum}. ${notation}`;
    moveLogEl.appendChild(div);
    moveLogEl.scrollTop = moveLogEl.scrollHeight;
  }

  // ── Cell click handler ─────────────────────────────────────────

  function handleCellClick(x, y) {
    if (puzzleMode) {
      handleTorusPuzzleMove(x, y);
      return;
    }
    if (game.gameOver) return;
    if (aiEnabled && game.turn === ai.color) return;
    if (multiplayerEnabled && !Multiplayer.isMyTurn(game.turn)) return;

    const k = TG.key(x, y);
    const piece = game.board[k];

    if (selected) {
      const isTarget = legalTargets.some(([tx, ty]) => tx === x && ty === y);
      if (isTarget) {
        const from = selected;
        const movingPiece = game.board[TG.key(...from)];

        const executeMove = (promoteTo) => {
          const moveNum = Math.floor(game.history.length / 2) + 1;
          const targetPiece = game.board[k];

          if (game.makeMove(from, [x, y], promoteTo)) {
            const notation = game.getMoveNotation(from, [x, y], movingPiece, targetPiece);
            addMoveToLog(notation, moveNum);
            selected = null;
            legalTargets = [];
            V.clearHighlights();
            V.updatePieces(game.board);
            V.highlightLastMove(from, [x, y]);

            if (game.isCheck() && !game.gameOver) {
              const kp = findCurrentKing();
              if (kp) V.highlightCheck(...kp);
            }

            updateUI();

            if (multiplayerEnabled) {
              ChessClock.switchTurn(game.turn);
              Multiplayer.submitMove(from, [x, y], promoteTo).then(data => {
                if (data.white_time_remaining != null) {
                  ChessClock.setTimeRemaining('w', data.white_time_remaining);
                  ChessClock.setTimeRemaining('b', data.black_time_remaining);
                }
                if (data.game_over) {
                  game.gameOver = true;
                  game.result = data.result === 'white_wins' ? 'White wins by checkmate!' :
                                data.result === 'black_wins' ? 'Black wins by checkmate!' :
                                'Draw!';
                  ChessClock.pause();
                  updateUI();
                }
              }).catch(err => {
                console.error('[Torus] Move rejected:', err);
                game.undo();
                if (moveLogEl && moveLogEl.lastChild) moveLogEl.removeChild(moveLogEl.lastChild);
                ChessClock.switchTurn(game.turn);
                V.clearHighlights();
                V.updatePieces(game.board);
                updateUI();
              });
            }

            tryAIMove();
          }
        };

        if (TG.isPromotionMove(game.board, from, [x, y])) {
          showPromotionModal(movingPiece.color).then(executeMove);
        } else {
          executeMove(undefined);
        }
        return;
      }

      if (piece && piece.color === game.turn) {
        selectPiece(x, y);
        return;
      }

      selected = null;
      legalTargets = [];
      V.clearHighlights();
      return;
    }

    if (piece && piece.color === game.turn) {
      selectPiece(x, y);
    }
  }

  function selectPiece(x, y) {
    selected = [x, y];
    legalTargets = game.getLegalMoves(x, y);
    V.clearHighlights();
    V.highlightCells([[x, y]], 'selected');
    V.highlightCells(legalTargets, 'move');
  }

  function findCurrentKing() {
    for (const k of Object.keys(game.board)) {
      const p = game.board[k];
      if (p.type === 'K' && p.color === game.turn) {
        return TG.parseKey(k);
      }
    }
    return null;
  }

  // ── AI ─────────────────────────────────────────────────────────

  function tryAIMove() {
    if (!aiEnabled || game.gameOver || game.turn !== ai.color) return;

    statusEl.textContent = 'AI is thinking...';
    statusEl.style.color = '#7fdbca';

    setTimeout(() => {
      const move = ai.getBestMove(game.board, game.enPassantSquare);
      if (!move) return;

      const moveNum = Math.floor(game.history.length / 2) + 1;
      const movingPiece = game.board[TG.key(...move.from)];
      const targetPiece = game.board[TG.key(...move.to)];

      if (game.makeMove(move.from, move.to)) {
        const notation = game.getMoveNotation(move.from, move.to, movingPiece, targetPiece);
        addMoveToLog(notation, moveNum);
        selected = null;
        legalTargets = [];
        V.clearHighlights();
        V.updatePieces(game.board);
        V.highlightLastMove(move.from, move.to);

        if (game.isCheck() && !game.gameOver) {
          const kp = findCurrentKing();
          if (kp) V.highlightCheck(...kp);
        }

        updateUI();
      }
    }, 300);
  }

  // ── Puzzle mode ─────────────────────────────────────────────

  function buildTorusPuzzleList() {
    if (!puzzleListEl || !window.TorusPuzzles) return;
    puzzleListEl.innerHTML = '';
    const all = window.TorusPuzzles.getTorusPuzzles();
    for (const p of all) {
      const card = document.createElement('div');
      card.className = 'puzzle-card' + (solvedTorusPuzzles.has(p.id) ? ' solved' : '');
      card.dataset.id = p.id;
      const stars = p.difficulty <= 1 ? '*' : p.difficulty === 2 ? '**' : '***';
      card.innerHTML =
        `<span class="puzzle-stars">${stars}</span>` +
        `<div class="puzzle-title">#${p.id}: ${p.title}` +
        (solvedTorusPuzzles.has(p.id) ? '<span class="puzzle-badge">SOLVED</span>' : '') +
        `</div>` +
        `<div class="puzzle-desc">${p.description}</div>`;
      card.addEventListener('click', () => enterTorusPuzzle(p.id));
      puzzleListEl.appendChild(card);
    }
  }

  function enterTorusPuzzle(id) {
    const puzzle = window.TorusPuzzles.getTorusPuzzleById(id);
    if (!puzzle) return;

    puzzleMode = true;
    activePuzzle = puzzle;
    selected = null;
    legalTargets = [];

    game.reset();
    game.board = TG.cloneBoard(puzzle.board);
    game.turn = puzzle.turn;
    game.history = [];
    game.captured = { w: [], b: [] };
    game.gameOver = false;
    game.result = null;

    V.clearHighlights();
    V.updatePieces(game.board);

    turnEl.textContent = 'Puzzle #' + puzzle.id;
    statusEl.textContent = puzzle.description;
    statusEl.style.color = '#7fdbca';
    if (puzzleStatusEl) puzzleStatusEl.textContent = '';
    if (puzzleControlsEl) puzzleControlsEl.style.display = 'block';
    if (moveLogEl) moveLogEl.innerHTML = '';
    if (capWhiteEl) capWhiteEl.textContent = '';
    if (capBlackEl) capBlackEl.textContent = '';

    document.querySelectorAll('#torus-puzzle-list .puzzle-card').forEach(c => c.classList.remove('active'));
    const card = puzzleListEl ? puzzleListEl.querySelector(`[data-id="${id}"]`) : null;
    if (card) card.classList.add('active');
  }

  function exitTorusPuzzle() {
    puzzleMode = false;
    activePuzzle = null;
    selected = null;
    legalTargets = [];

    game.reset();
    V.clearHighlights();
    V.updatePieces(game.board);
    updateUI();
    if (moveLogEl) moveLogEl.innerHTML = '';
    if (puzzleStatusEl) puzzleStatusEl.textContent = '';
    if (puzzleControlsEl) puzzleControlsEl.style.display = 'none';
    document.querySelectorAll('#torus-puzzle-list .puzzle-card').forEach(c => c.classList.remove('active'));
  }

  function checkTorusPuzzleSolution(from, to) {
    const sol = activePuzzle.solution;
    return from[0] === sol.from[0] && from[1] === sol.from[1] &&
           to[0] === sol.to[0] && to[1] === sol.to[1];
  }

  function handleTorusPuzzleMove(x, y) {
    const k = TG.key(x, y);
    const piece = game.board[k];

    if (selected) {
      const isTarget = legalTargets.some(([tx, ty]) => tx === x && ty === y);
      if (isTarget) {
        const from = selected;
        if (checkTorusPuzzleSolution(from, [x, y])) {
          game.makeMove(from, [x, y]);
          V.clearHighlights();
          V.updatePieces(game.board);

          solvedTorusPuzzles.add(activePuzzle.id);
          try { localStorage.setItem('torus-solved', JSON.stringify([...solvedTorusPuzzles])); } catch(e) {}

          if (puzzleStatusEl) {
            puzzleStatusEl.textContent = 'Correct! Checkmate!';
            puzzleStatusEl.style.color = '#44ff88';
          }
          statusEl.textContent = 'Puzzle solved!';
          statusEl.style.color = '#44ff88';
          selected = null;
          legalTargets = [];

          buildTorusPuzzleList();
        } else {
          if (puzzleStatusEl) {
            puzzleStatusEl.textContent = 'Not the best move. Try again!';
            puzzleStatusEl.style.color = '#ff6b6b';
          }
          selected = null;
          legalTargets = [];
          V.clearHighlights();
        }
        return;
      }

      if (piece && piece.color === game.turn) {
        selectPiece(x, y);
        return;
      }
      selected = null;
      legalTargets = [];
      V.clearHighlights();
      return;
    }

    if (piece && piece.color === game.turn) {
      selectPiece(x, y);
    }
  }

  // ── Multiplayer ──────────────────────────────────────────────

  function applyRemoteTorusMove(payload) {
    const from = payload.from;
    const to = payload.to;
    const moveNum = Math.floor(game.history.length / 2) + 1;
    const movingPiece = game.board[TG.key(...from)];
    const targetPiece = game.board[TG.key(...to)];

    if (game.makeMove(from, to)) {
      const notation = game.getMoveNotation(from, to, movingPiece, targetPiece);
      addMoveToLog(notation, moveNum);
      selected = null;
      legalTargets = [];
      V.clearHighlights();
      V.updatePieces(game.board);
      V.highlightLastMove(from, to);

      if (game.isCheck() && !game.gameOver) {
        const kp = findCurrentKing();
        if (kp) V.highlightCheck(...kp);
      }

      if (payload.white_time_remaining != null) {
        ChessClock.setTimeRemaining('w', payload.white_time_remaining);
        ChessClock.setTimeRemaining('b', payload.black_time_remaining);
      }
      ChessClock.switchTurn(game.turn);

      if (payload.game_over) {
        game.gameOver = true;
        game.result = payload.result === 'white_wins' ? 'White wins by checkmate!' :
                      payload.result === 'black_wins' ? 'Black wins by checkmate!' :
                      payload.result === 'draw' ? 'Stalemate \u2013 draw!' : payload.result;
        ChessClock.pause();
      }

      updateUI();
    }
  }

  function handleTorusGameEvent(type, payload) {
    if (type === 'resign') {
      game.gameOver = true;
      game.result = payload.result === 'white_wins' ? 'White wins by resignation!' :
                    'Black wins by resignation!';
      ChessClock.pause();
      updateUI();
    }
  }

  // ── Init renderers lazily ──────────────────────────────────────

  function ensureRenderer() {
    if (!rendererInitialized) {
      TorusRenderer.init(document.body, handleCellClick);
      rendererInitialized = true;
    }
  }

  function ensure3DRenderer() {
    if (!renderer3dInitialized) {
      Torus3DRenderer.init(document.body, handleCellClick);
      renderer3dInitialized = true;
    }
  }

  function showActiveRenderer() {
    if (activeView === '3d') {
      ensure3DRenderer();
      if (rendererInitialized) TorusRenderer.hide();
      Torus3DRenderer.updatePieces(game.board);
      Torus3DRenderer.show();
    } else {
      ensureRenderer();
      if (renderer3dInitialized) Torus3DRenderer.hide();
      TorusRenderer.updatePieces(game.board);
      TorusRenderer.show();
    }
  }

  // ── Controls ───────────────────────────────────────────────────

  const btnReset = document.getElementById('torus-btn-reset');
  const btnUndo = document.getElementById('torus-btn-undo');
  const btnSurrender = document.getElementById('torus-btn-surrender');
  const btnExport = document.getElementById('torus-btn-export');
  const aiDifficultyEl = document.getElementById('torus-ai-difficulty');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (puzzleMode) { exitTorusPuzzle(); return; }
      game.reset();
      selected = null;
      legalTargets = [];
      V.clearHighlights();
      V.clearLastMove();
      V.updatePieces(game.board);
      if (moveLogEl) moveLogEl.innerHTML = '';
      updateUI();
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      if (multiplayerEnabled) return; // no undo in online
      const undoCount = aiEnabled ? 2 : 1;
      let undone = 0;
      for (let i = 0; i < undoCount; i++) {
        if (game.undo()) {
          undone++;
          if (moveLogEl && moveLogEl.lastChild) moveLogEl.removeChild(moveLogEl.lastChild);
        }
      }
      if (undone > 0) {
        selected = null;
        legalTargets = [];
        V.clearHighlights();
        V.clearLastMove();
        V.updatePieces(game.board);
        updateUI();
        if (game.isCheck()) {
          const kp = findCurrentKing();
          if (kp) V.highlightCheck(...kp);
        }
      }
    });
  }

  if (btnSurrender) {
    btnSurrender.addEventListener('click', () => {
      if (game.gameOver) return;
      const loser = game.turn === 'w' ? 'White' : 'Black';
      const winner = game.turn === 'w' ? 'Black' : 'White';
      if (!confirm(`${loser} surrenders. ${winner} wins. Are you sure?`)) return;

      if (multiplayerEnabled) {
        Multiplayer.resignGame().then(() => {
          game.gameOver = true;
          game.result = `${winner} wins by resignation!`;
          ChessClock.pause();
          updateUI();
        }).catch(err => console.error('Resign failed:', err));
      } else {
        game.gameOver = true;
        game.result = `${winner} wins by resignation!`;
        updateUI();
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const report = game.exportReport();
      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `torus-chess-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (aiDifficultyEl) {
    aiDifficultyEl.addEventListener('change', (e) => {
      ai = new window.TorusAIModule.TorusAI('b', parseInt(e.target.value, 10));
    });
  }

  // ── Torus puzzle controls ─────────────────────────────────────

  const btnTorusHint = document.getElementById('torus-btn-hint');
  const btnTorusExitPuzzle = document.getElementById('torus-btn-exit-puzzle');

  if (btnTorusHint) {
    btnTorusHint.addEventListener('click', () => {
      if (!activePuzzle || !puzzleStatusEl) return;
      puzzleStatusEl.textContent = activePuzzle.hint;
      puzzleStatusEl.style.color = '#f7c948';
    });
  }

  if (btnTorusExitPuzzle) {
    btnTorusExitPuzzle.addEventListener('click', exitTorusPuzzle);
  }

  // ── View toggle (2D flat <-> 3D torus) ──────────────────────────

  const torusViewSelect = document.getElementById('torus-view-select');
  if (torusViewSelect) {
    torusViewSelect.addEventListener('change', (e) => {
      activeView = e.target.value;
      showActiveRenderer();

      // Restore highlights in the new view
      V.clearHighlights();
      if (selected) {
        V.highlightCells([[selected[0], selected[1]]], 'selected');
        V.highlightCells(legalTargets, 'move');
      }
      if (game.isCheck() && !game.gameOver) {
        const kp = findCurrentKing();
        if (kp) V.highlightCheck(...kp);
      }
    });
  }

  // ── Game mode ────────────────────────────────────────────────

  window.setTorusGameMode = function (mode) {
    ensureRenderer();

    game.reset();
    selected = null;
    legalTargets = [];
    aiEnabled = false;
    multiplayerEnabled = false;
    puzzleMode = false;
    activePuzzle = null;
    ChessClock.destroy();

    if (mode === 'torus-pvai') {
      aiEnabled = true;
      const depth = aiDifficultyEl ? parseInt(aiDifficultyEl.value, 10) : 2;
      ai = new window.TorusAIModule.TorusAI('b', depth);
    }

    if (mode === 'torus-puzzles') {
      buildTorusPuzzleList();
      turnEl.textContent = 'Torus Puzzles';
      statusEl.textContent = 'Select a puzzle to begin';
      statusEl.style.color = '#7fdbca';
    }

    if (mode === 'torus-online') {
      multiplayerEnabled = true;
      const ag = Multiplayer.getActiveGame();
      if (ag) {
        Multiplayer.setCallbacks(applyRemoteTorusMove, handleTorusGameEvent);

        ChessClock.init('torus-');
        if (ag.timeControl && ag.timeControl > 0) {
          ChessClock.setTimeControl(ag.timeControl);
          if (ag.whiteTimeRemaining != null) {
            ChessClock.setTimeRemaining('w', ag.whiteTimeRemaining);
            ChessClock.setTimeRemaining('b', ag.blackTimeRemaining);
          }
          ChessClock.setOnTimeout((color) => {
            const winner = color === 'w' ? 'Black' : 'White';
            game.gameOver = true;
            game.result = `${winner} wins on time!`;
            ChessClock.pause();
            updateUI();
          });
          ChessClock.start(game.turn);
        }
      }
    }

    if (puzzleStatusEl) puzzleStatusEl.textContent = '';
    if (puzzleControlsEl) puzzleControlsEl.style.display = 'none';

    V.clearHighlights();
    V.clearLastMove();
    showActiveRenderer();
    if (moveLogEl) moveLogEl.innerHTML = '';
    updateUI();
  };

  // Hide renderer when leaving torus game view
  window.hideTorusRenderer = function () {
    if (rendererInitialized) TorusRenderer.hide();
    if (renderer3dInitialized) Torus3DRenderer.hide();
  };
})();
