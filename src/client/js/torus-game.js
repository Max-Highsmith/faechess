/**
 * Torus Chess (8×8 Wraparound) – Game Logic
 * Re-exports from shared module so both client and server use the same code.
 */
export {
  PIECE_SYMBOLS, PIECE_NAMES,
  key, parseKey, wrap,
  initialBoard,
  findKing, isInCheck, cloneBoard, applyMove,
  isPromotionMove,
  legalMoves, hasAnyLegalMove,
  coordToNotation,
  TorusGame
} from '../../shared/torus-game-logic.js';
