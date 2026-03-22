/**
 * Raumschach (5×5×5 3D Chess) – Game Logic
 *
 * Coordinates: (x, y, z) where x=file(0-4), y=rank(0-4), z=level(0-4)
 * Level 0 = bottom (White's home), Level 4 = top (Black's home)
 *
 * Pieces: K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, U=Unicorn, P=Pawn
 * Unicorn moves diagonally through all three axes (triagonal).
 */

export const PIECE_SYMBOLS = {
  K: { w: '♔', b: '♚' }, Q: { w: '♕', b: '♛' }, R: { w: '♖', b: '♜' },
  B: { w: '♗', b: '♝' }, N: { w: '♘', b: '♞' }, U: { w: '⛊', b: '⛉' },
  P: { w: '♙', b: '♟' }
};

export const PIECE_NAMES = { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', U:'Unicorn', P:'Pawn' };

export function key(x, y, z) { return `${x},${y},${z}`; }
export function parseKey(k) { return k.split(',').map(Number); }

export function initialBoard() {
  const board = {};
  // White pieces: levels A (z=0) and B (z=1)
  // Level A: R N K N R
  const levelA = ['R','N','K','N','R'];
  for (let x = 0; x < 5; x++) {
    board[key(x, 0, 0)] = { type: levelA[x], color: 'w' };
  }
  for (let x = 0; x < 5; x++) {
    board[key(x, 1, 0)] = { type: 'P', color: 'w' };
  }
  // Level B: B U Q B U
  const levelB = ['B','U','Q','B','U'];
  for (let x = 0; x < 5; x++) {
    board[key(x, 0, 1)] = { type: levelB[x], color: 'w' };
  }
  for (let x = 0; x < 5; x++) {
    board[key(x, 1, 1)] = { type: 'P', color: 'w' };
  }

  // Black pieces: levels E (z=4) and D (z=3)
  // Level E: B N K N R
  for (let x = 0; x < 5; x++) {
    board[key(x, 4, 4)] = { type: levelA[x], color: 'b' };
  }
  for (let x = 0; x < 5; x++) {
    board[key(x, 3, 4)] = { type: 'P', color: 'b' };
  }
  // Level D: R U Q U B
  for (let x = 0; x < 5; x++) {
    board[key(x, 4, 3)] = { type: levelB[x], color: 'b' };
  }
  for (let x = 0; x < 5; x++) {
    board[key(x, 3, 3)] = { type: 'P', color: 'b' };
  }

  return board;
}

export function inBounds(x, y, z) {
  return x >= 0 && x < 5 && y >= 0 && y < 5 && z >= 0 && z < 5;
}

// Sliding piece: move along directions until blocked
function slidingMoves(board, x, y, z, directions, color) {
  const moves = [];
  for (const [dx, dy, dz] of directions) {
    let nx = x + dx, ny = y + dy, nz = z + dz;
    while (inBounds(nx, ny, nz)) {
      const target = board[key(nx, ny, nz)];
      if (target) {
        if (target.color !== color) moves.push([nx, ny, nz]);
        break;
      }
      moves.push([nx, ny, nz]);
      nx += dx; ny += dy; nz += dz;
    }
  }
  return moves;
}

// Rook directions: along one axis only (6 directions)
const ROOK_DIRS = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
];

// Bishop directions: diagonal in exactly 2 axes (12 directions)
const BISHOP_DIRS = [
  [1,1,0],[1,-1,0],[-1,1,0],[-1,-1,0],
  [1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1],
  [0,1,1],[0,1,-1],[0,-1,1],[0,-1,-1]
];

// Unicorn directions: diagonal in all 3 axes (8 directions)
const UNICORN_DIRS = [
  [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],
  [-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]
];

// Queen = Rook + Bishop + Unicorn
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS, ...UNICORN_DIRS];

// Knight moves: 2 in one axis, 1 in another, 0 in third (3D generalization)
function knightMoves(board, x, y, z, color) {
  const moves = [];
  // Full 3D knight: permutations of (±2, ±1, 0) across all three axes
  const perms = [];
  const vals = [
    [2,1,0],[2,0,1],[1,2,0],[0,2,1],[1,0,2],[0,1,2]
  ];
  for (const [a,b,c] of vals) {
    for (const sa of [1,-1]) {
      for (const sb of [1,-1]) {
        if (a === 0 && sa === -1) continue;
        if (b === 0 && sb === -1) continue;
        for (const sc of [1,-1]) {
          if (c === 0 && sc === -1) continue;
          perms.push([a*sa, b*sb, c*sc]);
        }
      }
    }
  }
  // Deduplicate
  const seen = new Set();
  for (const [dx, dy, dz] of perms) {
    const k = `${dx},${dy},${dz}`;
    if (!seen.has(k)) {
      seen.add(k);
      addIfValid(moves, board, x+dx, y+dy, z+dz, color);
    }
  }
  return moves;
}

function addIfValid(moves, board, nx, ny, nz, color) {
  if (!inBounds(nx, ny, nz)) return;
  const target = board[key(nx, ny, nz)];
  if (!target || target.color !== color) {
    moves.push([nx, ny, nz]);
  }
}

// King moves: one step in any of the 26 directions
function kingMoves(board, x, y, z, color) {
  const moves = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        addIfValid(moves, board, x+dx, y+dy, z+dz, color);
      }
    }
  }
  return moves;
}

// Pawn moves: White moves in +y and +z, Black in -y and -z
function pawnMoves(board, x, y, z, color) {
  const moves = [];
  const dir = color === 'w' ? 1 : -1;

  // Forward in y
  if (inBounds(x, y+dir, z) && !board[key(x, y+dir, z)]) {
    moves.push([x, y+dir, z]);
  }
  // Forward in z
  if (inBounds(x, y, z+dir) && !board[key(x, y, z+dir)]) {
    moves.push([x, y, z+dir]);
  }
  // Captures: diagonal forward (in y-x plane, z-x plane, y-z plane)
  for (const dx of [-1, 0, 1]) {
    for (const [dy, dz] of [[dir, 0], [0, dir], [dir, dir]]) {
      if (dx === 0 && dy === 0 && dz === 0) continue;
      if (dx === 0 && dy === dir && dz === 0) continue; // Forward non-capture
      if (dx === 0 && dy === 0 && dz === dir) continue; // Forward non-capture
      const nx = x+dx, ny = y+dy, nz = z+dz;
      if (!inBounds(nx, ny, nz)) continue;
      const target = board[key(nx, ny, nz)];
      if (target && target.color !== color) {
        moves.push([nx, ny, nz]);
      }
    }
  }
  return moves;
}

function pseudoLegalMoves(board, x, y, z) {
  const piece = board[key(x, y, z)];
  if (!piece) return [];
  const c = piece.color;
  switch (piece.type) {
    case 'R': return slidingMoves(board, x, y, z, ROOK_DIRS, c);
    case 'B': return slidingMoves(board, x, y, z, BISHOP_DIRS, c);
    case 'U': return slidingMoves(board, x, y, z, UNICORN_DIRS, c);
    case 'Q': return slidingMoves(board, x, y, z, QUEEN_DIRS, c);
    case 'N': return knightMoves(board, x, y, z, c);
    case 'K': return kingMoves(board, x, y, z, c);
    case 'P': return pawnMoves(board, x, y, z, c);
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

function isAttacked(board, x, y, z, byColor) {
  for (const k of Object.keys(board)) {
    const p = board[k];
    if (p.color !== byColor) continue;
    const [px, py, pz] = parseKey(k);
    const moves = pseudoLegalMoves(board, px, py, pz);
    if (moves.some(([mx,my,mz]) => mx===x && my===y && mz===z)) return true;
  }
  return false;
}

export function isInCheck(board, color) {
  const kp = findKing(board, color);
  if (!kp) return false;
  const enemy = color === 'w' ? 'b' : 'w';
  return isAttacked(board, kp[0], kp[1], kp[2], enemy);
}

export function cloneBoard(board) {
  const nb = {};
  for (const k of Object.keys(board)) {
    nb[k] = { ...board[k] };
  }
  return nb;
}

export function applyMove(board, from, to) {
  const nb = cloneBoard(board);
  const [fx,fy,fz] = from;
  const [tx,ty,tz] = to;
  const fk = key(fx,fy,fz);
  const tk = key(tx,ty,tz);
  const captured = nb[tk] || null;
  const piece = nb[fk];
  nb[tk] = { ...piece };
  delete nb[fk];

  // Pawn promotion: reaches opposite end
  if (piece.type === 'P') {
    if (piece.color === 'w' && (ty === 4 || tz === 4)) {
      nb[tk].type = 'Q'; // Auto-promote to queen
    } else if (piece.color === 'b' && (ty === 0 || tz === 0)) {
      nb[tk].type = 'Q';
    }
  }

  return { board: nb, captured };
}

export function legalMoves(board, x, y, z) {
  const piece = board[key(x,y,z)];
  if (!piece) return [];
  const pseudo = pseudoLegalMoves(board, x, y, z);
  const legal = [];
  for (const [tx,ty,tz] of pseudo) {
    const { board: nb } = applyMove(board, [x,y,z], [tx,ty,tz]);
    if (!isInCheck(nb, piece.color)) {
      legal.push([tx,ty,tz]);
    }
  }
  return legal;
}

export function hasAnyLegalMove(board, color) {
  for (const k of Object.keys(board)) {
    const p = board[k];
    if (p.color !== color) continue;
    const [x,y,z] = parseKey(k);
    if (legalMoves(board, x, y, z).length > 0) return true;
  }
  return false;
}

export function coordToNotation(x, y, z) {
  return String.fromCharCode(97+x) + (y+1) + String.fromCharCode(65+z);
}

export class Game {
  constructor() { this.reset(); }

  reset() {
    this.board = initialBoard();
    this.turn = 'w';
    this.history = [];
    this.captured = { w: [], b: [] };
    this.gameOver = false;
    this.result = null;
  }

  getLegalMoves(x, y, z) {
    const piece = this.board[key(x,y,z)];
    if (!piece || piece.color !== this.turn || this.gameOver) return [];
    return legalMoves(this.board, x, y, z);
  }

  makeMove(from, to) {
    const [fx,fy,fz] = from;
    const piece = this.board[key(fx,fy,fz)];
    if (!piece || piece.color !== this.turn || this.gameOver) return false;

    const legal = legalMoves(this.board, fx, fy, fz);
    const [tx,ty,tz] = to;
    if (!legal.some(([mx,my,mz]) => mx===tx && my===ty && mz===tz)) return false;

    const { board: nb, captured } = applyMove(this.board, from, to);

    this.history.push({
      board: this.board,
      from, to, piece: { ...piece },
      captured,
      turn: this.turn
    });

    if (captured) {
      this.captured[captured.color].push(captured);
    }

    this.board = nb;
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Check for checkmate/stalemate
    if (!hasAnyLegalMove(this.board, this.turn)) {
      this.gameOver = true;
      if (isInCheck(this.board, this.turn)) {
        this.result = this.turn === 'w' ? 'Black wins by checkmate!' : 'White wins by checkmate!';
      } else {
        this.result = 'Stalemate – draw!';
      }
    }

    return true;
  }

  undo() {
    if (this.history.length === 0) return false;
    const last = this.history.pop();
    this.board = last.board;
    this.turn = last.turn;
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
      const [x, y, z] = k.split(',').map(Number);
      finalPosition[coordToNotation(x, y, z)] = this.board[k];
    }

    return {
      format: 'faechess-v1',
      variant: 'raumschach-5x5x5',
      date: new Date().toISOString(),
      totalMoves: this.history.length,
      result,
      moves,
      finalPosition
    };
  }
}
