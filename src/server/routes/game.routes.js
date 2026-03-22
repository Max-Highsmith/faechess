import express from 'express';
import crypto from 'crypto';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import {
  initialBoard, key, parseKey, legalMoves, applyMove,
  isInCheck, hasAnyLegalMove, coordToNotation
} from '../../shared/game-logic.js';

const router = express.Router();

/**
 * Broadcast an event on a game's realtime channel.
 * Must subscribe before sending, then clean up.
 */
async function broadcast(gameId, event, payload) {
  const channel = supabase.channel(`game:${gameId}`);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Channel subscribe timeout')), 5000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout); reject(new Error(`Channel failed: ${status}`));
      }
    });
  });
  await channel.send({ type: 'broadcast', event, payload });
  supabase.removeChannel(channel);
}

function generateInviteCode() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

/**
 * POST /api/games
 * Create a new game. Body: { color: 'white' | 'black' | 'random' }
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
    const board_state = initialBoard();

    const row = {
      white_player_id: color === 'white' ? userId : null,
      black_player_id: color === 'black' ? userId : null,
      status: 'waiting',
      current_turn: 'w',
      board_state,
      move_count: 0,
      invite_code
    };

    const { data, error } = await supabase
      .from('games')
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    res.json({
      game_id: data.id,
      invite_code: data.invite_code,
      color: color === 'white' ? 'w' : 'b'
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/games/join/:inviteCode
 * Join a waiting game via invite code.
 */
router.get('/join/:inviteCode', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: game, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('invite_code', req.params.inviteCode)
      .eq('status', 'waiting')
      .single();

    if (fetchErr || !game) {
      return res.status(404).json({ error: 'Game not found or already started' });
    }

    // Can't join your own game
    if (game.white_player_id === userId || game.black_player_id === userId) {
      return res.status(400).json({ error: 'You are already in this game' });
    }

    // Fill the empty slot
    const updates = { status: 'active' };
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

    // Broadcast player_joined
    await broadcast(game.id, 'player_joined', { player_id: userId, color: joinerColor });

    res.json({
      game_id: updated.id,
      color: joinerColor,
      status: updated.status
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

    res.json({
      ...game,
      my_color: myColor,
      moves: moves || []
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/games/:id/move
 * Submit a move. Body: { from: [x,y,z], to: [x,y,z] }
 */
router.post('/:id/move', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to } = req.body;

    if (!from || !to || from.length !== 3 || to.length !== 3) {
      return res.status(400).json({ error: 'Invalid move format' });
    }

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

    // Determine player's color
    let playerColor;
    if (game.white_player_id === userId) playerColor = 'w';
    else if (game.black_player_id === userId) playerColor = 'b';
    else return res.status(403).json({ error: 'You are not in this game' });

    // Check turn
    if (game.current_turn !== playerColor) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    // Validate move using shared game logic
    const board = game.board_state;
    const [fx, fy, fz] = from;
    const piece = board[key(fx, fy, fz)];

    if (!piece || piece.color !== playerColor) {
      return res.status(400).json({ error: 'Invalid piece' });
    }

    const legal = legalMoves(board, fx, fy, fz);
    const [tx, ty, tz] = to;
    if (!legal.some(([mx, my, mz]) => mx === tx && my === ty && mz === tz)) {
      return res.status(400).json({ error: 'Illegal move' });
    }

    // Apply move
    const { board: newBoard, captured } = applyMove(board, from, to);
    const nextTurn = playerColor === 'w' ? 'b' : 'w';
    const newMoveCount = game.move_count + 1;

    // Check for checkmate / stalemate
    let gameOver = false;
    let result = null;
    if (!hasAnyLegalMove(newBoard, nextTurn)) {
      gameOver = true;
      if (isInCheck(newBoard, nextTurn)) {
        result = playerColor === 'w' ? 'white_wins' : 'black_wins';
      } else {
        result = 'draw';
      }
    }

    // Build notation
    const pn = piece.type === 'P' ? '' : piece.type;
    const cap = captured ? 'x' : '';
    const notation = pn + coordToNotation(...from) + cap + coordToNotation(...to);

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
      result
    };

    await broadcast(game.id, 'move', payload);

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

    // Broadcast resignation
    await broadcast(game.id, 'resign', { player_id: userId, color: playerColor, result });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error resigning:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
