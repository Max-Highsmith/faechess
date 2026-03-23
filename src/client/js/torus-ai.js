/**
 * Torus Chess – AI Engine (Minimax with Alpha-Beta Pruning)
 */
import * as GameModule from './torus-game.js';

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 10000 };

function positionBonus(x, y) {
  // Mild center preference; torus has no edges so bonus is flatter
  const dx = Math.min(x, 7 - x);
  const dy = Math.min(y, 7 - y);
  return (dx + dy) * 2;
}

function evaluate(board, color) {
  let score = 0;
  for (const k of Object.keys(board)) {
    const piece = board[k];
    const [x, y] = GameModule.parseKey(k);
    const value = PIECE_VALUES[piece.type] + positionBonus(x, y);
    score += piece.color === color ? value : -value;
  }
  return score;
}

function allLegalMoves(board, color, enPassantSquare) {
  const moves = [];
  for (const k of Object.keys(board)) {
    const piece = board[k];
    if (piece.color !== color) continue;
    const [x, y] = GameModule.parseKey(k);
    const targets = GameModule.legalMoves(board, x, y, enPassantSquare);
    for (const to of targets) {
      moves.push({ from: [x, y], to });
    }
  }
  return moves;
}

function minimax(board, depth, alpha, beta, maximizing, aiColor, enPassantSquare) {
  const currentColor = maximizing ? aiColor : (aiColor === 'w' ? 'b' : 'w');
  const moves = allLegalMoves(board, currentColor, enPassantSquare);

  if (depth === 0 || moves.length === 0) {
    let score = evaluate(board, aiColor);
    if (moves.length === 0) {
      if (GameModule.isInCheck(board, currentColor)) {
        score = maximizing ? -100000 + (3 - depth) : 100000 - (3 - depth);
      } else {
        score = 0;
      }
    }
    return { score, move: null };
  }

  // Move ordering: captures first
  moves.sort((a, b) => {
    const capA = board[GameModule.key(...a.to)] ? PIECE_VALUES[board[GameModule.key(...a.to)].type] : 0;
    const capB = board[GameModule.key(...b.to)] ? PIECE_VALUES[board[GameModule.key(...b.to)].type] : 0;
    return capB - capA;
  });

  let bestMove = moves[0];

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const piece = board[GameModule.key(...move.from)];
      const { board: nb } = GameModule.applyMove(board, move.from, move.to, undefined, enPassantSquare);
      // Compute new en passant square
      let newEp = null;
      if (piece.type === 'P' && Math.abs(move.to[1] - move.from[1]) === 2) {
        newEp = [move.from[0], (move.from[1] + move.to[1]) / 2];
      }
      const { score } = minimax(nb, depth - 1, alpha, beta, false, aiColor, newEp);
      if (score > maxEval) {
        maxEval = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const piece = board[GameModule.key(...move.from)];
      const { board: nb } = GameModule.applyMove(board, move.from, move.to, undefined, enPassantSquare);
      let newEp = null;
      if (piece.type === 'P' && Math.abs(move.to[1] - move.from[1]) === 2) {
        newEp = [move.from[0], (move.from[1] + move.to[1]) / 2];
      }
      const { score } = minimax(nb, depth - 1, alpha, beta, true, aiColor, newEp);
      if (score < minEval) {
        minEval = score;
        bestMove = move;
      }
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove };
  }
}

export function rankMoves(board, color, depth = 2, enPassantSquare = null) {
  const moves = allLegalMoves(board, color, enPassantSquare);
  const scored = moves.map(move => {
    const piece = board[GameModule.key(...move.from)];
    const { board: nb } = GameModule.applyMove(board, move.from, move.to, undefined, enPassantSquare);
    let newEp = null;
    if (piece.type === 'P' && Math.abs(move.to[1] - move.from[1]) === 2) {
      newEp = [move.from[0], (move.from[1] + move.to[1]) / 2];
    }
    const { score } = minimax(nb, depth - 1, -Infinity, Infinity, false, color, newEp);
    const captured = board[GameModule.key(...move.to)] || null;
    return { ...move, score, piece, captured };
  });
  return scored.sort((a, b) => b.score - a.score);
}

export class TorusAI {
  constructor(color = 'b', depth = 2) {
    this.color = color;
    this.depth = depth;
  }

  getBestMove(board, enPassantSquare) {
    const result = minimax(board, this.depth, -Infinity, Infinity, true, this.color, enPassantSquare);
    return result.move;
  }
}

export default { TorusAI };
