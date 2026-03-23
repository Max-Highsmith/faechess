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

  let rendererInitialized = false;

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
    } else if (game.isCheck()) {
      statusEl.textContent = `${colorName} is in check!`;
      statusEl.style.color = '#f7c948';
    } else {
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
    if (game.gameOver) return;
    if (aiEnabled && game.turn === ai.color) return;

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
            TorusRenderer.clearHighlights();
            TorusRenderer.updatePieces(game.board);
            TorusRenderer.highlightLastMove(from, [x, y]);

            if (game.isCheck() && !game.gameOver) {
              const kp = findCurrentKing();
              if (kp) TorusRenderer.highlightCheck(...kp);
            }

            updateUI();
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
      TorusRenderer.clearHighlights();
      return;
    }

    if (piece && piece.color === game.turn) {
      selectPiece(x, y);
    }
  }

  function selectPiece(x, y) {
    selected = [x, y];
    legalTargets = game.getLegalMoves(x, y);
    TorusRenderer.clearHighlights();
    TorusRenderer.highlightCells([[x, y]], 'selected');
    TorusRenderer.highlightCells(legalTargets, 'move');
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
        TorusRenderer.clearHighlights();
        TorusRenderer.updatePieces(game.board);
        TorusRenderer.highlightLastMove(move.from, move.to);

        if (game.isCheck() && !game.gameOver) {
          const kp = findCurrentKing();
          if (kp) TorusRenderer.highlightCheck(...kp);
        }

        updateUI();
      }
    }, 300);
  }

  // ── Init renderer on first use ──────────────────────────────────

  function ensureRenderer() {
    if (!rendererInitialized) {
      TorusRenderer.init(document.body, handleCellClick);
      rendererInitialized = true;
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
      game.reset();
      selected = null;
      legalTargets = [];
      TorusRenderer.clearHighlights();
      TorusRenderer.clearLastMove();
      TorusRenderer.updatePieces(game.board);
      if (moveLogEl) moveLogEl.innerHTML = '';
      updateUI();
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
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
        TorusRenderer.clearHighlights();
        TorusRenderer.clearLastMove();
        TorusRenderer.updatePieces(game.board);
        updateUI();
        if (game.isCheck()) {
          const kp = findCurrentKing();
          if (kp) TorusRenderer.highlightCheck(...kp);
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
      game.gameOver = true;
      game.result = `${winner} wins by resignation!`;
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

  // ── Game mode ────────────────────────────────────────────────

  window.setTorusGameMode = function (mode) {
    ensureRenderer();

    game.reset();
    selected = null;
    legalTargets = [];
    aiEnabled = false;

    if (mode === 'torus-pvai') {
      aiEnabled = true;
      const depth = aiDifficultyEl ? parseInt(aiDifficultyEl.value, 10) : 2;
      ai = new window.TorusAIModule.TorusAI('b', depth);
    }

    TorusRenderer.clearHighlights();
    TorusRenderer.clearLastMove();
    TorusRenderer.updatePieces(game.board);
    TorusRenderer.show();
    if (moveLogEl) moveLogEl.innerHTML = '';
    updateUI();
  };

  // Hide renderer when leaving torus game view
  window.hideTorusRenderer = function () {
    if (rendererInitialized) TorusRenderer.hide();
  };
})();
