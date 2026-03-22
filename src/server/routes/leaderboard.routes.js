import express from 'express';
import supabase from '../db.js';

const router = express.Router();

/**
 * GET /api/leaderboard
 * Returns top players by Elo rating.
 * Query params: ?limit=50 (default 50, max 100)
 */
router.get('/', async (req, res) => {
  try {
    let limit = parseInt(req.query.limit) || 50;
    if (limit > 100) limit = 100;

    const { data, error } = await supabase
      .from('users')
      .select('id, game_id, avatar_url, elo_rating, games_played, wins, losses, draws')
      .gt('games_played', 0)
      .order('elo_rating', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
