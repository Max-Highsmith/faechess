/**
 * Five-Board Chess – 2D Canvas Renderer (5 × standard 8×8 boards)
 */
const FiveBoardRenderer = (() => {
  let canvas, ctx;
  let onCellClick = null;
  let boardStates = [{}, {}, {}, {}, {}];
  let boardResults = [null, null, null, null, null];
  let playableBoards = [0, 1, 2, 3, 4];
  let activeBoardIndex = -1; // which board is currently focused
  let selectedCells = {};  // { boardIndex: [[x,y], ...] }
  let moveCells = {};      // { boardIndex: [[x,y], ...] }
  let checkCells = {};     // { boardIndex: [x,y] }
  let lastMoveFrom = {};   // { boardIndex: [x,y] }
  let lastMoveTo = {};     // { boardIndex: [x,y] }
  let scores = { w: 0, b: 0 };
  let currentTurn = 'w';

  let cellPx = 48;
  let boardGap = 20;
  const MARGIN_TOP = 70;
  const MARGIN_LEFT = 280;
  const MARGIN_BOTTOM = 40;

  const BOARD_POINTS = [1, 2, 3, 2, 1];
  const BOARD_LABELS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5'];

  const LIGHT_COLOR = '#d4c89a';
  const DARK_COLOR = '#6b5b3a';
  const BG_COLOR = '#1a1a2e';

  const POINT_COLORS = ['#88ccff', '#66bbff', '#ffdd44', '#66bbff', '#88ccff'];

  function computeLayout() {
    const availW = window.innerWidth - MARGIN_LEFT - 20;
    const availH = window.innerHeight - MARGIN_TOP - MARGIN_BOTTOM;
    // Fit 5 boards + gaps in available width
    const maxFromW = Math.floor((availW - 4 * boardGap) / (5 * 8));
    const maxFromH = Math.floor(availH / 8);
    cellPx = Math.max(28, Math.min(64, Math.min(maxFromW, maxFromH)));
    boardGap = Math.max(8, Math.min(20, Math.floor(cellPx * 0.4)));
  }

  function boardPx() { return 8 * cellPx; }

  function totalWidth() { return 5 * boardPx() + 4 * boardGap; }

  function boardOriginX(boardIndex) {
    const availW = window.innerWidth - MARGIN_LEFT;
    const startX = Math.max(10, Math.floor((availW - totalWidth()) / 2));
    return startX + boardIndex * (boardPx() + boardGap);
  }

  function boardOriginY() {
    return MARGIN_TOP;
  }

  function init(container, clickCallback) {
    onCellClick = clickCallback;
    canvas = document.createElement('canvas');
    canvas.id = 'five-board-canvas';
    canvas.style.marginLeft = MARGIN_LEFT + 'px';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.display = 'none';
    container.appendChild(canvas);

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMove);
    window.addEventListener('resize', onResize);
    sizeCanvas();
  }

  function sizeCanvas() {
    computeLayout();
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth - MARGIN_LEFT;
    const h = window.innerHeight;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function show() {
    if (canvas) {
      sizeCanvas();
      canvas.style.display = 'block';
      redraw();
    }
  }

  function hide() {
    if (canvas) canvas.style.display = 'none';
  }

  function updateBoards(boards, results, playable, turn, sc) {
    for (let i = 0; i < 5; i++) {
      boardStates[i] = boards[i] || {};
    }
    boardResults = results || [null, null, null, null, null];
    playableBoards = playable || [];
    currentTurn = turn || 'w';
    scores = sc || { w: 0, b: 0 };
    redraw();
  }

  function setActiveBoard(index) {
    activeBoardIndex = index;
    redraw();
  }

  function highlightCells(boardIndex, keys, type) {
    if (type === 'selected') selectedCells[boardIndex] = keys.slice();
    else moveCells[boardIndex] = keys.slice();
    redraw();
  }

  function highlightCheck(boardIndex, x, y) {
    checkCells[boardIndex] = [x, y];
    redraw();
  }

  function clearHighlights() {
    selectedCells = {};
    moveCells = {};
    checkCells = {};
    redraw();
  }

  function highlightLastMove(boardIndex, from, to) {
    lastMoveFrom[boardIndex] = from;
    lastMoveTo[boardIndex] = to;
    redraw();
  }

  function clearLastMove() {
    lastMoveFrom = {};
    lastMoveTo = {};
    redraw();
  }

  function clearAllLastMoves() {
    lastMoveFrom = {};
    lastMoveTo = {};
  }

  function redraw() {
    if (!ctx) return;
    const cw = window.innerWidth - MARGIN_LEFT;
    const ch = window.innerHeight;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    const by = boardOriginY();
    const fontSize = Math.max(12, Math.floor(cellPx * 0.44));
    const labelSize = Math.max(9, Math.floor(cellPx * 0.22));
    const titleSize = Math.max(12, Math.floor(cellPx * 0.3));

    // Draw score bar at top
    const scoreY = 20;
    ctx.font = `bold ${titleSize + 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = Math.floor((cw) / 2);
    ctx.fillStyle = '#f0e6d0';
    ctx.fillText(`White: ${scores.w}`, centerX - 100, scoreY);
    ctx.fillStyle = '#888';
    ctx.fillText('pts', centerX - 100 + ctx.measureText(`White: ${scores.w}`).width / 2 + 14, scoreY);
    ctx.fillStyle = '#aaa';
    ctx.fillText('|', centerX, scoreY);
    ctx.fillStyle = '#c0c0c0';
    ctx.fillText(`Black: ${scores.b}`, centerX + 100, scoreY);
    ctx.fillStyle = '#888';
    ctx.fillText('pts', centerX + 100 + ctx.measureText(`Black: ${scores.b}`).width / 2 + 14, scoreY);

    // Draw each board
    for (let bi = 0; bi < 5; bi++) {
      const bx = boardOriginX(bi);
      const isFinished = boardResults[bi] !== null;
      const isPlayable = playableBoards.includes(bi);
      const isActive = bi === activeBoardIndex;

      // Board label
      ctx.fillStyle = POINT_COLORS[bi];
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${BOARD_LABELS[bi]} (+${BOARD_POINTS[bi]})`, bx + boardPx() / 2, by - 6);

      // Board border
      if (isActive) {
        ctx.strokeStyle = '#44aaff';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx - 3, by - 3, boardPx() + 6, boardPx() + 6);
      } else if (isPlayable && !isFinished) {
        ctx.strokeStyle = 'rgba(68, 255, 136, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 2, by - 2, boardPx() + 4, boardPx() + 4);
      }

      // Draw cells
      const board = boardStates[bi];
      const selCells = selectedCells[bi] || [];
      const mvCells = moveCells[bi] || [];
      const chkCell = checkCells[bi] || null;
      const lmFrom = lastMoveFrom[bi] || null;
      const lmTo = lastMoveTo[bi] || null;

      for (let gx = 0; gx < 8; gx++) {
        for (let gy = 0; gy < 8; gy++) {
          const px = bx + gx * cellPx;
          const py = by + (7 - gy) * cellPx;
          const isLight = (gx + gy) % 2 === 0;
          ctx.fillStyle = isLight ? LIGHT_COLOR : DARK_COLOR;
          ctx.fillRect(px, py, cellPx, cellPx);

          // Last move highlights
          if (lmFrom && lmFrom[0] === gx && lmFrom[1] === gy) {
            ctx.strokeStyle = 'rgba(224, 112, 48, 0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, cellPx - 2, cellPx - 2);
            ctx.fillStyle = 'rgba(224, 112, 48, 0.18)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }
          if (lmTo && lmTo[0] === gx && lmTo[1] === gy) {
            ctx.fillStyle = 'rgba(255, 221, 51, 0.5)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }

          // Check highlight
          if (chkCell && chkCell[0] === gx && chkCell[1] === gy) {
            ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }

          // Selected highlight
          if (selCells.some(([sx, sy]) => sx === gx && sy === gy)) {
            ctx.fillStyle = 'rgba(68, 170, 255, 0.5)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }

          // Legal move dots
          if (mvCells.some(([mx, my]) => mx === gx && my === gy)) {
            const k = `${gx},${gy}`;
            if (board[k]) {
              ctx.strokeStyle = 'rgba(68, 255, 136, 0.7)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.38, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              ctx.fillStyle = 'rgba(68, 255, 136, 0.45)';
              ctx.beginPath();
              ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.16, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Cell border
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(px, py, cellPx, cellPx);
        }
      }

      // Draw pieces
      for (const k of Object.keys(board)) {
        const [x, y] = k.split(',').map(Number);
        const piece = board[k];
        const SYMS = window.FiveBoardGameModule ? window.FiveBoardGameModule.PIECE_SYMBOLS : null;
        const sym = SYMS ? SYMS[piece.type][piece.color] : piece.type;
        const px = bx + x * cellPx;
        const py = by + (7 - y) * cellPx;

        ctx.fillStyle = piece.color === 'w' ? 'rgba(240,230,208,0.9)' : 'rgba(42,42,42,0.9)';
        ctx.beginPath();
        ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.36, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = piece.color === 'w' ? '#d4af37' : '#5555aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.36, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = piece.color === 'w' ? '#2a2a2a' : '#f0e6d0';
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, px + cellPx / 2, py + cellPx / 2 + 1);
      }

      // File labels
      ctx.fillStyle = '#666';
      ctx.font = `${labelSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i < 8; i++) {
        ctx.fillText(String.fromCharCode(97 + i), bx + i * cellPx + cellPx / 2, by + boardPx() + 2);
      }

      // Rank labels (only on first board)
      if (bi === 0) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 8; i++) {
          ctx.fillText(String(i + 1), bx - 4, by + (7 - i) * cellPx + cellPx / 2);
        }
      }

      // Dim overlay for finished boards
      if (isFinished) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(bx, by, boardPx(), boardPx());

        // Result text
        const res = boardResults[bi];
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${titleSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerY = by + boardPx() / 2;

        if (res.winner === 'w') {
          ctx.fillText('White wins!', bx + boardPx() / 2, centerY - 10);
          ctx.fillStyle = '#ffdd44';
          ctx.font = `bold ${titleSize + 4}px sans-serif`;
          ctx.fillText(`+${BOARD_POINTS[bi]}`, bx + boardPx() / 2, centerY + 16);
        } else if (res.winner === 'b') {
          ctx.fillText('Black wins!', bx + boardPx() / 2, centerY - 10);
          ctx.fillStyle = '#ffdd44';
          ctx.font = `bold ${titleSize + 4}px sans-serif`;
          ctx.fillText(`+${BOARD_POINTS[bi]}`, bx + boardPx() / 2, centerY + 16);
        } else {
          ctx.fillText('Draw', bx + boardPx() / 2, centerY - 10);
          ctx.fillStyle = '#888';
          ctx.font = `${titleSize}px sans-serif`;
          ctx.fillText('0 pts', bx + boardPx() / 2, centerY + 14);
        }
      }
    }
  }

  function hitTest(clientX, clientY) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const by = boardOriginY();

    for (let bi = 0; bi < 5; bi++) {
      const bx = boardOriginX(bi);
      const localX = mx - bx;
      const localY = my - by;
      if (localX >= 0 && localX < boardPx() && localY >= 0 && localY < boardPx()) {
        const gridX = Math.floor(localX / cellPx);
        const gridY = 7 - Math.floor(localY / cellPx);
        if (gridX >= 0 && gridX < 8 && gridY >= 0 && gridY < 8) {
          return { boardIndex: bi, x: gridX, y: gridY };
        }
      }
    }
    return null;
  }

  function onCanvasClick(event) {
    const hit = hitTest(event.clientX, event.clientY);
    if (hit && onCellClick) {
      onCellClick(hit.boardIndex, hit.x, hit.y);
    }
  }

  function onCanvasMove(event) {
    const tooltip = document.getElementById('tooltip');
    const hit = hitTest(event.clientX, event.clientY);
    if (hit) {
      const board = boardStates[hit.boardIndex];
      const k = `${hit.x},${hit.y}`;
      const piece = board[k];
      if (piece) {
        const SYMS = window.FiveBoardGameModule ? window.FiveBoardGameModule.PIECE_SYMBOLS : null;
        const NAMES = window.FiveBoardGameModule ? window.FiveBoardGameModule.PIECE_NAMES : null;
        const sym = SYMS ? SYMS[piece.type][piece.color] : piece.type;
        const name = NAMES ? NAMES[piece.type] : piece.type;
        const colorName = piece.color === 'w' ? 'White' : 'Black';
        const file = String.fromCharCode(97 + hit.x);
        const rank = hit.y + 1;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
        tooltip.textContent = `${sym} ${colorName} ${name} (${file}${rank}) – Board ${hit.boardIndex + 1}`;
        canvas.style.cursor = 'pointer';
        return;
      }
      canvas.style.cursor = 'default';
    }
    if (tooltip) tooltip.style.display = 'none';
    if (canvas) canvas.style.cursor = 'default';
  }

  function onResize() {
    if (!canvas || canvas.style.display === 'none') return;
    sizeCanvas();
    redraw();
  }

  return {
    init, show, hide,
    updateBoards, setActiveBoard,
    highlightCells, highlightCheck, clearHighlights,
    highlightLastMove, clearLastMove, clearAllLastMoves,
    redraw
  };
})();

export default FiveBoardRenderer;
window.FiveBoardRenderer = FiveBoardRenderer;
