/**
 * Five-Board Chess – Game Logic
 *
 * 5 simultaneous standard chess boards. Players alternate turns,
 * choosing one board to play on each turn. Scoring by board position:
 * Board 1: +1, Board 2: +2, Board 3: +3, Board 4: +2, Board 5: +1
 */

import {
  StandardGame, key, parseKey, legalMoves, applyMove, isInCheck,
  isPromotionMove, cloneBoard, findKing, hasAnyLegalMove,
  coordToNotation, PIECE_SYMBOLS, PIECE_NAMES
} from './standard-chess-logic.js';

export { key, parseKey, legalMoves, applyMove, isInCheck, isPromotionMove,
  cloneBoard, findKing, hasAnyLegalMove, coordToNotation,
  PIECE_SYMBOLS, PIECE_NAMES };

export const BOARD_POINTS = [1, 2, 3, 2, 1];
export const BOARD_LABELS = ['Board 1', 'Board 2', 'Board 3', 'Board 4', 'Board 5'];

export class FiveBoardGame {
  constructor() { this.reset(); }

  reset() {
    this.boards = [];
    for (let i = 0; i < 5; i++) {
      this.boards.push(new StandardGame());
    }
    this.turn = 'w'; // overall turn
    this.scores = { w: 0, b: 0 };
    this.boardResults = [null, null, null, null, null];
    this.history = []; // { boardIndex, from, to, promoteTo }
    this.gameOver = false;
    this.result = null;
  }

  /** Get indices of boards the given color can play on */
  getPlayableBoards(color) {
    const playable = [];
    for (let i = 0; i < 5; i++) {
      if (!this.boardResults[i] && this.boards[i].turn === color) {
        playable.push(i);
      }
    }
    return playable;
  }

  /** Get legal moves for a piece on a specific board */
  getLegalMoves(boardIndex, x, y) {
    if (this.gameOver) return [];
    if (this.boardResults[boardIndex]) return [];
    const board = this.boards[boardIndex];
    if (board.turn !== this.turn) return [];
    return board.getLegalMoves(x, y);
  }

  /** Make a move on one board */
  makeMove(boardIndex, from, to, promoteTo) {
    if (this.gameOver) return false;
    if (boardIndex < 0 || boardIndex >= 5) return false;
    if (this.boardResults[boardIndex]) return false;

    const board = this.boards[boardIndex];
    if (board.turn !== this.turn) return false;

    const piece = board.board[key(from[0], from[1])];
    if (!piece || piece.color !== this.turn) return false;

    const captured = board.board[key(to[0], to[1])] || null;
    if (!board.makeMove(from, to, promoteTo)) return false;

    this.history.push({
      boardIndex,
      from: [...from],
      to: [...to],
      promoteTo,
      piece: { ...piece },
      captured,
      turn: this.turn
    });

    // Check if this board just ended
    if (board.gameOver) {
      if (board.result && board.result.includes('checkmate')) {
        const winner = board.result.includes('White') ? 'w' : 'b';
        this.boardResults[boardIndex] = { winner, result: board.result };
        this.scores[winner] += BOARD_POINTS[boardIndex];
      } else {
        // Draw/stalemate
        this.boardResults[boardIndex] = { winner: 'draw', result: board.result };
      }
    }

    // Switch overall turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    // Check if overall game is over
    this._checkGameOver();

    return true;
  }

  /** Concede a single board — opponent gets the points */
  concedeBoard(boardIndex) {
    if (this.gameOver) return false;
    if (this.boardResults[boardIndex]) return false;

    const winner = this.turn === 'w' ? 'b' : 'w';
    this.boardResults[boardIndex] = {
      winner,
      result: `${this.turn === 'w' ? 'White' : 'Black'} concedes board ${boardIndex + 1}`
    };
    this.scores[winner] += BOARD_POINTS[boardIndex];

    // Mark the individual board as over
    this.boards[boardIndex].gameOver = true;
    this.boards[boardIndex].result = this.boardResults[boardIndex].result;

    this.history.push({
      boardIndex,
      from: null,
      to: null,
      promoteTo: null,
      piece: null,
      captured: null,
      turn: this.turn,
      concession: true
    });

    this.turn = this.turn === 'w' ? 'b' : 'w';
    this._checkGameOver();
    return true;
  }

  /** Undo the last move */
  undo() {
    if (this.history.length === 0) return false;
    const last = this.history.pop();
    this.turn = last.turn;

    if (last.concession) {
      // Undo concession
      const winner = this.boardResults[last.boardIndex].winner;
      if (winner !== 'draw') {
        this.scores[winner] -= BOARD_POINTS[last.boardIndex];
      }
      this.boardResults[last.boardIndex] = null;
      this.boards[last.boardIndex].gameOver = false;
      this.boards[last.boardIndex].result = null;
    } else {
      // Check if board result needs to be undone
      if (this.boardResults[last.boardIndex]) {
        const winner = this.boardResults[last.boardIndex].winner;
        if (winner !== 'draw') {
          this.scores[winner] -= BOARD_POINTS[last.boardIndex];
        }
        this.boardResults[last.boardIndex] = null;
      }
      this.boards[last.boardIndex].undo();
    }

    this.gameOver = false;
    this.result = null;
    return true;
  }

  _checkGameOver() {
    // All boards resolved
    const allResolved = this.boardResults.every(r => r !== null);
    if (allResolved) {
      this.gameOver = true;
      if (this.scores.w > this.scores.b) {
        this.result = `White wins ${this.scores.w}–${this.scores.b}!`;
      } else if (this.scores.b > this.scores.w) {
        this.result = `Black wins ${this.scores.b}–${this.scores.w}!`;
      } else {
        this.result = `Tied ${this.scores.w}–${this.scores.b}!`;
      }
      return;
    }

    // Check if current player has any playable boards
    const playable = this.getPlayableBoards(this.turn);
    if (playable.length === 0) {
      // Current player can't move — skip their turn
      // (opponent has pending responses on boards where it's opponent's turn)
      this.turn = this.turn === 'w' ? 'b' : 'w';

      // Check if the other player can move
      const otherPlayable = this.getPlayableBoards(this.turn);
      if (otherPlayable.length === 0) {
        // Neither player can move — shouldn't happen in normal play
        // but handle gracefully
        this.gameOver = true;
        if (this.scores.w > this.scores.b) {
          this.result = `White wins ${this.scores.w}–${this.scores.b}!`;
        } else if (this.scores.b > this.scores.w) {
          this.result = `Black wins ${this.scores.b}–${this.scores.w}!`;
        } else {
          this.result = `Tied ${this.scores.w}–${this.scores.b}!`;
        }
      }
    }
  }

  /** Resign the entire match */
  resign() {
    if (this.gameOver) return;
    const winner = this.turn === 'w' ? 'Black' : 'White';
    this.gameOver = true;
    this.result = `${winner} wins by resignation!`;
  }

  exportReport() {
    const boardReports = this.boards.map((b, i) => ({
      boardIndex: i,
      points: BOARD_POINTS[i],
      result: this.boardResults[i],
      ...b.exportReport()
    }));

    return {
      format: 'faechess-v1',
      variant: 'five-board',
      date: new Date().toISOString(),
      totalMoves: this.history.length,
      scores: { ...this.scores },
      result: this.result,
      boards: boardReports
    };
  }
}
