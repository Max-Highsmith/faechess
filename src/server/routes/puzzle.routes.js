import express from 'express';
import supabase from '../db.js';
import { requireAuth } from '../auth-middleware.js';

const router = express.Router();

/**
 * Helper function to get Monday of current week
 */
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * GET /api/puzzles
 * Get all active puzzles (public)
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('puzzles')
      .select('id, title, description, difficulty, week_number, created_at')
      .eq('is_active', true)
      .order('week_number', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching puzzles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/puzzles/weekly
 * Get this week's puzzle (public)
 */
router.get('/weekly', async (req, res) => {
  try {
    const currentWeek = getStartOfWeek(new Date());
    const weekString = currentWeek.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('weekly_puzzle_schedule')
      .select(`
        puzzle_id,
        puzzles (*)
      `)
      .eq('scheduled_week', weekString)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json(data?.puzzles || null);
  } catch (error) {
    console.error('Error fetching weekly puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/puzzles/:id
 * Get specific puzzle by ID (public)
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('puzzles')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Puzzle not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching puzzle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/puzzles/:id/attempt
 * Submit puzzle attempt (requires auth)
 */
router.post('/:id/attempt', requireAuth, async (req, res) => {
  try {
    const { solved } = req.body;
    const puzzleId = parseInt(req.params.id);
    const userId = req.user.id;

    if (typeof solved !== 'boolean') {
      return res.status(400).json({ error: 'Invalid request - solved must be a boolean' });
    }

    // First check if attempt already exists
    const { data: existing } = await supabase
      .from('user_puzzle_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzleId)
      .single();

    let result;

    if (existing) {
      // Update existing attempt
      const updates = {
        attempts: existing.attempts + 1
      };

      if (solved && !existing.solved) {
        updates.solved = true;
        updates.solved_at = new Date().toISOString();
      }

      result = await supabase
        .from('user_puzzle_attempts')
        .update(updates)
        .eq('user_id', userId)
        .eq('puzzle_id', puzzleId)
        .select()
        .single();
    } else {
      // Create new attempt
      result = await supabase
        .from('user_puzzle_attempts')
        .insert({
          user_id: userId,
          puzzle_id: puzzleId,
          solved,
          attempts: 1,
          solved_at: solved ? new Date().toISOString() : null
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json(result.data);
  } catch (error) {
    console.error('Error submitting puzzle attempt:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/puzzles/user/progress
 * Get user's puzzle progress (requires auth)
 */
router.get('/user/progress', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_puzzle_attempts')
      .select('puzzle_id, solved, attempts, solved_at, first_attempt_at')
      .eq('user_id', req.user.id)
      .order('first_attempt_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
