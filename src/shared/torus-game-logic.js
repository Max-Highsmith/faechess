/**
 * Torus Chess (8×8 Wraparound) – Game Logic
 *
 * Standard chess on an 8×8 board with toroidal topology:
 * files (x) and ranks (y) wrap around. No castling.
 *
 * Coordinates: (x, y) where x=file(0-7, a-h), y=rank(0-7, 1-8)
 * y=0 is White's back rank, y=7 is Black's back rank.
 */

export const PIECE_SYMBOLS = {
  K: { w: '♔', b: '♚' }, Q: { w: '♕', b: '♛' }, R: { w: '♖', b: '♜' },
  B: { w: '♗', b: '♝' }, N: { w: '♘', b: '♞' }, P: { w: '♙', b: '♟' }
};

export const PIECE_NAMES = { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' };

export function key(x, y) { return `${x},${y}`; }
export function parseKey(k) { return k.split(',').map(Number); }

export function wrap(n) { return ((n % 8) + 8) % 8; }

export function initialBoard() {
  const board = {};
  const backRank = ['R','N','B','Q','K','B','N','R'];
  // White: back rank at y=0, pawns at y=1
  // Black: pawns at y=4, back rank at y=5
  // Offset layout gives equal 2-rank buffers in both directions on the torus,
  // preventing back-rank pieces from attacking each other through the wrap.
  for (let x = 0; x < 8; x++) {
    board[key(x, 0)] = { type: backRank[x], color: 'w' };
    board[key(x, 1)] = { type: 'P', color: 'w' };
    board[key(x, 4)] = { type: 'P', color: 'b' };
    board[key(x, 5)] = { type: backRank[x], color: 'b' };
  }
  return board;
}

// Sliding piece: move along direction with wrapping; stop at start or blocker
function slidingMoves(board, x, y, directions, color) {
  const moves = [];
  for (const [dx, dy] of directions) {
    let nx = wrap(x + dx), ny = wrap(y + dy);
    while (!(nx === x && ny === y)) {
      const target = board[key(nx, ny)];
      if (target) {
        if (target.color !== color) moves.push([nx, ny]);
        break;
      }
      moves.push([nx, ny]);
      nx = wrap(nx + dx);
      ny = wrap(ny + dy);
    }
  }
  return moves;
}

const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const BISHOP_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];

const KNIGHT_JUMPS = [
  [2,1],[2,-1],[-2,1],[-2,-1],
  [1,2],[1,-2],[-1,2],[-1,-2]
];

function knightMoves(board, x, y, color) {
  const moves = [];
  for (const [dx, dy] of KNIGHT_JUMPS) {
    const nx = wrap(x + dx), ny = wrap(y + dy);
    const target = board[key(nx, ny)];
    if (!target || target.color !== color) moves.push([nx, ny]);
  }
  return moves;
}

function kingMoves(board, x, y, color) {
  const moves = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = wrap(x + dx), ny = wrap(y + dy);
      const target = board[key(nx, ny)];
      if (!target || target.color !== color) moves.push([nx, ny]);
    }
  }
  return moves;
}

function pawnMoves(board, x, y, color, enPassantSquare) {
  const moves = [];
  const dir = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 1 : 4;
  const promoRank = color === 'w' ? 5 : 0;

  // Forward one (rank does NOT wrap for pawns)
  const fy = y + dir;
  if (fy >= 0 && fy <= 7 && !board[key(x, fy)]) {
    moves.push([x, fy]);
    // Double push from starting rank
    const fy2 = y + 2 * dir;
    if (y === startRank && fy2 >= 0 && fy2 <= 7 && !board[key(x, fy2)]) {
      moves.push([x, fy2]);
    }
  }

  // Captures (file wraps, rank does not)
  const cy = y + dir;
  if (cy >= 0 && cy <= 7) {
    for (const dx of [-1, 1]) {
      const cx = wrap(x + dx);
      const target = board[key(cx, cy)];
      if (target && target.color !== color) {
        moves.push([cx, cy]);
      }
      // En passant
      if (enPassantSquare && enPassantSquare[0] === cx && enPassantSquare[1] === cy) {
        moves.push([cx, cy]);
      }
    }
  }

  return moves;
}

function pseudoLegalMoves(board, x, y, enPassantSquare) {
  const piece = board[key(x, y)];
  if (!piece) return [];
  const c = piece.color;
  switch (piece.type) {
    case 'R': return slidingMoves(board, x, y, ROOK_DIRS, c);
    case 'B': return slidingMoves(board, x, y, BISHOP_DIRS, c);
    case 'Q': return slidingMoves(board, x, y, QUEEN_DIRS, c);
    case 'N': return knightMoves(board, x, y, c);
    case 'K': return kingMoves(board, x, y, c);
    case 'P': return pawnMoves(board, x, y, c, enPassantSquare);
    default: return [];
  }
}

export function findKing(board, color) {
  for (const k of Object.keys(board)) {
    const p = board[k];
    if (p.type === 'K' && p.color === color) return parseKey(k);
  }
  return null;
}

function isAttacked(board, x, y, byColor) {
  for (const k of Object.keys(board)) {
    const p = board[k];
    if (p.color !== byColor) continue;
    const [px, py] = parseKey(k);
    // Use null for en passant — attacks don't depend on en passant
    const moves = pseudoLegalMoves(board, px, py, null);
    if (moves.some(([mx, my]) => mx === x && my === y)) return true;
  }
  return false;
}

export function isInCheck(board, color) {
  const kp = findKing(board, color);
  if (!kp) return false;
  const enemy = color === 'w' ? 'b' : 'w';
  return isAttacked(board, kp[0], kp[1], enemy);
}

export function cloneBoard(board) {
  const nb = {};
  for (const k of Object.keys(board)) {
    nb[k] = { ...board[k] };
  }
  return nb;
}

export function isPromotionMove(board, from, to) {
  const piece = board[key(from[0], from[1])];
  if (!piece || piece.type !== 'P') return false;
  if (piece.color === 'w' && to[1] === 5) return true;
  if (piece.color === 'b' && to[1] === 0) return true;
  return false;
}

export function applyMove(board, from, to, promoteTo, enPassantSquare) {
  const nb = cloneBoard(board);
  const [fx, fy] = from;
  const [tx, ty] = to;
  const fk = key(fx, fy);
  const tk = key(tx, ty);
  const captured = nb[tk] || null;
  const piece = nb[fk];
  nb[tk] = { ...piece };
  delete nb[fk];

  // En passant capture
  let epCaptured = null;
  if (piece.type === 'P' && enPassantSquare &&
      tx === enPassantSquare[0] && ty === enPassantSquare[1] && !captured) {
    const epPawnKey = key(tx, fy); // captured pawn is on same rank as moving pawn
    epCaptured = nb[epPawnKey] || null;
    delete nb[epPawnKey];
  }

  // Pawn promotion
  if (piece.type === 'P') {
    if ((piece.color === 'w' && ty === 5) || (piece.color === 'b' && ty === 0)) {
      nb[tk].type = promoteTo || 'Q';
    }
  }

  return { board: nb, captured: captured || epCaptured };
}

export function legalMoves(board, x, y, enPassantSquare) {
  const piece = board[key(x, y)];
  if (!piece) return [];
  const pseudo = pseudoLegalMoves(board, x, y, enPassantSquare);
  const legal = [];
  for (const [tx, ty] of pseudo) {
    const { board: nb } = applyMove(board, [x, y], [tx, ty], undefined, enPassantSquare);
    if (!isInCheck(nb, piece.color)) {
      legal.push([tx, ty]);
    }
  }
  return legal;
}

export function hasAnyLegalMove(board, color, enPassantSquare) {
  for (const k of Object.keys(board)) {
    const p = board[k];
    if (p.color !== color) continue;
    const [x, y] = parseKey(k);
    if (legalMoves(board, x, y, enPassantSquare).length > 0) return true;
  }
  return false;
}

export function coordToNotation(x, y) {
  return String.fromCharCode(97 + x) + (y + 1);
}

export class TorusGame {
  constructor() { this.reset(); }

  reset() {
    this.board = initialBoard();
    this.turn = 'w';
    this.history = [];
    this.captured = { w: [], b: [] };
    this.gameOver = false;
    this.result = null;
    this.enPassantSquare = null;
  }

  getLegalMoves(x, y) {
    const piece = this.board[key(x, y)];
    if (!piece || piece.color !== this.turn || this.gameOver) return [];
    return legalMoves(this.board, x, y, this.enPassantSquare);
  }

  makeMove(from, to, promoteTo) {
    const [fx, fy] = from;
    const piece = this.board[key(fx, fy)];
    if (!piece || piece.color !== this.turn || this.gameOver) return false;

    const legal = legalMoves(this.board, fx, fy, this.enPassantSquare);
    const [tx, ty] = to;
    if (!legal.some(([mx, my]) => mx === tx && my === ty)) return false;

    const { board: nb, captured } = applyMove(this.board, from, to, promoteTo, this.enPassantSquare);

    this.history.push({
      board: this.board,
      from, to, piece: { ...piece },
      captured,
      turn: this.turn,
      enPassantSquare: this.enPassantSquare
    });

    if (captured) {
      this.captured[captured.color].push(captured);
    }

    this.board = nb;
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Update en passant square
    if (piece.type === 'P' && Math.abs(ty - fy) === 2) {
      this.enPassantSquare = [fx, (fy + ty) / 2]; // square the pawn passed through
    } else {
      this.enPassantSquare = null;
    }

    // Check for checkmate/stalemate
    if (!hasAnyLegalMove(this.board, this.turn, this.enPassantSquare)) {
      this.gameOver = true;
      if (isInCheck(this.board, this.turn)) {
        this.result = this.turn === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
      } else {
        this.result = 'Stalemate \u2013 draw!';
      }
    }

    return true;
  }

  undo() {
    if (this.history.length === 0) return false;
    const last = this.history.pop();
    this.board = last.board;
    this.turn = last.turn;
    this.enPassantSquare = last.enPassantSquare;
    if (last.captured) {
      this.captured[last.captured.color].pop();
    }
    this.gameOver = false;
    this.result = null;
    return true;
  }

  isCheck() { return isInCheck(this.board, this.turn); }

  getMoveNotation(from, to, piece, captured) {
    const pn = piece.type === 'P' ? '' : piece.type;
    const cap = captured ? 'x' : '';
    return pn + coordToNotation(...from) + cap + coordToNotation(...to);
  }

  getLastMoveNotation() {
    if (this.history.length === 0) return '';
    const h = this.history[this.history.length - 1];
    return this.getMoveNotation(h.from, h.to, h.piece, h.captured);
  }

  exportReport() {
    let result = 'in_progress';
    if (this.gameOver) {
      if (this.result && this.result.includes('draw')) result = 'draw';
      else if (this.result && this.result.includes('White')) result = 'white_wins';
      else if (this.result && this.result.includes('Black')) result = 'black_wins';
    }

    const moves = this.history.map((h, i) => ({
      num: Math.floor(i / 2) + 1,
      color: h.turn,
      notation: this.getMoveNotation(h.from, h.to, h.piece, h.captured),
      from: coordToNotation(...h.from),
      to: coordToNotation(...h.to),
      piece: h.piece.type,
      captured: h.captured ? h.captured.type : null
    }));

    const finalPosition = {};
    for (const k of Object.keys(this.board)) {
      const [x, y] = k.split(',').map(Number);
      finalPosition[coordToNotation(x, y)] = this.board[k];
    }

    return {
      format: 'faechess-v1',
      variant: 'torus-8x8',
      date: new Date().toISOString(),
      totalMoves: this.history.length,
      result,
      moves,
      finalPosition
    };
  }
}
