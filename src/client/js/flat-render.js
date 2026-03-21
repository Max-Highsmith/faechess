/**
 * Raumschach – 2D Flat Board Renderer (5 boards side-by-side, or 15 in multi-mode)
 */
const FlatRenderer = (() => {
  let canvas, ctx;
  let onCellClick = null;
  let boardState = {};
  let selectedCells = [];
  let moveCells = [];
  let checkCell = null;
  let viewMode = 'xy'; // 'xy', 'xz', 'yz', or 'multi'

  // Layout computed dynamically to fit viewport
  let cellPx = 64;
  let gapPx = 24;
  const MARGIN_TOP = 44;
  const MARGIN_LEFT = 16;
  const MARGIN_BOTTOM = 28;
  const RANK_LABEL_W = 16;

  // Multi-mode constants
  const SECTION_LABEL_H = 28;
  const SECTION_VIEWS = ['xy', 'xz', 'yz'];
  const SECTION_NAMES = {
    xy: 'Row \u00d7 Col by Layer',
    xz: 'Row \u00d7 Layer by Col',
    yz: 'Col \u00d7 Layer by Row'
  };

  const LIGHT_COLOR = '#d4c89a';
  const DARK_COLOR = '#6b5b3a';
  const BG_COLOR = '#1a1a2e';

  function computeLayout() {
    const availW = window.innerWidth - 260;
    const raw = (availW - 48) / 26.4;
    cellPx = Math.max(32, Math.min(72, Math.floor(raw)));
    gapPx = Math.max(8, Math.floor(cellPx * 0.35));
  }

  function boardPx() { return 5 * cellPx; }
  function sectionH() { return SECTION_LABEL_H + MARGIN_TOP + boardPx() + MARGIN_BOTTOM; }
  function totalH() {
    return viewMode === 'multi' ? 3 * sectionH() : MARGIN_TOP + boardPx() + MARGIN_BOTTOM;
  }

  function init(container, clickCallback) {
    onCellClick = clickCallback;
    canvas = document.createElement('canvas');
    canvas.id = 'flat-canvas';
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
    const h = Math.max(totalH(), window.innerHeight);
    canvas.style.width = (window.innerWidth - 260) + 'px';
    canvas.style.height = h + 'px';
    canvas.width = (window.innerWidth - 260) * dpr;
    canvas.height = h * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function show() {
    if (canvas) {
      sizeCanvas();
      canvas.style.display = 'block';
      if (viewMode === 'multi') {
        document.body.style.overflowY = 'auto';
        document.body.style.minHeight = totalH() + 'px';
      }
      redraw();
    }
  }

  function hide() {
    if (canvas) {
      canvas.style.display = 'none';
      document.body.style.overflowY = '';
      document.body.style.minHeight = '';
    }
  }

  function updatePieces(board) {
    boardState = board;
    redraw();
  }

  function highlightCells(keys, type) {
    if (type === 'selected') {
      selectedCells = keys.slice();
    } else {
      moveCells = keys.slice();
    }
    redraw();
  }

  function highlightCheck(x, y, z) {
    checkCell = [x, y, z];
    redraw();
  }

  function clearHighlights() {
    selectedCells = [];
    moveCells = [];
    checkCell = null;
    redraw();
  }

  function cellWorldPos() { return null; }

  function setViewMode(mode) {
    if (['xy', 'xz', 'yz', 'multi'].includes(mode)) {
      viewMode = mode;
      if (canvas && canvas.style.display !== 'none') {
        sizeCanvas();
        if (viewMode === 'multi') {
          document.body.style.overflowY = 'auto';
          document.body.style.minHeight = totalH() + 'px';
        } else {
          document.body.style.overflowY = '';
          document.body.style.minHeight = '';
        }
      }
      redraw();
    }
  }

  function boardOriginX(stackIdx) {
    return MARGIN_LEFT + RANK_LABEL_W + stackIdx * (boardPx() + gapPx);
  }

  // Returns the top-left pixel of a cell given logical coords and a specific view/offset
  function cellPos(x, y, z, vm, topY) {
    let stackIdx, gridX, gridY;
    switch (vm) {
      case 'xy': stackIdx = z; gridX = x; gridY = y; break;
      case 'xz': stackIdx = y; gridX = x; gridY = z; break;
      case 'yz': stackIdx = x; gridX = y; gridY = z; break;
      default:   stackIdx = z; gridX = x; gridY = y;
    }
    const bx = boardOriginX(stackIdx);
    const px = bx + gridX * cellPx;
    const py = topY + (4 - gridY) * cellPx;
    return [px, py];
  }

  // Draw a row of 5 boards for a given perspective
  function drawBoardRow(vm, topY, fontSize, labelSize, titleSize) {
    for (let stackIdx = 0; stackIdx < 5; stackIdx++) {
      const bx = boardOriginX(stackIdx);

      // Board label
      let labelText;
      switch (vm) {
        case 'xy': labelText = 'Layer ' + String.fromCharCode(65 + stackIdx); break;
        case 'xz': labelText = 'Col ' + String.fromCharCode(97 + stackIdx); break;
        case 'yz': labelText = 'Row ' + (stackIdx + 1); break;
      }

      ctx.fillStyle = '#7fdbca';
      ctx.font = `bold ${titleSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(labelText, bx + boardPx() / 2, topY - 6);

      // Draw cells
      for (let gridY = 0; gridY < 5; gridY++) {
        for (let gridX = 0; gridX < 5; gridX++) {
          let x, y, z;
          switch (vm) {
            case 'xy': x = gridX; y = gridY; z = stackIdx; break;
            case 'xz': x = gridX; y = stackIdx; z = gridY; break;
            case 'yz': x = stackIdx; y = gridX; z = gridY; break;
          }

          const px = bx + gridX * cellPx;
          const py = topY + (4 - gridY) * cellPx;
          const isLight = (x + y + z) % 2 === 0;
          ctx.fillStyle = isLight ? LIGHT_COLOR : DARK_COLOR;
          ctx.fillRect(px, py, cellPx, cellPx);

          if (checkCell && checkCell[0] === x && checkCell[1] === y && checkCell[2] === z) {
            ctx.fillStyle = 'rgba(255, 68, 68, 0.5)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }

          if (selectedCells.some(([sx, sy, sz]) => sx === x && sy === y && sz === z)) {
            ctx.fillStyle = 'rgba(68, 170, 255, 0.5)';
            ctx.fillRect(px, py, cellPx, cellPx);
          }

          if (moveCells.some(([mx, my, mz]) => mx === x && my === y && mz === z)) {
            const k = Raumschach.key(x, y, z);
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

          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, cellPx, cellPx);
        }
      }

      // Draw pieces
      for (const k of Object.keys(boardState)) {
        const [px2, py2, pz2] = Raumschach.parseKey(k);

        let belongsHere = false;
        switch (vm) {
          case 'xy': belongsHere = (pz2 === stackIdx); break;
          case 'xz': belongsHere = (py2 === stackIdx); break;
          case 'yz': belongsHere = (px2 === stackIdx); break;
        }
        if (!belongsHere) continue;

        const piece = boardState[k];
        const [cx, cy] = cellPos(px2, py2, pz2, vm, topY);
        const sym = Raumschach.PIECE_SYMBOLS[piece.type][piece.color];

        ctx.fillStyle = piece.color === 'w' ? 'rgba(240,230,208,0.9)' : 'rgba(42,42,42,0.9)';
        ctx.beginPath();
        ctx.arc(cx + cellPx / 2, cy + cellPx / 2, cellPx * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = piece.color === 'w' ? '#d4af37' : '#5555aa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + cellPx / 2, cy + cellPx / 2, cellPx * 0.38, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = piece.color === 'w' ? '#2a2a2a' : '#f0e6d0';
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sym, cx + cellPx / 2, cy + cellPx / 2 + 1);
      }

      // Bottom labels
      ctx.fillStyle = '#888';
      ctx.font = `${labelSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let gridX = 0; gridX < 5; gridX++) {
        let lbl;
        switch (vm) {
          case 'xy': lbl = String.fromCharCode(97 + gridX); break;
          case 'xz': lbl = String.fromCharCode(97 + gridX); break;
          case 'yz': lbl = String.fromCharCode(97 + gridX); break;
        }
        ctx.fillText(lbl, bx + gridX * cellPx + cellPx / 2, topY + boardPx() + 4);
      }

      // Left labels
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let gridY = 0; gridY < 5; gridY++) {
        let lbl;
        switch (vm) {
          case 'xy': lbl = String(gridY + 1); break;
          case 'xz': lbl = String.fromCharCode(65 + gridY); break;
          case 'yz': lbl = String.fromCharCode(65 + gridY); break;
        }
        const py = topY + (4 - gridY) * cellPx + cellPx / 2;
        ctx.fillText(lbl, bx - 4, py);
      }
    }
  }

  function redraw() {
    if (!ctx) return;
    const cw = (window.innerWidth - 260);
    const ch = Math.max(totalH(), window.innerHeight);

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cw, ch);

    const fontSize = Math.max(10, Math.floor(cellPx * 0.42));
    const labelSize = Math.max(9, Math.floor(cellPx * 0.18));
    const titleSize = Math.max(10, Math.floor(cellPx * 0.22));

    if (viewMode === 'multi') {
      for (let s = 0; s < 3; s++) {
        const vm = SECTION_VIEWS[s];
        const yOff = s * sectionH();
        const topY = yOff + SECTION_LABEL_H + MARGIN_TOP;

        // Section title
        ctx.fillStyle = '#b8a9c9';
        ctx.font = `bold ${titleSize + 2}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(SECTION_NAMES[vm], MARGIN_LEFT + RANK_LABEL_W, yOff + 6);

        drawBoardRow(vm, topY, fontSize, labelSize, titleSize);
      }
    } else {
      drawBoardRow(viewMode, MARGIN_TOP, fontSize, labelSize, titleSize);
    }
  }

  function hitTestRow(mx, my, vm, topY) {
    const localY = my - topY;
    if (localY < 0 || localY >= boardPx()) return null;

    for (let stackIdx = 0; stackIdx < 5; stackIdx++) {
      const bx = boardOriginX(stackIdx);
      const localX = mx - bx;
      if (localX >= 0 && localX < boardPx() && localY >= 0 && localY < boardPx()) {
        const gridX = Math.floor(localX / cellPx);
        const gridY = 4 - Math.floor(localY / cellPx);
        if (gridX >= 0 && gridX < 5 && gridY >= 0 && gridY < 5) {
          let x, y, z;
          switch (vm) {
            case 'xy': x = gridX; y = gridY; z = stackIdx; break;
            case 'xz': x = gridX; y = stackIdx; z = gridY; break;
            case 'yz': x = stackIdx; y = gridX; z = gridY; break;
          }
          return [x, y, z];
        }
      }
    }
    return null;
  }

  function hitTest(clientX, clientY) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    if (viewMode === 'multi') {
      for (let s = 0; s < 3; s++) {
        const vm = SECTION_VIEWS[s];
        const topY = s * sectionH() + SECTION_LABEL_H + MARGIN_TOP;
        const result = hitTestRow(mx, my, vm, topY);
        if (result) return result;
      }
      return null;
    }

    return hitTestRow(mx, my, viewMode, MARGIN_TOP);
  }

  function onCanvasClick(event) {
    const hit = hitTest(event.clientX, event.clientY);
    if (hit && onCellClick) {
      onCellClick(hit[0], hit[1], hit[2]);
    }
  }

  function onCanvasMove(event) {
    const tooltip = document.getElementById('tooltip');
    const hit = hitTest(event.clientX, event.clientY);
    if (hit) {
      const [x, y, z] = hit;
      const k = Raumschach.key(x, y, z);
      const piece = boardState[k];
      if (piece) {
        const sym = Raumschach.PIECE_SYMBOLS[piece.type][piece.color];
        const name = Raumschach.PIECE_NAMES[piece.type];
        const colorName = piece.color === 'w' ? 'White' : 'Black';
        const coord = Raumschach.coordToNotation(x, y, z);
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

  return { init, updatePieces, highlightCells, highlightCheck, clearHighlights, cellWorldPos, setViewMode, show, hide };
})();


export default FlatRenderer;
window.FlatRenderer = FlatRenderer;
