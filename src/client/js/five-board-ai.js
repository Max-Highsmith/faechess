/**
 * Five-Board Chess – AI Engine (Minimax with Alpha-Beta Pruning)
 *
 * Evaluates each playable board, weights by point value, and picks
 * the best move across all boards.
 */
import * as GM from './five-board-game.js';

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 10000 };

function positionBonus(x, y) {
  // Center preference
  const dx = Math.min(x, 7 - x);
  const dy = Math.min(y, 7 - y);
  return (dx + dy) * 2;
}

function evaluate(board, color) {
  let score = 0;
  for (const k of Object.keys(board)) {
    const piece = board[k];
    const [x, y] = GM.parseKey(k);
    const value = PIECE_VALUES[piece.type] + positionBonus(x, y);
    score += piece.color === color ? value : -value;
  }
  return score;
}

function allLegalMoves(board, color, enPassantSquare, castleRights) {
  const moves = [];
  for (const k of Object.keys(board)) {
    const piece = board[k];
    if (piece.color !== color) continue;
    const [x, y] = GM.parseKey(k);
    const targets = GM.legalMoves(board, x, y, enPassantSquare, castleRights);
    for (const to of targets) {
      moves.push({ from: [x, y], to });
    }
  }
  return moves;
}

function minimax(board, depth, alpha, beta, maximizing, aiColor, enPassantSquare, castleRights) {
  const currentColor = maximizing ? aiColor : (aiColor === 'w' ? 'b' : 'w');
  const moves = allLegalMoves(board, currentColor, enPassantSquare, castleRights);

  if (depth === 0 || moves.length === 0) {
    let score = evaluate(board, aiColor);
    if (moves.length === 0) {
      if (GM.isInCheck(board, currentColor)) {
        score = maximizing ? -100000 + (3 - depth) : 100000 - (3 - depth);
      } else {
        score = 0; // stalemate
      }
    }
    return { score, move: null };
  }

  // Move ordering: captures first
  moves.sort((a, b) => {
    const capA = board[GM.key(...a.to)] ? PIECE_VALUES[board[GM.key(...a.to)].type] : 0;
    const capB = board[GM.key(...b.to)] ? PIECE_VALUES[board[GM.key(...b.to)].type] : 0;
    return capB - capA;
  });

  let bestMove = moves[0];

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const piece = board[GM.key(...move.from)];
      const { board: nb } = GM.applyMove(board, move.from, move.to, undefined, enPassantSquare);
      let newEp = null;
      if (piece.type === 'P' && Math.abs(move.to[1] - move.from[1]) === 2) {
        newEp = [move.from[0], (move.from[1] + move.to[1]) / 2];
      }
      const { score } = minimax(nb, depth - 1, alpha, beta, false, aiColor, newEp, castleRights);
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
      const piece = board[GM.key(...move.from)];
      const { board: nb } = GM.applyMove(board, move.from, move.to, undefined, enPassantSquare);
      let newEp = null;
      if (piece.type === 'P' && Math.abs(move.to[1] - move.from[1]) === 2) {
        newEp = [move.from[0], (move.from[1] + move.to[1]) / 2];
      }
      const { score } = minimax(nb, depth - 1, alpha, beta, true, aiColor, newEp, castleRights);
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

export class FiveBoardAI {
  constructor(color = 'b', depth = 2) {
    this.color = color;
    this.depth = depth;
  }

  /**
   * Find the best move across all playable boards.
   * Returns { boardIndex, from, to } or null.
   */
  getBestMove(game) {
    const playable = game.getPlayableBoards(this.color);
    if (playable.length === 0) return null;

    let bestOverall = null;
    let bestWeightedScore = -Infinity;

    for (const bi of playable) {
      const board = game.boards[bi];
      const result = minimax(
        board.board, this.depth,
        -Infinity, Infinity,
        true, this.color,
        board.enPassantSquare,
        board.castleRights
      );

      if (!result.move) continue;

      // Weight by board point value — prefer high-value boards
      const weight = GM.BOARD_POINTS[bi];
      // Normalize: add a bonus for boards where AI is winning
      const weightedScore = result.score * weight;

      // Add randomness among close scores for variety
      const jitter = (Math.random() - 0.5) * 20;

      if (weightedScore + jitter > bestWeightedScore) {
        bestWeightedScore = weightedScore + jitter;
        bestOverall = {
          boardIndex: bi,
          from: result.move.from,
          to: result.move.to
        };
      }
    }

    return bestOverall;
  }
}

export default { FiveBoardAI };
