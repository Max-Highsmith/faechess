import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';
import { initialBoard } from '../../shared/game-logic.js';
import { initialBoard as torusInitialBoard } from '../../shared/torus-game-logic.js';

const router = express.Router();

const VALID_GAME_TYPES = ['raumschach', 'torus'];
const VALID_TIME_CONTROLS = [0, 3, 5, 10, 15];
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
 * POST /api/matchmaking/join
 * Join the ranked matchmaking queue. If a compatible opponent is waiting,
 * match instantly and create a game.
 */
router.post('/join', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const gameType = VALID_GAME_TYPES.includes(req.body.game_type)
      ? req.body.game_type : 'raumschach';
    const timeControl = VALID_TIME_CONTROLS.includes(req.body.time_control)
      ? req.body.time_control : 5;

    // Clean up stale queue entries (older than 5 minutes)
    await supabase
      .from('matchmaking_queue')
      .delete()
      .lt('created_at', new Date(Date.now() - STALE_THRESHOLD_MS).toISOString());

    // Check if already queued
    const { data: existing } = await supabase
      .from('matchmaking_queue')
      .select('id')
      .eq('player_id', userId)
      .eq('game_type', gameType)
      .eq('time_control', timeControl)
      .maybeSingle();

    if (existing) {
      return res.json({ status: 'queued', queue_id: existing.id });
    }

    // Look for a match (oldest entry, different player, same criteria)
    const { data: match } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('game_type', gameType)
      .eq('time_control', timeControl)
      .neq('player_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (match) {
      // Try to claim the match by deleting the queue entry
      const { error: delErr } = await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('id', match.id);

      if (!delErr) {
        // Match found — create a game with both players
        const colors = Math.random() < 0.5
          ? { white: match.player_id, black: userId }
          : { white: userId, black: match.player_id };

        const board_state = gameType === 'torus'
          ? torusInitialBoard() : initialBoard();
        const timeMsTotal = timeControl > 0 ? timeControl * 60 * 1000 : null;

        const { data: game, error: gameErr } = await supabase
          .from('games')
          .insert({
            white_player_id: colors.white,
            black_player_id: colors.black,
            status: 'active',
            current_turn: 'w',
            board_state,
            move_count: 0,
            invite_code: null,
            time_control: timeControl,
            white_time_remaining: timeMsTotal,
            black_time_remaining: timeMsTotal,
            game_type: gameType,
            last_move_at: timeControl > 0 ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (gameErr) throw gameErr;

        const players = await fetchPlayerProfiles([colors.white, colors.black]);
        const myColor = game.white_player_id === userId ? 'w' : 'b';

        return res.json({
          status: 'matched',
          game_id: game.id,
          color: myColor,
          time_control: timeControl,
          game_type: gameType,
          white_time_remaining: timeMsTotal,
          black_time_remaining: timeMsTotal,
          players
        });
      }
      // If delete failed (race condition), fall through to queue
    }

    // No match found — insert into queue
    const { data: queued, error: qErr } = await supabase
      .from('matchmaking_queue')
      .insert({
        player_id: userId,
        game_type: gameType,
        time_control: timeControl
      })
      .select()
      .single();

    if (qErr) {
      if (qErr.code === '23505') {
        // Already queued (unique constraint)
        return res.json({ status: 'queued' });
      }
      throw qErr;
    }

    res.json({ status: 'queued', queue_id: queued.id });
  } catch (error) {
    console.error('Error joining matchmaking queue:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/matchmaking/leave
 * Remove the current player from the matchmaking queue.
 */
router.post('/leave', requireAuth, async (req, res) => {
  try {
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('player_id', req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving queue:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/matchmaking/status
 * Polling fallback — check if the player has been matched.
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if still in queue
    const { data: queued } = await supabase
      .from('matchmaking_queue')
      .select('id, game_type, time_control, created_at')
      .eq('player_id', userId)
      .maybeSingle();

    if (queued) {
      return res.json({ status: 'queued', since: queued.created_at });
    }

    // Not in queue — check if a ranked game (no invite_code) was just created
    const { data: recentGame } = await supabase
      .from('games')
      .select('id, white_player_id, black_player_id, status, time_control, game_type, white_time_remaining, black_time_remaining')
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .eq('status', 'active')
      .is('invite_code', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentGame) {
      const myColor = recentGame.white_player_id === userId ? 'w' : 'b';
      const players = await fetchPlayerProfiles([recentGame.white_player_id, recentGame.black_player_id]);

      return res.json({
        status: 'matched',
        game_id: recentGame.id,
        color: myColor,
        time_control: recentGame.time_control,
        game_type: recentGame.game_type,
        white_time_remaining: recentGame.white_time_remaining,
        black_time_remaining: recentGame.black_time_remaining,
        players
      });
    }

    res.json({ status: 'idle' });
  } catch (error) {
    console.error('Error checking matchmaking status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
