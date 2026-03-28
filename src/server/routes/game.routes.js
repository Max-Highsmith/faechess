import express from 'express';
import crypto from 'crypto';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import {
  initialBoard, key, parseKey, legalMoves, applyMove,
  isInCheck, hasAnyLegalMove, coordToNotation
} from '../../shared/game-logic.js';
import {
  initialBoard as torusInitialBoard, key as torusKey,
  legalMoves as torusLegalMoves, applyMove as torusApplyMove,
  isInCheck as torusIsInCheck, hasAnyLegalMove as torusHasAnyLegalMove,
  coordToNotation as torusCoordToNotation
} from '../../shared/torus-game-logic.js';
import { calculateElo } from '../elo.js';

const router = express.Router();

function generateInviteCode() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

async function fetchPlayerProfiles(playerIds) {
  const ids = playerIds.filter(Boolean);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('users')
    .select('id, game_id, avatar_url, elo_rating')
    .in('id', ids);
  return data || [];
}

/**
 * Update Elo ratings for both players after a game completes.
 */
async function updateEloRatings(gameId, whitePlayerId, blackPlayerId, result) {
  const { data: players } = await supabase
    .from('users')
    .select('id, elo_rating, games_played, wins, losses, draws')
    .in('id', [whitePlayerId, blackPlayerId]);

  const wp = players?.find(p => p.id === whitePlayerId);
  const bp = players?.find(p => p.id === blackPlayerId);

  const whiteRating = wp?.elo_rating ?? 1200;
  const blackRating = bp?.elo_rating ?? 1200;
  const whiteGames = wp?.games_played ?? 0;
  const blackGames = bp?.games_played ?? 0;

  const elo = calculateElo(whiteRating, blackRating, result, whiteGames, blackGames);

  const isWhiteWin = result === 'white_wins';
  const isBlackWin = result === 'black_wins';
  const isDraw = result === 'draw';

  await supabase.from('users').update({
    elo_rating: elo.white.newRating,
    games_played: whiteGames + 1,
    wins: (wp?.wins ?? 0) + (isWhiteWin ? 1 : 0),
    losses: (wp?.losses ?? 0) + (isBlackWin ? 1 : 0),
    draws: (wp?.draws ?? 0) + (isDraw ? 1 : 0)
  }).eq('id', whitePlayerId);

  await supabase.from('users').update({
    elo_rating: elo.black.newRating,
    games_played: blackGames + 1,
    wins: (bp?.wins ?? 0) + (isBlackWin ? 1 : 0),
    losses: (bp?.losses ?? 0) + (isWhiteWin ? 1 : 0),
    draws: (bp?.draws ?? 0) + (isDraw ? 1 : 0)
  }).eq('id', blackPlayerId);

  return {
    white: { oldRating: whiteRating, newRating: elo.white.newRating, delta: elo.white.delta },
    black: { oldRating: blackRating, newRating: elo.black.newRating, delta: elo.black.delta }
  };
}

/**
 * Compute en passant square for torus games from the last move.
 */
async function getTorusEnPassant(gameId, moveCount) {
  if (moveCount === 0) return null;
  const { data: lastMove } = await supabase
    .from('game_moves')
    .select('from_pos, to_pos, piece_type')
    .eq('game_id', gameId)
    .order('move_number', { ascending: false })
    .limit(1)
    .single();
  if (lastMove && lastMove.piece_type === 'P') {
    const lf = lastMove.from_pos.split(',').map(Number);
    const lt = lastMove.to_pos.split(',').map(Number);
    if (Math.abs(lt[1] - lf[1]) === 2) {
      return [lf[0], (lf[1] + lt[1]) / 2];
    }
  }
  return null;
}

/**
 * POST /api/games
 * Create a new game. Body: { color, game_type, time_control }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    let { color } = req.body;
    if (!color || !['white', 'black', 'random'].includes(color)) {
      color = 'random';
    }
    if (color === 'random') {
      color = Math.random() < 0.5 ? 'white' : 'black';
    }

    const userId = req.user.id;
    const invite_code = generateInviteCode();
    const gameType = req.body.game_type === 'torus' ? 'torus' : 'raumschach';
    const board_state = gameType === 'torus' ? torusInitialBoard() : initialBoard();
    const timeControl = [3, 5, 10, 15].includes(req.body.time_control) ? req.body.time_control : 0;
    const timeMsTotal = timeControl > 0 ? timeControl * 60 * 1000 : null;

    const row = {
      white_player_id: color === 'white' ? userId : null,
      black_player_id: color === 'black' ? userId : null,
      status: 'waiting',
      current_turn: 'w',
      board_state,
      move_count: 0,
      invite_code,
      time_control: timeControl,
      white_time_remaining: timeMsTotal,
      black_time_remaining: timeMsTotal,
      game_type: gameType
    };

    const { data, error } = await supabase
      .from('games')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    const players = await fetchPlayerProfiles([data.white_player_id, data.black_player_id]);

    res.json({
      game_id: data.id,
      invite_code: data.invite_code,
      color: color === 'white' ? 'w' : 'b',
      time_control: timeControl,
      game_type: gameType,
      players
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/games/join/:inviteCode
 * Join a waiting game via invite code, or reconnect to an active game.
 */
router.get('/join/:inviteCode', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Look up the game by invite code (any non-completed status)
    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('invite_code', req.params.inviteCode)
      .in('status', ['waiting', 'active'])
      .single();

    if (fetchErr || !game) {
      return res.status(404).json({ error: 'Game not found or already completed' });
    }

    // If the player is already in this game, let them reconnect
    if (game.white_player_id === userId || game.black_player_id === userId) {
      const myColor = game.white_player_id === userId ? 'w' : 'b';
      const players = await fetchPlayerProfiles([game.white_player_id, game.black_player_id]);

      // Compute live time remaining for reconnect
      let whiteTimeRemaining = game.white_time_remaining;
      let blackTimeRemaining = game.black_time_remaining;
      if (game.time_control > 0 && game.status === 'active' && game.last_move_at) {
        const elapsed = Date.now() - new Date(game.last_move_at).getTime();
        if (game.current_turn === 'w') whiteTimeRemaining = Math.max(0, whiteTimeRemaining - elapsed);
        else blackTimeRemaining = Math.max(0, blackTimeRemaining - elapsed);
      }

      return res.json({
        game_id: game.id,
        color: myColor,
        status: game.status,
        time_control: game.time_control || 0,
        game_type: game.game_type || 'raumschach',
        white_time_remaining: whiteTimeRemaining,
        black_time_remaining: blackTimeRemaining,
        players
      });
    }

    // Game is already full (active with both players)
    if (game.status === 'active') {
      return res.status(400).json({ error: 'Game already has two players' });
    }

    // Fill the empty slot
    const updates = {
      status: 'active',
      last_move_at: game.time_control > 0 ? new Date().toISOString() : null
    };
    let joinerColor;
    if (!game.white_player_id) {
      updates.white_player_id = userId;
      joinerColor = 'w';
    } else {
      updates.black_player_id = userId;
      joinerColor = 'b';
    }

    const { data: updated, error: updateErr } = await supabase
      .from('games')
      .update(updates)
      .eq('id', game.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const players = await fetchPlayerProfiles([updated.white_player_id, updated.black_player_id]);

    res.json({
      game_id: updated.id,
      color: joinerColor,
      status: updated.status,
      time_control: updated.time_control || 0,
      game_type: updated.game_type || 'raumschach',
      white_time_remaining: updated.white_time_remaining,
      black_time_remaining: updated.black_time_remaining,
      players
    });
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/games/:id
 * Get game state (for reconnection / initial load).
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const userId = req.user.id;
    if (game.white_player_id !== userId && game.black_player_id !== userId) {
      return res.status(403).json({ error: 'You are not a player in this game' });
    }

    // Also fetch move history
    const { data: moves } = await supabase
      .from('game_moves')
      .select('move_number, color, from_pos, to_pos, piece_type, captured_type, notation')
      .eq('game_id', game.id)
      .order('move_number', { ascending: true });

    const myColor = game.white_player_id === userId ? 'w' : 'b';
    const players = await fetchPlayerProfiles([game.white_player_id, game.black_player_id]);

    // Compute live time remaining
    if (game.time_control > 0 && game.status === 'active' && game.last_move_at) {
      const elapsed = Date.now() - new Date(game.last_move_at).getTime();
      if (game.current_turn === 'w') game.white_time_remaining = Math.max(0, game.white_time_remaining - elapsed);
      else game.black_time_remaining = Math.max(0, game.black_time_remaining - elapsed);
    }

    res.json({
      ...game,
      my_color: myColor,
      moves: moves || [],
      players
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/games/:id/move
 * Submit a move. Body: { from: [x,y,z] or [x,y], to: [x,y,z] or [x,y], promoteTo? }
 */
router.post('/:id/move', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, promoteTo } = req.body;

    // Fetch game
    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    const gameType = game.game_type || 'raumschach';
    const coordLen = gameType === 'torus' ? 2 : 3;

    if (!from || !to || from.length !== coordLen || to.length !== coordLen) {
      return res.status(400).json({ error: 'Invalid move format' });
    }

    // Determine player's color
    let playerColor;
    if (game.white_player_id === userId) playerColor = 'w';
    else if (game.black_player_id === userId) playerColor = 'b';
    else return res.status(403).json({ error: 'You are not in this game' });

    // Check turn
    if (game.current_turn !== playerColor) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    // Enforce chess clock
    if (game.time_control > 0 && game.last_move_at) {
      const now = Date.now();
      const elapsed = now - new Date(game.last_move_at).getTime();
      const timeField = playerColor === 'w' ? 'white_time_remaining' : 'black_time_remaining';
      const remaining = game[timeField] - elapsed;

      if (remaining <= 0) {
        const result = playerColor === 'w' ? 'black_wins' : 'white_wins';
        await supabase.from('games').update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
          [timeField]: 0
        }).eq('id', game.id);

        let elo_changes = null;
        if (game.white_player_id && game.black_player_id) {
          try {
            elo_changes = await updateEloRatings(game.id, game.white_player_id, game.black_player_id, result);
          } catch (e) { console.error('Elo update error:', e); }
        }

        return res.status(400).json({
          error: 'Time expired',
          game_over: true,
          result,
          elo_changes
        });
      }

      // Deduct elapsed time
      game[timeField] = remaining;
    }

    // Validate and apply move
    const board = game.board_state;
    const nextTurn = playerColor === 'w' ? 'b' : 'w';
    let piece, newBoard, captured, gameOver, result, notation;

    if (gameType === 'torus') {
      const enPassantSquare = await getTorusEnPassant(game.id, game.move_count);
      const [fx, fy] = from;
      piece = board[torusKey(fx, fy)];
      if (!piece || piece.color !== playerColor) {
        return res.status(400).json({ error: 'Invalid piece' });
      }
      const legal = torusLegalMoves(board, fx, fy, enPassantSquare);
      const [tx, ty] = to;
      if (!legal.some(([mx, my]) => mx === tx && my === ty)) {
        return res.status(400).json({ error: 'Illegal move' });
      }
      const moveResult = torusApplyMove(board, from, to, promoteTo, enPassantSquare);
      newBoard = moveResult.board;
      captured = moveResult.captured;

      // Compute en passant for the next move's checkmate/stalemate check
      let nextEnPassant = null;
      if (piece.type === 'P' && Math.abs(ty - fy) === 2) {
        nextEnPassant = [fx, (fy + ty) / 2];
      }
      gameOver = false;
      result = null;
      if (!torusHasAnyLegalMove(newBoard, nextTurn, nextEnPassant)) {
        gameOver = true;
        if (torusIsInCheck(newBoard, nextTurn)) {
          result = playerColor === 'w' ? 'white_wins' : 'black_wins';
        } else {
          result = 'draw';
        }
      }
      const pn = piece.type === 'P' ? '' : piece.type;
      const cap = captured ? 'x' : '';
      notation = pn + torusCoordToNotation(...from) + cap + torusCoordToNotation(...to);
    } else {
      // Raumschach
      const [fx, fy, fz] = from;
      piece = board[key(fx, fy, fz)];
      if (!piece || piece.color !== playerColor) {
        return res.status(400).json({ error: 'Invalid piece' });
      }
      const legal = legalMoves(board, fx, fy, fz);
      const [tx, ty, tz] = to;
      if (!legal.some(([mx, my, mz]) => mx === tx && my === ty && mz === tz)) {
        return res.status(400).json({ error: 'Illegal move' });
      }
      const moveResult = applyMove(board, from, to);
      newBoard = moveResult.board;
      captured = moveResult.captured;

      gameOver = false;
      result = null;
      if (!hasAnyLegalMove(newBoard, nextTurn)) {
        gameOver = true;
        if (isInCheck(newBoard, nextTurn)) {
          result = playerColor === 'w' ? 'white_wins' : 'black_wins';
        } else {
          result = 'draw';
        }
      }
      const pn = piece.type === 'P' ? '' : piece.type;
      const cap = captured ? 'x' : '';
      notation = pn + coordToNotation(...from) + cap + coordToNotation(...to);
    }

    const newMoveCount = game.move_count + 1;

    // Insert move
    const { error: moveErr } = await supabase
      .from('game_moves')
      .insert({
        game_id: game.id,
        move_number: newMoveCount,
        player_id: userId,
        color: playerColor,
        from_pos: from.join(','),
        to_pos: to.join(','),
        piece_type: piece.type,
        captured_type: captured ? captured.type : null,
        notation,
        board_after: newBoard
      });

    if (moveErr) {
      // Unique constraint violation = race condition
      if (moveErr.code === '23505') {
        return res.status(409).json({ error: 'Move already submitted' });
      }
      throw moveErr;
    }

    // Update game
    const gameUpdates = {
      board_state: newBoard,
      current_turn: nextTurn,
      move_count: newMoveCount
    };
    if (game.time_control > 0) {
      gameUpdates.white_time_remaining = game.white_time_remaining;
      gameUpdates.black_time_remaining = game.black_time_remaining;
      gameUpdates.last_move_at = new Date().toISOString();
    }
    if (gameOver) {
      gameUpdates.status = 'completed';
      gameUpdates.result = result;
      gameUpdates.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', game.id);

    if (updateErr) throw updateErr;

    // Update Elo ratings if game is over
    let elo_changes = null;
    if (gameOver && game.white_player_id && game.black_player_id) {
      try {
        elo_changes = await updateEloRatings(game.id, game.white_player_id, game.black_player_id, result);
      } catch (eloErr) {
        console.error('Error updating Elo:', eloErr);
      }
    }

    // Broadcast move
    const payload = {
      move_number: newMoveCount,
      from,
      to,
      piece_type: piece.type,
      captured_type: captured ? captured.type : null,
      notation,
      board_state: newBoard,
      current_turn: nextTurn,
      game_over: gameOver,
      result,
      elo_changes,
      white_time_remaining: game.white_time_remaining,
      black_time_remaining: game.black_time_remaining
    };

    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('Error submitting move:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/games/:id/resign
 * Resign from a game.
 */
router.post('/:id/resign', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    let playerColor;
    if (game.white_player_id === userId) playerColor = 'w';
    else if (game.black_player_id === userId) playerColor = 'b';
    else return res.status(403).json({ error: 'You are not in this game' });

    const result = playerColor === 'w' ? 'black_wins' : 'white_wins';

    const { error: updateErr } = await supabase
      .from('games')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString()
      })
      .eq('id', game.id);

    if (updateErr) throw updateErr;

    // Update Elo ratings
    let elo_changes = null;
    if (game.white_player_id && game.black_player_id) {
      try {
        elo_changes = await updateEloRatings(game.id, game.white_player_id, game.black_player_id, result);
      } catch (eloErr) {
        console.error('Error updating Elo:', eloErr);
      }
    }

    res.json({ success: true, result, elo_changes });
  } catch (error) {
    console.error('Error resigning:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
