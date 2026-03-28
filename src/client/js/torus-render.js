/**
 * Torus Chess – 2D Canvas Renderer (single 8×8 board)
 */
const TorusRenderer = (() => {
  let canvas, ctx;
  let onCellClick = null;
  let boardState = {};
  let selectedCells = [];
  let moveCells = [];
  let checkCell = null;
  let lastMoveFrom = null;
  let lastMoveTo = null;

  let cellPx = 64;
  const MARGIN_TOP = 44;
  const MARGIN_LEFT = 16;
  const MARGIN_BOTTOM = 28;
  const RANK_LABEL_W = 20;

  const LIGHT_COLOR = '#d4c89a';
  const DARK_COLOR = '#6b5b3a';
  const BG_COLOR = '#1a1a2e';
  const EDGE_COLOR_H = 'rgba(0, 200, 255, 0.35)'; // torus wrap indicator
  const EDGE_COLOR_V = 'rgba(200, 0, 255, 0.35)';

  function computeLayout() {
    const availW = window.innerWidth - 260;
    const availH = window.innerHeight;
    const maxFromW = Math.floor((availW - MARGIN_LEFT - RANK_LABEL_W - 40) / 8);
    const maxFromH = Math.floor((availH - MARGIN_TOP - MARGIN_BOTTOM - 40) / 8);
    cellPx = Math.max(40, Math.min(80, Math.min(maxFromW, maxFromH)));
  }

  function boardPx() { return 8 * cellPx; }

  function boardOriginX() {
    const availW = window.innerWidth - 260;
    return Math.max(MARGIN_LEFT + RANK_LABEL_W, Math.floor((availW - boardPx()) / 2));
  }

  function boardOriginY() {
    const availH = window.innerHeight;
    return Math.max(MARGIN_TOP, Math.floor((availH - boardPx()) / 2));
  }

  function init(container, clickCallback) {
    onCellClick = clickCallback;
    canvas = document.createElement('canvas');
    canvas.id = 'torus-canvas';
    canvas.style.marginLeft = '260px';
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
    const w = window.innerWidth - 260;
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

  function updatePieces(board) {
    boardState = board;
    redraw();
  }

  function highlightCells(keys, type) {
    if (type === 'selected') selectedCells = keys.slice();
    else moveCells = keys.slice();
    redraw();
  }

  function highlightCheck(x, y) {
    checkCell = [x, y];
    redraw();
  }

  function clearHighlights() {
    selectedCells = [];
    moveCells = [];
    checkCell = null;
    redraw();
  }

  function highlightLastMove(from, to) {
    lastMoveFrom = from;
    lastMoveTo = to;
    redraw();
  }

  function clearLastMove() {
    lastMoveFrom = null;
    lastMoveTo = null;
    redraw();
  }

  function redraw() {
    if (!ctx) return;
    const cw = window.innerWidth - 260;
    const ch = window.innerHeight;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    const bx = boardOriginX();
    const by = boardOriginY();
    const fontSize = Math.max(14, Math.floor(cellPx * 0.48));
    const labelSize = Math.max(10, Math.floor(cellPx * 0.2));

    // Draw cells
    for (let gridX = 0; gridX < 8; gridX++) {
      for (let gridY = 0; gridY < 8; gridY++) {
        const x = gridX;
        const y = gridY;
        const px = bx + gridX * cellPx;
        const py = by + (7 - gridY) * cellPx;
        const isLight = (x + y) % 2 === 0;
        ctx.fillStyle = isLight ? LIGHT_COLOR : DARK_COLOR;
        ctx.fillRect(px, py, cellPx, cellPx);

        // Back rank tint
        if (y === 1) {
          ctx.fillStyle = 'rgba(240, 230, 208, 0.18)'; // light gold for white back rank
          ctx.fillRect(px, py, cellPx, cellPx);
        } else if (y === 5) {
          ctx.fillStyle = 'rgba(60, 60, 100, 0.22)'; // dark blue for black back rank
          ctx.fillRect(px, py, cellPx, cellPx);
        }

        // Last move highlights
        if (lastMoveFrom && lastMoveFrom[0] === x && lastMoveFrom[1] === y) {
          ctx.strokeStyle = 'rgba(224, 112, 48, 0.7)';
          ctx.lineWidth = 3;
          ctx.strokeRect(px + 2, py + 2, cellPx - 4, cellPx - 4);
          ctx.fillStyle = 'rgba(224, 112, 48, 0.18)';
          ctx.fillRect(px, py, cellPx, cellPx);
        }
        if (lastMoveTo && lastMoveTo[0] === x && lastMoveTo[1] === y) {
          ctx.fillStyle = 'rgba(255, 221, 51, 0.5)';
          ctx.fillRect(px, py, cellPx, cellPx);
        }

        // Check highlight
        if (checkCell && checkCell[0] === x && checkCell[1] === y) {
          ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
          ctx.fillRect(px, py, cellPx, cellPx);
        }

        // Selected highlight
        if (selectedCells.some(([sx, sy]) => sx === x && sy === y)) {
          ctx.fillStyle = 'rgba(68, 170, 255, 0.5)';
          ctx.fillRect(px, py, cellPx, cellPx);
        }

        // Legal move dots
        if (moveCells.some(([mx, my]) => mx === x && my === y)) {
          const k = window.TorusGameModule.key(x, y);
          if (boardState[k]) {
            ctx.strokeStyle = 'rgba(68, 255, 136, 0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.4, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(68, 255, 136, 0.45)';
            ctx.beginPath();
            ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Cell border
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, cellPx, cellPx);
      }
    }

    // Draw torus wrap indicators on edges
    // Left & right edges (file wrapping)
    for (let gridY = 0; gridY < 8; gridY++) {
      const py = by + (7 - gridY) * cellPx;
      // Left edge
      ctx.fillStyle = EDGE_COLOR_H;
      ctx.fillRect(bx, py, 3, cellPx);
      // Right edge
      ctx.fillRect(bx + boardPx() - 3, py, 3, cellPx);
    }
    // Top & bottom edges (rank wrapping)
    for (let gridX = 0; gridX < 8; gridX++) {
      const px = bx + gridX * cellPx;
      // Top edge
      ctx.fillStyle = EDGE_COLOR_V;
      ctx.fillRect(px, by, cellPx, 3);
      // Bottom edge
      ctx.fillRect(px, by + boardPx() - 3, cellPx, 3);
    }

    // Board outline
    ctx.strokeStyle = 'rgba(127, 219, 202, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, boardPx() + 2, boardPx() + 2);

    // Draw pieces
    for (const k of Object.keys(boardState)) {
      const [x, y] = window.TorusGameModule.parseKey(k);
      const piece = boardState[k];
      const sym = window.TorusGameModule.PIECE_SYMBOLS[piece.type][piece.color];
      const px = bx + x * cellPx;
      const py = by + (7 - y) * cellPx;

      ctx.fillStyle = piece.color === 'w' ? 'rgba(240,230,208,0.9)' : 'rgba(42,42,42,0.9)';
      ctx.beginPath();
      ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = piece.color === 'w' ? '#d4af37' : '#5555aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + cellPx / 2, py + cellPx / 2, cellPx * 0.38, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = piece.color === 'w' ? '#2a2a2a' : '#f0e6d0';
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sym, px + cellPx / 2, py + cellPx / 2 + 1);
    }

    // File labels (a-h) along bottom
    ctx.fillStyle = '#888';
    ctx.font = `${labelSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < 8; i++) {
      ctx.fillText(String.fromCharCode(97 + i), bx + i * cellPx + cellPx / 2, by + boardPx() + 4);
    }

    // Rank labels (1-8) along left
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      ctx.fillText(String(i + 1), bx - 6, by + (7 - i) * cellPx + cellPx / 2);
    }

    // Title
    ctx.fillStyle = '#7fdbca';
    ctx.font = `bold ${Math.floor(labelSize * 1.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Torus Chess \u2014 edges wrap around', bx + boardPx() / 2, by - 10);
  }

  function hitTest(clientX, clientY) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const bx = boardOriginX();
    const by = boardOriginY();
    const localX = mx - bx;
    const localY = my - by;
    if (localX < 0 || localX >= boardPx() || localY < 0 || localY >= boardPx()) return null;
    const gridX = Math.floor(localX / cellPx);
    const gridY = 7 - Math.floor(localY / cellPx);
    if (gridX >= 0 && gridX < 8 && gridY >= 0 && gridY < 8) {
      return [gridX, gridY];
    }
    return null;
  }

  function onCanvasClick(event) {
    const hit = hitTest(event.clientX, event.clientY);
    if (hit && onCellClick) onCellClick(hit[0], hit[1]);
  }

  function onCanvasMove(event) {
    const tooltip = document.getElementById('tooltip');
    const hit = hitTest(event.clientX, event.clientY);
    if (hit) {
      const [x, y] = hit;
      const k = window.TorusGameModule.key(x, y);
      const piece = boardState[k];
      if (piece) {
        const sym = window.TorusGameModule.PIECE_SYMBOLS[piece.type][piece.color];
        const name = window.TorusGameModule.PIECE_NAMES[piece.type];
        const colorName = piece.color === 'w' ? 'White' : 'Black';
        const coord = window.TorusGameModule.coordToNotation(x, y);
        tooltip.style.display = 'block';
        tooltip.style.left = (event.clientX + 12) + 'px';
        tooltip.style.top = (event.clientY - 8) + 'px';
        tooltip.textContent = `${sym} ${colorName} ${name} (${coord})`;
        return;
      }
    }
    tooltip.style.display = 'none';
  }

  function onResize() {
    if (!canvas || canvas.style.display === 'none') return;
    sizeCanvas();
    redraw();
  }

  return { init, updatePieces, highlightCells, highlightCheck, clearHighlights, highlightLastMove, clearLastMove, show, hide };
})();

export default TorusRenderer;
window.TorusRenderer = TorusRenderer;
