/**
 * Raumschach (5×5×5 3D Chess) – Game Logic
 * Re-exports from shared module so both client and server use the same code.
 */
export {
  PIECE_SYMBOLS, PIECE_NAMES,
  key, parseKey,
  initialBoard, inBounds,
  findKing, isInCheck, cloneBoard, applyMove,
  isPromotionMove,
  legalMoves, hasAnyLegalMove,
  coordToNotation,
  Game
} from '../../shared/game-logic.js';
