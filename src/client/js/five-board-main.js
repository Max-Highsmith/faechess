/**
 * Five-Board Chess – Main Controller
 */

(function () {
  const FBG = window.FiveBoardGameModule;
  const game = new FBG.FiveBoardGame();
  let selectedBoard = -1;  // currently focused board index
  let selected = null;     // [x, y] of selected piece
  let legalTargets = [];

  // ── AI state ───────────────────────────────────────────────────
  let aiEnabled = false;
  let ai = new window.FiveBoardAIModule.FiveBoardAI('b', 2);

  let rendererInitialized = false;

  // ── Promotion modal ──────────────────────────────────────────
  const promotionModal = document.getElementById('fb-promotion-modal');
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
  const turnEl = document.getElementById('fb-turn');
  const statusEl = document.getElementById('fb-status');
  const scoreEl = document.getElementById('fb-score');
  const moveLogEl = document.getElementById('fb-move-log');

  function updateUI() {
    if (!turnEl) return;

    const colorName = game.turn === 'w' ? 'White' : 'Black';
    if (game.gameOver) {
      turnEl.textContent = 'Game Over';
    } else {
      turnEl.textContent = `${colorName} to move`;
    }

    if (game.gameOver) {
      statusEl.textContent = game.result;
      statusEl.style.color = '#ff6b6b';
    } else {
      // Show which boards are playable
      const playable = game.getPlayableBoards(game.turn);
      if (playable.length > 0) {
        statusEl.textContent = `Playable boards: ${playable.map(i => i + 1).join(', ')}`;
        statusEl.style.color = '#7fdbca';
      } else {
        statusEl.textContent = '';
      }
    }

    if (scoreEl) {
      scoreEl.textContent = `White: ${game.scores.w} pts  |  Black: ${game.scores.b} pts`;
    }

    // Update chess clock if active
    if (window.ChessClock && !game.gameOver) {
      window.ChessClock.switchTurn(game.turn);
    }
  }

  function addMoveToLog(boardIndex, notation, moveNum) {
    if (!moveLogEl) return;
    const div = document.createElement('div');
    div.textContent = `${moveNum}. B${boardIndex + 1}: ${notation}`;
    moveLogEl.appendChild(div);
    moveLogEl.scrollTop = moveLogEl.scrollHeight;
  }

  function refreshRenderer() {
    const boards = game.boards.map(b => b.board);
    const playable = game.getPlayableBoards(game.turn);
    FiveBoardRenderer.updateBoards(boards, game.boardResults, playable, game.turn, game.scores);
  }

  // ── Cell click handler ─────────────────────────────────────────

  function handleCellClick(boardIndex, x, y) {
    if (game.gameOver) return;
    if (aiEnabled && game.turn === ai.color) return;
    if (game.boardResults[boardIndex]) return; // finished board

    const board = game.boards[boardIndex];
    const k = FBG.key(x, y);
    const piece = board.board[k];

    // If clicking on a different board, switch focus
    if (selectedBoard !== boardIndex) {
      // Check if this board is playable for current player
      if (board.turn !== game.turn) {
        // Can't play here — show feedback?
        return;
      }
      // Deselect previous
      selected = null;
      legalTargets = [];
      FiveBoardRenderer.clearHighlights();
      selectedBoard = boardIndex;
      FiveBoardRenderer.setActiveBoard(boardIndex);

      // If clicked on own piece, select it
      if (piece && piece.color === game.turn) {
        selectPiece(boardIndex, x, y);
      }
      return;
    }

    // Same board — handle piece selection / move execution
    if (selected) {
      const isTarget = legalTargets.some(([tx, ty]) => tx === x && ty === y);
      if (isTarget) {
        const from = selected;
        const movingPiece = board.board[FBG.key(...from)];

        const executeMove = (promoteTo) => {
          const moveNum = Math.floor(game.history.length / 2) + 1;
          const targetPiece = board.board[k];

          if (game.makeMove(boardIndex, from, [x, y], promoteTo)) {
            const notation = board.getMoveNotation
              ? game.boards[boardIndex].getMoveNotation(from, [x, y], movingPiece, targetPiece)
              : `${movingPiece.type}${String.fromCharCode(97 + x)}${y + 1}`;
            addMoveToLog(boardIndex, notation, moveNum);
            selected = null;
            legalTargets = [];
            selectedBoard = -1;

            FiveBoardRenderer.clearHighlights();
            FiveBoardRenderer.setActiveBoard(-1);
            FiveBoardRenderer.highlightLastMove(boardIndex, from, [x, y]);

            refreshRenderer();

            // Highlight check on any board where current player is in check
            for (let bi = 0; bi < 5; bi++) {
              if (!game.boardResults[bi] && game.boards[bi].isCheck()) {
                const kp = FBG.findKing(game.boards[bi].board, game.boards[bi].turn);
                if (kp) FiveBoardRenderer.highlightCheck(bi, kp[0], kp[1]);
              }
            }

            updateUI();
            tryAIMove();
          }
        };

        if (FBG.isPromotionMove(board.board, from, [x, y])) {
          showPromotionModal(movingPiece.color).then(executeMove);
        } else {
          executeMove(undefined);
        }
        return;
      }

      // Clicked on own piece — reselect
      if (piece && piece.color === game.turn && board.turn === game.turn) {
        selectPiece(boardIndex, x, y);
        return;
      }

      // Clicked on empty / opponent — deselect
      selected = null;
      legalTargets = [];
      FiveBoardRenderer.clearHighlights();
      FiveBoardRenderer.setActiveBoard(boardIndex);
      return;
    }

    // No piece selected yet — select if own piece
    if (piece && piece.color === game.turn && board.turn === game.turn) {
      selectPiece(boardIndex, x, y);
    }
  }

  function selectPiece(boardIndex, x, y) {
    selected = [x, y];
    selectedBoard = boardIndex;
    legalTargets = game.getLegalMoves(boardIndex, x, y);
    FiveBoardRenderer.clearHighlights();
    FiveBoardRenderer.setActiveBoard(boardIndex);
    FiveBoardRenderer.highlightCells(boardIndex, [[x, y]], 'selected');
    FiveBoardRenderer.highlightCells(boardIndex, legalTargets, 'move');
  }

  // ── AI ─────────────────────────────────────────────────────────

  function tryAIMove() {
    if (!aiEnabled || game.gameOver || game.turn !== ai.color) return;

    statusEl.textContent = 'AI is thinking...';
    statusEl.style.color = '#7fdbca';

    setTimeout(() => {
      const move = ai.getBestMove(game);
      if (!move) return;

      const { boardIndex, from, to } = move;
      const board = game.boards[boardIndex];
      const movingPiece = board.board[FBG.key(...from)];
      const targetPiece = board.board[FBG.key(...to)];
      const moveNum = Math.floor(game.history.length / 2) + 1;

      if (game.makeMove(boardIndex, from, to)) {
        const notation = board.getMoveNotation
          ? game.boards[boardIndex].getMoveNotation(from, to, movingPiece, targetPiece)
          : `${movingPiece.type}${String.fromCharCode(97 + to[0])}${to[1] + 1}`;
        addMoveToLog(boardIndex, notation, moveNum);

        selected = null;
        legalTargets = [];
        selectedBoard = -1;

        FiveBoardRenderer.clearHighlights();
        FiveBoardRenderer.setActiveBoard(-1);
        FiveBoardRenderer.highlightLastMove(boardIndex, from, to);

        refreshRenderer();

        // Highlight checks
        for (let bi = 0; bi < 5; bi++) {
          if (!game.boardResults[bi] && game.boards[bi].isCheck()) {
            const kp = FBG.findKing(game.boards[bi].board, game.boards[bi].turn);
            if (kp) FiveBoardRenderer.highlightCheck(bi, kp[0], kp[1]);
          }
        }

        updateUI();
      }
    }, 400);
  }

  // ── Init renderer lazily ──────────────────────────────────────

  function ensureRenderer() {
    if (!rendererInitialized) {
      FiveBoardRenderer.init(document.body, handleCellClick);
      rendererInitialized = true;
    }
  }

  function showRenderer() {
    ensureRenderer();
    FiveBoardRenderer.show();
    refreshRenderer();
  }

  // ── Controls ───────────────────────────────────────────────────

  const btnReset = document.getElementById('fb-btn-reset');
  const btnUndo = document.getElementById('fb-btn-undo');
  const btnSurrender = document.getElementById('fb-btn-surrender');
  const btnExport = document.getElementById('fb-btn-export');
  const aiDifficultyEl = document.getElementById('fb-ai-difficulty');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      game.reset();
      selected = null;
      legalTargets = [];
      selectedBoard = -1;
      FiveBoardRenderer.clearHighlights();
      FiveBoardRenderer.clearLastMove();
      FiveBoardRenderer.setActiveBoard(-1);
      refreshRenderer();
      if (moveLogEl) moveLogEl.innerHTML = '';
      updateUI();
      // Restart clock
      if (window.ChessClock) {
        window.ChessClock.destroy();
        window.ChessClock.init();
        const tcSel = document.getElementById('fb-time-control-select');
        if (tcSel) {
          const minutes = parseInt(tcSel.value, 10);
          if (minutes > 0) {
            window.ChessClock.setTimeControl(minutes);
            window.ChessClock.start('w');
          }
        }
      }
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      const undoCount = aiEnabled ? 2 : 1;
      let undone = 0;
      for (let i = 0; i < undoCount; i++) {
        if (game.undo()) undone++;
      }
      if (undone > 0) {
        selected = null;
        legalTargets = [];
        selectedBoard = -1;
        FiveBoardRenderer.clearHighlights();
        FiveBoardRenderer.clearLastMove();
        FiveBoardRenderer.setActiveBoard(-1);
        refreshRenderer();
        if (moveLogEl) {
          for (let i = 0; i < undone; i++) {
            if (moveLogEl.lastChild) moveLogEl.removeChild(moveLogEl.lastChild);
          }
        }
        updateUI();
      }
    });
  }

  if (btnSurrender) {
    btnSurrender.addEventListener('click', () => {
      if (game.gameOver) return;
      const loser = game.turn === 'w' ? 'White' : 'Black';
      const winner = game.turn === 'w' ? 'Black' : 'White';
      if (!confirm(`${loser} surrenders the entire match. ${winner} wins. Are you sure?`)) return;
      game.resign();
      refreshRenderer();
      updateUI();
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
      a.download = `five-board-chess-report-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (aiDifficultyEl) {
    aiDifficultyEl.addEventListener('change', (e) => {
      ai = new window.FiveBoardAIModule.FiveBoardAI('b', parseInt(e.target.value, 10));
    });
  }

  // Concede board button
  const btnConcede = document.getElementById('fb-btn-concede');
  if (btnConcede) {
    btnConcede.addEventListener('click', () => {
      if (game.gameOver) return;
      if (selectedBoard < 0 || selectedBoard >= 5) {
        alert('Select a board first by clicking on it.');
        return;
      }
      if (game.boardResults[selectedBoard]) {
        alert('This board is already finished.');
        return;
      }
      const boardNum = selectedBoard + 1;
      const pts = FBG.BOARD_POINTS[selectedBoard];
      if (!confirm(`Concede Board ${boardNum} (+${pts} pts to opponent)?`)) return;
      game.concedeBoard(selectedBoard);
      selected = null;
      legalTargets = [];
      selectedBoard = -1;
      FiveBoardRenderer.clearHighlights();
      FiveBoardRenderer.setActiveBoard(-1);
      refreshRenderer();
      updateUI();
      tryAIMove();
    });
  }

  // Clock time control
  const tcSelect = document.getElementById('fb-time-control-select');
  if (tcSelect) {
    tcSelect.addEventListener('change', () => {
      // Clock resets when changing time control
    });
  }

  // ── Game mode ────────────────────────────────────────────────

  window.setFiveBoardGameMode = function (mode) {
    ensureRenderer();

    game.reset();
    selected = null;
    legalTargets = [];
    selectedBoard = -1;
    aiEnabled = false;

    if (mode === 'fb-pvai') {
      aiEnabled = true;
      const depth = aiDifficultyEl ? parseInt(aiDifficultyEl.value, 10) : 2;
      ai = new window.FiveBoardAIModule.FiveBoardAI('b', depth);
    }

    // Set up clock
    if (window.ChessClock) {
      window.ChessClock.destroy();
      window.ChessClock.init();
      window.ChessClock.setOnTimeout((color) => {
        if (game.gameOver) return;
        const loser = color === 'w' ? 'White' : 'Black';
        const winner = color === 'w' ? 'Black' : 'White';
        game.gameOver = true;
        game.result = `${winner} wins on time!`;
        refreshRenderer();
        updateUI();
      });

      const tcSel = document.getElementById('fb-time-control-select');
      if (tcSel) {
        const minutes = parseInt(tcSel.value, 10);
        if (minutes > 0) {
          window.ChessClock.setTimeControl(minutes);
          window.ChessClock.start('w');
        }
      }
    }

    FiveBoardRenderer.clearHighlights();
    FiveBoardRenderer.clearLastMove();
    FiveBoardRenderer.setActiveBoard(-1);
    showRenderer();
    if (moveLogEl) moveLogEl.innerHTML = '';
    updateUI();
  };

  // Hide renderer when leaving game view
  window.hideFiveBoardRenderer = function () {
    if (rendererInitialized) FiveBoardRenderer.hide();
    if (window.ChessClock) window.ChessClock.destroy();
  };
})();
