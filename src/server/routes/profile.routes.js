import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';

const router = express.Router();

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('game_id, avatar_url, email')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(data || { game_id: null, avatar_url: null, email: req.user.email });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/profile
 * Update game_id and/or avatar_url
 */
router.put('/', requireAuth, async (req, res) => {
  try {
    const { game_id, avatar_url } = req.body;
    const updates = {};

    if (game_id !== undefined) {
      if (game_id !== null && !/^[a-zA-Z0-9_]{3,20}$/.test(game_id)) {
        return res.status(400).json({ error: 'Game ID must be 3-20 characters (letters, numbers, underscores)' });
      }
      updates.game_id = game_id;
    }

    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('game_id, avatar_url')
      .single();

    if (error) {
      // Unique constraint violation on game_id
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Game ID already taken' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/profile/check-game-id/:gameId
 * Check if a game_id is available
 */
router.get('/check-game-id/:gameId', requireAuth, async (req, res) => {
  try {
    const gameId = req.params.gameId;

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(gameId)) {
      return res.json({ available: false, reason: 'Invalid format' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('game_id', gameId)
      .maybeSingle();

    if (error) throw error;

    // Available if no one has it, or the current user already owns it
    const available = !data || data.id === req.user.id;
    res.json({ available });
  } catch (error) {
    console.error('Error checking game_id:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/profile/:userId
 * Get another user's public profile (game_id + avatar_url only)
 */
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, game_id, avatar_url')
      .eq('id', req.params.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: data.id, game_id: data.game_id, avatar_url: data.avatar_url });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
