/**
 * Five-Board Chess – Client re-exports from shared game logic
 */
export {
  FiveBoardGame, BOARD_POINTS, BOARD_LABELS,
  key, parseKey, legalMoves, applyMove, isInCheck, isPromotionMove,
  cloneBoard, findKing, hasAnyLegalMove, coordToNotation,
  PIECE_SYMBOLS, PIECE_NAMES
} from '../../shared/five-board-game-logic.js';

export { StandardGame } from '../../shared/standard-chess-logic.js';
